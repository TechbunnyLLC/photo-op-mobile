# Photo-OP.ai mobile app

First mobile client for Photo-OP.ai — a double-sided marketplace for
in-the-moment photo/video media. Built with Expo (SDK 57) + expo-router +
TypeScript.

## Status

This is a scaffold, built while waiting on GitHub access to any existing
work. It runs against **mock data** (`lib/mock-data.ts`) by default — no
real backend calls are made yet. Nothing here has touched Figma; screens are
laid out to a reasonable default, not a real design.

## Structure

```
app/
  _layout.tsx          root Stack, wraps the tab navigator
  (tabs)/
    _layout.tsx         bottom tab bar: Feed / Capture / Profile
    index.tsx           Feed — scrollable list of MediaItem cards
    capture.tsx          Capture — camera/library picker + upload
    profile.tsx           Profile — placeholder until auth exists
components/
  MediaCard.tsx         feed list item (thumbnail, uploader, tags, location)
lib/
  api.ts                fetch wrapper; toggles mock vs. live via config
  config.ts             backend base URL + known AWS architecture notes
  mock-data.ts           fixture feed data
  theme.ts               color tokens (split dark/light, no pure black)
  types.ts               MediaItem / CurrentUser shapes
```

## Running it

```
npm install
npm run start   # then press i / a / w, or scan the QR code in Expo Go
```

## Wiring up the real backend

Per what's known about the AWS account (`octopus44`): the backend runs as
ECS Fargate services (`photoop-backend`, `photoop-worker`, `photoop-beat`)
behind an ALB, Django + Celery + Redis + RDS, with media in the
`photoop-media` S3 bucket and auto-tagging via AWS Rekognition.

Not yet known / needed from the backend engineer:

1. The ALB's public hostname / API domain (`EXPO_PUBLIC_API_BASE_URL`).
2. The mobile auth scheme (token? session? Cognito was ruled out — this is
   plain Django, so likely DRF token or JWT).
3. The feed endpoint's actual response shape — `lib/types.ts` is a guess
   based on the product description, not a confirmed contract.
4. The upload flow — almost certainly a presigned S3 URL issued by
   `photoop-backend`, then a metadata POST, with Rekognition tagging
   happening asynchronously on `photoop-worker`. `api.uploadMedia()` is a
   stub until this is confirmed.

Once those are known, set `EXPO_PUBLIC_USE_MOCK_API=false` and
`EXPO_PUBLIC_API_BASE_URL=...`, and fill in the real request logic in
`lib/api.ts`.

## Git

A local git repo has already been initialized here (not yet pushed
anywhere). Once the new GitHub repo for the mobile app exists, this is
ready to push as-is:

```
git remote add origin <new-repo-url>
git branch -M main
git add -A
git commit -m "Initial Expo scaffold for Photo-OP.ai mobile app"
git push -u origin main
```
