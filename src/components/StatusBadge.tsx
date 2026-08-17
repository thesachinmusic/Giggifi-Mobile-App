import { StyleSheet, Text, View } from "react-native";
import { STATUS_LABEL, STATUS_TONE, type StatusTone } from "@/lib/booking-status";
import { colors, fonts, radii } from "@/theme";

const TONE_COLOR: Record<StatusTone, string> = {
  ok: colors.ok,
  warn: colors.warn,
  err: colors.err,
  neutral: colors.purple,
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
    paddingVertical: 4,
    borderRadius: radii.pill,
    borderWidth: 1,
  },
  text: {
    fontFamily: fonts.mono,
    fontSize: 10,
  },
});
