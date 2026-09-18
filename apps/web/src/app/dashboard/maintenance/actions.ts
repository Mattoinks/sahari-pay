"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { MaintenanceStatus } from "@tenantpay/shared";

export async function updateMaintenanceStatus(requestId: string, status: MaintenanceStatus) {
  const supabase = await createClient();

  const { error } = await supabase
    .from("maintenance_requests")
    .update({
      status,
      resolved_at: status === "resolved" ? new Date().toISOString() : null,
    })
    .eq("id", requestId);
  if (error) throw new Error(error.message);

  revalidatePath("/dashboard/maintenance");
}
