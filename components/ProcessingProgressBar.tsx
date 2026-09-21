import { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, View, useColorScheme } from "react-native";
import { radius, resolveTheme } from "../lib/theme";

// Shown under the "Processing…" / "Video processing…" placeholder text
// wherever a media item hasn't finished backend processing yet (feed
// cards, profile grid thumbnails, the media detail screen).
//
// PostCreateMedia now reports real ffmpeg encode progress onto
// Media.processingProgress (0-100) while a video is mid-encode, and
// lib/useMediaProgress.ts polls for it -- when a caller has a number for
// `progress`, this renders a real, determinate fill. Photos never get a
// progress value (they process near-instantly and the field is never
// set for them), and a video's first render or first poll tick can also
// land before any progress has been written yet -- in either case
// `progress` is undefined/null and this falls back to the original
// indeterminate animation (a highlight segment sliding across the
// track, looping) rather than showing a bar stuck at 0%.
export function ProcessingProgressBar({
  trackColor,
  barColor,
  progress,
}: {
  // Defaults follow the current theme -- pass explicit colors when this
  // sits on a fixed dark background (e.g. media/[id].tsx's black video
  // placeholder) rather than a themed surface.
  trackColor?: string;
  barColor?: string;
  // 0-100. Omit (or pass null/undefined) for the indeterminate animation.
  progress?: number | null;
}) {
  const scheme = useColorScheme();
  const c = resolveTheme(scheme);
  const anim = useRef(new Animated.Value(0)).current;
  const determinate = typeof progress === "number" && !Number.isNaN(progress);

  useEffect(() => {
    if (determinate) return;
    const loop = Animated.loop(
      Animated.timing(anim, {
        toValue: 1,
        duration: 1100,
        easing: Easing.inOut(Easing.ease),
        // Animating `left` (a layout property, not transform/opacity) --
        // native driver only supports transform/opacity, and this is a
        // small, cheap looping animation where the JS-driven cost is a
        // non-issue.
        useNativeDriver: false,
      })
    );
    loop.start();
    return () => loop.stop();
  }, [anim, determinate]);

  const left = anim.interpolate({ inputRange: [0, 1], outputRange: ["-40%", "100%"] });

  return (
    <View style={[styles.track, { backgroundColor: trackColor ?? c.border }]}>
      {determinate ? (
        <View
          style={[
            styles.segment,
            {
              left: 0,
              width: `${Math.min(100, Math.max(0, progress as number))}%`,
              backgroundColor: barColor ?? c.accent,
            },
          ]}
        />
      ) : (
        <Animated.View style={[styles.segment, { left, backgroundColor: barColor ?? c.accent }]} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    width: "100%",
    height: 6,
    borderRadius: radius.pill,
    overflow: "hidden",
    marginTop: 6,
  },
  segment: {
    position: "absolute",
    width: "40%",
    height: "100%",
    borderRadius: radius.pill,
  },
});
