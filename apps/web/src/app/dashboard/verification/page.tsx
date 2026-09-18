import { createClient } from "@/lib/supabase/server";
import { QueueRow } from "./queue-row";
import { RealtimeRefresher } from "./realtime-refresher";

export default async function VerificationPage() {
  const supabase = await createClient();
  const { data: transactions, error } = await supabase
    .from("transactions")
    .select(
      "id, amount, payment_method, reference_number, proof_url, invoices(total_amount, amount_paid), profiles!transactions_tenant_id_fkey(full_name)"
    )
    .eq("status", "submitted")
    .order("created_at");

  if (error) {
    return <p className="text-sm text-red-600">Failed to load queue: {error.message}</p>;
  }

  // proof_url is stored as a path in the private "payment-proofs" bucket, not a public URL —
  // sign it for viewing here rather than exposing the bucket publicly.
  const rows = await Promise.all(
    (transactions ?? []).map(async (tx) => {
      let signedProofUrl: string | null = null;
      if (tx.proof_url) {
        const { data } = await supabase.storage
          .from("payment-proofs")
          .createSignedUrl(tx.proof_url, 60 * 10);
        signedProofUrl = data?.signedUrl ?? null;
      }
      return { ...tx, signedProofUrl };
    })
  );

  return (
    <div className="space-y-4">
      <RealtimeRefresher />
      <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">Verification Queue</h1>
      <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
        {rows.map((tx) => {
          const profile = tx.profiles as unknown as { full_name: string } | null;
          const invoice = tx.invoices as unknown as { total_amount: number; amount_paid: number } | null;
          return (
            <QueueRow
              key={tx.id}
              id={tx.id}
              tenantName={profile?.full_name ?? "Unknown tenant"}
              amount={Number(tx.amount)}
              paymentMethod={tx.payment_method}
              referenceNumber={tx.reference_number}
              proofUrl={tx.signedProofUrl}
              invoiceTotal={invoice ? Number(invoice.total_amount) : 0}
              invoiceOutstanding={invoice ? Number(invoice.total_amount) - Number(invoice.amount_paid) : 0}
            />
          );
        })}
        {rows.length === 0 && (
          <p className="py-6 text-center text-neutral-400">No payments awaiting verification.</p>
        )}
      </div>
    </div>
  );
}
