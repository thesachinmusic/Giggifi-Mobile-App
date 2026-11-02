import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Dimensions,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type ViewToken,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather, Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { Image } from "expo-image";
import * as Location from "expo-location";
import { router, useFocusEffect } from "expo-router";
import { GradientBackground } from "@/components/GradientBackground";
import { SearchBarStatic } from "@/components/SearchBar";
import { HeroCarousel } from "@/components/HeroCarousel";
import { HomeQuickTiles } from "@/components/HomeQuickTiles";
import { CategoryGrid } from "@/components/CategoryGrid";
import { FeaturedArtistCard, FEATURED_CARD_WIDTH } from "@/components/FeaturedArtistCard";
import { FeaturedPremiumCard, FEATURED_PREMIUM_CARD_WIDTH } from "@/components/FeaturedPremiumCard";
import { ArtistCard } from "@/components/ArtistCard";
import { SectionHeader } from "@/components/SectionHeader";
import { NotificationBell } from "@/components/NotificationBell";
import { HomeCityControl } from "@/components/HomeCityControl";
import { SeasonalPicksRail } from "@/components/SeasonalPicksRail";
import { RealEventsRail } from "@/components/RealEventsRail";
import { AnnouncementBanner } from "@/components/AnnouncementBanner";
import { ProfileCompletionBadge } from "@/components/ProfileCompletionBadge";
import { Skeleton } from "@/components/Skeleton";
import { SoundwaveDivider } from "@/components/SoundwaveDivider";
import { useAuth } from "@/lib/auth-context";
import { HomePushPrimer } from "@/components/HomePushPrimer";
import { fetchArtists, fetchFeatured, fetchSavedArtists, type ArtistSummary } from "@/lib/api";
import { getHomeCity, setHomeCity } from "@/lib/home-city-storage";
import { travelsToYourCity } from "@/lib/home-ranking";
import { featuredRail, freshRail, popularRail } from "@/lib/home-rails";
import { setPendingVideoFeed, type VideoFeedItem } from "@/lib/video-feed-handoff";
import { captureError } from "@/lib/telemetry";
import { colors, fonts, mock, mockGradients, radii, spacing } from "@/theme";

type BrowseVertical = "artist" | "vendor";

// Video-feed.tsx only ever swipes through items that actually have a video —
// filtering here (rather than in the viewer) also means the starting index
// has to be recomputed against the filtered list, not the rail's own index.
function toVideoFeedItems(list: ArtistSummary[]): VideoFeedItem[] {
  return list
    .filter((a) => a.introVideoUrl || a.showreelUrl)
    .map((a) => ({
      id: a.id,
      stageName: a.stageName,
      performerType: a.performerType,
      city: a.city,
      videoUrl: (a.introVideoUrl || a.showreelUrl)!,
      profileImageUrl: a.profileImageUrl,
      avgRating: a.avgRating,
    }));
}

function openVideoFeed(list: ArtistSummary[], artist: ArtistSummary) {
  const items = toVideoFeedItems(list);
  const startIndex = items.findIndex((i) => i.id === artist.id);
  setPendingVideoFeed(items, startIndex === -1 ? 0 : startIndex);
  router.push("/video-feed");
}

export default function HomeScreen() {
  const { user } = useAuth();
  const [artists, setArtists] = useState<ArtistSummary[]>([]);
  const [featured, setFeatured] = useState<ArtistSummary[]>([]);
  // Unpaid daily-rotating artists that fill the Featured rail's empty slots.
  const [featuredFill, setFeaturedFill] = useState<ArtistSummary[]>([]);
  // Most-booked artists (the server's booking-count sort) for "Popular right now".
  const [popularArtists, setPopularArtists] = useState<ArtistSummary[]>([]);
  const [saved, setSaved] = useState<ArtistSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [activeFeaturedIndex, setActiveFeaturedIndex] = useState(0);
  const [homeCity, setHomeCityState] = useState<string | null>(null);
  const [browseVertical, setBrowseVertical] = useState<BrowseVertical>("artist");

  // Newest artists first (the default sort) feed "Fresh picks"; the booking-count
  // sort feeds "Popular right now".
  const load = useCallback(async () => {
    setError(false);
    try {
      const [{ artists: results }, { artists: popularResults }] = await Promise.all([
        fetchArtists({}),
        fetchArtists({ sort: "trending" }),
      ]);
      setArtists(results);
      setPopularArtists(popularResults);
    } catch {
      setError(true);
    }
  }, []);

  // Featured is its own fetch so a newly known Home city can re-request just
  // this rail. `artists` is the paid list; `fill` the unpaid daily rotation.
  const loadFeatured = useCallback(
    () =>
      fetchFeatured(homeCity ? { city: homeCity } : {})
        .then(({ artists: featuredResults, fill: fillResults }) => {
          setFeatured(featuredResults);
          // `?? []` keeps an older backend (no `fill` key) working. Which artists
          // get the Promoted pill is decided in featuredRail().
          setFeaturedFill(fillResults ?? []);
        })
        .catch(() => setError(true)),
    [homeCity],
  );

  // Independent of the paginated `artists` fetch above — filtering that
  // array (the old approach) only ever showed a saved artist who happened to
  // be in this page's first batch, so anyone saved from Reels or a deeper
  // Browse page silently vanished from this rail.
  const loadSaved = useCallback(async () => {
    if (!user) {
      setSaved([]);
      return;
    }
    try {
      const { artists: results } = await fetchSavedArtists();
      setSaved(results ?? []);
    } catch (err) {
      captureError(err, "home-saved-artists-fetch");
    }
  }, [user]);

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [load]);

  useEffect(() => {
    void loadFeatured();
  }, [loadFeatured]);

  useEffect(() => {
    loadSaved();
  }, [loadSaved]);

  // Persisted city takes priority; otherwise detect silently only if
  // location permission was already granted elsewhere (Quick Moments) — no
  // surprise permission prompt on first Home load. The picker's own "use my
  // location" button (tap-triggered) can always prompt directly.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const stored = await getHomeCity();
      if (stored) {
        if (!cancelled) setHomeCityState(stored);
        return;
      }
      const { status } = await Location.getForegroundPermissionsAsync();
      if (status !== "granted") return;
      try {
        const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Low });
        const [address] = await Location.reverseGeocodeAsync({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
        const geoCity = address?.city ?? address?.subregion ?? null;
        if (geoCity && !cancelled) {
          setHomeCityState(geoCity);
          setHomeCity(geoCity).catch((err) => captureError(err, "home-city-persist"));
        }
      } catch {
        // Silent — city control just stays unset, user can pick manually.
      }
    })();
    return () => { cancelled = true; };
  }, []);

  function handleCityChange(city: string) {
    setHomeCityState(city);
    setHomeCity(city).catch((err) => captureError(err, "home-city-persist"));
  }

  async function onRefresh() {
    setRefreshing(true);
    await Promise.all([load(), loadFeatured(), loadSaved()]);
    setRefreshing(false);
  }

  // "Popular right now": most booked first. "Fresh picks": newest first, without
  // anyone already shown under Popular, so the two rails never repeat an artist.
  const popular = useMemo(() => popularRail(popularArtists), [popularArtists]);
  const fresh = useMemo(() => freshRail(artists, popular), [artists, popular]);
  // Paid artists first, then the daily fill.
  // (An artist is never in both lists server-side; the filter just guarantees
  // unique FlatList keys if a response ever repeats one.)
  const featuredList = useMemo(() => featuredRail(featured, featuredFill), [featured, featuredFill]);

  const [activeFreshIndex, setActiveFreshIndex] = useState(0);

  const featuredViewability = useRef({ itemVisiblePercentThreshold: 65 }).current;
  const onFeaturedViewableChanged = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    if (viewableItems[0]?.index != null) setActiveFeaturedIndex(viewableItems[0].index);
  }).current;
  const freshViewability = useRef({ itemVisiblePercentThreshold: 65 }).current;
  const onFreshViewableChanged = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    if (viewableItems[0]?.index != null) setActiveFreshIndex(viewableItems[0].index);
  }).current;

  // The rails' own horizontal viewability (above) only tracks which CARD is
  // centered within the rail — it says nothing about whether the rail
  // itself is still on screen once the page is scrolled vertically. Without
  // this, a video left "active" by the horizontal tracker keeps playing
  // (with sound) even after the whole section has scrolled off top or
  // bottom. Track each rail's on-screen bounds via onLayout and compare
  // against vertical scroll position on every scroll event; only flip
  // state when visibility actually changes so this doesn't force a re-render
  // on every scroll frame.
  const viewportHeight = Dimensions.get("window").height;
  const featuredSectionLayout = useRef({ y: 0, height: 0 });
  const freshSectionLayout = useRef({ y: 0, height: 0 });
  const [featuredSectionVisible, setFeaturedSectionVisible] = useState(true);
  const [freshSectionVisible, setFreshSectionVisible] = useState(true);

  // Scroll-based visibility above only reacts to scrolling *within* this
  // screen — it never goes false just because Home itself lost focus (e.g.
  // navigating to an artist profile via "View profile"), so a card's video
  // kept playing with sound in the background the whole time. Same
  // useFocusEffect(setFocused) pattern already used by reels.tsx and
  // video-feed.tsx; ANDed into isActive below exactly like those screens AND
  // their own scroll/viewability visibility.
  const [focused, setFocused] = useState(true);
  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      return () => setFocused(false);
    }, []),
  );

  const handleScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const offsetY = e.nativeEvent.contentOffset.y;
    const isVisible = (layout: { y: number; height: number }) =>
      layout.height > 0 && offsetY < layout.y + layout.height && offsetY + viewportHeight > layout.y;
    setFeaturedSectionVisible((prev) => {
      const next = isVisible(featuredSectionLayout.current);
      return prev === next ? prev : next;
    });
    setFreshSectionVisible((prev) => {
      const next = isVisible(freshSectionLayout.current);
      return prev === next ? prev : next;
    });
  }, [viewportHeight]);

  return (
    <GradientBackground variant="giggifi">
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.pink} />}
          onScroll={handleScroll}
          scrollEventThrottle={100}
        >
          <View style={styles.header}>
            <View style={styles.brandCol}>
              <Image source={require("@/assets/images/giggifi-logo-cropped.png")} style={styles.logo} contentFit="contain" accessibilityLabel="GiggiFi" />
              <Text style={styles.tagline}>Where real talent meets real opportunities.</Text>
            </View>
            <View style={styles.headerActions}>
              <HomeCityControl city={homeCity} onChange={handleCityChange} />
              <NotificationBell />
            </View>
          </View>

          <AnnouncementBanner />
          <ProfileCompletionBadge />

          <View style={styles.carouselWrap}>
            <HeroCarousel vertical={browseVertical} />
          </View>

          <View style={styles.searchWrap}>
            <SearchBarStatic
              label={browseVertical === "artist" ? "Search artists, DJs, bands…" : "Search photographers, decorators, caterers…"}
              onPress={() =>
                router.push(browseVertical === "vendor" ? { pathname: "/(tabs)/browse", params: { vertical: "vendor" } } : "/(tabs)/browse")
              }
            />
          </View>

          <HomeQuickTiles />

          <View style={styles.verticalToggle}>
            <Pressable
              style={styles.verticalToggleTab}
              onPress={() => setBrowseVertical("artist")}
              accessibilityRole="button"
              accessibilityState={{ selected: browseVertical === "artist" }}
            >
              {browseVertical === "artist" ? (
                <LinearGradient colors={mockGradients.cta} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
              ) : null}
              <Feather name="mic" size={17} color={browseVertical === "artist" ? "#fff" : mock.textSoft} />
              <Text style={[styles.verticalToggleText, browseVertical === "artist" && styles.verticalToggleTextActive]}>Artists</Text>
            </Pressable>
            <Pressable
              style={styles.verticalToggleTab}
              onPress={() => setBrowseVertical("vendor")}
              accessibilityRole="button"
              accessibilityState={{ selected: browseVertical === "vendor" }}
            >
              {browseVertical === "vendor" ? (
                <LinearGradient colors={mockGradients.cta} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
              ) : null}
              <Feather name="shopping-bag" size={17} color={browseVertical === "vendor" ? "#fff" : mock.textSoft} />
              <Text style={[styles.verticalToggleText, browseVertical === "vendor" && styles.verticalToggleTextActive]}>Vendors</Text>
            </Pressable>
          </View>

          <View style={styles.section}>
            <View style={styles.discoverHeader}>
              <View style={styles.discoverTitleRow}>
                <Ionicons name="sparkles-outline" size={20} color={mock.amber} />
                <Text style={styles.discoverTitle}>{browseVertical === "artist" ? "Discover Artists" : "Discover Vendors"}</Text>
              </View>
              <Pressable onPress={() => router.push({ pathname: "/(tabs)/browse", params: { vertical: browseVertical } })} hitSlop={8}>
                <Text style={styles.viewAll}>View All ›</Text>
              </Pressable>
            </View>
            <CategoryGrid vertical={browseVertical} />
          </View>

          {loading ? (
            <View style={styles.section}>
              <SectionHeader icon="star" title="Featured artists" sub="Watch before you book" />
              <View style={[styles.artistRow, styles.skeletonRow]}>
                {[0, 1, 2].map((i) => (
                  <View key={i} style={styles.skeletonCard}>
                    <Skeleton height={168 * (4 / 3)} borderRadius={radii.xl} />
                    <Skeleton height={14} width="70%" style={styles.skeletonLine} />
                    <Skeleton height={11} width="40%" style={styles.skeletonLineSm} />
                  </View>
                ))}
              </View>
            </View>
          ) : null}

          {!loading && !error && featuredList.length > 0 ? (
            <View
              style={styles.section}
              onLayout={(e) => {
                featuredSectionLayout.current = { y: e.nativeEvent.layout.y, height: e.nativeEvent.layout.height };
              }}
            >
              <View style={styles.featuredBox}>
                <View style={styles.featuredBoxHeader}>
                  <View style={styles.featuredBoxTitleRow}>
                    <MaterialCommunityIcons name="crown-outline" size={26} color={mock.amber} />
                    <View>
                      <Text style={styles.featuredBoxTitle}>Featured artists</Text>
                    </View>
                  </View>
                  <Pressable onPress={() => router.push("/(tabs)/browse")} hitSlop={8}>
                    <Text style={styles.featuredBoxViewAll}>View All ›</Text>
                  </Pressable>
                </View>
                <FlatList
                  data={featuredList}
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  keyExtractor={(item) => item.id}
                  contentContainerStyle={styles.featuredBoxRow}
                  snapToInterval={FEATURED_PREMIUM_CARD_WIDTH + 10}
                  decelerationRate="fast"
                  viewabilityConfig={featuredViewability}
                  onViewableItemsChanged={onFeaturedViewableChanged}
                  initialNumToRender={2}
                  maxToRenderPerBatch={2}
                  windowSize={3}
                  removeClippedSubviews
                  renderItem={({ item, index }) => (
                    <FeaturedPremiumCard
                      artist={item}
                      isActive={index === activeFeaturedIndex && featuredSectionVisible && focused}
                      onOpenVideo={() => openVideoFeed(featuredList, item)}
                      onViewProfile={() => router.push({ pathname: "/artist/[id]", params: { id: item.id } })}
                    />
                  )}
                />
              </View>
            </View>
          ) : null}

          {/* Redesign order: Discover, Featured, Seasonal, Fresh picks, Popular. */}
          <SeasonalPicksRail />

          <SoundwaveDivider />

          {loading ? (
            <>
              <View style={styles.section}>
                <SectionHeader icon="zap" title="Fresh picks" sub="New on GiggiFi — watch before you book" />
                <View style={[styles.featuredRow, styles.skeletonRow]}>
                  <Skeleton width={FEATURED_CARD_WIDTH} height={FEATURED_CARD_WIDTH * (16 / 9)} borderRadius={radii.xl} />
                  <Skeleton width={FEATURED_CARD_WIDTH} height={FEATURED_CARD_WIDTH * (16 / 9)} borderRadius={radii.xl} />
                </View>
              </View>
            </>
          ) : error ? (
            <View style={styles.section}>
              <Text style={styles.muted}>Couldn&apos;t load artists — check your connection.</Text>
              <Pressable
                style={styles.retryButton}
                onPress={() => { setLoading(true); load().finally(() => setLoading(false)); }}
              >
                <Text style={styles.retryButtonText}>Try again</Text>
              </Pressable>
            </View>
          ) : (
            <>
              {/* Fresh picks (trending), below Featured Artists and Seasonal
                  Picks per the redesign order. Both video rails open the same
                  swipeable video-feed screen via openVideoFeed (see its own
                  comment). */}
              {fresh.length > 0 ? (
                <View
                  style={styles.section}
                  onLayout={(e) => {
                    freshSectionLayout.current = { y: e.nativeEvent.layout.y, height: e.nativeEvent.layout.height };
                  }}
                >
                  <SectionHeader
                    icon="zap"
                    title="Fresh picks"
                    sub="New on GiggiFi — watch before you book"
                    onSeeAll={() => router.push({ pathname: "/(tabs)/browse" })}
                  />
                  <FlatList
                    data={fresh}
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    keyExtractor={(item) => item.id}
                    contentContainerStyle={styles.featuredRow}
                    snapToInterval={FEATURED_CARD_WIDTH + spacing.sm}
                    decelerationRate="fast"
                    viewabilityConfig={freshViewability}
                    onViewableItemsChanged={onFreshViewableChanged}
                    initialNumToRender={2}
                    maxToRenderPerBatch={2}
                    windowSize={3}
                    removeClippedSubviews
                    renderItem={({ item, index }) => (
                      <FeaturedArtistCard
                        artist={item}
                        isActive={index === activeFreshIndex && freshSectionVisible && focused}
                        onOpenVideo={() => openVideoFeed(fresh, item)}
                        onViewProfile={() => router.push({ pathname: "/artist/[id]", params: { id: item.id } })}
                      />
                    )}
                  />
                </View>
              ) : null}

              {/* Not part of the redesign mock — untouched, directly below
                  Fresh picks. */}
              <View style={styles.section}>
                <SectionHeader icon="trending-up" title="Popular right now" onSeeAll={() => router.push("/(tabs)/browse")} />
                {popular.length === 0 ? (
                  <View style={styles.railEmpty}>
                    <Feather name="music" size={22} color={colors.textMute} />
                    <Text style={styles.muted}>The stage is quiet for now — check back soon.</Text>
                  </View>
                ) : (
                  <FlatList
                    data={popular}
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    keyExtractor={(item) => item.id}
                    contentContainerStyle={styles.artistRow}
                    renderItem={({ item }) => (
                      <ArtistCard
                        artist={item}
                        width={168}
                        travelBadge={travelsToYourCity(item, homeCity)}
                        onPress={() => router.push({ pathname: "/artist/[id]", params: { id: item.id } })}
                      />
                    )}
                  />
                )}
              </View>
            </>
          )}

          {/* Not part of the redesign mock — kept, now below Popular right
              now (with From real events and the trust strip). */}
          {saved.length > 0 ? (
            <View style={styles.section}>
              <SectionHeader icon="heart" title="Saved for you" />
              <FlatList
                data={saved}
                horizontal
                showsHorizontalScrollIndicator={false}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.artistRow}
                renderItem={({ item }) => (
                  <ArtistCard artist={item} width={168} onPress={() => router.push({ pathname: "/artist/[id]", params: { id: item.id } })} />
                )}
              />
            </View>
          ) : null}

          <RealEventsRail />

          {/* Trust strip — back to the very bottom of Home, right before the
              tab bar, per the corrected order (it lived here before the
              earlier rebuild moved it up; that placement is reverted). */}
          <View style={styles.trustRow}>
            <TrustCard doodle="✅" label="Verified artists" caption="ID + KYC checked" />
            <TrustCard doodle="🔒" label="Secure payments" caption="Held till event's done" />
            <TrustCard doodle="⚡" label="Fast responses" caption="Quotes within hours" />
          </View>
        </ScrollView>
      </SafeAreaView>
      <HomePushPrimer />
    </GradientBackground>
  );
}

function TrustCard({ doodle, label, caption }: { doodle: string; label: string; caption: string }) {
  return (
    <View style={styles.trustCard}>
      <Text style={styles.trustDoodle}>{doodle}</Text>
      <Text style={styles.trustLabel}>{label}</Text>
      <Text style={styles.trustCaption}>{caption}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  scroll: { paddingBottom: spacing.xxl },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    marginBottom: spacing.md,
  },
  brandCol: { flex: 1, gap: 4 },
  logo: { width: 104, height: 43 },
  tagline: { fontFamily: fonts.body, fontSize: 10, letterSpacing: 0.8, lineHeight: 13, color: "#C9C1D8", maxWidth: 170 },
  headerActions: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 2 },
  carouselWrap: { marginBottom: spacing.md },
  pressed: { opacity: 0.85, transform: [{ scale: 0.99 }] },
  searchWrap: { paddingHorizontal: spacing.md, marginBottom: spacing.md },
  section: { marginBottom: spacing.xl },
  verticalToggle: {
    flexDirection: "row",
    height: 46,
    marginHorizontal: spacing.md,
    marginBottom: spacing.lg,
    padding: 4,
    borderRadius: 23,
    backgroundColor: mock.cardFill,
    borderWidth: 1,
    borderColor: "rgba(255,190,120,0.22)",
  },
  verticalToggleTab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    borderRadius: 19,
    overflow: "hidden",
  },
  verticalToggleText: { fontFamily: fonts.bodySemiBold, fontSize: 14, color: mock.textSoft },
  verticalToggleTextActive: { color: "#fff" },
  discoverHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.md,
    marginBottom: 10,
  },
  featuredBox: {
    marginHorizontal: spacing.md,
    paddingVertical: 12,
    paddingLeft: 12,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(255,190,120,0.18)",
    backgroundColor: "rgba(255,255,255,0.025)",
    gap: 10,
    overflow: "hidden",
  },
  featuredBoxHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingRight: 12 },
  featuredBoxTitleRow: { flexDirection: "row", alignItems: "center", gap: 10, flexShrink: 1 },
  featuredBoxTitle: { fontFamily: fonts.displayBold, fontSize: 17, color: colors.text },
  featuredBoxSub: { fontFamily: fonts.body, fontSize: 11, color: mock.textSoft },
  featuredBoxViewAll: { fontFamily: fonts.body, fontSize: 12, color: mock.textSoft },
  featuredBoxRow: { gap: 10, paddingRight: 12 },
  discoverTitleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  discoverTitle: { fontFamily: fonts.displayBold, fontSize: 19, color: colors.text },
  viewAll: { fontFamily: fonts.bodySemiBold, fontSize: 12, color: "#FF8A9C" },
  featuredRow: { paddingHorizontal: spacing.lg, gap: spacing.sm },
  artistRow: { paddingHorizontal: spacing.lg, gap: spacing.sm },
  muted: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.textMute,
    paddingHorizontal: spacing.lg,
  },
  railEmpty: { alignItems: "center", gap: spacing.sm, paddingVertical: spacing.md },
  retryButton: {
    alignSelf: "flex-start",
    marginTop: spacing.sm,
    marginHorizontal: spacing.lg,
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
  skeletonRow: { flexDirection: "row", gap: spacing.sm },
  skeletonCard: { width: 168 },
  skeletonLine: { marginTop: 8 },
  skeletonLineSm: { marginTop: 6 },
  trustRow: {
    flexDirection: "row",
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.xl,
  },
  trustCard: {
    flex: 1,
    alignItems: "center",
    gap: 3,
    paddingVertical: spacing.md,
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
  },
  trustDoodle: {
    fontSize: 28,
    marginBottom: 2,
  },
  trustLabel: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 11.5,
    color: colors.text,
    textAlign: "center",
  },
  trustCaption: {
    fontFamily: fonts.body,
    fontSize: 9.5,
    color: colors.textMute,
    textAlign: "center",
  },
});
