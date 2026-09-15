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
