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
  globalIgnores(["dist/*", ".expo/*", "expo-env.d.ts"]),
  expoConfig,
]);
