// See note in queries.ts — hand-written against the real schema, not
// codegen'd.

import { mediaFields } from "./queries";

// Creates the Media record after the raw file has already been uploaded to
// S3 (see lib/storage.ts). status starts at "draft"; the backend's
// PostCreateMedia Lambda (DynamoDB Streams trigger) picks up the insert
// from there to watermark/thumbnail it — that part happens automatically.
// Tagging does NOT happen automatically; see lib/tagging.ts.
export const createMedia = /* GraphQL */ `
  mutation CreateMedia($input: CreateMediaInput!) {
    createMedia(input: $input) {
      ${mediaFields}
    }
  }
`;

// Videos need one more step after createMedia: the backend's
// PostCreateMedia Lambda only watermarks/thumbnails a video on a DynamoDB
// Streams MODIFY event where status is "pending" (images process
// immediately on the INSERT from createMedia instead — see
// lib/api.ts). This flips status from "draft" to "pending" to fire that
// MODIFY event once the raw video file is sitting in S3.
export const updateMediaStatus = /* GraphQL */ `
  mutation UpdateMediaStatus($input: UpdateMediaInput!) {
    updateMedia(input: $input) {
      id
      status
    }
  }
`;

// Called once client-side Rekognition tagging (lib/tagging.ts) finishes.
export const updateMediaTags = /* GraphQL */ `
  mutation UpdateMediaTags($input: UpdateMediaInput!) {
    updateMedia(input: $input) {
      id
      arrayTags
      isGeneratedAITags
    }
  }
`;

// Lets the uploader override the auto-generated copyright/credit line
// (see lib/media.ts's getDefaultCopyright) after the fact. Mirrors
// next-web's copyrightText editing, minus its pro-plan gate — see the
// ownership check in app/media/[id].tsx for who's allowed to call this.
export const updateMediaCopyright = /* GraphQL */ `
  mutation UpdateMediaCopyright($input: UpdateMediaInput!) {
    updateMedia(input: $input) {
      id
      copyrightText
      _version
    }
  }
`;

export const likeMedia = /* GraphQL */ `
  mutation LikeMedia($mediaId: ID!) {
    likeMedia(mediaId: $mediaId) {
      cognitoId
      mediaId
    }
  }
`;

export const unlikeMedia = /* GraphQL */ `
  mutation UnlikeMedia($mediaId: ID!) {
    unlikeMedia(mediaId: $mediaId) {
      cognitoId
      mediaId
    }
  }
`;

export const saveMedia = /* GraphQL */ `
  mutation SaveMedia($mediaId: ID!) {
    saveMedia(mediaId: $mediaId) {
      cognitoId
      mediaId
    }
  }
`;

export const unSaveMedia = /* GraphQL */ `
  mutation UnSaveMedia($mediaId: ID!) {
    unSaveMedia(mediaId: $mediaId) {
      cognitoId
      mediaId
    }
  }
`;

export const increaseViewCount = /* GraphQL */ `
  mutation IncreaseViewCount($id: ID!) {
    increaseViewCount(id: $id) {
      id
      viewCount
    }
  }
`;

// Lets the user customize the system-generated username afterward (see the
// getUser query's comment). cognitoId is User's @primaryKey, not "id" —
// UpdateUserInput uses that field name directly.
export const updateUser = /* GraphQL */ `
  mutation UpdateUser($input: UpdateUserInput!) {
    updateUser(input: $input) {
      cognitoId
      username
      profileImageKey
      _version
    }
  }
`;

// Lets the uploader delete their own post — Media's owner auth rule
// permits full CRUD for the owner (see amplify/backend/api/photoop/
// schema.graphql in the backend repo), so this needs no separate
// permission check beyond the ownership check already done client-side
// (see the isOwner check in app/media/[id].tsx).
export const deleteMedia = /* GraphQL */ `
  mutation DeleteMedia($input: DeleteMediaInput!) {
    deleteMedia(input: $input) {
      id
    }
  }
`;
