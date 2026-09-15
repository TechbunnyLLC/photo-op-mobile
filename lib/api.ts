import { API_BASE_URL, USE_MOCK_API } from "./config";
import { MOCK_FEED } from "./mock-data";
import type { MediaItem } from "./types";

class ApiError extends Error {
  status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });

  if (!res.ok) {
    throw new ApiError(`Request to ${path} failed`, res.status);
  }

  return res.json() as Promise<T>;
}

function delay<T>(value: T, ms = 400): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

export const api = {
  async getFeed(): Promise<MediaItem[]> {
    if (USE_MOCK_API) return delay(MOCK_FEED);
    return request<MediaItem[]>("/v1/feed");
  },

  // Uploads a captured/selected asset. Real implementation will need a
  // presigned S3 URL flow against the photoop-media bucket, then a
  // metadata POST once Rekognition tagging completes on photoop-worker.
  async uploadMedia(localUri: string, caption?: string): Promise<MediaItem> {
    if (USE_MOCK_API) {
      const item: MediaItem = {
        id: `local-${Date.now()}`,
        mediaType: "photo",
        url: localUri,
        thumbnailUrl: localUri,
        caption,
        tags: [],
        uploader: { id: "me", displayName: "you" },
        createdAt: new Date().toISOString(),
      };
      return delay(item, 800);
    }

    throw new ApiError("uploadMedia not implemented against the live API yet");
  },
};

export { ApiError };
