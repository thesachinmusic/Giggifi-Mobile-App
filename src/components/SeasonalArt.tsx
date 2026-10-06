import type { ImageSourcePropType } from "react-native";

// Photos for Home's Seasonal Picks (372px wide, ~17-43 KB each — they replace
// the 1-2 MB illustrated PNGs, which are no longer referenced). Matched
// against a pick's title by keyword, same reasoning as that file: the
// website appends " Special" to any dated (non-evergreen)
// FestivalCalendarEntry, so "Ganpati Special" and a bare evergreen title
// like "Wedding Season" both need to resolve correctly without requiring
// an exact string match.
const ART_MATCHERS: { keywords: string[]; source: ImageSourcePropType }[] = [
  { keywords: ["navratri", "navaratri"], source: require("@/assets/images/seasonal/photo-navratri.jpg") },
  { keywords: ["diwali", "deepavali"], source: require("@/assets/images/seasonal/photo-diwali.jpg") },
  { keywords: ["ganpati", "ganesh"], source: require("@/assets/images/seasonal/photo-ganpati.jpg") },
  { keywords: ["wedding"], source: require("@/assets/images/seasonal/photo-wedding.jpg") },
  { keywords: ["corporate"], source: require("@/assets/images/seasonal/photo-corporate.jpg") },
  // The one real FestivalCalendarEntry in production today is the combined
  // "Bhajan & Sufi" title, which contains both keywords — so "bhajan" must
  // come first and wins for it. A separate Sufi tile (the photo below) only
  // appears once the backend data is split into two entries.
  { keywords: ["bhajan"], source: require("@/assets/images/seasonal/photo-bhajan.jpg") },
  { keywords: ["sufi"], source: require("@/assets/images/seasonal/photo-sufi.jpg") },
];

// Returns null for any occasion not covered above — the caller falls back
// to the admin-configured emoji glyph in that case rather than showing
// nothing.
export function getSeasonalArt(title: string): ImageSourcePropType | null {
  const lower = title.toLowerCase();
  return ART_MATCHERS.find((m) => m.keywords.some((k) => lower.includes(k)))?.source ?? null;
}
