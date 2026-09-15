import { getUrl, uploadData } from "aws-amplify/storage";

// The backend's PostCreateMedia/SyncMedia Lambdas key off objects under the
// "public/" prefix of the UserCreatedMedia bucket (see
// amplify/backend/function/PostCreateMedia/src/index.js in the backend
// repo — it reads `public/${imageKey}` and writes back to
// `public/wmc/${imageKey}` and `public/copyright/${imageKey}`).
export async function uploadMediaFile(localUri: string, key: string, contentType: string) {
  const response = await fetch(localUri);
  const blob = await response.blob();

  await uploadData({
    path: `public/${key}`,
    data: blob,
    options: { contentType },
  }).result;

  return key;
}

export async function getMediaUrl(key: string, variant: "" | "wmc/" | "copyright/" = "wmc/") {
  const { url } = await getUrl({ path: `public/${variant}${key}` });
  return url.toString();
}
