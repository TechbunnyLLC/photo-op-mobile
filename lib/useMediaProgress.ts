import { useEffect, useState } from "react";
import { api } from "./api";
import type { MediaItem } from "./types";

// How often to re-fetch a still-processing video's Media record. The
// backend (PostCreateMedia) only writes a new processingProgress value in
// ~5-point jumps (see index.js's reportProgress), so polling much faster
// than this wouldn't surface anything new -- this cadence keeps the bar
// feeling live without hammering the API for the 30-40s an encode takes.
const POLL_INTERVAL_MS = 2500;

// Polls a single video's processing progress while it's still mid-encode
// (no thumbnail yet), and hands back a possibly-refreshed MediaItem once
// the backend finishes -- so the caller can swap in the real thumbnail
// itself rather than showing a bar stuck at 100% with no image. A no-op
// for photos and for anything that's already done (both process near-
// instantly and never have a use for polling).
export function useMediaProgress(item: MediaItem): { progress: number | null; item: MediaItem } {
  const [liveItem, setLiveItem] = useState(item);
  const [progress, setProgress] = useState<number | null>(item.processingProgress ?? null);

  // The list/screen that renders this can hand this hook a different
  // item over time (a real re-fetch, a different item reusing the same
  // component instance in a virtualized list, etc.) -- resync when that
  // happens rather than silently keeping stale local state forever.
  useEffect(() => {
    setLiveItem(item);
    setProgress(item.processingProgress ?? null);
    // Only the identity should force a resync -- once we're polling, our
    // own fresher liveItem should win over the (now-stale) prop on every
    // subsequent render, not get clobbered back by it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.id]);

  const isDone = !!liveItem.thumbnailUrl;
  const shouldPoll = liveItem.mediaType === "video" && !isDone;

  useEffect(() => {
    if (!shouldPoll) return;
    let cancelled = false;
    const id = liveItem.id;

    const poll = async () => {
      try {
        const fresh = await api.getMedia(id);
        if (cancelled) return;
        setLiveItem(fresh);
        setProgress(fresh.processingProgress ?? null);
      } catch {
        // Best-effort -- a failed poll just tries again next tick.
      }
    };

    poll();
    const interval = setInterval(poll, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shouldPoll, liveItem.id]);

  return { progress, item: liveItem };
}
