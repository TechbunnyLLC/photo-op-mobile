import { generateClient } from "aws-amplify/api";
import { MEDIA_BUCKET, USE_MOCK_API } from "./config";
import { topTags } from "./media";
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
  title: string | null;
  mediaType: string | null;
  imageUrl: string | null;
  imageKey: string;
  description: string;
  arrayTags: string[];
  categories: (string | null)[] | null;
  isGeneratedThumbnails: boolean | null;
  processingProgress: number | null;
  width: number | null;
  height: number | null;
  _version: number | null;
  owner: string | null;
  city: string | null;
  lat: number | null;
  long: number | null;
  createdAt: string | null;
  capturedTime: string | null;
  price: number | null;
  likeCount: number | null;
  saveCount: number | null;
  viewCount: number | null;
  copyrightText: string | null;
  licenseConsentGiven: boolean | null;
  licenseConsentAt: string | null;
  licenseTermsVersion: string | null;
}

function toMediaItem(m: BackendMedia): MediaItem {
  // owner is stored in DynamoDB as "<cognitoId>::<username>", but AppSync's
  // owner-auth resolver returns just the bare cognitoId to the client, not
  // the composite — there's no username in this field to split out. Older
  // records with no owner at all fall back to "Unknown".
  const ownerId = m.owner?.split("::")[0] || null;
  const isVideo = m.mediaType === "video";

  // imageUrl/imageKey point at the RAW upload the client sent, at
  // public/<imageKey> — no watermark, no copyright logo, nothing burned
  // in. The backend's PostCreateMedia Lambda (both the image and video
  // branches — see amplify/backend/function/PostCreateMedia/src/index.js)
  // composites the watermark + bottom-left "© photo-op.ai/@handle" logo
  // and uploads that as a SEPARATE object at public/wmc/<imageKey>,
  // leaving the raw original untouched. So the raw URL was never the
  // watermarked version — the app just hadn't been pointed at the
  // wmc/ copy yet. isGeneratedThumbnails flips true (via the same
  // updateMediaStatus call, for both images and video) once that
  // Lambda finishes, so it doubles as "the watermarked variant exists
  // now" — use it as that signal and fall back to the raw upload only
  // while processing is still in flight, right after posting.
  const watermarkedUrl = `https://${MEDIA_BUCKET}.s3.amazonaws.com/public/wmc/${m.imageKey}`;
  const displayUrl = m.isGeneratedThumbnails ? watermarkedUrl : (m.imageUrl ?? "");

  // Videos additionally get a still poster frame extracted for feed/grid
  // thumbnails (see PostCreateMedia/src/services/video.js), at
  // public/thumbnails/800/<imageKey without its extension>.jpg. Photos
  // don't need a separate thumbnail — the (now watermarked) image itself
  // is already the right size to show directly.
  const thumbnailUrl = isVideo
    ? m.isGeneratedThumbnails
      ? `https://${MEDIA_BUCKET}.s3.amazonaws.com/public/thumbnails/800/${m.imageKey.replace(/\.[^./]+$/, "")}.jpg`
      : ""
    : displayUrl;

  return {
    id: m.id,
    mediaType: isVideo ? "video" : "photo",
    url: displayUrl,
    thumbnailUrl,
    title: m.title ?? undefined,
    caption: m.description,
    _version: m._version ?? undefined,
    tags: topTags(m.arrayTags ?? []),
    processingProgress: m.processingProgress ?? undefined,
    categories: (m.categories ?? []).filter((c): c is string => !!c),
    uploader: {
      id: ownerId ?? "unknown",
      // No display-name field exists on Media/owner today — show a short
      // id fragment rather than a flatly wrong "unknown" for every real
      // post. See README for the real fix (join against the User table).
      displayName: ownerId ? `user-${ownerId.slice(0, 8)}` : "Unknown",
    },
    location: m.city ? { label: m.city, lat: m.lat ?? 0, lng: m.long ?? 0 } : undefined,
    createdAt: m.createdAt ?? new Date().toISOString(),
    capturedTime: m.capturedTime ?? undefined,
    width: m.width ?? undefined,
    height: m.height ?? undefined,
    price: m.price ?? undefined,
    likeCount: m.likeCount ?? 0,
    saveCount: m.saveCount ?? 0,
    viewCount: m.viewCount ?? 0,
    copyrightText: m.copyrightText ?? undefined,
    licenseConsentGiven: m.licenseConsentGiven ?? undefined,
    licenseConsentAt: m.licenseConsentAt ?? undefined,
    licenseTermsVersion: m.licenseTermsVersion ?? undefined,
  };
}

export const api = {
  // The signed-in user's own uploads, for the Profile screen.
  //
  // myMediaSortByDate's $owner partition key must be the FULL composite
  // value DynamoDB actually stores ("<cognitoSub>::<cognitoSub>" — this
  // pool's username is always the sub itself, confirmed against real
  // records), even though reading `owner` back off a Media item only
  // ever returns the bare sub (see toMediaItem). ownerId here is that
  // bare sub — i.e. AuthUser.userId from lib/auth.ts.
  async getMyMedia(ownerId: string): Promise<MediaItem[]> {
    if (USE_MOCK_API) {
      return delay(MOCK_FEED.filter((item) => item.uploader.id === "me"));
    }

    const result = (await client.graphql({
      query: queries.myMediaSortByDate,
      variables: { owner: `${ownerId}::${ownerId}`, sortDirection: "DESC", limit: 30 },
    })) as { data: { myMediaSortByDate: { items: BackendMedia[] } } };
    const items = result.data.myMediaSortByDate.items;
    return items.map(toMediaItem);
  },

  // tag, when given, filters server-side to posts whose arrayTags list
  // contains that exact tag (see queries.ts's listMediaSortByDate comment
  // — DynamoDB's list-contains, not a substring match), so this reaches
  // posts beyond whatever's in the current 30-item page, not just the
  // ones already loaded on screen.
  async getFeed(tag?: string): Promise<MediaItem[]> {
    if (USE_MOCK_API) {
      if (!tag) return delay(MOCK_FEED);
      return delay(MOCK_FEED.filter((item) => item.tags.includes(tag)));
    }

    const result = (await client.graphql({
      query: queries.listMediaSortByDate,
      variables: {
        type: "Media",
        sortDirection: "DESC",
        limit: 30,
        ...(tag ? { filter: { arrayTags: { contains: tag } } } : {}),
      },
    })) as { data: { listMediaSortByDate: { items: BackendMedia[] } } };
    const items = result.data.listMediaSortByDate.items;
    return items.map(toMediaItem);
  },

  // Single media item, for the media detail screen (app/media/[id].tsx).
  async getMedia(id: string): Promise<MediaItem> {
    if (USE_MOCK_API) {
      const item = MOCK_FEED.find((m) => m.id === id);
      if (!item) throw new Error("Media not found");
      return delay(item);
    }

    const result = (await client.graphql({
      query: queries.getMedia,
      variables: { id },
    })) as { data: { getMedia: BackendMedia | null } };
    if (!result.data.getMedia) throw new Error("Media not found");
    return toMediaItem(result.data.getMedia);
  },

  // Creates the Media record. Actual file upload (lib/storage.ts) and
  // tagging (lib/tagging.ts) are separate steps the caller runs first/after
  // — see app/(tabs)/capture.tsx for the full sequence.
  async createMedia(input: {
    imageKey: string;
    imageUrl: string;
    mediaType: "image" | "video";
    description: string;
    // Optional title, collected on the capture/review screen. Editable
    // afterward too -- see updateMediaTitle.
    title?: string;
    lat?: number;
    long?: number;
    city?: string;
    // Auto-filled by the caller from lib/media.ts's getDefaultCopyright —
    // "photo-op.ai/@<handle>" — before this is called. See capture.tsx.
    copyrightText?: string;
    // Optional asking price — pricing itself is fully implemented on the
    // backend (Media.price); this just lets the uploader set it at post
    // time. Omitted/undefined means not for sale, same as $0.
    price?: number;
    // Set together, once, the first time a price is set (see
    // lib/licenseTerms.ts and the consent checkbox in capture.tsx) — the
    // uploader's agreement to license this item under Photo-OP's
    // standard terms, and which version of those terms they agreed to.
    licenseConsentGiven?: boolean;
    licenseConsentAt?: string;
    licenseTermsVersion?: string;
  }): Promise<MediaItem> {
    if (USE_MOCK_API) {
      const item: MediaItem = {
        id: `local-${Date.now()}`,
        mediaType: input.mediaType === "video" ? "video" : "photo",
        url: input.imageUrl,
        thumbnailUrl: input.imageUrl,
        caption: input.description,
        title: input.title,
        tags: [],
        categories: [],
        uploader: { id: "me", displayName: "you" },
        createdAt: new Date().toISOString(),
        copyrightText: input.copyrightText,
        price: input.price,
        likeCount: 0,
        saveCount: 0,
        viewCount: 0,
        licenseConsentGiven: input.licenseConsentGiven,
        licenseConsentAt: input.licenseConsentAt,
        licenseTermsVersion: input.licenseTermsVersion,
      };
      return delay(item, 800);
    }

    const result = (await client.graphql({
      query: mutations.createMedia,
      // arrayTags is `[String!]!` (required, non-null) in the backend
      // schema — omitting it coerces to null and AppSync rejects the
      // mutation ("coerced Null value for NonNull type"). Tagging (when
      // ENABLE_CLIENT_TAGGING is on) fills it in afterwards via
      // updateTags, so it always starts empty here.
      variables: { input: { ...input, arrayTags: [], status: "draft" } },
    })) as { data: { createMedia: BackendMedia } };
    return toMediaItem(result.data.createMedia);
  },

  // Fires the backend's video-processing Lambda (see the comment on
  // mutations.updateMediaStatus). Call this right after createMedia for
  // videos only — images process automatically and don't need it.
  //
  // version must be the _version createMedia's response returned for this
  // record. This API has conflictResolution: AUTOMERGE enabled, which
  // expects update mutations to carry the record's current _version —
  // omitting it risks the resolver rejecting or silently no-op'ing the
  // write (which is exactly what was happening before this was added:
  // status stayed stuck on "draft" even though the mutation call itself
  // didn't throw).
  async markMediaPending(mediaId: string, version?: number): Promise<void> {
    if (USE_MOCK_API) return;
    await client.graphql({
      query: mutations.updateMediaStatus,
      variables: { input: { id: mediaId, status: "pending", _version: version } },
    });
  },

  // version must be the _version the record had when this call is made
  // (createMedia's response, right after posting, or media._version off
  // the detail screen for a manual edit). This API has
  // conflictResolution: AUTOMERGE enabled, which silently rejects/no-ops
  // any update mutation missing _version — that's exactly why tagging
  // looked like it "did nothing": Rekognition ran fine, but this write
  // back to the record was dropped with no error surfaced anywhere.
  //
  // isGeneratedAITags tracks whether these tags came from Rekognition
  // (capture.tsx's post-upload call, the default) or the uploader typed/
  // edited them by hand (app/media/[id].tsx's edit-tags UI passes false)
  // — mirrors the same flag next-web sets, minus the AI attribution once
  // a person has touched the list.
  async updateTags(
    mediaId: string,
    arrayTags: string[],
    version?: number,
    isGeneratedAITags: boolean = true
  ): Promise<void> {
    if (USE_MOCK_API) return;
    await client.graphql({
      query: mutations.updateMediaTags,
      variables: { input: { id: mediaId, arrayTags, isGeneratedAITags, _version: version } },
    });
  },

  // Lets the uploader override the auto-generated credit line after the
  // fact — see lib/media.ts's getDefaultCopyright and the ownership check
  // in app/media/[id].tsx.
  async updateMediaCopyright(mediaId: string, copyrightText: string, version?: number): Promise<void> {
    if (USE_MOCK_API) return;
    await client.graphql({
      query: mutations.updateMediaCopyright,
      variables: { input: { id: mediaId, copyrightText, _version: version } },
    });
  },

  // Saves a custom title -- mirrors updateMediaCopyright's pattern. See
  // lib/graphql/mutations.ts's updateMediaTitle comment for why this
  // exists (capture.tsx never collects one up front).
  async updateMediaTitle(mediaId: string, title: string, version?: number): Promise<void> {
    if (USE_MOCK_API) return;
    await client.graphql({
      query: mutations.updateMediaTitle,
      variables: { input: { id: mediaId, title, _version: version } },
    });
  },

  // Saves the uploader's asking price after the fact — mirrors
  // updateMediaCopyright's pattern. Pricing itself already exists on the
  // backend; capture.tsx sets it at post time and this covers changing it
  // later from the media detail screen.
  // consent, when passed, is stamped in the SAME mutation call/version
  // bump as the price change — see lib/licenseTerms.ts. Only pass it the
  // first time a post gets a price (media/[id].tsx and capture.tsx both
  // check media.licenseConsentGiven / a fresh post's lack of one before
  // asking for it again).
  async updateMediaPrice(
    mediaId: string,
    price: number,
    version?: number,
    consent?: { licenseTermsVersion: string }
  ): Promise<void> {
    if (USE_MOCK_API) return;
    await client.graphql({
      query: mutations.updateMediaPrice,
      variables: {
        input: {
          id: mediaId,
          price,
          _version: version,
          ...(consent
            ? {
                licenseConsentGiven: true,
                licenseConsentAt: new Date().toISOString(),
                licenseTermsVersion: consent.licenseTermsVersion,
              }
            : {}),
        },
      },
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

  // Whether the signed-in user already likes this media item — a direct
  // point lookup (LikeMedia's key is cognitoId + mediaId), not a scan.
  async isMediaLikedByMe(mediaId: string, cognitoId: string): Promise<boolean> {
    if (USE_MOCK_API) return false;
    const result = (await client.graphql({
      query: queries.getLikeMedia,
      variables: { cognitoId, mediaId },
    })) as { data: { getLikeMedia: { cognitoId: string } | null } };
    return !!result.data.getLikeMedia;
  },

  // Whether the signed-in user already bought this media item — gates the
  // Buy button on the media detail screen (see lib/payment.ts for the
  // actual checkout call). "pending" counts as already-purchased too, so
  // the Buy button doesn't reappear mid-purchase while Stripe's webhook
  // is still marking the PaymentMedia record "paid".
  async hasUserPurchasedMedia(mediaId: string, cognitoId: string): Promise<boolean> {
    if (USE_MOCK_API) return false;
    const result = (await client.graphql({
      query: queries.getPaymentMediaByUser,
      variables: { cognitoId, mediaId: { eq: mediaId } },
    })) as { data: { getPaymentMediaByUser: { items: { mediaId: string; status: string | null }[] } } };
    return result.data.getPaymentMediaByUser.items.length > 0;
  },

  // The signed-in user's User-table record — holds the "system generated"
  // username from the PostConfirmation Lambda and the profile picture key
  // (see lib/graphql/queries.ts). Returns null in mock mode / for a
  // brand-new account whose User record hasn't landed yet — callers fall
  // back to lib/media.ts's handleFromEmail in that case.
  async getUserProfile(
    cognitoId: string
  ): Promise<{ username: string | null; profileImageKey: string | null; version?: number } | null> {
    if (USE_MOCK_API) return null;
    const result = (await client.graphql({
      query: queries.getUser,
      variables: { cognitoId },
    })) as {
      data: {
        getUser: {
          cognitoId: string;
          username: string | null;
          profileImageKey: string | null;
          _version: number | null;
        } | null;
      };
    };
    const u = result.data.getUser;
    if (!u) return null;
    return { username: u.username, profileImageKey: u.profileImageKey, version: u._version ?? undefined };
  },

  // Best-effort uniqueness check before saving a custom username — mirrors
  // next-web's validateUsername service. There's no uniqueness index on
  // User.username in the schema, so this is a client-side filter query,
  // same tradeoff web makes.
  async isUsernameTaken(username: string, excludingCognitoId: string): Promise<boolean> {
    if (USE_MOCK_API) return false;
    const result = (await client.graphql({
      query: queries.listUsersByUsername,
      variables: {
        filter: {
          username: { eq: username },
          cognitoId: { ne: excludingCognitoId },
        },
        limit: 1,
      },
    })) as { data: { listUsers: { items: { cognitoId: string }[] } } };
    return result.data.listUsers.items.length > 0;
  },

  // Resolves a public profile route (app/profile/[username].tsx) to the
  // account behind it. Same listUsers-filtered-by-username lookup as
  // next-web's getUserDetailsByUsernameServerSide, but the query
  // (lib/graphql/queries.ts's listUsersByUsername) deliberately never asks
  // for email — see that query's comment.
  async getUserByUsername(
    username: string
  ): Promise<{ cognitoId: string; username: string; profileImageKey: string | null; createdAt: string | null } | null> {
    if (USE_MOCK_API) return null;
    const result = (await client.graphql({
      query: queries.listUsersByUsername,
      variables: { filter: { username: { eq: username.toLowerCase() } }, limit: 1 },
    })) as {
      data: {
        listUsers: {
          items: { cognitoId: string; username: string | null; profileImageKey: string | null; createdAt: string | null }[];
        };
      };
    };
    const u = result.data.listUsers.items[0];
    if (!u || !u.username) return null;
    return { cognitoId: u.cognitoId, username: u.username, profileImageKey: u.profileImageKey, createdAt: u.createdAt };
  },

  // Shared low-level User-record patch — both updateUsername and
  // updateProfilePicture go through this so they stay on one mutation and
  // one conflict-resolution (_version) path.
  async updateUserProfile(
    cognitoId: string,
    patch: { username?: string; profileImageKey?: string },
    version?: number
  ): Promise<{ username: string | null; profileImageKey: string | null; version?: number }> {
    if (USE_MOCK_API) {
      return { username: patch.username ?? null, profileImageKey: patch.profileImageKey ?? null, version };
    }
    const result = (await client.graphql({
      query: mutations.updateUser,
      variables: { input: { cognitoId, ...patch, _version: version } },
    })) as {
      data: {
        updateUser: { username: string | null; profileImageKey: string | null; _version: number | null };
      };
    };
    const u = result.data.updateUser;
    return { username: u.username, profileImageKey: u.profileImageKey, version: u._version ?? undefined };
  },

  // Saves a customized username over the system-generated default. Caller
  // (the Profile screen, via lib/auth-context.tsx) is expected to have
  // already checked isUsernameTaken.
  async updateUsername(
    cognitoId: string,
    username: string,
    version?: number
  ): Promise<{ username: string | null; version?: number }> {
    const result = await this.updateUserProfile(cognitoId, { username }, version);
    return { username: result.username, version: result.version };
  },

  // Saves a newly uploaded profile picture's S3 key (see
  // lib/auth-context.tsx's updateProfilePicture for the upload step).
  async updateProfileImage(
    cognitoId: string,
    profileImageKey: string,
    version?: number
  ): Promise<{ profileImageKey: string | null; version?: number }> {
    const result = await this.updateUserProfile(cognitoId, { profileImageKey }, version);
    return { profileImageKey: result.profileImageKey, version: result.version };
  },

  // Deletes a post. Media's owner @auth rule grants the uploader full CRUD
  // (see the backend schema), so this is a plain delete — no separate
  // permission call needed beyond the ownership check already done
  // client-side (app/media/[id].tsx's isOwner).
  async deleteMedia(mediaId: string, version?: number): Promise<void> {
    if (USE_MOCK_API) return;
    await client.graphql({
      query: mutations.deleteMedia,
      variables: { input: { id: mediaId, _version: version } },
    });
  },
};
