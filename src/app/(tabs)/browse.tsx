import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import { Feather } from "@expo/vector-icons";
import type { BottomSheetModal } from "@gorhom/bottom-sheet";
import { GradientBackground } from "@/components/GradientBackground";
import { CategoryPill } from "@/components/CategoryPill";
import { ArtistCard } from "@/components/ArtistCard";
import { SortSheet } from "@/components/SortSheet";
import { FilterSheet } from "@/components/FilterSheet";
import { Skeleton } from "@/components/Skeleton";
import { fetchArtists, fetchVendors, type ArtistSummary, type VendorSummary } from "@/lib/api";
import { CATEGORIES } from "@/lib/categories";
import { VENDOR_CATEGORIES } from "@/lib/vendor-categories";
import { colors, fonts, radii, spacing } from "@/theme";
import { applySortAndFilters, countActiveFilters, DEFAULT_FILTERS, SORT_OPTIONS, type FilterState, type SortOption } from "@/lib/sort-filter";
import { hapticSelect } from "@/lib/haptics";
import { addRecentSearch, clearRecentSearches, getRecentSearches } from "@/lib/recent-searches-storage";
import { captureError } from "@/lib/telemetry";

const ALL = "All";
const SEARCH_DEBOUNCE_MS = 400;
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
  const [searchFocused, setSearchFocused] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);

  const sortSheetRef = useRef<BottomSheetModal>(null);
  const filterSheetRef = useRef<BottomSheetModal>(null);
  const searchAbortRef = useRef<AbortController | null>(null);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isFirstSearchRun = useRef(true);
  // Set when something else (a recent-search chip) already triggered the
  // search for this exact `search` value — otherwise the debounce effect
  // below would also fire 400ms later for the same value, a redundant
  // duplicate request.
  const skipNextDebounceRef = useRef(false);

  const categoryList = vertical === "artist" ? CATEGORIES : VENDOR_CATEGORIES;

  useEffect(() => {
    getRecentSearches().then(setRecentSearches).catch((err) => captureError(err, "recent-searches-load"));
  }, []);

  function recordSearch(term: string) {
    const trimmed = term.trim();
    if (!trimmed) return;
    addRecentSearch(trimmed).then(setRecentSearches).catch((err) => captureError(err, "recent-search-save"));
  }

  function handleClearRecentSearches() {
    setRecentSearches([]);
    clearRecentSearches().catch((err) => captureError(err, "recent-searches-clear"));
  }

  // A newer search should always win over a slower older one, whether that's
  // debounce superseding debounce or a manual submit superseding a pending
  // debounce — cancelling the previous in-flight request (rather than just
  // letting both race) means a stale response can never overwrite a fresher one.
  const load = useCallback(async (v: Vertical, cat: string, q: string) => {
    searchAbortRef.current?.abort();
    const controller = new AbortController();
    searchAbortRef.current = controller;
    setLoading(true);
    setError("");
    try {
      if (v === "artist") {
        const { artists: results } = await fetchArtists({ category: cat, search: q }, controller.signal);
        setArtists(results);
      } else {
        const { vendors: results } = await fetchVendors({ category: cat, search: q }, controller.signal);
        setVendors(results);
      }
    } catch {
      // A cancellation (superseded by a newer search) isn't a real failure —
      // only report an error if this request is still the current one.
      if (controller.signal.aborted && searchAbortRef.current !== controller) return;
      setError(`Couldn't load ${v === "artist" ? "artists" : "vendors"}. Pull down to try again.`);
    } finally {
      if (searchAbortRef.current === controller) setLoading(false);
    }
  }, []);

  // Browse is a tab screen — it stays mounted after the first visit, so a
  // later router.push({ pathname: "/(tabs)/browse", params }) from Home
  // updates useLocalSearchParams() without remounting this component. The
  // useState initializers above only capture params from the very first
  // mount, so re-sync on every params change to pick up later category taps.
  useEffect(() => {
    if (params.vertical) setVertical(params.vertical);
    if (params.category) setCategory(params.category);
  }, [params.vertical, params.category]);

  useEffect(() => {
    load(vertical, category, search);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vertical, category]);

  // Debounces typing only — the vertical/category effect above already
  // fires immediately on a tap, and this would otherwise also fire once on
  // mount with the same empty search that effect already just loaded.
  useEffect(() => {
    if (isFirstSearchRun.current) {
      isFirstSearchRun.current = false;
      return;
    }
    if (skipNextDebounceRef.current) {
      skipNextDebounceRef.current = false;
      return;
    }
    searchDebounceRef.current = setTimeout(() => {
      load(vertical, category, search);
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  function switchVertical(next: Vertical) {
    if (next === vertical) return;
    setVertical(next);
    setCategory(ALL);
    // Gender only applies to artists — a stale selection carried over from
    // the Artists tab would otherwise silently zero out every vendor, since
    // VendorSummary has no gender field for applySortAndFilters to match.
    if (next === "vendor") setFilters((f) => ({ ...f, gender: "Any" }));
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
            onFocus={() => setSearchFocused(true)}
            onBlur={() => {
              setSearchFocused(false);
              recordSearch(search);
            }}
            onSubmitEditing={() => {
              if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
              recordSearch(search);
              load(vertical, category, search);
            }}
            placeholder={vertical === "artist" ? "Search by name, city, genre…" : "Search by business, city, category…"}
            placeholderTextColor={colors.textMute}
            style={styles.searchInput}
            returnKeyType="search"
          />
        </View>

        {searchFocused && !search && recentSearches.length > 0 ? (
          <View style={styles.recentRow}>
            <FlatList
              data={recentSearches}
              horizontal
              showsHorizontalScrollIndicator={false}
              keyExtractor={(item) => item}
              contentContainerStyle={styles.recentChipRow}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => (
                <Pressable
                  style={styles.recentChip}
                  onPress={() => {
                    skipNextDebounceRef.current = true;
                    setSearch(item);
                    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
                    recordSearch(item);
                    load(vertical, category, item);
                  }}
                >
                  <Feather name="clock" size={11} color={colors.textMute} />
                  <Text style={styles.recentChipText}>{item}</Text>
                </Pressable>
              )}
              ListFooterComponent={
                <Pressable style={styles.recentClear} onPress={handleClearRecentSearches} hitSlop={8}>
                  <Text style={styles.recentClearText}>Clear</Text>
                </Pressable>
              }
            />
          </View>
        ) : null}

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
          <View style={styles.grid}>
            {[0, 1, 2].map((row) => (
              <View key={row} style={styles.skeletonRow}>
                <SkeletonCard />
                <SkeletonCard />
              </View>
            ))}
          </View>
        ) : error ? (
          <ScrollView
            contentContainerStyle={styles.errorScroll}
            refreshControl={<RefreshControl refreshing={false} onRefresh={() => load(vertical, category, search)} tintColor={colors.pink} />}
          >
            <Text style={styles.muted}>{error}</Text>
            <Pressable style={styles.retryButton} onPress={() => load(vertical, category, search)}>
              <Text style={styles.retryButtonText}>Try again</Text>
            </Pressable>
          </ScrollView>
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
      <FilterSheet
        ref={filterSheetRef}
        value={filters}
        vertical={vertical}
        onApply={(value) => { hapticSelect(); setFilters(value); filterSheetRef.current?.dismiss(); }}
      />
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
    minHeight: 48,
    marginHorizontal: spacing.lg,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.ink2,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.pill,
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
  recentRow: { marginBottom: spacing.md },
  recentChipRow: { paddingHorizontal: spacing.lg, gap: spacing.xs, alignItems: "center" },
  recentChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.ink2,
  },
  recentChipText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 12.5,
    color: colors.textDim,
  },
  recentClear: {
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  recentClearText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 12.5,
    color: colors.pink,
  },
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
  errorScroll: { flexGrow: 1, alignItems: "center", paddingTop: spacing.xl },
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
  grid: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.sm },
  gridRow: { gap: spacing.sm },
  skeletonRow: { flexDirection: "row", gap: spacing.sm },
  skeletonCard: { flex: 1 },
  skeletonLine: { marginTop: 8 },
  skeletonLineSm: { marginTop: 6 },
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
