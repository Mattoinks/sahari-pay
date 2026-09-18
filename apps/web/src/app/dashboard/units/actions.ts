"use server";

import { revalidatePath } from "next/cache";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

export async function createProperty(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const name = String(formData.get("name") ?? "").trim();
  const address = String(formData.get("address") ?? "").trim();
  const gcashNumber = String(formData.get("gcash_number") ?? "").trim() || null;
  const bankDetails = String(formData.get("bank_details") ?? "").trim() || null;

  if (!name || !address) throw new Error("Name and address are required");

  const { error } = await supabase.from("properties").insert({
    owner_id: user.id,
    name,
    address,
    gcash_number: gcashNumber,
    bank_details: bankDetails,
  });
  if (error) throw new Error(error.message);

  revalidatePath("/dashboard/units");
}

export async function createUnit(formData: FormData) {
  const supabase = await createClient();

  const propertyId = String(formData.get("property_id") ?? "");
  const unitNumber = String(formData.get("unit_number") ?? "").trim();
  const baseRent = Number(formData.get("base_rent"));

  if (!propertyId || !unitNumber || !Number.isFinite(baseRent) || baseRent < 0) {
    throw new Error("Property, unit number, and a valid base rent are required");
  }

  const { error } = await supabase.from("units").insert({
    property_id: propertyId,
    unit_number: unitNumber,
    base_rent: baseRent,
  });
  if (error) throw new Error(error.message);

  revalidatePath("/dashboard/units");
}

const UNIT_STATUSES = ["vacant", "occupied", "maintenance"];

export async function updateUnit(formData: FormData) {
  const supabase = await createClient();

  const id = String(formData.get("id") ?? "");
  const unitNumber = String(formData.get("unit_number") ?? "").trim();
  const baseRent = Number(formData.get("base_rent"));
  const status = String(formData.get("status") ?? "");

  if (!id || !unitNumber || !Number.isFinite(baseRent) || baseRent < 0) {
    throw new Error("Unit number and a valid base rent are required");
  }
  if (!UNIT_STATUSES.includes(status)) throw new Error("Invalid status");

  // Unit status is otherwise only ever flipped by lease creation/termination (tenants/actions.ts)
  // — block the one manual edit that could desync it from reality: marking a unit "vacant" while
  // it still has an active lease, which would then let it be offered for a second, overlapping
  // lease (and only fail on save with a raw Postgres unique-constraint error).
  if (status === "vacant") {
    const { data: activeLease } = await supabase
      .from("leases")
      .select("id")
      .eq("unit_id", id)
      .eq("status", "active")
      .maybeSingle();
    if (activeLease) {
      throw new Error("Can't mark this unit vacant — it has an active lease. Terminate the lease from the Tenants page first.");
    }
  }

  const { error } = await supabase
    .from("units")
    .update({ unit_number: unitNumber, base_rent: baseRent, status })
    .eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePath("/dashboard/units");
}

const AVATAR_EXTENSION_BY_MIME: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

export type SaveLandlordProfileState = { ok: boolean; message: string } | null;

export async function saveLandlordProfile(
  _prevState: SaveLandlordProfileState,
  formData: FormData
): Promise<SaveLandlordProfileState> {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) return { ok: false, message: "Not signed in" };

  const displayName = String(formData.get("display_name") ?? "").trim() || null;
  const contactPlatform = String(formData.get("contact_platform") ?? "").trim() || null;
  const contactHandle = String(formData.get("contact_handle") ?? "").trim() || null;
  const socialLink = String(formData.get("social_link") ?? "").trim() || null;
  const phone = String(formData.get("phone") ?? "").trim() || null;
  const email = String(formData.get("email") ?? "").trim() || null;
  const avatar = formData.get("avatar");

  try {
    const update: Record<string, unknown> = {
      display_name: displayName,
      contact_platform: contactPlatform,
      contact_handle: contactHandle,
      social_link: socialLink,
      phone,
      email,
    };

    if (avatar instanceof File && avatar.size > 0) {
      // See apps/web/src/app/dashboard/billing/actions.ts for why this needs its own
      // explicitly-authenticated client rather than the SSR one used for the table update below.
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) throw new Error("Not signed in");

      const storageClient = createSupabaseClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        { global: { headers: { Authorization: `Bearer ${session.access_token}` } } }
      );

      // No upsert — the timestamped filename is already always unique, so there's never a
      // naming conflict to resolve. (upsert:true makes Storage check whether the object already
      // exists first, which needs read access under RLS — this bucket has no SELECT policy since
      // it's public and normally served via the public URL path, not the RLS-checked one — that
      // mismatch is what was actually causing the "violates row-level security policy" error.)
      const ext = AVATAR_EXTENSION_BY_MIME[avatar.type] ?? "jpg";
      const path = `${user.id}/avatar-${Date.now()}.${ext}`;
      const { error: uploadError } = await storageClient.storage
        .from("avatars")
        .upload(path, avatar, { contentType: avatar.type });
      if (uploadError) throw new Error(`Photo upload failed: ${uploadError.message}`);
      update.avatar_url = path;
    }

    const { data, error } = await supabase
      .from("profiles")
      .update(update)
      .eq("id", user.id)
      .select("id")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) throw new Error("Nothing was saved");

    revalidatePath("/dashboard/units");
    return { ok: true, message: "Saved" };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "Failed to save" };
  }
}
