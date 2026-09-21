import { Platform, Share } from "react-native";

// Android ignores Share's `url` field (and some RN/Expo builds treat it as
// a file attachment, which makes https:// links fail). Put the link in
// `message` there. iOS can take a real url. Dismiss/cancel is not an error.
export async function shareLink(title: string, message: string, url: string): Promise<void> {
  const content =
    Platform.OS === "ios"
      ? { title, message, url }
      : { title, message: `${message}\n${url}` };

  try {
    await Share.share(
      content,
      Platform.OS === "android" ? { dialogTitle: title } : undefined
    );
  } catch (err: any) {
    const text = String(err?.message ?? err);
    if (/cancel|dismiss/i.test(text)) return;
    throw err;
  }
}
