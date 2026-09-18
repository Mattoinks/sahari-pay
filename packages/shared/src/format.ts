import type {
  ContactPlatform,
  InvoiceStatus,
  LeaseStatus,
  MaintenanceStatus,
  TransactionStatus,
  UnitStatus,
  ViewingPurpose,
  ViewingStatus,
} from "./types";

// Single source of truth for how money/status render on both the web admin and mobile app.

export function formatCurrency(amount: number, currency = "PHP"): string {
  return new Intl.NumberFormat("en-PH", { style: "currency", currency }).format(amount);
}

export const invoiceStatusLabel: Record<InvoiceStatus, string> = {
  draft: "Draft",
  pending: "Pending",
  partially_paid: "Partially Paid",
  paid: "Paid",
  overdue: "Overdue",
};

// Semantic color tokens, not literal CSS — map these to your design system's palette.
export const invoiceStatusTone: Record<InvoiceStatus, "success" | "warning" | "danger" | "neutral"> = {
  draft: "neutral",
  pending: "warning",
  partially_paid: "warning",
  paid: "success",
  overdue: "danger",
};

export const transactionStatusLabel: Record<TransactionStatus, string> = {
  submitted: "Submitted",
  approved: "Approved",
  rejected: "Rejected",
};

export const transactionStatusTone: Record<TransactionStatus, "success" | "warning" | "danger" | "neutral"> = {
  submitted: "warning",
  approved: "success",
  rejected: "danger",
};

export const unitStatusLabel: Record<UnitStatus, string> = {
  vacant: "Vacant",
  occupied: "Occupied",
  maintenance: "Maintenance",
};

export const unitStatusTone: Record<UnitStatus, "success" | "warning" | "danger" | "neutral"> = {
  vacant: "neutral",
  occupied: "success",
  maintenance: "warning",
};

export const leaseStatusLabel: Record<LeaseStatus, string> = {
  active: "Active",
  ended: "Ended",
  terminated: "Terminated",
};

export const leaseStatusTone: Record<LeaseStatus, "success" | "warning" | "danger" | "neutral"> = {
  active: "success",
  ended: "neutral",
  terminated: "danger",
};

export const maintenanceStatusLabel: Record<MaintenanceStatus, string> = {
  submitted: "Submitted",
  in_progress: "In Progress",
  resolved: "Resolved",
};

export const maintenanceStatusTone: Record<MaintenanceStatus, "success" | "warning" | "danger" | "neutral"> = {
  submitted: "warning",
  in_progress: "neutral",
  resolved: "success",
};

export const MAINTENANCE_CATEGORIES = [
  "Plumbing",
  "Electrical",
  "Air Conditioning / HVAC",
  "Appliance",
  "Structural",
  "Pest Control",
  "Other",
] as const;

export const OCCUPANCY_TYPES = ["Single", "Couple", "Family", "Shared / Roommates"] as const;

// Distinct from OCCUPANCY_TYPES above (household composition) — this is the tenant's employment
// situation, collected at signup and shown to the admin when reviewing a pending account.
export const OCCUPATION_STATUSES = ["student", "employed", "self_employed", "unemployed", "retired"] as const;

export const occupationStatusLabel: Record<(typeof OCCUPATION_STATUSES)[number], string> = {
  student: "Student",
  employed: "Employed",
  self_employed: "Self-employed",
  unemployed: "Unemployed",
  retired: "Retired",
};

export const SOURCE_OF_INCOME_TYPES = ["salary", "business", "allowance", "remittance", "pension", "other"] as const;

export const sourceOfIncomeLabel: Record<(typeof SOURCE_OF_INCOME_TYPES)[number], string> = {
  salary: "Salary / Wages",
  business: "Business Income",
  allowance: "Allowance (from family)",
  remittance: "Remittance (OFW support)",
  pension: "Pension / Retirement",
  other: "Other",
};

export const GOVERNMENT_ID_TYPES = [
  "philsys",
  "drivers_license",
  "passport",
  "umid",
  "postal_id",
  "voters_id",
  "other",
] as const;

export const governmentIdTypeLabel: Record<(typeof GOVERNMENT_ID_TYPES)[number], string> = {
  philsys: "Philippine National ID (PhilSys)",
  drivers_license: "Driver's License",
  passport: "Passport",
  umid: "UMID",
  postal_id: "Postal ID",
  voters_id: "Voter's ID",
  other: "Other",
};

export const viewingPurposeLabel: Record<ViewingPurpose, string> = {
  viewing: "Apartment Viewing",
  lease_signing: "Lease / Contract Signing",
};

export const viewingStatusLabel: Record<ViewingStatus, string> = {
  pending: "Pending",
  confirmed: "Confirmed",
  declined: "Declined",
  cancelled: "Cancelled",
};

export const viewingStatusTone: Record<ViewingStatus, "success" | "warning" | "danger" | "neutral"> = {
  pending: "warning",
  confirmed: "success",
  declined: "danger",
  cancelled: "neutral",
};

export const contactPlatformLabel: Record<ContactPlatform, string> = {
  phone: "Phone",
  facebook_messenger: "Facebook / Messenger",
  viber: "Viber",
  whatsapp: "WhatsApp",
  telegram: "Telegram",
  instagram: "Instagram",
};
