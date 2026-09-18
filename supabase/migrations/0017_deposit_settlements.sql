  -- Records what happens to a tenant's security deposit when their lease ends — previously
  -- terminating a lease just flipped its status and freed the unit, with no record of whether the
  -- deposit was returned, partially withheld for damages, or forfeited.

  create table deposit_settlements (
    id uuid primary key default gen_random_uuid(),
    lease_id uuid not null unique references leases (id) on delete cascade,
    deposit_held numeric(12, 2) not null default 0,
    refund_amount numeric(12, 2) not null default 0,
    notes text,
    settled_by uuid references profiles (id) on delete set null,
    settled_at timestamptz not null default now()
  );

  create table deposit_deductions (
    id uuid primary key default gen_random_uuid(),
    settlement_id uuid not null references deposit_settlements (id) on delete cascade,
    description text not null,
    amount numeric(12, 2) not null check (amount >= 0),
    created_at timestamptz not null default now()
  );

  create index deposit_deductions_settlement_id_idx on deposit_deductions (settlement_id);

  alter table deposit_settlements enable row level security;

  create policy "admin full access deposit_settlements"
    on deposit_settlements for all using (is_admin()) with check (is_admin());

  create policy "tenant reads own deposit_settlements"
    on deposit_settlements for select
    using (lease_id in (select id from leases where tenant_id = auth.uid()));

  alter table deposit_deductions enable row level security;

  create policy "admin full access deposit_deductions"
    on deposit_deductions for all using (is_admin()) with check (is_admin());

  create policy "tenant reads own deposit_deductions"
    on deposit_deductions for select
    using (
      settlement_id in (
        select id from deposit_settlements where lease_id in (select id from leases where tenant_id = auth.uid())
      )
    );
