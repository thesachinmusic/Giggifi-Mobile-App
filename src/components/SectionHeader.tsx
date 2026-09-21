import { Pressable, StyleSheet, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { GradientText } from "@/components/GradientText";
import { colors, fonts, spacing, textScale, visualColors, visualGradients } from "@/theme";

// Section heading: gradient title, plus an optional gradient icon badge in
// front (`icon`). `accent` swaps the badge/title to one category colour.
export function SectionHeader({
  title,
  sub,
  onSeeAll,
  icon,
  accent,
}: {
  title: string;
  sub?: string;
  onSeeAll?: () => void;
  icon?: keyof typeof Feather.glyphMap;
  accent?: string;
}) {
  const badgeColors = accent ? ([accent, accent] as const) : visualGradients.badge;
  const titleColors = accent ? ([visualColors.white, accent] as const) : visualGradients.headline;
  return (
    <View style={styles.row}>
      <View style={styles.leftRow}>
        {icon ? (
          <LinearGradient colors={badgeColors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.badge}>
            <Feather name={icon} size={15} color={visualColors.ink} />
          </LinearGradient>
        ) : null}
        <View style={styles.left}>
          <GradientText colors={titleColors} style={styles.title} numberOfLines={1}>
            {title}
          </GradientText>
          {sub ? <Text style={styles.sub}>{sub}</Text> : null}
        </View>
      </View>
      {onSeeAll ? (
        <Pressable onPress={onSeeAll} style={({ pressed }) => pressed && styles.pressed}>
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
    gap: 10,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  leftRow: { flexDirection: "row", alignItems: "center", gap: 10, flexShrink: 1 },
  badge: { width: 30, height: 30, borderRadius: 10, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  left: { gap: 2, flexShrink: 1 },
  title: {
    fontFamily: fonts.displayBold,
    fontSize: textScale.section,
    letterSpacing: -0.2,
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
  pressed: { opacity: 0.6 },
});
