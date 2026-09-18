"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function createAnnouncement(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const title = String(formData.get("title") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  const audience = String(formData.get("audience") ?? "all");
  const propertyId = String(formData.get("property_id") ?? "") || null;
  const unitId = String(formData.get("unit_id") ?? "") || null;

  if (!title || !body) throw new Error("Title and body are required");

  const { error } = await supabase.from("announcements").insert({
    posted_by: user.id,
    title,
    body,
    audience,
    property_id: audience === "property" ? propertyId : null,
    unit_id: audience === "unit" ? unitId : null,
  });
  if (error) throw new Error(error.message);

  revalidatePath("/dashboard/announcements");
}
