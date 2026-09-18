import { useCallback, useState } from "react";
import { View, StyleSheet, Pressable, ScrollView } from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import {
  formatCurrency,
  invoiceStatusLabel,
  occupationStatusLabel,
  sourceOfIncomeLabel,
  type InvoiceStatus,
  type Profile,
} from "@tenantpay/shared";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/AuthProvider";
import { colors } from "../theme/colors";
import { AppHeader } from "../components/AppHeader";
import { AppText as Text } from "../components/AppText";

interface LeaseInfo {
  unitNumber: string;
  startDate: string;
  monthlyRent: number;
  hasContract: boolean;
  contractEndDate: string | null;
}

interface DueInfo {
  dueDate: string;
  status: InvoiceStatus;
}

interface SettlementInfo {
  id: string;
  depositHeld: number;
  refundAmount: number;
  notes: string | null;
  settledAt: string;
  deductions: { id: string; description: string; amount: number }[];
}

function InfoRow({
  icon,
  label,
  value,
  isLast,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  isLast?: boolean;
}) {
  const isEmpty = value === "Not set";
  return (
    <View style={[styles.infoRow, isLast && { borderBottomWidth: 0 }]}>
      <View style={styles.infoIconWrap}>
        <Ionicons name={icon} size={16} color={colors.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={[styles.infoValue, isEmpty && styles.infoValueEmpty]}>{value}</Text>
      </View>
    </View>
  );
}

export function ProfileScreen() {
  const { session } = useAuth();
  const navigation = useNavigation();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [lease, setLease] = useState<LeaseInfo | null>(null);
  const [due, setDue] = useState<DueInfo | null>(null);
  const [settlements, setSettlements] = useState<SettlementInfo[]>([]);

  useFocusEffect(
    useCallback(() => {
      const userId = session?.user.id;
      if (!userId) return;

      supabase.from("profiles").select("*").eq("id", userId).single().then(({ data }) => setProfile(data));

      supabase
        .from("leases")
        .select("id")
        .eq("tenant_id", userId)
        .then(async ({ data: allLeases }) => {
          const leaseIds = (allLeases ?? []).map((l) => l.id);
          if (leaseIds.length === 0) {
            setSettlements([]);
            return;
          }
          const { data } = await supabase
            .from("deposit_settlements")
            .select("id, deposit_held, refund_amount, notes, settled_at, deposit_deductions(id, description, amount)")
            .in("lease_id", leaseIds)
            .order("settled_at", { ascending: false });

          setSettlements(
            (data ?? []).map((s) => ({
              id: s.id,
              depositHeld: Number(s.deposit_held),
              refundAmount: Number(s.refund_amount),
              notes: s.notes,
              settledAt: s.settled_at,
              deductions: (s.deposit_deductions as unknown as { id: string; description: string; amount: number }[]) ?? [],
            }))
          );
        });

      supabase
        .from("leases")
        .select("id, start_date, monthly_rent, has_contract, contract_end_date, units(unit_number)")
        .eq("tenant_id", userId)
        .eq("status", "active")
        .maybeSingle()
        .then(async ({ data: activeLease }) => {
          if (!activeLease) {
            setLease(null);
            setDue(null);
            return;
          }

          setLease({
            unitNumber: (activeLease.units as unknown as { unit_number: string } | null)?.unit_number ?? "—",
            startDate: activeLease.start_date,
            monthlyRent: Number(activeLease.monthly_rent),
            hasContract: activeLease.has_contract,
            contractEndDate: activeLease.contract_end_date,
          });

          const { data: invoice } = await supabase
            .from("invoices")
            .select("due_date, status")
            .eq("lease_id", activeLease.id)
            .in("status", ["pending", "partially_paid", "overdue"])
            .order("due_date", { ascending: true })
            .limit(1)
            .maybeSingle();

          setDue(invoice ? { dueDate: invoice.due_date, status: invoice.status } : null);
        });
    }, [session?.user.id])
  );

  // Older accounts had full_name auto-filled with their email when no name was collected —
  // don't show that as a display name.
  const fullNameLooksLikeEmail = !!profile?.full_name?.includes("@");
  const shownName = profile?.display_name || (fullNameLooksLikeEmail ? null : profile?.full_name) || "—";

  return (
    <View style={styles.screen}>
      <AppHeader title="Profile" onBack={() => navigation.goBack()} />
      <ScrollView style={styles.container} contentContainerStyle={styles.containerContent} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{shownName.charAt(0).toUpperCase()}</Text>
        </View>
        <Text style={styles.name}>{shownName}</Text>
        {profile?.display_name && !fullNameLooksLikeEmail && (
          <Text style={styles.meta}>{profile.full_name}</Text>
        )}
        <Text style={styles.meta}>{profile?.email ?? profile?.contact_handle ?? profile?.phone ?? ""}</Text>
        {lease && (
          <View style={styles.tenantSincePill}>
            <Ionicons name="home" size={11} color={colors.primaryDark} />
            <Text style={styles.tenantSinceText}>Tenant since {new Date(lease.startDate).toLocaleDateString(undefined, { month: "short", year: "numeric" })}</Text>
          </View>
        )}
      </View>

      {lease && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Lease</Text>
          <InfoRow icon="business-outline" label="Unit" value={lease.unitNumber} />
          <InfoRow icon="calendar-outline" label="Moved in" value={new Date(lease.startDate).toLocaleDateString()} />
          <InfoRow icon="cash-outline" label="Monthly rent" value={formatCurrency(lease.monthlyRent)} />
          <InfoRow
            icon="document-text-outline"
            label="Contract"
            value={
              lease.hasContract && lease.contractEndDate
                ? `Until ${new Date(lease.contractEndDate).toLocaleDateString()}`
                : "No fixed term (month-to-month)"
            }
            isLast={!due}
          />
          {due && (
            <InfoRow
              icon="time-outline"
              label="Next due date"
              value={`${new Date(due.dueDate).toLocaleDateString()} · ${invoiceStatusLabel[due.status]}`}
              isLast
            />
          )}
        </View>
      )}

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Household</Text>
        <InfoRow icon="happy-outline" label="Display name" value={profile?.display_name || "Not set"} />
        <InfoRow icon="gift-outline" label="Birthdate" value={profile?.birthdate ? new Date(profile.birthdate).toLocaleDateString() : "Not set"} />
        <InfoRow icon="home-outline" label="Occupancy type" value={profile?.occupancy_type ?? "Not set"} />
        <InfoRow
          icon="people-outline"
          label="Number of occupants"
          value={profile?.number_of_occupants ? String(profile.number_of_occupants) : "Not set"}
        />
        <InfoRow
          icon="briefcase-outline"
          label="Occupation"
          value={profile?.occupation_status ? occupationStatusLabel[profile.occupation_status] : "Not set"}
        />
        <InfoRow
          icon="cash-outline"
          label="Income source"
          value={
            profile?.source_of_income
              ? profile.source_of_income === "other" && profile.source_of_income_other
                ? `Other — ${profile.source_of_income_other}`
                : sourceOfIncomeLabel[profile.source_of_income]
              : "Not set"
          }
          isLast
        />
      </View>

      {settlements.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Deposit Settlements</Text>
          {settlements.map((s, i) => (
            <View key={s.id} style={[styles.settlementBlock, i === settlements.length - 1 && { marginBottom: 0, paddingBottom: 0, borderBottomWidth: 0 }]}>
              <View style={styles.settlementHeaderRow}>
                <Text style={styles.settlementDate}>{new Date(s.settledAt).toLocaleDateString()}</Text>
                <Text style={[styles.settlementAmount, { color: s.refundAmount >= 0 ? colors.primary : colors.danger }]}>
                  {s.refundAmount >= 0
                    ? `Refunded ${formatCurrency(s.refundAmount)}`
                    : `Owed ${formatCurrency(Math.abs(s.refundAmount))}`}
                </Text>
              </View>
              <Text style={styles.settlementMeta}>Deposit held: {formatCurrency(s.depositHeld)}</Text>
              {s.deductions.map((d) => (
                <View key={d.id} style={styles.deductionRow}>
                  <Text style={styles.deductionText}>{d.description}</Text>
                  <Text style={styles.deductionAmount}>-{formatCurrency(d.amount)}</Text>
                </View>
              ))}
              {s.notes && <Text style={styles.settlementNotes}>{s.notes}</Text>}
            </View>
          ))}
        </View>
      )}

      <Pressable style={styles.logout} onPress={() => supabase.auth.signOut()}>
        <Ionicons name="log-out-outline" size={18} color={colors.danger} />
        <Text style={styles.logoutText}>Sign out</Text>
      </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  container: { flex: 1 },
  containerContent: { padding: 20 },
  header: { alignItems: "center", marginBottom: 24 },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
    shadowColor: colors.primaryDark,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 4,
  },
  avatarText: { color: "#fff", fontSize: 28, fontWeight: "700" },
  name: { fontSize: 20, fontWeight: "700", color: colors.text },
  meta: { color: colors.textMuted, marginTop: 2, fontSize: 13 },
  tenantSincePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: colors.accentSoft,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginTop: 10,
  },
  tenantSinceText: { fontSize: 12, fontWeight: "700", color: colors.primaryDark },
  card: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 16,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 2,
  },
  cardTitle: { fontSize: 13, fontWeight: "700", color: colors.primary, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  infoIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.accentSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  infoLabel: { color: colors.textMuted, fontSize: 12 },
  infoValue: { color: colors.text, fontSize: 15, fontWeight: "600", marginTop: 1 },
  infoValueEmpty: { color: "#b5b5b5", fontWeight: "400", fontStyle: "italic" },
  settlementBlock: { paddingBottom: 12, marginBottom: 12, borderBottomWidth: 1, borderBottomColor: "#f0f0f0" },
  settlementHeaderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  settlementDate: { fontSize: 13, color: colors.textMuted, fontWeight: "600" },
  settlementAmount: { fontSize: 14, fontWeight: "700" },
  settlementMeta: { fontSize: 12, color: colors.textMuted, marginTop: 4 },
  deductionRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 4 },
  deductionText: { fontSize: 12, color: colors.text, flex: 1, marginRight: 8 },
  deductionAmount: { fontSize: 12, color: colors.danger, fontWeight: "600" },
  settlementNotes: { fontSize: 12, color: colors.textMuted, marginTop: 6, fontStyle: "italic" },
  logout: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 8,
    marginBottom: 32,
    padding: 14,
    borderRadius: 10,
    backgroundColor: colors.dangerSoft,
  },
  logoutText: { color: colors.danger, fontWeight: "700" },
});
