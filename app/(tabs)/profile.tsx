import { Alert, Pressable, StyleSheet, Text, View, useColorScheme } from "react-native";
import { useAuth } from "../../lib/auth-context";
import { radius, resolveTheme, spacing } from "../../lib/theme";

export default function ProfileScreen() {
  const scheme = useColorScheme();
  const c = resolveTheme(scheme);
  const { user, signOut } = useAuth();

  async function handleSignOut() {
    try {
      await signOut();
    } catch (err) {
      Alert.alert("Couldn't sign out", err instanceof Error ? err.message : "Unknown error");
    }
  }

  const displayName = user?.email.split("@")[0] ?? "you";

  return (
    <View style={[styles.container, { backgroundColor: c.background }]}>
      <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
        <View style={[styles.avatar, { backgroundColor: c.accent }]}>
          <Text style={[styles.avatarText, { color: c.accentText }]}>
            {displayName[0]?.toUpperCase()}
          </Text>
        </View>
        <Text style={[styles.name, { color: c.text }]}>{displayName}</Text>
        <Text style={[styles.email, { color: c.textMuted }]}>{user?.email}</Text>
      </View>

      <Text style={[styles.note, { color: c.textMuted }]}>
        Uploaded-media history and account settings land here as the backend
        integration grows.
      </Text>

      <Pressable
        onPress={handleSignOut}
        style={[styles.signOutButton, { borderColor: c.border }]}
      >
        <Text style={{ color: c.text, fontWeight: "600" }}>Sign out</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: spacing.md },
  card: {
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.lg,
    alignItems: "center",
    gap: spacing.xs,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.sm,
  },
  avatarText: { fontSize: 24, fontWeight: "700" },
  name: { fontSize: 17, fontWeight: "600" },
  email: { fontSize: 13 },
  note: { fontSize: 13, marginTop: spacing.lg, textAlign: "center" },
  signOutButton: {
    marginTop: spacing.xl,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    paddingVertical: spacing.sm + 4,
    alignItems: "center",
  },
});
