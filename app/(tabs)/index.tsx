import { useFocusEffect } from "expo-router";
import { useCallback, useRef, useState } from "react";
import {
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useColorScheme,
} from "react-native";
import { MediaCard } from "../../components/MediaCard";
import { api } from "../../lib/api";
import { getMediaViralScore, topTags } from "../../lib/media";
import { resolveTheme, radius, spacing } from "../../lib/theme";
import type { MediaItem } from "../../lib/types";

export default function FeedScreen() {
  const scheme = useColorScheme();
  const c = resolveTheme(scheme);

  const [items, setItems] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Tag filter bar. availableTags is the tag "universe" to show as chips —
  // it's only ever recomputed from an UNFILTERED load, so picking a tag
  // narrows the feed without also shrinking the chip bar down to just
  // that one tag (there'd be nothing left to tap back to).
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [availableTags, setAvailableTags] = useState<string[]>([]);
  // useFocusEffect below intentionally only re-runs on actual focus
  // changes, not on every tag tap (selectTag already triggers its own
  // fetch) — this ref lets the focus effect still always use whichever
  // tag is currently selected without needing selectedTag as a dep.
  const selectedTagRef = useRef<string | null>(null);
  selectedTagRef.current = selectedTag;

  const load = useCallback(async (tag: string | null) => {
    try {
      const feed = await api.getFeed(tag ?? undefined);
      // Newsworthy/trending first — same viral-score heuristic used on
      // next-web (recency + views + likes + saves), so what's popular
      // right now surfaces at the top instead of strict chronological.
      const ranked = [...feed].sort(
        (a, b) => getMediaViralScore(b) - getMediaViralScore(a)
      );
      setItems(ranked);
      setError(null);

      if (!tag) {
        // Rebuild the chip bar from this unfiltered page — most frequent
        // tags first, capped at the same top-10 used on cards and posts.
        const counts = new Map<string, number>();
        for (const item of feed) {
          for (const t of item.tags) {
            counts.set(t, (counts.get(t) ?? 0) + 1);
          }
        }
        const sorted = topTags(
          [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([t]) => t)
        );
        setAvailableTags(sorted);
      }
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
  // until you manually pull to refresh. Uses whatever tag is currently
  // selected (via the ref) rather than depending on selectedTag directly,
  // so tapping a chip (which does its own fetch below) doesn't also
  // trigger a second, redundant fetch here.
  useFocusEffect(
    useCallback(() => {
      load(selectedTagRef.current).finally(() => setLoading(false));
    }, [load])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load(selectedTag);
    setRefreshing(false);
  }, [load, selectedTag]);

  const selectTag = useCallback(
    (tag: string | null) => {
      setSelectedTag(tag);
      setLoading(true);
      load(tag).finally(() => setLoading(false));
    },
    [load]
  );

  return (
    <View style={[styles.container, { backgroundColor: c.background }]}>
      {availableTags.length > 0 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipRow}
          style={{ backgroundColor: c.background }}
        >
          <Pressable
            onPress={() => selectTag(null)}
            style={[
              styles.chip,
              { borderColor: c.border },
              selectedTag === null ? { backgroundColor: c.accent, borderColor: c.accent } : { backgroundColor: c.surface },
            ]}
          >
            <Text style={{ color: selectedTag === null ? c.accentText : c.text, fontSize: 13, fontWeight: "600" }}>
              All
            </Text>
          </Pressable>
          {availableTags.map((tag) => {
            const active = tag === selectedTag;
            return (
              <Pressable
                key={tag}
                onPress={() => selectTag(active ? null : tag)}
                style={[
                  styles.chip,
                  { borderColor: c.border },
                  active ? { backgroundColor: c.accent, borderColor: c.accent } : { backgroundColor: c.surface },
                ]}
              >
                <Text style={{ color: active ? c.accentText : c.text, fontSize: 13, fontWeight: "600" }}>
                  {tag}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      ) : null}

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
                : selectedTag
                  ? `Nothing tagged "${selectedTag}" yet.`
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
  chipRow: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, gap: spacing.xs },
  chip: {
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
  },
});
