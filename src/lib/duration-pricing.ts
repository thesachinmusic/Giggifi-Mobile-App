// Mirrors lib/duration-pricing.ts on the website. Adapted for mobile: there's
// no "search under a category" step here (the client lands directly on an
// artist's profile), so solo-act detection keys off the artist's actual
// performerType via substring match — consistent with how the backend
// already does category filtering (`contains`, see app/api/mobile/artists).
export const FULL_SHOW_MINUTES = 150;
export const DURATION_OPTIONS = [60, 120, FULL_SHOW_MINUTES] as const;

export const DURATION_MULTIPLIERS: Record<number, number> = {
  60: 0.5,
  120: 0.75,
  150: 1,
};

const SOLO_KEYWORDS = ["singer", "comedian", "magician", "instrumentalist"];

export function isSoloPerformerType(performerType: string | null): boolean {
  if (!performerType) return false;
  const p = performerType.toLowerCase();
  return SOLO_KEYWORDS.some((k) => p.includes(k));
}

export function getDurationAdjustedPrice(
  basePrice: number | null,
  performerType: string | null,
  durationMinutes: number,
): number | null {
  if (basePrice === null) return null;
  if (!isSoloPerformerType(performerType)) return basePrice;
  return Math.round(basePrice * (DURATION_MULTIPLIERS[durationMinutes] ?? 1));
}
