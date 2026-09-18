import { z } from "zod";

// Form/input validation shared by the web admin and mobile app.
// The database (RLS + constraints) is the final authority — these schemas
// only give both clients the same fast, friendly validation before a request is sent.

export const createTenantSchema = z.object({
  full_name: z.string().min(1, "Full name is required"),
  email: z.string().email(),
  phone: z.string().optional(),
  unit_id: z.string().uuid(),
  monthly_rent: z.number().positive(),
  start_date: z.string(), // ISO date
  billing_day: z.number().int().min(1).max(28),
});
export type CreateTenantInput = z.infer<typeof createTenantSchema>;

export const generateInvoiceSchema = z.object({
  lease_id: z.string().uuid(),
  billing_period_start: z.string(),
  billing_period_end: z.string(),
  due_date: z.string(),
  line_items: z
    .array(
      z.object({
        category: z.enum(["rent", "maintenance", "penalty", "credit"]),
        description: z.string().min(1),
        amount: z.number(),
      })
    )
    .min(1, "At least one line item is required"),
});
export type GenerateInvoiceInput = z.infer<typeof generateInvoiceSchema>;

export const submitPaymentSchema = z
  .object({
    invoice_id: z.string().uuid(),
    amount: z.number().positive(),
    payment_method: z.enum(["gcash", "bank_transfer", "palawan", "other"]),
    // "other": the tenant's name for their custom payment method. "palawan": the transaction
    // code needed to claim the cash at a branch. For gcash/bank_transfer, the reference number is
    // expected to be legible in the proof-of-payment screenshot instead of typed in here.
    reference_number: z.string().optional(),
    proof_url: z.string().url().optional(),
  })
  .refine(
    (data) => (data.payment_method !== "other" && data.payment_method !== "palawan") || !!data.reference_number?.trim(),
    {
      message: "This field is required",
      path: ["reference_number"],
  });
export type SubmitPaymentInput = z.infer<typeof submitPaymentSchema>;

export const maintenanceRequestSchema = z.object({
  lease_id: z.string().uuid(),
  category: z.string().min(1, "Category is required"),
  description: z.string().min(1, "Description is required"),
  photo_url: z.string().optional(),
});
export type MaintenanceRequestInput = z.infer<typeof maintenanceRequestSchema>;

export const verifyTransactionSchema = z.object({
  transaction_id: z.string().uuid(),
  decision: z.enum(["approved", "rejected"]),
  rejection_reason: z.string().optional(),
}).refine((data) => data.decision !== "rejected" || !!data.rejection_reason, {
  message: "Rejection reason is required when rejecting a payment",
  path: ["rejection_reason"],
});
export type VerifyTransactionInput = z.infer<typeof verifyTransactionSchema>;

export const announcementSchema = z.object({
  title: z.string().min(1),
  body: z.string().min(1),
  audience: z.enum(["all", "unit", "property"]),
  property_id: z.string().uuid().optional(),
  unit_id: z.string().uuid().optional(),
});
export type AnnouncementInput = z.infer<typeof announcementSchema>;
