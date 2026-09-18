"use client";

import { useState } from "react";

export function ContractFields({
  inputClass,
  labelClass,
  defaultChecked = false,
  defaultEndDate = "",
}: {
  inputClass: string;
  labelClass: string;
  defaultChecked?: boolean;
  defaultEndDate?: string;
}) {
  const [hasContract, setHasContract] = useState(defaultChecked);

  return (
    <div>
      <label className="flex items-center gap-2 text-xs font-medium text-neutral-600">
        <input
          type="checkbox"
          name="has_contract"
          defaultChecked={defaultChecked}
          onChange={(e) => setHasContract(e.target.checked)}
          className="h-4 w-4 rounded border-neutral-300"
        />
        Has a signed contract
      </label>
      {hasContract ? (
        <label className={`${labelClass} mt-3 max-w-xs`}>
          Contract end date *
          <input name="contract_end_date" type="date" defaultValue={defaultEndDate} required className={inputClass} />
        </label>
      ) : (
        <p className="mt-2 text-xs text-neutral-400">No fixed term — month-to-month.</p>
      )}
    </div>
  );
}
