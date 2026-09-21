// Ports a few of next-web's media helpers (src/utils/media.ts) to the
// mobile app: the default copyright/credit line, the share link, the
// viral-score heuristic, and the profile-picture URL convention. Kept in
// sync by hand — this app doesn't share a package with next-web.

import { MAX_TAGS, MEDIA_BUCKET } from "./config";

export function topTags(tags: string[], limit = MAX_TAGS): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of tags) {
    const tag = raw.trim();
    if (!tag) continue;
    const key = tag.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(tag);
    if (out.length >= limit) break;
  }
  return out;
}

// This app is wired to the **test** Amplify backend (see lib/config.ts).
// next-web has a staging deployment (NEXT_PUBLIC_APP_ENV=stag) pointed at
// that same test backend; photo-op.ai is next-web's PRODUCTION deployment,
// pointed at a different (prod) backend -- a shared link built with that
// domain 404s, since the media ID only exists in the test stack's
// database. Swap this to "photo-op.ai" alongside lib/config.ts's
// PAYMENT_SERVICE_URL/INTERVIEW_SERVICE_URL/DESCRIBE_MEDIA_URL if this app
// ever points at production.
const WEB_DOMAIN = "staging.photo-op.ai";

// Last-resort fallback only — used while the real username is still
// loading from the User table. See generateFallbackHandle for the
// fallback actually shown/persisted when the backend's own default is
// missing or broken.
export function handleFromEmail(email: string): string {
  return email.split("@")[0];
}

// The backend's PostConfirmation Lambda (generate-username.js in the
// backend repo) builds the "system generated" username as
// `${firstName}${lastName[0]}${5 random digits}`. Mobile sign-up
// (app/(auth)/sign-up.tsx) never collects a first/last name, so those
// Cognito attributes are empty and that formula produces the literal
// string "undefined64226" — a real bug users can see on the Profile
// screen. This detects that (and any other empty/garbage value) so
// lib/auth-context.tsx can self-heal it with generateFallbackHandle
// instead of displaying it.
export function isBrokenUsername(username: string | null | undefined): boolean {
  if (!username) return true;
  const trimmed = username.trim();
  if (!trimmed) return true;
  return /^undefined/i.test(trimmed);
}

// A clean, stable-looking replacement default — same 5-digit-suffix shape
// as the backend's own generator, just anchored to the platform name
// instead of a blank first/last name. e.g. "photoop48213".
export function generateFallbackHandle(): string {
  const digits = Math.floor(Math.random() * 90000) + 10000; // 10000-99999, matches generate-username.js's range
  return `photoop${digits}`;
}

// The handle to sign new posts with / show on Profile: the user's own
// customized (or self-healed) username once loaded — see
// lib/api.ts's getUserProfile and lib/auth-context.tsx — falling back to
// the email-derived handle only for the brief window before that's loaded.
export function getDisplayHandle(username: string | null | undefined, email: string): string {
  return username || handleFromEmail(email);
}

// e.g. "photo-op.ai/@gregargyle" — matches the "© photo-op.ai/@toddeo"
// watermark the backend burns into copyrighted media.
export function getDefaultCopyright(handle: string): string {
  return `${WEB_DOMAIN}/@${handle}`;
}

export function getMediaPageUrl(mediaId: string): string {
  return `https://${WEB_DOMAIN}/posts/${mediaId}`;
}

// e.g. "https://photo-op.ai/@gregargyle" — for sharing a public profile.
export function getPublicProfileUrl(username: string): string {
  return `https://${WEB_DOMAIN}/@${username}`;
}

// Same logarithmic-growth curve as next-web's getExponentialGrowthScore.
function growthScore(value: number, max: number, scale = 100): number {
  if (value <= 0) return 0;
  return Math.round(Math.min((Math.log(value + 1) / Math.log(max + 1)) * scale, scale));
}

export interface ViralScoreInput {
  createdAt: string;
  capturedTime?: string | null;
  viewCount?: number | null;
  likeCount?: number | null;
  saveCount?: number | null;
}

// Same 0-100 heuristic as next-web's getMediaViralScore, minus the
// trending-tags factor — that one needs the site-wide list of currently
// trending tags (a separate fetch the mobile feed doesn't make), and
// next-web itself falls back to 0 for that factor whenever the list isn't
// available, so this matches that fallback rather than diverging from it.
export function getMediaViralScore(item: ViralScoreInput): number {
  const viewScore = growthScore(item.viewCount ?? 0, 100);
  const likeScore = growthScore(item.likeCount ?? 0, 50);
  const saveScore = growthScore(item.saveCount ?? 0, 50);
  const capturedAt = item.capturedTime ?? item.createdAt ?? new Date().toISOString();
  const dayDiff = Math.abs(Date.now() - new Date(capturedAt).getTime()) / (1000 * 60 * 60 * 24);
  const timeScore = 100 - growthScore(dayDiff, 365);
  const trendingScore = 0; // see note above

  return Math.round((timeScore + trendingScore + viewScore + likeScore + saveScore) / 5);
}

export function formatUsPrice(value: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value || 0);
}

// e.g. "37.7680°N, 122.3878°W" — coordinates alongside the city label, for
// the "global view of content" emphasis on the media detail screen.
export function formatCoordinates(lat: number, lng: number): string {
  const latLabel = `${Math.abs(lat).toFixed(4)}°${lat >= 0 ? "N" : "S"}`;
  const lngLabel = `${Math.abs(lng).toFixed(4)}°${lng >= 0 ? "E" : "W"}`;
  return `${latLabel}, ${lngLabel}`;
}

// Mirrors next-web's getUserProfileImageURL (src/utils/user.ts) — same
// "public/profile-pictures/<key>" convention, same bucket, so an avatar
// set from either app shows up correctly in the other.
export function getProfileImageUrl(profileImageKey: string | null | undefined): string | null {
  if (!profileImageKey) return null;
  return `https://${MEDIA_BUCKET}.s3.amazonaws.com/public/profile-pictures/${profileImageKey}`;
}
