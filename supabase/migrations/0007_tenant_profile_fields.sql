-- Household info collected at signup, shown on the tenant's own profile and the admin's
-- tenant detail view.

alter table profiles
  add column birthdate date,
  add column occupancy_type text,
  add column number_of_occupants integer;

-- Tenants could not update their own profile row at all before this — signup only inserts
-- via the handle_new_user trigger. Let self-service fields (not role) be tenant-editable,
-- and use a trigger (not just RLS) to hard-block role escalation regardless of what a client
-- sends, since RLS alone only filters rows, not individual column values.
create policy "tenant updates own profile"
  on profiles for update
  using (id = auth.uid())
  with check (id = auth.uid());

create or replace function prevent_self_role_escalation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_admin() then
    new.role := old.role;
  end if;
  return new;
end;
$$;

create trigger profiles_prevent_role_escalation
  before update on profiles
  for each row execute function prevent_self_role_escalation();
