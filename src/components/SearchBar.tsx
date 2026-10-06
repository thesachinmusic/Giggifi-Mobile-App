import { Pressable, StyleSheet, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { fonts, mock, radii, spacing } from "@/theme";

// Zepto/Blinkit-style pill search bar — big touch target, icon-led, sits
// at the top of Home so search is always one thumb-reach away. Browse's own
// editable search row matches this shape (radii.pill, 48pt) too — see
// (tabs)/browse.tsx.
export function SearchBarStatic({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={styles.wrap}>
      <View style={styles.row}>
        <Feather name="search" size={18} color="#E8E0F5" />
        <Text style={styles.staticLabel}>{label}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    minHeight: 46,
  },
  staticLabel: {
    fontFamily: fonts.body,
    fontSize: 13.5,
    color: mock.textSoft,
  },
});
