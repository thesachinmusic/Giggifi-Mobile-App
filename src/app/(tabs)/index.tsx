import { useCallback, useEffect, useState } from "react";
import { FlatList, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { GradientBackground } from "@/components/GradientBackground";
import { CategoryPill } from "@/components/CategoryPill";
import { ArtistCard } from "@/components/ArtistCard";
import { useAuth } from "@/lib/auth-context";
import { fetchArtists, type ArtistSummary } from "@/lib/api";
import { CATEGORIES } from "@/lib/categories";
import { colors, fonts, spacing } from "@/theme";

export default function HomeScreen() {
  const { user } = useAuth();
  const [artists, setArtists] = useState<ArtistSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const { artists: results } = await fetchArtists({});
      setArtists(results.slice(0, 12));
    } catch {
      // Home rail fails silently — Browse tab is the source of truth and shows real errors.
    }
  }, []);

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [load]);

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  const firstName = user?.name?.split(" ")[0];

  return (
    <GradientBackground>
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.pink} />}
        >
          <View style={styles.header}>
            <Text style={styles.eyebrow}>GIGGFI</Text>
            <Text style={styles.title}>{firstName ? `Hey ${firstName},` : "Hey there,"}{"\n"}who's the act tonight?</Text>
          </View>

          <FlatList
            data={CATEGORIES as readonly { label: string; emoji: string }[]}
            horizontal
            showsHorizontalScrollIndicator={false}
            keyExtractor={(item) => item.label}
            contentContainerStyle={styles.categoryRow}
            renderItem={({ item }) => (
              <CategoryPill
                label={item.label}
                emoji={item.emoji}
                active={false}
                onPress={() => router.push({ pathname: "/(tabs)/browse", params: { category: item.label } })}
              />
            )}
          />

          <View style={styles.sectionHead}>
            <Text style={styles.sectionTitle}>Popular right now</Text>
            <Text style={styles.sectionLink} onPress={() => router.push("/(tabs)/browse")}>See all</Text>
          </View>

          {loading ? (
            <Text style={styles.muted}>Loading artists…</Text>
          ) : artists.length === 0 ? (
            <Text style={styles.muted}>No artists live yet — check back soon.</Text>
          ) : (
            <FlatList
              data={artists}
              horizontal
              showsHorizontalScrollIndicator={false}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.artistRow}
              renderItem={({ item }) => (
                <ArtistCard artist={item} width={168} onPress={() => router.push({ pathname: "/artist/[id]", params: { id: item.id } })} />
              )}
            />
          )}
        </ScrollView>
      </SafeAreaView>
    </GradientBackground>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  scroll: { paddingBottom: spacing.xxl },
  header: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, marginBottom: spacing.lg },
  eyebrow: {
    fontFamily: fonts.mono,
    fontSize: 11,
    color: colors.orange,
    letterSpacing: 2,
    marginBottom: spacing.sm,
  },
  title: {
    fontFamily: fonts.display,
    fontSize: 30,
    lineHeight: 34,
    color: colors.text,
  },
  categoryRow: { paddingHorizontal: spacing.lg, gap: spacing.xs, paddingBottom: spacing.lg },
  sectionHead: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  sectionTitle: {
    fontFamily: fonts.display,
    fontSize: 20,
    color: colors.text,
  },
  sectionLink: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    color: colors.textDim,
  },
  artistRow: { paddingHorizontal: spacing.lg, gap: spacing.sm },
  muted: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.textMute,
    paddingHorizontal: spacing.lg,
  },
});
