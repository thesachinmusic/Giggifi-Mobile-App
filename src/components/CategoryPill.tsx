import { Pressable, StyleSheet, Text } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { colors, fonts, gradients, radii } from "@/theme";

interface Props {
  label: string;
  emoji?: string;
  active: boolean;
  onPress: () => void;
}

export function CategoryPill({ label, emoji, active, onPress }: Props) {
  if (active) {
    return (
      <Pressable onPress={onPress} style={({ pressed }) => pressed && styles.pressed}>
        <LinearGradient colors={gradients.brand} locations={gradients.brandLocations} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.pill}>
          <Text style={styles.labelActive}>{emoji ? `${emoji} ${label}` : label}</Text>
        </LinearGradient>
      </Pressable>
    );
  }
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.pill, styles.pillInactive, pressed && styles.pressed]}>
      <Text style={styles.label}>{emoji ? `${emoji} ${label}` : label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pill: {
    paddingVertical: 9,
    paddingHorizontal: 16,
    borderRadius: radii.pill,
  },
  pressed: { opacity: 0.75 },
  pillInactive: {
    borderWidth: 1,
    borderColor: colors.lineStrong,
    backgroundColor: "transparent",
  },
  label: {
    color: colors.textMute,
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
  },
  labelActive: {
    color: "#fff",
    fontFamily: fonts.bodySemiBold,
    fontSize: 13,
  },
});
