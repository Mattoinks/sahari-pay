// Scheduled daily (see supabase/functions/README.md) — flags invoices whose due date has
// passed without full payment. Invoice status otherwise only changes reactively, on transaction
// approval, so this cron is what catches the passage of time itself.
//
// Machine-to-machine only (no interactive user, unlike generate-invoice) — invoked by pg_cron
// with the service-role key per the README. Edge Functions' default verify_jwt accepts ANY
// validly-signed project JWT, including the public anon key, so without this check anyone
// holding just the anon key (shipped in the client bundles) could trigger it using this
// function's internal service-role privileges. Require the exact service-role key instead.
import { createAdminClient } from "../_shared/supabaseAdmin.ts";

Deno.serve(async (req) => {
  const authHeader = req.headers.get("Authorization") ?? "";
  if (authHeader !== `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`) {
    return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403 });
  }

  const admin = createAdminClient();
  const today = new Date().toISOString().slice(0, 10);

  const { data, error } = await admin
    .from("invoices")
    .update({ status: "overdue" })
    .lt("due_date", today)
    .in("status", ["pending", "partially_paid"])
    .select("id");

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }

  return new Response(JSON.stringify({ flagged: data?.length ?? 0 }), {
    headers: { "Content-Type": "application/json" },
  });
});
