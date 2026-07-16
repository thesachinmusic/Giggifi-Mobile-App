// Ported 1:1 from the GiggFi website's design tokens (app/globals.css, tailwind.config.mjs)
// so the app reads as the same brand, not a reskin.
export const colors = {
  ink: "#0c0710",
  ink2: "#140b18",
  ink3: "#1c1020",
  surface: "#0f0918",
  surface2: "#241626",
  card: "#0d0717",

  line: "rgba(255,255,255,0.08)",
  lineStrong: "rgba(255,255,255,0.14)",

  text: "#f6eef4",
  textDim: "#b9aec1",
  textMute: "#85798e",

  purple: "#a855f7",
  pink: "#ec4899",
  magenta: "#e0307a",
  orange: "#ff8a3d",
  gold: "#ffb340",

  ok: "#22c55e",
  warn: "#f59e0b",
  err: "#ef4444",
} as const;

// var(--grad): linear-gradient(95deg,#a855f7 0%,#e0307a 45%,#ff8a3d 100%)
export const gradients = {
  brand: [colors.purple, colors.magenta, colors.orange] as const,
  brandLocations: [0, 0.45, 1] as const,
  glowPurple: [colors.purple + "55", colors.purple + "00"] as const,
  glowOrange: [colors.orange + "55", colors.orange + "00"] as const,
} as const;
