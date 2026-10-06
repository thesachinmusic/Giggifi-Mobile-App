import { useCallback, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Feather } from "@expo/vector-icons";
import { router, Stack, useFocusEffect } from "expo-router";
import { GradientBackground } from "@/components/GradientBackground";
import { Skeleton } from "@/components/Skeleton";
import { getSeasonalArt } from "@/components/SeasonalArt";
import { fetchSeasonIndex, fetchSeasonalPicks } from "@/lib/api";
import { seasonKeyForTitle } from "@/lib/seasons";
import { captureError } from "@/lib/telemetry";
import { colors, fonts, gradients, mock, radii, spacing } from "@/theme";

interface SeasonTile {
  key: string;
  title: string;
}

const GAP = 12;

// Every active season that has a page, as a tile grid — the target of
// Seasonal Picks' "View All". Active = what the calendar is showing on Home
// right now (Seasonal Picks), limited to seasons that have artists to show.
export default function SeasonsListScreen() {
  const { width } = useWindowDimensions();
  const tileWidth = (width - spacing.md * 2 - GAP) / 2;
  const [tiles, setTiles] = useState<SeasonTile[] | null>(null);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    setError(false);
    try {
      const { seasons } = await fetchSeasonIndex();
      const available = new Map(seasons.map((s) => [s.key, s.label]));
      let list: SeasonTile[];
      try {
        const { picks } = await fetchSeasonalPicks();
        const seen = new Set<string>();
        list = picks.flatMap((p) => {
          const key = seasonKeyForTitle(p.title);
          if (!key || !available.has(key) || seen.has(key)) return [];
          seen.add(key);
          return [{ key, title: p.title }];
        });
      } catch {
        // Calendar unavailable: still offer every season that has a page.
        list = seasons.map((s) => ({ key: s.key, title: s.label }));
      }
      setTiles(list);
    } catch (err) {
      captureError(err, "seasons-list-fetch");
      setError(true);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  return (
    <GradientBackground variant="giggifi">
      <Stack.Screen options={{ title: "Seasons & events" }} />
      <SafeAreaView style={styles.safe} edges={["bottom"]}>
        {error ? (
          <View style={styles.centered}>
            <Text style={styles.muted}>Couldn&apos;t load seasons — check your connection.</Text>
            <Pressable style={styles.cta} onPress={load}>
              <Text style={styles.ctaText}>Try again</Text>
            </Pressable>
          </View>
        ) : tiles === null ? (
          <View style={styles.grid}>
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} width={tileWidth} height={120} borderRadius={radii.lg} />
            ))}
          </View>
        ) : tiles.length === 0 ? (
          <View style={styles.centered}>
            <Feather name="calendar" size={24} color={colors.textMute} />
            <Text style={styles.muted}>No seasons to show right now.</Text>
            <Pressable style={styles.cta} onPress={() => router.replace("/(tabs)/browse")}>
              <Feather name="compass" size={13} color={colors.pink} />
              <Text style={styles.ctaText}>Browse artists</Text>
            </Pressable>
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.grid} showsVerticalScrollIndicator={false}>
            {tiles.map((tile) => {
              const art = getSeasonalArt(tile.title);
              return (
                <Pressable
                  key={tile.key}
                  style={({ pressed }) => [styles.tile, { width: tileWidth }, pressed && styles.pressed]}
                  onPress={() => router.push({ pathname: "/season/[key]", params: { key: tile.key } })}
                >
                  {art ? (
                    <Image source={art} style={StyleSheet.absoluteFill} contentFit="cover" />
                  ) : (
                    <LinearGradient colors={gradients.hero} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
                  )}
                  <LinearGradient colors={["transparent", "rgba(12,9,20,0.9)"]} locations={[0.35, 1]} style={StyleSheet.absoluteFill} />
                  <Text style={styles.tileTitle} numberOfLines={2}>{tile.title}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
        )}
      </SafeAreaView>
    </GradientBackground>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: GAP, padding: spacing.md, paddingBottom: spacing.xxl },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.md, paddingHorizontal: spacing.xl },
  muted: { fontFamily: fonts.body, fontSize: 14, color: colors.textMute, textAlign: "center" },
  cta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.pink,
  },
  ctaText: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.pink },
  tile: {
    height: 120,
    borderRadius: radii.lg,
    overflow: "hidden",
    justifyContent: "flex-end",
    padding: spacing.sm,
    borderWidth: 1,
    borderColor: mock.cardBorderWarm,
    backgroundColor: colors.surface,
  },
  pressed: { opacity: 0.88, transform: [{ scale: 0.985 }] },
  tileTitle: { fontFamily: fonts.displayBold, fontSize: 15, color: "#fff" },
});
