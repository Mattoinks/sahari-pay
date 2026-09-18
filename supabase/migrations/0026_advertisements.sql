-- Admin-managed promo banners shown as an auto-sliding carousel on the mobile Home screen.

create table if not exists advertisements (
  id uuid primary key default gen_random_uuid(),
  image_path text not null,
  caption text,
  link_url text,
  -- When true, tapping the banner opens the in-app appointment scheduler (ScheduleViewingScreen)
  -- instead of link_url — lets the banner image itself be the "book a viewing" button.
  opens_scheduler boolean not null default false,
  display_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table advertisements enable row level security;

drop policy if exists "admin manages advertisements" on advertisements;
create policy "admin manages advertisements"
  on advertisements for all using (is_admin()) with check (is_admin());

drop policy if exists "tenants view active advertisements" on advertisements;
create policy "tenants view active advertisements"
  on advertisements for select
  using (is_active and auth.uid() is not null);

-- Storage RLS for the "advertisements" bucket (create it in the dashboard first: Storage → New
-- bucket → name "advertisements" → Public bucket ON) — same reasoning as "payment-qr": these are
-- promotional images meant to be shown broadly, not sensitive, so no signed-URL dance needed.

drop policy if exists "admin uploads advertisement" on storage.objects;
create policy "admin uploads advertisement"
  on storage.objects for insert
  with check (bucket_id = 'advertisements' and is_admin());

drop policy if exists "admin updates advertisement" on storage.objects;
create policy "admin updates advertisement"
  on storage.objects for update
  using (bucket_id = 'advertisements' and is_admin());

drop policy if exists "admin deletes advertisement" on storage.objects;
create policy "admin deletes advertisement"
  on storage.objects for delete
  using (bucket_id = 'advertisements' and is_admin());
