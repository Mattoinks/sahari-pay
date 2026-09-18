"use server";

import { revalidatePath } from "next/cache";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

const ATTACHMENT_EXTENSION_BY_MIME: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
};

export async function sendMessage(tenantId: string, formData: FormData) {
  const trimmed = String(formData.get("body") ?? "").trim();
  const attachment = formData.get("attachment");
  const hasAttachment = attachment instanceof File && attachment.size > 0;
  if (!trimmed && !hasAttachment) return;

  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) throw new Error("Not authenticated");

  let attachmentPath: string | null = null;
  if (hasAttachment) {
    const file = attachment as File;
    // getUser() above already forced a validate-and-refresh round trip, so the token
    // getSession() reads next is guaranteed current (see the same pattern in billing/actions.ts).
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) throw new Error("Attachment upload failed: no session");

    const storageClient = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { global: { headers: { Authorization: `Bearer ${session.access_token}` } } }
    );

    const ext = ATTACHMENT_EXTENSION_BY_MIME[file.type] ?? "jpg";
    const path = `${tenantId}/${Date.now()}.${ext}`;
    const { error: uploadError } = await storageClient.storage
      .from("message-attachments")
      .upload(path, file, { contentType: file.type || "image/jpeg" });
    if (uploadError) throw new Error(`Attachment upload failed: ${uploadError.message}`);
    attachmentPath = path;
  }

  const { error } = await supabase.from("messages").insert({
    tenant_id: tenantId,
    sender_id: user.id,
    body: trimmed,
    attachment_path: attachmentPath,
    // The admin has obviously "read" their own message the moment they send it.
    read_at: new Date().toISOString(),
  });
  if (error) throw new Error(error.message);

  revalidatePath(`/dashboard/messages/${tenantId}`);
  revalidatePath("/dashboard/messages");
  revalidatePath("/dashboard", "layout");
}

// Called directly from the thread page's render (not a user-triggered mutation), so it
// deliberately does NOT call revalidatePath — that API isn't allowed during a Server Component's
// render. Not needed anyway: this whole /dashboard tree is already dynamically rendered per
// request (auth relies on cookies), so the sidebar's unread count picks up this write on the
// very next navigation.
export async function markThreadRead(tenantId: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("messages")
    .update({ read_at: new Date().toISOString() })
    .eq("tenant_id", tenantId)
    .is("read_at", null);
  if (error) throw new Error(error.message);
}
