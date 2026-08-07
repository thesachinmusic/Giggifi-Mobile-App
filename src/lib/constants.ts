// Same EXPO_PUBLIC_ override pattern as EXPO_PUBLIC_API_URL in api.ts — set
// EXPO_PUBLIC_HELPLINE_NUMBER at build time to change this without touching
// the component that renders it. Note this still requires a new build to
// take effect: Expo public env vars are inlined into the JS bundle at
// build time, not fetched at runtime, and this app has no expo-updates/EAS
// Update configured for pushing a JS-only update between store releases —
// the same caveat that already applies to EXPO_PUBLIC_API_URL.
export const HELPLINE_NUMBER = process.env.EXPO_PUBLIC_HELPLINE_NUMBER ?? "8655688134";
