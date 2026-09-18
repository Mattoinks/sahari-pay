-- Optional image attachment on a message. Storage RLS for a private "message-attachments"
-- bucket — create it in the dashboard first (Storage -> New bucket -> name
-- "message-attachments" -> Public bucket OFF), same private-bucket + signed-URL pattern as
-- "maintenance-photos".

alter table messages add column if not exists attachment_path text;

-- Unlike maintenance-photos (only the tenant ever uploads), a message thread is written to by
-- BOTH sides but is always keyed by tenant_id — so the folder prefix is the thread's tenant_id,
-- not necessarily the uploader's own uid. Tenants only ever have one thread (their own), so
-- "own folder" and "own thread" coincide for them; admins need access to every thread.

drop policy if exists "tenant uploads own thread attachment" on storage.objects;
create policy "tenant uploads own thread attachment"
  on storage.objects for insert
  with check (
    bucket_id = 'message-attachments'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "tenant reads own thread attachment" on storage.objects;
create policy "tenant reads own thread attachment"
  on storage.objects for select
  using (
    bucket_id = 'message-attachments'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "admin full access message attachments" on storage.objects;
create policy "admin full access message attachments"
  on storage.objects for all
  using (bucket_id = 'message-attachments' and is_admin())
  with check (bucket_id = 'message-attachments' and is_admin());
