import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  Share,
  StyleSheet,
  Text,
  View,
  useColorScheme,
} from "react-native";
import { api } from "../../lib/api";
import { getProfileImageUrl, getPublicProfileUrl } from "../../lib/media";
import { radius, resolveTheme, spacing } from "../../lib/theme";
import type { MediaItem } from "../../lib/types";

const NUM_COLUMNS = 3;
const COLUMN_GAP = spacing.xs;

// A creator's PUBLIC profile — reachable by anyone, signed in or not, via
// their @handle. Deliberately shows only what's safe to publish: avatar,
// username, join date, and their posted media. No email — see
// lib/graphql/queries.ts's listUsersByUsername comment for why that
// matters (next-web's own equivalent page shows it today; don't repeat
// that here, it's exactly the "buyers go around us" risk).
export default function PublicProfileScreen() {
  const { username } = useLocalSearchParams<{ username: string }>();
  const scheme = useColorScheme();
  const c = resolveTheme(scheme);
  const router = useRouter();

  const [profile, setProfile] = useState<{
    cognitoId: string;
    username: string;
    profileImageKey: string | null;
    createdAt: string | null;
  } | null>(null);
  const [items, setItems] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!username) return;
    let cancelled = false;

    async function load() {
      try {
        const user = await api.getUserByUsername(username!);
        if (cancelled) return;
        if (!user) {
          setError("not-found");
          return;
        }
        setProfile(user);
        const media = await api.getMyMedia(user.cognitoId);
        if (!cancelled) setItems(media);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [username]);

  async function shareProfile() {
    if (!profile) return;
    const url = getPublicProfileUrl(profile.username);
    try {
      await Share.share({ message: `Check out @${profile.username} on Photo-OP: ${url}`, url });
    } catch {
      // best effort — no need to surface a share-sheet cancel as an error
    }
  }

  const avatarUrl = profile ? getProfileImageUrl(profile.profileImageKey) : null;
  const joinedLabel = profile?.createdAt
    ? new Date(profile.createdAt).toLocaleDateString(undefined, { month: "long", year: "numeric" })
    : null;

  if (loading) {
    return (
      <View style={[styles.container, styles.centered, { backgroundColor: c.background }]}>
        <Stack.Screen options={{ title: "" }} />
        <ActivityIndicator color={c.accent} />
      </View>
    );
  }

  if (error || !profile) {
    return (
      <View style={[styles.container, styles.centered, { backgroundColor: c.background }]}>
        <Stack.Screen options={{ title: "" }} />
        <Text style={{ color: c.textMuted, textAlign: "center" }}>
          {error === "not-found" ? "This profile doesn't exist." : `Couldn't load this profile: ${error}`}
        </Text>
      </View>
    );
  }

  return (
    <FlatList
      style={{ backgroundColor: c.background }}
      contentContainerStyle={styles.list}
      data={items}
      keyExtractor={(item) => item.id}
      numColumns={NUM_COLUMNS}
      columnWrapperStyle={{ gap: COLUMN_GAP }}
      ListHeaderComponent={
        <View>
          <Stack.Screen options={{ title: `@${profile.username}` }} />
          <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
            {avatarUrl ? (
              <Image source={{ uri: avatarUrl }} style={styles.avatarImage} />
            ) : (
              <View style={[styles.avatar, { backgroundColor: c.accent }]}>
                <Text style={[styles.avatarText, { color: c.accentText }]}>
                  {profile.username[0]?.toUpperCase()}
                </Text>
              </View>
            )}
            <Text style={[styles.name, { color: c.text }]}>@{profile.username}</Text>
            {joinedLabel ? (
              <Text style={[styles.joined, { color: c.textMuted }]}>Contributor since {joinedLabel}</Text>
            ) : null}

            <Pressable
              onPress={shareProfile}
              style={[styles.shareButton, { borderColor: c.border, backgroundColor: c.background }]}
            >
              <Text style={{ color: c.text, fontWeight: "600", fontSize: 13 }}>↗ Share profile</Text>
            </Pressable>
          </View>

          <Text style={[styles.sectionTitle, { color: c.text }]}>
            Posts{items.length > 0 ? ` (${items.length})` : ""}
          </Text>
        </View>
      }
      ListEmptyComponent={
        <Text style={[styles.note, { color: c.textMuted }]}>Nothing posted yet.</Text>
      }
      renderItem={({ item }) => {
        const isVideo = item.mediaType === "video";
        return (
          <Pressable style={styles.thumbWrap} onPress={() => router.push(`/media/${item.id}`)}>
            {item.thumbnailUrl ? (
              <>
                <Image source={{ uri: item.thumbnailUrl }} style={styles.thumb} />
                {isVideo ? (
                  <View style={styles.playBadge}>
                    <Text style={styles.playBadgeText}>▶</Text>
                  </View>
                ) : null}
              </>
            ) : (
              <View style={[styles.thumb, styles.thumbPlaceholder, { backgroundColor: c.surface }]}>
                <Text style={{ color: c.textMuted, fontSize: 10, textAlign: "center" }}>
                  {isVideo ? "Video processing…" : "Processing…"}
                </Text>
              </View>
            )}
          </Pressable>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { alignItems: "center", justifyContent: "center" },
  list: { padding: spacing.md },
  card: {
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.lg,
    alignItems: "center",
    gap: spacing.xs,
    marginBottom: spacing.lg,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.sm,
  },
  avatarImage: {
    width: 72,
    height: 72,
    borderRadius: radius.pill,
    marginBottom: spacing.sm,
  },
  avatarText: { fontSize: 26, fontWeight: "700" },
  name: { fontSize: 18, fontWeight: "700", fontFamily: "Outfit_700Bold" },
  joined: { fontSize: 13 },
  shareButton: {
    marginTop: spacing.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
  },
  sectionTitle: { fontSize: 15, fontWeight: "600", marginBottom: spacing.sm },
  note: { fontSize: 13, marginTop: spacing.md, textAlign: "center" },
  thumbWrap: { flex: 1 / 3, marginBottom: COLUMN_GAP },
  thumb: { width: "100%", aspectRatio: 1, borderRadius: radius.sm },
  thumbPlaceholder: { alignItems: "center", justifyContent: "center" },
  playBadge: {
    position: "absolute",
    top: 4,
    right: 4,
    width: 20,
    height: 20,
    borderRadius: radius.pill,
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center",
    justifyContent: "center",
  },
  playBadgeText: { color: "#fff", fontSize: 9 },
});
