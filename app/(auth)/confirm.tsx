import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import {
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  useColorScheme,
} from "react-native";
import { useAuth } from "../../lib/auth-context";
import { USE_MOCK_API } from "../../lib/config";
import { radius, resolveTheme, spacing } from "../../lib/theme";

export default function ConfirmScreen() {
  const scheme = useColorScheme();
  const c = resolveTheme(scheme);
  const router = useRouter();
  const { confirmSignUp, resendCode } = useAuth();
  const { email: emailParam } = useLocalSearchParams<{ email: string }>();
  const email = emailParam ?? "";

  const [code, setCode] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleConfirm() {
    setSubmitting(true);
    try {
      await confirmSignUp(email, code.trim());
      Alert.alert("Confirmed", "Your account is verified — sign in to continue.");
      router.replace("/(auth)/sign-in");
    } catch (err) {
      Alert.alert("Couldn't confirm", err instanceof Error ? err.message : "Unknown error");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleResend() {
    try {
      await resendCode(email);
      Alert.alert("Code sent", `A new code was sent to ${email}.`);
    } catch (err) {
      Alert.alert("Couldn't resend", err instanceof Error ? err.message : "Unknown error");
    }
  }

  return (
    <View style={[styles.container, { backgroundColor: c.background }]}>
      <Text style={[styles.title, { color: c.text }]}>Check your email</Text>
      <Text style={[styles.subtitle, { color: c.textMuted }]}>
        Enter the code we sent to {email || "your email"}
      </Text>

      {USE_MOCK_API ? (
        <Text style={[styles.mockNote, { color: c.accent, borderColor: c.accent }]}>
          Mock mode — the code is 123456.
        </Text>
      ) : null}

      <TextInput
        value={code}
        onChangeText={setCode}
        placeholder="Confirmation code"
        placeholderTextColor={c.textMuted}
        keyboardType="number-pad"
        style={[styles.input, { borderColor: c.border, color: c.text, backgroundColor: c.surface }]}
      />

      <Pressable
        onPress={handleConfirm}
        disabled={submitting || !code}
        style={[styles.button, { backgroundColor: c.accent, opacity: submitting || !code ? 0.5 : 1 }]}
      >
        <Text style={[styles.buttonText, { color: c.accentText }]}>
          {submitting ? "Confirming…" : "Confirm"}
        </Text>
      </Pressable>

      <Pressable onPress={handleResend} style={styles.linkRow}>
        <Text style={{ color: c.textMuted }}>
          Didn't get it? <Text style={{ color: c.accent, fontWeight: "600" }}>Resend code</Text>
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: spacing.lg, justifyContent: "center" },
  title: { fontSize: 24, fontWeight: "700", fontFamily: "Outfit_700Bold", textAlign: "center" },
  subtitle: {
    fontSize: 14,
    textAlign: "center",
    marginTop: spacing.xs,
    marginBottom: spacing.lg,
  },
  mockNote: {
    fontSize: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.sm,
    padding: spacing.sm,
    marginBottom: spacing.lg,
    textAlign: "center",
  },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    padding: spacing.sm + 4,
    fontSize: 15,
    marginBottom: spacing.sm,
  },
  button: {
    borderRadius: radius.md,
    paddingVertical: spacing.sm + 6,
    alignItems: "center",
    marginTop: spacing.sm,
  },
  buttonText: { fontWeight: "600", fontSize: 15 },
  linkRow: { marginTop: spacing.lg, alignItems: "center" },
});
