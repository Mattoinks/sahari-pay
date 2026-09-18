-- The original "own folder" (auth.uid()-matching) policies on the "avatars" bucket from
-- 0014_landlord_profile_fields.sql could not be made to work from the web admin's landlord
-- profile upload despite exhaustive verification (JWT decoded and confirmed correct, policy
-- text confirmed correct and freshly recreated, no restrictive policies present anywhere on
-- storage.objects) — something about that combination just doesn't evaluate correctly in this
-- project. Every OTHER storage upload that actually works from this same web-admin
-- reconstructed-client pattern (payment-qr, advertisements) uses an is_admin() check instead of
-- folder-matching, so switch to that proven-working pattern here too. Safe to do since this page
-- (Units → Landlord profile) is already admin-only — there's no "each user manages only their
-- own folder" need here, it's a single shared landlord profile.

drop policy if exists "user uploads own avatar" on storage.objects;
create policy "admin uploads avatar"
  on storage.objects for insert
  with check (bucket_id = 'avatars' and is_admin());

drop policy if exists "user updates own avatar" on storage.objects;
create policy "admin updates avatar"
  on storage.objects for update
  using (bucket_id = 'avatars' and is_admin());

drop policy if exists "user deletes own avatar" on storage.objects;
create policy "admin deletes avatar"
  on storage.objects for delete
  using (bucket_id = 'avatars' and is_admin());
