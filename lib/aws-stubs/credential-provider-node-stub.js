// Stub replacing @aws-sdk/credential-provider-node.
//
// @aws-sdk/client-rekognition statically imports this package as its
// DEFAULT credentials fallback (for reading ~/.aws/credentials, EC2
// instance metadata, etc.) — none of which exists or applies on a phone.
// This app always passes explicit credentials to RekognitionClient (see
// lib/tagging.ts, sourced from the signed-in user's Cognito Identity Pool
// session via fetchAuthSession()), so that fallback path is never actually
// used at runtime.
//
// The real package pulls in Node-only built-ins (node:https, node:http2,
// ...) that Metro can't bundle for React Native. Since the fallback is dead
// code for us, Metro is told (see metro.config.js) to use this stub in its
// place instead — same shape, no Node dependencies, and it throws loudly
// if it's ever actually reached, which would mean a real bug elsewhere.
function defaultProvider() {
  return async () => {
    throw new Error(
      "Rekognition credential fallback was reached, but this app always " +
        "passes explicit credentials — this indicates a bug in lib/tagging.ts."
    );
  };
}

module.exports = { defaultProvider };
