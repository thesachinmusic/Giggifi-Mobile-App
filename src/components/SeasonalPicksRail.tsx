import { useCallback, useEffect, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { fetchSeasonalPicks, type SeasonalPick } from "@/lib/api";
import { captureError } from "@/lib/telemetry";
import { SectionHeader } from "@/components/SectionHeader";
import { getSeasonalArt } from "@/components/SeasonalArt";
import { colors, fonts, radii, spacing } from "@/theme";

const CARD_WIDTH = 130;
const CARD_HEIGHT = CARD_WIDTH * 1.3;

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
          // Illustrated artwork per occasion when one exists for this
          // title; falls back to the admin-configured emoji glyph for any
          // occasion not yet designed (see SeasonalArt.tsx) rather than
          // blocking on it.
          const art = getSeasonalArt(item.title);
          return (
            <Pressable style={styles.card} onPress={() => router.push("/(tabs)/browse")}>
              {art ? (
                // Same "image fills, title overlaid on a bottom scrim"
                // treatment as FeaturedArtistCard. The card's own
                // colors.surface background (below) shows through cleanly
                // wherever a PNG has real transparency.
                <>
                  <Image source={art} style={StyleSheet.absoluteFill} contentFit="cover" />
                  <LinearGradient
                    colors={["transparent", "rgba(12,7,16,0.15)", "rgba(12,7,16,0.92)"]}
                    locations={[0, 0.55, 1]}
                    style={StyleSheet.absoluteFill}
                  />
                  <Text style={styles.titleOverlay} numberOfLines={2}>{item.title}</Text>
                </>
              ) : (
                <>
                  <Text style={styles.icon}>{item.icon ?? "✨"}</Text>
                  <Text style={styles.title} numberOfLines={2}>{item.title}</Text>
                </>
              )}
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
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    overflow: "hidden",
  },
  icon: { fontSize: 26, marginBottom: 6 },
  title: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 11.5,
    color: colors.text,
    textAlign: "center",
    paddingHorizontal: spacing.sm,
  },
  titleOverlay: {
    position: "absolute",
    left: spacing.sm,
    right: spacing.sm,
    bottom: spacing.sm,
    fontFamily: fonts.bodySemiBold,
    fontSize: 12.5,
    color: "#fff",
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
