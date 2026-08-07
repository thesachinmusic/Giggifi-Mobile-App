import type { QuickMomentFormat } from "./api";

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
