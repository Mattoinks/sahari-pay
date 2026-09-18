"use server";

import { revalidatePath } from "next/cache";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

export async function generateInvoice(formData: FormData) {
  const supabase = await createClient();

  const leaseId = String(formData.get("lease_id") ?? "");
  const billingPeriodStart = String(formData.get("billing_period_start") ?? "");
  const billingPeriodEnd = String(formData.get("billing_period_end") ?? "");
  const dueDate = String(formData.get("due_date") ?? "");
  const extraCategory = String(formData.get("extra_category") ?? "maintenance");
  const extraDescription = String(formData.get("extra_description") ?? "").trim();
  const extraAmountRaw = formData.get("extra_amount");
  const extraAmount = extraAmountRaw ? Number(extraAmountRaw) : null;

  if (!leaseId || !billingPeriodStart || !billingPeriodEnd || !dueDate) {
    throw new Error("Lease, billing period, and due date are required");
  }

  const { data: lease, error: leaseError } = await supabase
    .from("leases")
    .select("id, monthly_rent")
    .eq("id", leaseId)
    .single();
  if (leaseError || !lease) throw new Error(leaseError?.message ?? "Lease not found");

  const { data: invoice, error: invoiceError } = await supabase
    .from("invoices")
    .insert({
      lease_id: leaseId,
      billing_period_start: billingPeriodStart,
      billing_period_end: billingPeriodEnd,
      due_date: dueDate,
      status: "pending",
    })
    .select("id")
    .single();
  if (invoiceError || !invoice) throw new Error(invoiceError?.message);

  const lineItems = [
    { invoice_id: invoice.id, category: "rent", description: "Monthly rent", amount: Number(lease.monthly_rent) },
  ];

  if (extraAmount && extraAmount > 0) {
    lineItems.push({
      invoice_id: invoice.id,
      category: extraCategory,
      description: extraDescription || extraCategory,
      amount: extraAmount,
    });
  }

  const { error: lineItemsError } = await supabase.from("invoice_line_items").insert(lineItems);
  if (lineItemsError) throw new Error(lineItemsError.message);

  revalidatePath("/dashboard/billing");
}

export async function deleteInvoice(invoiceId: string) {
  const supabase = await createClient();
  if (!invoiceId) throw new Error("Missing invoice id");

  // invoice_line_items cascade on delete, but transactions reference invoices with "on delete
  // restrict" — a mistaken invoice with no payments deletes cleanly, one with real payment
  // history refuses at the DB level and surfaces here as a foreign-key violation (23503).
  const { error } = await supabase.from("invoices").delete().eq("id", invoiceId);
  if (error) {
    if (error.code === "23503") {
      throw new Error("Can't delete — this invoice already has payment transactions recorded against it.");
    }
    throw new Error(error.message);
  }

  revalidatePath("/dashboard/billing");
}

const QR_EXTENSION_BY_MIME: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

export type SaveChannelState = { ok: boolean; message: string } | null;

export async function savePaymentChannel(
  _prevState: SaveChannelState,
  formData: FormData
): Promise<SaveChannelState> {
  const supabase = await createClient();

  const method = String(formData.get("method") ?? "");
  const accountName = String(formData.get("account_name") ?? "").trim() || null;
  const accountNumber = String(formData.get("account_number") ?? "").trim() || null;
  const instructions = String(formData.get("instructions") ?? "").trim() || null;
  const qrImage = formData.get("qr_image");

  if (!method) return { ok: false, message: "Missing payment method" };

  try {
    const update: Record<string, unknown> = {
      account_name: accountName,
      account_number: accountNumber,
      instructions,
      updated_at: new Date().toISOString(),
    };

    if (qrImage instanceof File && qrImage.size > 0) {
      // getSession() alone returns whatever token is cached without validating or refreshing
      // it — if it's expired, using it explicitly still fails auth (and the storage layer
      // reports that as an RLS violation rather than "expired token"). getUser() forces a real
      // validate-and-refresh round trip first, so the token we then read is guaranteed current.
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();
      if (userError || !user) throw new Error("QR upload failed: not signed in");

      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) throw new Error("QR upload failed: no session");

      const storageClient = createSupabaseClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        { global: { headers: { Authorization: `Bearer ${session.access_token}` } } }
      );

      const ext = QR_EXTENSION_BY_MIME[qrImage.type] ?? "png";
      const path = `${method}-${Date.now()}.${ext}`;
      const { error: uploadError } = await storageClient.storage
        .from("payment-qr")
        .upload(path, qrImage, { contentType: qrImage.type, upsert: true });
      if (uploadError) {
        console.error("QR upload error:", uploadError);
        throw new Error(`QR upload failed: ${uploadError.message}`);
      }
      update.qr_image_path = path;
    }

    // .select().maybeSingle() so a silently-denied RLS update (0 rows affected, which
    // Postgres does not treat as an error) surfaces as a real failure instead of looking
    // like it saved.
    const { data, error } = await supabase
      .from("payment_channels")
      .update(update)
      .eq("method", method)
      .select("method")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) throw new Error("Nothing was saved — your account may not have admin access.");

    revalidatePath("/dashboard/billing");
    return { ok: true, message: "Saved" };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "Failed to save" };
  }
}
