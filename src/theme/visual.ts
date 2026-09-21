import type { ViewStyle } from "react-native";

// Visual-enhancement tokens (additive — nothing existing reads these unless a
// screen opts in). Values follow the reference mock for the visual pass.

// Category accents. Used ONLY where a screen is already organised by category
// (the Home category rail) — never to invent a new categorisation.
export const categoryAccents = {
  music: "#FF3E7F", // singers, bands, instrumentalists
  comedy: "#FFC857", // comedians, poets
  dj: "#4FD1FF",
  anchor: "#3DDC97",
  magic: "#C792FF", // magicians, act reels
} as const;

export const visualColors = {
  ink: "#0F0817",
  white: "#FDF8F4",
  lilac: "#C4B8D4",
  lilacDim: "#8A7C9E",
  orange: "#FF8A3D",
  pink: categoryAccents.music,
  gold: categoryAccents.comedy,
  cyan: categoryAccents.dj,
  mint: categoryAccents.anchor,
  violet: categoryAccents.magic,
} as const;

// Two-tier shadow system: `soft` for tiles/cards, `hero` (larger, warmer) for
// hero and banner elements. Android renders `elevation`, iOS the shadow* props.
export const shadows: { soft: ViewStyle; hero: ViewStyle } = {
  soft: {
    shadowColor: "#000",
    shadowOpacity: 0.28,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  hero: {
    shadowColor: categoryAccents.music,
    shadowOpacity: 0.3,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
};

// Gradients for text and chips.
export const visualGradients = {
  // Headlines: warm white fading into orange and pink.
  headline: [visualColors.white, visualColors.orange, visualColors.pink] as const,
  // Key numbers: orange -> pink.
  number: [visualColors.orange, visualColors.pink] as const,
  // Icon badge behind section headings.
  badge: [visualColors.pink, visualColors.orange] as const,
} as const;

// "#RRGGBB" + 0..1 alpha -> "#RRGGBBAA".
export function withAlpha(hex: string, alpha: number): string {
  const a = Math.round(Math.min(1, Math.max(0, alpha)) * 255)
    .toString(16)
    .padStart(2, "0");
  return `${hex}${a}`;
}

// Clearer size/weight scale (display = Bricolage Grotesque, body = Inter
// Tight): a bigger jump between a headline and body copy than before.
export const textScale = {
  hero: 34, // the one big number on a screen
  title: 28, // screen greeting
  section: 19, // section headings
  stat: 24, // stat numbers
  body: 14,
  small: 12,
  eyebrow: 10, // mono, uppercase, tracked
} as const;

// The accent an artist category is shown in, for the screens that are already
// organised by category (Home's category rail). Categories with no natural
// match — and every vendor category — return undefined and keep the neutral
// look rather than being given an invented grouping.
export function accentForCategory(label: string): string | undefined {
  switch (label) {
    case "Singer":
    case "Live Band":
    case "Instrumentalist":
    case "Sufi Band":
    case "Bhajan Clubbing":
      return categoryAccents.music;
    case "Comedian":
      return categoryAccents.comedy;
    case "DJ":
      return categoryAccents.dj;
    case "Anchor":
      return categoryAccents.anchor;
    case "Magician":
      return categoryAccents.magic;
    default:
      return undefined;
  }
}
