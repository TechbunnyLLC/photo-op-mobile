import { generateClient } from "aws-amplify/api";
import { USE_MOCK_API } from "./config";
import * as mutations from "./graphql/mutations";
import * as queries from "./graphql/queries";
import { MOCK_FEED } from "./mock-data";
import type { MediaItem } from "./types";

const client = generateClient();

function delay<T>(value: T, ms = 400): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

// Raw shape returned by the backend's Media type — snake-free but not
// quite what the UI wants (see lib/types.ts for the UI-facing MediaItem).
interface BackendMedia {
  id: string;
  mediaType: string | null;
  imageUrl: string | null;
  imageKey: string;
  description: string;
  arrayTags: string[];
  owner: string | null;
  city: string | null;
  lat: number | null;
  long: number | null;
  createdAt: string | null;
}

function toMediaItem(m: BackendMedia): MediaItem {
  return {
    id: m.id,
    mediaType: m.mediaType === "video" ? "video" : "photo",
    url: m.imageUrl ?? "",
    thumbnailUrl: m.imageUrl ?? "",
    caption: m.description,
    tags: m.arrayTags ?? [],
    uploader: {
      // owner is stored as "<cognitoId>::<username>" by Amplify's
      // owner-based auth; split it rather than showing the raw value.
      id: m.owner?.split("::")[0] ?? "unknown",
      displayName: m.owner?.split("::")[1] ?? "unknown",
    },
    location: m.city ? { label: m.city, lat: m.lat ?? 0, lng: m.long ?? 0 } : undefined,
    createdAt: m.createdAt ?? new Date().toISOString(),
  };
}

export const api = {
  async getFeed(): Promise<MediaItem[]> {
    if (USE_MOCK_API) return delay(MOCK_FEED);

    const result = (await client.graphql({
      query: queries.listMediaSortByDate,
      variables: { type: "Media", sortDirection: "DESC", limit: 30 },
    })) as { data: { listMediaSortByDate: { items: BackendMedia[] } } };
    const items = result.data.listMediaSortByDate.items;
    return items.map(toMediaItem);
  },

  // Creates the Media record. Actual file upload (lib/storage.ts) and
  // tagging (lib/tagging.ts) are separate steps the caller runs first/after
  // — see app/(tabs)/capture.tsx for the full sequence.
  async createMedia(input: {
    imageKey: string;
    imageUrl: string;
    mediaType: "image" | "video";
    description: string;
    lat?: number;
    long?: number;
    city?: string;
  }): Promise<MediaItem> {
    if (USE_MOCK_API) {
      const item: MediaItem = {
        id: `local-${Date.now()}`,
        mediaType: input.mediaType === "video" ? "video" : "photo",
        url: input.imageUrl,
        thumbnailUrl: input.imageUrl,
        caption: input.description,
        tags: [],
        uploader: { id: "me", displayName: "you" },
        createdAt: new Date().toISOString(),
      };
      return delay(item, 800);
    }

    const result = (await client.graphql({
      query: mutations.createMedia,
      variables: { input: { ...input, status: "draft" } },
    })) as { data: { createMedia: BackendMedia } };
    return toMediaItem(result.data.createMedia);
  },

  async updateTags(mediaId: string, arrayTags: string[]): Promise<void> {
    if (USE_MOCK_API) return;
    await client.graphql({
      query: mutations.updateMediaTags,
      variables: { input: { id: mediaId, arrayTags, isGeneratedAITags: true } },
    });
  },

  async likeMedia(mediaId: string): Promise<void> {
    if (USE_MOCK_API) return;
    await client.graphql({ query: mutations.likeMedia, variables: { mediaId } });
  },

  async unlikeMedia(mediaId: string): Promise<void> {
    if (USE_MOCK_API) return;
    await client.graphql({ query: mutations.unlikeMedia, variables: { mediaId } });
  },
};
