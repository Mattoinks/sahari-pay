-- Admin-managed payment channels (GCash / Bank Transfer / Palawan) — the QR code and account
-- details tenants see when they pick a payment method in the mobile app, instead of each tenant
-- having to be told these out of band.
--
-- Written to be safe to re-run in full (as when pasting into the Supabase SQL editor and
-- re-running after a later statement in the same script failed) rather than relying on it only
-- ever being run once.

do $$
begin
  if not exists (
    select 1 from pg_enum e
    join pg_type t on t.oid = e.enumtypid
    where t.typname = 'payment_method' and e.enumlabel = 'palawan'
  ) then
    alter type payment_method rename value 'cash' to 'palawan';
  end if;
end $$;

create table if not exists payment_channels (
  method payment_method primary key,
  display_name text not null,
  qr_image_path text,
  account_name text,
  account_number text,
  instructions text,
  updated_at timestamptz not null default now()
);

alter table payment_channels enable row level security;

drop policy if exists "admin manages payment_channels" on payment_channels;
create policy "admin manages payment_channels"
  on payment_channels for all using (is_admin()) with check (is_admin());

drop policy if exists "tenants view payment_channels" on payment_channels;
create policy "tenants view payment_channels"
  on payment_channels for select
  using (auth.uid() is not null);

insert into payment_channels (method, display_name, instructions) values
  ('gcash', 'GCash', null),
  ('bank_transfer', 'Bank Transfer', null),
  (
    'palawan',
    'Palawan Express Pera Padala',
    'Send to the receiver name above at any Palawan branch, then enter the transaction code from your receipt as your reference number below.'
  )
on conflict (method) do nothing;

-- Storage RLS for the "payment-qr" bucket (create it in the dashboard first: Storage → New
-- bucket → name "payment-qr" → Public bucket ON). A QR that only lets someone send money in is
-- safe to be public — same as posting it on a receipt or a storefront — so this skips the
-- signed-URL dance "payment-proofs" needs and serves straight from the public bucket URL.

drop policy if exists "admin uploads payment qr" on storage.objects;
create policy "admin uploads payment qr"
  on storage.objects for insert
  with check (bucket_id = 'payment-qr' and is_admin());

drop policy if exists "admin updates payment qr" on storage.objects;
create policy "admin updates payment qr"
  on storage.objects for update
  using (bucket_id = 'payment-qr' and is_admin());

drop policy if exists "admin deletes payment qr" on storage.objects;
create policy "admin deletes payment qr"
  on storage.objects for delete
  using (bucket_id = 'payment-qr' and is_admin());
