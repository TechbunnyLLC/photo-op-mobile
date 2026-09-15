import type { MediaItem } from "./types";

// Placeholder feed data so the UI is workable before the real API is wired
// up. Delete once lib/api.ts talks to the live backend.
export const MOCK_FEED: MediaItem[] = [
  {
    id: "1",
    mediaType: "photo",
    url: "https://picsum.photos/seed/photoop1/800/1000",
    thumbnailUrl: "https://picsum.photos/seed/photoop1/400/500",
    caption: "Courtside, second half.",
    tags: ["Arena", "Crowd", "Basketball"],
    uploader: { id: "u1", displayName: "jordan.k" },
    location: { label: "Chase Center, SF", lat: 37.768, lng: -122.3878 },
    createdAt: new Date(Date.now() - 1000 * 60 * 12).toISOString(),
  },
  {
    id: "2",
    mediaType: "photo",
    url: "https://picsum.photos/seed/photoop2/800/1000",
    thumbnailUrl: "https://picsum.photos/seed/photoop2/400/500",
    caption: "Encore.",
    tags: ["Concert", "Stage", "Lights"],
    uploader: { id: "u2", displayName: "maya_p" },
    location: { label: "The Fillmore, SF", lat: 37.784, lng: -122.4332 },
    createdAt: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
  },
  {
    id: "3",
    mediaType: "photo",
    url: "https://picsum.photos/seed/photoop3/800/1000",
    thumbnailUrl: "https://picsum.photos/seed/photoop3/400/500",
    caption: "Finish line.",
    tags: ["Race", "Outdoors", "Crowd"],
    uploader: { id: "u3", displayName: "devon.r" },
    createdAt: new Date(Date.now() - 1000 * 60 * 90).toISOString(),
  },
];
