import { formatCurrency, invoiceStatusLabel, type InvoiceStatus } from "@tenantpay/shared";
import { createClient } from "@/lib/supabase/server";
import { PrintButton } from "./print-button";

export default async function StatementPage({
  searchParams,
}: {
  searchParams: Promise<{ start?: string; end?: string }>;
}) {
  const { start, end } = await searchParams;
  const supabase = await createClient();

  let query = supabase
    .from("invoices")
    .select("id, due_date, total_amount, amount_paid, status, leases(profiles(full_name), units(unit_number))")
    .order("due_date", { ascending: true });

  if (start) query = query.gte("due_date", start);
  if (end) query = query.lte("due_date", end);

  const { data: invoices, error } = await query;

  if (error) {
    return <p className="text-sm text-red-600">Failed to load statement: {error.message}</p>;
  }

  const totalBilled = (invoices ?? []).reduce((sum, i) => sum + Number(i.total_amount), 0);
  const totalCollected = (invoices ?? []).reduce((sum, i) => sum + Number(i.amount_paid), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between print:hidden">
        <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">Statement</h1>
        <PrintButton />
      </div>

      <div className="border-b border-neutral-200 pb-4">
        <h2 className="text-lg font-semibold text-brand-primary">TenantPay — Financial Statement</h2>
        <p className="text-sm text-neutral-500">
          {start ?? "beginning"} to {end ?? "present"}
        </p>
      </div>

      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-neutral-200 bg-neutral-50 text-left text-xs font-medium tracking-wide text-neutral-500 uppercase">
            <th className="px-2 py-2">Tenant</th>
            <th className="px-2 py-2">Unit</th>
            <th className="px-2 py-2">Due Date</th>
            <th className="px-2 py-2">Billed</th>
            <th className="px-2 py-2">Collected</th>
            <th className="px-2 py-2">Status</th>
          </tr>
        </thead>
        <tbody>
          {(invoices ?? []).map((invoice) => {
            const lease = invoice.leases as unknown as {
              profiles: { full_name: string } | null;
              units: { unit_number: string } | null;
            } | null;
            return (
              <tr key={invoice.id} className="border-b border-neutral-100">
                <td className="px-2 py-2">{lease?.profiles?.full_name ?? "—"}</td>
                <td className="px-2 py-2">{lease?.units?.unit_number ?? "—"}</td>
                <td className="px-2 py-2">{new Date(invoice.due_date).toLocaleDateString()}</td>
                <td className="px-2 py-2 tabular-nums">{formatCurrency(Number(invoice.total_amount))}</td>
                <td className="px-2 py-2 tabular-nums">{formatCurrency(Number(invoice.amount_paid))}</td>
                <td className="px-2 py-2">{invoiceStatusLabel[invoice.status as InvoiceStatus]}</td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="font-medium">
            <td className="px-2 py-2" colSpan={3}>
              Totals
            </td>
            <td className="px-2 py-2 tabular-nums">{formatCurrency(totalBilled)}</td>
            <td className="px-2 py-2 tabular-nums">{formatCurrency(totalCollected)}</td>
            <td className="px-2 py-2"></td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
