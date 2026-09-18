// Mirrors supabase/migrations/0001_init.sql — keep in sync when the schema changes.

export type UserRole = "admin" | "tenant";
export type UnitStatus = "vacant" | "occupied" | "maintenance";
export type LeaseStatus = "active" | "ended" | "terminated";
export type InvoiceStatus = "draft" | "pending" | "partially_paid" | "paid" | "overdue";
export type LineItemCategory = "rent" | "advance_rent" | "deposit" | "maintenance" | "penalty" | "credit";
export type PaymentMethod = "gcash" | "bank_transfer" | "palawan" | "other";
export type TransactionStatus = "submitted" | "approved" | "rejected";
export type AnnouncementAudience = "all" | "unit" | "property";
export type ContactPlatform = "phone" | "facebook_messenger" | "viber" | "whatsapp" | "telegram" | "instagram";
export type NotificationType =
  | "due_reminder"
  | "payment_verified"
  | "payment_rejected"
  | "announcement"
  | "account_approved"
  | "account_rejected"
  | "viewing_update";
export type ApprovalStatus = "pending" | "approved" | "rejected";
export type OccupationStatus = "student" | "employed" | "self_employed" | "unemployed" | "retired";
export type SourceOfIncome = "salary" | "business" | "allowance" | "remittance" | "pension" | "other";
export type GovernmentIdType = "philsys" | "drivers_license" | "passport" | "umid" | "postal_id" | "voters_id" | "other";
export type ViewingPurpose = "viewing" | "lease_signing";
export type ViewingStatus = "pending" | "confirmed" | "declined" | "cancelled";

export interface Profile {
  id: string;
  full_name: string;
  display_name: string | null;
  email: string | null;
  phone: string | null;
  contact_platform: ContactPlatform | null;
  contact_handle: string | null;
  social_link: string | null;
  avatar_url: string | null;
  notes: string | null;
  birthdate: string | null;
  occupancy_type: string | null;
  number_of_occupants: number | null;
  occupation_status: OccupationStatus | null;
  source_of_income: SourceOfIncome | null;
  source_of_income_other: string | null;
  government_id_type: GovernmentIdType | null;
  government_id_path: string | null;
  role: UserRole;
  approval_status: ApprovalStatus;
  created_at: string;
}

export interface Property {
  id: string;
  owner_id: string;
  name: string;
  address: string;
  gcash_number: string | null;
  bank_details: string | null;
  created_at: string;
}

export interface Unit {
  id: string;
  property_id: string;
  unit_number: string;
  base_rent: number;
  status: UnitStatus;
  created_at: string;
}

export interface Lease {
  id: string;
  unit_id: string;
  tenant_id: string;
  monthly_rent: number;
  start_date: string;
  end_date: string | null;
  billing_day: number;
  has_contract: boolean;
  contract_end_date: string | null;
  status: LeaseStatus;
  created_at: string;
}

export interface DepositSettlement {
  id: string;
  lease_id: string;
  deposit_held: number;
  refund_amount: number;
  notes: string | null;
  settled_by: string | null;
  settled_at: string;
}

export interface DepositDeduction {
  id: string;
  settlement_id: string;
  description: string;
  amount: number;
  created_at: string;
}

export interface Invoice {
  id: string;
  lease_id: string;
  billing_period_start: string;
  billing_period_end: string;
  due_date: string;
  total_amount: number;
  amount_paid: number;
  status: InvoiceStatus;
  created_at: string;
}

export interface InvoiceLineItem {
  id: string;
  invoice_id: string;
  category: LineItemCategory;
  description: string;
  amount: number;
  created_at: string;
}

export interface Transaction {
  id: string;
  invoice_id: string;
  tenant_id: string;
  amount: number;
  payment_method: PaymentMethod;
  reference_number: string | null;
  proof_url: string | null;
  status: TransactionStatus;
  verified_by: string | null;
  verified_at: string | null;
  rejection_reason: string | null;
  created_at: string;
}

export type MaintenanceStatus = "submitted" | "in_progress" | "resolved";

export interface MaintenanceRequest {
  id: string;
  lease_id: string;
  tenant_id: string;
  category: string;
  description: string;
  photo_url: string | null;
  status: MaintenanceStatus;
  created_at: string;
  resolved_at: string | null;
}

export interface Message {
  id: string;
  tenant_id: string;
  sender_id: string;
  body: string;
  attachment_path: string | null;
  read_at: string | null;
  created_at: string;
}

export interface Announcement {
  id: string;
  posted_by: string;
  title: string;
  body: string;
  audience: AnnouncementAudience;
  property_id: string | null;
  unit_id: string | null;
  created_at: string;
}

export interface AppNotification {
  id: string;
  recipient_id: string;
  type: NotificationType;
  title: string;
  body: string;
  read: boolean;
  created_at: string;
}

export interface PaymentChannel {
  method: PaymentMethod;
  display_name: string;
  qr_image_path: string | null;
  account_name: string | null;
  account_number: string | null;
  instructions: string | null;
  updated_at: string;
}

export interface AuditLog {
  id: string;
  actor_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string;
  before_state: unknown;
  after_state: unknown;
  created_at: string;
}

export interface Advertisement {
  id: string;
  image_path: string;
  caption: string | null;
  link_url: string | null;
  opens_scheduler: boolean;
  display_order: number;
  is_active: boolean;
  created_at: string;
}

export interface ViewingRequest {
  id: string;
  tenant_id: string;
  purpose: ViewingPurpose;
  requested_date: string;
  requested_time: string;
  notes: string | null;
  status: ViewingStatus;
  admin_response: string | null;
  created_at: string;
}
