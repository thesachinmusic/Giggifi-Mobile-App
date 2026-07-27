import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, fonts, spacing } from "@/theme";

export function SectionHeader({ title, sub, onSeeAll }: { title: string; sub?: string; onSeeAll?: () => void }) {
  return (
    <View style={styles.row}>
      <View style={styles.left}>
        <Text style={styles.title}>{title}</Text>
        {sub ? <Text style={styles.sub}>{sub}</Text> : null}
      </View>
      {onSeeAll ? (
        <Pressable onPress={onSeeAll}>
          <Text style={styles.link}>See all</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  left: { gap: 2 },
  title: {
    fontFamily: fonts.display,
    fontSize: 19,
    color: colors.text,
  },
  sub: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.textMute,
  },
  link: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    color: colors.textDim,
  },
});
