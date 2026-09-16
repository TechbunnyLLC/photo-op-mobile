const path = require("path");
const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

// AWS SDK and Amplify's GraphQL API package both ship extensionless
// CommonJS ("dist/cjs/...") files and Node-only entry points that Metro's
// newer "package exports" resolution picks up by default and can't resolve
// in React Native. This is Amplify's own documented Expo/Metro setup fix.
config.resolver.sourceExts.push("cjs");
config.resolver.unstable_enablePackageExports = false;

// The AWS SDK (used for client-side photo tagging — see lib/tagging.ts)
// statically references several Node.js-only pieces that don't exist in
// React Native: a credentials fallback we never fall back to, an HTTP
// handler we always override with a fetch-based one, and a user-agent
// builder that reads os/process info. See lib/aws-stubs/*.js for the full
// explanation of each. These are genuinely installed packages, so a plain
// resolver alias (extraNodeModules) doesn't work — Metro finds the real
// ones first and never consults the alias. resolveRequest is the
// mechanism that actually redirects an existing, resolvable module.
const STUBS = {
  "@aws-sdk/credential-provider-node": path.resolve(
    __dirname,
    "lib/aws-stubs/credential-provider-node-stub.js"
  ),
  "@smithy/node-http-handler": path.resolve(
    __dirname,
    "lib/aws-stubs/node-http-handler-stub.js"
  ),
  "node:os": path.resolve(__dirname, "lib/aws-stubs/node-os-stub.js"),
  "node:process": path.resolve(__dirname, "lib/aws-stubs/node-process-stub.js"),
};

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (STUBS[moduleName]) {
    return { type: "sourceFile", filePath: STUBS[moduleName] };
  }
  // Safety net for any other "node:*" built-in reached only through the
  // dead code paths above (fs, https, http2, stream, ...) — see
  // empty-node-builtin.js. Named node: modules we DO need real behavior
  // from are listed explicitly above instead.
  if (moduleName.startsWith("node:")) {
    return {
      type: "sourceFile",
      filePath: path.resolve(__dirname, "lib/aws-stubs/empty-node-builtin.js"),
    };
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
