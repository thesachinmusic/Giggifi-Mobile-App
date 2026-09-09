import { useCallback, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { router, Stack, useFocusEffect, useLocalSearchParams } from "expo-router";
import { GradientBackground } from "@/components/GradientBackground";
import { ArtistCard } from "@/components/ArtistCard";
import { Skeleton } from "@/components/Skeleton";
import { fetchArtistsByGroup, type TagGroupResult } from "@/lib/api";
import { captureError } from "@/lib/telemetry";
import { colors, fonts, radii, spacing } from "@/theme";

// Tag-group discovery — e.g. tapping the "Bhajan Jamming" announcement
// lands here at /discover/devotional. One card per matching VIDEO (not
// deduped per artist), matching GET /api/mobile/artist/by-group's own flat
// {video, artist} shape — an artist with two devotional-tagged videos is a
// real signal worth showing twice, not collapsing into one generic card.
export default function DiscoverGroupScreen() {
  const { group } = useLocalSearchParams<{ group: string }>();
  const [label, setLabel] = useState<string | null>(null);
  const [results, setResults] = useState<TagGroupResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(() => {
    if (!group) return;
    setError(false);
    fetchArtistsByGroup(group)
      .then(({ group: g, results: r }) => {
        setLabel(g.label);
        setResults(r);
      })
      .catch((err) => {
        captureError(err, "discover-group-fetch");
        setError(true);
      })
      .finally(() => setLoading(false));
  }, [group]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      load();
    }, [load]),
  );

  return (
    <GradientBackground>
      <Stack.Screen options={{ title: label ?? "Discover" }} />
      <SafeAreaView style={styles.safe} edges={["bottom"]}>
        {loading ? (
          <View style={styles.grid}>
            {[0, 1].map((row) => (
              <View key={row} style={styles.skeletonRow}>
                <SkeletonCard />
                <SkeletonCard />
              </View>
            ))}
          </View>
        ) : error ? (
          <View style={styles.centered}>
            <Text style={styles.muted}>Couldn&apos;t load these artists — check your connection.</Text>
            <Pressable style={styles.retryButton} onPress={() => { setLoading(true); load(); }}>
              <Text style={styles.retryButtonText}>Try again</Text>
            </Pressable>
          </View>
        ) : (
          <FlatList
            data={results}
            keyExtractor={(item) => item.video.url}
            numColumns={2}
            columnWrapperStyle={styles.gridRow}
            contentContainerStyle={styles.grid}
            ListEmptyComponent={<EmptyState label={label} />}
            renderItem={({ item }) => (
              <ArtistCard
                artist={item.artist}
                onPress={() => router.push({ pathname: "/artist/[id]", params: { id: item.artist.id } })}
              />
            )}
          />
        )}
      </SafeAreaView>
    </GradientBackground>
  );
}

function SkeletonCard() {
  return (
    <View style={styles.skeletonCard}>
      <Skeleton height={160} borderRadius={radii.xl} />
      <Skeleton height={14} width="70%" style={styles.skeletonLine} />
      <Skeleton height={11} width="40%" style={styles.skeletonLineSm} />
    </View>
  );
}

function EmptyState({ label }: { label: string | null }) {
  return (
    <View style={styles.emptyState}>
      <Feather name="music" size={22} color={colors.textMute} />
      <Text style={styles.muted}>
        No {label ?? "matching"} artists yet — check back soon.
      </Text>
      <Pressable style={styles.emptyCta} onPress={() => router.push("/(tabs)/browse")}>
        <Feather name="compass" size={13} color={colors.pink} />
        <Text style={styles.emptyCtaText}>Browse artists</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: spacing.lg },
  grid: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.sm },
  gridRow: { gap: spacing.sm },
  skeletonRow: { flexDirection: "row", gap: spacing.sm },
  skeletonCard: { flex: 1 },
  skeletonLine: { marginTop: 8 },
  skeletonLineSm: { marginTop: 6 },
  muted: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.textMute,
    textAlign: "center",
  },
  retryButton: {
    marginTop: spacing.md,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.pink,
  },
  retryButtonText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 13,
    color: colors.pink,
  },
  emptyState: { flex: 1, alignItems: "center", gap: spacing.md, paddingTop: spacing.xxl, paddingHorizontal: spacing.xl },
  emptyCta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.pink,
  },
  emptyCtaText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    color: colors.pink,
  },
});
