"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

// Push dispatch is centralized as a DB trigger on `notifications` (see
// 0019_audit_coverage_and_push_dispatch.sql) — inserting here is enough, no separate Expo call
// needed.
async function notifyTenant(tenantId: string, title: string, body: string) {
  const supabase = await createClient();
  await supabase.from("notifications").insert({ recipient_id: tenantId, type: "viewing_update", title, body });
}

// Admin-initiated — the admin already knows their own availability, so this lands as
// "confirmed" directly rather than "pending" (there's no one else who needs to approve it).
export async function proposeViewing(formData: FormData) {
  const supabase = await createClient();

  const tenantId = String(formData.get("tenant_id") ?? "");
  const purpose = String(formData.get("purpose") ?? "viewing");
  const requestedDate = String(formData.get("requested_date") ?? "");
  const requestedTime = String(formData.get("requested_time") ?? "");
  const note = String(formData.get("note") ?? "").trim() || null;

  if (!tenantId || !requestedDate || !requestedTime) {
    throw new Error("Tenant, date, and time are required");
  }

  const { error } = await supabase.from("viewing_requests").insert({
    tenant_id: tenantId,
    purpose,
    requested_date: requestedDate,
    requested_time: requestedTime,
    status: "confirmed",
    admin_response: note,
  });
  if (error) throw new Error(error.message);

  await notifyTenant(
    tenantId,
    "New appointment scheduled",
    `Your landlord scheduled a ${purpose === "lease_signing" ? "lease signing" : "viewing"} for ${new Date(
      requestedDate
    ).toLocaleDateString()} at ${requestedTime}.${note ? ` "${note}"` : ""}`
  );

  revalidatePath("/dashboard/viewings");
  revalidatePath("/dashboard", "layout");
}

export async function confirmViewing(id: string, adminResponse: string) {
  const supabase = await createClient();

  const { data: request, error } = await supabase
    .from("viewing_requests")
    .update({ status: "confirmed", admin_response: adminResponse.trim() || null })
    .eq("id", id)
    .eq("status", "pending")
    .select("tenant_id, requested_date, requested_time")
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!request) throw new Error("This request was already handled — refresh the page.");

  await notifyTenant(
    request.tenant_id,
    "Appointment confirmed",
    `Your request for ${new Date(request.requested_date).toLocaleDateString()} at ${request.requested_time} has been confirmed.${
      adminResponse.trim() ? ` "${adminResponse.trim()}"` : ""
    }`
  );

  revalidatePath("/dashboard/viewings");
  revalidatePath("/dashboard", "layout");
}

export async function declineViewing(id: string, adminResponse: string) {
  const supabase = await createClient();

  const { data: request, error } = await supabase
    .from("viewing_requests")
    .update({ status: "declined", admin_response: adminResponse.trim() || null })
    .eq("id", id)
    .eq("status", "pending")
    .select("tenant_id, requested_date, requested_time")
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!request) throw new Error("This request was already handled — refresh the page.");

  await notifyTenant(
    request.tenant_id,
    "Appointment declined",
    `Your request for ${new Date(request.requested_date).toLocaleDateString()} at ${request.requested_time} couldn't be accommodated.${
      adminResponse.trim() ? ` "${adminResponse.trim()}"` : " Please message us to arrange another time."
    }`
  );

  revalidatePath("/dashboard/viewings");
  revalidatePath("/dashboard", "layout");
}
