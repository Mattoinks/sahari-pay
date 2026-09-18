"use client";

import { useState, useTransition } from "react";
import { toggleAdvertisementActive, deleteAdvertisement } from "./actions";

export function AdvertisementRow({
  id,
  imageUrl,
  imagePath,
  caption,
  linkUrl,
  opensScheduler,
  isActive,
}: {
  id: string;
  imageUrl: string;
  imagePath: string;
  caption: string | null;
  linkUrl: string | null;
  opensScheduler: boolean;
  isActive: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [removed, setRemoved] = useState(false);

  if (removed) return null;

  return (
    <div className="flex items-center gap-4 border-b border-neutral-100 px-4 py-3 last:border-b-0">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={imageUrl} alt={caption ?? "Advertisement"} className="h-14 w-28 rounded-md border border-neutral-200 object-cover" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-neutral-900">{caption ?? "No caption"}</p>
        {opensScheduler ? (
          <p className="truncate text-xs font-medium text-brand-primary">Opens appointment scheduler</p>
        ) : (
          linkUrl && <p className="truncate text-xs text-neutral-400">{linkUrl}</p>
        )}
        {error && <p className="text-xs text-red-600">{error}</p>}
      </div>
      <label className="flex shrink-0 cursor-pointer items-center gap-2 text-xs text-neutral-500">
        <input
          type="checkbox"
          checked={isActive}
          disabled={isPending}
          onChange={(e) => {
            const next = e.target.checked;
            setError(null);
            startTransition(async () => {
              try {
                await toggleAdvertisementActive(id, next);
              } catch (err) {
                setError(err instanceof Error ? err.message : "Failed");
              }
            });
          }}
        />
        Active
      </label>
      <button
        type="button"
        disabled={isPending}
        onClick={() => {
          if (!confirm("Delete this banner?")) return;
          setError(null);
          startTransition(async () => {
            try {
              await deleteAdvertisement(id, imagePath);
              setRemoved(true);
            } catch (err) {
              setError(err instanceof Error ? err.message : "Failed");
            }
          });
        }}
        className="shrink-0 cursor-pointer text-xs text-red-600 hover:underline disabled:cursor-not-allowed disabled:opacity-50"
      >
        Delete
      </button>
    </div>
  );
}
