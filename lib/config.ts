// Central place for backend wiring.
//
// The real backend is github.com/PhotOp-io/backend — AWS Amplify Gen 1:
// Cognito (auth), AppSync/GraphQL (API), DynamoDB (data), S3 (media),
// Lambda (watermarking, search sync, counters, trending tags), OpenSearch
// (search), Rekognition (tagging, called client-side — see lib/tagging.ts).
//
// Client config (User Pool ID, AppSync endpoint, S3 bucket name, etc.)
// lives in lib/amplify-config.ts and is still placeholder values — see the
// comments there for how to get the real ones.

import awsconfig from "./amplify-config";

// The S3 bucket backing the "UserCreatedMedia" storage category. Amplify
// gives generated bucket names a random suffix, so this can't be guessed —
// it comes from lib/amplify-config.ts once that's filled in for real.
export const MEDIA_BUCKET = awsconfig.aws_user_files_s3_bucket;

// Toggle to develop the UI against local fixture data (see lib/mock-data.ts)
// before lib/amplify-config.ts has real values filled in. Defaults to
// mock mode on unless explicitly turned off, since the placeholder config
// can't reach anything real yet.
export const USE_MOCK_API = process.env.EXPO_PUBLIC_USE_MOCK_API !== "false";
