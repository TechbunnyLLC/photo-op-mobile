// Stub for Node's "process" module (as "node:process").
//
// React Native/Hermes already provides a global `process` object (with
// process.env, process.nextTick, etc. polyfilled) — this just re-exports
// it so the protocol-prefixed `require("node:process")` form some AWS SDK
// internals use resolves to that same object instead of failing to bundle.
module.exports = typeof process !== "undefined" ? process : { env: {}, versions: {}, platform: "ios" };
