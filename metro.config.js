const path = require("path");
const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

// AWS SDK and Amplify's GraphQL API package both ship extensionless
// CommonJS ("dist/cjs/...") files and Node-only entry points that Metro's
// newer "package exports" resolution picks up by default and can't resolve
// in React Native. This is Amplify's own documented Expo/Metro setup fix.
config.resolver.sourceExts.push("cjs");
config.resolver.unstable_enablePackageExports = false;

// @aws-sdk/client-rekognition statically imports two Node.js-only AWS SDK
// pieces as unused defaults (see lib/aws-stubs/*.js for the full
// explanation of each): a credentials fallback we never fall back to
// (which itself pulls in node:fs via credential-provider-web-identity),
// and an HTTP request handler we always override with a fetch-based one.
// Both are genuinely installed packages, so a plain resolver alias
// (extraNodeModules) doesn't touch them — Metro finds the real ones first
// and never looks at the alias. resolveRequest is the mechanism that
// actually redirects an existing, resolvable module to a different file.
const STUBS = {
  "@aws-sdk/credential-provider-node": path.resolve(
    __dirname,
    "lib/aws-stubs/credential-provider-node-stub.js"
  ),
  "@smithy/node-http-handler": path.resolve(
    __dirname,
    "lib/aws-stubs/node-http-handler-stub.js"
  ),
};

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (STUBS[moduleName]) {
    return { type: "sourceFile", filePath: STUBS[moduleName] };
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
