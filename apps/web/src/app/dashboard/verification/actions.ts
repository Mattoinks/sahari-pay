"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

// Push dispatch is centralized as a DB trigger on `notifications` (see
// 0019_audit_coverage_and_push_dispatch.sql) — inserting here is enough, no separate Expo call
// needed.
async function notifyTenant(tenantId: string, type: "payment_verified" | "payment_rejected", title: string, body: string) {
  const supabase = await createClient();
  await supabase.from("notifications").insert({ recipient_id: tenantId, type, title, body });
}

export async function approveTransaction(transactionId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // .eq("status", "submitted") + .maybeSingle() guards against acting on a transaction that's
  // already been approved/rejected (e.g. two admins working the queue at once, or a stale tab) —
  // 0 rows matched reads as "already handled" instead of silently re-writing verified_by/at.
  const { data: transaction, error } = await supabase
    .from("transactions")
    .update({ status: "approved", verified_by: user?.id, verified_at: new Date().toISOString() })
    .eq("id", transactionId)
    .eq("status", "submitted")
    .select("tenant_id, amount")
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!transaction) throw new Error("This payment was already verified — refresh the queue.");

  await notifyTenant(
    transaction.tenant_id,
    "payment_verified",
    "Payment approved",
    `Your payment of ${transaction.amount} has been verified.`
  );

  revalidatePath("/dashboard/verification");
}

export async function rejectTransaction(transactionId: string, reason: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: transaction, error } = await supabase
    .from("transactions")
    .update({
      status: "rejected",
      verified_by: user?.id,
      verified_at: new Date().toISOString(),
      rejection_reason: reason,
    })
    .eq("id", transactionId)
    .eq("status", "submitted")
    .select("tenant_id")
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!transaction) throw new Error("This payment was already verified — refresh the queue.");

  await notifyTenant(
    transaction.tenant_id,
    "payment_rejected",
    "Payment rejected",
    reason
  );

  revalidatePath("/dashboard/verification");
}
