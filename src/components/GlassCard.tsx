import { StyleSheet, View, type ViewStyle } from "react-native";
import { BlurView } from "expo-blur";
import { colors, radii } from "@/theme";

export function GlassCard({ children, style }: { children?: React.ReactNode; style?: ViewStyle }) {
  return (
    <View style={[styles.wrap, style]}>
      <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
      <View style={styles.inner}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.line,
    overflow: "hidden",
    backgroundColor: "rgba(255,255,255,0.03)",
  },
  inner: {
    padding: 16,
  },
});
