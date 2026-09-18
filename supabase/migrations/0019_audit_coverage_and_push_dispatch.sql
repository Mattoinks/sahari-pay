-- Gap 1: audit log coverage. write_audit_log() already exists and is fully generic (keys off
-- tg_table_name/NEW/OLD), but was only wired to `invoices` and `transactions` — lease
-- terminations, contract changes, and deposit settlements (the actions with real money/legal
-- weight) left zero trail. Wire it to the tables that matter.
create trigger leases_audit
  after insert or update or delete on leases
  for each row execute function write_audit_log();

create trigger deposit_settlements_audit
  after insert or update or delete on deposit_settlements
  for each row execute function write_audit_log();

create trigger deposit_deductions_audit
  after insert or update or delete on deposit_deductions
  for each row execute function write_audit_log();

-- Gap 2: push notifications were only ever sent from one place (the web verification
-- approve/reject actions, calling Expo's API directly over fetch). Everything else that writes
-- to `notifications` — announcements, the new recurring-invoice/due-reminder cron jobs, messages
-- if that's ever added — only reached the in-app bell, never the tenant's phone. Centralize push
-- dispatch as a trigger on `notifications` itself, so every insert (from anywhere: a trigger, a
-- cron job, a Server Action) gets pushed the same way, once.
create extension if not exists pg_net;

create or replace function dispatch_push_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tokens text[];
begin
  select array_agg(expo_push_token) into v_tokens
  from push_tokens
  where user_id = new.recipient_id;

  if v_tokens is not null and array_length(v_tokens, 1) > 0 then
    perform net.http_post(
      url := 'https://exp.host/--/api/v2/push/send',
      headers := jsonb_build_object('Content-Type', 'application/json'),
      body := (
        select jsonb_agg(jsonb_build_object('to', t, 'title', new.title, 'body', new.body))
        from unnest(v_tokens) as t
      )
    );
  end if;

  return new;
end;
$$;

create trigger notifications_dispatch_push
  after insert on notifications
  for each row execute function dispatch_push_notification();
