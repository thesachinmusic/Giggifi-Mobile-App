import type { ReactNode } from "react";
import { Platform, StyleSheet, Text, View } from "react-native";
import { fonts, mock } from "@/theme";

// No new font package: the italic accent note uses the system serif.
const SERIF = Platform.select({ ios: "Georgia", default: "serif" });

interface Props {
  title: string;
  // Small tilted italic note on the right (the mock's handwritten accent).
  accent?: string;
  // Custom right-hand content (e.g. a pill button) — replaces the accent.
  right?: ReactNode;
}

// Big screen title with an amber underline stroke, shared by the redesigned
// tab screens (Bookings, Business, Profile). The mock's hand-drawn squiggle is
// approximated with a plain rounded bar — react-native-svg isn't a dependency.
export function ScreenTitle({ title, accent, right }: Props) {
  return (
    <View style={styles.row}>
      <View style={styles.titleWrap}>
        <Text style={styles.title}>{title}</Text>
        <View style={[styles.stroke, { width: Math.min(140, title.length * 17) }]} />
      </View>
      {right ?? (accent ? <Text style={styles.accent}>{accent}</Text> : null)}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 18,
    marginBottom: 18,
  },
  titleWrap: { paddingBottom: 8 },
  title: { fontFamily: fonts.displayBold, fontSize: 32, lineHeight: 38, color: "#fff", letterSpacing: -0.3 },
  stroke: { position: "absolute", left: 0, bottom: 0, height: 3, borderRadius: 2, backgroundColor: mock.amber },
  accent: {
    fontFamily: SERIF,
    fontStyle: "italic",
    fontSize: 19,
    color: "#FFC27A",
    transform: [{ rotate: "-3deg" }],
  },
});
