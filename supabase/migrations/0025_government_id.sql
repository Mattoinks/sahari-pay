-- Government-issued ID, collected at mobile self-signup (landlords standardly require this
-- during the rental application) — shown to the admin when reviewing a pending account, same
-- review screen as occupation_status/source_of_income (see 0022_tenant_approval.sql).

alter table profiles add column if not exists government_id_type text
  check (government_id_type is null or government_id_type in
    ('philsys', 'drivers_license', 'passport', 'umid', 'postal_id', 'voters_id', 'other'));

alter table profiles add column if not exists government_id_path text;

-- Storage RLS for a private "government-ids" bucket — create it in the dashboard first
-- (Storage -> New bucket -> name "government-ids" -> Public bucket OFF). Highly sensitive
-- personal data, so strictly private + folder-scoped, same shape as maintenance-photos:
-- tenant owns their own upload/read, admin reads all (no admin write/delete needed).

drop policy if exists "tenant uploads own government id" on storage.objects;
create policy "tenant uploads own government id"
  on storage.objects for insert
  with check (
    bucket_id = 'government-ids'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "tenant reads own government id" on storage.objects;
create policy "tenant reads own government id"
  on storage.objects for select
  using (
    bucket_id = 'government-ids'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "admin reads all government ids" on storage.objects;
create policy "admin reads all government ids"
  on storage.objects for select
  using (bucket_id = 'government-ids' and is_admin());
