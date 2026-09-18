-- Direct messaging between a tenant and the admin(s). One thread per tenant — `tenant_id`
-- identifies the conversation regardless of which side (tenant or admin) sent a given message.

create table messages (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references profiles (id) on delete cascade,
  sender_id uuid not null references profiles (id) on delete restrict,
  body text not null,
  created_at timestamptz not null default now()
);

create index messages_tenant_id_idx on messages (tenant_id, created_at);

alter table messages enable row level security;

create policy "tenant reads own thread"
  on messages for select
  using (tenant_id = auth.uid());

create policy "tenant sends in own thread"
  on messages for insert
  with check (tenant_id = auth.uid() and sender_id = auth.uid());

create policy "admin full access messages"
  on messages for all using (is_admin()) with check (is_admin());

alter publication supabase_realtime add table messages;
