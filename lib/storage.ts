import { getUrl } from "aws-amplify/storage";
import { File, Paths, UploadType } from "expo-file-system";
import { USE_MOCK_API } from "./config";

// The backend's PostCreateMedia/SyncMedia Lambdas key off objects under the
// "public/" prefix of the UserCreatedMedia bucket.

export type UploadProgress = (fraction: number) => void;

/**
 * Stream a local camera/library file to S3. Do not use File.bytes() or
 * Amplify uploadData here — both load the whole clip into JS RAM and freeze
 * Capture on Android (especially after a video + a price/licensing prompt).
 */
export async function uploadMediaFile(
  localUri: string,
  key: string,
  contentType: string,
  onProgress?: UploadProgress,
) {
  if (USE_MOCK_API) {
    onProgress?.(1);
    return key;
  }

  const file = fileForUpload(localUri, key);
  const { url } = await getUrl({
    path: `public/${key}`,
    options: {
      method: "PUT",
      contentType,
      expiresIn: 3600,
    },
  });

  const result = await file.upload(url.toString(), {
    httpMethod: "PUT",
    uploadType: UploadType.BINARY_CONTENT,
    mimeType: contentType,
    headers: { "Content-Type": contentType },
    onProgress: ({ bytesSent, totalBytes }) => {
      if (totalBytes > 0) onProgress?.(bytesSent / totalBytes);
    },
  });

  if (result.status < 200 || result.status >= 300) {
    throw new Error(
      `S3 upload failed (${result.status}): ${result.body?.slice(0, 300) || "no body"}`,
    );
  }

  onProgress?.(1);
  return key;
}

export async function getMediaUrl(key: string, variant: "" | "wmc/" | "copyright/" = "wmc/") {
  const { url } = await getUrl({ path: `public/${variant}${key}` });
  return url.toString();
}

function fileForUpload(localUri: string, key: string): File {
  if (localUri.startsWith("file://") || localUri.startsWith("content://")) {
    return new File(localUri);
  }

  const src = new File(localUri);
  const dest = new File(Paths.cache, key.replace(/\//g, "_"));
  if (dest.exists) dest.delete();
  src.copy(dest);
  return dest;
}
