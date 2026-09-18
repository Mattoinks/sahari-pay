import { useCallback, useEffect, useState } from "react";
import {
  View,
  Pressable,
  StyleSheet,
  ScrollView,
  Image,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { AppHeader } from "../components/AppHeader";
import { QrPreviewModal } from "../components/QrPreviewModal";
import { AppText as Text } from "../components/AppText";
import { AppTextInput as TextInput } from "../components/AppTextInput";
import { formatCurrency, submitPaymentSchema, type PaymentChannel, type PaymentMethod } from "@tenantpay/shared";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/AuthProvider";
import { colors } from "../theme/colors";

const METHODS: { value: PaymentMethod; label: string }[] = [
  { value: "gcash", label: "GCash" },
  { value: "bank_transfer", label: "Bank Transfer" },
  { value: "palawan", label: "Palawan" },
  { value: "other", label: "Other" },
];

export function PayScreen() {
  const { session } = useAuth();
  const [invoiceId, setInvoiceId] = useState<string | null>(null);
  const [totalDue, setTotalDue] = useState(0);
  const [method, setMethod] = useState<PaymentMethod>("gcash");
  const [reference, setReference] = useState("");
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [channels, setChannels] = useState<Record<string, PaymentChannel>>({});
  const [showQrPreview, setShowQrPreview] = useState(false);

  useFocusEffect(
    useCallback(() => {
      supabase
        .from("payment_channels")
        .select("*")
        .then(({ data }) => {
          const byMethod: Record<string, PaymentChannel> = {};
          for (const channel of data ?? []) byMethod[channel.method] = channel;
          setChannels(byMethod);
        });
    }, [])
  );

  useEffect(() => {
    async function loadOpenInvoice() {
      if (!session?.user.id) return;
      const { data: lease } = await supabase
        .from("leases")
        .select("id")
        .eq("tenant_id", session.user.id)
        .eq("status", "active")
        .maybeSingle();
      if (!lease) return;

      const { data: invoice } = await supabase
        .from("invoices")
        .select("id, total_amount, amount_paid")
        .eq("lease_id", lease.id)
        .in("status", ["pending", "partially_paid", "overdue"])
        .order("due_date", { ascending: true })
        .limit(1)
        .maybeSingle();

      if (invoice) {
        const balance = Number(invoice.total_amount) - Number(invoice.amount_paid);
        setInvoiceId(invoice.id);
        setTotalDue(balance);
      }
    }
    loadOpenInvoice();
  }, [session?.user.id]);

  async function pickImage() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.7,
    });
    if (!result.canceled) {
      setImageUri(result.assets[0].uri);
    }
  }

  async function handleSubmit() {
    if (!session?.user.id || !invoiceId) {
      Alert.alert("No open invoice", "There is nothing to pay right now.");
      return;
    }

    const parsed = submitPaymentSchema.safeParse({
      invoice_id: invoiceId,
      amount: totalDue,
      payment_method: method,
      reference_number: method === "other" || method === "palawan" ? reference : undefined,
    });

    if (!parsed.success) {
      Alert.alert("Check your input", parsed.error.issues[0]?.message ?? "Invalid form");
      return;
    }

    setSubmitting(true);
    try {
      let proofPath: string | null = null;

      if (imageUri) {
        const response = await fetch(imageUri);
        const blob = await response.arrayBuffer();
        proofPath = `${session.user.id}/${Date.now()}.jpg`;
        const { error: uploadError } = await supabase.storage
          .from("payment-proofs")
          .upload(proofPath, blob, { contentType: "image/jpeg" });
        if (uploadError) throw uploadError;
      }

      const { error: insertError } = await supabase.from("transactions").insert({
        invoice_id: invoiceId,
        tenant_id: session.user.id,
        amount: parsed.data.amount,
        payment_method: method,
        reference_number: parsed.data.reference_number ?? null,
        proof_url: proofPath,
      });
      if (insertError) throw insertError;

      Alert.alert("Submitted", "Your payment is now pending verification.");
      setReference("");
      setImageUri(null);
    } catch (err) {
      Alert.alert("Submission failed", err instanceof Error ? err.message : "Unknown error");
    } finally {
      setSubmitting(false);
    }
  }

  const selectedChannel = channels[method];
  const qrUrl = selectedChannel?.qr_image_path
    ? supabase.storage.from("payment-qr").getPublicUrl(selectedChannel.qr_image_path).data.publicUrl
    : null;
  const hasChannelDetails =
    selectedChannel && (qrUrl || selectedChannel.account_name || selectedChannel.account_number || selectedChannel.instructions);

  return (
    <View style={styles.screen}>
      <AppHeader title="Payments" />
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Payment Summary</Text>

        <View style={styles.totalDueBox}>
          <Text style={styles.totalDueLabel}>Total Due</Text>
          <Text style={styles.totalDueAmount}>{formatCurrency(totalDue)}</Text>
        </View>

        <Text style={styles.label}>Payment method</Text>
        <View style={styles.methodRow}>
          {METHODS.map((m) => (
            <Pressable
              key={m.value}
              style={[styles.methodChip, method === m.value && styles.methodChipActive]}
              onPress={() => setMethod(m.value)}
            >
              <Text style={method === m.value ? styles.methodTextActive : styles.methodText}>{m.label}</Text>
            </Pressable>
          ))}
        </View>

        {hasChannelDetails && (
          <View style={styles.channelBox}>
            {qrUrl && (
              <Pressable style={styles.channelQrCard} onPress={() => setShowQrPreview(true)}>
                <View style={styles.channelQrWrap}>
                  <Image source={{ uri: qrUrl }} style={styles.channelQr} resizeMode="contain" />
                  <View style={styles.channelQrExpandBadge}>
                    <Ionicons name="expand-outline" size={16} color="#fff" />
                  </View>
                </View>
              </Pressable>
            )}

            {(selectedChannel?.account_name || selectedChannel?.account_number) && (
              <View style={styles.channelInfoCard}>
                {selectedChannel?.account_name && (
                  <View style={styles.channelInfoRow}>
                    <Ionicons name="person-outline" size={16} color={colors.primary} />
                    <Text style={styles.channelInfoLabel}>{method === "palawan" ? "Recipient" : "Account name"}</Text>
                    <Text style={styles.channelInfoValue}>{selectedChannel.account_name}</Text>
                  </View>
                )}
                {selectedChannel?.account_name && selectedChannel?.account_number && <View style={styles.channelInfoDivider} />}
                {selectedChannel?.account_number && (
                  <View style={styles.channelInfoRow}>
                    <Ionicons name={method === "palawan" ? "call-outline" : "card-outline"} size={16} color={colors.primary} />
                    <Text style={styles.channelInfoLabel}>{method === "palawan" ? "Contact" : "Account number"}</Text>
                    <Text style={styles.channelInfoValue}>{selectedChannel.account_number}</Text>
                  </View>
                )}
              </View>
            )}

            {selectedChannel?.instructions && (
              <View style={styles.channelInstructionsBox}>
                <Ionicons name="information-circle-outline" size={14} color={colors.textMuted} />
                <Text style={styles.channelInstructions}>{selectedChannel.instructions}</Text>
              </View>
            )}
          </View>
        )}

        <Text style={styles.label}>Amount to pay</Text>
        <View style={styles.readonlyInput}>
          <Text style={styles.readonlyInputText}>{formatCurrency(totalDue)}</Text>
        </View>

        {(method === "other" || method === "palawan") && (
          <>
            <Text style={styles.label}>{method === "palawan" ? "Transaction code" : "Payment method name"}</Text>
            <TextInput
              style={styles.input}
              value={reference}
              onChangeText={setReference}
              placeholder={method === "palawan" ? "13-digit code from your Palawan receipt" : "e.g. Cash, PayMaya, Check"}
            />
          </>
        )}

        <Text style={styles.label}>Proof of payment</Text>
        <Pressable style={styles.imagePicker} onPress={pickImage}>
          {imageUri ? (
            <Image source={{ uri: imageUri }} style={styles.previewImage} />
          ) : (
            <Text style={styles.methodText}>Tap to upload a screenshot</Text>
          )}
        </Pressable>
        <View style={styles.proofNote}>
          <Ionicons name="alert-circle-outline" size={14} color={colors.warning} />
          <Text style={styles.proofNoteText}>Make sure the reference number is clearly visible in the screenshot.</Text>
        </View>

        <Pressable style={styles.submitButton} onPress={handleSubmit} disabled={submitting}>
          {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitText}>Confirm Payment</Text>}
        </Pressable>
      </View>
      </ScrollView>
      {qrUrl && (
        <QrPreviewModal
          visible={showQrPreview}
          qrUrl={qrUrl}
          title={selectedChannel?.display_name ?? "QR Code"}
          onClose={() => setShowQrPreview(false)}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  container: { flex: 1, padding: 16, backgroundColor: colors.background },
  card: { backgroundColor: "#fff", borderRadius: 16, padding: 18, borderWidth: 1, borderColor: colors.border, marginBottom: 40 },
  cardTitle: { fontWeight: "700", fontSize: 17, color: colors.text, marginBottom: 14 },
  totalDueBox: { backgroundColor: "#F4F7F4", borderRadius: 12, padding: 16, alignItems: "center", marginBottom: 16 },
  totalDueLabel: { color: colors.textMuted, fontSize: 13 },
  totalDueAmount: { color: colors.text, fontSize: 26, fontWeight: "700", marginTop: 4 },
  label: { fontWeight: "500", marginTop: 12, marginBottom: 6, color: colors.text },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: 12 },
  readonlyInput: { borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: 12, backgroundColor: "#F4F7F4" },
  readonlyInputText: { color: colors.text, fontWeight: "700" },
  methodRow: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  methodChip: { borderWidth: 1, borderColor: colors.border, borderRadius: 20, paddingVertical: 6, paddingHorizontal: 14 },
  methodChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  methodText: { color: colors.textMuted },
  methodTextActive: { color: "#fff" },
  channelBox: {
    marginTop: 14,
    padding: 12,
    borderRadius: 16,
    backgroundColor: "#F4F7F4",
    borderWidth: 1,
    borderColor: colors.border,
    gap: 10,
  },
  channelQrCard: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 3,
  },
  channelQrWrap: { width: "100%", aspectRatio: 1 },
  channelQr: { width: "100%", height: "100%" },
  channelQrExpandBadge: {
    position: "absolute",
    bottom: 8,
    right: 8,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center",
    justifyContent: "center",
  },
  channelInfoCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    paddingHorizontal: 14,
  },
  channelInfoRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 10 },
  channelInfoLabel: { fontSize: 12, color: colors.textMuted, width: 100 },
  channelInfoValue: { flex: 1, fontSize: 14, fontWeight: "700", color: colors.text },
  channelInfoDivider: { height: 1, backgroundColor: "#f0f0f0" },
  channelInstructionsBox: { flexDirection: "row", alignItems: "flex-start", gap: 6, paddingHorizontal: 2 },
  channelInstructions: { flex: 1, fontSize: 12, color: colors.textMuted, lineHeight: 17 },
  imagePicker: {
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: "dashed",
    borderRadius: 8,
    height: 160,
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
  },
  previewImage: { width: "100%", height: "100%" },
  proofNote: { flexDirection: "row", alignItems: "flex-start", gap: 6, marginTop: 8 },
  proofNoteText: { flex: 1, fontSize: 12, color: colors.warning, lineHeight: 16 },
  submitButton: { backgroundColor: colors.primary, borderRadius: 8, padding: 14, alignItems: "center", marginTop: 24 },
  submitText: { color: "#fff", fontWeight: "600" },
});
