-- Closes the biggest remaining manual-labor gap: until now, an admin had to click "Generate
-- invoice" by hand every single month for every tenant (SPEC.md mentions billing-day automation,
-- but it was never built). This adds two scheduled jobs, both running inside Postgres so no
-- external server/cron is needed:
--   1. generate_recurring_invoices() — once a day, creates the next month's rent invoice for
--      every active lease whose billing_day matches today, and notifies the tenant in-app.
--   2. send_due_reminders() — once a day, notifies tenants 3 days before an unpaid invoice's
--      due date (once per invoice, tracked in due_reminder_log so it can't double-fire).
--
-- billing_day is constrained to 1-28 (see 0001_init.sql), so every calendar month has that day
-- — no end-of-month clamping needed.
--
-- Requires the pg_cron extension. `create extension` below enables it if your Supabase project
-- allows it from a migration; if this statement fails, enable "pg_cron" first via the dashboard
-- (Database → Extensions), then re-run just the two `select cron.schedule(...)` calls at the
-- bottom of this file.

create extension if not exists pg_cron;

create or replace function generate_recurring_invoices()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  lease record;
  v_period_start date := current_date;
  v_period_end date := (current_date + interval '1 month' - interval '1 day')::date;
  v_new_invoice_id uuid;
begin
  for lease in
    select * from leases
    where status = 'active' and billing_day = extract(day from current_date)::int
  loop
    -- Guard against double-firing (e.g. the job runs twice in a day) rather than relying only
    -- on schedule timing.
    if exists (
      select 1 from invoices where lease_id = lease.id and billing_period_start = v_period_start
    ) then
      continue;
    end if;

    insert into invoices (lease_id, billing_period_start, billing_period_end, due_date, status)
    values (lease.id, v_period_start, v_period_end, current_date, 'pending')
    returning id into v_new_invoice_id;

    insert into invoice_line_items (invoice_id, category, description, amount)
    values (v_new_invoice_id, 'rent', 'Monthly rent', lease.monthly_rent);

    insert into notifications (recipient_id, type, title, body)
    values (
      lease.tenant_id,
      'due_reminder',
      'Rent invoice generated',
      'Your rent of ' || to_char(lease.monthly_rent, 'FM999,999,990.00') || ' is due ' ||
        to_char(current_date, 'Mon DD, YYYY') || '.'
    );
  end loop;
end;
$$;

create table due_reminder_log (
  invoice_id uuid primary key references invoices (id) on delete cascade,
  reminded_at timestamptz not null default now()
);

-- Internal bookkeeping only — no client ever queries this directly — but every table in this
-- project gets RLS regardless, since PostgREST auto-exposes anything in the public schema.
alter table due_reminder_log enable row level security;

create policy "admin full access due_reminder_log"
  on due_reminder_log for all using (is_admin()) with check (is_admin());

create or replace function send_due_reminders()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  inv record;
begin
  for inv in
    select i.id, i.due_date, i.total_amount, i.amount_paid, l.tenant_id
    from invoices i
    join leases l on l.id = i.lease_id
    where i.status in ('pending', 'partially_paid')
      and i.due_date = current_date + 3
      and not exists (select 1 from due_reminder_log where invoice_id = i.id)
  loop
    insert into notifications (recipient_id, type, title, body)
    values (
      inv.tenant_id,
      'due_reminder',
      'Rent due soon',
      'Your payment of ' || to_char(inv.total_amount - inv.amount_paid, 'FM999,999,990.00') ||
        ' is due on ' || to_char(inv.due_date, 'Mon DD, YYYY') || '.'
    );

    insert into due_reminder_log (invoice_id) values (inv.id);
  end loop;
end;
$$;

-- Runs daily just after midnight (server time, typically UTC on Supabase).
select cron.schedule('generate-recurring-invoices', '5 0 * * *', $$select generate_recurring_invoices()$$);
select cron.schedule('send-due-reminders', '10 0 * * *', $$select send_due_reminders()$$);
