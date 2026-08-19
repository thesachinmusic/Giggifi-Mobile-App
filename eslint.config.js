const { defineConfig, globalIgnores } = require("eslint/config");
const expoConfig = require("eslint-config-expo/flat");

// `npx eslint .` currently reports ~46 known findings from the
// react-hooks/{refs,purity,immutability,set-state-in-effect} rules, which
// eslint-config-expo enables because app.json's experiments.reactCompiler
// is true. They flag pervasive, currently-safe RN patterns (useRef-memoized
// FlatList viewabilityConfig, ref-mirrors of props, setState in a mount
// effect, mutating an expo-video player's .muted) rather than real bugs.
// Deliberately left as-is pending confirmation that the compiler is
// actually transforming production builds — decided during the Aug 2026
// audit rather than speculatively refactoring ~20 files.
module.exports = defineConfig([
  // ios/ and android/ are `expo prebuild` output — gitignored, regenerated
  // on demand, and not app source. Anyone who runs prebuild locally
  // otherwise picks up lint findings from vendored third-party code inside
  // native dependencies (e.g. a minified .js file bundled inside the
  // Razorpay CocoaPods framework), which was never meant to be linted.
  globalIgnores(["dist/*", ".expo/*", "expo-env.d.ts", "ios/*", "android/*"]),
  expoConfig,
]);
