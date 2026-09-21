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

// Client-side auto-tagging (lib/tagging.ts) calls Rekognition's
// DetectLabels/DetectText directly. It used to go through the official
// @aws-sdk/client-rekognition package, but that SDK bundles several
// Node.js-only internals unconditionally (a dead credentials fallback, a
// dead default HTTP handler, an os/process-based user-agent builder, and a
// Node-only code path inside its auth-scheme resolution) that don't exist
// in React Native — each one was individually fixable via Metro resolver
// stubs (see metro.config.js and lib/aws-stubs/), but they kept surfacing
// one layer deeper with no clear end in sight. lib/tagging.ts now signs
// the Rekognition request by hand (AWS Signature Version 4, via the
// pure-JS crypto-js package) instead, which sidesteps the SDK — and its
// Node internals — entirely. Rekognition is image-only, so this still
// only applies to photos; see the !isVideo guard in
// app/(tabs)/capture.tsx.
export const ENABLE_CLIENT_TAGGING = true;

// Hard cap for auto-tags, feed chips, cards, and the post editor.
export const MAX_TAGS = 10;

// Media licensing purchases go through a SEPARATE payment microservice —
// not the Amplify GraphQL API — the same one next-web's own checkout flow
// (src/components/providers/PaymentProvider.tsx) already calls: /config
// returns the Stripe publishable key, /create-payment-intent (Cognito JWT
// auth'd) creates the PaymentIntent + a backend Payment record and
// returns { clientSecret, paymentId }. See lib/payment.ts.
//
// This is the **test** stack's URL (matches amplify-config.ts's test
// values) — from next-web's src/configs.ts's PAYMENT_SERVICE_URL. Swap to
// the prod URL there (…sr9dqisjd6…/prod/payment) alongside a prod
// amplify-config.ts if this app ever points at production.
export const PAYMENT_SERVICE_URL =
  "https://ess4ko3qg4.execute-api.us-west-2.amazonaws.com/test/payment";


// AI-interview microservice (InterviewAI Lambda, backend repo
// amplify/backend/function/InterviewAI) — /start begins a short,
// AI-driven Q&A about what the uploader just captured; /continue submits
// each answer and gets the next question (or {done:true}) back. Cognito
// JWT auth'd, same pattern as PAYMENT_SERVICE_URL above. Runs on
// Anthropic's Claude API directly (not AWS Bedrock) — see lib/interview.ts.
//
// This is the **test** stack's URL — swap alongside PAYMENT_SERVICE_URL
// if this app ever points at production.
export const INTERVIEW_SERVICE_URL =
  "https://do3dr0jr81.execute-api.us-west-2.amazonaws.com/test/interview";

// Same backend Lambda/API as INTERVIEW_SERVICE_URL above (InterviewAI) --
// the API Gateway resource behind it is a {proxy+} catch-all, so this is
// just a different path on the same deployment, not a separate service.
// Generates a suggested caption from a photo (see lib/media-description.ts).
export const DESCRIBE_MEDIA_URL =
  "https://do3dr0jr81.execute-api.us-west-2.amazonaws.com/test/describe";
