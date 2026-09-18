import { useCallback, useState } from "react";
import { View, StyleSheet, FlatList, RefreshControl } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { formatCurrency, transactionStatusLabel, type Transaction } from "@tenantpay/shared";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/AuthProvider";
import { colors } from "../theme/colors";
import { AppHeader } from "../components/AppHeader";
import { AppText as Text } from "../components/AppText";

const TONE_COLORS: Record<"submitted" | "approved" | "rejected", { bg: string; text: string; icon: keyof typeof Ionicons.glyphMap }> = {
  submitted: { bg: "#FEF3C7", text: colors.warning, icon: "time-outline" },
  approved: { bg: colors.accentSoft, text: colors.primaryDark, icon: "checkmark-circle-outline" },
  rejected: { bg: colors.dangerSoft, text: colors.danger, icon: "close-circle-outline" },
};

export function HistoryScreen() {
  const { session } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!session?.user.id) return;
    setLoading(true);
    const { data } = await supabase
      .from("transactions")
      .select("*")
      .eq("tenant_id", session.user.id)
      .order("created_at", { ascending: false });
    setTransactions(data ?? []);
    setLoading(false);
  }, [session?.user.id]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  return (
    <View style={styles.screen}>
      <AppHeader title="History" />
      <FlatList
        style={styles.container}
        contentContainerStyle={styles.listContent}
        data={transactions}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
        ListEmptyComponent={
          !loading ? (
            <View style={styles.emptyState}>
              <View style={styles.emptyIcon}>
                <Ionicons name="receipt-outline" size={26} color={colors.primary} />
              </View>
              <Text style={styles.emptyTitle}>No payments yet</Text>
              <Text style={styles.emptyText}>Payments you submit will show up here.</Text>
            </View>
          ) : null
        }
        renderItem={({ item }) => {
          const tone = TONE_COLORS[item.status];
          return (
            <View style={styles.row}>
              <View style={[styles.iconWrap, { backgroundColor: tone.bg }]}>
                <Ionicons name={tone.icon} size={18} color={tone.text} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.amount}>{formatCurrency(Number(item.amount))}</Text>
                <Text style={styles.meta}>
                  <Text style={{ textTransform: "capitalize" }}>{item.payment_method.replace(/_/g, " ")}</Text> ·{" "}
                  {new Date(item.created_at).toLocaleDateString()}
                </Text>
                {item.status === "rejected" && item.rejection_reason && (
                  <Text style={styles.rejectionReason}>{item.rejection_reason}</Text>
                )}
              </View>
              <View style={[styles.statusBadge, { backgroundColor: tone.bg }]}>
                <Text style={[styles.statusText, { color: tone.text }]}>{transactionStatusLabel[item.status]}</Text>
              </View>
            </View>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  container: { flex: 1 },
  listContent: { padding: 16, flexGrow: 1 },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingTop: 80,
    paddingHorizontal: 32,
  },
  emptyIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.accentSoft,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
  },
  emptyTitle: { color: colors.text, fontSize: 15, fontWeight: "700" },
  emptyText: { color: colors.textMuted, fontSize: 13, textAlign: "center" },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#fff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    marginBottom: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 1,
  },
  iconWrap: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  amount: { fontWeight: "700", fontSize: 16, color: colors.text },
  meta: { color: colors.textMuted, marginTop: 2, fontSize: 12 },
  rejectionReason: { color: colors.danger, marginTop: 4, fontSize: 12 },
  statusBadge: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5 },
  statusText: { fontWeight: "700", fontSize: 11 },
});
