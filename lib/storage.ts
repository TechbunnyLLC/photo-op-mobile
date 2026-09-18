import { getUrl, uploadData } from "aws-amplify/storage";
import { File } from "expo-file-system";

// The backend's PostCreateMedia/SyncMedia Lambdas key off objects under the
// "public/" prefix of the UserCreatedMedia bucket (see
// amplify/backend/function/PostCreateMedia/src/index.js in the backend
// repo — it reads `public/${imageKey}` and writes back to
// `public/wmc/${imageKey}` and `public/copyright/${imageKey}`).
export async function uploadMediaFile(localUri: string, key: string, contentType: string) {
  // fetch(localUri).blob() is NOT reliable for local file:// (and
  // especially Android content://) URIs in React Native/Expo Go — in
  // testing it silently "succeeded" while actually uploading the literal
  // 14-byte text "File not found" instead of the photo, with no thrown
  // error anywhere in the chain. expo-file-system's File.bytes() reads
  // the local file directly through Expo's native module instead of the
  // flaky global fetch/Blob shim.
  const file = new File(localUri);
  const bytes = await file.bytes();

  await uploadData({
    path: `public/${key}`,
    data: bytes,
    options: { contentType },
  }).result;

  return key;
}

export async function getMediaUrl(key: string, variant: "" | "wmc/" | "copyright/" = "wmc/") {
  const { url } = await getUrl({ path: `public/${variant}${key}` });
  return url.toString();
}
