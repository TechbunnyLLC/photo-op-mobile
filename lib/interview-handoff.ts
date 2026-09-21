// One-shot handoff for the finished interview transcript.
//
// expo-router's Stack has no built-in "return a value to the screen that
// pushed me" mechanism, and this app has no global state library (Auth is
// the only context, and it's user-session state, not screen-to-screen
// data). Rather than pull in one just for this, capture.tsx registers a
// callback here right before navigating to /interview; app/interview.tsx
// invokes it (if still registered) with the finished transcript right
// before navigating back, then it's cleared. If the uploader backs out of
// the capture screen before finishing an interview (or the interview
// screen is dismissed without completing), the callback is just never
// called and quietly falls out of scope — nothing to clean up.
import type { InterviewTurn } from "./interview";

let pendingCallback: ((transcript: InterviewTurn[]) => void) | null = null;

export function setInterviewCallback(cb: (transcript: InterviewTurn[]) => void): void {
  pendingCallback = cb;
}

// Pops and returns the registered callback (null if none/already used),
// so it can only ever fire once per interview.
export function takeInterviewCallback(): ((transcript: InterviewTurn[]) => void) | null {
  const cb = pendingCallback;
  pendingCallback = null;
  return cb;
}
