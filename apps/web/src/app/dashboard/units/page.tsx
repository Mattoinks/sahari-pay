import type { Profile } from "@tenantpay/shared";
import { createClient } from "@/lib/supabase/server";
import { TableShell, th, emptyRow } from "@/components/Table";
import { createProperty, createUnit } from "./actions";
import { LandlordProfileForm } from "./landlord-profile-form";
import { UnitRow } from "./unit-row";

const inputClass = "mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm";
const labelClass = "block text-xs font-medium text-neutral-500";

export default async function UnitsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [
    { data: properties, error: propertiesError },
    { data: units, error: unitsError },
    { data: myProfile, error: profileError },
  ] = await Promise.all([
    supabase.from("properties").select("id, name, address").order("name"),
    supabase
      .from("units")
      .select("id, unit_number, base_rent, status, property_id, properties(name)")
      .order("unit_number"),
    user
      ? supabase.from("profiles").select("*").eq("id", user.id).single()
      : Promise.resolve({ data: null, error: null }),
  ]);

  if (propertiesError || unitsError || profileError) {
    return (
      <p className="text-sm text-red-600">
        Failed to load: {propertiesError?.message ?? unitsError?.message ?? profileError?.message}
      </p>
    );
  }

  const avatarUrl = myProfile?.avatar_url
    ? supabase.storage.from("avatars").getPublicUrl(myProfile.avatar_url).data.publicUrl
    : null;

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">Units</h1>

      {myProfile && (
        <section className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
          <h2 className="mb-1 text-base font-semibold text-neutral-900">Landlord profile</h2>
          <p className="mb-4 text-sm text-neutral-500">
            What tenants see about you in the app&apos;s Messages screen.
          </p>
          <LandlordProfileForm profile={myProfile as Profile} avatarUrl={avatarUrl} />
        </section>
      )}

      <section className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-base font-semibold text-neutral-900">Add property</h2>
        <form action={createProperty} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className={labelClass}>
            Property name *
            <input name="name" required className={inputClass} />
          </label>
          <label className={labelClass}>
            Address *
            <input name="address" required className={inputClass} />
          </label>
          <label className={labelClass}>
            GCash number
            <input name="gcash_number" placeholder="Optional" className={inputClass} />
          </label>
          <label className={labelClass}>
            Bank details
            <input name="bank_details" placeholder="Optional" className={inputClass} />
          </label>
          <button
            type="submit"
            className="cursor-pointer rounded-md bg-brand-primary px-4 py-2 text-sm font-medium text-white transition-colors duration-150 hover:bg-brand-primary-hover sm:col-span-2"
          >
            Add property
          </button>
        </form>
      </section>

      <section className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-base font-semibold text-neutral-900">Add unit</h2>
        {(properties ?? []).length === 0 ? (
          <p className="text-sm text-neutral-400">Add a property first.</p>
        ) : (
          <form action={createUnit} className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <label className={labelClass}>
              Property *
              <select name="property_id" required className={inputClass}>
                {(properties ?? []).map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
            <label className={labelClass}>
              Unit number *
              <input name="unit_number" placeholder="e.g. 2B" required className={inputClass} />
            </label>
            <label className={labelClass}>
              Base rent *
              <input name="base_rent" type="number" step="0.01" min="0" required className={inputClass} />
            </label>
            <button
              type="submit"
              className="cursor-pointer rounded-md bg-brand-primary px-4 py-2 text-sm font-medium text-white transition-colors duration-150 hover:bg-brand-primary-hover sm:col-span-3"
            >
              Add unit
            </button>
          </form>
        )}
      </section>

      <TableShell>
        <thead>
          <tr>
            <th className={th}>Unit</th>
            <th className={th}>Property</th>
            <th className={th}>Base Rent</th>
            <th className={th}>Status</th>
            <th className={th}></th>
          </tr>
        </thead>
        <tbody>
          {(units ?? []).map((unit) => (
            <UnitRow
              key={unit.id}
              unit={{
                id: unit.id,
                unit_number: unit.unit_number,
                base_rent: Number(unit.base_rent),
                status: unit.status,
                propertyName: (unit.properties as unknown as { name: string } | null)?.name ?? "—",
              }}
            />
          ))}
          {(units ?? []).length === 0 && (
            <tr>
              <td colSpan={5} className={emptyRow}>
                No units yet — add one above.
              </td>
            </tr>
          )}
        </tbody>
      </TableShell>
    </div>
  );
}
