"use client";

import { useState, useTransition } from "react";
import { viewingPurposeLabel, viewingStatusLabel, type ViewingPurpose, type ViewingStatus } from "@tenantpay/shared";
import { StatusBadge } from "@/components/StatusBadge";
import { td, trHover } from "@/components/Table";
import { confirmViewing, declineViewing } from "./actions";

const TONE: Record<ViewingStatus, "success" | "warning" | "danger" | "neutral"> = {
  pending: "warning",
  confirmed: "success",
  declined: "danger",
  cancelled: "neutral",
};

export function ViewingRow({
  id,
  tenantName,
  purpose,
  requestedDate,
  requestedTime,
  notes,
  status,
  adminResponse,
}: {
  id: string;
  tenantName: string;
  purpose: ViewingPurpose;
  requestedDate: string;
  requestedTime: string;
  notes: string | null;
  status: ViewingStatus;
  adminResponse: string | null;
}) {
  const [isPending, startTransition] = useTransition();
  const [responding, setResponding] = useState<"confirm" | "decline" | null>(null);
  const [response, setResponse] = useState("");
  const [error, setError] = useState<string | null>(null);

  function run(action: (id: string, response: string) => Promise<void>) {
    setError(null);
    startTransition(async () => {
      try {
        await action(id, response);
        setResponding(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed");
      }
    });
  }

  return (
    <tr className={trHover}>
      <td className={td}>{tenantName}</td>
      <td className={td}>{viewingPurposeLabel[purpose]}</td>
      <td className={td}>
        {new Date(requestedDate).toLocaleDateString()} · {requestedTime.slice(0, 5)}
      </td>
      <td className={`${td} max-w-xs`}>
        {notes && <p className="text-xs text-neutral-600">{notes}</p>}
        {adminResponse && <p className="mt-1 text-xs italic text-neutral-400">Reply: {adminResponse}</p>}
      </td>
      <td className={td}>
        <StatusBadge label={viewingStatusLabel[status]} tone={TONE[status]} />
      </td>
      <td className={td}>
        {status === "pending" &&
          (responding ? (
            <div className="space-y-2">
              <input
                value={response}
                onChange={(e) => setResponse(e.target.value)}
                placeholder="Optional note to tenant"
                className="w-48 rounded-md border border-neutral-300 px-2 py-1 text-xs"
              />
              <div className="flex gap-2">
                <button
                  disabled={isPending}
                  onClick={() => run(responding === "confirm" ? confirmViewing : declineViewing)}
                  className={`cursor-pointer rounded-md px-2 py-1 text-xs font-medium text-white disabled:cursor-not-allowed disabled:opacity-50 ${
                    responding === "confirm" ? "bg-brand-primary hover:bg-brand-primary-hover" : "bg-red-600 hover:bg-red-700"
                  }`}
                >
                  {responding === "confirm" ? "Confirm" : "Decline"}
                </button>
                <button onClick={() => setResponding(null)} className="cursor-pointer text-xs text-neutral-500 hover:underline">
                  Cancel
                </button>
              </div>
              {error && <p className="text-xs text-red-600">{error}</p>}
            </div>
          ) : (
            <div className="flex gap-3">
              <button onClick={() => setResponding("confirm")} className="cursor-pointer text-xs font-medium text-brand-primary hover:underline">
                Confirm
              </button>
              <button onClick={() => setResponding("decline")} className="cursor-pointer text-xs text-red-600 hover:underline">
                Decline
              </button>
            </div>
          ))}
      </td>
    </tr>
  );
}
