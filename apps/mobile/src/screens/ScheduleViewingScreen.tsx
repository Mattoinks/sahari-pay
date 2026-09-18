import { createElement, useCallback, useState } from "react";
import { View, StyleSheet, Pressable, ScrollView, Modal, Platform, ActivityIndicator, RefreshControl } from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import DateTimePicker from "@react-native-community/datetimepicker";
import {
  viewingPurposeLabel,
  viewingStatusLabel,
  type ViewingPurpose,
  type ViewingRequest,
} from "@tenantpay/shared";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/AuthProvider";
import { colors } from "../theme/colors";
import { AppHeader } from "../components/AppHeader";
import { AppText as Text } from "../components/AppText";
import { AppTextInput as TextInput } from "../components/AppTextInput";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const PURPOSES: ViewingPurpose[] = ["viewing", "lease_signing"];
const PURPOSE_ICONS: Record<ViewingPurpose, keyof typeof Ionicons.glyphMap> = {
  viewing: "home-outline",
  lease_signing: "document-text-outline",
};

// Visiting hours: 12:00 PM – 3:00 PM only, in 30-minute slots.
const TIME_SLOTS = ["12:00", "12:30", "13:00", "13:30", "14:00", "14:30", "15:00"];
function timeSlotLabel(value: string) {
  const [h, m] = value.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${period}`;
}

const STATUS_TONE: Record<string, { bg: string; text: string }> = {
  pending: { bg: "#FEF3C7", text: colors.warning },
  confirmed: { bg: colors.accentSoft, text: colors.primaryDark },
  declined: { bg: colors.dangerSoft, text: colors.danger },
  cancelled: { bg: "#EEEEEE", text: colors.textMuted },
};

export function ScheduleViewingScreen() {
  const { session } = useAuth();
  const navigation = useNavigation();
  const [purpose, setPurpose] = useState<ViewingPurpose>("viewing");
  const [date, setDate] = useState(new Date(Date.now() + 24 * 60 * 60 * 1000));
  const [dateInput, setDateInput] = useState(new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10));
  const [timeSlot, setTimeSlot] = useState(TIME_SLOTS[0]);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimeSheet, setShowTimeSheet] = useState(false);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [requests, setRequests] = useState<ViewingRequest[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!session?.user.id) return;
    setLoading(true);
    const { data } = await supabase
      .from("viewing_requests")
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

  async function handleSubmit() {
    if (!session?.user.id) return;
    setError(null);
    setSubmitting(true);
    try {
      const { error: insertError } = await supabase.from("viewing_requests").insert({
        tenant_id: session.user.id,
        purpose,
        requested_date: date.toISOString().slice(0, 10),
        requested_time: `${timeSlot}:00`,
        notes: notes.trim() || null,
      });
      if (insertError) throw insertError;
      setNotes("");
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit request");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCancel(id: string) {
    await supabase.from("viewing_requests").update({ status: "cancelled" }).eq("id", id);
    load();
  }

  return (
    <View style={styles.screen}>
      <AppHeader title="Book Appointment" onBack={() => navigation.goBack()} />
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.containerContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
      >
        <View style={styles.card}>
          <View style={styles.cardTitleRow}>
            <View style={styles.cardTitleIconWrap}>
              <Ionicons name="calendar-outline" size={16} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>Book an Appointment</Text>
              <Text style={styles.cardSubtitle}>Set up an in-person apartment viewing, or a lease/contract signing.</Text>
            </View>
          </View>

          <Text style={styles.label}>Purpose</Text>
          <View style={styles.chipRow}>
            {PURPOSES.map((p) => (
              <Pressable key={p} style={[styles.chip, purpose === p && styles.chipActive]} onPress={() => setPurpose(p)}>
                <Ionicons name={PURPOSE_ICONS[p]} size={14} color={purpose === p ? "#fff" : colors.textMuted} />
                <Text style={purpose === p ? styles.chipTextActive : styles.chipText}>{viewingPurposeLabel[p]}</Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.label}>Preferred date</Text>
          {Platform.OS === "web" ? (
            // @react-native-community/datetimepicker's native spinner doesn't render at all in
            // the web preview (it's a real native component, not something react-native-web can
            // fake) — use the browser's own native <input type="date"> instead, which still
            // gives a real calendar picker (not manual typing), just the browser's own one.
            // react-native-web renders through ReactDOM, so a raw DOM element works fine here
            // even though <input> isn't a React Native primitive.
            <View style={styles.fieldRow}>
              <View style={styles.fieldIconWrap}>
                <Ionicons name="calendar-outline" size={16} color={colors.primary} />
              </View>
              {createElement("input", {
                type: "date",
                value: dateInput,
                min: new Date().toISOString().slice(0, 10),
                onChange: (e: { target: { value: string } }) => {
                  const text = e.target.value;
                  setDateInput(text);
                  if (DATE_RE.test(text)) setDate(new Date(`${text}T00:00:00`));
                },
                style: {
                  flex: 1,
                  border: "none",
                  outline: "none",
                  background: "transparent",
                  fontSize: 14,
                  fontWeight: 600,
                  color: colors.text,
                  fontFamily: "inherit",
                },
              })}
            </View>
          ) : (
            <Pressable style={styles.fieldRow} onPress={() => setShowDatePicker(true)}>
              <View style={styles.fieldIconWrap}>
                <Ionicons name="calendar-outline" size={16} color={colors.primary} />
              </View>
              <Text style={styles.fieldValue}>
                {date.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", year: "numeric" })}
              </Text>
              <Ionicons name="chevron-down-outline" size={16} color={colors.textMuted} />
            </Pressable>
          )}

          <Text style={styles.label}>Preferred time</Text>
          <Pressable style={styles.fieldRow} onPress={() => setShowTimeSheet(true)}>
            <View style={styles.fieldIconWrap}>
              <Ionicons name="time-outline" size={16} color={colors.primary} />
            </View>
            <Text style={styles.fieldValue}>{timeSlotLabel(timeSlot)}</Text>
            <Ionicons name="chevron-down-outline" size={16} color={colors.textMuted} />
          </Pressable>
          <Text style={styles.hint}>Visiting hours: 12:00 PM – 3:00 PM</Text>

          <Text style={styles.label}>Notes (optional)</Text>
          <TextInput
            style={styles.textArea}
            value={notes}
            onChangeText={setNotes}
            placeholder="Anything the landlord should know"
            multiline
            numberOfLines={3}
          />

          {error && <Text style={styles.error}>{error}</Text>}

          <Pressable onPress={handleSubmit} disabled={submitting} style={[submitting && styles.submitButtonDisabled]}>
            <LinearGradient
              colors={[colors.primary, colors.primaryDark]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.submitButton}
            >
              {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitText}>Request Appointment</Text>}
            </LinearGradient>
          </Pressable>
        </View>

        <Text style={styles.sectionTitle}>Your Requests</Text>
        {requests.length > 0 ? (
          <View style={styles.requestsCard}>
            {requests.map((r, i) => {
              const tone = STATUS_TONE[r.status];
              return (
                <View key={r.id} style={[styles.requestRow, i === requests.length - 1 && { borderBottomWidth: 0 }]}>
                  <View style={styles.requestIconWrap}>
                    <Ionicons name={PURPOSE_ICONS[r.purpose]} size={17} color={colors.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.requestPurpose}>{viewingPurposeLabel[r.purpose]}</Text>
                    <Text style={styles.requestDate}>
                      {new Date(r.requested_date).toLocaleDateString()} · {timeSlotLabel(r.requested_time.slice(0, 5))}
                    </Text>
                    {r.admin_response && <Text style={styles.requestResponse}>&quot;{r.admin_response}&quot;</Text>}
                  </View>
                  <View style={{ alignItems: "flex-end", gap: 6 }}>
                    <View style={[styles.statusBadge, { backgroundColor: tone.bg }]}>
                      <Text style={[styles.statusText, { color: tone.text }]}>{viewingStatusLabel[r.status]}</Text>
                    </View>
                    {r.status === "pending" && (
                      <Pressable onPress={() => handleCancel(r.id)}>
                        <Text style={styles.cancelLink}>Cancel</Text>
                      </Pressable>
                    )}
                  </View>
                </View>
              );
            })}
          </View>
        ) : (
          !loading && (
            <View style={styles.emptyState}>
              <View style={styles.emptyIcon}>
                <Ionicons name="calendar-outline" size={26} color={colors.primary} />
              </View>
              <Text style={styles.emptyText}>No requests yet.</Text>
            </View>
          )
        )}
      </ScrollView>

      {/* Date picker — native spinner sheet. Web uses the plain text field above instead
          (see the comment there), so this modal is only ever opened on iOS/Android. */}
      <Modal visible={showDatePicker} transparent animationType="slide">
        <Pressable style={styles.modalBackdrop} onPress={() => setShowDatePicker(false)}>
          <Pressable style={styles.modalSheet}>
            <Text style={styles.modalTitle}>Preferred date</Text>
            <DateTimePicker
              value={date}
              mode="date"
              display="spinner"
              minimumDate={new Date()}
              onChange={(_e, selectedDate) => {
                if (Platform.OS === "android") setShowDatePicker(false);
                if (selectedDate) setDate(selectedDate);
              }}
            />
            {Platform.OS === "ios" && (
              <Pressable style={styles.modalDoneButton} onPress={() => setShowDatePicker(false)}>
                <Text style={styles.modalDoneText}>Done</Text>
              </Pressable>
            )}
          </Pressable>
        </Pressable>
      </Modal>

      {/* Time — custom dropdown sheet, restricted to visiting hours */}
      <Modal visible={showTimeSheet} transparent animationType="slide">
        <Pressable style={styles.modalBackdrop} onPress={() => setShowTimeSheet(false)}>
          <Pressable style={styles.modalSheet}>
            <Text style={styles.modalTitle}>Preferred time</Text>
            {TIME_SLOTS.map((slot) => (
              <Pressable
                key={slot}
                style={styles.optionRow}
                onPress={() => {
                  setTimeSlot(slot);
                  setShowTimeSheet(false);
                }}
              >
                <Text style={[styles.optionText, slot === timeSlot && styles.optionTextActive]}>{timeSlotLabel(slot)}</Text>
                {slot === timeSlot && <Ionicons name="checkmark" size={18} color={colors.primary} />}
              </Pressable>
            ))}
          </Pressable>
        </Pressable>
      </Modal>
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
  cardTitleRow: { flexDirection: "row", alignItems: "flex-start", gap: 10, marginBottom: 4 },
  cardTitleIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.accentSoft,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
  },
  cardTitle: { fontWeight: "700", fontSize: 17, color: colors.text },
  cardSubtitle: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  label: { fontWeight: "600", fontSize: 13, marginTop: 14, marginBottom: 7, color: colors.text },
  chipRow: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { color: colors.textMuted, fontSize: 13, fontWeight: "600" },
  chipTextActive: { color: "#fff", fontSize: 13, fontWeight: "700" },
  fieldRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: "#F9FAF9",
  },
  fieldIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.accentSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  fieldValue: { flex: 1, fontSize: 14, color: colors.text, fontWeight: "600" },
  hint: { fontSize: 11, color: colors.textMuted, marginTop: 6 },
  textArea: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 12,
    minHeight: 80,
    textAlignVertical: "top",
    backgroundColor: "#F9FAF9",
  },
  error: { color: colors.danger, fontSize: 13, marginTop: 10 },
  submitButton: {
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: "center",
    marginTop: 20,
    shadowColor: colors.primaryDark,
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 3,
  },
  submitButtonDisabled: { opacity: 0.7 },
  submitText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  sectionTitle: { fontWeight: "700", fontSize: 16, color: colors.text, marginBottom: 10 },
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
    alignItems: "flex-start",
    gap: 12,
    paddingVertical: 14,
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
  requestPurpose: { fontWeight: "700", color: colors.text, fontSize: 14 },
  requestDate: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  requestResponse: { color: colors.textMuted, fontSize: 12, marginTop: 4, fontStyle: "italic" },
  statusBadge: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5 },
  statusText: { fontWeight: "700", fontSize: 11 },
  cancelLink: { color: colors.danger, fontSize: 11, fontWeight: "600" },
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
  emptyIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.accentSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyText: { color: colors.textMuted, fontSize: 13 },
  modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  modalSheet: { backgroundColor: "#fff", borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: 20, maxHeight: "70%" },
  modalTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 6,
  },
  modalDoneButton: { alignItems: "center", paddingVertical: 12, borderTopWidth: 1, borderTopColor: colors.border },
  modalDoneText: { color: colors.primary, fontWeight: "700", fontSize: 16 },
  optionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: "#f0f0f0",
  },
  optionText: { fontSize: 15, color: colors.text },
  optionTextActive: { color: colors.primary, fontWeight: "700" },
});
