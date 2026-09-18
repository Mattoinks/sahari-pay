"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Inserts a one-time move-in invoice (advance rent + security deposit) for a newly created
// lease. Multiplier 0 skips that line item; if both are 0, skips the invoice entirely so we
// don't leave behind a permanently-"pending" invoice with a $0 total (the paid-status trigger
// can never mark a 0-total invoice "paid").
async function createMoveInInvoice(
  supabase: Awaited<ReturnType<typeof createClient>>,
  leaseId: string,
  monthlyRent: number,
  startDate: string,
  advanceMultiplier: number,
  depositMultiplier: number
) {
  const items: { category: "advance_rent" | "deposit"; description: string; amount: number }[] = [];
  if (advanceMultiplier > 0) {
    items.push({
      category: "advance_rent",
      description: `Advance rent (${advanceMultiplier} month${advanceMultiplier === 1 ? "" : "s"})`,
      amount: monthlyRent * advanceMultiplier,
    });
  }
  if (depositMultiplier > 0) {
    items.push({
      category: "deposit",
      description: `Security deposit (${depositMultiplier} month${depositMultiplier === 1 ? "" : "s"})`,
      amount: monthlyRent * depositMultiplier,
    });
  }
  if (items.length === 0) return;

  // billing_period_start/end have no natural "period" for a one-time charge — both collapse to
  // the lease start date.
  const { data: invoice, error: invoiceError } = await supabase
    .from("invoices")
    .insert({ lease_id: leaseId, billing_period_start: startDate, billing_period_end: startDate, due_date: startDate, status: "pending" })
    .select("id")
    .single();
  if (invoiceError || !invoice) throw new Error(invoiceError?.message ?? "Failed to create move-in invoice");

  const { error: lineItemsError } = await supabase
    .from("invoice_line_items")
    .insert(items.map((item) => ({ invoice_id: invoice.id, ...item })));
  if (lineItemsError) throw new Error(lineItemsError.message);
}

// inviteTenant/resendInvite are the only two actions in this app using the service-role client
// (createAdminClient — bypasses RLS entirely). They're currently only reachable by an admin
// because proxy.ts middleware blocks any non-admin request to /dashboard/*, including this
// action's own POST — but that means these two functions have zero protection of their own if
// that middleware logic ever changes. Check explicitly rather than relying on it alone.
async function assertAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") throw new Error("Admins only");
}

function parseContractFields(formData: FormData) {
  const hasContract = formData.get("has_contract") === "on";
  const contractEndDate = String(formData.get("contract_end_date") ?? "").trim() || null;
  if (hasContract && !contractEndDate) {
    throw new Error("Contract end date is required when the lease has a contract");
  }
  return { has_contract: hasContract, contract_end_date: hasContract ? contractEndDate : null };
}

export async function inviteTenant(formData: FormData) {
  await assertAdmin();

  const fullName = String(formData.get("full_name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const contactPlatform = String(formData.get("contact_platform") ?? "").trim() || null;
  const contactHandle = String(formData.get("contact_handle") ?? "").trim() || null;
  const phone = String(formData.get("phone") ?? "").trim() || null;
  const notes = String(formData.get("notes") ?? "").trim() || null;
  const unitId = String(formData.get("unit_id") ?? "").trim() || null;
  const advanceMultiplier = Number(formData.get("advance_multiplier") ?? 1);
  const depositMultiplier = Number(formData.get("deposit_multiplier") ?? 2);
  const contractFields = parseContractFields(formData);

  if (!fullName) throw new Error("Full name is required");
  if (!email) throw new Error("Email is required");

  const admin = createAdminClient();
  // Sends an actual login invite email — this is now the only way a tenant account gets
  // created, so every tenant has a real login path from day one.
  const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
    data: { full_name: fullName, role: "tenant" },
  });
  if (error) throw new Error(error.message);
  const userId = data.user.id;

  const supabase = await createClient();
  const { error: profileError } = await supabase
    .from("profiles")
    .update({
      email,
      phone,
      contact_platform: contactPlatform,
      contact_handle: contactHandle,
      notes,
    })
    .eq("id", userId);
  if (profileError) throw new Error(profileError.message);

  if (unitId) {
    const { data: unit, error: unitFetchError } = await supabase
      .from("units")
      .select("base_rent")
      .eq("id", unitId)
      .single();
    if (unitFetchError || !unit) throw new Error(unitFetchError?.message ?? "Unit not found");

    const startDate = new Date().toISOString().slice(0, 10);
    // Bill on the same day of month as move-in, not always the 1st — clamp to 28 since
    // billing_day's check constraint doesn't allow 29-31 (not every month has those days).
    const billingDay = Math.min(Number(startDate.split("-")[2]), 28);
    const { data: lease, error: leaseError } = await supabase
      .from("leases")
      .insert({
        tenant_id: userId,
        unit_id: unitId,
        monthly_rent: unit.base_rent,
        start_date: startDate,
        billing_day: billingDay,
        ...contractFields,
      })
      .select("id")
      .single();
    if (leaseError || !lease) throw new Error(leaseError?.message ?? "Failed to create lease");

    await createMoveInInvoice(supabase, lease.id, Number(unit.base_rent), startDate, advanceMultiplier, depositMultiplier);

    const { error: unitUpdateError } = await supabase
      .from("units")
      .update({ status: "occupied" })
      .eq("id", unitId);
    if (unitUpdateError) throw new Error(unitUpdateError.message);
  }

  revalidatePath("/dashboard/tenants");
  revalidatePath("/dashboard/units");
}

export async function createLease(formData: FormData) {
  const supabase = await createClient();

  const tenantId = String(formData.get("tenant_id") ?? "");
  const unitId = String(formData.get("unit_id") ?? "");
  const monthlyRent = Number(formData.get("monthly_rent"));
  const startDate = String(formData.get("start_date") ?? "");
  const billingDay = Number(formData.get("billing_day"));
  const advanceMultiplier = Number(formData.get("advance_multiplier") ?? 1);
  const depositMultiplier = Number(formData.get("deposit_multiplier") ?? 2);
  const contractFields = parseContractFields(formData);

  if (!tenantId || !unitId || !startDate || !Number.isFinite(monthlyRent) || monthlyRent < 0) {
    throw new Error("Tenant, unit, start date, and a valid monthly rent are required");
  }
  if (!Number.isInteger(billingDay) || billingDay < 1 || billingDay > 28) {
    throw new Error("Billing day must be between 1 and 28");
  }
  if (!Number.isFinite(advanceMultiplier) || advanceMultiplier < 0) {
    throw new Error("Advance rent multiplier must be zero or greater");
  }
  if (!Number.isFinite(depositMultiplier) || depositMultiplier < 0) {
    throw new Error("Security deposit multiplier must be zero or greater");
  }

  const { data: lease, error: leaseError } = await supabase
    .from("leases")
    .insert({
      tenant_id: tenantId,
      unit_id: unitId,
      monthly_rent: monthlyRent,
      start_date: startDate,
      billing_day: billingDay,
      ...contractFields,
    })
    .select("id")
    .single();
  if (leaseError || !lease) throw new Error(leaseError?.message ?? "Failed to create lease");

  await createMoveInInvoice(supabase, lease.id, monthlyRent, startDate, advanceMultiplier, depositMultiplier);

  const { error: unitError } = await supabase
    .from("units")
    .update({ status: "occupied" })
    .eq("id", unitId);
  if (unitError) throw new Error(unitError.message);

  revalidatePath("/dashboard/tenants");
  revalidatePath("/dashboard/units");
}

export async function updateLease(formData: FormData) {
  const supabase = await createClient();

  const leaseId = String(formData.get("id") ?? "");
  const monthlyRent = Number(formData.get("monthly_rent"));
  const billingDay = Number(formData.get("billing_day"));
  const contractFields = parseContractFields(formData);

  if (!leaseId || !Number.isFinite(monthlyRent) || monthlyRent < 0) {
    throw new Error("A valid monthly rent is required");
  }
  if (!Number.isInteger(billingDay) || billingDay < 1 || billingDay > 28) {
    throw new Error("Billing day must be between 1 and 28");
  }

  const { error } = await supabase
    .from("leases")
    .update({ monthly_rent: monthlyRent, billing_day: billingDay, ...contractFields })
    .eq("id", leaseId);
  if (error) throw new Error(error.message);

  revalidatePath("/dashboard/tenants");
}

export async function terminateLeaseWithSettlement(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const leaseId = String(formData.get("lease_id") ?? "");
  const unitId = String(formData.get("unit_id") ?? "");
  const depositHeld = Number(formData.get("deposit_held") ?? 0);
  const notes = String(formData.get("notes") ?? "").trim() || null;
  const deductionsRaw = String(formData.get("deductions") ?? "[]");

  if (!leaseId || !unitId) throw new Error("Missing lease or unit");
  if (!Number.isFinite(depositHeld) || depositHeld < 0) {
    throw new Error("Deposit held must be zero or greater");
  }

  let deductions: { description: string; amount: number }[] = [];
  try {
    deductions = JSON.parse(deductionsRaw);
  } catch {
    throw new Error("Invalid deductions");
  }
  deductions = deductions
    .filter((d) => d?.description?.trim() && Number.isFinite(d.amount) && d.amount > 0)
    .map((d) => ({ description: d.description.trim(), amount: d.amount }));

  const deductionsTotal = deductions.reduce((sum, d) => sum + d.amount, 0);
  const refundAmount = depositHeld - deductionsTotal;

  const { error: leaseError } = await supabase
    .from("leases")
    .update({ status: "terminated", end_date: new Date().toISOString().slice(0, 10) })
    .eq("id", leaseId);
  if (leaseError) throw new Error(leaseError.message);

  const { error: unitError } = await supabase
    .from("units")
    .update({ status: "vacant" })
    .eq("id", unitId);
  if (unitError) throw new Error(unitError.message);

  // Upsert on lease_id (not a plain insert) so this whole action is safe to re-run — e.g. a
  // double-click, or a retry after the deductions step below failed partway through a previous
  // attempt — instead of hitting deposit_settlements_lease_id_key on the second try.
  const { data: settlement, error: settlementError } = await supabase
    .from("deposit_settlements")
    .upsert(
      {
        lease_id: leaseId,
        deposit_held: depositHeld,
        refund_amount: refundAmount,
        notes,
        settled_by: user?.id ?? null,
      },
      { onConflict: "lease_id" }
    )
    .select("id")
    .single();
  if (settlementError || !settlement) {
    throw new Error(settlementError?.message ?? "Failed to record deposit settlement");
  }

  // Clear any deductions from a previous attempt on this same settlement before re-inserting,
  // so a retry doesn't leave duplicate deduction rows behind.
  const { error: clearDeductionsError } = await supabase
    .from("deposit_deductions")
    .delete()
    .eq("settlement_id", settlement.id);
  if (clearDeductionsError) throw new Error(clearDeductionsError.message);

  if (deductions.length > 0) {
    const { error: deductionsError } = await supabase
      .from("deposit_deductions")
      .insert(deductions.map((d) => ({ settlement_id: settlement.id, description: d.description, amount: d.amount })));
    if (deductionsError) throw new Error(deductionsError.message);
  }

  revalidatePath("/dashboard/tenants");
  revalidatePath("/dashboard/units");
}

// Re-sends the Supabase Auth invite email — covers a tenant whose original invite link expired
// (24h default) or got lost before they ever set a password. If they've already confirmed their
// account, Supabase rejects this with "already registered"; they should use the mobile app's
// "Forgot password" instead, since at that point they have a real password to reset.
export async function resendInvite(email: string) {
  await assertAdmin();
  if (!email) throw new Error("This tenant has no email on file");

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.inviteUserByEmail(email, { data: { role: "tenant" } });
  if (error) {
    throw new Error(
      error.message.toLowerCase().includes("already been registered")
        ? "This tenant has already set up their account — they should use \"Forgot password\" in the app instead."
        : error.message
    );
  }
}

// Reviews a mobile self-signup (apps/mobile/src/screens/SignUpScreen.tsx creates the account
// directly, with no admin involvement, so it lands here pending review before it can use the
// app at all — see 0022_tenant_approval.sql). .eq("approval_status", "pending") + .maybeSingle()
// guards against acting twice on the same account (e.g. two admin tabs open).
export async function approveTenantAccount(profileId: string) {
  await assertAdmin();
  const supabase = await createClient();

  const { data: profile, error } = await supabase
    .from("profiles")
    .update({ approval_status: "approved" })
    .eq("id", profileId)
    .eq("approval_status", "pending")
    .select("id")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!profile) throw new Error("This account is no longer pending.");

  await supabase.from("notifications").insert({
    recipient_id: profileId,
    type: "account_approved",
    title: "Account approved",
    body: "Your Sahari account has been approved — welcome!",
  });

  revalidatePath("/dashboard/tenants");
  revalidatePath("/dashboard", "layout");
}

export async function rejectTenantAccount(profileId: string) {
  await assertAdmin();
  const supabase = await createClient();

  const { data: profile, error } = await supabase
    .from("profiles")
    .update({ approval_status: "rejected" })
    .eq("id", profileId)
    .eq("approval_status", "pending")
    .select("id")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!profile) throw new Error("This account is no longer pending.");

  await supabase.from("notifications").insert({
    recipient_id: profileId,
    type: "account_rejected",
    title: "Account not approved",
    body: "Your Sahari account request wasn't approved. Contact the property admin for details.",
  });

  revalidatePath("/dashboard/tenants");
  revalidatePath("/dashboard", "layout");
}
