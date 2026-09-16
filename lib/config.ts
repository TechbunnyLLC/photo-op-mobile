// Central place for backend wiring.
//
// The real backend is github.com/PhotOp-io/backend — AWS Amplify Gen 1:
// Cognito (auth), AppSync/GraphQL (API), DynamoDB (data), S3 (media),
// Lambda (watermarking, search sync, counters, trending tags), OpenSearch
// (search), Rekognition (tagging, called client-side — see lib/tagging.ts).
//
// Client config (User Pool ID, AppSync endpoint, S3 bucket name, etc.)
// lives in lib/amplify-config.ts and now holds real values for the
// **test** environment (stack amplify-photoop-test-94334).

import awsconfig from "./amplify-config";

// The S3 bucket backing the "UserCreatedMedia" storage category. Amplify
// gives generated bucket names a random suffix, so this can't be guessed —
// it comes from lib/amplify-config.ts once that's filled in for real.
export const MEDIA_BUCKET = awsconfig.aws_user_files_s3_bucket;

// Toggle to develop the UI against local fixture data (see lib/mock-data.ts)
// instead of the real AWS backend. Defaults to mock mode on; set
// EXPO_PUBLIC_USE_MOCK_API=false (see .env) to hit the real test backend.
export const USE_MOCK_API = process.env.EXPO_PUBLIC_USE_MOCK_API !== "false";

// Client-side auto-tagging (lib/tagging.ts, via the official
// @aws-sdk/client-rekognition package) is temporarily disabled. That SDK
// bundles several Node.js-only internals unconditionally (a dead
// credentials fallback, a dead default HTTP handler, an os/process-based
// user-agent builder, and — the current blocker — a Node-only code path
// inside its auth-scheme resolution that gets reached even after stubbing
// the others) that don't exist in React Native. Each one has been
// individually fixable via Metro resolver stubs (see metro.config.js and
// lib/aws-stubs/), but they kept surfacing one layer deeper with no clear
// end in sight, so tagging is switched off here rather than continuing
// indefinitely. Upload and posting work normally without it — photos just
// won't get auto-generated tags until this is revisited, either by
// finishing the stub chain, or (probably the better fix) replacing the
// official SDK call in lib/tagging.ts with a hand-written, dependency-free
// signed request to Rekognition's API that never touches Node internals.
export const ENABLE_CLIENT_TAGGING = false;
