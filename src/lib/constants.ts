// Same EXPO_PUBLIC_ override pattern as EXPO_PUBLIC_API_URL in api.ts — set
// EXPO_PUBLIC_HELPLINE_NUMBER at build time to change this without touching
// the component that renders it. Note this still requires a new build (or
// at least a new EAS Update publish) to take effect: Expo public env vars
// are inlined into the JS bundle at build time, not fetched at runtime.
export const HELPLINE_NUMBER = process.env.EXPO_PUBLIC_HELPLINE_NUMBER ?? "8655688134";
