"use client";

import { useState } from "react";

interface Unit {
  id: string;
  unit_number: string;
  base_rent: number;
}

function formatWithCommas(value: string) {
  if (!value) return "";
  const [intPart, decPart] = value.split(".");
  const formattedInt = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return decPart !== undefined ? `${formattedInt}.${decPart}` : formattedInt;
}

function stripToRawNumber(value: string) {
  return value.replace(/,/g, "").replace(/[^\d.]/g, "");
}

export function UnitRentSelect({
  units,
  inputClass,
  labelClass,
}: {
  units: Unit[];
  inputClass: string;
  labelClass: string;
}) {
  const [rent, setRent] = useState("");

  return (
    <>
      <label className={labelClass}>
        Unit *
        <select
          name="unit_id"
          required
          defaultValue=""
          className={inputClass}
          onChange={(e) => {
            const unit = units.find((u) => u.id === e.target.value);
            setRent(unit ? String(unit.base_rent) : "");
          }}
        >
          <option value="" disabled>
            Select unit
          </option>
          {units.map((u) => (
            <option key={u.id} value={u.id}>
              {u.unit_number}
            </option>
          ))}
        </select>
      </label>
      <label className={labelClass}>
        Monthly rent *
        <input
          type="text"
          inputMode="decimal"
          required
          className={inputClass}
          value={formatWithCommas(rent)}
          onChange={(e) => setRent(stripToRawNumber(e.target.value))}
        />
        <input type="hidden" name="monthly_rent" value={rent} />
      </label>
    </>
  );
}
