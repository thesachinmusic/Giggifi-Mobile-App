import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { LOCATION_FAILURE_COPY, type LocationFailure } from "@/lib/device-location";
import { colors, fonts, radii, spacing } from "@/theme";

// Explains why location failed and offers the right next step: "Open
// Settings" when Android will no longer show the permission prompt, and
// "Try again" always.
export function LocationProblemCard({ reason, onRetry }: { reason: LocationFailure; onRetry: () => void }) {
  const copy = LOCATION_FAILURE_COPY[reason];
  return (
    <View style={styles.box} accessibilityRole="alert">
      <Feather name="map-pin" size={16} color={colors.warn} />
      <View style={styles.body}>
        <Text style={styles.title}>{copy.title}</Text>
        <Text style={styles.text}>{copy.text}</Text>
        <View style={styles.buttons}>
          {reason === "blocked" ? (
            <Pressable onPress={() => Linking.openSettings()} style={styles.button} accessibilityRole="button">
              <Text style={styles.buttonText}>Open Settings</Text>
            </Pressable>
          ) : null}
          <Pressable onPress={onRetry} style={styles.button} accessibilityRole="button">
            <Text style={styles.buttonText}>Try again</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    flexDirection: "row",
    gap: spacing.sm,
    padding: spacing.sm,
    borderRadius: radii.md,
    backgroundColor: colors.warn + "14",
    borderWidth: 1,
    borderColor: colors.warn + "40",
    marginTop: spacing.sm,
  },
  body: { flex: 1, gap: 4 },
  title: { fontFamily: fonts.bodySemiBold, fontSize: 13, color: colors.warn },
  text: { fontFamily: fonts.body, fontSize: 12, lineHeight: 16, color: colors.textDim },
  buttons: { flexDirection: "row", gap: spacing.sm, flexWrap: "wrap" },
  button: {
    marginTop: 4,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: radii.pill,
    backgroundColor: colors.warn + "26",
    borderWidth: 1,
    borderColor: colors.warn + "66",
  },
  buttonText: { fontFamily: fonts.bodySemiBold, fontSize: 12, color: colors.warn },
});
