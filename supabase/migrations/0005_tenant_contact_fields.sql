-- Tenants no longer need a real email on file — landlords often only have a phone number or a
-- Facebook/Messenger handle. Email stays on `profiles` for tenants who do have one (their login
-- invite goes to it); it's just no longer required.

create type contact_platform as enum ('phone', 'facebook_messenger', 'viber', 'whatsapp', 'telegram');

alter table profiles
  alter column email drop not null,
  add column contact_platform contact_platform,
  add column contact_handle text,
  add column notes text;

-- A tenant still needs an auth.users row (profiles.id references it) even with no real email —
-- see apps/web/src/app/dashboard/tenants/actions.ts for how a placeholder email is used
-- internally when the admin doesn't supply one.
