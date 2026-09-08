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
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Location from "expo-location";
import { router, useFocusEffect } from "expo-router";
import { GradientBackground } from "@/components/GradientBackground";
import { SearchBarStatic } from "@/components/SearchBar";
import { HeroCarousel } from "@/components/HeroCarousel";
import { CategoryGrid } from "@/components/CategoryGrid";
import { FeaturedArtistCard, FEATURED_CARD_WIDTH } from "@/components/FeaturedArtistCard";
import { ArtistCard } from "@/components/ArtistCard";
import { SectionHeader } from "@/components/SectionHeader";
import { NotificationBell } from "@/components/NotificationBell";
import { HomeCityControl } from "@/components/HomeCityControl";
import { SeasonalPicksRail } from "@/components/SeasonalPicksRail";
import { RealEventsRail } from "@/components/RealEventsRail";
import { Skeleton } from "@/components/Skeleton";
import { useAuth } from "@/lib/auth-context";
import { fetchArtists, fetchFeatured, fetchSavedArtists, type ArtistSummary } from "@/lib/api";
import { getHomeCity, setHomeCity } from "@/lib/home-city-storage";
import { rankByHomeCity, travelsToYourCity } from "@/lib/home-ranking";
import { setPendingVideoFeed, type VideoFeedItem } from "@/lib/video-feed-handoff";
import { captureError } from "@/lib/telemetry";
import { colors, fonts, gradients, radii, spacing } from "@/theme";

type BrowseVertical = "artist" | "vendor";

// Deterministic PRNG (mulberry32-style LCG) seeded from a plain integer —
// same seed always produces the same shuffle order.
function seededRandom(seed: number) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

// YYYYMMDD hashed to an int — same all day, changes at midnight local time.
function todaySeed(): number {
  const d = new Date();
  const key = d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
  let hash = 0;
  const str = String(key);
  for (let i = 0; i < str.length; i++) hash = (hash * 31 + str.charCodeAt(i)) | 0;
  return Math.abs(hash) || 1;
}

// Sorted by id first so the shuffle is stable even if the API returns the
// same set of artists in a different order across requests — otherwise a
// fixed seed applied to a different starting order still yields a different
// result, defeating the "stops reshuffling on refresh" point of this.
function shuffle<T extends { id: string }>(items: T[]): T[] {
  const sorted = [...items].sort((a, b) => a.id.localeCompare(b.id));
  const rand = seededRandom(todaySeed());
  for (let i = sorted.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [sorted[i], sorted[j]] = [sorted[j], sorted[i]];
  }
  return sorted;
}

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
  const [trending, setTrending] = useState<ArtistSummary[]>([]);
  const [saved, setSaved] = useState<ArtistSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [activeFeaturedIndex, setActiveFeaturedIndex] = useState(0);
  const [homeCity, setHomeCityState] = useState<string | null>(null);
  const [browseVertical, setBrowseVertical] = useState<BrowseVertical>("artist");

  const load = useCallback(async () => {
    setError(false);
    try {
      const [{ artists: results }, { artists: featuredResults }, { artists: trendingResults }] = await Promise.all([
        fetchArtists({}),
        fetchFeatured(),
        fetchArtists({ sort: "trending" }),
      ]);
      setArtists(results);
      setFeatured(featuredResults);
      // No one has racked up real bookings yet, so a "trending" sort is flat —
      // shuffle instead of showing the same static order every time. Seeded
      // by the date so it holds steady across pull-to-refresh and only
      // rotates once a day. Swap this for the real sort once booking volume
      // makes it meaningful.
      setTrending(shuffle(trendingResults).slice(0, 10));
    } catch {
      setError(true);
    }
  }, []);

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
      setSaved(results);
    } catch (err) {
      captureError(err, "home-saved-artists-fetch");
    }
  }, [user]);

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [load]);

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
    await Promise.all([load(), loadSaved()]);
    setRefreshing(false);
  }

  const rankedArtists = useMemo(() => rankByHomeCity(artists, homeCity), [artists, homeCity]);
  const popular = useMemo(() => rankedArtists.slice(0, 12), [rankedArtists]);

  const [activeTrendingIndex, setActiveTrendingIndex] = useState(0);

  const featuredViewability = useRef({ itemVisiblePercentThreshold: 65 }).current;
  const onFeaturedViewableChanged = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    if (viewableItems[0]?.index != null) setActiveFeaturedIndex(viewableItems[0].index);
  }).current;
  const trendingViewability = useRef({ itemVisiblePercentThreshold: 65 }).current;
  const onTrendingViewableChanged = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    if (viewableItems[0]?.index != null) setActiveTrendingIndex(viewableItems[0].index);
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
  const trendingSectionLayout = useRef({ y: 0, height: 0 });
  const [featuredSectionVisible, setFeaturedSectionVisible] = useState(true);
  const [trendingSectionVisible, setTrendingSectionVisible] = useState(true);

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
    setTrendingSectionVisible((prev) => {
      const next = isVisible(trendingSectionLayout.current);
      return prev === next ? prev : next;
    });
  }, [viewportHeight]);

  const firstName = user?.name?.split(" ")[0];

  return (
    <GradientBackground>
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.pink} />}
          onScroll={handleScroll}
          scrollEventThrottle={100}
        >
          <View style={styles.header}>
            <View style={styles.headerRow}>
              <Text style={styles.eyebrow}>GIGGIFI</Text>
              <NotificationBell />
            </View>
            <Text style={styles.title}>{firstName ? `Hey ${firstName},` : "Hey there,"}{"\n"}who&apos;s the act tonight?</Text>
          </View>

          <View style={styles.cityEventRow}>
            <HomeCityControl city={homeCity} onChange={handleCityChange} />
            <Pressable style={styles.eventHubCard} onPress={() => router.push("/my-event")}>
              <View style={styles.eventHubIcon}>
                <Feather name="calendar" size={14} color={colors.purple} />
              </View>
              <View style={styles.eventHubTextWrap}>
                <Text style={styles.eventHubTitle} numberOfLines={1}>My Event Hub</Text>
                <Text style={styles.eventHubSub} numberOfLines={1}>Countdown, budget & checklist</Text>
              </View>
            </Pressable>
          </View>

          <View style={styles.searchWrap}>
            <SearchBarStatic label="Search artists, DJs, bands…" onPress={() => router.push("/(tabs)/browse")} />
          </View>

          <View style={styles.section}>
            <SectionHeader
              title={browseVertical === "artist" ? "Artists" : "Vendors"}
              sub={browseVertical === "artist" ? "Performers for your event" : "Everything else for the day"}
              onSeeAll={() => router.push({ pathname: "/(tabs)/browse", params: { vertical: browseVertical } })}
            />
            <View style={styles.verticalToggle}>
              <Pressable
                style={[styles.verticalToggleTab, browseVertical === "artist" && styles.verticalToggleTabActive]}
                onPress={() => setBrowseVertical("artist")}
              >
                <Text style={[styles.verticalToggleText, browseVertical === "artist" && styles.verticalToggleTextActive]}>Artists</Text>
              </Pressable>
              <Pressable
                style={[styles.verticalToggleTab, browseVertical === "vendor" && styles.verticalToggleTabActive]}
                onPress={() => setBrowseVertical("vendor")}
              >
                <Text style={[styles.verticalToggleText, browseVertical === "vendor" && styles.verticalToggleTextActive]}>Vendors</Text>
              </Pressable>
            </View>
            <CategoryGrid vertical={browseVertical} />
          </View>

          {/* Not called out in the new Home spec either way — kept rather
              than silently dropped, same relative spot as before (right
              after category browsing). Flagged back for an explicit call. */}
          {saved.length > 0 ? (
            <View style={styles.section}>
              <SectionHeader title="Saved for you" />
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

          <View style={styles.section}>
            <HeroCarousel />
          </View>

          {/* Compact reel-discovery strip — replaces both the old
              "N events booked this week" social-proof strip and the old
              full-size "Scroll the reel, find your act" gradient promo
              (same destination, same intent; keeping both would have been
              a duplicate "go watch Reels" prompt on one screen). Position
              per the corrected Home order: directly above the offer cards. */}
          <Pressable style={styles.reelsStrip} onPress={() => router.push("/(tabs)/reels")}>
            <View style={styles.reelsStripPlay}>
              <Feather name="play" size={14} color="#fff" />
            </View>
            <View style={styles.reelsStripBody}>
              <Text style={styles.reelsStripTitle}>Discover through Giggifi Reels</Text>
              <Text style={styles.reelsStripSub}>Swipe through artist videos and shortlist your favs</Text>
            </View>
            <Feather name="chevron-right" size={18} color={colors.textMute} />
          </Pressable>

          {/* Position per the corrected Home order: directly below the
              offer cards. */}
          <SeasonalPicksRail />

          {/* Business flow entry point — same destination as the bottom nav
              "Business" tab (see (tabs)/business.tsx and (tabs)/_layout.tsx),
              which itself decides form-vs-deals. Static, no dependency on
              artists/featured/trending, so it no longer needs to sit behind
              the loading/error branch below. */}
          <Pressable style={styles.businessPromo} onPress={() => router.push("/(tabs)/business")}>
            <LinearGradient colors={[colors.purple, colors.orange]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.businessPromoGradient}>
              <View style={styles.businessPromoBadge}>
                <Feather name="briefcase" size={11} color="#fff" />
                <Text style={styles.businessPromoBadgeText}>FOR BUSINESSES</Text>
              </View>
              <Text style={styles.businessPromoTitle}>Curated for Restaurants{"\n"}& Event Companies</Text>
              <Text style={styles.businessPromoSub}>Recurring bookings, business deals & invoicing.</Text>
              <View style={styles.businessPromoCta}>
                <Text style={styles.businessPromoCtaText}>See business deals</Text>
                <Feather name="arrow-right" size={16} color={colors.purple} />
              </View>
            </LinearGradient>
          </Pressable>

          {loading ? (
            <>
              <View style={styles.section}>
                <SectionHeader title="Fresh picks for you" sub="Handpicked for you — watch before you book" />
                <View style={[styles.featuredRow, styles.skeletonRow]}>
                  <Skeleton width={FEATURED_CARD_WIDTH} height={FEATURED_CARD_WIDTH * (16 / 9)} borderRadius={radii.xl} />
                  <Skeleton width={FEATURED_CARD_WIDTH} height={FEATURED_CARD_WIDTH * (16 / 9)} borderRadius={radii.xl} />
                </View>
              </View>
              <View style={styles.section}>
                <SectionHeader title="Featured Artists" sub="Watch before you book" />
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
              {/* Fresh picks (trending) directly above Featured Artists —
                  intended Home order, per Sachin's explicit item #6/#5
                  request. Both rails already open the same swipeable
                  video-feed screen via openVideoFeed (see its own
                  comment) — no separate video player exists to reuse
                  here, this section was already wired correctly. */}
              {trending.length > 0 ? (
                <View
                  style={styles.section}
                  onLayout={(e) => {
                    trendingSectionLayout.current = { y: e.nativeEvent.layout.y, height: e.nativeEvent.layout.height };
                  }}
                >
                  <SectionHeader
                    title="Fresh picks for you"
                    sub="Handpicked for you — watch before you book"
                    onSeeAll={() => router.push({ pathname: "/(tabs)/browse" })}
                  />
                  <FlatList
                    data={trending}
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    keyExtractor={(item) => item.id}
                    contentContainerStyle={styles.featuredRow}
                    snapToInterval={FEATURED_CARD_WIDTH + spacing.sm}
                    decelerationRate="fast"
                    viewabilityConfig={trendingViewability}
                    onViewableItemsChanged={onTrendingViewableChanged}
                    initialNumToRender={2}
                    maxToRenderPerBatch={2}
                    windowSize={3}
                    removeClippedSubviews
                    renderItem={({ item, index }) => (
                      <FeaturedArtistCard
                        artist={item}
                        isActive={index === activeTrendingIndex && trendingSectionVisible && focused}
                        onOpenVideo={() => openVideoFeed(trending, item)}
                        onViewProfile={() => router.push({ pathname: "/artist/[id]", params: { id: item.id } })}
                      />
                    )}
                  />
                </View>
              ) : null}

              {featured.length > 0 ? (
                <View
                  style={styles.section}
                  onLayout={(e) => {
                    featuredSectionLayout.current = { y: e.nativeEvent.layout.y, height: e.nativeEvent.layout.height };
                  }}
                >
                  <SectionHeader title="Featured Artists" sub="Watch before you book" />
                  <FlatList
                    data={featured}
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    keyExtractor={(item) => item.id}
                    contentContainerStyle={styles.featuredRow}
                    snapToInterval={FEATURED_CARD_WIDTH + spacing.sm}
                    decelerationRate="fast"
                    viewabilityConfig={featuredViewability}
                    onViewableItemsChanged={onFeaturedViewableChanged}
                    initialNumToRender={2}
                    maxToRenderPerBatch={2}
                    windowSize={3}
                    removeClippedSubviews
                    renderItem={({ item, index }) => (
                      <FeaturedArtistCard
                        artist={item}
                        isActive={index === activeFeaturedIndex && featuredSectionVisible && focused}
                        onOpenVideo={() => openVideoFeed(featured, item)}
                        onViewProfile={() => router.push({ pathname: "/artist/[id]", params: { id: item.id } })}
                      />
                    )}
                  />
                </View>
              ) : null}

              {/* Also not called out in the new spec — kept rather than
                  silently dropped, same relative spot as before (right
                  after Featured Artists). Flagged back for an explicit
                  call. */}
              <View style={styles.section}>
                <SectionHeader title="Popular right now" onSeeAll={() => router.push("/(tabs)/browse")} />
                {popular.length === 0 ? (
                  <View style={styles.railEmpty}>
                    <Feather name="music" size={22} color={colors.textMute} />
                    <Text style={styles.muted}>No artists live yet — check back soon.</Text>
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
  header: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, marginBottom: spacing.md },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.sm,
  },
  eyebrow: {
    fontFamily: fonts.mono,
    fontSize: 11,
    color: colors.orange,
    letterSpacing: 2,
  },
  title: {
    fontFamily: fonts.display,
    fontSize: 28,
    lineHeight: 32,
    color: colors.text,
  },
  cityEventRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  searchWrap: { paddingHorizontal: spacing.lg, marginBottom: spacing.lg },
  section: { marginBottom: spacing.xl },
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
  verticalToggleTab: { flex: 1, paddingVertical: 9, borderRadius: radii.pill, alignItems: "center" },
  verticalToggleTabActive: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.lineStrong },
  verticalToggleText: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.textMute },
  verticalToggleTextActive: { color: colors.text, fontFamily: fonts.bodySemiBold },
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
  eventHubCard: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    borderRadius: radii.lg,
    backgroundColor: "rgba(255,255,255,0.035)",
    borderWidth: 1,
    borderColor: colors.line,
  },
  eventHubIcon: {
    width: 30,
    height: 30,
    borderRadius: 9,
    backgroundColor: "rgba(168,85,247,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  eventHubTextWrap: { flex: 1 },
  eventHubTitle: { fontFamily: fonts.bodySemiBold, fontSize: 12.5, color: colors.text },
  eventHubSub: { fontFamily: fonts.body, fontSize: 10, color: colors.textMute, marginTop: 1 },
  businessPromo: { marginHorizontal: spacing.lg, marginBottom: spacing.xl, borderRadius: radii.xl, overflow: "hidden" },
  businessPromoGradient: { padding: spacing.lg, gap: spacing.sm },
  businessPromoBadge: {
    flexDirection: "row", alignItems: "center", gap: 5, alignSelf: "flex-start",
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: radii.pill, backgroundColor: "rgba(255,255,255,0.18)",
  },
  businessPromoBadgeText: { fontFamily: fonts.mono, fontSize: 10, color: "#fff", letterSpacing: 1 },
  businessPromoTitle: { fontFamily: fonts.display, fontSize: 21, lineHeight: 25, color: "#fff", marginTop: 2 },
  businessPromoSub: { fontFamily: fonts.body, fontSize: 12.5, lineHeight: 17, color: "rgba(255,255,255,0.88)" },
  businessPromoCta: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginTop: spacing.xs,
    backgroundColor: "#fff", borderRadius: radii.pill, paddingVertical: 12,
  },
  businessPromoCtaText: { fontFamily: fonts.bodySemiBold, fontSize: 13.5, color: colors.purple },
  reelsStrip: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.xl,
    padding: spacing.md,
    borderRadius: radii.lg,
    backgroundColor: "rgba(255,255,255,0.035)",
    borderWidth: 1,
    borderColor: colors.line,
  },
  reelsStripPlay: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.magenta,
    alignItems: "center",
    justifyContent: "center",
  },
  reelsStripBody: { flex: 1, gap: 2 },
  reelsStripTitle: { fontFamily: fonts.bodySemiBold, fontSize: 13.5, color: colors.text },
  reelsStripSub: { fontFamily: fonts.body, fontSize: 11, color: colors.textMute },
});
