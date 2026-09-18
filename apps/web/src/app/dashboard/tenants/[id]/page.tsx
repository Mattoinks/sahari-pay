import Link from "next/link";
import { notFound } from "next/navigation";
import {
  formatCurrency,
  leaseStatusLabel,
  leaseStatusTone,
  invoiceStatusLabel,
  contactPlatformLabel,
  transactionStatusLabel,
  transactionStatusTone,
  occupationStatusLabel,
  sourceOfIncomeLabel,
  governmentIdTypeLabel,
  type LeaseStatus,
  type InvoiceStatus,
  type ContactPlatform,
  type OccupationStatus,
  type SourceOfIncome,
  type GovernmentIdType,
} from "@tenantpay/shared";
import { createClient } from "@/lib/supabase/server";
import { StatusBadge } from "@/components/StatusBadge";
import { ResendInviteButton } from "../resend-invite-button";

export default async function TenantDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", id)
    .eq("role", "tenant")
    .single();

  if (profileError || !profile) notFound();

  // government_id_path is a path in the private "government-ids" bucket — sign it for viewing.
  let governmentIdUrl: string | null = null;
  if (profile.government_id_path) {
    const { data } = await supabase.storage.from("government-ids").createSignedUrl(profile.government_id_path, 60 * 10);
    governmentIdUrl = data?.signedUrl ?? null;
  }

  const [{ data: leases }, { data: transactions }] = await Promise.all([
    supabase
      .from("leases")
      .select("id, monthly_rent, start_date, end_date, billing_day, has_contract, contract_end_date, status, units(unit_number)")
      .eq("tenant_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("transactions")
      .select("id, amount, payment_method, status, reference_number, created_at, verified_at, rejection_reason")
      .eq("tenant_id", id)
      .order("created_at", { ascending: false }),
  ]);

  const leaseIds = (leases ?? []).map((l) => l.id);
  const { data: settlements } =
    leaseIds.length > 0
      ? await supabase
          .from("deposit_settlements")
          .select("id, lease_id, deposit_held, refund_amount, notes, settled_at, deposit_deductions(id, description, amount)")
          .in("lease_id", leaseIds)
          .order("settled_at", { ascending: false })
      : { data: [] as never[] };

  const activeLease = (leases ?? []).find((l) => l.status === "active") ?? null;

  let nextDue: { due_date: string; status: InvoiceStatus } | null = null;
  if (activeLease) {
    const { data: invoice } = await supabase
      .from("invoices")
      .select("due_date, status")
      .eq("lease_id", activeLease.id)
      .in("status", ["pending", "partially_paid", "overdue"])
      .order("due_date", { ascending: true })
      .limit(1)
      .maybeSingle();
    nextDue = invoice;
  }

  const contact =
    profile.email ??
    (profile.contact_platform && profile.contact_handle
      ? `${contactPlatformLabel[profile.contact_platform as ContactPlatform]}: ${profile.contact_handle}`
      : null) ??
    profile.phone ??
    "—";

  return (
    <div className="space-y-6">
      <div>
        <Link href="/dashboard/tenants" className="text-sm text-brand-primary hover:underline">
          ← Back to tenants
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-neutral-900">{profile.full_name}</h1>
        <p className="text-sm text-neutral-500">{contact}</p>
        {profile.email && <ResendInviteButton email={profile.email} />}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-base font-semibold text-neutral-900">Household</h2>
          <dl className="space-y-3 text-sm">
            <div className="flex justify-between">
              <dt className="text-neutral-500">Birthdate</dt>
              <dd className="text-neutral-900">
                {profile.birthdate ? new Date(profile.birthdate).toLocaleDateString() : "Not set"}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-neutral-500">Occupancy type</dt>
              <dd className="text-neutral-900">{profile.occupancy_type ?? "Not set"}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-neutral-500">Number of occupants</dt>
              <dd className="text-neutral-900">{profile.number_of_occupants ?? "Not set"}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-neutral-500">Occupation</dt>
              <dd className="text-neutral-900">
                {profile.occupation_status ? occupationStatusLabel[profile.occupation_status as OccupationStatus] : "Not set"}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-neutral-500">Income source</dt>
              <dd className="text-neutral-900">
                {profile.source_of_income
                  ? profile.source_of_income === "other" && profile.source_of_income_other
                    ? `Other — ${profile.source_of_income_other}`
                    : sourceOfIncomeLabel[profile.source_of_income as SourceOfIncome]
                  : "Not set"}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-neutral-500">Phone</dt>
              <dd className="text-neutral-900">{profile.phone ?? "—"}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-neutral-500">Government ID</dt>
              <dd className="text-neutral-900">
                {governmentIdUrl ? (
                  <a
                    href={governmentIdUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-brand-primary underline underline-offset-2"
                  >
                    View {profile.government_id_type ? governmentIdTypeLabel[profile.government_id_type as GovernmentIdType] : "ID"}
                  </a>
                ) : (
                  "Not on file"
                )}
              </dd>
            </div>
            {profile.notes && (
              <div>
                <dt className="mb-1 text-neutral-500">Notes</dt>
                <dd className="text-neutral-900">{profile.notes}</dd>
              </div>
            )}
          </dl>
        </section>

        <section className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-base font-semibold text-neutral-900">Current Lease</h2>
          {activeLease ? (
            <dl className="space-y-3 text-sm">
              <div className="flex justify-between">
                <dt className="text-neutral-500">Unit</dt>
                <dd className="text-neutral-900">
                  {(activeLease.units as unknown as { unit_number: string } | null)?.unit_number ?? "—"}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-neutral-500">Moved in</dt>
                <dd className="text-neutral-900">{new Date(activeLease.start_date).toLocaleDateString()}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-neutral-500">Monthly rent</dt>
                <dd className="tabular-nums text-neutral-900">{formatCurrency(Number(activeLease.monthly_rent))}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-neutral-500">Billing day</dt>
                <dd className="text-neutral-900">{activeLease.billing_day}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-neutral-500">Contract</dt>
                <dd className="text-neutral-900">
                  {activeLease.has_contract && activeLease.contract_end_date ? (
                    <>
                      Until {new Date(activeLease.contract_end_date).toLocaleDateString()}
                      {new Date(activeLease.contract_end_date) < new Date() && (
                        <span className="ml-1 text-red-600">(expired)</span>
                      )}
                    </>
                  ) : (
                    "No fixed term (month-to-month)"
                  )}
                </dd>
              </div>
              {nextDue && (
                <div className="flex justify-between">
                  <dt className="text-neutral-500">Next due date</dt>
                  <dd className="text-neutral-900">
                    {new Date(nextDue.due_date).toLocaleDateString()} — {invoiceStatusLabel[nextDue.status]}
                  </dd>
                </div>
              )}
              <div className="flex justify-between">
                <dt className="text-neutral-500">Status</dt>
                <dd>
                  <StatusBadge
                    label={leaseStatusLabel[activeLease.status as LeaseStatus]}
                    tone={leaseStatusTone[activeLease.status as LeaseStatus]}
                  />
                </dd>
              </div>
            </dl>
          ) : (
            <p className="text-sm text-neutral-400">No active lease.</p>
          )}
        </section>
      </div>

      {(leases ?? []).length > 0 && (
        <section className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-base font-semibold text-neutral-900">Lease History</h2>
          <div className="space-y-2 text-sm">
            {(leases ?? []).map((l) => (
              <div key={l.id} className="flex items-center justify-between border-b border-neutral-100 py-2 last:border-b-0">
                <span className="text-neutral-700">
                  {(l.units as unknown as { unit_number: string } | null)?.unit_number ?? "—"} —{" "}
                  {new Date(l.start_date).toLocaleDateString()}
                  {l.end_date ? ` to ${new Date(l.end_date).toLocaleDateString()}` : ""}
                  {l.has_contract && l.contract_end_date && (
                    <span className="text-neutral-400"> (contract until {new Date(l.contract_end_date).toLocaleDateString()})</span>
                  )}
                </span>
                <StatusBadge label={leaseStatusLabel[l.status as LeaseStatus]} tone={leaseStatusTone[l.status as LeaseStatus]} />
              </div>
            ))}
          </div>
        </section>
      )}

      {(settlements ?? []).length > 0 && (
        <section className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-base font-semibold text-neutral-900">Deposit Settlements</h2>
          <div className="space-y-4">
            {(settlements ?? []).map((s) => {
              const deductions = (s.deposit_deductions as unknown as { id: string; description: string; amount: number }[]) ?? [];
              const unitNumber =
                ((leases ?? []).find((l) => l.id === s.lease_id)?.units as unknown as { unit_number: string } | null)
                  ?.unit_number ?? "—";
              return (
                <div key={s.id} className="rounded-lg border border-neutral-100 p-4 text-sm">
                  <div className="mb-2 flex items-center justify-between">
                    <p className="font-medium text-neutral-900">
                      Unit {unitNumber} · Settled {new Date(s.settled_at).toLocaleDateString()}
                    </p>
                    <p
                      className={`font-semibold tabular-nums ${Number(s.refund_amount) >= 0 ? "text-green-700" : "text-red-600"}`}
                    >
                      {Number(s.refund_amount) >= 0
                        ? `Refunded ${formatCurrency(Number(s.refund_amount))}`
                        : `Tenant owed ${formatCurrency(Math.abs(Number(s.refund_amount)))}`}
                    </p>
                  </div>
                  <p className="text-xs text-neutral-500">Deposit held: {formatCurrency(Number(s.deposit_held))}</p>
                  {deductions.length > 0 && (
                    <ul className="mt-2 space-y-1 text-xs text-neutral-600">
                      {deductions.map((d) => (
                        <li key={d.id} className="flex justify-between">
                          <span>{d.description}</span>
                          <span className="tabular-nums">-{formatCurrency(Number(d.amount))}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                  {s.notes && <p className="mt-2 text-xs text-neutral-500">{s.notes}</p>}
                </div>
              );
            })}
          </div>
        </section>
      )}

      <section className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-base font-semibold text-neutral-900">Payment History</h2>
        {(transactions ?? []).length === 0 ? (
          <p className="text-sm text-neutral-400">No payments submitted yet.</p>
        ) : (
          <div className="space-y-2 text-sm">
            {(transactions ?? []).map((tx) => (
              <div key={tx.id} className="flex items-start justify-between border-b border-neutral-100 py-2 last:border-b-0">
                <div>
                  <p className="tabular-nums font-medium text-neutral-900">{formatCurrency(Number(tx.amount))}</p>
                  <p className="text-xs text-neutral-500">
                    <span className="capitalize">{tx.payment_method.replace(/_/g, " ")}</span>
                    {tx.reference_number ? ` · Ref: ${tx.reference_number}` : ""} ·{" "}
                    {new Date(tx.created_at).toLocaleDateString()}
                  </p>
                  {tx.status === "rejected" && tx.rejection_reason && (
                    <p className="mt-0.5 text-xs text-red-600">{tx.rejection_reason}</p>
                  )}
                </div>
                <StatusBadge
                  label={transactionStatusLabel[tx.status as keyof typeof transactionStatusLabel]}
                  tone={transactionStatusTone[tx.status as keyof typeof transactionStatusTone]}
                />
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
