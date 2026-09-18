import { useCallback, useState } from "react";
import {
  View,
  Pressable,
  StyleSheet,
  ScrollView,
  Image,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { AppHeader } from "../components/AppHeader";
import { AppText as Text } from "../components/AppText";
import { AppTextInput as TextInput } from "../components/AppTextInput";
import * as ImagePicker from "expo-image-picker";
import {
  MAINTENANCE_CATEGORIES,
  maintenanceRequestSchema,
  maintenanceStatusLabel,
  maintenanceStatusTone,
  type MaintenanceRequest,
} from "@tenantpay/shared";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/AuthProvider";
import { colors } from "../theme/colors";

const TONE_COLORS: Record<"success" | "warning" | "danger" | "neutral", { bg: string; text: string }> = {
  success: { bg: colors.accentSoft, text: colors.primaryDark },
  warning: { bg: "#FEF3C7", text: colors.warning },
  danger: { bg: colors.dangerSoft, text: colors.danger },
  neutral: { bg: "#EEEEEE", text: colors.textMuted },
};

const CATEGORY_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  Plumbing: "water-outline",
  Electrical: "flash-outline",
  "Air Conditioning / HVAC": "snow-outline",
  Appliance: "cube-outline",
  Structural: "business-outline",
  "Pest Control": "bug-outline",
  Other: "ellipsis-horizontal-outline",
};

export function MaintenanceScreen() {
  const { session } = useAuth();
  const [leaseId, setLeaseId] = useState<string | null>(null);
  const [category, setCategory] = useState<string>(MAINTENANCE_CATEGORIES[0]);
  const [description, setDescription] = useState("");
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [requests, setRequests] = useState<MaintenanceRequest[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!session?.user.id) return;
    setLoading(true);

    const { data: lease } = await supabase
      .from("leases")
      .select("id")
      .eq("tenant_id", session.user.id)
      .eq("status", "active")
      .maybeSingle();
    setLeaseId(lease?.id ?? null);

    const { data } = await supabase
      .from("maintenance_requests")
      .select("*")
      .eq("tenant_id", session.user.id)
      .order("created_at", { ascending: false });
    setRequests(data ?? []);
    setLoading(false);
  }, [session?.user.id]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  async function pickImage() {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.7 });
    if (!result.canceled) setImageUri(result.assets[0].uri);
  }

  async function handleSubmit() {
    if (!session?.user.id || !leaseId) {
      Alert.alert("No active lease", "A maintenance request needs an active lease on file.");
      return;
    }

    const parsed = maintenanceRequestSchema.safeParse({ lease_id: leaseId, category, description });
    if (!parsed.success) {
      Alert.alert("Check your input", parsed.error.issues[0]?.message ?? "Invalid form");
      return;
    }

    setSubmitting(true);
    try {
      let photoPath: string | null = null;
      if (imageUri) {
        const response = await fetch(imageUri);
        const blob = await response.arrayBuffer();
        photoPath = `${session.user.id}/${Date.now()}.jpg`;
        const { error: uploadError } = await supabase.storage
          .from("maintenance-photos")
          .upload(photoPath, blob, { contentType: "image/jpeg" });
        if (uploadError) throw uploadError;
      }

      const { error } = await supabase.from("maintenance_requests").insert({
        lease_id: leaseId,
        tenant_id: session.user.id,
        category,
        description,
        photo_url: photoPath,
      });
      if (error) throw error;

      Alert.alert("Submitted", "Your maintenance request has been sent to the landlord.");
      setDescription("");
      setImageUri(null);
      load();
    } catch (err) {
      Alert.alert("Submission failed", err instanceof Error ? err.message : "Unknown error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <View style={styles.screen}>
      <AppHeader title="Maintenance" />
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.containerContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
      >
        <View style={styles.card}>
          <View style={styles.cardTitleRow}>
            <View style={styles.cardTitleIconWrap}>
              <Ionicons name="construct-outline" size={16} color={colors.primary} />
            </View>
            <Text style={styles.cardTitle}>Request Details</Text>
          </View>

          <Text style={styles.label}>Issue category</Text>
          <View style={styles.categoryRow}>
            {MAINTENANCE_CATEGORIES.map((c) => (
              <Pressable
                key={c}
                style={[styles.categoryChip, category === c && styles.categoryChipActive]}
                onPress={() => setCategory(c)}
              >
                <Ionicons
                  name={CATEGORY_ICONS[c]}
                  size={14}
                  color={category === c ? "#fff" : colors.textMuted}
                />
                <Text style={category === c ? styles.categoryTextActive : styles.categoryText}>{c}</Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.label}>Description</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={description}
            onChangeText={setDescription}
            placeholder="Describe the issue"
            multiline
            numberOfLines={4}
          />

          <Text style={styles.label}>Attach photo (optional)</Text>
          <Pressable style={styles.imagePicker} onPress={pickImage}>
            {imageUri ? (
              <>
                <Image source={{ uri: imageUri }} style={styles.previewImage} />
                <Pressable onPress={() => setImageUri(null)} style={styles.removePhotoButton} hitSlop={8}>
                  <Ionicons name="close" size={16} color="#fff" />
                </Pressable>
              </>
            ) : (
              <View style={styles.imagePickerPlaceholder}>
                <View style={styles.imagePickerIconWrap}>
                  <Ionicons name="camera-outline" size={22} color={colors.primary} />
                </View>
                <Text style={styles.categoryText}>Tap to attach a photo</Text>
              </View>
            )}
          </Pressable>

          <Pressable onPress={handleSubmit} disabled={submitting} style={[submitting && styles.submitButtonDisabled]}>
            <LinearGradient
              colors={[colors.primary, colors.primaryDark]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.submitButton}
            >
              {submitting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Text style={styles.submitText}>Submit Request</Text>
                  <Ionicons name="arrow-forward" size={16} color="#fff" />
                </>
              )}
            </LinearGradient>
          </Pressable>
        </View>

        <View style={styles.sectionTitleRow}>
          <Text style={styles.sectionTitle}>Past requests</Text>
          {requests.length > 0 && (
            <View style={styles.countBadge}>
              <Text style={styles.countBadgeText}>{requests.length}</Text>
            </View>
          )}
        </View>
        {requests.length > 0 ? (
          <View style={styles.requestsCard}>
            {requests.map((r, i) => {
              const tone = TONE_COLORS[maintenanceStatusTone[r.status]];
              return (
                <View key={r.id} style={[styles.requestRow, i === requests.length - 1 && { borderBottomWidth: 0 }]}>
                  <View style={[styles.requestIconWrap, { backgroundColor: tone.bg }]}>
                    <Ionicons name={CATEGORY_ICONS[r.category] ?? "construct-outline"} size={18} color={tone.text} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.requestCategory}>{r.category}</Text>
                    <Text style={styles.requestDescription} numberOfLines={2}>
                      {r.description}
                    </Text>
                    <Text style={styles.requestDate}>{new Date(r.created_at).toLocaleDateString()}</Text>
                  </View>
                  <View style={[styles.requestStatusBadge, { backgroundColor: tone.bg }]}>
                    <Text style={[styles.requestStatusText, { color: tone.text }]}>{maintenanceStatusLabel[r.status]}</Text>
                  </View>
                </View>
              );
            })}
          </View>
        ) : (
          !loading && (
            <View style={styles.emptyState}>
              <Ionicons name="construct-outline" size={28} color={colors.textMuted} />
              <Text style={styles.categoryText}>No maintenance requests yet.</Text>
            </View>
          )
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  container: { flex: 1 },
  containerContent: { padding: 16, paddingBottom: 40 },
  card: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 18,
    marginBottom: 28,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 14,
    elevation: 2,
  },
  cardTitleRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 16 },
  cardTitleIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.accentSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  cardTitle: { fontWeight: "700", fontSize: 17, color: colors.text, letterSpacing: -0.2 },
  label: { fontWeight: "600", fontSize: 13, marginTop: 14, marginBottom: 7, color: colors.text },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 12, backgroundColor: "#F9FAF9" },
  textArea: { minHeight: 90, textAlignVertical: "top" },
  categoryRow: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  categoryChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 20,
    paddingVertical: 7,
    paddingHorizontal: 12,
  },
  categoryChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  categoryText: { color: colors.textMuted, fontSize: 13, fontWeight: "500" },
  categoryTextActive: { color: "#fff", fontSize: 13, fontWeight: "700" },
  imagePicker: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderStyle: "dashed",
    borderRadius: 14,
    height: 140,
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
    backgroundColor: "#FAFBFA",
  },
  imagePickerPlaceholder: { alignItems: "center", gap: 8 },
  imagePickerIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.accentSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  previewImage: { width: "100%", height: "100%" },
  removePhotoButton: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center",
    justifyContent: "center",
  },
  submitButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 14,
    paddingVertical: 15,
    marginTop: 24,
    shadowColor: colors.primaryDark,
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 3,
  },
  submitButtonDisabled: { opacity: 0.7 },
  submitText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  sectionTitleRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 },
  sectionTitle: { fontWeight: "700", fontSize: 16, color: colors.text, letterSpacing: -0.2 },
  countBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 5,
    backgroundColor: colors.accentSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  countBadgeText: { fontSize: 11, fontWeight: "700", color: colors.primaryDark },
  requestsCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    paddingHorizontal: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 1,
  },
  requestRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  requestIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.accentSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  requestCategory: { fontWeight: "700", color: colors.text, fontSize: 14 },
  requestDescription: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  requestDate: { color: "#999", fontSize: 11, marginTop: 4 },
  requestStatusBadge: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5 },
  requestStatusText: { fontWeight: "700", fontSize: 11 },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 28,
    backgroundColor: "#fff",
    borderRadius: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 1,
  },
});
