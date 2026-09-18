-- Tenant-submitted maintenance requests (plumbing, electrical, etc.) — separate from the
-- "maintenance" invoice line item category, which is a landlord-added charge. This is a ticket
-- a tenant raises; it never touches billing on its own.

create type maintenance_status as enum ('submitted', 'in_progress', 'resolved');

create table maintenance_requests (
  id uuid primary key default gen_random_uuid(),
  lease_id uuid not null references leases (id) on delete restrict,
  tenant_id uuid not null references profiles (id) on delete restrict,
  category text not null,
  description text not null,
  photo_url text,
  status maintenance_status not null default 'submitted',
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create index maintenance_requests_tenant_id_idx on maintenance_requests (tenant_id);
create index maintenance_requests_status_idx on maintenance_requests (status);

alter table maintenance_requests enable row level security;

create policy "admin full access maintenance_requests"
  on maintenance_requests for all using (is_admin()) with check (is_admin());

create policy "tenant reads own maintenance_requests"
  on maintenance_requests for select
  using (tenant_id = auth.uid());

create policy "tenant submits own maintenance_request"
  on maintenance_requests for insert
  with check (tenant_id = auth.uid() and status = 'submitted');

create trigger maintenance_requests_audit
  after insert or update or delete on maintenance_requests
  for each row execute function write_audit_log();

alter publication supabase_realtime add table maintenance_requests;

-- Storage RLS for a private "maintenance-photos" bucket — create it in the dashboard first
-- (Storage → New bucket → name "maintenance-photos" → Public bucket OFF), same as
-- "payment-proofs". Same access shape: tenant owns their own uploads, admin reads all.

create policy "tenant uploads own maintenance photo"
  on storage.objects for insert
  with check (
    bucket_id = 'maintenance-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "tenant reads own maintenance photo"
  on storage.objects for select
  using (
    bucket_id = 'maintenance-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "admin reads all maintenance photos"
  on storage.objects for select
  using (
    bucket_id = 'maintenance-photos' and is_admin()
  );
