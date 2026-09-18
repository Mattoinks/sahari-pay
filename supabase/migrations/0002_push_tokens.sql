-- Device push tokens for the tenant mobile app (Expo push notifications).

create table push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles (id) on delete cascade,
  expo_push_token text not null unique,
  created_at timestamptz not null default now()
);

create index push_tokens_user_id_idx on push_tokens (user_id);

alter table push_tokens enable row level security;

create policy "user manages own push tokens"
  on push_tokens for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "admin reads push tokens"
  on push_tokens for select
  using (is_admin());
