const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

// The AWS SDK (used for client-side photo tagging, see lib/tagging.ts) pulls
// in a Node.js-only HTTP handler (@smithy/node-http-handler) that references
// built-in modules like "node:https" which don't exist in React Native.
// Metro's newer "package exports" resolution picks that Node build by
// default; disabling it falls back to the browser/react-native-safe build
// instead, which is what these packages actually ship for this environment.
config.resolver.unstable_enablePackageExports = false;

module.exports = config;
