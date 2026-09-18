import { View, StyleSheet, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { ApprovalStatus } from "@tenantpay/shared";
import { supabase } from "../lib/supabase";
import { colors } from "../theme/colors";
import { AppText as Text } from "../components/AppText";
import { PulsingIcon } from "../components/PulsingIcon";

const COPY: Record<Exclude<ApprovalStatus, "approved">, { icon: keyof typeof Ionicons.glyphMap; title: string; body: string }> = {
  pending: {
    icon: "time-outline",
    title: "Account under review",
    body: "Thanks for signing up! Your property admin needs to review your account before you can start using Sahari. This usually doesn't take long — check back soon.",
  },
  rejected: {
    icon: "close-circle-outline",
    title: "Account not approved",
    body: "Your account request wasn't approved. If you think this is a mistake, please contact your property admin directly.",
  },
};

export function PendingApprovalScreen({ status }: { status: Exclude<ApprovalStatus, "approved"> }) {
  const copy = COPY[status];

  return (
    <View style={styles.screen}>
      {status === "pending" ? (
        <PulsingIcon icon={copy.icon} size={40} />
      ) : (
        <View style={styles.iconWrap}>
          <Ionicons name={copy.icon} size={40} color={colors.danger} />
        </View>
      )}
      <Text style={styles.title}>{copy.title}</Text>
      <Text style={styles.body}>{copy.body}</Text>

      <Pressable style={styles.signOut} onPress={() => supabase.auth.signOut()}>
        <Ionicons name="log-out-outline" size={18} color={colors.danger} />
        <Text style={styles.signOutText}>Sign out</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background, alignItems: "center", justifyContent: "center", padding: 32, gap: 10 },
  iconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.accentSoft,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  title: { fontSize: 19, fontWeight: "700", color: colors.text, textAlign: "center" },
  body: { fontSize: 14, color: colors.textMuted, textAlign: "center", lineHeight: 20, marginTop: 2 },
  signOut: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 28,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
    backgroundColor: colors.dangerSoft,
  },
  signOutText: { color: colors.danger, fontWeight: "700" },
});
