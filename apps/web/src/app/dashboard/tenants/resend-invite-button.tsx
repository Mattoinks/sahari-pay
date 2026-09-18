"use client";

import { useState } from "react";
import { resendInvite } from "./actions";

export function ResendInviteButton({ email }: { email: string }) {
  const [isPending, setIsPending] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  return (
    <div className="mt-1 flex items-center gap-2">
      <button
        disabled={isPending}
        onClick={async () => {
          setIsPending(true);
          setResult(null);
          try {
            await resendInvite(email);
            setResult({ ok: true, message: "Invite email sent." });
          } catch (err) {
            setResult({ ok: false, message: err instanceof Error ? err.message : "Failed to resend" });
          } finally {
            setIsPending(false);
          }
        }}
        className="cursor-pointer text-xs font-medium text-brand-primary hover:underline disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isPending ? "Sending…" : "Resend login invite"}
      </button>
      {result && (
        <span className={`text-xs ${result.ok ? "text-green-600" : "text-red-600"}`}>{result.message}</span>
      )}
    </div>
  );
}
