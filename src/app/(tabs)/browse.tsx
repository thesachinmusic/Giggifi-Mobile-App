import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
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
import { fetchArtists, fetchVendors, type ArtistSummary, type ListingParams, type VendorSummary } from "@/lib/api";
import { CATEGORIES } from "@/lib/categories";
import { VENDOR_CATEGORIES } from "@/lib/vendor-categories";
import { colors, fonts, radii, spacing } from "@/theme";
import { countActiveFilters, DEFAULT_FILTERS, SORT_OPTIONS, type FilterState, type SortOption } from "@/lib/sort-filter";
import { hapticSelect } from "@/lib/haptics";
import { addRecentSearch, clearRecentSearches, getRecentSearches } from "@/lib/recent-searches-storage";
import { captureError } from "@/lib/telemetry";

const ALL = "All";
const SEARCH_DEBOUNCE_MS = 400;
const PAGE_LIMIT = 20;
type Vertical = "artist" | "vendor";

// Server-side sort/filter query params shared by fetchArtists and
// fetchVendors — sort and filters now decide the full ordered/filtered set
// (not just the current page), so applySortAndFilters (still in
// lib/sort-filter.ts for any purely local, unpaginated use) is deliberately
// not used here anymore: re-sorting only the loaded page would be wrong the
// moment a second page exists.
function filterQueryParams(filters: FilterState): Partial<ListingParams> {
  return {
    minPrice: filters.minPrice || undefined,
    maxPrice: filters.maxPrice || undefined,
    travelReady: filters.travelReady || undefined,
    negotiableOnly: filters.negotiableOnly || undefined,
    gender: filters.gender !== "Any" ? filters.gender : undefined,
  };
}

export default function BrowseScreen() {
  const params = useLocalSearchParams<{ category?: string; vertical?: Vertical }>();
  const [vertical, setVertical] = useState<Vertical>(params.vertical ?? "artist");
  const [category, setCategory] = useState(params.category ?? ALL);
  const [search, setSearch] = useState("");
  const [artists, setArtists] = useState<ArtistSummary[]>([]);
  const [vendors, setVendors] = useState<VendorSummary[]>([]);
  const [artistCursor, setArtistCursor] = useState<string | null>(null);
  const [vendorCursor, setVendorCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
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
  // Synchronous guard — onEndReached can fire again before the loadingMore
  // state update from the previous call has actually re-rendered.
  const loadingMoreRef = useRef(false);
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
  // Always fetches page 1 (no cursor) — sort/filter/search/category/vertical
  // changes all replace the loaded set from scratch, never append.
  const load = useCallback(async (v: Vertical, cat: string, q: string, sortValue: SortOption, filterValue: FilterState) => {
    searchAbortRef.current?.abort();
    const controller = new AbortController();
    searchAbortRef.current = controller;
    setLoading(true);
    setError("");
    const extra = filterQueryParams(filterValue);
    try {
      if (v === "artist") {
        const { artists: results, nextCursor } = await fetchArtists(
          { category: cat, search: q, sort: sortValue, limit: PAGE_LIMIT, ...extra },
          controller.signal,
        );
        setArtists(results);
        setArtistCursor(nextCursor);
      } else {
        const { vendors: results, nextCursor } = await fetchVendors(
          { category: cat, search: q, sort: sortValue, limit: PAGE_LIMIT, ...extra },
          controller.signal,
        );
        setVendors(results);
        setVendorCursor(nextCursor);
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

  // Appends the next page using the cursor from the last response — never
  // touches the currently-loaded items, unlike load() above which replaces
  // them. Guarded against firing again while already in flight or once the
  // server has said there's nothing more (nextCursor === null).
  const loadMore = useCallback(async () => {
    const cursor = vertical === "artist" ? artistCursor : vendorCursor;
    if (loadingMoreRef.current || loading || !cursor) return;
    loadingMoreRef.current = true;
    setLoadingMore(true);
    const extra = filterQueryParams(filters);
    try {
      if (vertical === "artist") {
        const { artists: results, nextCursor } = await fetchArtists({
          category, search, sort, cursor, limit: PAGE_LIMIT, ...extra,
        });
        setArtists((prev) => [...prev, ...results]);
        setArtistCursor(nextCursor);
      } else {
        const { vendors: results, nextCursor } = await fetchVendors({
          category, search, sort, cursor, limit: PAGE_LIMIT, ...extra,
        });
        setVendors((prev) => [...prev, ...results]);
        setVendorCursor(nextCursor);
      }
    } catch (err) {
      // Silent — the footer spinner just stops. Scrolling up and back down,
      // or pull-to-refresh, retries; a toast for a page-2 failure would be
      // noisier than the failure itself.
      captureError(err, "browse-load-more");
    } finally {
      setLoadingMore(false);
      loadingMoreRef.current = false;
    }
  }, [vertical, category, search, sort, filters, artistCursor, vendorCursor, loading]);

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
    load(vertical, category, search, sort, filters);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vertical, category, sort, filters]);

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
      load(vertical, category, search, sort, filters);
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
    // the Artists tab would otherwise silently be sent as a query param the
    // vendors endpoint ignores anyway, but resetting it keeps the filter
    // badge count honest for the tab the user is now looking at.
    if (next === "vendor") setFilters((f) => ({ ...f, gender: "Any" }));
  }

  const loadedCount = vertical === "artist" ? artists.length : vendors.length;
  const hasMore = (vertical === "artist" ? artistCursor : vendorCursor) !== null;
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
              load(vertical, category, search, sort, filters);
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
                    load(vertical, category, item, sort, filters);
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
          <Text style={styles.resultCount}>{loadedCount} loaded</Text>
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
            refreshControl={<RefreshControl refreshing={false} onRefresh={() => load(vertical, category, search, sort, filters)} tintColor={colors.pink} />}
          >
            <Text style={styles.muted}>{error}</Text>
            <Pressable style={styles.retryButton} onPress={() => load(vertical, category, search, sort, filters)}>
              <Text style={styles.retryButtonText}>Try again</Text>
            </Pressable>
          </ScrollView>
        ) : vertical === "artist" ? (
          <FlatList
            data={artists}
            keyExtractor={(item) => item.id}
            numColumns={2}
            columnWrapperStyle={styles.gridRow}
            contentContainerStyle={styles.grid}
            ListEmptyComponent={<EmptyState label="artists" />}
            onEndReached={loadMore}
            onEndReachedThreshold={0.5}
            ListFooterComponent={hasMore ? <LoadMoreFooter loading={loadingMore} /> : null}
            renderItem={({ item }) => (
              <ArtistCard
                artist={item}
                onPress={() => router.push({ pathname: "/artist/[id]", params: { id: item.id } })}
              />
            )}
          />
        ) : (
          <FlatList
            data={vendors}
            keyExtractor={(item) => item.id}
            numColumns={2}
            columnWrapperStyle={styles.gridRow}
            contentContainerStyle={styles.grid}
            ListEmptyComponent={<EmptyState label="vendors" />}
            onEndReached={loadMore}
            onEndReachedThreshold={0.5}
            ListFooterComponent={hasMore ? <LoadMoreFooter loading={loadingMore} /> : null}
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

function LoadMoreFooter({ loading }: { loading: boolean }) {
  return (
    <View style={styles.loadMoreFooter}>
      {loading ? <ActivityIndicator color={colors.pink} /> : null}
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
  loadMoreFooter: { height: 44, alignItems: "center", justifyContent: "center" },
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
