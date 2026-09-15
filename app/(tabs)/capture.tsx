import * as ImagePicker from "expo-image-picker";
import { useState } from "react";
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
import { MEDIA_BUCKET, USE_MOCK_API } from "../../lib/config";
import { resolveTheme, radius, spacing } from "../../lib/theme";
import { uploadMediaFile } from "../../lib/storage";
import { detectLabels, detectText } from "../../lib/tagging";

export default function CaptureScreen() {
  const scheme = useColorScheme();
  const c = resolveTheme(scheme);

  const [localUri, setLocalUri] = useState<string | null>(null);
  const [caption, setCaption] = useState("");
  const [uploading, setUploading] = useState(false);

  async function pickImage() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
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

  async function takePhoto() {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Permission needed", "Photo-OP needs camera access to capture the moment.");
      return;
    }

    const result = await ImagePicker.launchCameraAsync({ quality: 0.9 });
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
      if (!USE_MOCK_API) {
        try {
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

  return (
    <View style={[styles.container, { backgroundColor: c.background }]}>
      {localUri ? (
        <Image source={{ uri: localUri }} style={styles.preview} />
      ) : (
        <View style={[styles.placeholder, { borderColor: c.border, backgroundColor: c.surface }]}>
          <Text style={{ color: c.textMuted }}>No media selected yet</Text>
        </View>
      )}

      <View style={styles.actionRow}>
        <Pressable
          onPress={takePhoto}
          style={[styles.button, { backgroundColor: c.accent }]}
        >
          <Text style={[styles.buttonText, { color: c.accentText }]}>Take photo</Text>
        </Pressable>
        <Pressable
          onPress={pickImage}
          style={[styles.button, styles.buttonOutline, { borderColor: c.border }]}
        >
          <Text style={[styles.buttonText, { color: c.text }]}>Choose from library</Text>
        </Pressable>
      </View>

      <TextInput
        value={caption}
        onChangeText={setCaption}
        placeholder="Say something about this moment"
        placeholderTextColor={c.textMuted}
        style={[styles.input, { borderColor: c.border, color: c.text, backgroundColor: c.surface }]}
      />

      <Pressable
        onPress={submit}
        disabled={!localUri || uploading}
        style={[
          styles.button,
          { backgroundColor: c.accent, opacity: !localUri || uploading ? 0.5 : 1, marginTop: spacing.md },
        ]}
      >
        <Text style={[styles.buttonText, { color: c.accentText }]}>
          {uploading ? "Uploading…" : "Post to feed"}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: spacing.md },
  preview: {
    width: "100%",
    aspectRatio: 4 / 5,
    borderRadius: radius.lg,
    marginBottom: spacing.md,
  },
  placeholder: {
    width: "100%",
    aspectRatio: 4 / 5,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.md,
  },
  actionRow: {
    flexDirection: "row",
    gap: spacing.sm,
    marginBottom: spacing.md,
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
});
