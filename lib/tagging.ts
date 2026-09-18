import { fetchAuthSession } from "aws-amplify/auth";
import CryptoJS from "crypto-js";

// The backend has no server-side tagging step — the original web/app
// clients call Amplify's Predictions category (PhotoOpMediaLabeler /
// PhotoOpTextIdentifier, both backed by Rekognition) directly, then write
// the results back onto Media.arrayTags themselves. Amplify's unified v6
// JS library dropped the Predictions category, so this calls Rekognition
// directly instead, using short-lived credentials from the signed-in
// user's Cognito Identity Pool session (the same IAM path the original
// Predictions category used under the hood).
//
// This signs the request by hand (AWS Signature Version 4) with the
// pure-JS crypto-js library instead of using @aws-sdk/client-rekognition.
// The official SDK statically pulls in several Node.js-only internals (a
// dead credentials fallback, a dead default HTTP handler, an os/process
// -based user-agent builder, and a Node-only auth-scheme resolution code
// path) that don't exist in React Native — each one was individually
// fixable via Metro resolver stubs (see metro.config.js / lib/aws-stubs/),
// but they kept surfacing one layer deeper with no clear end in sight. A
// hand-signed fetch() call sidesteps the whole problem: it only depends on
// fetch (native to RN) and crypto-js (pure JavaScript, no Node or native
// crypto dependency — works in Hermes/Expo Go as-is, unlike Web Crypto's
// crypto.subtle, which Hermes doesn't implement).
//
// Requires aws_cognito_identity_pool_id to be set in lib/amplify-config.ts
// and that identity's IAM role to allow rekognition:DetectLabels /
// rekognition:DetectText (the backend's Lambda roles grant "rekognition:*"
// broadly — worth confirming the *client-facing* IAM role has it too,
// since that's a separate role from the Lambda execution roles).

const REGION = "us-west-2";
const SERVICE = "rekognition";

interface Credentials {
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken?: string;
}

async function getCredentials(): Promise<Credentials> {
  const session = await fetchAuthSession();
  if (!session.credentials) {
    throw new Error("No AWS credentials on the current session — is the user signed in?");
  }
  const { accessKeyId, secretAccessKey, sessionToken } = session.credentials;
  return { accessKeyId, secretAccessKey, sessionToken };
}

function hmac(key: CryptoJS.lib.WordArray | string, message: string): CryptoJS.lib.WordArray {
  return CryptoJS.HmacSHA256(message, key);
}

// Standard SigV4 key-derivation chain: each step scopes the key a little
// further (date, then region, then service, then a fixed "request type"
// constant) so the final key is only ever valid for this exact service,
// region, and day.
function getSigningKey(secretAccessKey: string, dateStamp: string): CryptoJS.lib.WordArray {
  const kDate = hmac("AWS4" + secretAccessKey, dateStamp);
  const kRegion = hmac(kDate, REGION);
  const kService = hmac(kRegion, SERVICE);
  return hmac(kService, "aws4_request");
}

// Signs and sends one Rekognition API call. Rekognition (like most AWS
// "JSON protocol" services) takes every operation as a POST to the bare
// service endpoint, distinguished only by the X-Amz-Target header — there's
// no per-action REST path the way S3 or DynamoDB have.
async function callRekognition(target: string, body: unknown): Promise<any> {
  const credentials = await getCredentials();
  const host = `${SERVICE}.${REGION}.amazonaws.com`;
  const payload = JSON.stringify(body);
  const payloadHash = CryptoJS.SHA256(payload).toString(CryptoJS.enc.Hex);

  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, ""); // YYYYMMDDTHHMMSSZ
  const dateStamp = amzDate.slice(0, 8);

  // fetch() won't let us set a "Host" header by hand (it's a forbidden
  // header name, silently stripped) — that's fine, since the runtime sets
  // it to this same value from the URL, so the signature still matches
  // what actually goes out on the wire.
  const headersToSign: Record<string, string> = {
    "content-type": "application/x-amz-json-1.1",
    host,
    "x-amz-date": amzDate,
    "x-amz-target": target,
    ...(credentials.sessionToken ? { "x-amz-security-token": credentials.sessionToken } : {}),
  };
  const signedHeaderNames = Object.keys(headersToSign).sort();
  const canonicalHeaders = signedHeaderNames.map((name) => `${name}:${headersToSign[name]}\n`).join("");
  const signedHeaders = signedHeaderNames.join(";");

  const canonicalRequest = ["POST", "/", "", canonicalHeaders, signedHeaders, payloadHash].join("\n");
  const credentialScope = `${dateStamp}/${REGION}/${SERVICE}/aws4_request`;
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    credentialScope,
    CryptoJS.SHA256(canonicalRequest).toString(CryptoJS.enc.Hex),
  ].join("\n");

  const signingKey = getSigningKey(credentials.secretAccessKey, dateStamp);
  const signature = CryptoJS.HmacSHA256(stringToSign, signingKey).toString(CryptoJS.enc.Hex);

  const authorization =
    `AWS4-HMAC-SHA256 Credential=${credentials.accessKeyId}/${credentialScope}, ` +
    `SignedHeaders=${signedHeaders}, Signature=${signature}`;

  const response = await fetch(`https://${host}/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-amz-json-1.1",
      "X-Amz-Date": amzDate,
      "X-Amz-Target": target,
      Authorization: authorization,
      ...(credentials.sessionToken ? { "X-Amz-Security-Token": credentials.sessionToken } : {}),
    },
    body: payload,
  });

  const json = await response.json();
  if (!response.ok) {
    const message = json?.message ?? json?.Message ?? `Rekognition request failed (${response.status})`;
    throw new Error(message);
  }
  return json;
}

export async function detectLabels(s3Bucket: string, s3Key: string): Promise<string[]> {
  const result = await callRekognition("RekognitionService.DetectLabels", {
    Image: { S3Object: { Bucket: s3Bucket, Name: s3Key } },
    MaxLabels: 20,
    MinConfidence: 70,
  });

  return (result.Labels ?? [])
    .map((label: any) => label.Name)
    .filter((name: unknown): name is string => typeof name === "string");
}

export async function detectText(s3Bucket: string, s3Key: string): Promise<string[]> {
  const result = await callRekognition("RekognitionService.DetectText", {
    Image: { S3Object: { Bucket: s3Bucket, Name: s3Key } },
  });

  return (result.TextDetections ?? [])
    .filter((t: any) => t.Type === "LINE")
    .map((t: any) => t.DetectedText)
    .filter((text: unknown): text is string => typeof text === "string");
}
