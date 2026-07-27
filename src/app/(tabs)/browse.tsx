import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import { Feather } from "@expo/vector-icons";
import type { BottomSheetModal } from "@gorhom/bottom-sheet";
import { GradientBackground } from "@/components/GradientBackground";
import { CategoryPill } from "@/components/CategoryPill";
import { ArtistCard } from "@/components/ArtistCard";
import { SortSheet } from "@/components/SortSheet";
import { FilterSheet } from "@/components/FilterSheet";
import { fetchArtists, fetchVendors, type ArtistSummary, type VendorSummary } from "@/lib/api";
import { CATEGORIES } from "@/lib/categories";
import { VENDOR_CATEGORIES } from "@/lib/vendor-categories";
import { colors, fonts, radii, spacing } from "@/theme";
import { applySortAndFilters, countActiveFilters, DEFAULT_FILTERS, SORT_OPTIONS, type FilterState, type SortOption } from "@/lib/sort-filter";

const ALL = "All";
type Vertical = "artist" | "vendor";

export default function BrowseScreen() {
  const params = useLocalSearchParams<{ category?: string; vertical?: Vertical }>();
  const [vertical, setVertical] = useState<Vertical>(params.vertical ?? "artist");
  const [category, setCategory] = useState(params.category ?? ALL);
  const [search, setSearch] = useState("");
  const [artists, setArtists] = useState<ArtistSummary[]>([]);
  const [vendors, setVendors] = useState<VendorSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [sort, setSort] = useState<SortOption>("recommended");
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);

  const sortSheetRef = useRef<BottomSheetModal>(null);
  const filterSheetRef = useRef<BottomSheetModal>(null);

  const categoryList = vertical === "artist" ? CATEGORIES : VENDOR_CATEGORIES;

  const load = useCallback(async (v: Vertical, cat: string, q: string) => {
    setLoading(true);
    setError("");
    try {
      if (v === "artist") {
        const { artists: results } = await fetchArtists({ category: cat, search: q });
        setArtists(results);
      } else {
        const { vendors: results } = await fetchVendors({ category: cat, search: q });
        setVendors(results);
      }
    } catch {
      setError(`Couldn't load ${v === "artist" ? "artists" : "vendors"}. Pull down to try again.`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(vertical, category, search);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vertical, category]);

  function switchVertical(next: Vertical) {
    if (next === vertical) return;
    setVertical(next);
    setCategory(ALL);
  }

  const visibleArtists = useMemo(() => applySortAndFilters(artists, sort, filters), [artists, sort, filters]);
  const visibleVendors = useMemo(() => applySortAndFilters(vendors, sort, filters), [vendors, sort, filters]);
  const visibleCount = vertical === "artist" ? visibleArtists.length : visibleVendors.length;
  const activeFilterCount = countActiveFilters(filters);
  const sortLabel = SORT_OPTIONS.find((o) => o.key === sort)?.label ?? "Sort";

  return (
    <GradientBackground>
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <Text style={styles.title}>Browse {vertical === "artist" ? "Artists" : "Vendors"}</Text>

        <View style={styles.verticalToggle}>
          <Pressable style={[styles.verticalTab, vertical === "artist" && styles.verticalTabActive]} onPress={() => switchVertical("artist")}>
            <Text style={[styles.verticalTabText, vertical === "artist" && styles.verticalTabTextActive]}>Artists</Text>
          </Pressable>
          <Pressable style={[styles.verticalTab, vertical === "vendor" && styles.verticalTabActive]} onPress={() => switchVertical("vendor")}>
            <Text style={[styles.verticalTabText, vertical === "vendor" && styles.verticalTabTextActive]}>Vendors</Text>
          </Pressable>
        </View>

        <View style={styles.searchRow}>
          <Feather name="search" size={16} color={colors.textMute} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            onSubmitEditing={() => load(vertical, category, search)}
            placeholder={vertical === "artist" ? "Search by name, city, genre…" : "Search by business, city, category…"}
            placeholderTextColor={colors.textMute}
            style={styles.searchInput}
            returnKeyType="search"
          />
        </View>

        <FlatList
          data={[ALL, ...categoryList.map((c) => c.label)]}
          horizontal
          showsHorizontalScrollIndicator={false}
          keyExtractor={(item) => item}
          style={styles.categoryList}
          contentContainerStyle={styles.categoryRow}
          renderItem={({ item }) => (
            <CategoryPill
              label={item}
              emoji={categoryList.find((c) => c.label === item)?.emoji}
              active={category === item}
              onPress={() => setCategory(item)}
            />
          )}
        />

        <View style={styles.toolbar}>
          <Pressable style={styles.toolbarButton} onPress={() => sortSheetRef.current?.present()}>
            <Feather name="sliders" size={13} color={colors.textDim} />
            <Text style={styles.toolbarText} numberOfLines={1}>{sortLabel}</Text>
          </Pressable>
          <Pressable style={styles.toolbarButton} onPress={() => filterSheetRef.current?.present()}>
            <Feather name="filter" size={13} color={colors.textDim} />
            <Text style={styles.toolbarText}>Filter</Text>
            {activeFilterCount > 0 ? (
              <View style={styles.filterBadge}>
                <Text style={styles.filterBadgeText}>{activeFilterCount}</Text>
              </View>
            ) : null}
          </Pressable>
          <Text style={styles.resultCount}>{visibleCount} found</Text>
        </View>

        {loading ? (
          <ActivityIndicator color={colors.pink} style={styles.loader} />
        ) : error ? (
          <Text style={styles.muted}>{error}</Text>
        ) : vertical === "artist" ? (
          <FlatList
            data={visibleArtists}
            keyExtractor={(item) => item.id}
            numColumns={2}
            columnWrapperStyle={styles.gridRow}
            contentContainerStyle={styles.grid}
            ListEmptyComponent={<EmptyState label="artists" />}
            renderItem={({ item }) => (
              <ArtistCard
                artist={item}
                onPress={() => router.push({ pathname: "/artist/[id]", params: { id: item.id } })}
              />
            )}
          />
        ) : (
          <FlatList
            data={visibleVendors}
            keyExtractor={(item) => item.id}
            numColumns={2}
            columnWrapperStyle={styles.gridRow}
            contentContainerStyle={styles.grid}
            ListEmptyComponent={<EmptyState label="vendors" />}
            renderItem={({ item }) => (
              <ArtistCard
                vendor={item}
                onPress={() => router.push({ pathname: "/vendor/[id]", params: { id: item.id } })}
              />
            )}
          />
        )}
      </SafeAreaView>

      <SortSheet ref={sortSheetRef} value={sort} onChange={(value) => { setSort(value); sortSheetRef.current?.dismiss(); }} />
      <FilterSheet ref={filterSheetRef} value={filters} onApply={(value) => { setFilters(value); filterSheetRef.current?.dismiss(); }} />
    </GradientBackground>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <View style={styles.emptyState}>
      <Text style={styles.muted}>No {label} match yet — try another filter.</Text>
      <Pressable style={styles.emptyCta} onPress={() => router.push("/ask-giggfi")}>
        <Feather name="zap" size={13} color={colors.pink} />
        <Text style={styles.emptyCtaText}>Let GiggiFi find you a match instead</Text>
      </Pressable>
    </View>
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
  verticalToggle: {
    flexDirection: "row",
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    padding: 4,
    borderRadius: radii.pill,
    backgroundColor: colors.ink2,
    borderWidth: 1,
    borderColor: colors.line,
  },
  verticalTab: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: radii.pill,
    alignItems: "center",
  },
  verticalTabActive: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.lineStrong,
  },
  verticalTabText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    color: colors.textMute,
  },
  verticalTabTextActive: {
    color: colors.text,
    fontFamily: fonts.bodySemiBold,
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
  categoryList: { flexGrow: 0, flexShrink: 0, height: 46, marginBottom: spacing.md },
  categoryRow: { paddingHorizontal: spacing.lg, gap: spacing.xs, alignItems: "center" },
  toolbar: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  toolbarButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.lineStrong,
    maxWidth: 170,
  },
  toolbarText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 12.5,
    color: colors.textDim,
  },
  filterBadge: {
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.pink,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 3,
  },
  filterBadgeText: {
    fontFamily: fonts.mono,
    fontSize: 9,
    color: "#fff",
  },
  resultCount: {
    marginLeft: "auto",
    fontFamily: fonts.mono,
    fontSize: 11,
    color: colors.textMute,
  },
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
  emptyState: { alignItems: "center", gap: spacing.md, paddingTop: spacing.sm },
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
