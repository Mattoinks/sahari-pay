// Scheduled daily. Reminds tenants whose invoice is due within REMINDER_WINDOW_DAYS,
// once per invoice (guarded by checking for an existing due_reminder notification first).
//
// Machine-to-machine only (no interactive user, unlike generate-invoice) — invoked by pg_cron
// with the service-role key per the README. Edge Functions' default verify_jwt accepts ANY
// validly-signed project JWT, including the public anon key, so without this check anyone
// holding just the anon key (shipped in the client bundles) could trigger it using this
// function's internal service-role privileges. Require the exact service-role key instead.
import { createAdminClient } from "../_shared/supabaseAdmin.ts";
import { sendExpoPush } from "../_shared/expoPush.ts";

const REMINDER_WINDOW_DAYS = 3;

Deno.serve(async (req) => {
  const authHeader = req.headers.get("Authorization") ?? "";
  if (authHeader !== `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`) {
    return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403 });
  }

  const admin = createAdminClient();

  const windowEnd = new Date();
  windowEnd.setDate(windowEnd.getDate() + REMINDER_WINDOW_DAYS);

  const { data: invoices, error } = await admin
    .from("invoices")
    .select("id, due_date, total_amount, amount_paid, leases(tenant_id)")
    .in("status", ["pending", "partially_paid"])
    .lte("due_date", windowEnd.toISOString().slice(0, 10));

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }

  let sent = 0;

  for (const invoice of invoices ?? []) {
    const tenantId = (invoice.leases as unknown as { tenant_id: string } | null)?.tenant_id;
    if (!tenantId) continue;

    // Skip if we've already reminded about this invoice today.
    const { data: existing } = await admin
      .from("notifications")
      .select("id")
      .eq("recipient_id", tenantId)
      .eq("type", "due_reminder")
      .gte("created_at", new Date().toISOString().slice(0, 10))
      .limit(1);
    if (existing && existing.length > 0) continue;

    const balance = Number(invoice.total_amount) - Number(invoice.amount_paid);
    const title = "Rent due soon";
    const body = `You have a balance of ${balance.toFixed(2)} due ${invoice.due_date}.`;

    await admin.from("notifications").insert({
      recipient_id: tenantId,
      type: "due_reminder",
      title,
      body,
    });

    const { data: tokens } = await admin
      .from("push_tokens")
      .select("expo_push_token")
      .eq("user_id", tenantId);
    await sendExpoPush((tokens ?? []).map((t) => t.expo_push_token), title, body);

    sent++;
  }

  return new Response(JSON.stringify({ reminders_sent: sent }), {
    headers: { "Content-Type": "application/json" },
  });
});
