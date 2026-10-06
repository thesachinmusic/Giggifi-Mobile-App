import { useCallback, useEffect, useState } from "react";
import { FlatList, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { fetchSeasonIndex, fetchSeasonalPicks, type SeasonalPick } from "@/lib/api";
import { seasonKeyForTitle } from "@/lib/seasons";
import { captureError } from "@/lib/telemetry";
import { GradientText } from "@/components/GradientText";
import { getSeasonalArt } from "@/components/SeasonalArt";
import { colors, fonts, mock, spacing } from "@/theme";

const CARD_WIDTH = 124;
const CARD_HEIGHT = 90;

// Mock heading gradient: white into amber into pink.
const HEADING_GRADIENT = ["#FFFFFF", "#FFB24A", "#FF5A8A"] as const;
// No new font package: the italic accent note uses the system serif.
const SERIF = Platform.select({ ios: "Georgia", default: "serif" });

// Home's "Seasonal Picks" — driven entirely by the website's
// FestivalCalendarEntry calendar (see getActiveSeasonalPicks), never
// hardcoded here. Renders nothing while empty, same as any other
// admin/calendar-driven strip on Home (AnnouncementBanner's old pattern).
// Picks carry no category/subcategory of their own to deep-link into, so
// tapping one opens Browse unfiltered — the same safe fallback already
// used by "Popular right now"'s onSeeAll and the reels promo elsewhere on
// this screen, rather than guessing at a category mapping that doesn't
// exist in the data.
// Marks the dated (calendar-driven) festival tiles — evergreen tiles such as
// Wedding or Corporate never carry it.
function AutoBadge() {
  return (
    <View style={styles.autoBadge} pointerEvents="none">
      <Text style={styles.autoBadgeText}>Auto</Text>
    </View>
  );
}

export function SeasonalPicksRail() {
  const [picks, setPicks] = useState<SeasonalPick[]>([]);
  // Keys of seasons that have a page (artists to show). null = not known — the
  // season endpoint is missing (older backend) or failed — in which case every
  // tile behaves as before and opens Browse.
  const [availableSeasons, setAvailableSeasons] = useState<Set<string> | null>(null);

  const load = useCallback(async () => {
    try {
      const { picks: results } = await fetchSeasonalPicks();
      setPicks(results);
    } catch (err) {
      captureError(err, "home-seasonal-picks-fetch");
    }
    try {
      const { seasons } = await fetchSeasonIndex();
      setAvailableSeasons(new Set(seasons.map((x) => x.key)));
    } catch {
      setAvailableSeasons(null);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // A tile whose season is known but has nobody to show is hidden rather than
  // linking to an empty page. Unknown seasons (no page config) stay as before.
  const visiblePicks = picks.filter((p) => {
    const key = seasonKeyForTitle(p.title);
    return !(availableSeasons && key && !availableSeasons.has(key));
  });
  if (visiblePicks.length === 0) return null;

  const openTile = (title: string) => {
    const key = seasonKeyForTitle(title);
    if (key && availableSeasons?.has(key)) router.push({ pathname: "/season/[key]", params: { key } });
    else router.push("/(tabs)/browse");
  };
  const openAll = () => {
    if (availableSeasons && availableSeasons.size > 0) router.push("/season");
    else router.push("/(tabs)/browse");
  };

  const activeNames = visiblePicks.filter((p) => p.isActive).map((p) => p.title);
  const hint = activeNames.length > 0
    ? `Auto-updates with the calendar — right now it's ${activeNames.join(", ")}`
    : "Auto-updates with the calendar";

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <GradientText style={styles.heading} colors={HEADING_GRADIENT}>Seasonal Picks</GradientText>
        <Pressable onPress={openAll} hitSlop={8}>
          <Text style={styles.viewAll}>View All ›</Text>
        </Pressable>
      </View>
      <FlatList
        data={visiblePicks}
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
            <Pressable style={styles.card} onPress={() => openTile(item.title)}>
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
                  {item.isActive ? <AutoBadge /> : null}
                </>
              ) : (
                <>
                  <Text style={styles.icon}>{item.icon ?? "✨"}</Text>
                  <Text style={styles.title} numberOfLines={2}>{item.title}</Text>
                  {item.isActive ? <AutoBadge /> : null}
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
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.md, marginBottom: 10 },
  heading: { fontFamily: fonts.displayBold, fontSize: 19 },
  viewAll: { fontFamily: fonts.bodySemiBold, fontSize: 12, color: "#FF8A9C" },
  row: { paddingHorizontal: spacing.md, gap: 8 },
  card: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 16,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: mock.cardBorderWarm,
    overflow: "hidden",
  },
  icon: { fontSize: 24, marginBottom: 4 },
  title: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 12,
    color: colors.text,
    textAlign: "center",
    paddingHorizontal: spacing.sm,
  },
  titleOverlay: {
    position: "absolute",
    left: 10,
    right: 8,
    bottom: 8,
    fontFamily: fonts.bodySemiBold,
    fontSize: 12,
    lineHeight: 13,
    color: "#fff",
  },
  autoBadge: {
    position: "absolute",
    left: 8,
    top: 8,
    height: 18,
    paddingHorizontal: 8,
    borderRadius: 9,
    justifyContent: "center",
    backgroundColor: "rgba(10,8,18,0.6)",
    borderWidth: 1,
    borderColor: "rgba(255,200,120,0.5)",
  },
  autoBadgeText: { fontFamily: fonts.bodySemiBold, fontSize: 9, color: "#FFD08A" },
  hint: {
    fontFamily: SERIF,
    fontStyle: "italic",
    fontSize: 14,
    color: mock.textSoft,
    marginTop: 10,
    paddingHorizontal: spacing.md,
  },
});
