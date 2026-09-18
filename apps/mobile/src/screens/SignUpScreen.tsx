import { useEffect, useRef, useState } from "react";
import {
  View,
  Pressable,
  StyleSheet,
  Image,
  ActivityIndicator,
  ScrollView,
  Modal,
  Platform,
  Animated,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import DateTimePicker from "@react-native-community/datetimepicker";
import * as ImagePicker from "expo-image-picker";
import { useNavigation } from "@react-navigation/native";
import {
  OCCUPANCY_TYPES,
  OCCUPATION_STATUSES,
  occupationStatusLabel,
  SOURCE_OF_INCOME_TYPES,
  sourceOfIncomeLabel,
  GOVERNMENT_ID_TYPES,
  governmentIdTypeLabel,
  type SourceOfIncome,
  type GovernmentIdType,
} from "@tenantpay/shared";
import { supabase } from "../lib/supabase";
import { colors } from "../theme/colors";
import { AppText as Text } from "../components/AppText";
import { AppTextInput as TextInput } from "../components/AppTextInput";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
const BIRTHDATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function useFieldBorder(active: boolean) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(anim, { toValue: active ? 1 : 0, duration: 180, useNativeDriver: false }).start();
  }, [active, anim]);
  return anim.interpolate({ inputRange: [0, 1], outputRange: [colors.border, colors.terracotta] });
}

function SectionCard({
  step,
  title,
  subtitle,
  children,
}: {
  step: number;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.stepBadge}>
          <Text style={styles.stepBadgeText}>{step}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.cardTitle}>{title}</Text>
          {subtitle && <Text style={styles.cardSubtitle}>{subtitle}</Text>}
        </View>
      </View>
      {children}
    </View>
  );
}

function StackedField({
  icon,
  label,
  placeholder,
  value,
  onChangeText,
  rightAccessory,
  ...inputProps
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  placeholder: string;
  value: string;
  onChangeText: (v: string) => void;
  rightAccessory?: React.ReactNode;
} & Partial<React.ComponentProps<typeof TextInput>>) {
  const [focused, setFocused] = useState(false);
  const borderColor = useFieldBorder(focused);

  return (
    <Animated.View style={[styles.fieldRow, { borderColor }]}>
      <Ionicons name={icon} size={20} color={focused ? colors.terracotta : colors.textMuted} style={styles.fieldIcon} />
      <View style={{ flex: 1 }}>
        <Text style={styles.fieldLabel}>{label}</Text>
        <TextInput
          style={styles.fieldInput}
          placeholder={placeholder}
          placeholderTextColor={colors.textMuted}
          value={value}
          onChangeText={onChangeText}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          {...inputProps}
        />
      </View>
      {rightAccessory}
    </Animated.View>
  );
}

function Chip({ label, active, onPress, fill }: { label: string; active: boolean; onPress: () => void; fill?: boolean }) {
  return (
    <Pressable style={[styles.chipBase, fill && styles.chipFill, active ? styles.chipActive : styles.chipInactive]} onPress={onPress}>
      {active && <Ionicons name="checkmark" size={13} color="#fff" style={{ marginRight: 4 }} />}
      <Text numberOfLines={1} style={active ? styles.chipTextActive : styles.chipTextInactive}>
        {label}
      </Text>
    </Pressable>
  );
}

function DropdownField<T extends string>({
  icon,
  label,
  value,
  options,
  labels,
  onSelect,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: T;
  options: readonly T[];
  labels: Record<T, string>;
  onSelect: (value: T) => void;
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(false);
  const borderColor = useFieldBorder(active || open);

  return (
    <>
      <AnimatedPressable
        style={[styles.fieldRow, { borderColor }]}
        onPress={() => setOpen(true)}
        onPressIn={() => setActive(true)}
        onPressOut={() => setActive(false)}
      >
        <Ionicons name={icon} size={20} color={active || open ? colors.terracotta : colors.textMuted} style={styles.fieldIcon} />
        <View style={{ flex: 1 }}>
          <Text style={styles.fieldLabel}>{label}</Text>
          <Text style={styles.fieldInput}>{labels[value]}</Text>
        </View>
        <Ionicons name="chevron-down-outline" size={16} color={colors.textMuted} />
      </AnimatedPressable>

      <Modal visible={open} transparent animationType="slide">
        <Pressable style={styles.modalBackdrop} onPress={() => setOpen(false)}>
          <Pressable style={styles.modalSheet}>
            <Text style={styles.modalTitle}>{label}</Text>
            {options.map((opt) => (
              <Pressable
                key={opt}
                style={styles.optionRow}
                onPress={() => {
                  onSelect(opt);
                  setOpen(false);
                }}
              >
                <Text style={[styles.optionText, opt === value && styles.optionTextActive]}>{labels[opt]}</Text>
                {opt === value && <Ionicons name="checkmark" size={18} color={colors.terracotta} />}
              </Pressable>
            ))}
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

function DateField({ label, value, onPress }: { label: string; value: string; onPress: () => void }) {
  const [active, setActive] = useState(false);
  const borderColor = useFieldBorder(active);

  return (
    <AnimatedPressable
      style={[styles.fieldRow, { borderColor }]}
      onPress={onPress}
      onPressIn={() => setActive(true)}
      onPressOut={() => setActive(false)}
    >
      <Ionicons name="calendar-outline" size={20} color={active ? colors.terracotta : colors.textMuted} style={styles.fieldIcon} />
      <View style={{ flex: 1 }}>
        <Text style={styles.fieldLabel}>{label}</Text>
        <Text style={styles.fieldInput}>{value}</Text>
      </View>
    </AnimatedPressable>
  );
}

export function SignUpScreen() {
  const navigation = useNavigation();

  const [fullName, setFullName] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [birthdate, setBirthdate] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [birthdateInput, setBirthdateInput] = useState("");
  const [occupancyType, setOccupancyType] = useState<string>(OCCUPANCY_TYPES[0]);
  const [numberOfOccupants, setNumberOfOccupants] = useState("");
  const [occupationStatus, setOccupationStatus] = useState<string>(OCCUPATION_STATUSES[0]);
  const [sourceOfIncome, setSourceOfIncome] = useState<SourceOfIncome>(SOURCE_OF_INCOME_TYPES[0]);
  const [sourceOfIncomeOther, setSourceOfIncomeOther] = useState("");
  const [governmentIdType, setGovernmentIdType] = useState<GovernmentIdType>(GOVERNMENT_ID_TYPES[0]);
  const [idImageUri, setIdImageUri] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function pickIdImage() {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.7 });
    if (!result.canceled) setIdImageUri(result.assets[0].uri);
  }

  async function handleSignUp() {
    setError(null);
    if (!fullName.trim()) return setError("Full name is required");
    if (password.length < 6) return setError("Password must be at least 6 characters");
    if (password !== confirmPassword) return setError("Passwords don't match");
    // Landlords standardly require a valid ID during the rental application — collecting it
    // here lets the admin verify identity as part of reviewing the pending account.
    if (!idImageUri) return setError("Please attach a photo of a valid government-issued ID");

    setLoading(true);
    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      // approval_status: "pending" — self-signup gets no admin vetting up front, unlike an
      // admin-sent invite, so the account is held for review (see 0022_tenant_approval.sql)
      // before it can do anything in the app.
      options: { data: { full_name: fullName.trim(), role: "tenant", approval_status: "pending" } },
    });

    if (signUpError) {
      setLoading(false);
      setError(signUpError.message);
      return;
    }

    if (data.user) {
      let idPath: string | null = null;
      if (idImageUri) {
        const response = await fetch(idImageUri);
        const blob = await response.arrayBuffer();
        idPath = `${data.user.id}/id-${Date.now()}.jpg`;
        const { error: idUploadError } = await supabase.storage
          .from("government-ids")
          .upload(idPath, blob, { contentType: "image/jpeg" });
        if (idUploadError) idPath = null;
      }

      await supabase
        .from("profiles")
        .update({
          display_name: displayName.trim() || null,
          birthdate: birthdate ? birthdate.toISOString().slice(0, 10) : null,
          occupancy_type: occupancyType,
          number_of_occupants: Number(numberOfOccupants) || null,
          occupation_status: occupationStatus,
          source_of_income: sourceOfIncome,
          source_of_income_other: sourceOfIncome === "other" ? sourceOfIncomeOther.trim() || null : null,
          government_id_type: governmentIdType,
          government_id_path: idPath,
        })
        .eq("id", data.user.id);
    }

    setLoading(false);
    navigation.navigate("SignUpSuccess" as never);
  }

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <Image source={require("../../assets/SAHARI-CASE.png")} style={styles.logo} resizeMode="contain" />
        <Text style={styles.title}>Create your account</Text>
        <Text style={styles.subtitle}>
          Welcome to the Sahari community. Tell us a bit about yourself and your household.
        </Text>

        <SectionCard step={1} title="Your Journey Begins" subtitle="A little about you">
          <StackedField
            icon="person-outline"
            label="Full Name"
            placeholder="Enter your full name"
            autoComplete="name"
            value={fullName}
            onChangeText={setFullName}
          />

          <StackedField
            icon="happy-outline"
            label="Display Name (optional)"
            placeholder="What should we call you?"
            autoComplete="name"
            value={displayName}
            onChangeText={setDisplayName}
          />

          {Platform.OS === "web" ? (
            // The native scroll-wheel picker below doesn't render in the web preview (it's a
            // real native component, not something react-native-web can fake) — fall back to a
            // plain text field there. Real devices via Expo Go get the actual spinner.
            <StackedField
              icon="calendar-outline"
              label="Date of Birth"
              placeholder="YYYY-MM-DD"
              keyboardType="numbers-and-punctuation"
              value={birthdateInput}
              onChangeText={(text) => {
                setBirthdateInput(text);
                setBirthdate(BIRTHDATE_RE.test(text) ? new Date(text) : null);
              }}
            />
          ) : (
            <>
              <DateField
                label="Date of Birth"
                value={birthdate ? birthdate.toLocaleDateString() : "Tap to select"}
                onPress={() => setShowDatePicker(true)}
              />

              <Modal visible={showDatePicker} transparent animationType="slide">
                <Pressable style={styles.modalBackdrop} onPress={() => setShowDatePicker(false)}>
                  <Pressable style={styles.modalSheet}>
                    <DateTimePicker
                      value={birthdate ?? new Date(2000, 0, 1)}
                      mode="date"
                      display="spinner"
                      maximumDate={new Date()}
                      onChange={(_event, selectedDate) => {
                        if (Platform.OS === "android") setShowDatePicker(false);
                        if (selectedDate) setBirthdate(selectedDate);
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
            </>
          )}
        </SectionCard>

        <SectionCard step={2} title="Your Sahari Household" subtitle="Who's moving in">
          <Text style={styles.fieldLabel}>Occupancy Type</Text>
          <View style={styles.chipRow}>
            {OCCUPANCY_TYPES.map((type) => (
              <Chip
                key={type}
                label={type.split(" / ")[0]}
                active={occupancyType === type}
                onPress={() => setOccupancyType(type)}
                fill
              />
            ))}
          </View>

          <StackedField
            icon="people-outline"
            label="Number of Occupants"
            placeholder="Total number of occupants"
            keyboardType="number-pad"
            value={numberOfOccupants}
            onChangeText={setNumberOfOccupants}
          />
        </SectionCard>

        <SectionCard step={3} title="Employment & Income" subtitle="How you support your stay">
          <Text style={styles.fieldLabel}>Occupation Status</Text>
          <View style={styles.chipRowWrap}>
            {OCCUPATION_STATUSES.map((status) => (
              <Chip
                key={status}
                label={occupationStatusLabel[status]}
                active={occupationStatus === status}
                onPress={() => setOccupationStatus(status)}
              />
            ))}
          </View>

          <DropdownField
            icon="cash-outline"
            label="Source of Income"
            value={sourceOfIncome}
            options={SOURCE_OF_INCOME_TYPES}
            labels={sourceOfIncomeLabel}
            onSelect={setSourceOfIncome}
          />

          {sourceOfIncome === "other" && (
            <StackedField
              icon="create-outline"
              label="Please specify"
              placeholder="Your source of income"
              value={sourceOfIncomeOther}
              onChangeText={setSourceOfIncomeOther}
            />
          )}
        </SectionCard>

        <SectionCard step={4} title="Identity Verification" subtitle="Landlords require a valid government ID for rental applications">
          <DropdownField
            icon="card-outline"
            label="ID Type"
            value={governmentIdType}
            options={GOVERNMENT_ID_TYPES}
            labels={governmentIdTypeLabel}
            onSelect={setGovernmentIdType}
          />

          <Text style={styles.fieldLabel}>Photo of your ID</Text>
          <Pressable style={styles.idPicker} onPress={pickIdImage}>
            {idImageUri ? (
              <Image source={{ uri: idImageUri }} style={styles.idPreviewImage} />
            ) : (
              <View style={styles.idPickerPlaceholder}>
                <Ionicons name="camera-outline" size={24} color={colors.textMuted} />
                <Text style={styles.idPickerText}>Tap to attach a photo of your ID</Text>
              </View>
            )}
          </Pressable>
          <Text style={styles.idPrivacyNote}>
            Only your landlord can view this. Used to verify your identity before approval.
          </Text>
        </SectionCard>

        <SectionCard step={5} title="Account Security" subtitle="Keep it safe">
          <StackedField
            icon="mail-outline"
            label="Email"
            placeholder="Enter your email address"
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
            value={email}
            onChangeText={setEmail}
          />
          <StackedField
            icon="lock-closed-outline"
            label="Password"
            placeholder="At least 6 characters"
            secureTextEntry={!showPassword}
            autoComplete="password-new"
            value={password}
            onChangeText={setPassword}
            rightAccessory={
              <Pressable onPress={() => setShowPassword((v) => !v)} hitSlop={8}>
                <Ionicons name={showPassword ? "eye-off-outline" : "eye-outline"} size={20} color={colors.textMuted} />
              </Pressable>
            }
          />
          <StackedField
            icon="lock-closed-outline"
            label="Confirm Password"
            placeholder="Re-enter password"
            secureTextEntry={!showPassword}
            value={confirmPassword}
            onChangeText={setConfirmPassword}
          />
          {confirmPassword.length > 0 && (
            <View style={styles.matchRow}>
              <Ionicons
                name={password === confirmPassword ? "checkmark-circle" : "close-circle"}
                size={14}
                color={password === confirmPassword ? colors.primary : colors.danger}
              />
              <Text style={[styles.matchText, { color: password === confirmPassword ? colors.primary : colors.danger }]}>
                {password === confirmPassword ? "Passwords match" : "Passwords don't match"}
              </Text>
            </View>
          )}
        </SectionCard>

        {error && (
          <View style={styles.errorRow}>
            <Ionicons name="alert-circle-outline" size={16} color={colors.danger} />
            <Text style={styles.error}>{error}</Text>
          </View>
        )}

        <Pressable onPress={handleSignUp} disabled={loading}>
          <LinearGradient
            colors={[colors.terracotta, colors.terracottaDark]}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={styles.primaryButton}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.primaryButtonText}>Create Account</Text>
            )}
          </LinearGradient>
        </Pressable>

        <Pressable style={styles.footerLink} onPress={() => navigation.navigate("Login" as never)}>
          <Text style={styles.footerText}>
            Already have an account? <Text style={styles.footerTextBold}>Sign in</Text>
          </Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  container: { padding: 20, paddingBottom: 40, gap: 16 },
  logo: { width: 220, height: 220, alignSelf: "center" },
  title: { fontSize: 22, fontWeight: "700", color: colors.text, textAlign: "center" },
  subtitle: { fontSize: 13, color: colors.textMuted, textAlign: "center", marginTop: -8 },
  card: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  cardHeader: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  stepBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.terracotta,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
  },
  stepBadgeText: { color: "#fff", fontSize: 12, fontWeight: "700" },
  cardTitle: { fontSize: 15, fontWeight: "700", color: colors.text },
  cardSubtitle: { fontSize: 12, color: colors.textMuted, marginTop: 1 },
  fieldRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 1.5,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: "#fff",
  },
  fieldIcon: { marginTop: 2 },
  fieldLabel: { fontSize: 13, fontWeight: "700", color: colors.text, marginBottom: 2 },
  fieldInput: { fontSize: 14, color: colors.textMuted, padding: 0 },
  chipRow: { flexDirection: "row", gap: 8, marginTop: -4 },
  // For rows with more options than comfortably fit on one line (occupation status) — chips
  // size to their own text and wrap, instead of the occupancy-type row's fixed 4-across layout.
  chipRowWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: -4 },
  chipBase: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 20,
    borderWidth: 1.5,
    paddingVertical: 9,
    paddingHorizontal: 14,
  },
  chipFill: { flex: 1, paddingHorizontal: 4 },
  chipActive: { backgroundColor: colors.terracotta, borderColor: colors.terracotta },
  chipInactive: { backgroundColor: "#fff", borderColor: colors.border },
  chipTextActive: { color: "#fff", fontSize: 12, fontWeight: "700" },
  chipTextInactive: { color: colors.textMuted, fontSize: 12, fontWeight: "600" },
  matchRow: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: -6 },
  matchText: { fontSize: 12, fontWeight: "600" },
  idPicker: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderStyle: "dashed",
    borderRadius: 14,
    height: 130,
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
    backgroundColor: "#FAFBFA",
  },
  idPickerPlaceholder: { alignItems: "center", gap: 8 },
  idPickerText: { color: colors.textMuted, fontSize: 13 },
  idPreviewImage: { width: "100%", height: "100%" },
  idPrivacyNote: { fontSize: 11, color: colors.textMuted, marginTop: 8, lineHeight: 15 },
  errorRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  error: { color: colors.danger, fontSize: 13 },
  primaryButton: {
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
    padding: 16,
  },
  primaryButtonText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  footerLink: { alignItems: "center" },
  footerText: { color: colors.textMuted, fontSize: 14 },
  footerTextBold: { color: colors.primary, fontWeight: "700" },
  modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  modalSheet: { backgroundColor: "#fff", borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: 20 },
  modalDoneButton: { alignItems: "center", paddingVertical: 12, borderTopWidth: 1, borderTopColor: colors.border },
  modalDoneText: { color: colors.primary, fontWeight: "700", fontSize: 16 },
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
  optionTextActive: { color: colors.terracotta, fontWeight: "700" },
});
