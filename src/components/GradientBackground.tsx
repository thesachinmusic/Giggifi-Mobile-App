import { Dimensions, StyleSheet, View, type ViewStyle } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { colors, mock } from "@/theme";

const { width: W, height: H } = Dimensions.get("window");
const GLOW_STEPS = 16;

// Soft radial glow centred on (cx, cy): GLOW_STEPS circles, outermost first,
// each adding peak/GLOW_STEPS of opacity, so the total fades linearly from
// `peak` at the centre to 0 at `radius`.
function Glow({ cx, cy, radius, rgb, peak }: { cx: number; cy: number; radius: number; rgb: string; peak: number }) {
  const alpha = peak / GLOW_STEPS;
  return (
    <View style={styles.glowLayer} pointerEvents="none">
      {Array.from({ length: GLOW_STEPS }, (_, i) => {
        const r = radius * (1 - i / GLOW_STEPS);
        return (
          <View
            key={i}
            style={{
              position: "absolute",
              left: cx - r,
              top: cy - r,
              width: r * 2,
              height: r * 2,
              borderRadius: r,
              backgroundColor: `rgba(${rgb},${alpha})`,
            }}
          />
        );
      })}
    </View>
  );
}

interface Props {
  children?: React.ReactNode;
  style?: ViewStyle;
  // "classic" is the original look (every screen that doesn't opt in).
  // "giggifi" is the redesign mock: purple glow top-left, orange glow
  // top-right, a second soft purple glow mid-left, on a dark purple-black base.
  variant?: "classic" | "giggifi";
}

// Approximates the website's .hero-bg / .page-head ambient glow: a dark base
// with soft purple + orange radial-ish blobs in the top corners.
export function GradientBackground({ children, style, variant = "classic" }: Props) {
  if (variant === "giggifi") {
    // React Native has no radial gradient and react-native-svg isn't a
    // dependency, so each glow is a stack of concentric low-alpha circles —
    // the stepped alphas blend into a smooth falloff with no visible edge
    // (a single circle with a vertical fade showed a hard rim).
    return (
      <View style={[styles.root, styles.rootGiggifi, style]}>
        <Glow cx={0.08 * W} cy={0} radius={0.95 * W} rgb="112,48,152" peak={0.75} />
        <Glow cx={W} cy={0.14 * H} radius={0.75 * W} rgb="205,92,40" peak={0.4} />
        <Glow cx={0} cy={0.55 * H} radius={0.8 * W} rgb="90,36,120" peak={0.28} />
        <View style={styles.content}>{children}</View>
      </View>
    );
  }

  return (
    <View style={[styles.root, style]}>
      <View style={styles.glowPurple} pointerEvents="none">
        <LinearGradient
          colors={[colors.purple + "40", colors.purple + "00"]}
          style={StyleSheet.absoluteFill}
        />
      </View>
      <View style={styles.glowOrange} pointerEvents="none">
        <LinearGradient
          colors={[colors.orange + "38", colors.orange + "00"]}
          style={StyleSheet.absoluteFill}
        />
      </View>
      <View style={styles.content}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.ink,
    overflow: "hidden",
  },
  rootGiggifi: { backgroundColor: mock.bg },
  glowLayer: { position: "absolute", left: 0, right: 0, top: 0, bottom: 0 },
  glowPurple: {
    position: "absolute",
    width: 420,
    height: 420,
    borderRadius: 420,
    left: -140,
    top: -120,
    overflow: "hidden",
  },
  glowOrange: {
    position: "absolute",
    width: 460,
    height: 460,
    borderRadius: 460,
    right: -160,
    top: -60,
    overflow: "hidden",
  },
  content: {
    flex: 1,
  },
});
