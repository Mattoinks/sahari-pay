"use client";

import { useState } from "react";
import { formatCurrency, unitStatusLabel, unitStatusTone, type UnitStatus } from "@tenantpay/shared";
import { StatusBadge } from "@/components/StatusBadge";
import { td, trHover } from "@/components/Table";
import { updateUnit } from "./actions";

const inputClass = "w-full max-w-[120px] rounded-md border border-neutral-300 px-2 py-1 text-sm";

export function UnitRow({
  unit,
}: {
  unit: { id: string; unit_number: string; base_rent: number; status: UnitStatus; propertyName: string };
}) {
  const [editing, setEditing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!editing) {
    return (
      <tr className={trHover}>
        <td className={td}>{unit.unit_number}</td>
        <td className={td}>{unit.propertyName}</td>
        <td className={`${td} tabular-nums`}>{formatCurrency(unit.base_rent)}</td>
        <td className={td}>
          <StatusBadge label={unitStatusLabel[unit.status]} tone={unitStatusTone[unit.status]} />
        </td>
        <td className={td}>
          <button onClick={() => setEditing(true)} className="cursor-pointer text-xs font-medium text-brand-primary hover:underline">
            Edit
          </button>
        </td>
      </tr>
    );
  }

  return (
    <tr className={trHover}>
      <td colSpan={5} className={td}>
        <form
          action={async (formData) => {
            if (isSubmitting) return;
            setIsSubmitting(true);
            setError(null);
            try {
              await updateUnit(formData);
              setEditing(false);
            } catch (err) {
              setError(err instanceof Error ? err.message : "Failed to save");
            } finally {
              setIsSubmitting(false);
            }
          }}
          className="flex flex-wrap items-center gap-2"
        >
          <input type="hidden" name="id" value={unit.id} />
          <input name="unit_number" defaultValue={unit.unit_number} required className={inputClass} />
          <input
            name="base_rent"
            type="number"
            step="0.01"
            min="0"
            defaultValue={unit.base_rent}
            required
            className={inputClass}
          />
          <select name="status" defaultValue={unit.status} className={inputClass}>
            <option value="vacant">Vacant</option>
            <option value="occupied">Occupied</option>
            <option value="maintenance">Maintenance</option>
          </select>
          <button
            type="submit"
            disabled={isSubmitting}
            className="cursor-pointer text-xs font-medium text-brand-primary hover:underline disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSubmitting ? "Saving…" : "Save"}
          </button>
          <button type="button" onClick={() => setEditing(false)} className="cursor-pointer text-xs text-neutral-500 hover:underline">
            Cancel
          </button>
          {error && <p className="w-full text-xs text-red-600">{error}</p>}
        </form>
      </td>
    </tr>
  );
}
