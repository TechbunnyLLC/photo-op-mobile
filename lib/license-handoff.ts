// One-shot handoff so /license-terms can mark consent on the screen that
// opened it (capture review or media-detail price edit). Same pattern as
// lib/interview-handoff.ts.

let pendingCallback: (() => void) | null = null;

export function setLicenseAcceptCallback(cb: () => void): void {
  pendingCallback = cb;
}

export function takeLicenseAcceptCallback(): (() => void) | null {
  const cb = pendingCallback;
  pendingCallback = null;
  return cb;
}
