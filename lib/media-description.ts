// AI-generated caption AND tag suggestions -- calls the same InterviewAI
// Lambda's /describe route (see lib/config.ts's DESCRIBE_MEDIA_URL comment)
// with a downsized JPEG, and gets both back from one Claude call. For
// photos that's the photo itself; for video it's a poster frame pulled
// from a throwaway expo-video player. This is the only tagging path now --
// it replaced Rekognition (lib/tagging.ts, now unused) for both media
// types; see capture.tsx's submit() step 4 for why.
//
// IMPORTANT: this creates its OWN player via createVideoPlayer() rather
// than reusing capture.tsx's live preview player (the one bound to the
// on-screen <VideoView>). An earlier version reused that live player, and
// calling generateThumbnailsAsync() on the same player instance that's
// actively rendering to a visible surface froze the whole screen on
// Android (nothing -- not even unrelated buttons like Retake or the
// license checkbox -- responded afterward). A dedicated, off-screen
// player avoids touching the live one's native state at all.
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import { createVideoPlayer } from "expo-video";
import { fetchAuthSession } from "aws-amplify/auth";
import { DESCRIBE_MEDIA_URL } from "./config";
import { topTags } from "./media";

// Resized well below the backend's ~6MB synchronous-invoke payload ceiling
// (see the InterviewAI Lambda's src/app.js bodyParser comment) -- a phone
// photo at full camera resolution is several MB; 1024px on the long edge at
// 70% JPEG quality is still plenty for Claude to describe well and keeps
// requests fast and cheap.
const MAX_DIMENSION = 1024;
const JPEG_QUALITY = 0.7;

// The moment (in seconds) to grab the poster frame from. 0 is the very
// first frame -- good enough for a caption prompt, and avoids needing to
// know the clip's duration up front.
const POSTER_FRAME_TIME = 0;

export interface MediaDescription {
  description: string;
  // Lowercase, deduped tags suggested for the media -- empty if the model
  // didn't return any (still a successful call either way).
  tags: string[];
}

// Generates a short suggested caption and tag list for a just-captured/
// picked photo or video, given its local file URI either way.
// existingCaption, when given, is passed along so the model builds on what
// the uploader already started rather than ignoring it.
export async function describeMedia(
  localUri: string,
  mediaKind: "photo" | "video",
  existingCaption?: string
): Promise<MediaDescription> {
  const imageSource = mediaKind === "video" ? await grabPosterFrame(localUri) : localUri;

  const context = ImageManipulator.manipulate(imageSource);
  context.resize({ width: MAX_DIMENSION });
  const rendered = await context.renderAsync();
  const resized = await rendered.saveAsync({ format: SaveFormat.JPEG, compress: JPEG_QUALITY, base64: true });

  if (!resized.base64) {
    throw new Error(`Couldn't process the ${mediaKind} for description.`);
  }

  const session = await fetchAuthSession();
  const jwt = session.tokens?.accessToken?.toString();
  if (!jwt) {
    throw new Error("You need to be signed in to generate a description.");
  }

  const response = await fetch(DESCRIBE_MEDIA_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${jwt}` },
    body: JSON.stringify({
      image: resized.base64,
      mediaType: "image/jpeg",
      caption: existingCaption,
    }),
  });

  if (!response.ok) {
    throw new Error("Couldn't generate a description. Please try again.");
  }

  const data = (await response.json()) as { description: string; tags?: string[] };
  return { description: data.description, tags: topTags(data.tags ?? []) };
}

// Spins up a throwaway, off-screen player just to pull one frame, then
// releases it immediately -- never touches capture.tsx's live preview
// player. expo-video's generateThumbnailsAsync returns native image refs
// (SharedRef<'image'>) that expo-image-manipulator's manipulate() accepts
// directly as a source -- no file URI or base64 round-trip needed.
async function grabPosterFrame(localUri: string) {
  const player = createVideoPlayer(localUri);
  try {
    const thumbnails = await player.generateThumbnailsAsync(POSTER_FRAME_TIME);
    const frame = thumbnails[0];
    if (!frame) {
      throw new Error("Couldn't grab a frame from the video.");
    }
    return frame;
  } finally {
    player.release();
  }
}
