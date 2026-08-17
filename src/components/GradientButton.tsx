import { ActivityIndicator, Pressable, StyleSheet, Text, type ViewStyle } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { colors, fonts, radii, gradients } from "@/theme";

interface Props {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
  // "destructive" swaps the celebratory brand gradient for a flat red fill —
  // an irreversible action (delete account) shouldn't look like a promo CTA.
  variant?: "brand" | "destructive";
}

export function GradientButton({ label, onPress, disabled, loading, style, variant = "brand" }: Props) {
  const isDisabled = disabled || loading;
  const content = loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.label}>{label}</Text>;

  if (variant === "destructive") {
    return (
      <Pressable
        onPress={onPress}
        disabled={isDisabled}
        style={({ pressed }) => [styles.button, styles.destructiveButton, { opacity: pressed ? 0.85 : isDisabled ? 0.5 : 1 }, style]}
      >
        {content}
      </Pressable>
    );
  }

  return (
    <Pressable onPress={onPress} disabled={isDisabled} style={({ pressed }) => [{ opacity: pressed ? 0.85 : isDisabled ? 0.5 : 1 }, style]}>
      <LinearGradient
        colors={gradients.brand}
        locations={gradients.brandLocations}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0.3 }}
        style={styles.button}
      >
        {content}
      </LinearGradient>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    paddingVertical: 16,
    borderRadius: radii.lg,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: colors.magenta,
    shadowOpacity: 0.4,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  destructiveButton: {
    backgroundColor: colors.err,
    shadowColor: colors.err,
    shadowOpacity: 0.3,
  },
  label: {
    color: "#fff",
    fontFamily: fonts.bodySemiBold,
    fontSize: 15,
  },
});
