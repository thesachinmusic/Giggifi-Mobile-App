import type { ImageSourcePropType } from "react-native";
import type {
  QuickMomentDiscover,
  QuickMomentDiscoverItem,
  QuickMomentDuration,
  QuickMomentFormat,
  QuickMomentKind,
  QuickMomentsCategory,
} from "./api";

// Mirrors FORMAT_LABEL in the website's lib/services/quick-moments-service.ts.
export const QUICK_MOMENT_FORMATS: { key: QuickMomentFormat; label: string; blurb: string; emoji: string }[] = [
  { key: "BIRTHDAY_SURPRISE", label: "Birthday Surprise", blurb: "A short surprise set for the birthday person.", emoji: "🎂" },
  { key: "ANNIVERSARY_SERENADE", label: "Anniversary Serenade", blurb: "A romantic mini-performance for a couple.", emoji: "💐" },
  { key: "JUST_BECAUSE", label: "Just Because", blurb: "No occasion needed — just a moment of live music.", emoji: "✨" },
];

export const QUICK_MOMENT_FORMAT_LABEL: Record<QuickMomentFormat, string> = QUICK_MOMENT_FORMATS.reduce(
  (acc, f) => ({ ...acc, [f.key]: f.label }),
  {} as Record<QuickMomentFormat, string>,
);

// Mirrors MIN_LEAD_HOURS in lib/services/quick-moments-service.ts on the website.
export const QUICK_MOMENTS_MIN_LEAD_HOURS = 2;

// Which discover "moment" each booking format is (the server names them
// BIRTHDAY / ANNIVERSARY / JUST_BECAUSE; the booking API uses the long names).
export const QUICK_MOMENT_KIND: Record<QuickMomentFormat, QuickMomentKind> = {
  BIRTHDAY_SURPRISE: "BIRTHDAY",
  ANNIVERSARY_SERENADE: "ANNIVERSARY",
  JUST_BECAUSE: "JUST_BECAUSE",
};

// Short names for "Best for <moment>".
export const QUICK_MOMENT_SHORT_LABEL: Record<QuickMomentFormat, string> = {
  BIRTHDAY_SURPRISE: "Birthday",
  ANNIVERSARY_SERENADE: "Anniversary",
  JUST_BECAUSE: "Just Because",
};

// Photos for the three moment cards: ONE place. The three files
// (assets/images/moments/birthday.jpg, anniversary.jpg, just-because.jpg) do not
// exist yet, so each entry is null and the card falls back to the brand gradient
// plus a drawn illustration (components/quick-moments/MomentArt). When the real
// photos are added, replace a null with require("@/assets/images/moments/....jpg").
// Never point these at a category/artist photo (singer, wedding, sufi, ...).
export const MOMENT_IMAGES: Record<QuickMomentFormat, ImageSourcePropType | null> = {
  BIRTHDAY_SURPRISE: null,
  ANNIVERSARY_SERENADE: null,
  JUST_BECAUSE: null,
};

// Distances come from artists' saved base locations, which aren't reliable yet
// (many artists share one point). Clients are shown "Near you" instead. Flip
// this to true to show "x.x km away" again; the field is still carried around.
export const SHOW_QUICK_MOMENT_DISTANCE = false;

// The chip row: "All" first, then only the categories the server says have real
// artists nearby (QuickMomentDiscover.categories). No server list (not loaded yet,
// or empty) = just "All".
export type CategoryChip = "All" | QuickMomentsCategory;

export function categoryChips(categories: QuickMomentDiscover["categories"] | null | undefined): CategoryChip[] {
  return ["All", ...(categories ?? []).filter((c) => c.count > 0).map((c) => c.category)];
}

// A selected chip that is no longer offered falls back to "All".
export function resolveCategory(selected: CategoryChip, chips: readonly CategoryChip[]): CategoryChip {
  return chips.includes(selected) ? selected : "All";
}

export const QUICK_MOMENT_DURATION_OPTIONS: QuickMomentDuration[] = [20, 40];
export const DEFAULT_QUICK_MOMENT_DURATION: QuickMomentDuration = 20;

export function priceForDuration(durations: QuickMomentDiscover["durations"] | null | undefined, minutes: QuickMomentDuration): number | null {
  return durations?.find((d) => d.minutes === minutes)?.priceINR ?? null;
}

export function formatINR(amount: number): string {
  return `₹${amount.toLocaleString("en-IN")}`;
}

// The earliest start a client can ask for: now + the minimum notice, rounded up
// to the next full hour (the booking form picks whole hours).
export function earliestSlot(now: Date = new Date()): Date {
  const d = new Date(now.getTime() + QUICK_MOMENTS_MIN_LEAD_HOURS * 60 * 60 * 1000);
  if (d.getMinutes() !== 0 || d.getSeconds() !== 0 || d.getMilliseconds() !== 0) d.setHours(d.getHours() + 1, 0, 0, 0);
  return d;
}

export function combineDateAndHour(date: Date, hour: number): Date {
  const d = new Date(date);
  d.setHours(hour, 0, 0, 0);
  return d;
}

export function isLeadTimeOk(slot: Date, now: Date = new Date()): boolean {
  return slot.getTime() >= now.getTime() + QUICK_MOMENTS_MIN_LEAD_HOURS * 60 * 60 * 1000;
}

// "Near you" (or the distance, if the flag is on).
export function nearLabel(item: Pick<QuickMomentDiscoverItem, "distanceKm">): string {
  return SHOW_QUICK_MOMENT_DISTANCE ? `${item.distanceKm.toFixed(1)} km away` : "Near you";
}

export function availabilityLabel(item: Pick<QuickMomentDiscoverItem, "online" | "availableFrom">): string {
  if (item.online) return "Online now";
  return item.availableFrom ? `Offline · available from ${item.availableFrom}` : "Offline";
}

// Which parts of the feed have something real to show. Everything else is
// hidden outright — no placeholders, no empty boxes.
export function visibleSections(d: QuickMomentDiscover | null) {
  const forMoment = d?.forMoment ?? [];
  const mostViewed = d?.mostViewed ?? [];
  const reels = d?.reels ?? [];
  const featured = d?.featured ?? null;
  const anyArtists = Boolean(featured) || forMoment.length > 0 || mostViewed.length > 0;
  return {
    featured: featured !== null,
    forMoment: forMoment.length > 0,
    mostViewed: mostViewed.length > 0,
    reels: reels.length > 0,
    // The "Available near you" heading only when at least one artist card is shown.
    heading: anyArtists || reels.length > 0,
    anyOnline: [featured, ...forMoment, ...mostViewed].some((i) => i?.online),
    noArtistsNearby: d?.emptyReason === "NO_ARTISTS_NEARBY",
  };
}
