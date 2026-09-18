export interface MediaItem {
  id: string;
  mediaType: "photo" | "video";
  url: string;
  thumbnailUrl: string;
  title?: string;
  caption?: string;
  // Rekognition-detected labels, e.g. ["Concert", "Crowd", "Stage"]
  tags: string[];
  // Platform-assigned categories (distinct from the freeform/AI tags above)
  categories?: string[];
  uploader: {
    id: string;
    displayName: string;
    avatarUrl?: string;
  };
  location?: {
    label: string;
    lat: number;
    lng: number;
  };
  createdAt: string;
  capturedTime?: string;
  // Already implemented on the backend (Media.price) — asset pricing, shown
  // on the media detail screen. Undefined/0 means not for sale / free.
  price?: number;
  likeCount?: number;
  saveCount?: number;
  viewCount?: number;
  // Auto-generated as "photo-op.ai/@<handle>" at upload time (see
  // lib/media.ts's getDefaultCopyright) and burned into the watermarked
  // derivative by the backend; editable afterward by the uploader from the
  // media detail screen.
  copyrightText?: string;
  // Amplify's conflict-detection version for this record (this API has
  // conflictResolution: AUTOMERGE enabled — see amplify/backend/api/photoop
  // /cli-inputs.json in the backend repo). Not for display; only needed so
  // a follow-up update mutation (e.g. api.markMediaPending) can include it.
  // Undefined in mock mode, where there's no real backend record.
  _version?: number;
}

export interface CurrentUser {
  id: string;
  displayName: string;
  email: string;
  avatarUrl?: string;
}
