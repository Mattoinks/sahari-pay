"use client";

import { useState } from "react";

function ordinal(day: number) {
  const rem100 = day % 100;
  if (rem100 >= 11 && rem100 <= 13) return `${day}th`;
  switch (day % 10) {
    case 1:
      return `${day}st`;
    case 2:
      return `${day}nd`;
    case 3:
      return `${day}rd`;
    default:
      return `${day}th`;
  }
}

export function LeaseDateFields({ inputClass, labelClass }: { inputClass: string; labelClass: string }) {
  const [billingDay, setBillingDay] = useState("");
  const day = Number(billingDay);

  return (
    <>
      <label className={labelClass}>
        Move-in date *
        <input
          name="start_date"
          type="date"
          required
          className={inputClass}
          onChange={(e) => {
            const day = Number(e.target.value.split("-")[2]);
            if (day) setBillingDay(String(Math.min(day, 28)));
          }}
        />
      </label>
      <label className={labelClass}>
        Billing day (1-28) *
        <input
          name="billing_day"
          type="number"
          min="1"
          max="28"
          required
          className={inputClass}
          value={billingDay}
          onChange={(e) => setBillingDay(e.target.value)}
        />
        {day >= 1 && day <= 28 && (
          <span className="mt-1 block text-xs font-normal text-neutral-400">
            Bills every {ordinal(day)} of the month
          </span>
        )}
      </label>
    </>
  );
}
