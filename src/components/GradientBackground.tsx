import { StyleSheet, View, type ViewStyle } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { colors, mock } from "@/theme";

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
    // React Native has no radial-gradient; each glow is a large circle filled
    // with a vertical fade, same approximation the classic variant uses.
    return (
      <View style={[styles.root, styles.rootGiggifi, style]}>
        <View style={styles.gPurpleTop} pointerEvents="none">
          <LinearGradient colors={["rgba(112,48,152,0.75)", "rgba(112,48,152,0)"]} style={StyleSheet.absoluteFill} />
        </View>
        <View style={styles.gOrange} pointerEvents="none">
          <LinearGradient colors={["rgba(205,92,40,0.40)", "rgba(205,92,40,0)"]} style={StyleSheet.absoluteFill} />
        </View>
        <View style={styles.gPurpleMid} pointerEvents="none">
          <LinearGradient colors={["rgba(90,36,120,0.28)", "rgba(90,36,120,0)"]} style={StyleSheet.absoluteFill} />
        </View>
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
  gPurpleTop: {
    position: "absolute",
    width: 560,
    height: 560,
    borderRadius: 560,
    left: -200,
    top: -220,
    overflow: "hidden",
  },
  gOrange: {
    position: "absolute",
    width: 420,
    height: 420,
    borderRadius: 420,
    right: -170,
    top: -40,
    overflow: "hidden",
  },
  gPurpleMid: {
    position: "absolute",
    width: 520,
    height: 520,
    borderRadius: 520,
    left: -260,
    top: 380,
    overflow: "hidden",
  },
  content: {
    flex: 1,
  },
});
