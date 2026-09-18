"use client";

import { useState } from "react";
import Link from "next/link";
import { formatCurrency, leaseStatusLabel, leaseStatusTone, type LeaseStatus } from "@tenantpay/shared";
import { StatusBadge } from "@/components/StatusBadge";
import { td, trHover } from "@/components/Table";
import { updateLease, terminateLeaseWithSettlement } from "./actions";
import { ContractFields } from "./contract-fields";

const inputClass = "w-full max-w-[120px] rounded-md border border-neutral-300 px-2 py-1 text-sm";
const labelClass = "block text-xs text-neutral-500";

interface Deduction {
  description: string;
  amount: string;
}

export function LeaseRow({
  lease,
}: {
  lease: {
    id: string;
    tenantId: string;
    unitId: string;
    tenantName: string;
    contact: string;
    unitNumber: string;
    monthlyRent: number;
    billingDay: number;
    hasContract: boolean;
    contractEndDate: string | null;
    depositHeld: number;
    outstandingBalance: number;
    status: LeaseStatus;
  };
}) {
  const [mode, setMode] = useState<"view" | "editing" | "terminating" | "extending">("view");
  const [depositHeld, setDepositHeld] = useState(String(lease.depositHeld));
  const [deductions, setDeductions] = useState<Deduction[]>([]);
  const [newContractEndDate, setNewContractEndDate] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const deductionsTotal = deductions.reduce((sum, d) => sum + (Number(d.amount) || 0), 0);
  const refund = (Number(depositHeld) || 0) - deductionsTotal;
  const contractExpired = lease.hasContract && !!lease.contractEndDate && new Date(lease.contractEndDate) < new Date();

  if (mode === "view") {
    return (
      <tr className={trHover}>
        <td className={td}>
          <Link href={`/dashboard/tenants/${lease.tenantId}`} className="text-brand-primary hover:underline">
            {lease.tenantName}
          </Link>
        </td>
        <td className={td}>{lease.contact}</td>
        <td className={td}>
          {lease.unitNumber}
          {lease.hasContract && lease.contractEndDate && (
            <p className={`mt-0.5 text-xs ${contractExpired ? "font-medium text-red-600" : "text-neutral-400"}`}>
              Contract {contractExpired ? "expired" : "until"} {new Date(lease.contractEndDate).toLocaleDateString()}
            </p>
          )}
        </td>
        <td className={`${td} tabular-nums`}>{formatCurrency(lease.monthlyRent)}</td>
        <td className={td}>
          <StatusBadge label={leaseStatusLabel[lease.status]} tone={leaseStatusTone[lease.status]} />
        </td>
        <td className={`${td} space-x-3`}>
          <button onClick={() => setMode("editing")} className="cursor-pointer text-xs font-medium text-brand-primary hover:underline">
            Edit
          </button>
          {lease.status === "active" && contractExpired && (
            <button
              onClick={() => {
                setNewContractEndDate("");
                setMode("extending");
              }}
              className="cursor-pointer text-xs font-medium text-amber-600 hover:underline"
            >
              Extend contract
            </button>
          )}
          {lease.status === "active" && (
            <button onClick={() => setMode("terminating")} className="cursor-pointer text-xs text-red-600 hover:underline">
              Terminate
            </button>
          )}
        </td>
      </tr>
    );
  }

  if (mode === "editing") {
    return (
      <tr className={trHover}>
        <td colSpan={6} className={td}>
          <form
            action={async (formData) => {
              if (isSubmitting) return;
              setIsSubmitting(true);
              setError(null);
              try {
                await updateLease(formData);
                setMode("view");
              } catch (err) {
                setError(err instanceof Error ? err.message : "Failed to save");
              } finally {
                setIsSubmitting(false);
              }
            }}
            className="space-y-3"
          >
            <input type="hidden" name="id" value={lease.id} />
            <div className="flex flex-wrap items-end gap-3">
              <label className="text-xs text-neutral-500">
                Monthly rent
                <input
                  name="monthly_rent"
                  type="number"
                  step="0.01"
                  min="0"
                  defaultValue={lease.monthlyRent}
                  required
                  className={`${inputClass} mt-1 block`}
                />
              </label>
              <label className="text-xs text-neutral-500">
                Billing day (1-28)
                <input
                  name="billing_day"
                  type="number"
                  min="1"
                  max="28"
                  defaultValue={lease.billingDay}
                  required
                  className={`${inputClass} mt-1 block`}
                />
              </label>
            </div>

            <ContractFields
              inputClass={inputClass}
              labelClass={labelClass}
              defaultChecked={lease.hasContract}
              defaultEndDate={lease.contractEndDate ?? ""}
            />

            {error && <p className="text-xs text-red-600">{error}</p>}
            <div className="flex items-center gap-3">
              <button
                type="submit"
                disabled={isSubmitting}
                className="cursor-pointer text-xs font-medium text-brand-primary hover:underline disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isSubmitting ? "Saving…" : "Save"}
              </button>
              <button type="button" onClick={() => setMode("view")} className="cursor-pointer text-xs text-neutral-500 hover:underline">
                Cancel
              </button>
            </div>
          </form>
        </td>
      </tr>
    );
  }

  if (mode === "extending") {
    return (
      <tr className={trHover}>
        <td colSpan={6} className={td}>
          <form
            action={async (formData) => {
              if (isSubmitting) return;
              setIsSubmitting(true);
              setError(null);
              try {
                await updateLease(formData);
                setMode("view");
              } catch (err) {
                setError(err instanceof Error ? err.message : "Failed to extend contract");
              } finally {
                setIsSubmitting(false);
              }
            }}
            className="space-y-3"
          >
            <input type="hidden" name="id" value={lease.id} />
            <input type="hidden" name="monthly_rent" value={lease.monthlyRent} />
            <input type="hidden" name="billing_day" value={lease.billingDay} />
            <input type="hidden" name="has_contract" value="on" />
            <p className="text-xs font-semibold text-neutral-600">
              Extend contract for {lease.tenantName}{" "}
              <span className="font-normal text-neutral-400">
                (expired {lease.contractEndDate && new Date(lease.contractEndDate).toLocaleDateString()})
              </span>
            </p>
            <label className="block max-w-xs text-xs text-neutral-500">
              New contract end date
              <input
                name="contract_end_date"
                type="date"
                required
                value={newContractEndDate}
                onChange={(e) => setNewContractEndDate(e.target.value)}
                className={`${inputClass} mt-1 block`}
              />
            </label>
            {error && <p className="text-xs text-red-600">{error}</p>}
            <div className="flex items-center gap-3">
              <button
                type="submit"
                disabled={isSubmitting}
                className="cursor-pointer text-xs font-medium text-brand-primary hover:underline disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isSubmitting ? "Saving…" : "Confirm extension"}
              </button>
              <button type="button" onClick={() => setMode("view")} className="cursor-pointer text-xs text-neutral-500 hover:underline">
                Cancel
              </button>
            </div>
          </form>
        </td>
      </tr>
    );
  }

  return (
    <tr className={trHover}>
      <td colSpan={6} className={td}>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (isSubmitting) return;
            setIsSubmitting(true);
            setError(null);
            const formData = new FormData(e.currentTarget);
            formData.set(
              "deductions",
              JSON.stringify(deductions.map((d) => ({ description: d.description, amount: Number(d.amount) })))
            );
            try {
              await terminateLeaseWithSettlement(formData);
              setMode("view");
            } catch (err) {
              setError(err instanceof Error ? err.message : "Failed to terminate lease");
            } finally {
              setIsSubmitting(false);
            }
          }}
          className="space-y-3"
        >
          <input type="hidden" name="lease_id" value={lease.id} />
          <input type="hidden" name="unit_id" value={lease.unitId} />
          <p className="text-xs font-semibold text-neutral-600">
            Terminate lease &amp; settle deposit for {lease.tenantName}
          </p>

          {lease.outstandingBalance > 0 && (
            <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-700">
              Outstanding balance: {formatCurrency(lease.outstandingBalance)} — not yet paid. Consider this before
              settling the deposit below.
            </p>
          )}

          <label className="block text-xs text-neutral-500">
            Deposit held
            <input
              name="deposit_held"
              type="number"
              step="0.01"
              min="0"
              value={depositHeld}
              onChange={(e) => setDepositHeld(e.target.value)}
              className={`${inputClass} mt-1 block`}
            />
          </label>

          <div>
            <p className="mb-1 text-xs text-neutral-500">Deductions</p>
            <div className="space-y-2">
              {deductions.map((d, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    placeholder="Reason (e.g. broken window)"
                    value={d.description}
                    onChange={(e) =>
                      setDeductions((prev) => prev.map((row, j) => (j === i ? { ...row, description: e.target.value } : row)))
                    }
                    className="w-full max-w-xs rounded-md border border-neutral-300 px-2 py-1 text-sm"
                  />
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="Amount"
                    value={d.amount}
                    onChange={(e) =>
                      setDeductions((prev) => prev.map((row, j) => (j === i ? { ...row, amount: e.target.value } : row)))
                    }
                    className={inputClass}
                  />
                  <button
                    type="button"
                    onClick={() => setDeductions((prev) => prev.filter((_, j) => j !== i))}
                    className="cursor-pointer text-xs text-red-600 hover:underline"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setDeductions((prev) => [...prev, { description: "", amount: "" }])}
              className="mt-2 cursor-pointer text-xs font-medium text-brand-primary hover:underline"
            >
              + Add deduction
            </button>
          </div>

          <label className="block text-xs text-neutral-500">
            Notes
            <textarea name="notes" rows={2} placeholder="Optional" className={`${inputClass} mt-1 block max-w-md`} />
          </label>

          <p className="text-sm font-semibold text-neutral-900">
            {refund >= 0 ? `Refund to tenant: ${formatCurrency(refund)}` : `Tenant owes: ${formatCurrency(Math.abs(refund))}`}
          </p>

          {error && <p className="text-xs text-red-600">{error}</p>}
          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={isSubmitting}
              className="cursor-pointer text-xs font-medium text-red-600 hover:underline disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSubmitting ? "Terminating…" : "Confirm termination"}
            </button>
            <button type="button" onClick={() => setMode("view")} className="cursor-pointer text-xs text-neutral-500 hover:underline">
              Cancel
            </button>
          </div>
        </form>
      </td>
    </tr>
  );
}
