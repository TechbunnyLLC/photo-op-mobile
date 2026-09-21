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
  // The media's real pixel dimensions, set by the backend once processing
  // finishes (PostCreateMedia's Jimp/ffmpeg analysis) -- undefined while
  // still processing, or for any older record from before this was wired
  // up. Used to size feed/grid cards to the media's actual aspect ratio
  // instead of forcing everything into a fixed portrait box, which used to
  // badly crop landscape photos and videos -- see components/MediaCard.tsx.
  width?: number;
  height?: number;
  // 0-100 while a video is being watermarked/rotated server-side; unset
  // for photos (they process near-instantly) and for anything already
  // finished. See lib/useMediaProgress.ts, which polls for this.
  processingProgress?: number;
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
  // License consent (see lib/licenseTerms.ts) — recorded once, the first
  // time the uploader sets a price, alongside which version of the
  // standard license terms they agreed to. Undefined means never priced/
  // never consented (or mock mode).
  licenseConsentGiven?: boolean;
  licenseConsentAt?: string;
  licenseTermsVersion?: string;
}

export interface CurrentUser {
  id: string;
  displayName: string;
  email: string;
  avatarUrl?: string;
}
