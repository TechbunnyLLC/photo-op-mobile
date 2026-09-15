export interface MediaItem {
  id: string;
  mediaType: "photo" | "video";
  url: string;
  thumbnailUrl: string;
  caption?: string;
  // Rekognition-detected labels, e.g. ["Concert", "Crowd", "Stage"]
  tags: string[];
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
}

export interface CurrentUser {
  id: string;
  displayName: string;
  email: string;
  avatarUrl?: string;
}
