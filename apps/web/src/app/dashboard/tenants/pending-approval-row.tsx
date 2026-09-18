"use client";

import { useState, useTransition } from "react";
import {
  occupationStatusLabel,
  sourceOfIncomeLabel,
  governmentIdTypeLabel,
  type OccupationStatus,
  type SourceOfIncome,
  type GovernmentIdType,
} from "@tenantpay/shared";
import { approveTenantAccount, rejectTenantAccount } from "./actions";

interface PendingApprovalRowProps {
  id: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  birthdate: string | null;
  occupancyType: string | null;
  numberOfOccupants: number | null;
  occupationStatus: OccupationStatus | null;
  sourceOfIncome: SourceOfIncome | null;
  sourceOfIncomeOther: string | null;
  governmentIdType: GovernmentIdType | null;
  governmentIdUrl: string | null;
  createdAt: string;
}

export function PendingApprovalRow({
  id,
  fullName,
  email,
  phone,
  birthdate,
  occupancyType,
  numberOfOccupants,
  occupationStatus,
  sourceOfIncome,
  sourceOfIncomeOther,
  governmentIdType,
  governmentIdUrl,
  createdAt,
}: PendingApprovalRowProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [handled, setHandled] = useState(false);

  function run(action: (profileId: string) => Promise<void>) {
    setError(null);
    startTransition(async () => {
      try {
        await action(id);
        setHandled(true);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed");
      }
    });
  }

  // Hide immediately on success rather than waiting for the revalidated list — the row's own
  // approve/reject already fired, so there's nothing left for it to do here.
  if (handled) return null;

  const details: { label: string; value: string }[] = [
    { label: "Phone", value: phone ?? "—" },
    { label: "Birthdate", value: birthdate ? new Date(birthdate).toLocaleDateString() : "Not set" },
    { label: "Household", value: occupancyType ?? "Not set" },
    { label: "Occupants", value: numberOfOccupants ? String(numberOfOccupants) : "Not set" },
    { label: "Occupation", value: occupationStatus ? occupationStatusLabel[occupationStatus] : "Not set" },
    {
      label: "Income source",
      value: sourceOfIncome
        ? sourceOfIncome === "other" && sourceOfIncomeOther
          ? `Other — ${sourceOfIncomeOther}`
          : sourceOfIncomeLabel[sourceOfIncome]
        : "Not set",
    },
  ];

  return (
    <div className="flex items-start justify-between gap-4 border-b border-neutral-100 px-4 py-3 last:border-b-0">
      <div>
        <p className="font-medium text-neutral-900">{fullName}</p>
        <p className="text-xs text-neutral-500">
          {email ?? "—"} · Signed up {new Date(createdAt).toLocaleDateString()}
        </p>
        <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-3">
          {details.map((d) => (
            <div key={d.label}>
              <dt className="text-[10px] uppercase tracking-wide text-neutral-400">{d.label}</dt>
              <dd className="text-xs text-neutral-700">{d.value}</dd>
            </div>
          ))}
        </dl>
        {governmentIdUrl ? (
          <a
            href={governmentIdUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-2 flex items-center gap-2 rounded-md border border-neutral-200 p-1.5 hover:border-brand-primary"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={governmentIdUrl} alt="Government ID" className="h-10 w-14 rounded object-cover" />
            <span className="text-xs font-medium text-brand-primary underline underline-offset-2">
              View {governmentIdType ? governmentIdTypeLabel[governmentIdType] : "ID"}
            </span>
          </a>
        ) : (
          <p className="mt-2 text-xs font-medium text-red-600">No ID photo submitted</p>
        )}
        {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
      </div>
      <div className="flex shrink-0 gap-2">
        <button
          disabled={isPending}
          onClick={() => run(approveTenantAccount)}
          className="cursor-pointer rounded-md bg-brand-primary px-3 py-1.5 text-xs font-medium text-white transition-colors duration-150 hover:bg-brand-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
        >
          Approve
        </button>
        <button
          disabled={isPending}
          onClick={() => run(rejectTenantAccount)}
          className="cursor-pointer rounded-md bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 transition-colors duration-150 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Reject
        </button>
      </div>
    </div>
  );
}
