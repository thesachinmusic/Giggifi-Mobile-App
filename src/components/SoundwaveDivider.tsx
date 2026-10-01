import { StyleSheet, View } from "react-native";
import { visualColors } from "@/theme";

// Thin soundwave-style accent divider between sections. Purely decorative:
// hidden from screen readers, never intercepts touches, and a fixed small
// width, so it can't overflow or push layout on any screen size.
const HEIGHTS = [5, 9, 13, 7, 12, 4, 9, 15, 8, 11, 5, 14, 7, 10, 4, 12, 8, 13, 6, 9];

function lerp(a: number, b: number, t: number) {
  return Math.round(a + (b - a) * t);
}
function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
// pink -> orange -> cyan across the bars, like the reference.
function barColor(i: number, total: number): string {
  const stops = [visualColors.pink, visualColors.orange, visualColors.cyan].map(hexToRgb);
  const pos = (i / (total - 1)) * (stops.length - 1);
  const seg = Math.min(stops.length - 2, Math.floor(pos));
  const t = pos - seg;
  const [r, g, b] = [0, 1, 2].map((k) => lerp(stops[seg][k], stops[seg + 1][k], t));
  return `rgb(${r},${g},${b})`;
}

export function SoundwaveDivider() {
  return (
    <View style={styles.row} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {HEIGHTS.map((h, i) => (
        <View key={i} style={[styles.bar, { height: h, backgroundColor: barColor(i, HEIGHTS.length) }]} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 2, height: 18, opacity: 0.55, marginVertical: 4 },
  bar: { width: 2.5, borderRadius: 2 },
});
