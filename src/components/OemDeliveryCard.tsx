import { Pressable, StyleSheet, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { GlassCard } from "./GlassCard";
import { openBatteryOptimizationSettings, type OemGuidance } from "@/lib/oem-delivery";
import { colors, fonts, radii, spacing } from "@/theme";

interface Props {
  guidance: OemGuidance;
  onDismiss: () => void;
}

export function OemDeliveryCard({ guidance, onDismiss }: Props) {
  return (
    <GlassCard style={styles.card}>
      <View style={styles.header}>
        <Feather name="battery-charging" size={16} color={colors.orange} />
        <Text style={styles.title}>Don't miss your booking updates</Text>
        <Pressable hitSlop={8} onPress={onDismiss}>
          <Feather name="x" size={16} color={colors.textMute} />
        </Pressable>
      </View>
      <Text style={styles.sub}>
        {guidance.brand} phones can silently block GiggiFi notifications in the background. A couple of quick settings fix this:
      </Text>
      {guidance.instructions.map((step) => (
        <Text key={step} style={styles.step}>• {step}</Text>
      ))}
      <Pressable style={styles.button} onPress={openBatteryOptimizationSettings}>
        <Text style={styles.buttonText}>Open Battery Settings</Text>
      </Pressable>
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.xs, marginBottom: spacing.md },
  header: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  title: { flex: 1, fontFamily: fonts.bodySemiBold, fontSize: 13.5, color: colors.text },
  sub: { fontFamily: fonts.body, fontSize: 12, color: colors.textDim, lineHeight: 17, marginTop: 2 },
  step: { fontFamily: fonts.body, fontSize: 12, color: colors.textDim, lineHeight: 18 },
  button: {
    marginTop: spacing.xs,
    alignSelf: "flex-start",
    paddingHorizontal: spacing.md,
    paddingVertical: 9,
    borderRadius: radii.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.lineStrong,
  },
  buttonText: { fontFamily: fonts.bodySemiBold, fontSize: 12.5, color: colors.text },
});
