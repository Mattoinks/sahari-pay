"use client";

import { useState, useTransition } from "react";
import { formatCurrency } from "@tenantpay/shared";
import { approveTransaction, rejectTransaction } from "./actions";

interface QueueRowProps {
  id: string;
  tenantName: string;
  amount: number;
  paymentMethod: string;
  referenceNumber: string | null;
  proofUrl: string | null;
  invoiceTotal: number;
  invoiceOutstanding: number;
}

export function QueueRow({
  id,
  tenantName,
  amount,
  paymentMethod,
  referenceNumber,
  proofUrl,
  invoiceTotal,
  invoiceOutstanding,
}: QueueRowProps) {
  const [isPending, startTransition] = useTransition();
  const [showRejectReason, setShowRejectReason] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const amountMismatch = Math.abs(amount - invoiceOutstanding) > 0.01;

  function runApprove() {
    setError(null);
    startTransition(async () => {
      try {
        await approveTransaction(id);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to approve");
      }
    });
  }

  function runReject() {
    setError(null);
    startTransition(async () => {
      try {
        await rejectTransaction(id, reason);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to reject");
      }
    });
  }

  return (
    <div className="flex items-center justify-between gap-4 border-b border-neutral-100 px-4 py-4 transition-colors duration-150 last:border-b-0 hover:bg-neutral-50">
      <div>
        <p className="font-medium text-neutral-900">{tenantName}</p>
        <p className="text-sm text-neutral-500 tabular-nums">
          {formatCurrency(amount)} · {paymentMethod}
          {referenceNumber && ` · Ref: ${referenceNumber}`}
        </p>
        <p className="text-xs text-neutral-400 tabular-nums">
          Invoice: {formatCurrency(invoiceTotal)} total · {formatCurrency(invoiceOutstanding)} outstanding
        </p>
        {amountMismatch && (
          <p className="text-xs font-medium text-amber-600">
            Submitted amount doesn&apos;t match the outstanding balance — double-check before approving.
          </p>
        )}
        {error && <p className="text-xs font-medium text-red-600">{error}</p>}
        {proofUrl && (
          <a href={proofUrl} target="_blank" rel="noreferrer" className="text-sm text-brand-primary underline underline-offset-2">
            View proof
          </a>
        )}
      </div>

      {showRejectReason ? (
        <div className="flex items-center gap-2">
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Rejection reason"
            className="rounded-md border border-neutral-300 px-2 py-1 text-sm"
          />
          <button
            disabled={isPending || !reason}
            onClick={runReject}
            className="cursor-pointer rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white transition-colors duration-150 hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Confirm reject
          </button>
          <button onClick={() => setShowRejectReason(false)} className="cursor-pointer text-sm text-neutral-500 hover:text-neutral-700">
            Cancel
          </button>
        </div>
      ) : (
        <div className="flex gap-2">
          <button
            disabled={isPending}
            onClick={runApprove}
            className="cursor-pointer rounded-md bg-brand-primary px-3 py-1.5 text-sm font-medium text-white transition-colors duration-150 hover:bg-brand-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
          >
            Approve
          </button>
          <button
            disabled={isPending}
            onClick={() => setShowRejectReason(true)}
            className="cursor-pointer rounded-md bg-red-50 px-3 py-1.5 text-sm font-medium text-red-700 transition-colors duration-150 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Reject
          </button>
        </div>
      )}
    </div>
  );
}
