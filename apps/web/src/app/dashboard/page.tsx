import Link from "next/link";
import { formatCurrency, contactPlatformLabel, type ContactPlatform } from "@tenantpay/shared";
import { createClient } from "@/lib/supabase/server";
import { StatTile } from "@/components/StatTile";
import { TableShell, th, td, trHover, emptyRow } from "@/components/Table";

export default async function OverviewPage() {
  const supabase = await createClient();

  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const [
    { count: unitCount },
    { count: occupiedCount },
    { count: overdueCount },
    { data: invoices },
    { data: collectedThisMonth },
    { data: activeLeases },
  ] = await Promise.all([
    supabase.from("units").select("*", { count: "exact", head: true }),
    supabase.from("units").select("*", { count: "exact", head: true }).eq("status", "occupied"),
    supabase.from("invoices").select("*", { count: "exact", head: true }).eq("status", "overdue"),
    supabase.from("invoices").select("total_amount, amount_paid").neq("status", "paid"),
    supabase
      .from("transactions")
      .select("amount")
      .eq("status", "approved")
      .gte("verified_at", startOfMonth.toISOString()),
    supabase
      .from("leases")
      .select(
        "id, tenant_id, monthly_rent, profiles(full_name, email, phone, contact_platform, contact_handle), units(unit_number)"
      )
      .eq("status", "active")
      .order("created_at", { ascending: false }),
  ]);

  const outstandingBalance = (invoices ?? []).reduce(
    (sum, inv) => sum + (Number(inv.total_amount) - Number(inv.amount_paid)),
    0
  );
  const totalCollected = (collectedThisMonth ?? []).reduce(
    (sum, tx) => sum + Number(tx.amount),
    0
  );
  const occupancyRate = unitCount ? Math.round(((occupiedCount ?? 0) / unitCount) * 100) : 0;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">Overview</h1>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Collected (MTD)" value={formatCurrency(totalCollected)} />
        <StatTile label="Outstanding Balance" value={formatCurrency(outstandingBalance)} />
        <StatTile label="Occupancy Rate" value={`${occupancyRate}%`} />
        <StatTile label="Overdue Invoices" value={String(overdueCount ?? 0)} />
      </div>

      <div>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold tracking-tight text-neutral-900">Tenants</h2>
          <Link href="/dashboard/tenants" className="text-sm text-brand-primary hover:underline">
            View all →
          </Link>
        </div>
        <TableShell>
          <thead>
            <tr>
              <th className={th}>Name</th>
              <th className={th}>Contact</th>
              <th className={th}>Unit</th>
              <th className={th}>Monthly Rent</th>
            </tr>
          </thead>
          <tbody>
            {(activeLeases ?? []).map((lease) => {
              const profile = lease.profiles as unknown as {
                full_name: string;
                email: string | null;
                phone: string | null;
                contact_platform: ContactPlatform | null;
                contact_handle: string | null;
              } | null;
              const unit = lease.units as unknown as { unit_number: string } | null;
              const contact =
                profile?.email ??
                (profile?.contact_platform && profile?.contact_handle
                  ? `${contactPlatformLabel[profile.contact_platform]}: ${profile.contact_handle}`
                  : null) ??
                profile?.phone ??
                "—";
              return (
                <tr key={lease.id} className={trHover}>
                  <td className={td}>
                    <Link href={`/dashboard/tenants/${lease.tenant_id}`} className="text-brand-primary hover:underline">
                      {profile?.full_name ?? "—"}
                    </Link>
                  </td>
                  <td className={td}>{contact}</td>
                  <td className={td}>{unit?.unit_number ?? "—"}</td>
                  <td className={`${td} tabular-nums`}>{formatCurrency(Number(lease.monthly_rent))}</td>
                </tr>
              );
            })}
            {(activeLeases ?? []).length === 0 && (
              <tr>
                <td colSpan={4} className={emptyRow}>
                  No active tenants yet.
                </td>
              </tr>
            )}
          </tbody>
        </TableShell>
      </div>
    </div>
  );
}
