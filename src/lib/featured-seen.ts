// "Times shown (approx.)" for a Boost: when Boosted artists are on screen in the Featured rail on Home, the app tells the server once, in a
// small separate request after the screen is already shown. The server adds 1 to a daily count per artist; nothing about the person is
// sent. Each artist is reported at most once every 30 minutes by this phone, so scrolling back and forth or pulling to refresh does not
// add up. The signal never changes what the rail shows and never shows an error.
export const SEEN_REPEAT_MS = 30 * 60 * 1000;
const MAX_IDS = 8;

const lastSent = new Map<string, number>();

// The ids that should be sent now: not sent in the last 30 minutes, at most 8. They are marked as sent.
export function idsToReport(ids: readonly string[], now: number = Date.now(), memory: Map<string, number> = lastSent): string[] {
  const out: string[] = [];
  for (const id of ids) {
    if (!id || out.includes(id)) continue;
    const last = memory.get(id);
    if (last !== undefined && now - last < SEEN_REPEAT_MS) continue;
    out.push(id);
    if (out.length >= MAX_IDS) break;
  }
  for (const id of out) memory.set(id, now);
  return out;
}

export function resetFeaturedSeenMemory(): void {
  lastSent.clear();
}
