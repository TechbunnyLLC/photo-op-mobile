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
`;

// Public feed, newest first (uses the schema's listMediaSortByDate index).
export const listMediaSortByDate = /* GraphQL */ `
  query ListMediaSortByDate(
    $type: String!
    $sortDirection: ModelSortDirection
    $limit: Int
    $nextToken: String
  ) {
    listMediaSortByDate(
      type: $type
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
