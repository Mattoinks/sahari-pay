import { useCallback, useEffect, useRef, useState } from "react";
import { View, StyleSheet, ScrollView, Pressable, Modal } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { AppText as Text } from "./AppText";
import type { AppNotification } from "@tenantpay/shared";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/AuthProvider";
import { colors } from "../theme/colors";

export function NotificationsDropdown({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { session } = useAuth();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  // AppHeader (and this dropdown along with it) is mounted on every tab screen, and React
  // Navigation keeps visited tabs mounted rather than unmounting them — so multiple instances
  // can be alive at once. Each needs its own realtime channel topic or they collide.
  const instanceId = useRef(Math.random().toString(36).slice(2)).current;

  const load = useCallback(async () => {
    if (!session?.user.id) return;
    const { data } = await supabase
      .from("notifications")
      .select("*")
      .eq("recipient_id", session.user.id)
      .order("created_at", { ascending: false })
      .limit(20);
    setNotifications(data ?? []);
  }, [session?.user.id]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  useEffect(() => {
    if (!session?.user.id) return;
    const channel = supabase
      .channel(`notifications-dropdown-${session.user.id}-${instanceId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `recipient_id=eq.${session.user.id}` },
        (payload) => {
          setNotifications((prev) => [payload.new as AppNotification, ...prev]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [session?.user.id]);

  async function markRead(id: string) {
    await supabase.from("notifications").update({ read: true }).eq("id", id);
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.panel}>
          <View style={styles.panelHeader}>
            <Text style={styles.panelTitle}>Notifications</Text>
            <Pressable onPress={onClose} hitSlop={8}>
              <Text style={styles.closeText}>Close</Text>
            </Pressable>
          </View>
          <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
            {notifications.map((item) => (
              <Pressable
                key={item.id}
                style={[styles.row, !item.read && styles.unread]}
                onPress={() => markRead(item.id)}
              >
                <Text style={styles.title}>{item.title}</Text>
                <Text style={styles.body} numberOfLines={2}>
                  {item.body}
                </Text>
                <Text style={styles.date}>{new Date(item.created_at).toLocaleString()}</Text>
              </Pressable>
            ))}
            {notifications.length === 0 && <Text style={styles.empty}>You&apos;re all caught up.</Text>}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.25)" },
  panel: {
    position: "absolute",
    top: 70,
    right: 16,
    width: 300,
    maxHeight: 420,
    backgroundColor: "#fff",
    borderRadius: 16,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 10,
  },
  panelHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  panelTitle: { fontWeight: "700", fontSize: 15, color: colors.text },
  closeText: { color: colors.primary, fontWeight: "600", fontSize: 13 },
  list: { paddingHorizontal: 14 },
  row: { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "#f2f2f2" },
  unread: { backgroundColor: colors.accentSoft, marginHorizontal: -14, paddingHorizontal: 14 },
  title: { fontWeight: "600", color: colors.text, fontSize: 13 },
  body: { color: colors.textMuted, marginTop: 2, fontSize: 12 },
  date: { color: "#999", fontSize: 11, marginTop: 4 },
  empty: { textAlign: "center", color: "#999", paddingVertical: 24, fontSize: 13 },
});
