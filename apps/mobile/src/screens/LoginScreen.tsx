import { useState } from "react";
import { View, Pressable, StyleSheet, Image, ActivityIndicator, Alert } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { supabase } from "../lib/supabase";
import { colors } from "../theme/colors";
import { AppText as Text } from "../components/AppText";
import { AppTextInput as TextInput } from "../components/AppTextInput";

export function LoginScreen() {
  const navigation = useNavigation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sendingReset, setSendingReset] = useState(false);

  async function handleLogin() {
    setLoading(true);
    setError(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setError(error.message);
    setLoading(false);
  }

  async function handleForgotPassword() {
    if (!email.trim()) {
      Alert.alert("Enter your email", "Type your email above first, then tap \"Forgot password?\" again.");
      return;
    }
    setSendingReset(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${process.env.EXPO_PUBLIC_WEB_APP_URL}/reset-password`,
    });
    setSendingReset(false);
    if (error) {
      Alert.alert("Couldn't send reset email", error.message);
      return;
    }
    Alert.alert("Check your email", "We sent a link to reset your password.");
  }

  return (
    <View style={styles.container}>
      <Image source={require("../../assets/tenantpay-logo.png")} style={styles.logo} resizeMode="contain" />

      <View style={styles.inputWrapper}>
        <Ionicons name="mail-outline" size={20} color={colors.textMuted} style={styles.inputIcon} />
        <TextInput
          style={styles.input}
          placeholder="Email"
          placeholderTextColor={colors.textMuted}
          autoCapitalize="none"
          keyboardType="email-address"
          autoComplete="email"
          value={email}
          onChangeText={setEmail}
        />
      </View>

      <View style={styles.inputWrapper}>
        <Ionicons name="lock-closed-outline" size={20} color={colors.textMuted} style={styles.inputIcon} />
        <TextInput
          style={styles.input}
          placeholder="Password"
          placeholderTextColor={colors.textMuted}
          secureTextEntry={!showPassword}
          autoComplete="current-password"
          value={password}
          onChangeText={setPassword}
        />
        <Pressable onPress={() => setShowPassword((v) => !v)} hitSlop={8}>
          <Ionicons name={showPassword ? "eye-off-outline" : "eye-outline"} size={20} color={colors.textMuted} />
        </Pressable>
      </View>

      <Pressable onPress={handleForgotPassword} disabled={sendingReset} style={styles.forgotPassword} hitSlop={8}>
        <Text style={styles.forgotPasswordText}>{sendingReset ? "Sending…" : "Forgot password?"}</Text>
      </Pressable>

      {error && (
        <View style={styles.errorRow}>
          <Ionicons name="alert-circle-outline" size={16} color={colors.danger} />
          <Text style={styles.error}>{error}</Text>
        </View>
      )}

      <Pressable style={styles.button} onPress={handleLogin} disabled={loading}>
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <>
            <Text style={styles.buttonText}>Sign in</Text>
            <Ionicons name="arrow-forward" size={18} color="#fff" />
          </>
        )}
      </Pressable>

      <Pressable style={styles.footerLink} onPress={() => navigation.navigate("SignUp" as never)}>
        <Text style={styles.footerText}>
          Don&apos;t have an account yet? <Text style={styles.footerTextBold}>Sign up</Text>
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", padding: 24, gap: 14, backgroundColor: colors.background },
  logo: { width: "100%", height: 300, alignSelf: "center", marginBottom: 8 },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    backgroundColor: "#fff",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  inputIcon: { marginTop: 1 },
  input: { flex: 1, paddingVertical: 14, fontSize: 15, color: colors.text },
  forgotPassword: { alignSelf: "flex-end", marginTop: -4 },
  forgotPasswordText: { color: colors.primary, fontSize: 13, fontWeight: "600" },
  button: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: colors.primary,
    borderRadius: 10,
    padding: 15,
    marginTop: 8,
    shadowColor: colors.primaryDark,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 3,
  },
  buttonText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  errorRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  error: { color: colors.danger, fontSize: 13 },
  footerLink: { marginTop: 16, alignItems: "center" },
  footerText: { color: colors.textMuted, fontSize: 14 },
  footerTextBold: { color: colors.primary, fontWeight: "700" },
});
