-- Landlord-facing profile fields (photo, social link) shown to tenants in the mobile app's
-- Messages screen "who am I talking to" header. contact_platform/contact_handle/phone/email
-- already existed on profiles (added for tenant contact info) — reused here for the admin's own
-- row rather than duplicating equivalent columns.

alter table profiles add column avatar_url text;
alter table profiles add column social_link text;

-- Storage RLS for the "avatars" bucket (create it in the dashboard first: Storage → New bucket →
-- name "avatars" → Public bucket ON — a profile photo is meant to be publicly visible, same
-- reasoning as "payment-qr"). Any signed-in user manages only their own avatar, folder-scoped by
-- uid like "payment-proofs"/"maintenance-photos".

create policy "user uploads own avatar"
  on storage.objects for insert
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "user updates own avatar"
  on storage.objects for update
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "user deletes own avatar"
  on storage.objects for delete
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
