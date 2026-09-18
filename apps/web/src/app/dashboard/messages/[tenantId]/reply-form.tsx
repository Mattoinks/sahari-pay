"use client";

import { useEffect, useRef, useState, useTransition, type ChangeEvent } from "react";
import { sendMessage } from "../actions";

export function ReplyForm({ tenantId }: { tenantId: string }) {
  const [body, setBody] = useState("");
  const [attachment, setAttachment] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    setAttachment(file);
    setPreview(file ? URL.createObjectURL(file) : null);
  }

  function clearAttachment() {
    setAttachment(null);
    setPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  return (
    <form
      ref={formRef}
      action={() => {
        if (!body.trim() && !attachment) return;
        const formData = new FormData();
        formData.set("body", body);
        if (attachment) formData.set("attachment", attachment);
        setBody("");
        clearAttachment();
        startTransition(() => sendMessage(tenantId, formData));
      }}
      className="border-t border-neutral-200 bg-white p-4"
    >
      {preview && (
        <div className="mb-2 flex items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={preview} alt="Attachment preview" className="h-16 w-16 rounded-md border border-neutral-200 object-cover" />
          <button type="button" onClick={clearAttachment} className="cursor-pointer text-xs text-red-600 hover:underline">
            Remove
          </button>
        </div>
      )}
      <div className="flex items-end gap-3">
        <input ref={fileInputRef} type="file" accept="image/*" hidden onChange={handleFileChange} />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          title="Attach a photo"
          className="cursor-pointer rounded-md border border-neutral-300 px-3 py-2 text-sm text-neutral-500 hover:bg-neutral-50"
        >
          📎
        </button>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Type a reply..."
          rows={2}
          className="flex-1 resize-none rounded-md border border-neutral-300 px-3 py-2 text-sm"
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              formRef.current?.requestSubmit();
            }
          }}
        />
        <button
          type="submit"
          disabled={isPending || (!body.trim() && !attachment)}
          className="cursor-pointer rounded-md bg-brand-primary px-4 py-2 text-sm font-medium text-white transition-colors duration-150 hover:bg-brand-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
        >
          Send
        </button>
      </div>
    </form>
  );
}
