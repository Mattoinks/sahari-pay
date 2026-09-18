-- Self-signup (mobile SignUpScreen) creates a full tenant account with zero admin involvement.
-- Add an approval gate so a self-registered account can't use the app (or write any data) until
-- an admin reviews it. Admin-invited tenants and every pre-existing account are grandfathered in
-- as already-approved (they were already vetted by the admin's act of inviting them) — only
-- self-signup explicitly marks itself 'pending'.

alter table profiles add column if not exists approval_status text not null default 'approved'
  check (approval_status in ('pending', 'approved', 'rejected'));

-- handle_new_user() reads raw_user_meta_data the same way every signup path already does: admin
-- invites (inviteTenant) don't set approval_status, so they fall through to the column default
-- 'approved'; self-signup explicitly passes 'pending' (see apps/mobile/src/screens/SignUpScreen.tsx).
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into profiles (id, full_name, email, role, approval_status)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.email),
    new.email,
    coalesce((new.raw_user_meta_data ->> 'role')::user_role, 'tenant'),
    coalesce(new.raw_user_meta_data ->> 'approval_status', 'approved')
  );
  return new;
end;
$$;

-- Defense in depth: block a pending/rejected account from writing data even if the mobile app's
-- UI gate is bypassed (calling the Supabase client directly). Read access is left alone — it's
-- already scoped to the caller's own rows, and nothing sensitive leaks from a pending tenant
-- seeing their own (empty) profile.
create or replace function is_approved(uid uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from profiles where id = uid and approval_status = 'approved'
  );
$$;

drop policy if exists "tenant sends in own thread" on messages;
create policy "tenant sends in own thread"
  on messages for insert
  with check (tenant_id = auth.uid() and sender_id = auth.uid() and is_approved(auth.uid()));

drop policy if exists "tenant submits own maintenance_request" on maintenance_requests;
create policy "tenant submits own maintenance_request"
  on maintenance_requests for insert
  with check (tenant_id = auth.uid() and status = 'submitted' and is_approved(auth.uid()));

drop policy if exists "tenant submits own transaction" on transactions;
create policy "tenant submits own transaction"
  on transactions for insert
  with check (tenant_id = auth.uid() and status = 'submitted' and is_approved(auth.uid()));

alter type notification_type add value if not exists 'account_approved';
alter type notification_type add value if not exists 'account_rejected';
