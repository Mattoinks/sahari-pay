import { View, StyleSheet, Pressable } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { colors } from "../theme/colors";
import { AppText as Text } from "../components/AppText";
import { PulsingIcon } from "../components/PulsingIcon";

export function SignUpSuccessScreen() {
  const navigation = useNavigation();

  return (
    <View style={styles.screen}>
      <PulsingIcon icon="checkmark-circle" size={44} />
      <Text style={styles.title}>Account created!</Text>
      <Text style={styles.body}>
        We&apos;ve sent a confirmation link to your email. Confirm it, then sign in — your
        landlord will review your application before you get full access to Sahari.
      </Text>

      <Pressable style={styles.button} onPress={() => navigation.navigate("Login" as never)}>
        <Text style={styles.buttonText}>Back to Sign In</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background, alignItems: "center", justifyContent: "center", padding: 32, gap: 6 },
  title: { fontSize: 20, fontWeight: "700", color: colors.text, textAlign: "center", marginTop: 18 },
  body: { fontSize: 14, color: colors.textMuted, textAlign: "center", lineHeight: 20, marginTop: 2 },
  button: {
    marginTop: 28,
    backgroundColor: colors.primary,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 32,
  },
  buttonText: { color: "#fff", fontWeight: "700", fontSize: 15 },
});
