import { useCallback, useEffect, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { fetchSeasonalPicks, type SeasonalPick } from "@/lib/api";
import { captureError } from "@/lib/telemetry";
import { SectionHeader } from "@/components/SectionHeader";
import { getSeasonalIcon } from "@/components/SeasonalIcons";
import { colors, fonts, radii, spacing } from "@/theme";

// Home's "Seasonal Picks" — driven entirely by the website's
// FestivalCalendarEntry calendar (see getActiveSeasonalPicks), never
// hardcoded here. Renders nothing while empty, same as any other
// admin/calendar-driven strip on Home (AnnouncementBanner's old pattern).
// Picks carry no category/subcategory of their own to deep-link into, so
// tapping one opens Browse unfiltered — the same safe fallback already
// used by "Popular right now"'s onSeeAll and the reels promo elsewhere on
// this screen, rather than guessing at a category mapping that doesn't
// exist in the data.
export function SeasonalPicksRail() {
  const [picks, setPicks] = useState<SeasonalPick[]>([]);

  const load = useCallback(async () => {
    try {
      const { picks: results } = await fetchSeasonalPicks();
      setPicks(results);
    } catch (err) {
      captureError(err, "home-seasonal-picks-fetch");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (picks.length === 0) return null;

  const activeNames = picks.filter((p) => p.isActive).map((p) => p.title);
  const hint = activeNames.length > 0
    ? `Auto-updates with the calendar — right now it's ${activeNames.join(", ")}`
    : "Auto-updates with the calendar";

  return (
    <View style={styles.wrap}>
      <SectionHeader title="Seasonal Picks" />
      <FlatList
        data={picks}
        horizontal
        showsHorizontalScrollIndicator={false}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.row}
        renderItem={({ item }) => {
          // Original line-art per occasion when one exists for this title;
          // falls back to the admin-configured emoji glyph for any occasion
          // not yet designed (see SeasonalIcons.tsx) rather than blocking
          // on it.
          const Icon = getSeasonalIcon(item.title);
          return (
            <Pressable style={styles.card} onPress={() => router.push("/(tabs)/browse")}>
              {Icon ? <Icon /> : <Text style={styles.icon}>{item.icon ?? "✨"}</Text>}
              <Text style={styles.title} numberOfLines={2}>{item.title}</Text>
            </Pressable>
          );
        }}
      />
      <Text style={styles.hint}>{hint}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: spacing.xl },
  row: { paddingHorizontal: spacing.lg, gap: spacing.sm },
  card: {
    width: 96,
    alignItems: "center",
    gap: 6,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
  },
  icon: { fontSize: 26 },
  title: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 11.5,
    color: colors.text,
    textAlign: "center",
  },
  hint: {
    fontFamily: fonts.body,
    fontStyle: "italic",
    fontSize: 10.5,
    color: colors.textMute,
    marginTop: spacing.xs,
    paddingHorizontal: spacing.lg,
  },
});
