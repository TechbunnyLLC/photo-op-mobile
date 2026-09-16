import { CameraView, useCameraPermissions } from "expo-camera";
import * as ImagePicker from "expo-image-picker";
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
import { ENABLE_CLIENT_TAGGING, MEDIA_BUCKET, USE_MOCK_API } from "../../lib/config";
import { uploadMediaFile } from "../../lib/storage";
import { radius, resolveTheme, spacing } from "../../lib/theme";

export default function CaptureScreen() {
  const scheme = useColorScheme();
  const c = resolveTheme(scheme);

  const [permission, requestPermission] = useCameraPermissions();
  const [facing, setFacing] = useState<"front" | "back">("back");
  const cameraRef = useRef<CameraView>(null);

  const [localUri, setLocalUri] = useState<string | null>(null);
  const [caption, setCaption] = useState("");
  const [uploading, setUploading] = useState(false);

  async function takePhoto() {
    const photo = await cameraRef.current?.takePictureAsync({ quality: 0.9 });
    if (photo?.uri) setLocalUri(photo.uri);
  }

  async function pickImage() {
    const libraryPermission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!libraryPermission.granted) {
      Alert.alert("Permission needed", "Photo-OP needs photo library access to attach media.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.9,
    });

    if (!result.canceled && result.assets[0]) {
      setLocalUri(result.assets[0].uri);
    }
  }

  async function submit() {
    if (!localUri) return;
    setUploading(true);
    try {
      // 1. Upload the raw file to S3 under public/ — the backend's
      //    PostCreateMedia Lambda picks up the Media insert below and
      //    generates the watermarked/thumbnail variants automatically.
      const imageKey = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
      await uploadMediaFile(localUri, imageKey, "image/jpeg");
      const imageUrl = `https://${MEDIA_BUCKET}.s3.amazonaws.com/public/${imageKey}`;

      // 2. Create the Media record.
      const media = await api.createMedia({
        imageKey,
        imageUrl,
        mediaType: "image",
        description: caption,
      });

      // 3. Tag it. The real backend expects the client to do this (no
      //    server-side tagging step exists) — see lib/tagging.ts. Best
      //    effort: a tagging failure shouldn't block the upload succeeding.
      if (!USE_MOCK_API && ENABLE_CLIENT_TAGGING) {
        // Dynamic import, not a static one: importing lib/tagging.ts at
        // all currently crashes (it pulls in @aws-sdk/client-rekognition —
        // see the ENABLE_CLIENT_TAGGING comment in lib/config.ts). With
        // the flag off, this branch never runs, so the import never
        // happens and the module never loads.
        try {
          const { detectLabels, detectText } = await import("../../lib/tagging");
          const [labels, text] = await Promise.all([
            detectLabels(MEDIA_BUCKET, `public/${imageKey}`),
            detectText(MEDIA_BUCKET, `public/${imageKey}`),
          ]);
          await api.updateTags(media.id, [...labels, ...text]);
        } catch (tagError) {
          console.warn("Tagging failed, media was still uploaded:", tagError);
        }
      }

      Alert.alert("Uploaded", "Your moment is on its way to the feed.");
      setLocalUri(null);
      setCaption("");
    } catch (err) {
      Alert.alert("Upload failed", err instanceof Error ? err.message : "Unknown error");
    } finally {
      setUploading(false);
    }
  }

  // Reviewing a just-captured/picked photo before posting.
  if (localUri) {
    return (
      <View style={[styles.container, { backgroundColor: c.background }]}>
        <Image source={{ uri: localUri }} style={styles.preview} />

        <TextInput
          value={caption}
          onChangeText={setCaption}
          placeholder="Say something about this moment"
          placeholderTextColor={c.textMuted}
          style={[styles.input, { borderColor: c.border, color: c.text, backgroundColor: c.surface }]}
        />

        <View style={styles.actionRow}>
          <Pressable
            onPress={() => setLocalUri(null)}
            style={[styles.button, styles.buttonOutline, { borderColor: c.border }]}
          >
            <Text style={[styles.buttonText, { color: c.text }]}>Retake</Text>
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
        <Pressable onPress={pickImage} style={styles.linkRow}>
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
      <CameraView ref={cameraRef} style={styles.camera} facing={facing} />

      <View style={[styles.cameraControls, { backgroundColor: c.background }]}>
        <Pressable
          onPress={() => setFacing((f) => (f === "back" ? "front" : "back"))}
          style={[styles.iconButton, { backgroundColor: c.surface, borderColor: c.border }]}
        >
          <Text style={{ color: c.text, fontSize: 12, fontWeight: "600" }}>Flip</Text>
        </Pressable>

        <Pressable onPress={takePhoto} style={[styles.shutter, { borderColor: c.accent }]}>
          <View style={[styles.shutterInner, { backgroundColor: c.accent }]} />
        </Pressable>

        <Pressable
          onPress={pickImage}
          style={[styles.iconButton, { backgroundColor: c.surface, borderColor: c.border }]}
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
  linkRow: { marginTop: spacing.lg, alignItems: "center" },
});
