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
];

export function resolveNotificationHref(url: unknown): Href | null {
  if (typeof url !== "string" || !ALLOWED.some((re) => re.test(url))) return null;
  return url as Href;
}
