-- Optional nickname/preferred name, separate from the tenant's legal full_name — used for
-- greetings and how their name shows on the profile.

alter table profiles
  add column display_name text;
