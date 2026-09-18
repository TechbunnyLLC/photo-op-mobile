import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { FlatList, RefreshControl, StyleSheet, Text, View, useColorScheme } from "react-native";
import { MediaCard } from "../../components/MediaCard";
import { api } from "../../lib/api";
import { resolveTheme, spacing } from "../../lib/theme";
import type { MediaItem } from "../../lib/types";

export default function FeedScreen() {
  const scheme = useColorScheme();
  const c = resolveTheme(scheme);

  const [items, setItems] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const feed = await api.getFeed();
      setItems(feed);
      setError(null);
    } catch (err: any) {
      // TEMP diagnostic logging — remove once real-backend feed works.
      console.error("Feed load error (raw):", err);
      console.error("Feed load error.errors (GraphQL):", err?.errors);
      const message =
        err?.errors?.[0]?.message ??
        (err instanceof Error ? err.message : "Unknown error");
      setError(message);
    }
  }, []);

  // Reload every time the Feed tab gains focus (not just on first mount) —
  // otherwise a photo you just posted from the Capture tab won't show up
  // until you manually pull to refresh.
  useFocusEffect(
    useCallback(() => {
      load().finally(() => setLoading(false));
    }, [load])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  return (
    <View style={[styles.container, { backgroundColor: c.background }]}>
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => <MediaCard item={item} />}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={
          !loading ? (
            <Text style={[styles.empty, { color: c.textMuted }]}>
              {error
                ? `Couldn't load the feed: ${error}`
                : "Nothing in the feed yet. Be the first to capture the moment."}
            </Text>
          ) : null
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  list: { padding: spacing.md },
  empty: { textAlign: "center", marginTop: spacing.xl, fontSize: 14 },
});
