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

`lib/amplify-config.ts` is filled in with real values for the **test**
environment (stack `amplify-photoop-test-94334`, App ID `dhio6clqqxihz`,
AWS account `652453621243`, region `us-west-2`), pulled directly via the
AWS CLI (Cognito User Pool + Identity Pool, AppSync GraphQL API, S3
bucket). To switch to `prod`, pull the equivalent prod values the same
way (or via `amplify pull --appId dhio6clqqxihz --envName prod` from
within a checkout of the `backend` repo) and swap them into
`lib/amplify-config.ts`.

To actually hit AWS instead of local mock data, set
`EXPO_PUBLIC_USE_MOCK_API=false` — this repo's `.env` (gitignored) already
has it set. Delete or edit `.env` to switch back to mock mode.

### The tagging gap

The backend has no server-side auto-tagging step. In the original app, the
client calls Amplify's Predictions category (Rekognition-backed) directly
after upload, then writes the tags back onto `Media.arrayTags` itself.
Amplify's current unified JS library (v6) dropped the Predictions category,
so `lib/tagging.ts` calls Rekognition directly via `@aws-sdk/client-rekognition`.

**Currently disabled** (`ENABLE_CLIENT_TAGGING = false` in `lib/config.ts`).
The official SDK package bundles a string of Node.js-only internals
unconditionally — a dead credentials fallback, a dead default HTTP
handler, an os/process-based user-agent builder, and (the current blocker)
a Node-only code path inside its auth-scheme resolution that crashes at
*module load time*, before any function is even called. Each has been
individually patchable via Metro resolver stubs (see `metro.config.js` and
`lib/aws-stubs/`), but they kept surfacing one layer deeper with no clear
end in sight, so tagging was switched off rather than continuing
indefinitely — upload and posting work normally without it, photos just
don't get auto-tags yet. `app/(tabs)/capture.tsx` uses a dynamic import
gated on the flag specifically so `lib/tagging.ts` (and therefore the AWS
SDK) never loads while it's off.

To revisit: either keep extending the Metro stub chain in
`lib/aws-stubs/` (whack-a-mole, no guarantee it's the last one), or
rewrite `lib/tagging.ts` to sign and call the Rekognition API directly
with `fetch()` instead of the official SDK (more upfront work, but no
Node dependencies to fight — this is probably the better long-term fix).
Also still needs `aws_cognito_identity_pool_id` set in
`amplify-config.ts`, and that identity's IAM role needs
`rekognition:DetectLabels` / `rekognition:DetectText` — worth confirming
directly, since that's a different IAM role than the ones the backend's
Lambdas run under.

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
