# Edge Functions

Deploy with the Supabase CLI:

```
supabase functions deploy generate-invoice
supabase functions deploy flag-overdue-invoices
supabase functions deploy send-due-reminders
```

## Functions

- **generate-invoice** — admin-only, called from the web dashboard's Billing page (Phase 5). Takes a `lease_id` and creates the invoice with a rent line item (from the lease's `monthly_rent`) plus any manual line items (maintenance, penalty, credit) the admin adds. Utilities are billed directly by the providers to tenants, not through TenantPay.
- **flag-overdue-invoices** — schedule daily via [Supabase Cron](https://supabase.com/docs/guides/functions/schedule-functions) (or `pg_cron` calling it through `pg_net`). Flags invoices past `due_date` that aren't fully paid.
- **send-due-reminders** — schedule daily. Notifies tenants (in-app + Expo push) whose invoice is due within 3 days.

## Scheduling (Supabase Dashboard → Edge Functions → Cron)

```sql
select cron.schedule(
  'flag-overdue-invoices-daily',
  '0 0 * * *',
  $$ select net.http_post(url := 'https://<project-ref>.supabase.co/functions/v1/flag-overdue-invoices', headers := jsonb_build_object('Authorization', 'Bearer <service-role-key>')) $$
);

select cron.schedule(
  'send-due-reminders-daily',
  '0 9 * * *',
  $$ select net.http_post(url := 'https://<project-ref>.supabase.co/functions/v1/send-due-reminders', headers := jsonb_build_object('Authorization', 'Bearer <service-role-key>')) $$
);
```

Requires the `pg_cron` and `pg_net` extensions enabled on the project (Database → Extensions).
