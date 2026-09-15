import { Image as RNImage, StyleSheet, Text, View, useColorScheme } from "react-native";
import { resolveTheme, radius, spacing } from "../lib/theme";
import type { MediaItem } from "../lib/types";

// NOTE: swap for expo-image's <Image> for better caching/perf once that
// dependency is added; react-native's Image works fine for this scaffold.

export function MediaCard({ item }: { item: MediaItem }) {
  const scheme = useColorScheme();
  const c = resolveTheme(scheme);

  return (
    <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
      <RNImage source={{ uri: item.thumbnailUrl }} style={styles.image} />
      <View style={styles.body}>
        <Text style={[styles.uploader, { color: c.text }]}>{item.uploader.displayName}</Text>
        {item.caption ? (
          <Text style={[styles.caption, { color: c.textMuted }]}>{item.caption}</Text>
        ) : null}
        {item.location ? (
          <Text style={[styles.meta, { color: c.textMuted }]}>{item.location.label}</Text>
        ) : null}
        {item.tags.length > 0 ? (
          <View style={styles.tagRow}>
            {item.tags.map((tag) => (
              <View key={tag} style={[styles.tag, { backgroundColor: c.background, borderColor: c.border }]}>
                <Text style={[styles.tagText, { color: c.textMuted }]}>{tag}</Text>
              </View>
            ))}
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
    marginBottom: spacing.md,
  },
  image: {
    width: "100%",
    aspectRatio: 4 / 5,
  },
  body: {
    padding: spacing.md,
    gap: spacing.xs,
  },
  uploader: {
    fontWeight: "600",
    fontSize: 15,
  },
  caption: {
    fontSize: 14,
  },
  meta: {
    fontSize: 12,
  },
  tagRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  tag: {
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
  },
  tagText: {
    fontSize: 11,
    fontWeight: "500",
  },
});
