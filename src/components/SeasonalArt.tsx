import type { ImageSourcePropType } from "react-native";

// Final illustrated artwork for Home's Seasonal Picks — replaces the
// original-line-art SVG stage (see the removed SeasonalIcons.tsx). Matched
// against a pick's title by keyword, same reasoning as that file: the
// website appends " Special" to any dated (non-evergreen)
// FestivalCalendarEntry, so "Ganpati Special" and a bare evergreen title
// like "Wedding Season" both need to resolve correctly without requiring
// an exact string match.
const ART_MATCHERS: { keywords: string[]; source: ImageSourcePropType }[] = [
  { keywords: ["ganpati", "ganesh"], source: require("@/assets/images/seasonal/ganpati-special.png") },
  { keywords: ["wedding"], source: require("@/assets/images/seasonal/wedding-special.png") },
  { keywords: ["corporate"], source: require("@/assets/images/seasonal/corporate-events.png") },
  // "clubbing" checked before the bare "bhajan" match further down isn't
  // needed — the two keyword lists never overlap — but this entry is kept
  // separate from Sufi's on purpose: a combined "Bhajan & Sufi" title (the
  // one real FestivalCalendarEntry in production today) would otherwise
  // silently only ever resolve to whichever of the two came first in this
  // list. See the flagged-back note in the PR/summary — this pairing needs
  // an actual backend data split before both images can ever show as two
  // separate cards.
  { keywords: ["bhajan"], source: require("@/assets/images/seasonal/bhajan-clubbing.png") },
  { keywords: ["sufi"], source: require("@/assets/images/seasonal/sufi-special.png") },
];

// Returns null for any occasion not covered above — the caller falls back
// to the admin-configured emoji glyph in that case rather than showing
// nothing.
export function getSeasonalArt(title: string): ImageSourcePropType | null {
  const lower = title.toLowerCase();
  return ART_MATCHERS.find((m) => m.keywords.some((k) => lower.includes(k)))?.source ?? null;
}
