const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

// AWS SDK and Amplify's GraphQL API package both ship extensionless
// CommonJS ("dist/cjs/...") files and Node-only entry points that Metro's
// newer "package exports" resolution picks up by default and can't resolve
// in React Native. This is Amplify's own documented Expo/Metro setup fix.
config.resolver.sourceExts.push("cjs");
config.resolver.unstable_enablePackageExports = false;

module.exports = config;
