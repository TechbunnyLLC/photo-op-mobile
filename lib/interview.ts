// AI-interview microservice client — mirrors lib/payment.ts's pattern
// against the same InterviewAI Lambda (see lib/config.ts's
// INTERVIEW_SERVICE_URL comment). Drives the short Q&A shown in
// app/interview.tsx: /start kicks it off from whatever the uploader has
// captured so far, /continue submits each answer and gets the next
// question back (or {done:true} once the Lambda has enough for a clear
// first-person account, capped at 5 questions server-side).

import { fetchAuthSession } from "aws-amplify/auth";
import { INTERVIEW_SERVICE_URL } from "./config";

// One question/answer pair. answer is null while it's still awaiting a
// reply — the last item in a transcript is the only one that can be null;
// every earlier item is always fully answered.
export interface InterviewTurn {
  question: string;
  answer: string | null;
}

// Whatever's known about the post so far, passed through on every call so
// the Lambda can tailor its questions (e.g. "what happened on Main St"
// instead of something generic). All optional — the interview still
// works with none of this filled in yet.
export interface InterviewContext {
  caption?: string;
  mediaType?: "photo" | "video";
  location?: string;
}

interface InterviewResponse {
  done: boolean;
  transcript: InterviewTurn[];
}

async function authHeader(): Promise<Record<string, string>> {
  const session = await fetchAuthSession();
  const jwt = session.tokens?.accessToken?.toString();
  if (!jwt) {
    throw new Error("You need to be signed in to start an interview.");
  }
  return { Authorization: `Bearer ${jwt}` };
}

async function postJson(path: string, body: unknown): Promise<InterviewResponse> {
  const response = await fetch(`${INTERVIEW_SERVICE_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(await authHeader()) },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error("Couldn't reach the interview. Please try again.");
  }
  return (await response.json()) as InterviewResponse;
}

// Kicks off a new interview. Returns either the first question (done:
// false, a one-item transcript with answer: null) or done: true if the
// model decided there's nothing worth asking (rare, but the API allows it).
export async function startInterview(context: InterviewContext): Promise<InterviewResponse> {
  return postJson("/start", context);
}

// Submits the answer to the transcript's last (unanswered) question and
// gets either the next question or {done: true}. Pass the full transcript
// back exactly as last received, plus the same context startInterview used.
export async function continueInterview(
  transcript: InterviewTurn[],
  answer: string,
  context: InterviewContext
): Promise<InterviewResponse> {
  return postJson("/continue", { transcript, answer, ...context });
}

// Stitches the interview's answers into a single first-person paragraph —
// the Lambda's questions are designed to draw out a clear account in the
// uploader's own words, so the answers alone (no need to restate the
// questions) read naturally as post text. Used to pre-fill the caption
// when an interview finishes; the uploader can still edit it afterward.
export function summarizeInterview(transcript: InterviewTurn[]): string {
  return transcript
    .map((turn) => turn.answer?.trim())
    .filter((answer): answer is string => !!answer)
    .join(" ");
}
