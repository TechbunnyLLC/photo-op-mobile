import { Link, useRouter } from "expo-router";
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
import { radius, resolveTheme, spacing } from "../../lib/theme";

export default function SignUpScreen() {
  const scheme = useColorScheme();
  const c = resolveTheme(scheme);
  const router = useRouter();
  const { signUp } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSignUp() {
    if (password.length < 8) {
      Alert.alert("Password too short", "The backend requires at least 8 characters.");
      return;
    }

    setSubmitting(true);
    try {
      await signUp(email.trim(), password);
      router.push({ pathname: "/(auth)/confirm", params: { email: email.trim() } });
    } catch (err) {
      Alert.alert("Couldn't sign up", err instanceof Error ? err.message : "Unknown error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <View style={[styles.container, { backgroundColor: c.background }]}>
      <Text style={[styles.title, { color: c.text }]}>Create your account</Text>
      <Text style={[styles.subtitle, { color: c.textMuted }]}>
        Join Photo-OP to capture and share the moment
      </Text>

      <TextInput
        value={email}
        onChangeText={setEmail}
        placeholder="Email"
        placeholderTextColor={c.textMuted}
        autoCapitalize="none"
        keyboardType="email-address"
        style={[styles.input, { borderColor: c.border, color: c.text, backgroundColor: c.surface }]}
      />
      <TextInput
        value={password}
        onChangeText={setPassword}
        placeholder="Password (min 8 characters)"
        placeholderTextColor={c.textMuted}
        secureTextEntry
        style={[styles.input, { borderColor: c.border, color: c.text, backgroundColor: c.surface }]}
      />

      <Pressable
        onPress={handleSignUp}
        disabled={submitting || !email || !password}
        style={[
          styles.button,
          { backgroundColor: c.accent, opacity: submitting || !email || !password ? 0.5 : 1 },
        ]}
      >
        <Text style={[styles.buttonText, { color: c.accentText }]}>
          {submitting ? "Creating account…" : "Sign up"}
        </Text>
      </Pressable>

      <Link href="/(auth)/sign-in" asChild>
        <Pressable style={styles.linkRow}>
          <Text style={{ color: c.textMuted }}>
            Already have an account? <Text style={{ color: c.accent, fontWeight: "600" }}>Sign in</Text>
          </Text>
        </Pressable>
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: spacing.lg, justifyContent: "center" },
  title: { fontSize: 24, fontWeight: "700", textAlign: "center" },
  subtitle: {
    fontSize: 14,
    textAlign: "center",
    marginTop: spacing.xs,
    marginBottom: spacing.lg,
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
