const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

// AWS SDK and Amplify's GraphQL API package both ship extensionless
// CommonJS ("dist/cjs/...") files and Node-only entry points that Metro's
// newer "package exports" resolution picks up by default and can't resolve
// in React Native. This is Amplify's own documented Expo/Metro setup fix.
config.resolver.sourceExts.push("cjs");
config.resolver.unstable_enablePackageExports = false;

// @aws-sdk/client-rekognition statically imports @aws-sdk/credential-provider-node
// as its default (unused, Node-only) credentials fallback — see
// lib/aws-stubs/credential-provider-node-stub.js for the full explanation.
// This swaps it for a dependency-free stub so Metro never has to resolve
// that package's Node built-ins (node:https, node:http2, ...).
config.resolver.extraNodeModules = {
  ...(config.resolver.extraNodeModules ?? {}),
  "@aws-sdk/credential-provider-node": require.resolve(
    "./lib/aws-stubs/credential-provider-node-stub.js"
  ),
};

module.exports = config;
