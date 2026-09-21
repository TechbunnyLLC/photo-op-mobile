import { useRouter } from "expo-router";
import { Image as RNImage, Pressable, StyleSheet, Text, View, useColorScheme } from "react-native";
import { getMediaViralScore, topTags } from "../lib/media";
import { useMediaProgress } from "../lib/useMediaProgress";
import { ProcessingProgressBar } from "./ProcessingProgressBar";
import { resolveTheme, radius, spacing } from "../lib/theme";
import type { MediaItem } from "../lib/types";

// Above this score (0-100 heuristic — see lib/media.ts) a card is
// considered "newsworthy" enough to badge in the feed. The Feed screen
// already sorts by this same score, so trending items land at the top;
// this badge just makes that visible on the card itself.
const TRENDING_THRESHOLD = 65;

// NOTE: swap for expo-image's <Image> for better caching/perf once that
// dependency is added; react-native's Image works fine for this scaffold.

// Real photos/videos span a wide range of shapes -- portrait phone video
// down around 9:16 (~0.56), landscape up around 16:9 (~1.78) -- and the
// card used to force every single one into a fixed 4:5 portrait box with
// resizeMode "cover" (RNImage's default), which badly cropped landscape
// media (most of the frame got cut off to fill a tall narrow box). Sizing
// each card to the media's own aspect ratio instead fixes that for any
// orientation. These bounds are just a sanity clamp for the rare extreme
// case (e.g. a panorama) so the feed's layout doesn't break -- they're
// wide enough that no normal photo or video capture ever hits them.
const MIN_CARD_RATIO = 0.55;
const MAX_CARD_RATIO = 1.8;
const DEFAULT_CARD_RATIO = 4 / 5;

function cardAspectRatio(item: MediaItem): number {
  if (!item.width || !item.height) return DEFAULT_CARD_RATIO;
  const ratio = item.width / item.height;
  return Math.min(Math.max(ratio, MIN_CARD_RATIO), MAX_CARD_RATIO);
}

export function MediaCard({ item: itemProp }: { item: MediaItem }) {
  const scheme = useColorScheme();
  const c = resolveTheme(scheme);
  const router = useRouter();

  // While itemProp is still processing (video, no thumbnail yet), this
  // polls for real progress and hands back a fresher item once the
  // backend finishes -- so the card swaps in the real thumbnail on its
  // own instead of being stuck showing "Processing…" until whatever list
  // this card lives in happens to refetch.
  const { progress, item } = useMediaProgress(itemProp);

  const isVideo = item.mediaType === "video";
  const isTrending = getMediaViralScore(item) >= TRENDING_THRESHOLD;
  const imageStyle = [styles.image, { aspectRatio: cardAspectRatio(item) }];
  const media = (
    <View>
      {item.thumbnailUrl ? (
        <RNImage source={{ uri: item.thumbnailUrl }} style={imageStyle} />
      ) : (
        <View style={[imageStyle, styles.imagePlaceholder, { backgroundColor: c.background }]}>
          <Text style={{ color: c.textMuted, fontSize: 13 }}>
            {isVideo ? "Video processing…" : "Processing…"}
          </Text>
          <View style={styles.progressWrap}>
            <ProcessingProgressBar progress={progress} />
          </View>
        </View>
      )}
      {isVideo ? (
        <View style={styles.playBadge}>
          <Text style={styles.playBadgeText}>▶</Text>
        </View>
      ) : null}
      {isTrending ? (
        <View style={[styles.trendingBadge, { backgroundColor: c.accent }]}>
          <Text style={[styles.trendingBadgeText, { color: c.accentText }]}>Trending</Text>
        </View>
      ) : null}
    </View>
  );

  return (
    // shadow lives on the outer view (shadows + overflow:hidden don't mix in RN);
    // the inner view clips the rounded corners around the image/body content.
    // The whole card navigates to the media detail screen (app/media/[id].tsx)
    // — that's where video playback, likes, price, location and the rest of
    // the detail panel live now, instead of a bare inline play modal.
    <Pressable style={styles.card} onPress={() => router.push(`/media/${item.id}`)}>
      <View style={[styles.cardInner, { backgroundColor: c.surface, borderColor: c.border }]}>
        {media}
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
              {topTags(item.tags).map((tag, index) => (
                <View key={`${tag}-${index}`} style={[styles.tag, { backgroundColor: c.background, borderColor: c.border }]}>
                  <Text style={[styles.tagText, { color: c.textMuted }]}>{tag}</Text>
                </View>
              ))}
            </View>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.lg,
    marginBottom: spacing.md,
    // elevated-card look to match photo-op.ai's media cards
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  cardInner: {
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
  },
  image: {
    width: "100%",
  },
  imagePlaceholder: {
    alignItems: "center",
    justifyContent: "center",
  },
  progressWrap: {
    width: "60%",
    marginTop: 4,
  },
  playBadge: {
    position: "absolute",
    top: spacing.sm,
    right: spacing.sm,
    width: 28,
    height: 28,
    borderRadius: radius.pill,
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center",
    justifyContent: "center",
  },
  playBadgeText: {
    color: "#fff",
    fontSize: 12,
  },
  trendingBadge: {
    position: "absolute",
    top: spacing.sm,
    left: spacing.sm,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
  },
  trendingBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    fontFamily: "Outfit_600SemiBold",
  },
  body: {
    padding: spacing.md,
    gap: spacing.xs,
  },
  uploader: {
    fontWeight: "600",
    fontFamily: "Outfit_600SemiBold",
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
