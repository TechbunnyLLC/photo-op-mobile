// Generic stand-in for any other Node.js built-in module that AWS SDK
// internals might reference but this app doesn't actually exercise at
// runtime (see credential-provider-node-stub.js and node-http-handler-stub.js
// for the dead code paths this covers — this is a safety net for anything
// similar we haven't specifically named). Property access is harmless;
// actually CALLING an export throws clearly instead of silently misbehaving,
// so a real gap shows up as an obvious error pointing at this file rather
// than a confusing crash.
module.exports = new Proxy(
  {},
  {
    get(_target, prop) {
      if (prop === "__esModule") return false;
      if (typeof prop === "symbol") return undefined;
      const name = String(prop);
      return (...args) => {
        throw new Error(
          `A Node.js built-in export ("${name}") was actually called from ` +
            "React Native via empty-node-builtin.js. This means some AWS SDK " +
            "code path is running that this app's Metro stubs didn't expect " +
            "— check the import stack in the bundler error and add a real " +
            "stub for it in lib/aws-stubs/."
        );
      };
    },
  }
);
