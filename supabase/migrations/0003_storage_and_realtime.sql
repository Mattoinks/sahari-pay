-- Storage RLS for the private "payment-proofs" bucket (create the bucket itself in the
-- dashboard first: Storage → New bucket → name "payment-proofs" → Public bucket OFF).
-- A private bucket alone does NOT grant access — storage.objects has its own RLS, and with
-- no policies every authenticated request is denied. These policies mirror the transactions
-- table's access rules: tenants can read/write their own proof, admins can read all of them.

create policy "tenant uploads own payment proof"
  on storage.objects for insert
  with check (
    bucket_id = 'payment-proofs'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "tenant reads own payment proof"
  on storage.objects for select
  using (
    bucket_id = 'payment-proofs'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "admin reads all payment proofs"
  on storage.objects for select
  using (
    bucket_id = 'payment-proofs' and is_admin()
  );

-- Enable Realtime change broadcasts on the tables the verification queue and tenant
-- notifications feed need to live-update from (no polling).
alter publication supabase_realtime add table transactions;
alter publication supabase_realtime add table notifications;
