import { createClient } from "@/lib/supabase/server";
import { TableShell, th, emptyRow } from "@/components/Table";
import { ViewingRow } from "./viewing-row";
import { proposeViewing } from "./actions";
import type { ViewingPurpose, ViewingStatus } from "@tenantpay/shared";

const inputClass = "mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm";
const labelClass = "block text-xs font-medium text-neutral-500";

export default async function ViewingsPage() {
  const supabase = await createClient();

  const [{ data: requests, error }, { data: tenants }] = await Promise.all([
    supabase
      .from("viewing_requests")
      .select("id, purpose, requested_date, requested_time, notes, status, admin_response, profiles(full_name)")
      .order("status", { ascending: true })
      .order("requested_date", { ascending: true }),
    supabase.from("profiles").select("id, full_name").eq("role", "tenant").order("full_name"),
  ]);

  if (error) {
    return <p className="text-sm text-red-600">Failed to load: {error.message}</p>;
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">Viewing &amp; Signing Requests</h1>
        <p className="mt-1 text-sm text-neutral-500">
          In-person meetup requests from tenants — apartment viewings before applying, or lease/contract signings after approval.
        </p>
      </div>

      <section className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
        <h2 className="mb-1 text-base font-semibold text-neutral-900">Propose a meetup</h2>
        <p className="mb-4 text-xs text-neutral-500">
          Set a date and time yourself and send it to a tenant — it lands as confirmed right away, and they&apos;re notified.
        </p>
        {(tenants ?? []).length === 0 ? (
          <p className="text-sm text-neutral-400">No tenants yet.</p>
        ) : (
          <form action={proposeViewing} className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <label className={`${labelClass} lg:col-span-2`}>
              Tenant *
              <select name="tenant_id" required defaultValue="" className={inputClass}>
                <option value="" disabled>
                  Select a tenant
                </option>
                {(tenants ?? []).map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.full_name}
                  </option>
                ))}
              </select>
            </label>
            <label className={labelClass}>
              Purpose *
              <select name="purpose" required defaultValue="viewing" className={inputClass}>
                <option value="viewing">Apartment Viewing</option>
                <option value="lease_signing">Lease / Contract Signing</option>
              </select>
            </label>
            <div />
            <label className={labelClass}>
              Date *
              <input type="date" name="requested_date" required className={inputClass} />
            </label>
            <label className={labelClass}>
              Time *
              <input type="time" name="requested_time" required className={inputClass} />
            </label>
            <label className={`${labelClass} lg:col-span-2`}>
              Note to tenant
              <input name="note" placeholder="Optional" className={inputClass} />
            </label>
            <button
              type="submit"
              className="cursor-pointer rounded-md bg-brand-primary px-4 py-2 text-sm font-medium text-white transition-colors duration-150 hover:bg-brand-primary-hover lg:col-span-4"
            >
              Send appointment
            </button>
          </form>
        )}
      </section>

      <TableShell>
        <thead>
          <tr>
            <th className={th}>Tenant</th>
            <th className={th}>Purpose</th>
            <th className={th}>Requested</th>
            <th className={th}>Notes</th>
            <th className={th}>Status</th>
            <th className={th}></th>
          </tr>
        </thead>
        <tbody>
          {(requests ?? []).map((r) => {
            const profile = r.profiles as unknown as { full_name: string } | null;
            return (
              <ViewingRow
                key={r.id}
                id={r.id}
                tenantName={profile?.full_name ?? "—"}
                purpose={r.purpose as ViewingPurpose}
                requestedDate={r.requested_date}
                requestedTime={r.requested_time}
                notes={r.notes}
                status={r.status as ViewingStatus}
                adminResponse={r.admin_response}
              />
            );
          })}
          {(requests ?? []).length === 0 && (
            <tr>
              <td colSpan={6} className={emptyRow}>
                No viewing or signing requests yet.
              </td>
            </tr>
          )}
        </tbody>
      </TableShell>
    </div>
  );
}
