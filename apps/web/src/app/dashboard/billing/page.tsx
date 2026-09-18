import { formatCurrency, invoiceStatusLabel, invoiceStatusTone, type InvoiceStatus, type PaymentChannel } from "@tenantpay/shared";
import { createClient } from "@/lib/supabase/server";
import { StatusBadge } from "@/components/StatusBadge";
import { TableShell, th, td, trHover, emptyRow } from "@/components/Table";
import { generateInvoice } from "./actions";
import { PaymentChannelForm } from "./payment-channel-form";
import { DeleteInvoiceButton } from "./delete-invoice-button";

const inputClass = "mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm";

export default async function BillingPage() {
  const supabase = await createClient();

  const [{ data: leases, error: leasesError }, { data: invoices, error: invoicesError }, { data: channels, error: channelsError }] =
    await Promise.all([
      supabase
        .from("leases")
        .select("id, monthly_rent, profiles(full_name), units(unit_number)")
        .eq("status", "active")
        .order("created_at", { ascending: false }),
      supabase
        .from("invoices")
        .select("id, due_date, total_amount, amount_paid, status, leases(profiles(full_name), units(unit_number))")
        .order("created_at", { ascending: false })
        .limit(20),
      supabase.from("payment_channels").select("*").order("method"),
    ]);

  if (leasesError || invoicesError || channelsError) {
    return (
      <p className="text-sm text-red-600">
        Failed to load: {leasesError?.message ?? invoicesError?.message ?? channelsError?.message}
      </p>
    );
  }

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">Billing</h1>
      <p className="text-sm text-neutral-500">
        Invoices cover rent plus any manual line item (maintenance, penalty, credit). Utilities
        are billed directly by the providers to tenants, not through TenantPay.
      </p>

      <section className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
        <h2 className="mb-1 text-base font-semibold text-neutral-900">Payment channels</h2>
        <p className="mb-4 text-sm text-neutral-500">
          What tenants see in the app when they pick a payment method — upload a receiving QR
          and/or fill in the account or recipient details.
        </p>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {(channels ?? []).map((channel: PaymentChannel) => {
            const qrUrl = channel.qr_image_path
              ? supabase.storage.from("payment-qr").getPublicUrl(channel.qr_image_path).data.publicUrl
              : null;
            return <PaymentChannelForm key={channel.method} channel={channel} qrUrl={qrUrl} />;
          })}
        </div>
      </section>

      <section className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-base font-semibold text-neutral-900">Generate invoice</h2>
        {(leases ?? []).length === 0 ? (
          <p className="text-sm text-neutral-400">No active leases yet.</p>
        ) : (
          <form action={generateInvoice} className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <select name="lease_id" required className={`${inputClass} mt-0 lg:col-span-3`}>
              {(leases ?? []).map((lease) => {
                const profile = lease.profiles as unknown as { full_name: string } | null;
                const unit = lease.units as unknown as { unit_number: string } | null;
                return (
                  <option key={lease.id} value={lease.id}>
                    {unit?.unit_number} — {profile?.full_name} ({formatCurrency(Number(lease.monthly_rent))}/mo)
                  </option>
                );
              })}
            </select>

            <label className="text-xs font-medium text-neutral-500">
              Billing period start
              <input name="billing_period_start" type="date" required className={inputClass} />
            </label>
            <label className="text-xs font-medium text-neutral-500">
              Billing period end
              <input name="billing_period_end" type="date" required className={inputClass} />
            </label>
            <label className="text-xs font-medium text-neutral-500">
              Due date
              <input name="due_date" type="date" required className={inputClass} />
            </label>

            <label className="text-xs font-medium text-neutral-500">
              Extra line item category
              <select name="extra_category" className={inputClass}>
                <option value="maintenance">Maintenance</option>
                <option value="penalty">Penalty</option>
                <option value="credit">Credit</option>
              </select>
            </label>
            <label className="text-xs font-medium text-neutral-500">
              Extra line item description
              <input name="extra_description" placeholder="Optional" className={inputClass} />
            </label>
            <label className="text-xs font-medium text-neutral-500">
              Extra line item amount
              <input name="extra_amount" type="number" step="0.01" placeholder="Optional" className={inputClass} />
            </label>

            <button
              type="submit"
              className="cursor-pointer rounded-md bg-brand-primary px-4 py-2 text-sm font-medium text-white transition-colors duration-150 hover:bg-brand-primary-hover lg:col-span-3"
            >
              Generate invoice
            </button>
          </form>
        )}
      </section>

      <TableShell>
        <thead>
          <tr>
            <th className={th}>Tenant</th>
            <th className={th}>Unit</th>
            <th className={th}>Due</th>
            <th className={th}>Total</th>
            <th className={th}>Paid</th>
            <th className={th}>Status</th>
            <th className={th}></th>
          </tr>
        </thead>
        <tbody>
          {(invoices ?? []).map((invoice) => {
            const lease = invoice.leases as unknown as {
              profiles: { full_name: string } | null;
              units: { unit_number: string } | null;
            } | null;
            return (
              <tr key={invoice.id} className={trHover}>
                <td className={td}>{lease?.profiles?.full_name ?? "—"}</td>
                <td className={td}>{lease?.units?.unit_number ?? "—"}</td>
                <td className={td}>{new Date(invoice.due_date).toLocaleDateString()}</td>
                <td className={`${td} tabular-nums`}>{formatCurrency(Number(invoice.total_amount))}</td>
                <td className={`${td} tabular-nums`}>{formatCurrency(Number(invoice.amount_paid))}</td>
                <td className={td}>
                  <StatusBadge
                    label={invoiceStatusLabel[invoice.status as InvoiceStatus]}
                    tone={invoiceStatusTone[invoice.status as InvoiceStatus]}
                  />
                </td>
                <td className={td}>
                  <DeleteInvoiceButton invoiceId={invoice.id} />
                </td>
              </tr>
            );
          })}
          {(invoices ?? []).length === 0 && (
            <tr>
              <td colSpan={7} className={emptyRow}>
                No invoices yet.
              </td>
            </tr>
          )}
        </tbody>
      </TableShell>
    </div>
  );
}
