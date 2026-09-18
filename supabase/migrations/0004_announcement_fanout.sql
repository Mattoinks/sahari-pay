-- When an admin posts an announcement, fan it out into `notifications` for every tenant it
-- targets, so the existing tenant notifications feed (and push dispatch) picks it up for free —
-- no separate "announcements" screen needed on mobile.

create or replace function fan_out_announcement()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into notifications (recipient_id, type, title, body)
  select distinct l.tenant_id, 'announcement', new.title, new.body
  from leases l
  join units u on u.id = l.unit_id
  where l.status = 'active'
    and (
      new.audience = 'all'
      or (new.audience = 'unit' and l.unit_id = new.unit_id)
      or (new.audience = 'property' and u.property_id = new.property_id)
    );

  return new;
end;
$$;

create trigger announcements_fan_out
  after insert on announcements
  for each row execute function fan_out_announcement();
