import { contactPlatformLabel, type ContactPlatform } from "@tenantpay/shared";
import { createClient } from "@/lib/supabase/server";
import { TableShell, th, emptyRow } from "@/components/Table";
import { inviteTenant, createLease } from "./actions";
import { UnitRentSelect } from "./unit-rent-select";
import { LeaseDateFields } from "./lease-date-fields";
import { ContractFields } from "./contract-fields";
import { LeaseRow } from "./lease-row";
import { TenantSelect } from "./tenant-select";
import { PendingApprovalRow } from "./pending-approval-row";

const inputClass = "mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm";
const labelClass = "block text-xs font-medium text-neutral-500";
const buttonClass =
  "cursor-pointer rounded-md bg-brand-primary px-4 py-2 text-sm font-medium text-white transition-colors duration-150 hover:bg-brand-primary-hover";

export default async function TenantsPage() {
  const supabase = await createClient();

  const [
    { data: leases, error: leasesError },
    { data: tenantsWithoutLease, error: tenantsError },
    { data: vacantUnits, error: unitsError },
    { data: pendingTenants },
  ] = await Promise.all([
    supabase
      .from("leases")
      .select(
        "id, unit_id, tenant_id, monthly_rent, billing_day, has_contract, contract_end_date, status, profiles(full_name, email, phone, contact_platform, contact_handle), units(unit_number)"
      )
      .order("created_at", { ascending: false }),
    supabase
      .from("profiles")
      .select("id, full_name, email, phone, contact_handle")
      .eq("role", "tenant")
      .eq("approval_status", "approved")
      .order("full_name"),
    supabase.from("units").select("id, unit_number, base_rent").eq("status", "vacant").order("unit_number"),
    // Self-signups (apps/mobile/src/screens/SignUpScreen.tsx) land here for review before they
    // can do anything in the app — see 0022_tenant_approval.sql.
    supabase
      .from("profiles")
      .select(
        "id, full_name, email, phone, birthdate, occupancy_type, number_of_occupants, occupation_status, source_of_income, source_of_income_other, government_id_type, government_id_path, created_at"
      )
      .eq("role", "tenant")
      .eq("approval_status", "pending")
      .order("created_at", { ascending: false }),
  ]);

  if (leasesError || tenantsError || unitsError) {
    return (
      <p className="text-sm text-red-600">
        Failed to load: {leasesError?.message ?? tenantsError?.message ?? unitsError?.message}
      </p>
    );
  }

  // Tenants with an active lease never show up here. Tenants whose *only* leases are terminated
  // are hidden by default too (so a former tenant doesn't clutter the everyday dropdown), but
  // stay available via the "include former tenants" toggle in the form — covers re-leasing to
  // someone who moved out before, or who's transferring to a different unit.
  const tenantIdsWithActiveLease = new Set(
    (leases ?? []).filter((l) => l.status === "active").map((l) => l.tenant_id as unknown as string)
  );
  const tenantIdsWithTerminatedLease = new Set(
    (leases ?? []).filter((l) => l.status === "terminated").map((l) => l.tenant_id as unknown as string)
  );
  const unleasedTenants = (tenantsWithoutLease ?? []).filter(
    (t) => !tenantIdsWithActiveLease.has(t.id) && !tenantIdsWithTerminatedLease.has(t.id)
  );
  const terminatedTenants = (tenantsWithoutLease ?? []).filter(
    (t) => !tenantIdsWithActiveLease.has(t.id) && tenantIdsWithTerminatedLease.has(t.id)
  );

  // Deposit held per active lease — summed from the "deposit" category line items on its
  // invoices (the move-in charge, typically), pre-filled as the starting point when an admin
  // terminates the lease and records what happens to the deposit.
  const activeLeaseIds = (leases ?? []).filter((l) => l.status === "active").map((l) => l.id);
  const { data: depositInvoices } =
    activeLeaseIds.length > 0
      ? await supabase.from("invoices").select("lease_id, invoice_line_items(category, amount)").in("lease_id", activeLeaseIds)
      : { data: [] as { lease_id: string; invoice_line_items: { category: string; amount: number }[] }[] };

  const depositByLease: Record<string, number> = {};
  for (const invoice of depositInvoices ?? []) {
    const items = (invoice.invoice_line_items as unknown as { category: string; amount: number }[]) ?? [];
    for (const item of items) {
      if (item.category === "deposit") {
        depositByLease[invoice.lease_id] = (depositByLease[invoice.lease_id] ?? 0) + Number(item.amount);
      }
    }
  }

  // Outstanding unpaid balance per active lease — surfaced during termination so the admin isn't
  // deciding what to do with the deposit blind to whether the tenant is also leaving owing rent.
  const { data: unpaidInvoices } =
    activeLeaseIds.length > 0
      ? await supabase
          .from("invoices")
          .select("lease_id, total_amount, amount_paid")
          .in("lease_id", activeLeaseIds)
          .in("status", ["pending", "partially_paid", "overdue"])
      : { data: [] as { lease_id: string; total_amount: number; amount_paid: number }[] };

  const outstandingByLease: Record<string, number> = {};
  for (const invoice of unpaidInvoices ?? []) {
    outstandingByLease[invoice.lease_id] =
      (outstandingByLease[invoice.lease_id] ?? 0) + (Number(invoice.total_amount) - Number(invoice.amount_paid));
  }

  // government_id_path is a path in the private "government-ids" bucket — sign it for viewing.
  const pendingTenantsWithIdUrls = await Promise.all(
    (pendingTenants ?? []).map(async (t) => {
      let governmentIdUrl: string | null = null;
      if (t.government_id_path) {
        const { data } = await supabase.storage.from("government-ids").createSignedUrl(t.government_id_path, 60 * 10);
        governmentIdUrl = data?.signedUrl ?? null;
      }
      return { ...t, governmentIdUrl };
    })
  );

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">Tenants</h1>

      {(pendingTenants ?? []).length > 0 && (
        <section className="rounded-xl border border-amber-200 bg-amber-50 p-5 shadow-sm">
          <h2 className="mb-1 text-base font-semibold text-neutral-900">Pending approvals</h2>
          <p className="mb-3 text-xs text-neutral-500">
            Accounts created via the mobile app&apos;s self-signup — they can&apos;t do anything in the app until you review them.
          </p>
          <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white">
            {pendingTenantsWithIdUrls.map((t) => (
              <PendingApprovalRow
                key={t.id}
                id={t.id}
                fullName={t.full_name}
                email={t.email}
                phone={t.phone}
                birthdate={t.birthdate}
                occupancyType={t.occupancy_type}
                numberOfOccupants={t.number_of_occupants}
                occupationStatus={t.occupation_status}
                sourceOfIncome={t.source_of_income}
                sourceOfIncomeOther={t.source_of_income_other}
                governmentIdType={t.government_id_type}
                governmentIdUrl={t.governmentIdUrl}
                createdAt={t.created_at}
              />
            ))}
          </div>
        </section>
      )}

      <section className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
        <h2 className="mb-1 text-base font-semibold text-neutral-900">Invite tenant</h2>
        <p className="mb-4 text-xs text-neutral-500">
          Email is required — it&apos;s how the tenant gets their automatic login invite for the
          app. If a unit is assigned, a one-time move-in invoice (advance rent + deposit below) is
          created automatically.
        </p>
        <form action={inviteTenant} className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <label className={labelClass}>
            Full name *
            <input name="full_name" placeholder="Full name" required className={inputClass} />
          </label>
          <label className={labelClass}>
            Email *
            <input name="email" type="email" required className={inputClass} />
          </label>
          <label className={labelClass}>
            Phone number
            <input name="phone" placeholder="Optional" className={inputClass} />
          </label>

          <label className={labelClass}>
            Communication platform
            <select name="contact_platform" defaultValue="" className={inputClass}>
              <option value="">Optional</option>
              {(Object.keys(contactPlatformLabel) as ContactPlatform[]).map((platform) => (
                <option key={platform} value={platform}>
                  {contactPlatformLabel[platform]}
                </option>
              ))}
            </select>
          </label>
          <label className={labelClass}>
            Handle / number for that platform
            <input name="contact_handle" placeholder="Optional" className={inputClass} />
          </label>

          <label className={labelClass}>
            Unit
            <select name="unit_id" defaultValue="" className={inputClass}>
              <option value="">Optional — assign later if unsure</option>
              {(vacantUnits ?? []).map((u) => (
                <option key={u.id} value={u.id}>
                  {u.unit_number}
                </option>
              ))}
            </select>
          </label>

          <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-3 sm:col-span-2 lg:col-span-3">
            <p className="mb-2 text-xs font-semibold text-neutral-600">
              Move-in charges <span className="font-normal text-neutral-400">(only applies if a unit is assigned above)</span>
            </p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className={labelClass}>
                Advance rent (months)
                <input
                  name="advance_multiplier"
                  type="number"
                  step="1"
                  min="0"
                  defaultValue={1}
                  className={`${inputClass} bg-white`}
                />
              </label>
              <label className={labelClass}>
                Security deposit (months)
                <input
                  name="deposit_multiplier"
                  type="number"
                  step="1"
                  min="0"
                  defaultValue={2}
                  className={`${inputClass} bg-white`}
                />
              </label>
            </div>
          </div>

          <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-3 sm:col-span-2 lg:col-span-3">
            <p className="mb-2 text-xs font-semibold text-neutral-600">
              Contract <span className="font-normal text-neutral-400">(only applies if a unit is assigned above)</span>
            </p>
            <ContractFields inputClass={`${inputClass} bg-white`} labelClass={labelClass} />
          </div>

          <label className={`${labelClass} sm:col-span-2 lg:col-span-3`}>
            Special notes
            <textarea name="notes" placeholder="Optional" rows={2} className={inputClass} />
          </label>

          <button type="submit" className={`${buttonClass} sm:col-span-2 lg:col-span-3`}>
            Add tenant
          </button>
        </form>
      </section>

      <section className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-base font-semibold text-neutral-900">Create lease</h2>
        {(unleasedTenants.length === 0 && terminatedTenants.length === 0) || (vacantUnits ?? []).length === 0 ? (
          <p className="text-sm text-neutral-400">
            Need at least one tenant without an active lease and one vacant unit.
          </p>
        ) : (
          <form action={createLease} className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <TenantSelect
              unleasedTenants={unleasedTenants}
              terminatedTenants={terminatedTenants}
              inputClass={inputClass}
              labelClass={labelClass}
            />
            <UnitRentSelect units={vacantUnits ?? []} inputClass={inputClass} labelClass={labelClass} />
            <LeaseDateFields inputClass={inputClass} labelClass={labelClass} />
            <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-3 sm:col-span-2 lg:col-span-4">
              <p className="mb-2 text-xs font-semibold text-neutral-600">Move-in charges</p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className={labelClass}>
                  Advance rent (months)
                  <input
                    name="advance_multiplier"
                    type="number"
                    step="1"
                    min="0"
                    defaultValue={1}
                    className={`${inputClass} bg-white`}
                  />
                </label>
                <label className={labelClass}>
                  Security deposit (months)
                  <input
                    name="deposit_multiplier"
                    type="number"
                    step="1"
                    min="0"
                    defaultValue={2}
                    className={`${inputClass} bg-white`}
                  />
                </label>
              </div>
            </div>
            <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-3 sm:col-span-2 lg:col-span-4">
              <p className="mb-2 text-xs font-semibold text-neutral-600">Contract</p>
              <ContractFields inputClass={`${inputClass} bg-white`} labelClass={labelClass} />
            </div>
            <button type="submit" className={`${buttonClass} sm:col-span-2 lg:col-span-4`}>
              Create lease
            </button>
          </form>
        )}
      </section>

      <TableShell>
        <thead>
          <tr>
            <th className={th}>Name</th>
            <th className={th}>Contact</th>
            <th className={th}>Unit</th>
            <th className={th}>Monthly Rent</th>
            <th className={th}>Lease Status</th>
            <th className={th}></th>
          </tr>
        </thead>
        <tbody>
          {(leases ?? []).map((lease) => {
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
              <LeaseRow
                key={lease.id}
                lease={{
                  id: lease.id,
                  tenantId: lease.tenant_id,
                  unitId: lease.unit_id,
                  tenantName: profile?.full_name ?? "—",
                  contact,
                  unitNumber: unit?.unit_number ?? "—",
                  monthlyRent: Number(lease.monthly_rent),
                  billingDay: lease.billing_day,
                  hasContract: lease.has_contract,
                  contractEndDate: lease.contract_end_date,
                  depositHeld: depositByLease[lease.id] ?? 0,
                  outstandingBalance: outstandingByLease[lease.id] ?? 0,
                  status: lease.status,
                }}
              />
            );
          })}
          {(leases ?? []).length === 0 && (
            <tr>
              <td colSpan={6} className={emptyRow}>
                No leases yet — add a tenant and create a lease above.
              </td>
            </tr>
          )}
        </tbody>
      </TableShell>
    </div>
  );
}
