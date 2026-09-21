import { useRouter } from "expo-router";
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

// Two steps on one screen, same pattern as sign-up -> confirm.tsx but
// without a route change in between: step 1 collects the email and sends
// the reset code (auth.forgotPassword), step 2 collects that code plus a
// new password and confirms it (auth.confirmForgotPassword). Kept as one
// screen rather than two routes since there's no intermediate state
// (like an unconfirmed account) worth bookmarking/deep-linking to.
export default function ForgotPasswordScreen() {
  const scheme = useColorScheme();
  const c = resolveTheme(scheme);
  const router = useRouter();
  const { forgotPassword, confirmForgotPassword } = useAuth();

  const [step, setStep] = useState<"request" | "confirm">("request");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleRequestCode() {
    setSubmitting(true);
    try {
      await forgotPassword(email.trim());
      setStep("confirm");
    } catch (err: any) {
      const message =
        err?.underlyingError?.message ??
        (err instanceof Error ? err.message : "Unknown error");
      Alert.alert("Couldn't send code", message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleResetPassword() {
    setSubmitting(true);
    try {
      await confirmForgotPassword(email.trim(), code.trim(), newPassword);
      Alert.alert("Password reset", "Your password has been changed — sign in with it now.");
      router.replace("/(auth)/sign-in");
    } catch (err: any) {
      const message =
        err?.underlyingError?.message ??
        (err instanceof Error ? err.message : "Unknown error");
      Alert.alert("Couldn't reset password", message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleResend() {
    try {
      await forgotPassword(email.trim());
      Alert.alert("Code sent", `A new code was sent to ${email}.`);
    } catch (err) {
      Alert.alert("Couldn't resend", err instanceof Error ? err.message : "Unknown error");
    }
  }

  return (
    <View style={[styles.container, { backgroundColor: c.background }]}>
      {step === "request" ? (
        <>
          <Text style={[styles.title, { color: c.text }]}>Reset your password</Text>
          <Text style={[styles.subtitle, { color: c.textMuted }]}>
            Enter your account email and we'll send you a reset code.
          </Text>

          {USE_MOCK_API ? (
            <Text style={[styles.mockNote, { color: c.accent, borderColor: c.accent }]}>
              Mock mode — the code will be 123456.
            </Text>
          ) : null}

          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder="Email"
            placeholderTextColor={c.textMuted}
            autoCapitalize="none"
            keyboardType="email-address"
            style={[styles.input, { borderColor: c.border, color: c.text, backgroundColor: c.surface }]}
          />

          <Pressable
            onPress={handleRequestCode}
            disabled={submitting || !email}
            style={[styles.button, { backgroundColor: c.accent, opacity: submitting || !email ? 0.5 : 1 }]}
          >
            <Text style={[styles.buttonText, { color: c.accentText }]}>
              {submitting ? "Sending…" : "Send reset code"}
            </Text>
          </Pressable>
        </>
      ) : (
        <>
          <Text style={[styles.title, { color: c.text }]}>Check your email</Text>
          <Text style={[styles.subtitle, { color: c.textMuted }]}>
            Enter the code we sent to {email} and choose a new password.
          </Text>

          {USE_MOCK_API ? (
            <Text style={[styles.mockNote, { color: c.accent, borderColor: c.accent }]}>
              Mock mode — the code is 123456.
            </Text>
          ) : null}

          <TextInput
            value={code}
            onChangeText={setCode}
            placeholder="Reset code"
            placeholderTextColor={c.textMuted}
            keyboardType="number-pad"
            style={[styles.input, { borderColor: c.border, color: c.text, backgroundColor: c.surface }]}
          />
          <TextInput
            value={newPassword}
            onChangeText={setNewPassword}
            placeholder="New password"
            placeholderTextColor={c.textMuted}
            secureTextEntry
            style={[styles.input, { borderColor: c.border, color: c.text, backgroundColor: c.surface }]}
          />

          <Pressable
            onPress={handleResetPassword}
            disabled={submitting || !code || !newPassword}
            style={[
              styles.button,
              { backgroundColor: c.accent, opacity: submitting || !code || !newPassword ? 0.5 : 1 },
            ]}
          >
            <Text style={[styles.buttonText, { color: c.accentText }]}>
              {submitting ? "Resetting…" : "Reset password"}
            </Text>
          </Pressable>

          <Pressable onPress={handleResend} style={styles.linkRow}>
            <Text style={{ color: c.textMuted }}>
              Didn't get it? <Text style={{ color: c.accent, fontWeight: "600" }}>Resend code</Text>
            </Text>
          </Pressable>
        </>
      )}

      <Pressable onPress={() => router.replace("/(auth)/sign-in")} style={styles.linkRow}>
        <Text style={{ color: c.textMuted }}>Back to sign in</Text>
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
