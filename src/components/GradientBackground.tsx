import { StyleSheet, View, type ViewStyle } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { colors } from "@/theme";

// Approximates the website's .hero-bg / .page-head ambient glow: a dark base
// with soft purple + orange radial-ish blobs in the top corners.
export function GradientBackground({ children, style }: { children?: React.ReactNode; style?: ViewStyle }) {
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
  glowPurple: {
    position: "absolute",
    width: 420,
    height: 420,
    borderRadius: 420,
    left: -140,
    top: -120,
  },
  glowOrange: {
    position: "absolute",
    width: 460,
    height: 460,
    borderRadius: 460,
    right: -160,
    top: -60,
  },
  content: {
    flex: 1,
  },
});
