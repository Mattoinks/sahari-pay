"use client";

import { useTransition } from "react";
import { maintenanceStatusLabel, maintenanceStatusTone, type MaintenanceStatus } from "@tenantpay/shared";
import { StatusBadge } from "@/components/StatusBadge";
import { updateMaintenanceStatus } from "./actions";

const STATUSES: MaintenanceStatus[] = ["submitted", "in_progress", "resolved"];

interface Props {
  id: string;
  tenantName: string;
  unitNumber: string;
  category: string;
  description: string;
  status: MaintenanceStatus;
  photoUrl: string | null;
  createdAt: string;
}

export function RequestRow({ id, tenantName, unitNumber, category, description, status, photoUrl, createdAt }: Props) {
  const [isPending, startTransition] = useTransition();

  return (
    <div className="flex items-start justify-between gap-4 border-b border-neutral-100 px-4 py-4 transition-colors duration-150 last:border-b-0 hover:bg-neutral-50">
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <p className="font-medium text-neutral-900">{category}</p>
          <span className="text-xs text-neutral-400">· {unitNumber} · {tenantName}</span>
        </div>
        <p className="mt-1 text-sm text-neutral-600">{description}</p>
        <div className="mt-2 flex items-center gap-3">
          {photoUrl && (
            <a href={photoUrl} target="_blank" rel="noreferrer" className="text-sm text-brand-primary underline underline-offset-2">
              View photo
            </a>
          )}
          <span className="text-xs text-neutral-400">{new Date(createdAt).toLocaleString()}</span>
        </div>
      </div>

      <div className="flex flex-col items-end gap-2">
        <StatusBadge label={maintenanceStatusLabel[status]} tone={maintenanceStatusTone[status]} />
        <select
          value={status}
          disabled={isPending}
          onChange={(e) => startTransition(() => updateMaintenanceStatus(id, e.target.value as MaintenanceStatus))}
          className="rounded-md border border-neutral-300 px-2 py-1 text-xs"
        >
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {maintenanceStatusLabel[s]}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
