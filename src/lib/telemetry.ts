import * as Sentry from "@sentry/react-native";

const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;

// No-ops everywhere (including captureError below) when no DSN is
// configured — e.g. local dev, or before a Sentry project exists yet. Set
// EXPO_PUBLIC_SENTRY_DSN in the build environment to turn this on; nothing
// else in the app needs to change.
export function initTelemetry(): void {
  if (!dsn) return;
  Sentry.init({ dsn, tracesSampleRate: 0.2 });
}

// The single place every `.catch(() => {})` in this codebase reports
// through, instead of truly swallowing — `context` is a short label
// identifying which call site failed (e.g. "push-token-register"), since
// Sentry has no other way to distinguish one bare Error from another here.
// Never changes what the caller does after — still resolves silently from
// the user's point of view, exactly as before.
export function captureError(error: unknown, context: string): void {
  if (!dsn) return;
  Sentry.captureException(error, { tags: { context } });
}
