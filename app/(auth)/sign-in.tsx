import { Link, useRouter } from "expo-router";
import { useState } from "react";
import {
  Alert,
  Image,
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

export default function SignInScreen() {
  const scheme = useColorScheme();
  const c = resolveTheme(scheme);
  const router = useRouter();
  const { signIn } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSignIn() {
    setSubmitting(true);
    try {
      await signIn(email.trim(), password);
      router.replace("/(tabs)");
    } catch (err: any) {
      // Amplify wraps some failures in a generic AuthError whose own
      // .message is "An unknown error has occurred." — the real reason
      // lives in .underlyingError instead, so prefer that when present.
      const message =
        err?.underlyingError?.message ??
        (err instanceof Error ? err.message : "Unknown error");
      Alert.alert("Couldn't sign in", message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <View style={[styles.container, { backgroundColor: c.background }]}>
      <Image
        source={require("../../assets/branding/logo-mark.png")}
        style={styles.logo}
        resizeMode="contain"
      />
      <Text style={[styles.title, { color: c.text }]}>Photo-OP</Text>
      <Text style={[styles.subtitle, { color: c.textMuted }]}>Welcome back</Text>

      {USE_MOCK_API ? (
        <Text style={[styles.mockNote, { color: c.accent, borderColor: c.accent }]}>
          Mock mode — sign up first, then sign in with the same email/password.
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
      <TextInput
        value={password}
        onChangeText={setPassword}
        placeholder="Password"
        placeholderTextColor={c.textMuted}
        secureTextEntry
        style={[styles.input, { borderColor: c.border, color: c.text, backgroundColor: c.surface }]}
      />

      <Pressable
        onPress={handleSignIn}
        disabled={submitting || !email || !password}
        style={[
          styles.button,
          { backgroundColor: c.accent, opacity: submitting || !email || !password ? 0.5 : 1 },
        ]}
      >
        <Text style={[styles.buttonText, { color: c.accentText }]}>
          {submitting ? "Signing in…" : "Sign in"}
        </Text>
      </Pressable>

      <Link href="/(auth)/sign-up" asChild>
        <Pressable style={styles.linkRow}>
          <Text style={{ color: c.textMuted }}>
            New here? <Text style={{ color: c.accent, fontWeight: "600" }}>Create an account</Text>
          </Text>
        </Pressable>
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: spacing.lg, justifyContent: "center" },
  logo: { width: 56, height: 63, alignSelf: "center", marginBottom: spacing.sm },
  title: { fontSize: 28, fontWeight: "700", fontFamily: "Outfit_700Bold", textAlign: "center" },
  subtitle: { fontSize: 15, textAlign: "center", marginTop: spacing.xs, marginBottom: spacing.lg },
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
