import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View, type ViewToken } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { GradientBackground } from "@/components/GradientBackground";
import { SearchBarStatic } from "@/components/SearchBar";
import { BannerCarousel } from "@/components/BannerCarousel";
import { AnnouncementBanner } from "@/components/AnnouncementBanner";
import { CategoryGrid } from "@/components/CategoryGrid";
import { FeaturedArtistCard, FEATURED_CARD_WIDTH } from "@/components/FeaturedArtistCard";
import { ArtistCard } from "@/components/ArtistCard";
import { SectionHeader } from "@/components/SectionHeader";
import { NotificationBell } from "@/components/NotificationBell";
import { useAuth } from "@/lib/auth-context";
import { useSavedArtists } from "@/lib/saved-artists-context";
import { fetchArtists, fetchFeatured, type ArtistSummary } from "@/lib/api";
import { colors, fonts, gradients, radii, spacing } from "@/theme";

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export default function HomeScreen() {
  const { user } = useAuth();
  const { savedIds } = useSavedArtists();
  const [artists, setArtists] = useState<ArtistSummary[]>([]);
  const [featured, setFeatured] = useState<ArtistSummary[]>([]);
  const [trending, setTrending] = useState<ArtistSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeFeaturedIndex, setActiveFeaturedIndex] = useState(0);

  const load = useCallback(async () => {
    try {
      const [{ artists: results }, { artists: featuredResults }, { artists: trendingResults }] = await Promise.all([
        fetchArtists({}),
        fetchFeatured(),
        fetchArtists({ sort: "trending" }),
      ]);
      setArtists(results);
      setFeatured(featuredResults);
      // No one has racked up real bookings yet, so a "trending" sort is flat —
      // shuffle instead of showing the same static order every time. Swap this
      // for the real sort once booking volume makes it meaningful.
      setTrending(shuffle(trendingResults).slice(0, 10));
    } catch {
      // Home rails fail silently — Browse is the source of truth for errors.
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

  const popular = useMemo(() => artists.slice(0, 12), [artists]);
  const saved = useMemo(() => artists.filter((a) => savedIds.has(a.id)), [artists, savedIds]);

  const [activeTrendingIndex, setActiveTrendingIndex] = useState(0);

  const featuredViewability = useRef({ itemVisiblePercentThreshold: 65 }).current;
  const onFeaturedViewableChanged = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    if (viewableItems[0]?.index != null) setActiveFeaturedIndex(viewableItems[0].index);
  }).current;
  const trendingViewability = useRef({ itemVisiblePercentThreshold: 65 }).current;
  const onTrendingViewableChanged = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    if (viewableItems[0]?.index != null) setActiveTrendingIndex(viewableItems[0].index);
  }).current;

  const firstName = user?.name?.split(" ")[0];

  return (
    <GradientBackground>
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.pink} />}
        >
          <View style={styles.header}>
            <View style={styles.headerRow}>
              <Text style={styles.eyebrow}>GIGGIFI</Text>
              <NotificationBell />
            </View>
            <Text style={styles.title}>{firstName ? `Hey ${firstName},` : "Hey there,"}{"\n"}who's the act tonight?</Text>
          </View>

          <AnnouncementBanner />

          <View style={styles.searchWrap}>
            <SearchBarStatic label="Search artists, DJs, bands…" onPress={() => router.push("/(tabs)/browse")} />
          </View>

          <Pressable style={styles.planPromo} onPress={() => router.push("/plan-my-event")}>
            <LinearGradient colors={gradients.brand} locations={gradients.brandLocations} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.planPromoGradient}>
              <View style={styles.planPromoBadge}>
                <Feather name="compass" size={11} color="#fff" />
                <Text style={styles.planPromoBadgeText}>PLAN MY EVENT</Text>
              </View>
              <Text style={styles.planPromoTitle}>Get matched to real artists{"\n"}in minutes</Text>
              <Text style={styles.planPromoSub}>Type, budget, duration — see real prices and videos before you commit.</Text>
              <View style={styles.planPromoCta}>
                <Text style={styles.planPromoCtaText}>Start planning</Text>
                <Feather name="arrow-right" size={16} color={colors.purple} />
              </View>
            </LinearGradient>
          </Pressable>

          <View style={styles.section}>
            <BannerCarousel />
          </View>

          <Pressable style={styles.qmPromo} onPress={() => router.push("/quick-moments")}>
            <LinearGradient colors={[colors.orange, colors.magenta, colors.purple]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.qmPromoGradient}>
              <View style={styles.qmPromoTopRow}>
                <View style={styles.qmPromoBadge}>
                  <Feather name="zap" size={11} color="#fff" />
                  <Text style={styles.qmPromoBadgeText}>GIGGIFI 20-20</Text>
                </View>
                <View style={styles.qmPromoTimer}>
                  <Feather name="clock" size={10} color="#fff" />
                  <Text style={styles.qmPromoTimerText}>~15 min</Text>
                </View>
              </View>

              <Text style={styles.qmPromoTitle}>Surprise someone{"\n"}with a live performance</Text>
              <Text style={styles.qmPromoSub}>
                Pick a moment, find a nearby artist, and they show up within hours — no weeks of planning.
              </Text>

              <View style={styles.qmPromoFormats}>
                <View style={styles.qmPromoFormatChip}><Text style={styles.qmPromoFormatEmoji}>🎂</Text><Text style={styles.qmPromoFormatText}>Birthday</Text></View>
                <View style={styles.qmPromoFormatChip}><Text style={styles.qmPromoFormatEmoji}>💐</Text><Text style={styles.qmPromoFormatText}>Anniversary</Text></View>
                <View style={styles.qmPromoFormatChip}><Text style={styles.qmPromoFormatEmoji}>✨</Text><Text style={styles.qmPromoFormatText}>Just Because</Text></View>
              </View>

              <View style={styles.qmPromoCta}>
                <Text style={styles.qmPromoCtaText}>Find an artist near you</Text>
                <Feather name="arrow-right" size={16} color={colors.magenta} />
              </View>
            </LinearGradient>
          </Pressable>

          <View style={styles.section}>
            <SectionHeader title="Artists" sub="Performers for your event" onSeeAll={() => router.push({ pathname: "/(tabs)/browse", params: { vertical: "artist" } })} />
            <CategoryGrid vertical="artist" />
          </View>

          <View style={styles.section}>
            <SectionHeader title="Vendors" sub="Everything else for the day" onSeeAll={() => router.push({ pathname: "/(tabs)/browse", params: { vertical: "vendor" } })} />
            <CategoryGrid vertical="vendor" limit={8} />
          </View>

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

          {loading ? (
            <Text style={styles.muted}>Loading artists…</Text>
          ) : (
            <>
              {featured.length > 0 ? (
                <View style={styles.section}>
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
                        isActive={index === activeFeaturedIndex}
                        onPress={() => router.push({ pathname: "/artist/[id]", params: { id: item.id } })}
                      />
                    )}
                  />
                </View>
              ) : null}

              <View style={styles.section}>
                <SectionHeader title="Popular right now" onSeeAll={() => router.push("/(tabs)/browse")} />
                {popular.length === 0 ? (
                  <Text style={styles.muted}>No artists live yet — check back soon.</Text>
                ) : (
                  <FlatList
                    data={popular}
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    keyExtractor={(item) => item.id}
                    contentContainerStyle={styles.artistRow}
                    renderItem={({ item }) => (
                      <ArtistCard artist={item} width={168} onPress={() => router.push({ pathname: "/artist/[id]", params: { id: item.id } })} />
                    )}
                  />
                )}
              </View>

              <Pressable style={styles.reelsPromo} onPress={() => router.push("/(tabs)/reels")}>
                <LinearGradient colors={[colors.magenta, colors.purple]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.reelsPromoGradient}>
                  <Text style={styles.reelsPromoDoodle}>🎬</Text>
                  <View style={styles.reelsPromoPlay}>
                    <Feather name="play" size={16} color="#fff" />
                  </View>
                  <View style={styles.reelsPromoBody}>
                    <Text style={styles.reelsPromoTitle}>Scroll the reel,{"\n"}find your act</Text>
                    <Text style={styles.reelsPromoSub}>Swipe through artist videos and shortlist your favourites</Text>
                  </View>
                  <Feather name="chevron-right" size={18} color="#fff" />
                </LinearGradient>
              </Pressable>

              {trending.length > 0 ? (
                <View style={styles.section}>
                  <SectionHeader
                    title="Trending now"
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
                        isActive={index === activeTrendingIndex}
                        onPress={() => router.push({ pathname: "/artist/[id]", params: { id: item.id } })}
                      />
                    )}
                  />
                </View>
              ) : null}
            </>
          )}

          <View style={styles.trustRow}>
            <TrustCard doodle="✅" label="Verified artists" caption="ID + KYC checked" />
            <TrustCard doodle="🔒" label="Secure payments" caption="Held till event's done" />
            <TrustCard doodle="⚡" label="Fast responses" caption="Quotes within hours" />
          </View>
        </ScrollView>

        <Pressable style={styles.askFab} onPress={() => router.push("/ask-giggfi")}>
          <Feather name="zap" size={16} color="#fff" />
          <Text style={styles.askFabText}>Ask GiggiFi</Text>
        </Pressable>
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
  searchWrap: { paddingHorizontal: spacing.lg, marginBottom: spacing.lg },
  section: { marginBottom: spacing.xl },
  featuredRow: { paddingHorizontal: spacing.lg, gap: spacing.sm },
  artistRow: { paddingHorizontal: spacing.lg, gap: spacing.sm },
  muted: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.textMute,
    paddingHorizontal: spacing.lg,
  },
  trustRow: {
    flexDirection: "row",
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    marginTop: spacing.sm,
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
  planPromo: { marginHorizontal: spacing.lg, marginBottom: spacing.xl, borderRadius: radii.xl, overflow: "hidden" },
  planPromoGradient: { padding: spacing.lg, gap: spacing.sm },
  planPromoBadge: {
    flexDirection: "row", alignItems: "center", gap: 5, alignSelf: "flex-start",
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: radii.pill, backgroundColor: "rgba(255,255,255,0.18)",
  },
  planPromoBadgeText: { fontFamily: fonts.mono, fontSize: 10, color: "#fff", letterSpacing: 1 },
  planPromoTitle: { fontFamily: fonts.display, fontSize: 21, lineHeight: 25, color: "#fff", marginTop: 2 },
  planPromoSub: { fontFamily: fonts.body, fontSize: 12.5, lineHeight: 17, color: "rgba(255,255,255,0.88)" },
  planPromoCta: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginTop: spacing.xs,
    backgroundColor: "#fff", borderRadius: radii.pill, paddingVertical: 12,
  },
  planPromoCtaText: { fontFamily: fonts.bodySemiBold, fontSize: 13.5, color: colors.purple },
  qmPromo: { marginHorizontal: spacing.lg, marginBottom: spacing.xl, borderRadius: radii.xl, overflow: "hidden" },
  qmPromoGradient: {
    padding: spacing.lg,
    gap: spacing.sm,
  },
  qmPromoTopRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  qmPromoBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radii.pill,
    backgroundColor: "rgba(255,255,255,0.18)",
  },
  qmPromoBadgeText: { fontFamily: fonts.mono, fontSize: 10, color: "#fff", letterSpacing: 1 },
  qmPromoTimer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: radii.pill,
    backgroundColor: "rgba(0,0,0,0.18)",
  },
  qmPromoTimerText: { fontFamily: fonts.bodySemiBold, fontSize: 10.5, color: "#fff" },
  qmPromoTitle: { fontFamily: fonts.display, fontSize: 21, lineHeight: 25, color: "#fff", marginTop: 2 },
  qmPromoSub: { fontFamily: fonts.body, fontSize: 12.5, lineHeight: 17, color: "rgba(255,255,255,0.88)" },
  qmPromoFormats: { flexDirection: "row", gap: spacing.xs, marginTop: 2 },
  qmPromoFormatChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radii.pill,
    backgroundColor: "rgba(255,255,255,0.14)",
  },
  qmPromoFormatEmoji: { fontSize: 13 },
  qmPromoFormatText: { fontFamily: fonts.bodyMedium, fontSize: 11, color: "#fff" },
  qmPromoCta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: spacing.xs,
    backgroundColor: "#fff",
    borderRadius: radii.pill,
    paddingVertical: 12,
  },
  qmPromoCtaText: { fontFamily: fonts.bodySemiBold, fontSize: 13.5, color: colors.magenta },
  reelsPromo: { marginHorizontal: spacing.lg, marginBottom: spacing.xl, borderRadius: radii.xl, overflow: "hidden" },
  reelsPromoGradient: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    position: "relative",
    overflow: "hidden",
  },
  reelsPromoDoodle: {
    position: "absolute",
    right: -6,
    bottom: -14,
    fontSize: 64,
    opacity: 0.16,
    transform: [{ rotate: "10deg" }],
  },
  reelsPromoPlay: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  reelsPromoBody: { flex: 1, gap: 2 },
  reelsPromoTitle: {
    fontFamily: fonts.displayMedium,
    fontSize: 15,
    lineHeight: 18,
    color: "#fff",
  },
  reelsPromoSub: {
    fontFamily: fonts.body,
    fontSize: 11,
    lineHeight: 14,
    color: "rgba(255,255,255,0.85)",
  },
  askFab: {
    position: "absolute",
    right: spacing.lg,
    bottom: spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: radii.pill,
    backgroundColor: colors.pink,
    shadowColor: "#000",
    shadowOpacity: 0.3,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  askFabText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 13,
    color: "#fff",
  },
});
