import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ReplyForm } from "./reply-form";
import { AttachmentImage } from "./attachment-image";
import { markThreadRead } from "../actions";

export default async function MessageThreadPage({ params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;
  const supabase = await createClient();

  const { data: tenant, error: tenantError } = await supabase
    .from("profiles")
    .select("id, full_name")
    .eq("id", tenantId)
    .eq("role", "tenant")
    .single();

  if (tenantError || !tenant) notFound();

  const { data: messages, error } = await supabase
    .from("messages")
    .select("id, sender_id, body, attachment_path, created_at")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: true });

  if (error) {
    return <p className="text-sm text-red-600">Failed to load messages: {error.message}</p>;
  }

  // Viewing the thread marks the tenant's messages in it as read, so the sidebar's unread
  // count stays accurate.
  await markThreadRead(tenantId);

  // attachment_path is a path in the private "message-attachments" bucket — sign it for viewing.
  const messagesWithUrls = await Promise.all(
    (messages ?? []).map(async (m) => {
      let attachmentUrl: string | null = null;
      if (m.attachment_path) {
        const { data } = await supabase.storage.from("message-attachments").createSignedUrl(m.attachment_path, 60 * 60);
        attachmentUrl = data?.signedUrl ?? null;
      }
      return { ...m, attachmentUrl };
    })
  );

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col">
      <div>
        <Link href="/dashboard/messages" className="text-sm text-brand-primary hover:underline">
          ← Back to messages
        </Link>
        <h1 className="mt-2 text-xl font-semibold text-neutral-900">{tenant.full_name}</h1>
      </div>

      <div className="mt-4 flex-1 space-y-3 overflow-y-auto rounded-xl border border-neutral-200 bg-neutral-50 p-4">
        {messagesWithUrls.map((m) => {
          const isMine = m.sender_id !== tenantId;
          return (
            <div key={m.id} className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[70%] rounded-2xl px-4 py-2 text-sm ${
                  isMine ? "rounded-br-sm bg-brand-primary text-white" : "rounded-bl-sm border border-neutral-200 bg-white text-neutral-900"
                }`}
              >
                {m.attachmentUrl && (
                  <div className={m.body ? "mb-2" : ""}>
                    <AttachmentImage url={m.attachmentUrl} />
                  </div>
                )}
                {m.body && <p>{m.body}</p>}
                <p className={`mt-1 text-[11px] ${isMine ? "text-white/70" : "text-neutral-400"}`}>
                  {new Date(m.created_at).toLocaleString()}
                </p>
              </div>
            </div>
          );
        })}
        {messagesWithUrls.length === 0 && (
          <p className="py-8 text-center text-neutral-400">No messages yet — say hello.</p>
        )}
      </div>

      <ReplyForm tenantId={tenantId} />
    </div>
  );
}
