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
// explanation of each): a credentials fallback we never fall back to, and
// an HTTP request handler we always override with a fetch-based one. Metro
// still has to bundle whatever they statically import though, which pulls
// in Node built-ins (node:https, node:http2, ...) that don't exist on a
// phone. These aliases swap both for dependency-free stubs.
config.resolver.extraNodeModules = {
  ...(config.resolver.extraNodeModules ?? {}),
  "@aws-sdk/credential-provider-node": require.resolve(
    "./lib/aws-stubs/credential-provider-node-stub.js"
  ),
  "@smithy/node-http-handler": require.resolve(
    "./lib/aws-stubs/node-http-handler-stub.js"
  ),
};

module.exports = config;
