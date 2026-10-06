import { StyleSheet, Text, View } from "react-native";
import { STATUS_LABEL, STATUS_TONE, type StatusTone } from "@/lib/booking-status";
import { colors, fonts, radii } from "@/theme";

// Tones follow the redesign mock (soft amber / rose / lilac on tinted pills).
const TONE_COLOR: Record<StatusTone, string> = {
  ok: colors.ok,
  warn: "#FFC27A",
  err: "#FF9AA8",
  neutral: "#D9BEFF",
};

export function StatusBadge({ status }: { status: string }) {
  const tone = STATUS_TONE[status] ?? "neutral";
  const color = TONE_COLOR[tone];
  return (
    <View style={[styles.badge, { backgroundColor: `${color}26`, borderColor: `${color}4D` }]}>
      <Text style={[styles.text, { color }]}>{STATUS_LABEL[status] ?? status}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 10,
    height: 24,
    justifyContent: "center",
    borderRadius: radii.pill,
    borderWidth: 1,
  },
  text: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 11,
  },
});
