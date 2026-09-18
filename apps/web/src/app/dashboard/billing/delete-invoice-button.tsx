"use client";

import { useState } from "react";
import { deleteInvoice } from "./actions";

export function DeleteInvoiceButton({ invoiceId }: { invoiceId: string }) {
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="text-right">
      <button
        disabled={isPending}
        onClick={async () => {
          if (!confirm("Delete this invoice? This can't be undone.")) return;
          setIsPending(true);
          setError(null);
          try {
            await deleteInvoice(invoiceId);
          } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to delete");
          } finally {
            setIsPending(false);
          }
        }}
        className="cursor-pointer text-xs text-red-600 hover:underline disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isPending ? "Deleting…" : "Delete"}
      </button>
      {error && <p className="mt-1 max-w-[160px] text-xs text-red-600">{error}</p>}
    </div>
  );
}
