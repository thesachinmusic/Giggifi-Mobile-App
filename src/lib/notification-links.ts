import type { Href } from "expo-router";

// The only real screens a notification's actionUrl is ever allowed to
// target. A broken/unknown deep link is worse than no navigation at all —
// shared by the cold-start tap router and the in-app notifications list, so
// there's exactly one place that knows what's routable.
const ALLOWED = [
  /^\/booking\/[^/]+$/,
  /^\/artist\/[^/]+$/,
  /^\/vendor\/[^/]+$/,
  /^\/booker-profile$/,
  /^\/notifications$/,
  // Tag-group discovery (app/discover/[group].tsx) — same shape-trust as
  // the other dynamic-segment patterns above; which `group` values are
  // actually valid is the backend's TAG_GROUPS config to enforce
  // (GET /api/mobile/artist/by-group 400s on an unknown one), not this
  // allowlist's job.
  /^\/discover\/[^/]+$/,
];

export function resolveNotificationHref(url: unknown): Href | null {
  if (typeof url !== "string" || !ALLOWED.some((re) => re.test(url))) return null;
  return url as Href;
}
