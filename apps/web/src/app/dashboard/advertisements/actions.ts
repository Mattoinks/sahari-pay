"use server";

import { revalidatePath } from "next/cache";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

const IMAGE_EXTENSION_BY_MIME: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

export type CreateAdvertisementState = { ok: boolean; message: string } | null;

export async function createAdvertisement(
  _prevState: CreateAdvertisementState,
  formData: FormData
): Promise<CreateAdvertisementState> {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) return { ok: false, message: "Not signed in" };

  const caption = String(formData.get("caption") ?? "").trim() || null;
  const opensScheduler = formData.get("opens_scheduler") === "on";
  const linkUrl = opensScheduler ? null : String(formData.get("link_url") ?? "").trim() || null;
  const image = formData.get("image");
  if (!(image instanceof File) || image.size === 0) return { ok: false, message: "An image is required" };

  try {
    // getUser() above already forced a validate-and-refresh round trip, so the token
    // getSession() reads next is guaranteed current (see the same pattern in billing/actions.ts).
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) throw new Error("Not signed in");

    const storageClient = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { global: { headers: { Authorization: `Bearer ${session.access_token}` } } }
    );

    const ext = IMAGE_EXTENSION_BY_MIME[image.type] ?? "jpg";
    const path = `banner-${Date.now()}.${ext}`;
    const { error: uploadError } = await storageClient.storage
      .from("advertisements")
      .upload(path, image, { contentType: image.type });
    if (uploadError) throw new Error(`Image upload failed: ${uploadError.message}`);

    const { data: maxOrderRow } = await supabase
      .from("advertisements")
      .select("display_order")
      .order("display_order", { ascending: false })
      .limit(1)
      .maybeSingle();
    const nextOrder = (maxOrderRow?.display_order ?? -1) + 1;

    const { error } = await supabase.from("advertisements").insert({
      image_path: path,
      caption,
      link_url: linkUrl,
      opens_scheduler: opensScheduler,
      display_order: nextOrder,
    });
    if (error) throw new Error(error.message);

    revalidatePath("/dashboard/advertisements");
    return { ok: true, message: "Banner added" };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "Failed to add banner" };
  }
}

export async function toggleAdvertisementActive(id: string, isActive: boolean) {
  const supabase = await createClient();
  const { error } = await supabase.from("advertisements").update({ is_active: isActive }).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard/advertisements");
}

export async function deleteAdvertisement(id: string, imagePath: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("advertisements").delete().eq("id", id);
  if (error) throw new Error(error.message);

  // Best-effort — a leftover storage object with no matching row isn't harmful, so don't fail
  // the whole delete if this errors.
  await supabase.storage.from("advertisements").remove([imagePath]);

  revalidatePath("/dashboard/advertisements");
}
