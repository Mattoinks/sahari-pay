"use client";

import { useState } from "react";

export function AttachmentImage({ url }: { url: string }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="block cursor-zoom-in">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url} alt="Attachment" className="h-40 w-40 rounded-lg object-cover" />
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-6"
          onClick={() => setOpen(false)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={url} alt="Attachment, full size" className="max-h-full max-w-full rounded-lg object-contain" />
        </div>
      )}
    </>
  );
}
