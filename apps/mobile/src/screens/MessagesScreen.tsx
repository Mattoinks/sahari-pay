import { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Image,
  Pressable,
  StyleSheet,
  FlatList,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Alert,
  Modal,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import * as ImagePicker from "expo-image-picker";
import { LinearGradient } from "expo-linear-gradient";
import { AppHeader } from "../components/AppHeader";
import { AppText as Text } from "../components/AppText";
import { AppTextInput as TextInput } from "../components/AppTextInput";
import { Ionicons } from "@expo/vector-icons";
import { contactPlatformLabel, type ContactPlatform, type Message } from "@tenantpay/shared";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/AuthProvider";
import { colors } from "../theme/colors";

function dayLabel(dateStr: string) {
  const date = new Date(dateStr);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  if (sameDay(date, today)) return "Today";
  if (sameDay(date, yesterday)) return "Yesterday";
  return date.toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" });
}

interface Landlord {
  name: string;
  propertyName: string | null;
  avatarUrl: string | null;
  contactPlatform: ContactPlatform | null;
  contactHandle: string | null;
  socialLink: string | null;
  phone: string | null;
  email: string | null;
}

export function MessagesScreen() {
  const { session } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [viewerUrl, setViewerUrl] = useState<string | null>(null);
  const [attachmentUrls, setAttachmentUrls] = useState<Record<string, string>>({});
  const [landlord, setLandlord] = useState<Landlord | null>(null);
  const [showLandlordProfile, setShowLandlordProfile] = useState(false);
  const listRef = useRef<FlatList>(null);

  const load = useCallback(async () => {
    if (!session?.user.id) return;
    const { data } = await supabase
      .from("messages")
      .select("*")
      .eq("tenant_id", session.user.id)
      .order("created_at", { ascending: true });
    setMessages(data ?? []);
  }, [session?.user.id]);

  const loadLandlord = useCallback(async () => {
    if (!session?.user.id) return;
    const { data: lease } = await supabase
      .from("leases")
      .select(
        "units(properties(name, profiles(display_name, full_name, avatar_url, contact_platform, contact_handle, social_link, phone, email)))"
      )
      .eq("tenant_id", session.user.id)
      .eq("status", "active")
      .maybeSingle();

    const property = (lease?.units as unknown as { properties: unknown } | null)?.properties as unknown as {
      name: string;
      profiles: {
        display_name: string | null;
        full_name: string | null;
        avatar_url: string | null;
        contact_platform: ContactPlatform | null;
        contact_handle: string | null;
        social_link: string | null;
        phone: string | null;
        email: string | null;
      } | null;
    } | null;

    const owner = property?.profiles;
    if (!owner) {
      setLandlord(null);
      return;
    }

    setLandlord({
      name: owner.display_name || owner.full_name || "Your landlord",
      propertyName: property?.name ?? null,
      avatarUrl: owner.avatar_url
        ? supabase.storage.from("avatars").getPublicUrl(owner.avatar_url).data.publicUrl
        : null,
      contactPlatform: owner.contact_platform,
      contactHandle: owner.contact_handle,
      socialLink: owner.social_link,
      phone: owner.phone,
      email: owner.email,
    });
  }, [session?.user.id]);

  useFocusEffect(
    useCallback(() => {
      load();
      loadLandlord();
    }, [load, loadLandlord])
  );

  useEffect(() => {
    if (!session?.user.id) return;
    const channel = supabase
      .channel(`messages-${session.user.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `tenant_id=eq.${session.user.id}` },
        (payload) => {
          const incoming = payload.new as Message;
          setMessages((prev) => (prev.some((m) => m.id === incoming.id) ? prev : [...prev, incoming]));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [session?.user.id]);

  // attachment_path is a path in the private "message-attachments" bucket — sign it for
  // viewing, once per message (new incoming messages, realtime or otherwise, get picked up too).
  useEffect(() => {
    const missing = messages.filter((m) => m.attachment_path && !attachmentUrls[m.id]);
    if (missing.length === 0) return;
    (async () => {
      const entries = await Promise.all(
        missing.map(async (m) => {
          const { data } = await supabase.storage.from("message-attachments").createSignedUrl(m.attachment_path!, 60 * 60);
          return [m.id, data?.signedUrl ?? null] as const;
        })
      );
      setAttachmentUrls((prev) => {
        const next = { ...prev };
        for (const [id, url] of entries) if (url) next[id] = url;
        return next;
      });
    })();
  }, [messages, attachmentUrls]);

  async function pickImage() {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.7 });
    if (!result.canceled) setImageUri(result.assets[0].uri);
  }

  async function handleSend() {
    const body = draft.trim();
    if ((!body && !imageUri) || !session?.user.id || sending) return;

    setSending(true);
    setDraft("");
    const currentImageUri = imageUri;
    setImageUri(null);

    try {
      let attachmentPath: string | null = null;
      if (currentImageUri) {
        const response = await fetch(currentImageUri);
        const blob = await response.arrayBuffer();
        attachmentPath = `${session.user.id}/${Date.now()}.jpg`;
        const { error: uploadError } = await supabase.storage
          .from("message-attachments")
          .upload(attachmentPath, blob, { contentType: "image/jpeg" });
        if (uploadError) throw uploadError;
      }

      const { data, error } = await supabase
        .from("messages")
        .insert({ tenant_id: session.user.id, sender_id: session.user.id, body, attachment_path: attachmentPath })
        .select()
        .single();
      if (error) throw error;

      if (data) {
        setMessages((prev) => (prev.some((m) => m.id === data.id) ? prev : [...prev, data as Message]));
      }
    } catch (err) {
      Alert.alert("Failed to send", err instanceof Error ? err.message : "Unknown error");
    } finally {
      setSending(false);
    }
  }

  interface ContactRow {
    icon: keyof typeof Ionicons.glyphMap;
    label: string;
    value: string;
    onPress?: () => void;
  }

  // Full detail list for the profile popup — the compact card only shows name/property/call;
  // everything else (chat handle, email, social link, phone) lives in the popup to avoid
  // cluttering the card with redundant pills.
  const fullContactRows: ContactRow[] = [];
  if (landlord?.contactHandle) {
    fullContactRows.push({
      icon: "chatbubble-ellipses-outline",
      label: landlord.contactPlatform ? contactPlatformLabel[landlord.contactPlatform] : "Contact",
      value: landlord.contactHandle,
    });
  }
  if (landlord?.phone) {
    fullContactRows.push({ icon: "call-outline", label: "Phone", value: landlord.phone, onPress: () => Linking.openURL(`tel:${landlord.phone}`) });
  }
  if (landlord?.email) {
    fullContactRows.push({ icon: "mail-outline", label: "Email", value: landlord.email, onPress: () => Linking.openURL(`mailto:${landlord.email}`) });
  }
  if (landlord?.socialLink) {
    fullContactRows.push({ icon: "link-outline", label: "Link", value: landlord.socialLink, onPress: () => Linking.openURL(landlord.socialLink!) });
  }

  return (
    <View style={styles.screen}>
      <AppHeader title="Messages" />
      {landlord && (
        <View style={styles.landlordCard}>
          <Text style={styles.landlordCardLabel}>Landlord</Text>
          <View style={styles.landlordTop}>
            <Pressable style={styles.landlordTopInfo} onPress={() => setShowLandlordProfile(true)}>
              {landlord.avatarUrl ? (
                <Image source={{ uri: landlord.avatarUrl }} style={[styles.landlordAvatar, styles.landlordAvatarRing]} />
              ) : (
                <View style={[styles.landlordAvatar, styles.landlordAvatarRing, styles.landlordAvatarFallback]}>
                  <Text style={styles.landlordAvatarText}>{landlord.name.charAt(0).toUpperCase()}</Text>
                </View>
              )}
              <View style={{ flex: 1 }}>
                <Text style={styles.landlordName}>{landlord.name}</Text>
                {landlord.propertyName && (
                  <View style={styles.landlordPropertyRow}>
                    <Ionicons name="location-outline" size={11} color={colors.primary} />
                    <Text style={styles.landlordProperty}>{landlord.propertyName}</Text>
                  </View>
                )}
              </View>
              <View style={styles.landlordChevronWrap}>
                <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
              </View>
            </Pressable>
            {landlord.phone && (
              <Pressable style={styles.callButton} onPress={() => Linking.openURL(`tel:${landlord.phone}`)}>
                <Ionicons name="call" size={16} color="#fff" />
              </Pressable>
            )}
          </View>
        </View>
      )}
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={90}
      >
      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <View style={styles.emptyIcon}>
              <Ionicons name="chatbubbles-outline" size={28} color={colors.primary} />
            </View>
            <Text style={styles.emptyTitle}>No messages yet</Text>
            <Text style={styles.emptyText}>Message your landlord here — they'll see it right away.</Text>
          </View>
        }
        renderItem={({ item, index }) => {
          const isMine = item.sender_id === session?.user.id;
          const attachmentUrl = item.attachment_path ? attachmentUrls[item.id] : null;
          const prev = messages[index - 1];
          const showDayDivider = !prev || new Date(prev.created_at).toDateString() !== new Date(item.created_at).toDateString();

          const bubbleContent = (
            <>
              {attachmentUrl && (
                <Pressable onPress={() => setViewerUrl(attachmentUrl)}>
                  <Image source={{ uri: attachmentUrl }} style={styles.attachmentImage} />
                </Pressable>
              )}
              {!!item.body && (
                <Text style={[isMine ? styles.bubbleTextMine : styles.bubbleTextTheirs, attachmentUrl && { marginTop: 6 }]}>
                  {item.body}
                </Text>
              )}
            </>
          );

          return (
            <>
              {showDayDivider && (
                <View style={styles.dayDividerRow}>
                  <View style={styles.dayDividerPill}>
                    <Text style={styles.dayDividerText}>{dayLabel(item.created_at)}</Text>
                  </View>
                </View>
              )}
              <View style={[styles.bubbleRow, isMine ? styles.bubbleRowMine : styles.bubbleRowTheirs]}>
                {isMine ? (
                  <LinearGradient
                    colors={[colors.primary, colors.primaryDark]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={[styles.bubble, styles.bubbleMine]}
                  >
                    {bubbleContent}
                  </LinearGradient>
                ) : (
                  <View style={[styles.bubble, styles.bubbleTheirs]}>{bubbleContent}</View>
                )}
                <Text style={styles.timestamp}>
                  {new Date(item.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </Text>
              </View>
            </>
          );
        }}
      />

      {imageUri && (
        <View style={styles.attachmentPreviewRow}>
          <View>
            <Image source={{ uri: imageUri }} style={styles.attachmentPreview} />
            <Pressable onPress={() => setImageUri(null)} style={styles.attachmentPreviewRemove}>
              <Ionicons name="close" size={14} color="#fff" />
            </Pressable>
          </View>
        </View>
      )}

      <View style={styles.inputRow}>
        <Pressable style={styles.attachButton} onPress={pickImage}>
          <Ionicons name="camera-outline" size={22} color={colors.primary} />
        </Pressable>
        <TextInput
          style={styles.input}
          placeholder="Type a message..."
          placeholderTextColor={colors.textMuted}
          value={draft}
          onChangeText={setDraft}
          multiline
        />
        <Pressable
          style={[styles.sendButton, !draft.trim() && !imageUri && styles.sendButtonDisabled]}
          onPress={handleSend}
          disabled={sending || (!draft.trim() && !imageUri)}
        >
          <Ionicons name="send" size={18} color="#fff" />
        </Pressable>
      </View>
      </KeyboardAvoidingView>

      <Modal visible={!!viewerUrl} transparent animationType="fade" onRequestClose={() => setViewerUrl(null)}>
        <Pressable style={styles.viewerBackdrop} onPress={() => setViewerUrl(null)}>
          {viewerUrl && <Image source={{ uri: viewerUrl }} style={styles.viewerImage} resizeMode="contain" />}
        </Pressable>
      </Modal>

      <Modal
        visible={showLandlordProfile}
        transparent
        animationType="slide"
        onRequestClose={() => setShowLandlordProfile(false)}
      >
        <Pressable style={styles.profileModalBackdrop} onPress={() => setShowLandlordProfile(false)}>
          <Pressable style={styles.profileModalSheet} onPress={(e) => e.stopPropagation()}>
            <View style={styles.profileModalHandle} />
            {landlord && (
              <>
                <View style={styles.profileModalHeader}>
                  {landlord.avatarUrl ? (
                    <Image source={{ uri: landlord.avatarUrl }} style={styles.profileModalAvatar} />
                  ) : (
                    <View style={[styles.profileModalAvatar, styles.landlordAvatarFallback]}>
                      <Text style={styles.profileModalAvatarText}>{landlord.name.charAt(0).toUpperCase()}</Text>
                    </View>
                  )}
                  <Text style={styles.profileModalName}>{landlord.name}</Text>
                  {landlord.propertyName && <Text style={styles.profileModalProperty}>{landlord.propertyName}</Text>}
                </View>

                <View style={styles.profileModalDivider} />

                {fullContactRows.length > 0 ? (
                  fullContactRows.map((row) => (
                    <Pressable
                      key={row.label}
                      style={styles.profileModalRow}
                      onPress={row.onPress}
                      disabled={!row.onPress}
                    >
                      <View style={styles.profileModalRowIconWrap}>
                        <Ionicons name={row.icon} size={16} color={colors.primary} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.profileModalRowLabel}>{row.label}</Text>
                        <Text style={styles.profileModalRowValue}>{row.value}</Text>
                      </View>
                      {row.onPress && <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />}
                    </Pressable>
                  ))
                ) : (
                  <Text style={styles.profileModalEmpty}>No contact details on file.</Text>
                )}

                <Pressable style={styles.profileModalClose} onPress={() => setShowLandlordProfile(false)}>
                  <Text style={styles.profileModalCloseText}>Close</Text>
                </Pressable>
              </>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  container: { flex: 1, backgroundColor: colors.background },
  landlordCard: {
    backgroundColor: "#fff",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 2,
  },
  landlordCardLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.primary,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginBottom: 10,
  },
  landlordTop: { flexDirection: "row", alignItems: "center", gap: 12 },
  landlordTopInfo: { flex: 1, flexDirection: "row", alignItems: "center", gap: 12 },
  landlordAvatar: { width: 48, height: 48, borderRadius: 24 },
  landlordAvatarRing: { borderWidth: 2, borderColor: colors.accentSoft },
  landlordAvatarFallback: { backgroundColor: colors.accent, alignItems: "center", justifyContent: "center" },
  landlordAvatarText: { color: "#fff", fontWeight: "700", fontSize: 17 },
  landlordName: { fontWeight: "700", fontSize: 15, color: colors.text },
  landlordPropertyRow: { flexDirection: "row", alignItems: "center", gap: 3, marginTop: 2 },
  landlordProperty: { color: colors.primary, fontSize: 12, fontWeight: "600" },
  landlordChevronWrap: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "#F3F4F2",
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 4,
  },
  callButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 4,
    shadowColor: colors.primaryDark,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 3,
  },
  list: { padding: 16, flexGrow: 1 },
  emptyState: { flex: 1, alignItems: "center", justifyContent: "center", gap: 6, paddingTop: 80, paddingHorizontal: 32 },
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
  emptyText: { color: colors.textMuted, fontSize: 13, textAlign: "center", lineHeight: 18 },
  dayDividerRow: { alignItems: "center", marginVertical: 14 },
  dayDividerPill: { backgroundColor: "#EDEEEC", borderRadius: 12, paddingHorizontal: 12, paddingVertical: 4 },
  dayDividerText: { fontSize: 11, fontWeight: "700", color: colors.textMuted },
  bubbleRow: { marginBottom: 12, maxWidth: "80%" },
  bubbleRowMine: { alignSelf: "flex-end", alignItems: "flex-end" },
  bubbleRowTheirs: { alignSelf: "flex-start", alignItems: "flex-start" },
  bubble: {
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 1,
  },
  bubbleMine: { borderBottomRightRadius: 4 },
  bubbleTheirs: { backgroundColor: "#fff", borderBottomLeftRadius: 4 },
  bubbleTextMine: { color: "#fff", fontSize: 14 },
  bubbleTextTheirs: { color: colors.text, fontSize: 14 },
  attachmentImage: { width: 200, height: 200, borderRadius: 10, backgroundColor: colors.border },
  timestamp: { color: "#999", fontSize: 10, marginTop: 3, marginHorizontal: 4 },
  attachmentPreviewRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingTop: 10,
    backgroundColor: "#fff",
  },
  attachmentPreview: { width: 56, height: 56, borderRadius: 8, backgroundColor: colors.border },
  attachmentPreviewRemove: {
    position: "absolute",
    top: -6,
    right: -6,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.danger,
    alignItems: "center",
    justifyContent: "center",
  },
  attachButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.accentSoft,
  },
  viewerBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.92)", alignItems: "center", justifyContent: "center" },
  viewerImage: { width: "100%", height: "100%" },
  profileModalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  profileModalSheet: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 32,
  },
  profileModalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    alignSelf: "center",
    marginBottom: 16,
  },
  profileModalHeader: { alignItems: "center", marginBottom: 16 },
  profileModalAvatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    marginBottom: 10,
    shadowColor: colors.primaryDark,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 4,
  },
  profileModalAvatarText: { color: "#fff", fontSize: 26, fontWeight: "700" },
  profileModalName: { fontSize: 18, fontWeight: "700", color: colors.text },
  profileModalProperty: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  profileModalDivider: { height: 1, backgroundColor: "#f0f0f0", marginBottom: 8 },
  profileModalRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  profileModalRowIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.accentSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  profileModalRowLabel: { fontSize: 11, color: colors.textMuted },
  profileModalRowValue: { fontSize: 14, fontWeight: "600", color: colors.text, marginTop: 1 },
  profileModalEmpty: { textAlign: "center", color: colors.textMuted, fontSize: 13, paddingVertical: 20 },
  profileModalClose: {
    marginTop: 20,
    alignItems: "center",
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: colors.accentSoft,
  },
  profileModalCloseText: { color: colors.primaryDark, fontWeight: "700", fontSize: 15 },
  inputRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: "#fff",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 4,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    maxHeight: 100,
    fontSize: 14,
    color: colors.text,
    backgroundColor: "#F9FAF9",
  },
  sendButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.primary,
    shadowColor: colors.primaryDark,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 3,
    alignItems: "center",
    justifyContent: "center",
  },
  sendButtonDisabled: { backgroundColor: colors.border },
});
