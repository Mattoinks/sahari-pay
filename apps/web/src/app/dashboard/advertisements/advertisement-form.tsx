"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { createAdvertisement } from "./actions";

const inputClass = "mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm disabled:bg-neutral-100 disabled:text-neutral-400";
const labelClass = "block text-xs font-medium text-neutral-500";

export function AdvertisementForm() {
  const [opensScheduler, setOpensScheduler] = useState(false);
  const [state, formAction, isPending] = useActionState(createAdvertisement, null);
  const formRef = useRef<HTMLFormElement>(null);

  // Fade the "Banner added" confirmation out on its own rather than leaving it stuck until the
  // next save. Tracks which state object has already been dismissed instead of a plain boolean,
  // so setState only ever happens inside the timeout callback, not synchronously in the effect body.
  const [dismissed, setDismissed] = useState<typeof state>(null);
  useEffect(() => {
    if (!state?.ok) return;
    formRef.current?.reset();
    setOpensScheduler(false);
    const timer = setTimeout(() => setDismissed(state), 3000);
    return () => clearTimeout(timer);
  }, [state]);
  const showSaved = state?.ok && state !== dismissed;

  return (
    <form ref={formRef} action={formAction} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <label className={`${labelClass} sm:col-span-2`}>
        Image *
        <input type="file" name="image" accept="image/png,image/jpeg,image/webp" required className={inputClass} />
      </label>
      <label className={labelClass}>
        Caption
        <input name="caption" placeholder="Optional" className={inputClass} />
      </label>
      <label className={labelClass}>
        Link URL
        <input
          name="link_url"
          placeholder={opensScheduler ? "Disabled — opens the scheduler instead" : "Optional"}
          disabled={opensScheduler}
          className={inputClass}
        />
      </label>
      <label className="flex items-center gap-2 text-xs font-medium text-neutral-600 sm:col-span-2">
        <input
          type="checkbox"
          name="opens_scheduler"
          checked={opensScheduler}
          onChange={(e) => setOpensScheduler(e.target.checked)}
        />
        Tapping this banner opens the appointment scheduler (book a viewing / lease signing) instead of a link
      </label>
      <div className="flex items-center gap-3 sm:col-span-2">
        <button
          type="submit"
          disabled={isPending}
          className="cursor-pointer rounded-md bg-brand-primary px-4 py-2 text-sm font-medium text-white transition-colors duration-150 hover:bg-brand-primary-hover disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isPending ? "Adding…" : "Add banner"}
        </button>
        {showSaved && <p className="text-xs font-medium text-green-600">Banner added.</p>}
        {state && !state.ok && <p className="text-xs font-medium text-red-600">{state.message}</p>}
      </div>
    </form>
  );
}
