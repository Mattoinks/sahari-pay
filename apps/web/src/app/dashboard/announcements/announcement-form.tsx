"use client";

import { useState } from "react";
import { createAnnouncement } from "./actions";

interface Props {
  properties: { id: string; name: string }[];
  units: { id: string; unit_number: string }[];
}

const inputClass = "w-full rounded-md border border-neutral-300 px-3 py-2 text-sm";

export function AnnouncementForm({ properties, units }: Props) {
  const [audience, setAudience] = useState("all");

  return (
    <form action={createAnnouncement} className="space-y-3">
      <input name="title" placeholder="Title" required className={inputClass} />
      <textarea name="body" placeholder="Message" required rows={3} className={inputClass} />

      <select
        name="audience"
        value={audience}
        onChange={(e) => setAudience(e.target.value)}
        className={inputClass}
      >
        <option value="all">Everyone</option>
        <option value="property">One property</option>
        <option value="unit">One unit</option>
      </select>

      {audience === "property" && (
        <select name="property_id" required className={inputClass}>
          {properties.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      )}

      {audience === "unit" && (
        <select name="unit_id" required className={inputClass}>
          {units.map((u) => (
            <option key={u.id} value={u.id}>
              {u.unit_number}
            </option>
          ))}
        </select>
      )}

      <button
        type="submit"
        className="cursor-pointer rounded-md bg-brand-primary px-4 py-2 text-sm font-medium text-white transition-colors duration-150 hover:bg-brand-primary-hover"
      >
        Post announcement
      </button>
    </form>
  );
}
