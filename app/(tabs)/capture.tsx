import { CameraView, useCameraPermissions, useMicrophonePermissions } from "expo-camera";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { useVideoPlayer, VideoView } from "expo-video";
import { useRef, useState } from "react";
import {
  Alert,
  Image,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  useColorScheme,
} from "react-native";
import { api } from "../../lib/api";
import { useAuth } from "../../lib/auth-context";
import { ENABLE_CLIENT_TAGGING, MEDIA_BUCKET, USE_MOCK_API } from "../../lib/config";
import { getDefaultCopyright, getDisplayHandle } from "../../lib/media";
import { uploadMediaFile } from "../../lib/storage";
import { radius, resolveTheme, spacing } from "../../lib/theme";

const MAX_VIDEO_SECONDS = 60;

export default function CaptureScreen() {
  const scheme = useColorScheme();
  const c = resolveTheme(scheme);
  const router = useRouter();
  const { user, username } = useAuth();

  const [permission, requestPermission] = useCameraPermissions();
  const [micPermission, requestMicPermission] = useMicrophonePermissions();
  const [facing, setFacing] = useState<"front" | "back">("back");
  const cameraRef = useRef<CameraView>(null);

  // "mode" is the live-camera toggle (what tapping the shutter does).
  // "mediaKind" is what's actually sitting in localUri right now, which
  // can also come from the library picker independently of "mode".
  const [mode, setMode] = useState<"photo" | "video">("photo");
  const [isRecording, setIsRecording] = useState(false);

  const [localUri, setLocalUri] = useState<string | null>(null);
  const [mediaKind, setMediaKind] = useState<"photo" | "video">("photo");
  const [caption, setCaption] = useState("");
  const [price, setPrice] = useState("");
  const [uploading, setUploading] = useState(false);

  // Hooks can't be called conditionally, so this is created unconditionally
  // and just sits idle (source: null) until there's a video to preview.
  const videoPlayer = useVideoPlayer(mediaKind === "video" ? localUri : null, (player) => {
    player.loop = true;
  });

  async function selectMode(next: "photo" | "video") {
    if (next === "video" && !micPermission?.granted) {
      const res = await requestMicPermission();
      if (!res.granted) {
        Alert.alert("Microphone needed", "Photo-OP needs microphone access to record video with sound.");
        return;
      }
    }
    setMode(next);
  }

  async function takePhoto() {
    const photo = await cameraRef.current?.takePictureAsync({ quality: 0.9 });
    if (photo?.uri) {
      setLocalUri(photo.uri);
      setMediaKind("photo");
    }
  }

  async function startRecording() {
    setIsRecording(true);
    try {
      const video = await cameraRef.current?.recordAsync({ maxDuration: MAX_VIDEO_SECONDS });
      if (video?.uri) {
        setLocalUri(video.uri);
        setMediaKind("video");
      }
    } catch (err) {
      console.warn("Recording failed:", err);
    } finally {
      setIsRecording(false);
    }
  }

  function handleShutterPress() {
    if (mode === "photo") {
      takePhoto();
      return;
    }
    if (isRecording) {
      cameraRef.current?.stopRecording();
    } else {
      startRecording();
    }
  }

  async function pickMedia() {
    const libraryPermission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!libraryPermission.granted) {
      Alert.alert("Permission needed", "Photo-OP needs photo library access to attach media.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images", "videos"],
      quality: 0.9,
      videoMaxDuration: MAX_VIDEO_SECONDS,
    });

    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      setLocalUri(asset.uri);
      setMediaKind(asset.type === "video" ? "video" : "photo");
    }
  }

  async function submit() {
    if (!localUri) return;

    const trimmedPrice = price.trim();
    const parsedPrice = trimmedPrice ? Number(trimmedPrice) : undefined;
    if (trimmedPrice && (Number.isNaN(parsedPrice) || (parsedPrice as number) < 0)) {
      Alert.alert("Enter a valid price", "Use a number like 25 or 25.00, or leave it blank for not-for-sale.");
      return;
    }

    setUploading(true);
    try {
      const isVideo = mediaKind === "video";

      // 1. Upload the raw file to S3 under public/ — the backend's
      //    PostCreateMedia Lambda picks up the Media insert (images) or a
      //    later status change (videos, see step 3) and generates the
      //    watermarked/thumbnail variants automatically.
      const extension = isVideo ? "mp4" : "jpg";
      const contentType = isVideo ? "video/mp4" : "image/jpeg";
      const mediaKey = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${extension}`;
      await uploadMediaFile(localUri, mediaKey, contentType);
      const mediaUrl = `https://${MEDIA_BUCKET}.s3.amazonaws.com/public/${mediaKey}`;

      // 2. Create the Media record.
      const media = await api.createMedia({
        imageKey: mediaKey,
        imageUrl: mediaUrl,
        mediaType: isVideo ? "video" : "image",
        description: caption,
        // Auto-signed with the uploader's handle — matches next-web's
        // getDefaultCopyright(username) default. Customizable afterward
        // from the media detail screen (app/media/[id].tsx).
        copyrightText: user ? getDefaultCopyright(getDisplayHandle(username, user.email)) : undefined,
        // Pricing is already fully implemented on the backend (Media.price)
        // — this is just the client UI for setting it at post time.
        // Editable afterward from the media detail screen too.
        price: parsedPrice,
      });

      // 3. Videos need an explicit nudge: the watermarking Lambda only
      //    processes video on a status change to "pending" (images
      //    process immediately on create instead — see lib/api.ts).
      if (!USE_MOCK_API && isVideo) {
        await api.markMediaPending(media.id, media._version);
      }

      // 4. Tag it. The real backend expects the client to do this (no
      //    server-side tagging step exists) — see lib/tagging.ts. Rekognition's
      //    label/text detection is image-only, so this is skipped for video.
      //    Best effort: a tagging failure shouldn't block the upload succeeding.
      if (!USE_MOCK_API && ENABLE_CLIENT_TAGGING && !isVideo) {
        // Dynamic import so lib/tagging.ts (and crypto-js) only load when
        // tagging is actually on and needed, not on every capture screen
        // mount.
        try {
          const { detectLabels, detectText } = await import("../../lib/tagging");
          const [labels, text] = await Promise.all([
            detectLabels(MEDIA_BUCKET, `public/${mediaKey}`),
            detectText(MEDIA_BUCKET, `public/${mediaKey}`),
          ]);
          await api.updateTags(media.id, [...labels, ...text], media._version);
        } catch (tagError) {
          console.warn("Tagging failed, media was still uploaded:", tagError);
        }
      }

      setLocalUri(null);
      setCaption("");
      setPrice("");
      setMediaKind("photo");
      Alert.alert(
        "Posted!",
        USE_MOCK_API
          ? "Your moment is on its way to the feed."
          : isVideo
            ? "Your video is uploading. Watermarking takes a bit longer than photos — " +
              "give it a minute or two to show up in the feed."
            : "Your photo is live. It can take a few seconds to appear " +
              "while the backend generates the watermarked version.",
        [
          { text: "Keep shooting", style: "cancel" },
          { text: "View in feed", onPress: () => router.push("/(tabs)") },
        ]
      );
    } catch (err: any) {
      // TEMP diagnostic logging — remove once real-backend upload works.
      console.error("Upload error (raw):", err);
      console.error("Upload error.name:", err?.name);
      console.error("Upload error.message:", err?.message);
      console.error("Upload error.underlyingError:", err?.underlyingError);
      console.error("Upload error.errors (GraphQL):", err?.errors);
      const message =
        err?.underlyingError?.message ??
        err?.errors?.[0]?.message ??
        (err instanceof Error ? err.message : "Unknown error");
      Alert.alert("Upload failed", message);
    } finally {
      setUploading(false);
    }
  }

  // Reviewing a just-captured/picked photo or video before posting.
  if (localUri) {
    return (
      <View style={[styles.container, { backgroundColor: c.background }]}>
        {mediaKind === "video" ? (
          <VideoView
            player={videoPlayer}
            style={styles.preview}
            nativeControls
            contentFit="cover"
          />
        ) : (
          <Image source={{ uri: localUri }} style={styles.preview} />
        )}

        <TextInput
          value={caption}
          onChangeText={setCaption}
          placeholder="Say something about this moment"
          placeholderTextColor={c.textMuted}
          style={[styles.input, { borderColor: c.border, color: c.text, backgroundColor: c.surface }]}
        />

        <View style={styles.priceRow}>
          <Text style={{ color: c.textMuted, fontSize: 14 }}>$</Text>
          <TextInput
            value={price}
            onChangeText={setPrice}
            keyboardType="decimal-pad"
            placeholder="Price (optional) — leave blank if not for sale"
            placeholderTextColor={c.textMuted}
            style={[styles.priceInput, { borderColor: c.border, color: c.text, backgroundColor: c.surface }]}
          />
        </View>

        <View style={styles.actionRow}>
          <Pressable
            onPress={() => setLocalUri(null)}
            style={[styles.button, styles.buttonOutline, { borderColor: c.border }]}
          >
            <Text style={[styles.buttonText, { color: c.text }]}>
              {mediaKind === "video" ? "Retake" : "Retake"}
            </Text>
          </Pressable>
          <Pressable
            onPress={submit}
            disabled={uploading}
            style={[styles.button, { backgroundColor: c.accent, opacity: uploading ? 0.5 : 1 }]}
          >
            <Text style={[styles.buttonText, { color: c.accentText }]}>
              {uploading ? "Uploading…" : "Post to feed"}
            </Text>
          </Pressable>
        </View>
      </View>
    );
  }

  // Camera permission not yet granted.
  if (!permission) {
    return <View style={[styles.container, { backgroundColor: c.background }]} />;
  }
  if (!permission.granted) {
    return (
      <View style={[styles.container, styles.centered, { backgroundColor: c.background }]}>
        <Text style={[styles.permissionText, { color: c.text }]}>
          Photo-OP needs camera access to capture the moment.
        </Text>
        <Pressable
          onPress={requestPermission}
          style={[styles.button, { backgroundColor: c.accent, marginTop: spacing.md }]}
        >
          <Text style={[styles.buttonText, { color: c.accentText }]}>Grant camera access</Text>
        </Pressable>
        <Pressable onPress={pickMedia} style={styles.linkRow}>
          <Text style={{ color: c.textMuted }}>
            or <Text style={{ color: c.accent, fontWeight: "600" }}>choose from your library</Text>
          </Text>
        </Pressable>
      </View>
    );
  }

  // Live camera view.
  return (
    <View style={[styles.container, { backgroundColor: c.background, padding: 0 }]}>
      <CameraView
        ref={cameraRef}
        style={styles.camera}
        facing={facing}
        mode={mode === "video" ? "video" : "picture"}
      />

      <View style={[styles.modeRow, { backgroundColor: c.background }]}>
        <Pressable
          onPress={() => selectMode("photo")}
          disabled={isRecording}
          style={[
            styles.modePill,
            { borderColor: c.border },
            mode === "photo" && { backgroundColor: c.accent, borderColor: c.accent },
          ]}
        >
          <Text style={{ color: mode === "photo" ? c.accentText : c.text, fontWeight: "600", fontSize: 13 }}>
            Photo
          </Text>
        </Pressable>
        <Pressable
          onPress={() => selectMode("video")}
          disabled={isRecording}
          style={[
            styles.modePill,
            { borderColor: c.border },
            mode === "video" && { backgroundColor: c.accent, borderColor: c.accent },
          ]}
        >
          <Text style={{ color: mode === "video" ? c.accentText : c.text, fontWeight: "600", fontSize: 13 }}>
            Video
          </Text>
        </Pressable>
      </View>

      <View style={[styles.cameraControls, { backgroundColor: c.background }]}>
        <Pressable
          onPress={() => setFacing((f) => (f === "back" ? "front" : "back"))}
          disabled={isRecording}
          style={[styles.iconButton, { backgroundColor: c.surface, borderColor: c.border, opacity: isRecording ? 0.4 : 1 }]}
        >
          <Text style={{ color: c.text, fontSize: 12, fontWeight: "600" }}>Flip</Text>
        </Pressable>

        <Pressable
          onPress={handleShutterPress}
          style={[styles.shutter, { borderColor: isRecording ? "#ef4444" : c.accent }]}
        >
          <View
            style={[
              isRecording ? styles.shutterInnerRecording : styles.shutterInner,
              { backgroundColor: isRecording ? "#ef4444" : c.accent },
            ]}
          />
        </Pressable>

        <Pressable
          onPress={pickMedia}
          disabled={isRecording}
          style={[styles.iconButton, { backgroundColor: c.surface, borderColor: c.border, opacity: isRecording ? 0.4 : 1 }]}
        >
          <Text style={{ color: c.text, fontSize: 12, fontWeight: "600" }}>Library</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: spacing.md },
  centered: { alignItems: "center", justifyContent: "center" },
  permissionText: { textAlign: "center", fontSize: 15 },
  camera: { flex: 1 },
  modeRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: spacing.sm,
    paddingTop: spacing.sm,
  },
  modePill: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xs + 2,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
  cameraControls: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  shutter: {
    width: 72,
    height: 72,
    borderRadius: radius.pill,
    borderWidth: 4,
    alignItems: "center",
    justifyContent: "center",
  },
  shutterInner: {
    width: 56,
    height: 56,
    borderRadius: radius.pill,
  },
  shutterInnerRecording: {
    width: 28,
    height: 28,
    borderRadius: radius.sm,
  },
  iconButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
  preview: {
    width: "100%",
    aspectRatio: 4 / 5,
    borderRadius: radius.lg,
    marginBottom: spacing.md,
  },
  actionRow: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  button: {
    flex: 1,
    borderRadius: radius.md,
    paddingVertical: spacing.sm + 4,
    alignItems: "center",
  },
  buttonOutline: {
    backgroundColor: "transparent",
    borderWidth: StyleSheet.hairlineWidth,
  },
  buttonText: {
    fontWeight: "600",
    fontSize: 14,
  },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    padding: spacing.sm + 4,
    fontSize: 14,
  },
  priceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  priceInput: {
    flex: 1,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    padding: spacing.sm + 4,
    fontSize: 14,
  },
  linkRow: { marginTop: spacing.lg, alignItems: "center" },
});
