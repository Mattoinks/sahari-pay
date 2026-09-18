-- Lets the admin dashboard show an "unread messages" count. A message is unread-by-admin while
-- read_at is null; the reply action sets it immediately on the admin's own messages (they've
-- obviously "read" what they just sent), and the admin thread page marks a tenant's messages
-- read when it's opened. Tenant-side unread state isn't tracked — the mobile app doesn't need it
-- since the realtime subscription already shows new messages as they arrive while it's open.
alter table messages add column read_at timestamptz;

-- Backfill: treat every message that existed before this feature as already read, so the new
-- "unread" badge starts at 0 and only counts genuinely new tenant messages from here on —
-- otherwise every historical message (admin's own included) would show up as unread on day one.
update messages set read_at = created_at where read_at is null;
