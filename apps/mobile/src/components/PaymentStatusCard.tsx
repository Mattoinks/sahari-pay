import { View, Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { formatCurrency } from "@tenantpay/shared";
import { colors } from "../theme/colors";
import { AppText as Text } from "./AppText";

type CardStatus = "paid" | "pending_approval" | "due" | "overdue" | "no_lease";

interface StatusMeta {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  badgeBg: string;
  badgeText: string;
  ctaLabel: string;
  ctaBg: string;
  ctaText: string;
}

const STATUS_META: Record<CardStatus, StatusMeta> = {
  paid: {
    label: "PAID · UP TO DATE",
    icon: "checkmark-circle",
    badgeBg: "rgba(255,255,255,0.85)",
    badgeText: colors.primaryDark,
    ctaLabel: "View Details",
    ctaBg: "#fff",
    ctaText: colors.primaryDark,
  },
  pending_approval: {
    label: "PENDING APPROVAL",
    icon: "time",
    badgeBg: "#FEF3C7",
    badgeText: colors.warning,
    ctaLabel: "Track Submission",
    ctaBg: "#fff",
    ctaText: colors.warning,
  },
  due: {
    label: "PAYMENT DUE",
    icon: "alert-circle",
    badgeBg: "#FEF3C7",
    badgeText: colors.warning,
    ctaLabel: "Pay Now",
    ctaBg: "#fff",
    ctaText: colors.primaryDark,
  },
  overdue: {
    label: "MISSED · OVERDUE",
    icon: "warning",
    badgeBg: "rgba(255,255,255,0.9)",
    badgeText: colors.primaryDark,
    ctaLabel: "Pay Now",
    ctaBg: "#fff",
    ctaText: colors.primaryDark,
  },
  no_lease: {
    label: "NO ACTIVE LEASE",
    icon: "information-circle",
    badgeBg: "rgba(255,255,255,0.18)",
    badgeText: "#fff",
    ctaLabel: "Message Landlord",
    ctaBg: "rgba(255,255,255,0.18)",
    ctaText: "#fff",
  },
};

export interface PaymentStatusCardProps {
  unitLabel: string;
  hasLease: boolean;
  amountDue: number;
  dueDate: string | null;
  hasPendingSubmission: boolean;
  onPayNow: () => void;
  onViewDetails: () => void;
  onMessage: () => void;
}

export function PaymentStatusCard({
  unitLabel,
  hasLease,
  amountDue,
  dueDate,
  hasPendingSubmission,
  onPayNow,
  onViewDetails,
  onMessage,
}: PaymentStatusCardProps) {
  const today = new Date(new Date().toDateString());
  const isPastDue = dueDate ? new Date(dueDate) < today : false;
  const daysUntilDue = dueDate ? Math.round((new Date(dueDate).getTime() - today.getTime()) / 86400000) : null;

  let status: CardStatus;
  if (!hasLease) {
    status = "no_lease";
  } else if (amountDue <= 0) {
    status = "paid";
  } else if (hasPendingSubmission) {
    status = "pending_approval";
  } else if (isPastDue) {
    status = "overdue";
  } else {
    status = "due";
  }

  const meta = STATUS_META[status];
  const onCtaPress =
    status === "no_lease" ? onMessage : status === "paid" || status === "pending_approval" ? onViewDetails : onPayNow;

  const gradient: [string, string] =
    status === "no_lease" ? ["#6B7280", "#4B5563"] : status === "overdue" ? [colors.primaryDark, "#12331F"] : [colors.primary, colors.primaryDark];

  return (
    <LinearGradient colors={gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.card}>
      <Ionicons
        name="wallet-outline"
        size={140}
        color="rgba(255,255,255,0.10)"
        style={styles.watermark}
      />
      <View style={styles.topRow}>
        <View style={styles.unitRow}>
          <Ionicons name="business" size={16} color="rgba(255,255,255,0.8)" />
          <Text style={styles.unitLabel}>{unitLabel}</Text>
        </View>
        <View style={[styles.badge, { backgroundColor: meta.badgeBg }]}>
          <Ionicons name={meta.icon} size={12} color={meta.badgeText} />
          <Text style={[styles.badgeText, { color: meta.badgeText }]}>{meta.label}</Text>
        </View>
      </View>

      <View style={styles.divider} />

      {status === "no_lease" ? (
        <>
          <Text style={styles.noLeaseTitle}>No unit assigned yet</Text>
          <Text style={styles.noLeaseText}>
            Your landlord hasn&apos;t linked a unit to your account. Message them if you have questions.
          </Text>
        </>
      ) : (
        <>
          <Text style={styles.amountLabel}>{amountDue <= 0 ? "Balance" : "Amount Due"}</Text>
          <Text style={styles.amount}>{formatCurrency(amountDue)}</Text>

          {dueDate && amountDue > 0 && (
            <View style={styles.dueRow}>
              <Ionicons name="calendar-outline" size={13} color="rgba(255,255,255,0.85)" />
              <Text style={styles.dueText}>
                {status === "overdue" ? "Was due" : "Due"}{" "}
                {new Date(dueDate).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
              </Text>
              {daysUntilDue !== null && (
                <View style={styles.urgencyPill}>
                  <Text style={styles.urgencyPillText}>
                    {daysUntilDue > 0
                      ? `${daysUntilDue}d left`
                      : daysUntilDue === 0
                        ? "Today"
                        : `${Math.abs(daysUntilDue)}d overdue`}
                  </Text>
                </View>
              )}
            </View>
          )}
        </>
      )}

      <Pressable style={[styles.cta, { backgroundColor: meta.ctaBg }]} onPress={onCtaPress}>
        <Text style={[styles.ctaText, { color: meta.ctaText }]}>{meta.ctaLabel}</Text>
        <Ionicons name="arrow-forward" size={16} color={meta.ctaText} />
      </Pressable>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 24,
    padding: 20,
    overflow: "hidden",
    shadowColor: colors.primaryDark,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.28,
    shadowRadius: 20,
    elevation: 6,
  },
  watermark: { position: "absolute", right: -34, top: -38, transform: [{ rotate: "18deg" }] },
  noLeaseTitle: { fontSize: 17, fontWeight: "700", color: "#fff", marginTop: 2 },
  noLeaseText: { fontSize: 13, color: "rgba(255,255,255,0.8)", marginTop: 6, lineHeight: 18 },
  topRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  unitRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  unitLabel: { fontSize: 13, fontWeight: "600", color: "rgba(255,255,255,0.85)" },
  badge: { flexDirection: "row", alignItems: "center", gap: 4, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5 },
  badgeText: { fontSize: 10, fontWeight: "700", letterSpacing: 0.3 },
  divider: { height: 1, backgroundColor: "rgba(255,255,255,0.15)", marginVertical: 16 },
  amountLabel: { fontSize: 12, color: "rgba(255,255,255,0.75)", fontWeight: "500", textTransform: "uppercase", letterSpacing: 0.5 },
  amount: { fontSize: 34, fontWeight: "800", color: "#fff", marginTop: 4, letterSpacing: -0.5 },
  dueRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 8 },
  urgencyPill: {
    backgroundColor: "rgba(255,255,255,0.16)",
    borderRadius: 10,
    paddingHorizontal: 7,
    paddingVertical: 2,
    marginLeft: 2,
  },
  urgencyPillText: { fontSize: 10, fontWeight: "700", color: "#fff" },
  dueText: { fontSize: 13, color: "rgba(255,255,255,0.85)", fontWeight: "500" },
  cta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 2,
    gap: 8,
    borderRadius: 14,
    paddingVertical: 14,
    marginTop: 18,
  },
  ctaText: { fontWeight: "700", fontSize: 15 },
});
