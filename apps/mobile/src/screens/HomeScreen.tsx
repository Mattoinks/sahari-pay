import { useCallback, useState } from "react";
import { View, StyleSheet, ActivityIndicator, RefreshControl, ScrollView, Pressable } from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import {
  formatCurrency,
  type Invoice,
  type InvoiceLineItem,
  type Transaction,
} from "@tenantpay/shared";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/AuthProvider";
import { colors } from "../theme/colors";
import { AppHeader } from "../components/AppHeader";
import { PaymentStatusCard } from "../components/PaymentStatusCard";
import { AdBanner } from "../components/AdBanner";
import { AppText as Text } from "../components/AppText";

interface TenantHeader {
  unitNumber: string | null;
  hasLease: boolean;
  monthlyRent: number;
  startDate: string | null;
  hasContract: boolean;
  contractEndDate: string | null;
}

const PAYMENT_METHOD_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  gcash: "phone-portrait-outline",
  bank_transfer: "business-outline",
  palawan: "send-outline",
  other: "cash-outline",
};

export function HomeScreen() {
  const { session } = useAuth();
  const navigation = useNavigation();
  const [loading, setLoading] = useState(true);
  const [header, setHeader] = useState<TenantHeader | null>(null);
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [lineItems, setLineItems] = useState<InvoiceLineItem[]>([]);
  const [recentTransactions, setRecentTransactions] = useState<Transaction[]>([]);
  const [hasPendingSubmission, setHasPendingSubmission] = useState(false);

  const load = useCallback(async () => {
    if (!session?.user.id) return;
    setLoading(true);

    const { data: lease } = await supabase
      .from("leases")
      .select("id, monthly_rent, start_date, has_contract, contract_end_date, units(unit_number)")
      .eq("tenant_id", session.user.id)
      .eq("status", "active")
      .maybeSingle();

    setHeader({
      unitNumber: (lease?.units as unknown as { unit_number: string } | null)?.unit_number ?? null,
      hasLease: !!lease,
      monthlyRent: lease ? Number(lease.monthly_rent) : 0,
      startDate: lease?.start_date ?? null,
      hasContract: lease?.has_contract ?? false,
      contractEndDate: lease?.contract_end_date ?? null,
    });

    if (!lease) {
      setInvoice(null);
      setLineItems([]);
      setLoading(false);
      return;
    }

    const { data: currentInvoice } = await supabase
      .from("invoices")
      .select("*")
      .eq("lease_id", lease.id)
      .in("status", ["pending", "partially_paid", "overdue"])
      .order("due_date", { ascending: true })
      .limit(1)
      .maybeSingle();

    setInvoice(currentInvoice);

    if (currentInvoice) {
      const { data: items } = await supabase
        .from("invoice_line_items")
        .select("*")
        .eq("invoice_id", currentInvoice.id);
      setLineItems(items ?? []);

      const { data: pendingSubmission } = await supabase
        .from("transactions")
        .select("id")
        .eq("invoice_id", currentInvoice.id)
        .eq("status", "submitted")
        .limit(1)
        .maybeSingle();
      setHasPendingSubmission(!!pendingSubmission);
    } else {
      setLineItems([]);
      setHasPendingSubmission(false);
    }

    const { data: transactions } = await supabase
      .from("transactions")
      .select("*")
      .eq("tenant_id", session.user.id)
      .eq("status", "approved")
      .order("created_at", { ascending: false })
      .limit(3);
    setRecentTransactions(transactions ?? []);

    setLoading(false);
  }, [session?.user.id]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  if (loading) {
    return (
      <View style={styles.screen}>
        <AppHeader title="Sahari" />
        <View style={styles.center}>
          <ActivityIndicator />
        </View>
      </View>
    );
  }

  const balanceDue = invoice ? Number(invoice.total_amount) - Number(invoice.amount_paid) : 0;

  return (
    <View style={styles.screen}>
      <AppHeader title="Sahari" />
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.containerContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={load} tintColor={colors.primary} colors={[colors.primary]} />
        }
      >
        <PaymentStatusCard
          unitLabel={header?.unitNumber ? `Unit ${header.unitNumber}` : "No unit assigned"}
          hasLease={header?.hasLease ?? false}
          amountDue={balanceDue}
          dueDate={invoice?.due_date ?? null}
          hasPendingSubmission={hasPendingSubmission}
          onPayNow={() => navigation.navigate("Payments" as never)}
          onViewDetails={() => navigation.navigate("HistoryTab" as never)}
          onMessage={() => navigation.navigate("Messages" as never)}
        />

        <View style={styles.quickActionsRow}>
          <Pressable style={styles.quickAction} onPress={() => navigation.navigate("Payments" as never)}>
            <View style={[styles.quickActionIcon, { backgroundColor: colors.accentSoft }]}>
              <Ionicons name="card-outline" size={21} color={colors.primary} />
            </View>
            <Text style={styles.quickActionLabel}>Pay Rent</Text>
          </Pressable>
          <Pressable style={styles.quickAction} onPress={() => navigation.navigate("Maintenance" as never)}>
            <View style={[styles.quickActionIcon, { backgroundColor: "#FEF3C7" }]}>
              <Ionicons name="construct-outline" size={21} color={colors.warning} />
            </View>
            <Text style={styles.quickActionLabel}>Maintenance</Text>
          </Pressable>
          <Pressable style={styles.quickAction} onPress={() => navigation.navigate("Messages" as never)}>
            <View style={[styles.quickActionIcon, { backgroundColor: "#FBEDE7" }]}>
              <Ionicons name="chatbubble-ellipses-outline" size={21} color={colors.terracotta} />
            </View>
            <Text style={styles.quickActionLabel}>Messages</Text>
          </Pressable>
        </View>

        {header?.hasLease && (
          <>
            <Text style={[styles.sectionTitle, { marginTop: 28 }]}>Your Lease</Text>
            <View style={styles.leaseCard}>
              <View style={styles.leaseRow}>
                <View style={styles.leaseIconWrap}>
                  <Ionicons name="cash-outline" size={16} color={colors.primary} />
                </View>
                <Text style={styles.leaseLabel}>Monthly rent</Text>
                <Text style={styles.leaseValue}>{formatCurrency(header.monthlyRent)}</Text>
              </View>
              <View style={styles.leaseDivider} />
              <View style={styles.leaseRow}>
                <View style={styles.leaseIconWrap}>
                  <Ionicons name="calendar-outline" size={16} color={colors.primary} />
                </View>
                <Text style={styles.leaseLabel}>Moved in</Text>
                <Text style={styles.leaseValue}>
                  {header.startDate ? new Date(header.startDate).toLocaleDateString() : "—"}
                </Text>
              </View>
              <View style={styles.leaseDivider} />
              <View style={styles.leaseRow}>
                <View style={styles.leaseIconWrap}>
                  <Ionicons name="document-text-outline" size={16} color={colors.primary} />
                </View>
                <Text style={styles.leaseLabel}>Contract</Text>
                <Text style={styles.leaseValue}>
                  {header.hasContract && header.contractEndDate
                    ? `Until ${new Date(header.contractEndDate).toLocaleDateString()}`
                    : "Month-to-month"}
                </Text>
              </View>
            </View>
          </>
        )}

        <AdBanner />

        {lineItems.length > 0 && (
          <>
            <Text style={[styles.sectionTitle, { marginTop: 20 }]}>Current Invoice Breakdown</Text>
            <View style={styles.duesRow}>
              {lineItems.map((item) => (
                <View key={item.id} style={styles.dueCard}>
                  <View style={styles.dueIconWrap}>
                    <Ionicons
                      name={item.category === "deposit" ? "shield-checkmark-outline" : "cash-outline"}
                      size={16}
                      color={colors.primary}
                    />
                  </View>
                  <Text style={styles.dueLabel}>{item.description}</Text>
                  <Text style={styles.dueAmount}>{formatCurrency(Number(item.amount))}</Text>
                </View>
              ))}
            </View>
          </>
        )}

        <View style={styles.historyHeader}>
          <Text style={styles.sectionTitle}>Payment History</Text>
          <Pressable onPress={() => navigation.navigate("HistoryTab" as never)} hitSlop={8}>
            <Text style={styles.seeAll}>See all</Text>
          </Pressable>
        </View>
        {recentTransactions.length > 0 ? (
          <View style={styles.historyCard}>
            {recentTransactions.map((tx, i) => (
              <View key={tx.id} style={[styles.historyRow, i === recentTransactions.length - 1 && { borderBottomWidth: 0 }]}>
                <View style={styles.historyIconWrap}>
                  <Ionicons name={PAYMENT_METHOD_ICONS[tx.payment_method] ?? "checkmark-circle"} size={17} color={colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.historyDate}>{new Date(tx.created_at).toLocaleDateString()}</Text>
                  <Text style={styles.historyMethod}>{tx.payment_method.replace(/_/g, " ")}</Text>
                </View>
                <Text style={styles.historyAmount}>{formatCurrency(Number(tx.amount))}</Text>
              </View>
            ))}
          </View>
        ) : (
          <View style={styles.emptyHistory}>
            <View style={styles.emptyHistoryIcon}>
              <Ionicons name="receipt-outline" size={26} color={colors.primary} />
            </View>
            <Text style={styles.rowLabel}>No verified payments yet</Text>
            <Text style={styles.emptyHistorySubtext}>Payments you submit will show up here once approved.</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, justifyContent: "center", alignItems: "center", padding: 32 },
  container: { flex: 1 },
  containerContent: { paddingHorizontal: 16, paddingBottom: 40, paddingTop: 14 },
  sectionTitle: { fontWeight: "700", fontSize: 16, color: colors.text, letterSpacing: -0.2 },
  leaseCard: {
    marginTop: 12,
    backgroundColor: "#fff",
    borderRadius: 16,
    paddingHorizontal: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 1,
  },
  leaseRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 12 },
  leaseIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.accentSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  leaseLabel: { flex: 1, fontSize: 13, color: colors.textMuted, fontWeight: "500" },
  leaseValue: { fontSize: 13, fontWeight: "700", color: colors.text },
  leaseDivider: { height: 1, backgroundColor: "#f0f0f0" },
  quickActionsRow: { flexDirection: "row", gap: 10, marginTop: 20 },
  quickAction: {
    flex: 1,
    alignItems: "center",
    gap: 8,
    backgroundColor: "#fff",
    borderRadius: 16,
    paddingVertical: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 1,
  },
  quickActionIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
  },
  quickActionLabel: { fontSize: 11, fontWeight: "700", color: colors.text },
  duesRow: { flexDirection: "row", gap: 10, marginTop: 12, marginBottom: 4, flexWrap: "wrap" },
  dueCard: {
    flex: 1,
    minWidth: "45%",
    borderRadius: 16,
    padding: 14,
    backgroundColor: "#fff",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 1,
  },
  dueIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.accentSoft,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  dueLabel: { color: colors.textMuted, fontSize: 12 },
  dueAmount: { color: colors.text, fontWeight: "700", fontSize: 17, marginTop: 4, letterSpacing: -0.3 },
  historyHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 28, marginBottom: 10 },
  seeAll: { color: colors.primary, fontWeight: "600", fontSize: 13 },
  historyCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    paddingHorizontal: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 1,
  },
  historyRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  historyIconWrap: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.accentSoft, alignItems: "center", justifyContent: "center" },
  historyDate: { color: colors.text, fontWeight: "600", fontSize: 13 },
  historyMethod: { color: colors.textMuted, fontSize: 12, marginTop: 1, textTransform: "capitalize" },
  historyAmount: { color: colors.text, fontWeight: "700", fontSize: 14 },
  emptyHistory: {
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 32,
    paddingHorizontal: 24,
    backgroundColor: "#fff",
    borderRadius: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 1,
  },
  emptyHistoryIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.accentSoft,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  emptyHistorySubtext: { color: "#999", fontSize: 12, textAlign: "center" },
  rowLabel: { color: colors.textMuted, fontSize: 13, fontWeight: "600" },
});
