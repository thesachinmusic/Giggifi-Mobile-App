import { readJSON, writeJSON } from "./local-storage";

const KEY = "giggifi_location_cache";

// Long enough that reopening Quick Moments (or any other coords-based
// screen) within the same outing reuses the last fix instead of running a
// fresh GPS detect every time — short enough that a client who's genuinely
// moved to a different part of town later the same day doesn't get matched
// against where they were half an hour ago.
const MAX_AGE_MS = 15 * 60 * 1000;

interface CachedLocation {
  lat: number;
  lng: number;
  cachedAt: number;
}

export async function getCachedLocation(): Promise<{ lat: number; lng: number } | null> {
  const cached = await readJSON<CachedLocation | null>(KEY, null);
  if (!cached) return null;
  if (Date.now() - cached.cachedAt > MAX_AGE_MS) return null;
  return { lat: cached.lat, lng: cached.lng };
}

export async function setCachedLocation(lat: number, lng: number): Promise<void> {
  await writeJSON<CachedLocation>(KEY, { lat, lng, cachedAt: Date.now() });
}
