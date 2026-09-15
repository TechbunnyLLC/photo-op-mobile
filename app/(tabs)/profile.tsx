import { StyleSheet, Text, View, useColorScheme } from "react-native";
import { resolveTheme, radius, spacing } from "../../lib/theme";

// Placeholder — swap for a real signed-in user once auth against the
// Django backend is wired up.
const PLACEHOLDER_USER = {
  displayName: "you",
  email: "you@example.com",
};

export default function ProfileScreen() {
  const scheme = useColorScheme();
  const c = resolveTheme(scheme);

  return (
    <View style={[styles.container, { backgroundColor: c.background }]}>
      <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
        <View style={[styles.avatar, { backgroundColor: c.accent }]}>
          <Text style={[styles.avatarText, { color: c.accentText }]}>
            {PLACEHOLDER_USER.displayName[0]?.toUpperCase()}
          </Text>
        </View>
        <Text style={[styles.name, { color: c.text }]}>{PLACEHOLDER_USER.displayName}</Text>
        <Text style={[styles.email, { color: c.textMuted }]}>{PLACEHOLDER_USER.email}</Text>
      </View>

      <Text style={[styles.note, { color: c.textMuted }]}>
        Auth, uploaded-media history, and account settings land here once the
        backend integration is wired up.
      </Text>
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
});
