"use client";

import { useActionState, useEffect, useState } from "react";
import type { ChangeEvent } from "react";
import type { ContactPlatform, Profile } from "@tenantpay/shared";
import { saveLandlordProfile } from "./actions";

const inputClass = "mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm";

const CONTACT_PLATFORMS: { value: ContactPlatform; label: string }[] = [
  { value: "phone", label: "Phone" },
  { value: "facebook_messenger", label: "Facebook / Messenger" },
  { value: "viber", label: "Viber" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "telegram", label: "Telegram" },
  { value: "instagram", label: "Instagram" },
];

export function LandlordProfileForm({ profile, avatarUrl }: { profile: Profile; avatarUrl: string | null }) {
  const [preview, setPreview] = useState<string | null>(null);
  const [state, formAction, isPending] = useActionState(saveLandlordProfile, null);

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

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

  const displayedAvatar = preview ?? avatarUrl;

  return (
    <form action={formAction} className="grid grid-cols-1 gap-4 sm:grid-cols-[auto_1fr]">
      <div className="flex flex-col items-center gap-2">
        {displayedAvatar ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={displayedAvatar} alt="Your photo" className="h-24 w-24 rounded-full border border-neutral-200 object-cover" />
        ) : (
          <div className="flex h-24 w-24 items-center justify-center rounded-full border border-neutral-200 bg-neutral-100 text-2xl font-semibold text-neutral-400">
            {(profile.display_name ?? profile.full_name ?? "?").charAt(0).toUpperCase()}
          </div>
        )}
        <label className="cursor-pointer text-xs font-medium text-brand-primary">
          Change photo
          <input type="file" name="avatar" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={handleFileChange} />
        </label>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="block text-xs font-medium text-neutral-500 sm:col-span-2">
          Display name
          <input
            name="display_name"
            defaultValue={profile.display_name ?? ""}
            placeholder="What tenants see you as"
            className={inputClass}
          />
        </label>
        <label className="block text-xs font-medium text-neutral-500">
          Email
          <input name="email" type="email" defaultValue={profile.email ?? ""} placeholder="Optional" className={inputClass} />
        </label>
        <label className="block text-xs font-medium text-neutral-500">
          Contact number
          <input name="phone" defaultValue={profile.phone ?? ""} placeholder="Optional" className={inputClass} />
        </label>
        <label className="block text-xs font-medium text-neutral-500">
          Social media
          <select name="contact_platform" defaultValue={profile.contact_platform ?? ""} className={inputClass}>
            <option value="">None</option>
            {CONTACT_PLATFORMS.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-xs font-medium text-neutral-500">
          Social media name / handle
          <input
            name="contact_handle"
            defaultValue={profile.contact_handle ?? ""}
            placeholder="e.g. Juan Dela Cruz"
            className={inputClass}
          />
        </label>
        <label className="block text-xs font-medium text-neutral-500 sm:col-span-2">
          Link
          <input
            name="social_link"
            defaultValue={profile.social_link ?? ""}
            placeholder="https://facebook.com/..."
            className={inputClass}
          />
        </label>

        <div className="flex items-center gap-3 sm:col-span-2">
          <button
            type="submit"
            disabled={isPending}
            className="cursor-pointer rounded-md bg-brand-primary px-4 py-2 text-sm font-medium text-white transition-colors duration-150 hover:bg-brand-primary-hover disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isPending ? "Saving…" : "Save"}
          </button>
          {showSaved && <span className="text-xs font-medium text-green-600">Saved.</span>}
          {state && !state.ok && <span className="text-xs font-medium text-red-600">{state.message}</span>}
        </div>
      </div>
    </form>
  );
}
