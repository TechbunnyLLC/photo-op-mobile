import * as ImagePicker from "expo-image-picker";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
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
import { useAuth } from "../../lib/auth-context";
import { api } from "../../lib/api";
import { getDisplayHandle } from "../../lib/media";
import { radius, resolveTheme, spacing } from "../../lib/theme";
import type { MediaItem } from "../../lib/types";

const COLUMN_GAP = spacing.xs;
const NUM_COLUMNS = 3;

export default function ProfileScreen() {
  const scheme = useColorScheme();
  const c = resolveTheme(scheme);
  const router = useRouter();
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
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [editingUsername, setEditingUsername] = useState(false);
  const [usernameDraft, setUsernameDraft] = useState("");
  const [savingUsername, setSavingUsername] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    try {
      const media = await api.getMyMedia(user.userId);
      setItems(media);
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
      data={items}
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
            <Text style={[styles.email, { color: c.textMuted }]}>{user?.email}</Text>

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
          </View>

          <Text style={[styles.sectionTitle, { color: c.text }]}>
            My uploads{items.length > 0 ? ` (${items.length})` : ""}
          </Text>
        </View>
      }
      ListEmptyComponent={
        !loading ? (
          <Text style={[styles.note, { color: c.textMuted }]}>
            {error
              ? `Couldn't load your uploads: ${error}`
              : "You haven't posted anything yet — capture a moment to see it here."}
          </Text>
        ) : null
      }
      renderItem={({ item }) => {
        const isVideo = item.mediaType === "video";
        // thumbWrap carries all the grid-cell sizing (it's the direct row
        // child FlatList's columnWrapperStyle lays out) — everything inside
        // it just fills that fixed-size box, no flex of its own. Tapping
        // any cell opens the same media detail screen the Feed uses
        // (app/media/[id].tsx) — likes, price, location, credit, delete, etc.
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
          </View>
        );
        return (
          <Pressable style={styles.thumbWrap} onPress={() => router.push(`/media/${item.id}`)}>
            {inner}
          </Pressable>
        );
      }}
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
  email: { fontSize: 13 },
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
