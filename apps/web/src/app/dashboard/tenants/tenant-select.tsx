"use client";

import { useState } from "react";

interface TenantOption {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  contact_handle: string | null;
}

function displayContact(t: TenantOption) {
  return t.email ?? t.contact_handle ?? t.phone ?? "No contact info";
}

export function TenantSelect({
  unleasedTenants,
  terminatedTenants,
  inputClass,
  labelClass,
}: {
  unleasedTenants: TenantOption[];
  terminatedTenants: TenantOption[];
  inputClass: string;
  labelClass: string;
}) {
  const [includeTerminated, setIncludeTerminated] = useState(false);
  const options = includeTerminated ? [...unleasedTenants, ...terminatedTenants] : unleasedTenants;

  return (
    <label className={labelClass}>
      Tenant *
      <select name="tenant_id" required className={inputClass}>
        {options.map((t) => (
          <option key={t.id} value={t.id}>
            {t.full_name} ({displayContact(t)})
            {terminatedTenants.some((tt) => tt.id === t.id) ? " — former tenant" : ""}
          </option>
        ))}
      </select>
      {terminatedTenants.length > 0 && (
        <label className="mt-2 flex items-center gap-2 text-xs font-normal text-neutral-500">
          <input
            type="checkbox"
            checked={includeTerminated}
            onChange={(e) => setIncludeTerminated(e.target.checked)}
            className="h-4 w-4 rounded border-neutral-300"
          />
          Include former tenants (e.g. re-leasing to someone who moved out before)
        </label>
      )}
    </label>
  );
}
