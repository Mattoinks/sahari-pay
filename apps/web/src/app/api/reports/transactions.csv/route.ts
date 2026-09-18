import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") return NextResponse.json({ error: "Admins only" }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const start = searchParams.get("start");
  const end = searchParams.get("end");

  let query = supabase
    .from("transactions")
    .select(
      "created_at, amount, payment_method, reference_number, status, verified_at, profiles!transactions_tenant_id_fkey(full_name, email), invoices(due_date, leases(units(unit_number)))"
    )
    .order("created_at", { ascending: true });

  if (start) query = query.gte("created_at", start);
  if (end) query = query.lte("created_at", end);

  const { data: transactions, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const header = ["Date", "Tenant", "Email", "Unit", "Amount", "Method", "Reference", "Status", "Verified At"];
  const rows = (transactions ?? []).map((tx) => {
    const profile = tx.profiles as unknown as { full_name: string; email: string } | null;
    const invoice = tx.invoices as unknown as { leases: { units: { unit_number: string } | null } | null } | null;
    return [
      new Date(tx.created_at).toISOString(),
      profile?.full_name ?? "",
      profile?.email ?? "",
      invoice?.leases?.units?.unit_number ?? "",
      String(tx.amount),
      tx.payment_method,
      tx.reference_number ?? "",
      tx.status,
      tx.verified_at ? new Date(tx.verified_at).toISOString() : "",
    ];
  });

  const csv = [header, ...rows].map((row) => row.map((cell) => csvEscape(String(cell))).join(",")).join("\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="transactions-${start ?? "all"}-to-${end ?? "now"}.csv"`,
    },
  });
}
