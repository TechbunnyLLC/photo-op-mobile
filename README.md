# Photo-OP.ai mobile app

First mobile client for Photo-OP.ai — a double-sided marketplace for
in-the-moment photo/video media. Built with Expo (SDK 57) + expo-router +
TypeScript, wired against the real backend at
[github.com/PhotOp-io/backend](https://github.com/PhotOp-io/backend) (AWS
Amplify Gen 1: Cognito, AppSync/GraphQL, DynamoDB, S3, Lambda, OpenSearch,
Rekognition).

## Status

Sign-up, sign-in, email confirmation, a live in-app camera, upload, and
client-side tagging are all wired up end-to-end. Runs in **mock mode** by
default (`lib/config.ts`) — `lib/amplify-config.ts` still has placeholder
values, so nothing reaches AWS yet, but the whole flow (sign up → confirm →
sign in → capture → upload → tag → see it in the feed) works against
in-memory mock state right now in Expo Go. Nothing here has touched Figma;
screens are laid out to a reasonable default, not a real design.

## Structure

```
app/
  index.tsx             redirects to (auth) or (tabs) based on session state
  _layout.tsx             root Stack; loads RN polyfills, Amplify.configure(), AuthProvider
  (auth)/
    _layout.tsx             redirects signed-in users to (tabs)
    sign-in.tsx              email + password
    sign-up.tsx              email + password, min 8 chars
    confirm.tsx              email confirmation code (mock code: 123456)
  (tabs)/
    _layout.tsx             bottom tab bar; redirects signed-out users to (auth)
    index.tsx               Feed — scrollable list of MediaItem cards
    capture.tsx               Capture — live camera (expo-camera), library picker,
                               caption, upload, tag, post
    profile.tsx                real signed-in user + sign out
components/
  MediaCard.tsx           feed list item (thumbnail, uploader, tags, location)
lib/
  amplify-config.ts       Amplify client config — PLACEHOLDER, see below
  auth.ts                 sign-up/confirm/sign-in/sign-out (real Amplify Auth, or mock)
  auth-context.tsx        React context exposing auth state app-wide
  api.ts                  GraphQL operations against the real schema (or mock)
  config.ts               mock-mode toggle + derived S3 bucket name
  graphql/
    queries.ts               listMediaSortByDate, myMediaSortByDate, getMedia
    mutations.ts              createMedia, updateMediaTags, like/unlike, save/unsave
  storage.ts               S3 upload/URL helpers (Amplify Storage)
  tagging.ts               client-side Rekognition tagging (see below)
  mock-data.ts             fixture feed data
  theme.ts                 color tokens (split dark/light, no pure black)
  types.ts                 UI-facing MediaItem / CurrentUser shapes
```

## Running it

```
npm install
npm run start   # then press i / a / w, or scan the QR code in Expo Go
```

In mock mode: sign up with any email/password (8+ chars), confirm with code
`123456`, sign in, then use the Capture tab — the camera needs a real device
or simulator with camera support (the iOS Simulator's camera is a test
pattern, not a real feed, but it exercises the whole flow).

## Connecting the real backend

`lib/amplify-config.ts` needs real values from the backend's Amplify
project (App ID `dhio6clqqxihz`, AWS account `652453621243`, region
`us-west-2`) — either by running

```
amplify pull --appId dhio6clqqxihz --envName test   # or prod
```

from within a checkout of the `backend` repo (needs AWS credentials with
access to that account), and copying the generated `aws-exports.js` values
in, or by pulling the User Pool ID / AppSync endpoint & API key / S3 bucket
name from the AWS Console directly. Once those are real, flip
`EXPO_PUBLIC_USE_MOCK_API=false`.

### The tagging gap

The backend has no server-side auto-tagging step. In the original app, the
client calls Amplify's Predictions category (Rekognition-backed) directly
after upload, then writes the tags back onto `Media.arrayTags` itself.
Amplify's current unified JS library (v6) dropped the Predictions category,
so `lib/tagging.ts` calls Rekognition directly via `@aws-sdk/client-rekognition`,
using credentials from the signed-in user's Cognito Identity Pool session.
This needs `aws_cognito_identity_pool_id` set in `amplify-config.ts`, and
that identity's IAM role actually needs `rekognition:DetectLabels` /
`rekognition:DetectText` — worth confirming directly, since that's a
different IAM role than the ones the backend's Lambdas run under.

### Known gaps vs. the real schema

- `Media.owner` on the real backend is Amplify's owner-auth string
  (`"<cognitoId>::<username>"`); `lib/api.ts` splits it apart for display,
  but there's no proper user profile lookup yet (real avatar, etc.).
- Payments, subscriptions, likes/saves counters, search, and trending tags
  all have real backend support (see the architecture doc) but no UI here
  yet — the scaffold only covers auth + create + list + like/unlike so far.
- Password reset / "forgot password" isn't built yet.

## Git

Pushed to `github.com/TechbunnyLLC/photo-op-mobile`.
