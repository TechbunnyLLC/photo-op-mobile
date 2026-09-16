import { fetchAuthSession } from "aws-amplify/auth";
import {
  DetectLabelsCommand,
  DetectTextCommand,
  RekognitionClient,
} from "@aws-sdk/client-rekognition";
import { FetchHttpHandler } from "@smithy/fetch-http-handler";

// The backend has no server-side tagging step — the original web/app
// clients call Amplify's Predictions category (PhotoOpMediaLabeler /
// PhotoOpTextIdentifier, both backed by Rekognition) directly, then write
// the results back onto Media.arrayTags themselves. Amplify's unified v6
// JS library dropped the Predictions category, so this calls Rekognition
// directly via the AWS SDK instead, using short-lived credentials from the
// signed-in user's Cognito Identity Pool session (the same IAM path the
// original Predictions category used under the hood).
//
// Requires aws_cognito_identity_pool_id to be set in lib/amplify-config.ts
// and that identity's IAM role to allow rekognition:DetectLabels /
// rekognition:DetectText (the backend's Lambda roles grant "rekognition:*"
// broadly — worth confirming the *client-facing* IAM role has it too,
// since that's a separate role from the Lambda execution roles).

async function getRekognitionClient() {
  const session = await fetchAuthSession();
  if (!session.credentials) {
    throw new Error("No AWS credentials on the current session — is the user signed in?");
  }

  return new RekognitionClient({
    region: "us-west-2",
    credentials: session.credentials,
    // The SDK's default request handler (@smithy/node-http-handler) is
    // Node.js-only. FetchHttpHandler uses fetch(), which React Native
    // provides natively — this is what actually makes the request work
    // on a phone. See metro.config.js / lib/aws-stubs for why the default
    // still has to be stubbed out even though we override it here: Metro
    // has to bundle the class reference either way.
    requestHandler: new FetchHttpHandler(),
  });
}

export async function detectLabels(s3Bucket: string, s3Key: string): Promise<string[]> {
  const client = await getRekognitionClient();
  const result = await client.send(
    new DetectLabelsCommand({
      Image: { S3Object: { Bucket: s3Bucket, Name: s3Key } },
      MaxLabels: 20,
      MinConfidence: 70,
    })
  );

  return (result.Labels ?? []).map((label) => label.Name).filter((name): name is string => !!name);
}

export async function detectText(s3Bucket: string, s3Key: string): Promise<string[]> {
  const client = await getRekognitionClient();
  const result = await client.send(
    new DetectTextCommand({
      Image: { S3Object: { Bucket: s3Bucket, Name: s3Key } },
    })
  );

  return (result.TextDetections ?? [])
    .filter((t) => t.Type === "LINE")
    .map((t) => t.DetectedText)
    .filter((text): text is string => !!text);
}
