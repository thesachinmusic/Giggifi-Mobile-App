import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, FlatList, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { GradientBackground } from "@/components/GradientBackground";
import { CategoryPill } from "@/components/CategoryPill";
import { ArtistCard } from "@/components/ArtistCard";
import { fetchArtists, type ArtistSummary } from "@/lib/api";
import { CATEGORIES } from "@/lib/categories";
import { colors, fonts, spacing } from "@/theme";

const ALL = "All";

export default function BrowseScreen() {
  const params = useLocalSearchParams<{ category?: string }>();
  const [category, setCategory] = useState(params.category ?? ALL);
  const [search, setSearch] = useState("");
  const [artists, setArtists] = useState<ArtistSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async (cat: string, q: string) => {
    setLoading(true);
    setError("");
    try {
      const { artists: results } = await fetchArtists({ category: cat, search: q });
      setArtists(results);
    } catch {
      setError("Couldn't load artists. Pull down to try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(category, search);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category]);

  return (
    <GradientBackground>
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <Text style={styles.title}>Browse Artists</Text>

        <View style={styles.searchRow}>
          <Feather name="search" size={16} color={colors.textMute} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            onSubmitEditing={() => load(category, search)}
            placeholder="Search by name, city, genre…"
            placeholderTextColor={colors.textMute}
            style={styles.searchInput}
            returnKeyType="search"
          />
        </View>

        <FlatList
          data={[ALL, ...CATEGORIES.map((c) => c.label)]}
          horizontal
          showsHorizontalScrollIndicator={false}
          keyExtractor={(item) => item}
          contentContainerStyle={styles.categoryRow}
          renderItem={({ item }) => (
            <CategoryPill
              label={item}
              emoji={CATEGORIES.find((c) => c.label === item)?.emoji}
              active={category === item}
              onPress={() => setCategory(item)}
            />
          )}
        />

        {loading ? (
          <ActivityIndicator color={colors.pink} style={styles.loader} />
        ) : error ? (
          <Text style={styles.muted}>{error}</Text>
        ) : (
          <FlatList
            data={artists}
            keyExtractor={(item) => item.id}
            numColumns={2}
            columnWrapperStyle={styles.gridRow}
            contentContainerStyle={styles.grid}
            ListEmptyComponent={<Text style={styles.muted}>No artists match yet — try another filter.</Text>}
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

const styles = StyleSheet.create({
  safe: { flex: 1 },
  title: {
    fontFamily: fonts.display,
    fontSize: 26,
    color: colors.text,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginHorizontal: spacing.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    backgroundColor: colors.ink2,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 14,
    marginBottom: spacing.md,
  },
  searchInput: {
    flex: 1,
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.text,
  },
  categoryRow: { paddingHorizontal: spacing.lg, gap: spacing.xs, paddingBottom: spacing.md },
  loader: { marginTop: spacing.xl },
  grid: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.sm },
  gridRow: { gap: spacing.sm },
  muted: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.textMute,
    paddingHorizontal: spacing.lg,
    marginTop: spacing.lg,
  },
});
