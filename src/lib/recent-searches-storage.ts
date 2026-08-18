import { readJSON, writeJSON } from "./local-storage";

const KEY = "giggifi_recent_searches";
const MAX_RECENT = 5;

// Device-local, not per-user — same reasoning as local-preferences-storage.ts.
export function getRecentSearches(): Promise<string[]> {
  return readJSON<string[]>(KEY, []);
}

// Newest first, case-insensitive de-duped, capped at MAX_RECENT.
export async function addRecentSearch(term: string): Promise<string[]> {
  const trimmed = term.trim();
  if (!trimmed) return getRecentSearches();
  const existing = await getRecentSearches();
  const next = [trimmed, ...existing.filter((t) => t.toLowerCase() !== trimmed.toLowerCase())].slice(0, MAX_RECENT);
  await writeJSON(KEY, next);
  return next;
}

export function clearRecentSearches(): Promise<void> {
  return writeJSON(KEY, []);
}
