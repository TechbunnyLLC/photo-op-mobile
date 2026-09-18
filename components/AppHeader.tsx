import { Image, StyleSheet, Text, View, useColorScheme } from "react-native";
import { resolveTheme, spacing } from "../lib/theme";

// Small brand mark shown top-left on every main screen, mirroring how
// photo-op.ai itself swaps its full wordmark for just the "P" mark at
// mobile widths (see next-web's PageLogo.tsx).
export function AppHeaderLogo() {
  const scheme = useColorScheme();
  const c = resolveTheme(scheme);

  return (
    <View style={styles.row}>
      <Image
        source={require("../assets/branding/logo-mark.png")}
        style={styles.mark}
        resizeMode="contain"
      />
      <Text style={[styles.wordmark, { color: c.text }]}>Photo-OP</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    marginLeft: spacing.md,
  },
  mark: {
    width: 22,
    height: 25,
  },
  wordmark: {
    fontSize: 17,
    fontWeight: "700",
    fontFamily: "Outfit_700Bold",
  },
});
