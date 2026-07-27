import { StyleSheet, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { colors, fonts } from "@/theme";

// Public-facing rating only — star + number. No review counts or internal
// behavior signals surface here; those stay server-side by design.
export function RatingBadge({ rating, size = 12 }: { rating: number | null | undefined; size?: number }) {
  if (rating == null) return null;
  return (
    <View style={styles.row}>
      <Feather name="star" size={size} color={colors.orange} />
      <Text style={[styles.text, { fontSize: size + 1 }]}>{rating.toFixed(1)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 3 },
  text: { fontFamily: fonts.bodyMedium, color: colors.text },
});
