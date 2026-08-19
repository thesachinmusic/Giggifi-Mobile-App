import { useCallback, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import { GradientBackground } from "@/components/GradientBackground";
import { ArtistCard } from "@/components/ArtistCard";
import { Skeleton } from "@/components/Skeleton";
import { fetchSavedArtists, type ArtistSummary } from "@/lib/api";
import { captureError } from "@/lib/telemetry";
import { colors, fonts, radii, spacing } from "@/theme";

export default function SavedScreen() {
  const [artists, setArtists] = useState<ArtistSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(() => {
    setError(false);
    fetchSavedArtists()
      .then(({ artists: results }) => setArtists(results))
      .catch((err) => {
        captureError(err, "saved-artists-fetch");
        setError(true);
      })
      .finally(() => setLoading(false));
  }, []);

  // Refetches every time this screen regains focus so unsaving an artist
  // from Home, Browse or a profile screen is reflected on return here.
  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      load();
    }, [load]),
  );

  return (
    <GradientBackground>
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
            <Text style={styles.muted}>Couldn&apos;t load your saved artists — check your connection.</Text>
            <Pressable style={styles.retryButton} onPress={() => { setLoading(true); load(); }}>
              <Text style={styles.retryButtonText}>Try again</Text>
            </Pressable>
          </View>
        ) : (
          <FlatList
            data={artists}
            keyExtractor={(item) => item.id}
            numColumns={2}
            columnWrapperStyle={styles.gridRow}
            contentContainerStyle={styles.grid}
            ListEmptyComponent={<EmptyState />}
            renderItem={({ item }) => (
              <ArtistCard
                artist={item}
                onPress={() => router.push({ pathname: "/artist/[id]", params: { id: item.id } })}
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

function EmptyState() {
  return (
    <View style={styles.emptyState}>
      <Feather name="heart" size={22} color={colors.textMute} />
      <Text style={styles.muted}>No saved artists yet — tap the heart on any artist to save them here.</Text>
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
