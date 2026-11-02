import type { ArtistSummary } from "./api";

// Home's artist rails, kept as plain functions so their rules can be tested.

export const POPULAR_LIMIT = 12;
export const FRESH_LIMIT = 10;

// "Popular right now": the server's booking-count sort, in the order it returns.
export function popularRail<T extends { id: string }>(byBookings: readonly T[]): T[] {
  return byBookings.slice(0, POPULAR_LIMIT);
}

// "Fresh picks": newest first (the server's default sort), minus anyone already
// under Popular, so no artist appears in both rails.
export function freshRail<T extends { id: string }>(newestFirst: readonly T[], popular: readonly { id: string }[]): T[] {
  const taken = new Set(popular.map((a) => a.id));
  return newestFirst.filter((a) => !taken.has(a.id)).slice(0, FRESH_LIMIT);
}

// "Featured artists": paid placements first, marked as promoted (that is what
// the "Promoted" pill reads), then the unpaid daily fill with no pill. An artist
// in both lists shows once, as paid.
export function featuredRail(paid: readonly ArtistSummary[], fill: readonly ArtistSummary[]): ArtistSummary[] {
  const paidIds = new Set(paid.map((a) => a.id));
  return [
    ...paid.map((a) => ({ ...a, isFeatured: true })),
    ...fill.filter((a) => !paidIds.has(a.id)).map((a) => ({ ...a, isFeatured: false })),
  ];
}

// "?city=Mumbai" only when there is a city; nothing at all otherwise. (The backend
// does not use it yet.)
export function featuredQueryString(city: string | null | undefined): string {
  const trimmed = city?.trim();
  return trimmed ? `?city=${encodeURIComponent(trimmed)}` : "";
}
