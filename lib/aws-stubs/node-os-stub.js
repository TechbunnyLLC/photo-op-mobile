// Stub for Node's "os" module (as "node:os").
//
// @aws-sdk/core's default user-agent builder calls os.platform()/os.release()
// to add an OS descriptor to the SDK's User-Agent header on every request —
// this genuinely runs on the happy path (unlike the credential/handler
// fallbacks in this folder, which are dead code). It's just used to build
// an informational string, so generic values are harmless.
module.exports = {
  platform: () => "ios",
  release: () => "0.0.0",
  type: () => "ReactNative",
  arch: () => "unknown",
  hostname: () => "localhost",
  homedir: () => "/",
  tmpdir: () => "/tmp",
  cpus: () => [],
  totalmem: () => 0,
  freemem: () => 0,
  endianness: () => "LE",
  EOL: "\n",
};
