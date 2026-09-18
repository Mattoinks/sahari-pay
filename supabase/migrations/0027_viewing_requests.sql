-- Lets a tenant request an in-person meetup — either to view a unit before applying, or to sign
-- the lease/contract once approved — instead of that happening entirely off-app. The admin
-- confirms/declines from the dashboard; either way the tenant gets notified.

create table viewing_requests (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references profiles (id) on delete cascade,
  purpose text not null default 'viewing' check (purpose in ('viewing', 'lease_signing')),
  requested_date date not null,
  requested_time time not null,
  notes text,
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'declined', 'cancelled')),
  admin_response text,
  created_at timestamptz not null default now()
);

create index viewing_requests_tenant_id_idx on viewing_requests (tenant_id);
create index viewing_requests_status_idx on viewing_requests (status);

alter table viewing_requests enable row level security;

create policy "admin full access viewing_requests"
  on viewing_requests for all using (is_admin()) with check (is_admin());

create policy "tenant reads own viewing_requests"
  on viewing_requests for select
  using (tenant_id = auth.uid());

create policy "tenant creates own viewing_requests"
  on viewing_requests for insert
  with check (tenant_id = auth.uid() and status = 'pending');

-- Tenants may only cancel their own request, never confirm/decline it themselves.
create policy "tenant cancels own viewing_requests"
  on viewing_requests for update
  using (tenant_id = auth.uid())
  with check (tenant_id = auth.uid() and status = 'cancelled');

create trigger viewing_requests_audit
  after insert or update or delete on viewing_requests
  for each row execute function write_audit_log();

alter publication supabase_realtime add table viewing_requests;

alter type notification_type add value if not exists 'viewing_update';
