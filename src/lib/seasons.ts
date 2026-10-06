// Maps a Seasonal Picks tile title ("Diwali Special", "Bhajan Clubbing",
// "Wedding Season"...) to the season-page key the backend knows
// (GET /api/mobile/season/[key]). Same keyword approach as SeasonalArt: the
// calendar appends " Special" to dated entries, so titles are matched by
// keyword, not exactly. Order matters: "Bhajan & Sufi" must resolve to bhajan.
const SEASON_KEYWORDS: { key: string; keywords: string[] }[] = [
  { key: "navratri", keywords: ["navratri", "navaratri"] },
  { key: "diwali", keywords: ["diwali", "deepavali"] },
  { key: "ganpati", keywords: ["ganpati", "ganesh"] },
  { key: "eid", keywords: ["eid"] },
  { key: "christmas", keywords: ["christmas", "xmas"] },
  { key: "wedding", keywords: ["wedding"] },
  { key: "corporate", keywords: ["corporate"] },
  { key: "bhajan", keywords: ["bhajan"] },
  { key: "sufi", keywords: ["sufi"] },
];

export function seasonKeyForTitle(title: string): string | null {
  const lower = title.toLowerCase();
  // Short keywords ("eid") match whole words only, so they can't fire inside
  // an unrelated word.
  const hit = (k: string) => (k.length <= 3 ? new RegExp(`\\b${k}\\b`).test(lower) : lower.includes(k));
  return SEASON_KEYWORDS.find((s) => s.keywords.some(hit))?.key ?? null;
}
