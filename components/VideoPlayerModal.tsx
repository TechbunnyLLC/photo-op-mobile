import { useVideoPlayer, VideoView } from "expo-video";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";

// Full-screen tap-to-play viewer for a posted video. Used from both the
// Feed (MediaCard) and Profile's uploads grid so there's one player
// implementation instead of two.
export function VideoPlayerModal({ uri, onClose }: { uri: string; onClose: () => void }) {
  const player = useVideoPlayer(uri, (p) => {
    p.play();
  });

  return (
    <Modal visible animationType="fade" onRequestClose={onClose}>
      <View style={styles.container}>
        <VideoView player={player} style={styles.video} nativeControls contentFit="contain" />
        <Pressable onPress={onClose} style={styles.closeButton} hitSlop={12}>
          <Text style={styles.closeText}>✕</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000", justifyContent: "center" },
  video: { width: "100%", height: "100%" },
  closeButton: {
    position: "absolute",
    top: 56,
    right: 20,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  closeText: { color: "#fff", fontSize: 16, fontWeight: "600" },
});
