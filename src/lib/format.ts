// Deliberately permissive (no lookahead/full RFC 5322) — this only needs to
// catch the "abc" / "abc@" typos that currently reach the server and bounce
// back as a generic error after the user has filled in a whole form.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(email: string): boolean {
  return EMAIL_PATTERN.test(email.trim());
}

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

// A new account may still carry its phone number as its name. Anything made
// only of digits and phone punctuation (7+ digits) is treated as "no name".
export function isPhoneLikeName(name: string | null | undefined): boolean {
  if (!name) return false;
  const trimmed = name.trim();
  return /^[+\d\s().-]+$/.test(trimmed) && trimmed.replace(/\D/g, "").length >= 7;
}

// The first usable real name from the candidates, or null.
export function realName(...candidates: (string | null | undefined)[]): string | null {
  for (const c of candidates) {
    const t = c?.trim();
    if (t && !isPhoneLikeName(t)) return t;
  }
  return null;
}

// What to show as the user's name: their real name, otherwise "Guest".
export function displayName(...candidates: (string | null | undefined)[]): string {
  return realName(...candidates) ?? "Guest";
}
