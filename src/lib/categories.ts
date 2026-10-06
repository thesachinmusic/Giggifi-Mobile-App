// Mirrors lib/artist-categories.ts on the website — keep these two lists in sync.
export const CATEGORIES = [
  { label: "Singer", emoji: "🎤" },
  { label: "DJ", emoji: "🎧" },
  { label: "Live Band", emoji: "🎸" },
  { label: "Comedian", emoji: "🎭" },
  { label: "Dancer", emoji: "💃" },
  { label: "Anchor", emoji: "🎙️" },
  { label: "Instrumentalist", emoji: "🎻" },
  { label: "Magician", emoji: "🪄" },
  { label: "Poet", emoji: "📜" },
  { label: "Sketch Artist", emoji: "✏️" },
  { label: "Celebrity", emoji: "⭐" },
  { label: "Bhajan / Jamming", emoji: "🪔" },
  { label: "Sufi", emoji: "🕌" },
] as const;

// Old names still stored on saved events / older artist profiles. The website
// reads them as aliases too (lib/artist-matching.ts); here they are mapped to
// today's names so a saved checklist item still opens the right category.
const LEGACY_CATEGORY_NAMES: Record<string, string> = {
  "sufi band": "Sufi",
  "bhajan clubbing": "Bhajan / Jamming",
  caricature: "Sketch Artist",
};

export function canonicalCategory(raw: string): string {
  const value = raw.trim();
  return LEGACY_CATEGORY_NAMES[value.toLowerCase()] ?? value;
}
