// Admin-only: creates an invoice for a lease with a rent line item plus any manual line items
// (maintenance, penalty, credit) the landlord adds. Utilities are billed directly by the
// providers to tenants, not through TenantPay, so they never appear on an invoice here.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createAdminClient } from "../_shared/supabaseAdmin.ts";

interface RequestBody {
  lease_id: string;
  billing_period_start: string;
  billing_period_end: string;
  due_date: string;
  extra_line_items?: { category: string; description: string; amount: number }[];
}

Deno.serve(async (req) => {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "Missing authorization" }), { status: 401 });
  }

  // Verify the caller is an admin using their own JWT, not the service role.
  const callerClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } }
  );
  const {
    data: { user },
  } = await callerClient.auth.getUser();
  if (!user) {
    return new Response(JSON.stringify({ error: "Invalid session" }), { status: 401 });
  }

  const admin = createAdminClient();
  const { data: profile } = await admin.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") {
    return new Response(JSON.stringify({ error: "Admins only" }), { status: 403 });
  }

  const body: RequestBody = await req.json();

  const { data: lease, error: leaseError } = await admin
    .from("leases")
    .select("id, monthly_rent")
    .eq("id", body.lease_id)
    .single();
  if (leaseError || !lease) {
    return new Response(JSON.stringify({ error: "Lease not found" }), { status: 404 });
  }

  const { data: invoice, error: invoiceError } = await admin
    .from("invoices")
    .insert({
      lease_id: lease.id,
      billing_period_start: body.billing_period_start,
      billing_period_end: body.billing_period_end,
      due_date: body.due_date,
      status: "pending",
    })
    .select()
    .single();
  if (invoiceError || !invoice) {
    return new Response(JSON.stringify({ error: invoiceError?.message }), { status: 500 });
  }

  const lineItems: { invoice_id: string; category: string; description: string; amount: number }[] = [
    {
      invoice_id: invoice.id,
      category: "rent",
      description: "Monthly rent",
      amount: Number(lease.monthly_rent),
    },
  ];

  for (const extra of body.extra_line_items ?? []) {
    lineItems.push({ invoice_id: invoice.id, category: extra.category, description: extra.description, amount: extra.amount });
  }

  const { error: lineItemsError } = await admin.from("invoice_line_items").insert(lineItems);
  if (lineItemsError) {
    return new Response(JSON.stringify({ error: lineItemsError.message }), { status: 500 });
  }

  return new Response(JSON.stringify({ invoice_id: invoice.id }), {
    headers: { "Content-Type": "application/json" },
  });
});
