-- TenantPay initial schema: tables, enums, triggers, RLS policies.
-- Run via `supabase db push` or the Supabase SQL editor.
--
-- Utilities (electricity/water/internet) are billed directly by the utility providers to
-- tenants, not through TenantPay — invoices here only cover rent (plus optional maintenance
-- charges, penalties, or credits the landlord adds manually).

create extension if not exists "pgcrypto";

-- ============================================================
-- ENUMS
-- ============================================================
create type user_role as enum ('admin', 'tenant');
create type unit_status as enum ('vacant', 'occupied', 'maintenance');
create type lease_status as enum ('active', 'ended', 'terminated');
create type invoice_status as enum ('draft', 'pending', 'partially_paid', 'paid', 'overdue');
create type line_item_category as enum ('rent', 'maintenance', 'penalty', 'credit');
create type payment_method as enum ('gcash', 'bank_transfer', 'cash', 'other');
create type transaction_status as enum ('submitted', 'approved', 'rejected');
create type announcement_audience as enum ('all', 'unit', 'property');
create type notification_type as enum ('due_reminder', 'payment_verified', 'payment_rejected', 'announcement');

-- ============================================================
-- TABLES
-- ============================================================

create table profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null,
  email text not null,
  phone text,
  role user_role not null default 'tenant',
  created_at timestamptz not null default now()
);

create table properties (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references profiles (id) on delete restrict,
  name text not null,
  address text not null,
  gcash_number text,
  bank_details text,
  created_at timestamptz not null default now()
);

create table units (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references properties (id) on delete restrict,
  unit_number text not null,
  base_rent numeric(12, 2) not null check (base_rent >= 0),
  status unit_status not null default 'vacant',
  created_at timestamptz not null default now(),
  unique (property_id, unit_number)
);

create table leases (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null references units (id) on delete restrict,
  tenant_id uuid not null references profiles (id) on delete restrict,
  monthly_rent numeric(12, 2) not null check (monthly_rent >= 0),
  start_date date not null,
  end_date date,
  billing_day smallint not null default 1 check (billing_day between 1 and 28),
  status lease_status not null default 'active',
  created_at timestamptz not null default now()
);

create index leases_tenant_id_idx on leases (tenant_id);
create index leases_unit_id_idx on leases (unit_id);
-- Only one active lease per unit at a time.
create unique index leases_one_active_per_unit on leases (unit_id) where (status = 'active');

create table invoices (
  id uuid primary key default gen_random_uuid(),
  lease_id uuid not null references leases (id) on delete restrict,
  billing_period_start date not null,
  billing_period_end date not null,
  due_date date not null,
  total_amount numeric(12, 2) not null default 0,
  amount_paid numeric(12, 2) not null default 0,
  status invoice_status not null default 'draft',
  created_at timestamptz not null default now()
);

create index invoices_lease_id_idx on invoices (lease_id);
create index invoices_status_idx on invoices (status);

create table invoice_line_items (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references invoices (id) on delete cascade,
  category line_item_category not null,
  description text not null,
  amount numeric(12, 2) not null,
  created_at timestamptz not null default now()
);

create index invoice_line_items_invoice_id_idx on invoice_line_items (invoice_id);

create table transactions (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references invoices (id) on delete restrict,
  tenant_id uuid not null references profiles (id) on delete restrict,
  amount numeric(12, 2) not null check (amount > 0),
  payment_method payment_method not null,
  reference_number text not null,
  proof_url text,
  status transaction_status not null default 'submitted',
  verified_by uuid references profiles (id) on delete restrict,
  verified_at timestamptz,
  rejection_reason text,
  created_at timestamptz not null default now()
);

create index transactions_invoice_id_idx on transactions (invoice_id);
create index transactions_tenant_id_idx on transactions (tenant_id);
create index transactions_status_idx on transactions (status);

create table announcements (
  id uuid primary key default gen_random_uuid(),
  posted_by uuid not null references profiles (id) on delete restrict,
  title text not null,
  body text not null,
  audience announcement_audience not null default 'all',
  property_id uuid references properties (id) on delete cascade,
  unit_id uuid references units (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references profiles (id) on delete cascade,
  type notification_type not null,
  title text not null,
  body text not null,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

create index notifications_recipient_id_idx on notifications (recipient_id, read);

create table audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references profiles (id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid not null,
  before_state jsonb,
  after_state jsonb,
  created_at timestamptz not null default now()
);

create index audit_logs_entity_idx on audit_logs (entity_type, entity_id);

-- ============================================================
-- HELPER: current user's role (used throughout RLS policies)
-- ============================================================
create or replace function is_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from profiles where id = auth.uid() and role = 'admin'
  );
$$;

-- ============================================================
-- TRIGGER: create a profile row whenever a new auth user signs up
-- ============================================================
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into profiles (id, full_name, email, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.email),
    new.email,
    coalesce((new.raw_user_meta_data ->> 'role')::user_role, 'tenant')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ============================================================
-- TRIGGER: recalculate invoice amount_paid/status from approved transactions
-- ============================================================
create or replace function recalculate_invoice()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invoice_id uuid;
  v_total numeric(12, 2);
  v_paid numeric(12, 2);
  v_due_date date;
  v_status invoice_status;
begin
  v_invoice_id := coalesce(new.invoice_id, old.invoice_id);

  select total_amount, due_date into v_total, v_due_date
  from invoices where id = v_invoice_id;

  select coalesce(sum(amount), 0) into v_paid
  from transactions
  where invoice_id = v_invoice_id and status = 'approved';

  if v_paid <= 0 then
    v_status := case when v_due_date < current_date then 'overdue' else 'pending' end;
  elsif v_paid < v_total then
    v_status := 'partially_paid';
  else
    v_status := 'paid';
  end if;

  update invoices
  set amount_paid = v_paid, status = v_status
  where id = v_invoice_id;

  return coalesce(new, old);
end;
$$;

create trigger transactions_recalculate_invoice
  after insert or update or delete on transactions
  for each row execute function recalculate_invoice();

-- ============================================================
-- TRIGGER: keep invoices.total_amount in sync with its line items
-- ============================================================
create or replace function recalculate_invoice_total()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invoice_id uuid;
begin
  v_invoice_id := coalesce(new.invoice_id, old.invoice_id);

  update invoices
  set total_amount = (
    select coalesce(sum(amount), 0) from invoice_line_items where invoice_id = v_invoice_id
  )
  where id = v_invoice_id;

  return coalesce(new, old);
end;
$$;

create trigger line_items_recalculate_total
  after insert or update or delete on invoice_line_items
  for each row execute function recalculate_invoice_total();

-- ============================================================
-- TRIGGER: audit log on invoices and transactions changes
-- ============================================================
create or replace function write_audit_log()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into audit_logs (actor_id, action, entity_type, entity_id, before_state, after_state)
  values (
    auth.uid(),
    tg_op,
    tg_table_name,
    coalesce(new.id, old.id),
    case when tg_op = 'INSERT' then null else to_jsonb(old) end,
    case when tg_op = 'DELETE' then null else to_jsonb(new) end
  );
  return coalesce(new, old);
end;
$$;

create trigger invoices_audit
  after insert or update or delete on invoices
  for each row execute function write_audit_log();

create trigger transactions_audit
  after insert or update or delete on transactions
  for each row execute function write_audit_log();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
alter table profiles enable row level security;
alter table properties enable row level security;
alter table units enable row level security;
alter table leases enable row level security;
alter table invoices enable row level security;
alter table invoice_line_items enable row level security;
alter table transactions enable row level security;
alter table announcements enable row level security;
alter table notifications enable row level security;
alter table audit_logs enable row level security;

-- profiles
create policy "read own profile or admin reads all"
  on profiles for select
  using (id = auth.uid() or is_admin());

create policy "admin manages profiles"
  on profiles for update using (is_admin());

-- properties / units — admin-only surface, tenants have no direct need to browse them
create policy "admin full access properties"
  on properties for all using (is_admin()) with check (is_admin());

create policy "admin full access units"
  on units for all using (is_admin()) with check (is_admin());

create policy "tenant reads own unit"
  on units for select
  using (
    id in (select unit_id from leases where tenant_id = auth.uid())
  );

-- leases
create policy "admin full access leases"
  on leases for all using (is_admin()) with check (is_admin());

create policy "tenant reads own leases"
  on leases for select
  using (tenant_id = auth.uid());

-- invoices
create policy "admin full access invoices"
  on invoices for all using (is_admin()) with check (is_admin());

create policy "tenant reads own invoices"
  on invoices for select
  using (lease_id in (select id from leases where tenant_id = auth.uid()));

-- invoice_line_items
create policy "admin full access line_items"
  on invoice_line_items for all using (is_admin()) with check (is_admin());

create policy "tenant reads own invoice line items"
  on invoice_line_items for select
  using (
    invoice_id in (
      select i.id from invoices i
      join leases l on l.id = i.lease_id
      where l.tenant_id = auth.uid()
    )
  );

-- transactions
create policy "admin full access transactions"
  on transactions for all using (is_admin()) with check (is_admin());

create policy "tenant reads own transactions"
  on transactions for select
  using (tenant_id = auth.uid());

create policy "tenant submits own transaction"
  on transactions for insert
  with check (tenant_id = auth.uid() and status = 'submitted');

-- announcements
create policy "admin full access announcements"
  on announcements for all using (is_admin()) with check (is_admin());

create policy "tenant reads relevant announcements"
  on announcements for select
  using (
    audience = 'all'
    or (audience = 'unit' and unit_id in (select unit_id from leases where tenant_id = auth.uid()))
    or (audience = 'property' and property_id in (
      select u.property_id from units u
      join leases l on l.unit_id = u.id
      where l.tenant_id = auth.uid()
    ))
  );

-- notifications
create policy "user reads own notifications"
  on notifications for select
  using (recipient_id = auth.uid());

create policy "user marks own notifications read"
  on notifications for update
  using (recipient_id = auth.uid())
  with check (recipient_id = auth.uid());

create policy "admin inserts notifications"
  on notifications for insert
  with check (is_admin());

-- audit_logs — admin only
create policy "admin reads audit_logs"
  on audit_logs for select using (is_admin());
