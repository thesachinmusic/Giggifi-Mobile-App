// Mirrors lib/format.ts's maskName() on the website. /api/quick-booking/match
// returns raw, unmasked artist names (the website only masks client-side
// before display) — this must be applied everywhere a matched artist's name
// is shown, same privacy rule already enforced server-side on other mobile
// endpoints (clients never see an artist's real name/contact info).
export function maskName(name: string | null | undefined): string {
  if (!name) return "";
  return name
    .split(/\s+/)
    .map((word) => {
      if (word.length <= 2) return word;
      return word[0] + "*".repeat(word.length - 2) + word[word.length - 1];
    })
    .join(" ");
}
