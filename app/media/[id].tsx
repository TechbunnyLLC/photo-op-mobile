import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useVideoPlayer, VideoView } from "expo-video";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
  useColorScheme,
} from "react-native";
import { api } from "../../lib/api";
import { useAuth } from "../../lib/auth-context";
import {
  formatCoordinates,
  formatUsPrice,
  getDefaultCopyright,
  getDisplayHandle,
  getMediaPageUrl,
  getMediaViralScore,
} from "../../lib/media";
import { radius, resolveTheme, spacing } from "../../lib/theme";
import type { MediaItem } from "../../lib/types";

// The media detail screen — mirrors photo-op.ai's media details panel
// (title, views, price, viral score, likes, description, coordinates/
// location, categories, tags, copyright credit) so the mobile app carries
// the same "global view of content" info the website shows, plus like,
// share and a customizable copyright/credit line.
export default function MediaDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const scheme = useColorScheme();
  const c = resolveTheme(scheme);
  const router = useRouter();
  const { user, username } = useAuth();

  const [media, setMedia] = useState<MediaItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isLiked, setIsLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [liking, setLiking] = useState(false);

  const [editingCredit, setEditingCredit] = useState(false);
  const [creditDraft, setCreditDraft] = useState("");
  const [savingCredit, setSavingCredit] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const isVideo = media?.mediaType === "video";
  const videoPlayer = useVideoPlayer(isVideo ? media?.url ?? null : null, (player) => {
    player.loop = true;
    player.play();
  });

  useEffect(() => {
    if (!id) return;
    let cancelled = false;

    async function load() {
      try {
        const item = await api.getMedia(id!);
        if (cancelled) return;
        setMedia(item);
        setLikeCount(item.likeCount ?? 0);
        setCreditDraft(item.copyrightText || (user ? getDefaultCopyright(getDisplayHandle(username, user.email)) : ""));
        setError(null);

        if (user) {
          const liked = await api.isMediaLikedByMe(item.id, user.userId);
          if (!cancelled) setIsLiked(liked);
        }
      } catch (err: any) {
        if (cancelled) return;
        const message =
          err?.errors?.[0]?.message ?? (err instanceof Error ? err.message : "Unknown error");
        setError(message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const toggleLike = useCallback(async () => {
    if (!media) return;
    if (!user) {
      Alert.alert("Sign in required", "Sign in to like this post.");
      return;
    }
    const nextLiked = !isLiked;
    setLiking(true);
    setIsLiked(nextLiked);
    setLikeCount((n) => n + (nextLiked ? 1 : -1));
    try {
      if (nextLiked) {
        await api.likeMedia(media.id);
      } else {
        await api.unlikeMedia(media.id);
      }
    } catch (err) {
      // roll back on failure
      setIsLiked(!nextLiked);
      setLikeCount((n) => n + (nextLiked ? -1 : 1));
      Alert.alert("Couldn't update like", err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLiking(false);
    }
  }, [media, user, isLiked]);

  const shareMedia = useCallback(async () => {
    if (!media) return;
    const url = getMediaPageUrl(media.id);
    const text = media.title || media.caption || "Check this out on Photo-OP";
    try {
      await Share.share({ message: `${text} ${url}`, url });
    } catch (err) {
      Alert.alert("Couldn't share", err instanceof Error ? err.message : "Unknown error");
    }
  }, [media]);

  const isOwner = !!user && !!media && media.uploader.id === user.userId;

  const startEditingCredit = useCallback(() => {
    if (!media) return;
    setCreditDraft(media.copyrightText || (user ? getDefaultCopyright(getDisplayHandle(username, user.email)) : ""));
    setEditingCredit(true);
  }, [media, user]);

  const saveCredit = useCallback(async () => {
    if (!media) return;
    const trimmed = creditDraft.trim();
    if (!trimmed) {
      Alert.alert("Credit can't be empty");
      return;
    }
    setSavingCredit(true);
    try {
      await api.updateMediaCopyright(media.id, trimmed, media._version);
      setMedia({ ...media, copyrightText: trimmed });
      setEditingCredit(false);
    } catch (err) {
      Alert.alert("Couldn't save credit", err instanceof Error ? err.message : "Unknown error");
    } finally {
      setSavingCredit(false);
    }
  }, [media, creditDraft]);

  const deleteThisPost = useCallback(() => {
    if (!media) return;
    Alert.alert(
      "Delete this post?",
      "This removes it from the feed and your profile for everyone. This can't be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            setDeleting(true);
            try {
              await api.deleteMedia(media.id, media._version);
              router.back();
            } catch (err) {
              setDeleting(false);
              Alert.alert("Couldn't delete", err instanceof Error ? err.message : "Unknown error");
            }
          },
        },
      ]
    );
  }, [media, router]);

  if (loading) {
    return (
      <View style={[styles.container, styles.centered, { backgroundColor: c.background }]}>
        <Stack.Screen options={{ title: "" }} />
        <ActivityIndicator color={c.accent} />
      </View>
    );
  }

  if (error || !media) {
    return (
      <View style={[styles.container, styles.centered, { backgroundColor: c.background }]}>
        <Stack.Screen options={{ title: "" }} />
        <Text style={{ color: c.textMuted, textAlign: "center" }}>
          {error ? `Couldn't load this post: ${error}` : "This post isn't available."}
        </Text>
      </View>
    );
  }

  const viralScore = getMediaViralScore(media);
  const displayCredit = media.copyrightText || (user ? getDefaultCopyright(getDisplayHandle(username, user.email)) : "");

  return (
    <>
      <Stack.Screen options={{ title: media.title || "Post" }} />
      <ScrollView style={{ backgroundColor: c.background }} contentContainerStyle={styles.scroll}>
        <View style={styles.mediaWrap}>
          {isVideo ? (
            <VideoView player={videoPlayer} style={styles.media} nativeControls contentFit="contain" />
          ) : media.url ? (
            <Image source={{ uri: media.url }} style={styles.media} resizeMode="contain" />
          ) : (
            <View style={[styles.media, styles.mediaPlaceholder]}>
              <Text style={{ color: "#fff" }}>Processing…</Text>
            </View>
          )}
        </View>

        <View style={styles.body}>
          <Text style={[styles.title, { color: c.text }]}>{media.title || "Untitled"}</Text>
          <View style={styles.metaRow}>
            <Text style={[styles.metaText, { color: c.textMuted }]}>
              {(media.viewCount ?? 0).toLocaleString()} {media.viewCount === 1 ? "view" : "views"}
            </Text>
            <Text style={[styles.metaText, { color: c.textMuted }]}> · </Text>
            <Text style={[styles.metaText, { color: c.textMuted }]}>{media.uploader.displayName}</Text>
          </View>

          {/* actions: like (thumbs up), share */}
          <View style={styles.actionRow}>
            <Pressable
              onPress={toggleLike}
              disabled={liking}
              style={[
                styles.actionButton,
                { borderColor: c.border, backgroundColor: isLiked ? c.accent : c.surface },
              ]}
            >
              <Text style={{ fontSize: 15 }}>{isLiked ? "👍" : "👍🏻"}</Text>
              <Text style={[styles.actionText, { color: isLiked ? c.accentText : c.text }]}>
                {likeCount}
              </Text>
            </Pressable>
            <Pressable
              onPress={shareMedia}
              style={[styles.actionButton, { borderColor: c.border, backgroundColor: c.surface }]}
            >
              <Text style={{ fontSize: 15 }}>↗</Text>
              <Text style={[styles.actionText, { color: c.text }]}>Share</Text>
            </Pressable>
          </View>

          {/* price + viral score */}
          <View style={styles.statRow}>
            <Text style={[styles.price, { color: c.accent }]}>
              {media.price ? formatUsPrice(media.price) : "Not for sale"}
            </Text>
            <View style={[styles.scorePill, { borderColor: c.border, backgroundColor: c.surface }]}>
              <Text style={[styles.scoreText, { color: c.textMuted }]}>Viral score</Text>
              <Text style={[styles.scoreValue, { color: c.text }]}>{viralScore}</Text>
            </View>
          </View>

          {media.caption ? (
            <Text style={[styles.description, { color: c.text }]}>{media.caption}</Text>
          ) : null}

          {/* location + coordinates — Photo-OP prides itself on a global
              view of content, so both the place name and raw coordinates
              are shown, not just a city label. */}
          {media.location ? (
            <View style={styles.section}>
              <Text style={[styles.sectionLabel, { color: c.textMuted }]}>Location</Text>
              <Text style={[styles.sectionValue, { color: c.text }]}>{media.location.label}</Text>
              <Text style={[styles.coords, { color: c.textMuted }]}>
                {formatCoordinates(media.location.lat, media.location.lng)}
              </Text>
            </View>
          ) : null}

          {media.categories && media.categories.length > 0 ? (
            <View style={styles.section}>
              <Text style={[styles.sectionLabel, { color: c.textMuted }]}>Categories</Text>
              <View style={styles.tagRow}>
                {media.categories.map((cat) => (
                  <View key={cat} style={[styles.tag, { backgroundColor: c.background, borderColor: c.border }]}>
                    <Text style={[styles.tagText, { color: c.textMuted }]}>{cat}</Text>
                  </View>
                ))}
              </View>
            </View>
          ) : null}

          {media.tags.length > 0 ? (
            <View style={styles.section}>
              <Text style={[styles.sectionLabel, { color: c.textMuted }]}>Tags</Text>
              <View style={styles.tagRow}>
                {media.tags.map((tag) => (
                  <View key={tag} style={[styles.tag, { backgroundColor: c.background, borderColor: c.border }]}>
                    <Text style={[styles.tagText, { color: c.textMuted }]}>{tag}</Text>
                  </View>
                ))}
              </View>
            </View>
          ) : null}

          {/* copyright / credit — auto-signed with the uploader's handle
              at post time (see lib/media.ts's getDefaultCopyright), and
              burned into the watermark by the backend; the uploader can
              customize it here afterward. */}
          <View style={[styles.section, styles.creditSection, { borderColor: c.border }]}>
            <Text style={[styles.sectionLabel, { color: c.textMuted }]}>Credit</Text>
            {editingCredit ? (
              <>
                <TextInput
                  value={creditDraft}
                  onChangeText={setCreditDraft}
                  autoCapitalize="none"
                  autoCorrect={false}
                  style={[styles.creditInput, { borderColor: c.border, color: c.text, backgroundColor: c.surface }]}
                />
                <View style={styles.creditButtonRow}>
                  <Pressable
                    onPress={() => setEditingCredit(false)}
                    style={[styles.smallButton, styles.smallButtonOutline, { borderColor: c.border }]}
                  >
                    <Text style={{ color: c.text, fontWeight: "600", fontSize: 13 }}>Cancel</Text>
                  </Pressable>
                  <Pressable
                    onPress={saveCredit}
                    disabled={savingCredit}
                    style={[styles.smallButton, { backgroundColor: c.accent, opacity: savingCredit ? 0.6 : 1 }]}
                  >
                    <Text style={{ color: c.accentText, fontWeight: "600", fontSize: 13 }}>
                      {savingCredit ? "Saving…" : "Save"}
                    </Text>
                  </Pressable>
                </View>
              </>
            ) : (
              <View style={styles.creditRow}>
                <Text style={[styles.sectionValue, { color: c.text }]}>{displayCredit}</Text>
                {isOwner ? (
                  <Pressable onPress={startEditingCredit} hitSlop={8}>
                    <Text style={{ color: c.secondary, fontWeight: "600", fontSize: 13 }}>Edit</Text>
                  </Pressable>
                ) : null}
              </View>
            )}
          </View>

          {isOwner ? (
            <Pressable
              onPress={deleteThisPost}
              disabled={deleting}
              style={[styles.deleteButton, { borderColor: "#E5484D", opacity: deleting ? 0.6 : 1 }]}
            >
              <Text style={{ color: "#E5484D", fontWeight: "600", fontSize: 14 }}>
                {deleting ? "Deleting…" : "Delete post"}
              </Text>
            </Pressable>
          ) : null}

          <Pressable onPress={() => router.back()} style={styles.backLink}>
            <Text style={{ color: c.textMuted, fontSize: 13 }}>Back to feed</Text>
          </Pressable>
        </View>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { alignItems: "center", justifyContent: "center" },
  scroll: { paddingBottom: spacing.xl },
  mediaWrap: { width: "100%", aspectRatio: 4 / 5, backgroundColor: "#000" },
  media: { width: "100%", height: "100%" },
  mediaPlaceholder: { alignItems: "center", justifyContent: "center" },
  body: { padding: spacing.lg, gap: spacing.sm },
  title: { fontSize: 20, fontWeight: "700", fontFamily: "Outfit_700Bold" },
  metaRow: { flexDirection: "row", flexWrap: "wrap" },
  metaText: { fontSize: 13 },
  actionRow: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.xs },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
  },
  actionText: { fontSize: 13, fontWeight: "600" },
  statRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: spacing.sm,
  },
  price: { fontSize: 20, fontWeight: "700", fontFamily: "Outfit_700Bold" },
  scorePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xs,
  },
  scoreText: { fontSize: 12 },
  scoreValue: { fontSize: 13, fontWeight: "700" },
  description: { fontSize: 14, lineHeight: 20, marginTop: spacing.xs },
  section: { marginTop: spacing.md, gap: 4 },
  sectionLabel: { fontSize: 11, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.4 },
  sectionValue: { fontSize: 14 },
  coords: { fontSize: 12 },
  tagRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs, marginTop: 2 },
  tag: {
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
  },
  tagText: { fontSize: 11, fontWeight: "500" },
  creditSection: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: spacing.md,
  },
  creditRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  creditInput: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm + 4,
    paddingVertical: spacing.xs + 4,
    fontSize: 14,
  },
  creditButtonRow: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.xs },
  smallButton: { borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.xs + 2 },
  smallButtonOutline: { backgroundColor: "transparent", borderWidth: StyleSheet.hairlineWidth },
  deleteButton: {
    marginTop: spacing.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    paddingVertical: spacing.sm + 4,
    alignItems: "center",
  },
  backLink: { marginTop: spacing.lg, alignItems: "center" },
});
