import { CameraView, useCameraPermissions, useMicrophonePermissions } from "expo-camera";
import * as ImagePicker from "expo-image-picker";
import { useIsFocused, useRouter } from "expo-router";
import { useVideoPlayer, VideoView } from "expo-video";
import { useRef, useState } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  ActivityIndicator,
  Alert,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useColorScheme,
} from "react-native";
import { ProcessingProgressBar } from "../../components/ProcessingProgressBar";
import { api } from "../../lib/api";
import { useAuth } from "../../lib/auth-context";
import { ENABLE_CLIENT_TAGGING, MEDIA_BUCKET, USE_MOCK_API } from "../../lib/config";
import { summarizeInterview } from "../../lib/interview";
import { setInterviewCallback } from "../../lib/interview-handoff";
import { LICENSE_TERMS_TEXT, LICENSE_TERMS_VERSION } from "../../lib/licenseTerms";
import { getDefaultCopyright, getDisplayHandle, topTags } from "../../lib/media";
import { describeMedia } from "../../lib/media-description";
import { uploadMediaFile } from "../../lib/storage";
import { radius, resolveTheme, spacing } from "../../lib/theme";

const MAX_VIDEO_SECONDS = 60;
const VIDEO_BITRATE = 4_000_000;

export default function CaptureScreen() {
  const scheme = useColorScheme();
  const c = resolveTheme(scheme);
  const router = useRouter();
  const isFocused = useIsFocused();
  const insets = useSafeAreaInsets();
  const { user, username } = useAuth();

  const [permission, requestPermission] = useCameraPermissions();
  const [micPermission, requestMicPermission] = useMicrophonePermissions();
  const [facing, setFacing] = useState<"front" | "back">("back");
  const cameraRef = useRef<CameraView>(null);
  const reviewScrollRef = useRef<ScrollView>(null);

  // "mode" is the live-camera toggle (what tapping the shutter does).
  // "mediaKind" is what's actually sitting in localUri right now, which
  // can also come from the library picker independently of "mode".
  const [mode, setMode] = useState<"photo" | "video">("photo");
  const [isRecording, setIsRecording] = useState(false);

  const [localUri, setLocalUri] = useState<string | null>(null);
  const [mediaKind, setMediaKind] = useState<"photo" | "video">("photo");
  const [title, setTitle] = useState("");
  const [caption, setCaption] = useState("");
  const [price, setPrice] = useState("");
  // License text is an overlay so Capture (and the video player) stay
  // mounted. A price is optional — posting with a blank price is not for
  // sale; posting with a price records standard-terms consent.
  const [showLicenseModal, setShowLicenseModal] = useState(false);
  const [termsReviewed, setTermsReviewed] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [uploadPhase, setUploadPhase] = useState<"upload" | "process" | null>(null);
  const [generatingDescription, setGeneratingDescription] = useState(false);
  // True only while generateDescription() is running for a VIDEO -- see
  // that function's comment. Forces the live preview player below to
  // fully release so the throwaway caption-grab player never opens
  // alongside it.
  const [videoCaptionBusy, setVideoCaptionBusy] = useState(false);

  // Hooks can't be called conditionally, so this is created unconditionally
  // and just sits idle (source: null) until there's a video to preview.
  // Source also goes to null (forcing a full release, not just a hidden
  // View) while videoCaptionBusy is true -- see generateDescription().
  const videoPlayer = useVideoPlayer(
    mediaKind === "video" && !videoCaptionBusy && !showLicenseModal ? localUri : null,
    (player) => {
      player.loop = true;
    }
  );

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
    const photo = await cameraRef.current?.takePictureAsync({
      quality: 0.7,
      ...(Platform.OS === "android" ? { skipProcessing: true } : {}),
    });
    if (photo?.uri) {
      setLocalUri(photo.uri);
      setMediaKind("photo");
    }
  }

  async function startRecording() {
    setIsRecording(true);
    try {
      const video = await cameraRef.current?.recordAsync({
        maxDuration: MAX_VIDEO_SECONDS,
        ...(Platform.OS === "ios" ? {} : { maxFileSize: 80 * 1024 * 1024 }),
      });
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

  // Sends a downsized copy of the photo/video to the InterviewAI Lambda's
  // /describe route and replaces the caption with what comes back.
  //
  // Video: lib/media-description.ts grabs a poster frame with its OWN
  // throwaway player, which at the JS/object level never touches this
  // screen's live preview player -- but repeated on-device logcat
  // captures this session showed that doesn't matter: the freeze is
  // hardware-level decoder contention, and it reproduces whenever two
  // decoder sessions are open on this device at the same time, however
  // that overlap is isolated in JS. The only capture that never froze is
  // the one with no second session open at all. So for video, this
  // fully releases the live player first (videoCaptionBusy -> videoPlayer
  // source goes to null) and waits out a delay before opening the
  // throwaway one, mirroring the fix in submit() for automatic tagging.
  // The live player rebuilds and the preview reappears once this
  // finishes (see the JSX below).
  async function generateDescription() {
    if (!localUri || generatingDescription) return;
    const isVideo = mediaKind === "video";
    setGeneratingDescription(true);
    if (isVideo) setVideoCaptionBusy(true);
    try {
      if (isVideo) {
        await new Promise((resolve) => setTimeout(resolve, 800));
      }
      const { description } = await describeMedia(localUri, mediaKind, caption.trim() || undefined);
      if (description) setCaption(description);
    } catch (err) {
      console.warn("Failed to generate description:", err);
      Alert.alert("Couldn't generate a caption", "Check your connection and try again.");
    } finally {
      setGeneratingDescription(false);
      if (isVideo) setVideoCaptionBusy(false);
    }
  }

  // Opens the AI-interview chat (app/interview.tsx) with whatever caption
  // and media type are already set, so its questions can be specific
  // ("what happened on Main St") rather than generic. The registered
  // callback is invoked once, when/if the interview finishes with at
  // least one answered question — see lib/interview-handoff.ts. Declining
  // to finish (tapping Skip, or backing out) just means the callback is
  // never called; the caption is left exactly as the uploader typed it.
  function openInterview() {
    setInterviewCallback((transcript) => {
      const summary = summarizeInterview(transcript);
      if (!summary) return;
      setCaption((prev) => (prev.trim() ? `${prev.trim()}\n\n${summary}` : summary));
    });
    router.push({
      pathname: "/interview",
      params: { caption, mediaType: mediaKind },
    });
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
    setUploadProgress(0);
    setUploadPhase("upload");
    try {
      const isVideo = mediaKind === "video";

      // Safety net: wrap the network sequence below in a hard timeout so a
      // stuck upload can never leave the button reading "Uploading..."
      // forever -- see the comment above submit() call sites / this block
      // for why ("capture is locked" reports).
      const withTimeout = <T,>(p: Promise<T>, ms: number, label: string): Promise<T> =>
        Promise.race([
          p,
          new Promise<T>((_, reject) =>
            setTimeout(() => reject(new Error(`${label} timed out -- check your connection and try again.`)), ms)
          ),
        ]);

      // 1. Upload the raw file to S3 under public/ — the backend's
      //    PostCreateMedia Lambda picks up the Media insert (images) or a
      //    later status change (videos, see step 3) and generates the
      //    watermarked/thumbnail variants automatically.
      const extension = isVideo ? "mp4" : "jpg";
      const contentType = isVideo ? "video/mp4" : "image/jpeg";
      const mediaKey = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${extension}`;
      await withTimeout(
        uploadMediaFile(localUri, mediaKey, contentType, (fraction) => {
          setUploadProgress(Math.round(fraction * 100));
        }),
        120000,
        "Upload"
      );
      const mediaUrl = `https://${MEDIA_BUCKET}.s3.amazonaws.com/public/${mediaKey}`;

      // 2. Create the Media record.
      const media = await withTimeout(api.createMedia({
        imageKey: mediaKey,
        imageUrl: mediaUrl,
        mediaType: isVideo ? "video" : "image",
        description: caption,
        title: title.trim() || undefined,
        // Auto-signed with the uploader's handle — matches next-web's
        // getDefaultCopyright(username) default. Customizable afterward
        // from the media detail screen (app/media/[id].tsx).
        copyrightText: user ? getDefaultCopyright(getDisplayHandle(username, user.email)) : undefined,
        // Pricing is already fully implemented on the backend (Media.price)
        // — this is just the client UI for setting it at post time.
        // Editable afterward from the media detail screen too.
        price: parsedPrice,
        ...(parsedPrice
          ? {
              licenseConsentGiven: true,
              licenseConsentAt: new Date().toISOString(),
              licenseTermsVersion: LICENSE_TERMS_VERSION,
            }
          : {}),
      }), 20000, "Create post");

      // 3. Videos need an explicit nudge: the watermarking Lambda only
      //    processes video on a status change to "pending" (images
      //    process immediately on create instead — see lib/api.ts).
      if (!USE_MOCK_API && isVideo) {
        setUploadPhase("process");
        setUploadProgress(null);
        await withTimeout(api.markMediaPending(media.id, media._version), 20000, "Video processing hand-off");
      }

      // Capture what tagging needs before resetting the screen below --
      // see the reasoning in the step-4 comment for why tagging now runs
      // AFTER the reset instead of before it.
      const taggedUri = localUri;
      const taggedKind = mediaKind;
      const taggedCaption = caption.trim() || undefined;

      setLocalUri(null);
      setTitle("");
      setCaption("");
      setPrice("");
      setTermsReviewed(false);
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
          { text: "View post", onPress: () => router.push(`/media/${media.id}`) },
          { text: "View in feed", onPress: () => router.push("/(tabs)") },
        ]
      );

      // 4. Tag it. Used to be Rekognition (lib/tagging.ts, DetectLabels +
      //    DetectText) for photos only -- video tagging was meant to go
      //    through a separate async Rekognition Video pipeline that never
      //    got fully wired up. Now both media types go through the same
      //    Claude call as the AI-caption feature (lib/media-description.ts),
      //    which already has to open/downsize the file anyway. Best effort:
      //    a tagging failure shouldn't block the upload succeeding.
      //
      // Fire-and-forget, running AFTER the screen reset above -- every
      // on-device freeze captured this session happened while the capture
      // screen's live <VideoView> player was still mounted at the same
      // time the throwaway tagging player opened on the same file, no
      // matter how that overlap was isolated (paused, hidden, even fully
      // released-and-rebuilt). setLocalUri(null) above fully releases the
      // live player (useVideoPlayer's source goes to null), so by waiting
      // until after that reset there's only ever one decoder open at a
      // time -- nothing left to race. The short delay for video is a
      // safety margin: React batches state updates, so the native
      // View/Surface teardown may not be finished the instant this line
      // runs.
      if (!USE_MOCK_API && ENABLE_CLIENT_TAGGING) {
        (async () => {
          try {
            if (taggedKind === "video") {
              await new Promise((resolve) => setTimeout(resolve, 800));
            }
            const { tags } = await describeMedia(taggedUri, taggedKind, taggedCaption);
            const limited = topTags(tags);
            if (limited.length) {
              await api.updateTags(media.id, limited, media._version);
            }
          } catch (tagError) {
            console.warn("Tagging failed, media was still uploaded:", tagError);
          }
        })();
      }
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
      setUploadProgress(null);
      setUploadPhase(null);
    }
  }

  // Reviewing a just-captured/picked photo or video before posting.
  // Preview is compact and Retake/Post stay pinned under the form so the
  // keyboard, a price, and license terms cannot shove Post off-screen.
  if (localUri) {
    return (
      <>
      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: c.background }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={insets.top}
      >
        {mediaKind === "video" ? (
          <View style={[styles.preview, { backgroundColor: c.surface }]}>
            <VideoView
              player={videoPlayer}
              style={StyleSheet.absoluteFill}
              nativeControls
              contentFit="contain"
            />
            {videoCaptionBusy && (
              <View style={[StyleSheet.absoluteFill, styles.previewBusy]}>
                <ActivityIndicator size="small" color="#fff" />
                <Text style={styles.previewBusyText}>Generating caption…</Text>
              </View>
            )}
          </View>
        ) : (
          <Image
            source={{ uri: localUri }}
            style={[styles.preview, { backgroundColor: c.surface }]}
            resizeMode="contain"
          />
        )}

        <ScrollView
          ref={reviewScrollRef}
          style={{ flex: 1 }}
          contentContainerStyle={styles.reviewForm}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder="Give it a title (optional)"
            placeholderTextColor={c.textMuted}
            maxLength={120}
            style={[styles.input, { borderColor: c.border, color: c.text, backgroundColor: c.surface }]}
          />

          <TextInput
            value={caption}
            onChangeText={setCaption}
            placeholder="Say something about this moment"
            placeholderTextColor={c.textMuted}
            multiline
            style={[styles.input, styles.captionInput, { borderColor: c.border, color: c.text, backgroundColor: c.surface }]}
          />

          <View style={styles.aiActionsRow}>
            <Pressable onPress={generateDescription} disabled={generatingDescription} style={styles.aiActionLink}>
              {generatingDescription ? (
                <ActivityIndicator size="small" color={c.secondary} />
              ) : (
                <Text style={{ color: c.secondary, fontWeight: "600", fontSize: 13 }}>
                  {caption.trim() ? "Improve with AI" : "Generate a caption with AI"}
                </Text>
              )}
            </Pressable>
            <Pressable onPress={openInterview} style={styles.aiActionLink}>
              <Text style={{ color: c.secondary, fontWeight: "600", fontSize: 13 }}>
                Answer a few quick questions
              </Text>
            </Pressable>
          </View>

          <View style={styles.priceRow}>
            <Text style={{ color: c.textMuted, fontSize: 14 }}>$</Text>
            <TextInput
              value={price}
              onChangeText={setPrice}
              keyboardType="decimal-pad"
              placeholder="Price (optional) — blank = not for sale"
              placeholderTextColor={c.textMuted}
              style={[styles.priceInput, { borderColor: c.border, color: c.text, backgroundColor: c.surface }]}
            />
          </View>
          <Text style={{ color: c.textMuted, fontSize: 12, lineHeight: 18 }}>
            Same Post either way. A price lists it for sale under Photo-OP’s{" "}
            <Text
              style={{ color: c.secondary, fontWeight: "600" }}
              onPress={() => {
                Keyboard.dismiss();
                setShowLicenseModal(true);
              }}
            >
              Standard License Terms
            </Text>
            .
          </Text>
          {termsReviewed ? (
            <View style={styles.termsOkRow}>
              <View style={[styles.checkbox, { backgroundColor: c.accent, borderColor: c.accent }]}>
                <Text style={{ color: c.accentText, fontSize: 12, fontWeight: "700" }}>✓</Text>
              </View>
              <Text style={{ color: c.text, fontSize: 13, flex: 1 }}>Terms reviewed — OK to post</Text>
            </View>
          ) : null}

          {uploading ? (
            <View style={styles.uploadStatus}>
              <Text style={{ color: c.text, fontWeight: "600", fontSize: 13 }}>
                {uploadPhase === "process"
                  ? "Video processing…"
                  : mediaKind === "video"
                    ? "Uploading video…"
                    : "Uploading…"}
              </Text>
              <ProcessingProgressBar progress={uploadProgress} />
            </View>
          ) : null}
        </ScrollView>

        <View style={[styles.pinnedActions, { backgroundColor: c.background, borderTopColor: c.border }]}>
          <Pressable
            onPress={() => {
              Keyboard.dismiss();
              setLocalUri(null);
            }}
            style={[styles.button, styles.buttonOutline, { borderColor: c.border }]}
          >
            <Text style={[styles.buttonText, { color: c.text }]}>Retake</Text>
          </Pressable>
          <Pressable
            onPress={() => {
              Keyboard.dismiss();
              submit();
            }}
            disabled={uploading}
            style={[styles.button, { backgroundColor: c.accent, opacity: uploading ? 0.5 : 1 }]}
          >
            <Text style={[styles.buttonText, { color: c.accentText }]}>
              {uploading ? "Uploading…" : "Post to feed"}
            </Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
      <Modal
        visible={showLicenseModal}
        animationType="slide"
        onRequestClose={() => setShowLicenseModal(false)}
      >
        <View style={[styles.licenseModal, { backgroundColor: c.background }]}>
          <View style={styles.licenseModalHeader}>
            <Pressable
              onPress={() => setShowLicenseModal(false)}
              hitSlop={12}
            >
              <Text style={{ color: c.secondary, fontWeight: "600", fontSize: 14 }}>Back</Text>
            </Pressable>
            <Text style={[styles.licenseModalTitle, { color: c.text }]}>License Terms</Text>
            <Pressable
              onPress={() => {
                setTermsReviewed(true);
                setShowLicenseModal(false);
              }}
              hitSlop={12}
            >
              <Text style={{ color: c.secondary, fontWeight: "600", fontSize: 14 }}>OK</Text>
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.licenseModalScroll}>
            <Text style={[styles.licenseModalText, { color: c.text }]}>{LICENSE_TERMS_TEXT}</Text>
            <Pressable
              onPress={() => {
                setTermsReviewed(true);
                setShowLicenseModal(false);
              }}
              style={[styles.licenseAgreeButton, { backgroundColor: c.accent }]}
            >
              <Text style={[styles.buttonText, { color: c.accentText }]}>OK</Text>
            </Pressable>
          </ScrollView>
        </View>
      </Modal>
      </>
    );
  }

  // Camera permission not yet granted.
  if (!permission) {
    return <View style={[styles.container, { backgroundColor: c.background }]} />;
  }
  if (!permission.granted) {
    const blocked = permission.canAskAgain === false;
    return (
      <View style={[styles.permissionScreen, { backgroundColor: c.background }]}>
        <Text style={[styles.permissionText, { color: c.text }]}>
          Photo-OP needs camera access to capture the moment.
        </Text>
        <Pressable
          onPress={() => (blocked ? Linking.openSettings() : requestPermission())}
          style={[styles.permissionButton, { backgroundColor: c.accent }]}
        >
          <Text style={[styles.buttonText, { color: c.accentText }]}>
            {blocked ? "Open settings" : "Grant camera access"}
          </Text>
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
    <View style={[styles.cameraScreen, { backgroundColor: c.background }]}>
      {isFocused ? (
        <CameraView
          ref={cameraRef}
          style={StyleSheet.absoluteFill}
          facing={facing}
          mode={mode === "video" ? "video" : "picture"}
          mute={false}
          videoQuality="720p"
          videoBitrate={VIDEO_BITRATE}
          animateShutter={false}
        />
      ) : (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: "#000" }]} />
      )}

      <View style={{ flex: 1 }} pointerEvents="none" />

      <View style={[styles.modeRow, { backgroundColor: "rgba(0,0,0,0.35)" }]}>
        <Pressable
          onPress={() => selectMode("photo")}
          disabled={isRecording}
          style={[
            styles.modePill,
            { borderColor: c.border },
            mode === "photo" && { backgroundColor: c.accent, borderColor: c.accent },
          ]}
        >
          <Text style={{ color: mode === "photo" ? c.accentText : "#fff", fontWeight: "600", fontSize: 13 }}>
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
          <Text style={{ color: mode === "video" ? c.accentText : "#fff", fontWeight: "600", fontSize: 13 }}>
            Video
          </Text>
        </Pressable>
      </View>

      <View style={[styles.cameraControls, { backgroundColor: "rgba(0,0,0,0.35)" }]}>
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
  permissionScreen: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
  },
  permissionText: { textAlign: "center", fontSize: 15, lineHeight: 22 },
  permissionButton: {
    marginTop: spacing.md,
    alignSelf: "center",
    flexGrow: 0,
    flexShrink: 0,
    borderRadius: radius.md,
    paddingVertical: spacing.sm + 4,
    paddingHorizontal: spacing.lg,
    alignItems: "center",
    justifyContent: "center",
  },
  cameraScreen: { flex: 1 },
  camera: { flex: 1 },
  consentBlock: { marginTop: spacing.xs, gap: 12 },
  consentRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  consentLink: { marginLeft: 28 },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: radius.sm,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center",
  },
  termsOkRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
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
    height: 180,
    marginHorizontal: spacing.md,
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
    borderRadius: radius.lg,
    overflow: "hidden",
  },
  reviewForm: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
    gap: spacing.sm,
  },
  captionInput: {
    minHeight: 72,
    textAlignVertical: "top",
  },
  pinnedActions: {
    flexDirection: "row",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  previewBusy: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  previewBusyText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 13,
    marginTop: spacing.xs,
  },
  licenseModal: {
    flex: 1,
    paddingTop: spacing.xl,
  },
  licenseModalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  licenseAgreeButton: {
    marginTop: spacing.lg,
    borderRadius: radius.md,
    paddingVertical: spacing.sm + 4,
    alignItems: "center",
  },
  licenseModalTitle: {
    fontSize: 17,
    fontWeight: "700",
  },
  licenseModalScroll: {
    padding: spacing.lg,
    paddingBottom: spacing.xl,
  },
  licenseModalText: {
    fontSize: 14,
    lineHeight: 21,
  },
  uploadStatus: {
    marginTop: spacing.md,
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
  aiActionsRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md, marginTop: spacing.sm },
  aiActionLink: { minHeight: 18, justifyContent: "center" },
});
