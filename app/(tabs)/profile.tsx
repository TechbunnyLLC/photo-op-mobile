import * as ImagePicker from "expo-image-picker";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
  useColorScheme,
} from "react-native";
import { ProcessingProgressBar } from "../../components/ProcessingProgressBar";
import { useAuth } from "../../lib/auth-context";
import { api } from "../../lib/api";
import { getDisplayHandle } from "../../lib/media";
import { radius, resolveTheme, spacing } from "../../lib/theme";
import type { MediaItem } from "../../lib/types";
import { useMediaProgress } from "../../lib/useMediaProgress";

const COLUMN_GAP = spacing.xs;
const NUM_COLUMNS = 3;

// Pulled out of the FlatList's renderItem (rather than an inline function
// body) so useMediaProgress -- and its polling/state -- has a real,
// per-cell component instance to attach to, same reasoning as any other
// hook used per list item.
function ProfileGridThumb({ item: itemProp, onPress }: { item: MediaItem; onPress: () => void }) {
  const scheme = useColorScheme();
  const c = resolveTheme(scheme);
  const { progress, item } = useMediaProgress(itemProp);
  const isVideo = item.mediaType === "video";

  const inner = item.thumbnailUrl ? (
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
      <View style={styles.progressWrap}>
        <ProcessingProgressBar progress={progress} />
      </View>
    </View>
  );

  return (
    <Pressable style={styles.thumbWrap} onPress={onPress}>
      {inner}
    </Pressable>
  );
}

export default function ProfileScreen() {
  const scheme = useColorScheme();
  const c = resolveTheme(scheme);
  const router = useRouter();
  const { shelf: shelfParam } = useLocalSearchParams<{ shelf?: string }>();
  const {
    user,
    signOut,
    username,
    isLoadingUsername,
    updateUsername,
    avatarUrl,
    isUploadingAvatar,
    updateProfilePicture,
  } = useAuth();

  const [items, setItems] = useState<MediaItem[]>([]);
  const [licenses, setLicenses] = useState<MediaItem[]>([]);
  const [shelf, setShelf] = useState<"posted" | "licensed">("posted");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (shelfParam === "licensed") setShelf("licensed");
  }, [shelfParam]);

  const [editingUsername, setEditingUsername] = useState(false);
  const [usernameDraft, setUsernameDraft] = useState("");
  const [savingUsername, setSavingUsername] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    try {
      const [media, owned] = await Promise.all([
        api.getMyMedia(user.userId),
        api.listMyLicenses(user.userId),
      ]);
      setItems(media);
      setLicenses(owned);
      setError(null);
    } catch (err: any) {
      const message =
        err?.errors?.[0]?.message ??
        (err instanceof Error ? err.message : "Unknown error");
      setError(message);
    }
  }, [user]);

  // Reload every time the Profile tab gains focus, so a photo you just
  // posted from Capture shows up here without a manual refresh, and a post
  // you just deleted from the detail screen disappears from the grid.
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

  async function handleSignOut() {
    try {
      await signOut();
    } catch (err) {
      Alert.alert("Couldn't sign out", err instanceof Error ? err.message : "Unknown error");
    }
  }

  const displayName = user?.email.split("@")[0] ?? "you";
  const displayHandle = user ? getDisplayHandle(username, user.email) : "";

  function startEditingUsername() {
    setUsernameDraft(displayHandle);
    setEditingUsername(true);
  }

  async function saveUsername() {
    const trimmed = usernameDraft.trim();
    if (!trimmed) {
      Alert.alert("Username can't be empty");
      return;
    }
    setSavingUsername(true);
    try {
      await updateUsername(trimmed);
      setEditingUsername(false);
    } catch (err) {
      Alert.alert("Couldn't save username", err instanceof Error ? err.message : "Unknown error");
    } finally {
      setSavingUsername(false);
    }
  }

  async function pickAndUploadAvatar(source: "camera" | "library") {
    try {
      let result: ImagePicker.ImagePickerResult;
      if (source === "camera") {
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (!permission.granted) {
          Alert.alert("Camera access needed", "Photo-OP needs camera access to take a profile photo.");
          return;
        }
        result = await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], quality: 0.9, allowsEditing: true, aspect: [1, 1] });
      } else {
        const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!permission.granted) {
          Alert.alert("Photo library access needed", "Photo-OP needs photo library access to set a profile picture.");
          return;
        }
        result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.9, allowsEditing: true, aspect: [1, 1] });
      }

      if (result.canceled || !result.assets[0]) return;

      await updateProfilePicture(result.assets[0].uri);
    } catch (err) {
      Alert.alert("Couldn't update profile picture", err instanceof Error ? err.message : "Unknown error");
    }
  }

  function handleAvatarPress() {
    Alert.alert("Profile picture", undefined, [
      { text: "Take Photo", onPress: () => pickAndUploadAvatar("camera") },
      { text: "Choose from Library", onPress: () => pickAndUploadAvatar("library") },
      { text: "Cancel", style: "cancel" },
    ]);
  }

  return (
    <FlatList
      style={{ backgroundColor: c.background }}
      contentContainerStyle={styles.list}
      data={shelf === "posted" ? items : licenses}
      keyExtractor={(item) => item.id}
      numColumns={NUM_COLUMNS}
      columnWrapperStyle={{ gap: COLUMN_GAP }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      ListHeaderComponent={
        <View>
          <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
            <Pressable onPress={handleAvatarPress} disabled={isUploadingAvatar}>
              {avatarUrl ? (
                <Image source={{ uri: avatarUrl }} style={styles.avatarImage} />
              ) : (
                <View style={[styles.avatar, { backgroundColor: c.accent }]}>
                  <Text style={[styles.avatarText, { color: c.accentText }]}>
                    {displayName[0]?.toUpperCase()}
                  </Text>
                </View>
              )}
              <View style={[styles.avatarEditBadge, { backgroundColor: c.secondary, borderColor: c.surface }]}>
                {isUploadingAvatar ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.avatarEditBadgeText}>✎</Text>
                )}
              </View>
            </Pressable>
            <Text style={[styles.name, { color: c.text }]}>{displayName}</Text>

            {/* Username — starts out as the backend's system-generated
                handle (see lib/graphql/queries.ts's getUser comment) and
                is what new posts get auto-signed with (lib/media.ts's
                getDefaultCopyright). Editable here afterward. */}
            <View style={styles.usernameBlock}>
              {editingUsername ? (
                <>
                  <View style={styles.usernameInputRow}>
                    <Text style={[styles.usernamePrefix, { color: c.textMuted }]}>@</Text>
                    <TextInput
                      value={usernameDraft}
                      onChangeText={setUsernameDraft}
                      autoCapitalize="none"
                      autoCorrect={false}
                      style={[
                        styles.usernameInput,
                        { borderColor: c.border, color: c.text, backgroundColor: c.background },
                      ]}
                    />
                  </View>
                  <View style={styles.usernameButtonRow}>
                    <Pressable
                      onPress={() => setEditingUsername(false)}
                      style={[styles.smallButton, styles.smallButtonOutline, { borderColor: c.border }]}
                    >
                      <Text style={{ color: c.text, fontWeight: "600", fontSize: 13 }}>Cancel</Text>
                    </Pressable>
                    <Pressable
                      onPress={saveUsername}
                      disabled={savingUsername}
                      style={[styles.smallButton, { backgroundColor: c.accent, opacity: savingUsername ? 0.6 : 1 }]}
                    >
                      <Text style={{ color: c.accentText, fontWeight: "600", fontSize: 13 }}>
                        {savingUsername ? "Saving…" : "Save"}
                      </Text>
                    </Pressable>
                  </View>
                </>
              ) : (
                <View style={styles.usernameRow}>
                  {isLoadingUsername ? (
                    <ActivityIndicator size="small" color={c.textMuted} />
                  ) : (
                    <Text style={[styles.usernameText, { color: c.secondary }]}>@{displayHandle}</Text>
                  )}
                  <Pressable onPress={startEditingUsername} hitSlop={8}>
                    <Text style={{ color: c.textMuted, fontWeight: "600", fontSize: 13 }}>Edit</Text>
                  </Pressable>
                </View>
              )}
            </View>

            {!isLoadingUsername ? (
              <Pressable onPress={() => router.push(`/profile/${displayHandle}`)} style={styles.publicLinkRow}>
                <Text style={{ color: c.secondary, fontSize: 12, fontWeight: "600" }}>
                  View my public profile →
                </Text>
              </Pressable>
            ) : null}
          </View>

          <View style={styles.shelfRow}>
            <Pressable
              onPress={() => setShelf("posted")}
              style={[
                styles.shelfChip,
                { borderColor: c.border },
                shelf === "posted"
                  ? { backgroundColor: c.accent, borderColor: c.accent }
                  : { backgroundColor: c.surface },
              ]}
            >
              <Text style={{ color: shelf === "posted" ? c.accentText : c.text, fontWeight: "600", fontSize: 13 }}>
                Posted{items.length ? ` (${items.length})` : ""}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setShelf("licensed")}
              style={[
                styles.shelfChip,
                { borderColor: c.border },
                shelf === "licensed"
                  ? { backgroundColor: c.accent, borderColor: c.accent }
                  : { backgroundColor: c.surface },
              ]}
            >
              <Text style={{ color: shelf === "licensed" ? c.accentText : c.text, fontWeight: "600", fontSize: 13 }}>
                Licensed{licenses.length ? ` (${licenses.length})` : ""}
              </Text>
            </Pressable>
          </View>
          <Text style={[styles.sectionTitle, { color: c.text }]}>
            {shelf === "posted" ? "My uploads" : "Licenses I bought"}
          </Text>
        </View>
      }
      ListEmptyComponent={
        !loading ? (
          <Text style={[styles.note, { color: c.textMuted }]}>
            {error
              ? `Couldn't load your ${shelf === "posted" ? "uploads" : "licenses"}: ${error}`
              : shelf === "licensed"
                ? "Buy a license on a priced post to see it here."
                : "You haven't posted anything yet — capture a moment to see it here."}
          </Text>
        ) : null
      }
      renderItem={({ item }) => (
        // thumbWrap carries all the grid-cell sizing (it's the direct row
        // child FlatList's columnWrapperStyle lays out) — everything inside
        // it just fills that fixed-size box, no flex of its own. Tapping
        // any cell opens the same media detail screen the Feed uses
        // (app/media/[id].tsx) — likes, price, location, credit, delete, etc.
        <ProfileGridThumb item={item} onPress={() => router.push(`/media/${item.id}`)} />
      )}
      ListFooterComponent={
        <Pressable
          onPress={handleSignOut}
          style={[styles.signOutButton, { borderColor: c.border }]}
        >
          <Text style={{ color: c.text, fontWeight: "600" }}>Sign out</Text>
        </Pressable>
      }
    />
  );
}

const styles = StyleSheet.create({
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
    width: 64,
    height: 64,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.sm,
  },
  avatarImage: {
    width: 64,
    height: 64,
    borderRadius: radius.pill,
    marginBottom: spacing.sm,
  },
  avatarEditBadge: {
    position: "absolute",
    right: -2,
    bottom: spacing.sm - 2,
    width: 22,
    height: 22,
    borderRadius: radius.pill,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarEditBadgeText: { color: "#fff", fontSize: 11 },
  avatarText: { fontSize: 24, fontWeight: "700" },
  name: { fontSize: 17, fontWeight: "600" },
  publicLinkRow: { marginTop: spacing.sm },
  usernameBlock: { marginTop: spacing.sm, alignItems: "center", width: "100%" },
  usernameRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  usernameText: { fontSize: 14, fontWeight: "600" },
  usernameInputRow: { flexDirection: "row", alignItems: "center", gap: 4, width: "100%" },
  usernamePrefix: { fontSize: 14, fontWeight: "600" },
  usernameInput: {
    flex: 1,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm + 4,
    paddingVertical: spacing.xs + 2,
    fontSize: 14,
  },
  usernameButtonRow: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.xs },
  smallButton: { borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.xs + 2 },
  smallButtonOutline: { backgroundColor: "transparent", borderWidth: StyleSheet.hairlineWidth },
  sectionTitle: { fontSize: 15, fontWeight: "600", marginBottom: spacing.sm },
  shelfRow: { flexDirection: "row", gap: spacing.sm, marginBottom: spacing.md },
  shelfChip: {
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
  },
  note: { fontSize: 13, marginTop: spacing.md, textAlign: "center" },
  thumbWrap: {
    flex: 1 / 3,
    marginBottom: COLUMN_GAP,
  },
  thumb: {
    width: "100%",
    aspectRatio: 1,
    borderRadius: radius.sm,
  },
  thumbPlaceholder: {
    alignItems: "center",
    justifyContent: "center",
  },
  progressWrap: {
    width: "70%",
    marginTop: 4,
  },
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
  playBadgeText: {
    color: "#fff",
    fontSize: 9,
  },
  signOutButton: {
    marginTop: spacing.xl,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    paddingVertical: spacing.sm + 4,
    alignItems: "center",
  },
});
