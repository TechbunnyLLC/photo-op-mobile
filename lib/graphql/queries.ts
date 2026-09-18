// Hand-written to match github.com/PhotOp-io/backend's
// amplify/backend/api/photoop/schema.graphql. If that schema changes,
// regenerate properly with `amplify codegen` against the real API instead
// of hand-editing these.

export const mediaFields = /* GraphQL */ `
  id
  title
  description
  tags
  arrayTags
  trendingTags
  imageUrl
  imageKey
  mediaType
  status
  isGeneratedThumbnails
  _version
  owner
  createdAt
  long
  lat
  city
  capturedTime
  price
  likeCount
  saveCount
  viewCount
  fileSize
  width
  height
  categories
  copyrightText
`;

// Public feed, newest first (uses the schema's listMediaSortByDate index).
// $filter accepts a ModelMediaFilterInput — used for tag filtering
// (api.getFeed's tag param builds { arrayTags: { contains: tag } },
// which DynamoDB/AppSync resolves as "list contains this exact
// element" for a List<String> field like arrayTags, not a substring
// match — same operator next-web's own listMediaSortByDate call uses).
export const listMediaSortByDate = /* GraphQL */ `
  query ListMediaSortByDate(
    $type: String!
    $sortDirection: ModelSortDirection
    $filter: ModelMediaFilterInput
    $limit: Int
    $nextToken: String
  ) {
    listMediaSortByDate(
      type: $type
      sortDirection: $sortDirection
      filter: $filter
      limit: $limit
      nextToken: $nextToken
    ) {
      items {
        ${mediaFields}
      }
      nextToken
    }
  }
`;

// The signed-in user's own uploads.
export const myMediaSortByDate = /* GraphQL */ `
  query MyMediaSortByDate(
    $owner: String!
    $sortDirection: ModelSortDirection
    $limit: Int
    $nextToken: String
  ) {
    myMediaSortByDate(
      owner: $owner
      sortDirection: $sortDirection
      limit: $limit
      nextToken: $nextToken
    ) {
      items {
        ${mediaFields}
      }
      nextToken
    }
  }
`;

export const getMedia = /* GraphQL */ `
  query GetMedia($id: ID!) {
    getMedia(id: $id) {
      ${mediaFields}
    }
  }
`;

// Whether the signed-in user (cognitoId) already likes a given media item —
// LikeMedia's primary key is cognitoId + mediaId, so this is a direct
// point lookup, not a scan/filter. Returns null (not an error) when no
// such like exists.
export const getLikeMedia = /* GraphQL */ `
  query GetLikeMedia($cognitoId: ID!, $mediaId: ID!) {
    getLikeMedia(cognitoId: $cognitoId, mediaId: $mediaId) {
      cognitoId
      mediaId
    }
  }
`;

// The signed-in user's own record in the User table — separate from
// Cognito. Holds the "system generated" username the backend's
// PostConfirmation Lambda creates at sign-up (see
// amplify/backend/function/.../generate-username.js in the backend repo:
// firstName + first letter of lastName + 5 random digits), which is what
// lib/media.ts's getDefaultCopyright signs new posts with by default.
export const getUser = /* GraphQL */ `
  query GetUser($cognitoId: ID!) {
    getUser(cognitoId: $cognitoId) {
      cognitoId
      username
      profileImageKey
      _version
    }
  }
`;

// Used to check a candidate username isn't already taken before saving it
// (see lib/api.ts's isUsernameTaken) — mirrors next-web's
// validateUsername service. There's no uniqueness index on User.username
// in the schema, so this is a best-effort client-side check, same as web.
// Doubles as the uniqueness check (lib/api.ts's isUsernameTaken) and the
// public-profile lookup (getUserByUsername) — both just need "find the
// User record with this username", the only difference is which fields
// they read back. Never add email here: this is reachable by anyone
// viewing a public profile, and next-web's own [username] page shows the
// uploader's email on the equivalent public page today — don't repeat
// that leak here.
export const listUsersByUsername = /* GraphQL */ `
  query ListUsersByUsername($filter: ModelUserFilterInput, $limit: Int) {
    listUsers(filter: $filter, limit: $limit) {
      items {
        cognitoId
        username
        profileImageKey
        createdAt
      }
    }
  }
`;
