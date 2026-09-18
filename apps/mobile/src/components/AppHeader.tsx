import { useCallback, useState } from "react";
import { View, Image, Pressable, StyleSheet } from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/AuthProvider";
import { colors } from "../theme/colors";
import { AppText as Text } from "./AppText";
import { NotificationsDropdown } from "./NotificationsDropdown";

// The same green header (camel mark + bell + avatar) on every top-level tab screen — only the
// title text changes to match the current page instead of always saying "Sahari".
export function AppHeader({ title, onBack }: { title: string; onBack?: () => void }) {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { session } = useAuth();
  const [showNotifications, setShowNotifications] = useState(false);
  const [initial, setInitial] = useState("?");
  const [unreadCount, setUnreadCount] = useState(0);

  const loadUnreadCount = useCallback(async () => {
    const userId = session?.user.id;
    if (!userId) return;
    const { count } = await supabase
      .from("notifications")
      .select("*", { count: "exact", head: true })
      .eq("recipient_id", userId)
      .eq("read", false);
    setUnreadCount(count ?? 0);
  }, [session?.user.id]);

  useFocusEffect(
    useCallback(() => {
      const userId = session?.user.id;
      if (!userId) return;
      supabase
        .from("profiles")
        .select("display_name, full_name")
        .eq("id", userId)
        .single()
        .then(({ data }) => {
          const name = (data?.display_name || data?.full_name || "").trim();
          const clean = name && !name.includes("@") ? name : "";
          setInitial(clean ? clean.charAt(0).toUpperCase() : "?");
        });
      loadUnreadCount();
    }, [session?.user.id, loadUnreadCount])
  );

  // The dropdown marks individual notifications as read while it's open — refresh the badge
  // once it closes rather than polling while it's open.
  function handleCloseNotifications() {
    setShowNotifications(false);
    loadUnreadCount();
  }

  return (
    <>
      <LinearGradient
        colors={[colors.primary, colors.primaryDark]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.topBar, { paddingTop: insets.top + 10 }]}
      >
        <View style={styles.watermarkCircle} />
        <View style={styles.watermarkCircleSmall} />
        <View style={styles.topBarLeft}>
          {onBack && (
            <Pressable onPress={onBack} hitSlop={10} style={styles.backButton}>
              <Ionicons name="chevron-back" size={24} color="#fff" />
            </Pressable>
          )}
          <Image source={require("../../assets/camel-header-white.png")} style={styles.topBarLogo} resizeMode="contain" />
          <Text style={styles.topBarTitle}>{title}</Text>
        </View>
        <View style={styles.topBarRight}>
          <Pressable onPress={() => setShowNotifications(true)} hitSlop={10} style={styles.bellButton}>
            <Ionicons name="notifications-outline" size={19} color="#fff" />
            {unreadCount > 0 && (
              <View style={styles.bellBadge}>
                <Text style={styles.bellBadgeText}>{unreadCount > 9 ? "9+" : unreadCount}</Text>
              </View>
            )}
          </Pressable>
          <Pressable onPress={() => navigation.navigate("Profile" as never)} hitSlop={10} style={styles.avatar}>
            <Text style={styles.avatarText}>{initial}</Text>
          </Pressable>
        </View>
      </LinearGradient>
      <NotificationsDropdown visible={showNotifications} onClose={handleCloseNotifications} />
    </>
  );
}

const styles = StyleSheet.create({
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingBottom: 14,
    borderBottomLeftRadius: 26,
    borderBottomRightRadius: 26,
    overflow: "hidden",
    shadowColor: colors.primaryDark,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 14,
    elevation: 6,
  },
  watermarkCircle: {
    position: "absolute",
    top: -50,
    right: -40,
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  watermarkCircleSmall: {
    position: "absolute",
    bottom: -60,
    right: 60,
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: "rgba(255,255,255,0.05)",
  },
  topBarLeft: { flexDirection: "row", alignItems: "center", gap: 8 },
  backButton: { marginRight: -2 },
  topBarLogo: { width: 30, height: 30 },
  topBarTitle: { color: "#fff", fontSize: 24, fontWeight: "700", letterSpacing: -0.3 },
  topBarRight: { flexDirection: "row", alignItems: "center", gap: 12 },
  bellButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "rgba(255,255,255,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  bellBadge: {
    position: "absolute",
    top: -3,
    right: -3,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    paddingHorizontal: 3,
    backgroundColor: colors.terracotta,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: colors.primary,
  },
  bellBadgeText: { color: "#fff", fontSize: 9, fontWeight: "800" },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.5)",
  },
  avatarText: { color: "#fff", fontWeight: "700", fontSize: 12 },
});
