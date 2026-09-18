"use client";

import { useActionState, useEffect, useState } from "react";
import type { ChangeEvent } from "react";
import type { PaymentChannel } from "@tenantpay/shared";
import { savePaymentChannel } from "./actions";

const inputClass = "mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm";

export function PaymentChannelForm({ channel, qrUrl }: { channel: PaymentChannel; qrUrl: string | null }) {
  const [preview, setPreview] = useState<string | null>(null);
  const [state, formAction, isPending] = useActionState(savePaymentChannel, null);
  const usesQr = channel.method !== "palawan";

  // Revoke the previous object URL whenever it's replaced or the form unmounts, so selecting a
  // new file (or leaving the page) doesn't leak blob URLs.
  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  // Fade the "Saved" confirmation out on its own rather than leaving it stuck until the next
  // save. Tracks which state object has already been dismissed instead of a plain boolean, so
  // setState only ever happens inside the timeout callback, not synchronously in the effect body.
  const [dismissed, setDismissed] = useState<typeof state>(null);
  useEffect(() => {
    if (!state?.ok) return;
    const timer = setTimeout(() => setDismissed(state), 3000);
    return () => clearTimeout(timer);
  }, [state]);
  const showSaved = state?.ok && state !== dismissed;

  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    setPreview(file ? URL.createObjectURL(file) : null);
  }

  const displayedQr = preview ?? qrUrl;

  return (
    <form action={formAction} className="space-y-3 rounded-lg border border-neutral-200 p-4">
      <input type="hidden" name="method" value={channel.method} />
      <h3 className="text-sm font-semibold text-neutral-900">{channel.display_name}</h3>

      {usesQr && (
        <>
          {displayedQr && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={displayedQr}
              alt={`${channel.display_name} QR code`}
              className="h-32 w-32 rounded-md border border-neutral-200 object-contain"
            />
          )}
          <label className="block text-xs font-medium text-neutral-500">
            QR code image
            <input
              type="file"
              name="qr_image"
              accept="image/png,image/jpeg,image/webp"
              className={inputClass}
              onChange={handleFileChange}
            />
          </label>
        </>
      )}

      <label className="block text-xs font-medium text-neutral-500">
        {channel.method === "palawan" ? "Receiver name (must match a valid ID)" : "Account name"}
        <input
          name="account_name"
          defaultValue={channel.account_name ?? ""}
          placeholder={channel.method === "palawan" ? "e.g. Juan Dela Cruz" : "Optional"}
          className={inputClass}
        />
      </label>
      <label className="block text-xs font-medium text-neutral-500">
        {channel.method === "palawan" ? "Contact number (optional)" : "Account number"}
        <input
          name="account_number"
          defaultValue={channel.account_number ?? ""}
          placeholder={channel.method === "palawan" ? "e.g. 0917 123 4567" : "Optional"}
          className={inputClass}
        />
      </label>
      <label className="block text-xs font-medium text-neutral-500">
        Instructions
        <textarea
          name="instructions"
          defaultValue={channel.instructions ?? ""}
          rows={channel.method === "palawan" ? 4 : 2}
          placeholder="Optional notes shown to tenants"
          className={inputClass}
        />
      </label>
      {channel.method === "palawan" && (
        <p className="text-xs text-neutral-400">
          Tenants send to the receiver name above at any Palawan branch, then submit the
          transaction code as their reference number. To claim it, bring that code, the
          tenant&apos;s full name, the exact amount, and a valid ID to a branch.
        </p>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="w-full cursor-pointer rounded-md bg-brand-primary px-4 py-2 text-sm font-medium text-white transition-colors duration-150 hover:bg-brand-primary-hover disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isPending ? "Saving…" : "Save"}
      </button>
      {showSaved && <p className="text-xs font-medium text-green-600">Saved.</p>}
      {state && !state.ok && <p className="text-xs font-medium text-red-600">{state.message}</p>}
    </form>
  );
}
