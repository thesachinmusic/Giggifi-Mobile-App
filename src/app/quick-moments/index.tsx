import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type ViewToken,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useVideoPlayer, VideoView } from "expo-video";
import { Feather } from "@expo/vector-icons";
import * as Location from "expo-location";
import { router, useFocusEffect } from "expo-router";
import { GradientBackground } from "@/components/GradientBackground";
import { GradientButton as Btn } from "@/components/GradientButton";
import { CategoryPill } from "@/components/CategoryPill";
import { DateField } from "@/components/DateField";
import { TimeField } from "@/components/TimeField";
import { FullScreenVideoPlayer } from "@/components/FullScreenVideoPlayer";
import {
  ArtistTile,
  DurationCards,
  FeaturedCard,
  LabelCaps,
  MomentCards,
  ReelTile,
  RowTitle,
} from "@/components/quick-moments/QuickMomentsParts";
import { duotoneFor } from "@/lib/palette";
import { captureError } from "@/lib/telemetry";
import {
  fetchQuickMomentsDiscover,
  fetchQuickMomentsMatch,
  ApiError,
  type QuickMomentDiscover,
  type QuickMomentDuration,
  type QuickMomentFormat,
  type QuickMomentMatch,
  type QuickMomentsCategory,
} from "@/lib/api";
import { getCachedLocation, setCachedLocation } from "@/lib/location-cache";
import { useVideoMute } from "@/lib/video-mute-context";
import {
  combineDateAndHour,
  DEFAULT_QUICK_MOMENT_DURATION,
  earliestSlot,
  formatINR,
  isLeadTimeOk,
  nearLabel,
  priceForDuration,
  QUICK_MOMENT_CATEGORY_CHIPS,
  QUICK_MOMENT_FORMAT_LABEL,
  QUICK_MOMENT_KIND,
  QUICK_MOMENT_SHORT_LABEL,
  QUICK_MOMENTS_MIN_LEAD_HOURS,
  visibleSections,
} from "@/lib/quick-moments";
import { colors, fonts, mock, radii, spacing } from "@/theme";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const CARD_WIDTH = SCREEN_WIDTH - spacing.lg * 2;
const CARD_HEIGHT = CARD_WIDTH * 1.15;

type LocationStatus = "detecting" | "ready" | "denied";
type WhenMode = "now" | "pick";

// The server enforces the real 30km hard cutoff; "Find nearby artists" always
// asks for the full range and lets the server sort out who is eligible and free.
const SEARCH_RADIUS_KM = 30;
const SEARCH_DEBOUNCE_MS = 350;
const VIEWABILITY_CONFIG = { itemVisiblePercentThreshold: 65 };
const TRAVEL_NOTE = "Travel is added based on distance and shown before you confirm.";

export default function QuickMomentsBrowseScreen() {
  const [format, setFormat] = useState<QuickMomentFormat | null>(null);
  const [duration, setDuration] = useState<QuickMomentDuration>(DEFAULT_QUICK_MOMENT_DURATION);
  const [whenMode, setWhenMode] = useState<WhenMode>("now");
  const initialPick = useMemo(() => earliestSlot(), []);
  const [pickDate, setPickDate] = useState<Date>(initialPick);
  const [pickHour, setPickHour] = useState<number>(initialPick.getHours());
  const [category, setCategory] = useState<"All" | QuickMomentsCategory>("All");
  const [search, setSearch] = useState("");
  const [q, setQ] = useState("");

  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locationStatus, setLocationStatus] = useState<LocationStatus>("detecting");

  // The last feed that loaded (kept on screen while the next one loads) and the
  // query it answered; `loading` is "the current query has no answer yet".
  const [feed, setFeed] = useState<{ key: string; data: QuickMomentDiscover } | null>(null);
  const [feedError, setFeedError] = useState<{ key: string; message: string } | null>(null);

  // "Find nearby artists": the existing list of matches with full-screen cards.
  const [results, setResults] = useState<QuickMomentMatch[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState("");
  const [reelUri, setReelUri] = useState<string | null>(null);

  // The OS permission prompt + a real GPS fix can both take several seconds — a
  // user who backs out meanwhile would otherwise land a setState on an
  // unmounted screen and crash to the ErrorBoundary.
  const mountedRef = useRef(true);
  useEffect(() => () => { mountedRef.current = false; }, []);

  async function detectLocation() {
    const cached = await getCachedLocation();
    if (cached) {
      if (mountedRef.current) {
        setCoords(cached);
        setLocationStatus("ready");
      }
      return;
    }
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (!mountedRef.current) return;
      if (status !== "granted") {
        setLocationStatus("denied");
        return;
      }
      const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      if (!mountedRef.current) return;
      const next = { lat: position.coords.latitude, lng: position.coords.longitude };
      setCoords(next);
      setLocationStatus("ready");
      await setCachedLocation(next.lat, next.lng);
    } catch {
      if (mountedRef.current) setLocationStatus("denied");
    }
  }

  useEffect(() => {
    void detectLocation();
  }, []);

  function retryLocation() {
    setLocationStatus("detecting");
    void detectLocation();
  }

  // Search box -> `q`, after a short pause so every keystroke isn't a request.
  useEffect(() => {
    const t = setTimeout(() => setQ(search.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [search]);

  const pickSlot = combineDateAndHour(pickDate, pickHour);
  const leadOk = whenMode === "now" || isLeadTimeOk(pickSlot);
  // Only a chosen time goes to the server; "Now" lets the server use the
  // earliest bookable slot (2+ hours from now).
  const slotStartTime = whenMode === "pick" && leadOk ? pickSlot.toISOString() : undefined;

  // The feed. Re-fetched whenever the moment, filters, duration or time change;
  // an answer for an older query is ignored (cancelled flag).
  const queryKey = coords ? [coords.lat, coords.lng, format, category, q, duration, slotStartTime].join("|") : null;
  useEffect(() => {
    if (!coords || !queryKey) return;
    let cancelled = false;
    fetchQuickMomentsDiscover({
      lat: coords.lat,
      lng: coords.lng,
      moment: format ? QUICK_MOMENT_KIND[format] : undefined,
      category,
      q: q || undefined,
      durationMinutes: duration,
      slotStartTime,
    })
      .then((res) => {
        if (!cancelled && mountedRef.current) setFeed({ key: queryKey, data: res });
      })
      .catch((err) => {
        if (cancelled || !mountedRef.current) return;
        setFeedError({ key: queryKey, message: err instanceof ApiError ? err.message : "Couldn't load artists right now." });
      });
    return () => {
      cancelled = true;
    };
  }, [coords, queryKey, format, category, q, duration, slotStartTime]);

  const data = feed?.data ?? null;
  const loading = queryKey !== null && feed?.key !== queryKey && feedError?.key !== queryKey;
  const loadError = feedError && feedError.key === queryKey ? feedError.message : "";

  const sections = useMemo(() => visibleSections(data), [data]);
  const imageByArtist = useMemo(() => {
    const map = new Map<string, string | null>();
    for (const i of [data?.featured, ...(data?.forMoment ?? []), ...(data?.mostViewed ?? [])]) {
      if (i) map.set(i.artistId, i.profileImageUrl);
    }
    return map;
  }, [data]);

  const price = priceForDuration(data?.durations, duration);
  const slotForBooking = whenMode === "pick" ? pickSlot : earliestSlot();

  function goToBook(artistId: string, name: string) {
    if (!format) {
      Alert.alert("Pick a moment first", "Choose Birthday Surprise, Anniversary Serenade or Just Because.");
      return;
    }
    if (!coords || !leadOk) return;
    router.push({
      pathname: "/quick-moments/book",
      params: {
        artistId,
        format,
        stageName: name,
        duration: String(duration),
        pricePerSlot: price != null ? String(price) : "",
        slot: slotForBooking.toISOString(),
        clientLat: String(coords.lat),
        clientLng: String(coords.lng),
      },
    });
  }

  async function runSearch() {
    if (!format || !coords || !leadOk) return;
    setSearching(true);
    setError("");
    try {
      const { results: matched } = await fetchQuickMomentsMatch({
        lat: coords.lat,
        lng: coords.lng,
        radiusKm: SEARCH_RADIUS_KM,
        slotStartTime,
        durationMinutes: duration,
      });
      if (mountedRef.current) setResults(matched);
    } catch (err) {
      if (mountedRef.current) setError(err instanceof ApiError ? err.message : "Couldn't find nearby artists right now.");
    } finally {
      if (mountedRef.current) setSearching(false);
    }
  }

  const [activeIndex, setActiveIndex] = useState(0);
  const onViewableItemsChanged = useCallback(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    if (viewableItems[0]?.index != null) setActiveIndex(viewableItems[0].index);
  }, []);

  // Only the card in view plays a video, and none once the screen loses focus
  // (tapping a card opens the booking screen, which stays stacked on top of this one).
  const [focused, setFocused] = useState(true);
  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      return () => setFocused(false);
    }, []),
  );

  const fromPrice = price != null ? `From ${formatINR(price)} + travel` : "Fixed price + travel";
  const ctaLabel = searching
    ? "Finding nearby artists…"
    : locationStatus === "detecting"
      ? "Detecting your location…"
      : "Find nearby artists";
  const ctaDisabled = !format || locationStatus !== "ready" || !leadOk;

  return (
    <GradientBackground>
      <SafeAreaView style={styles.safe} edges={["bottom"]}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 24}
          style={styles.flex}
        >
          {results ? (
            <View style={styles.flex}>
              <View style={styles.resultsHeaderRow}>
                <Text style={styles.resultsTitle}>
                  {results.length === 0 ? "No artists free right now" : `${results.length} artist${results.length === 1 ? "" : "s"} near you`}
                </Text>
                <Pressable onPress={() => { setResults(null); setError(""); }}>
                  <Text style={styles.startOver}>Start over</Text>
                </Pressable>
              </View>
              {results.length > 0 ? (
                <FlatList
                  data={results}
                  keyExtractor={(item) => item.id}
                  contentContainerStyle={styles.resultsScroll}
                  showsVerticalScrollIndicator={false}
                  viewabilityConfig={VIEWABILITY_CONFIG}
                  onViewableItemsChanged={onViewableItemsChanged}
                  initialNumToRender={2}
                  maxToRenderPerBatch={2}
                  windowSize={3}
                  removeClippedSubviews
                  renderItem={({ item, index }) => (
                    <MatchCard
                      item={item}
                      fromPrice={price}
                      isActive={index === activeIndex && focused}
                      onPress={() => goToBook(item.id, item.stageName ?? "this artist")}
                    />
                  )}
                />
              ) : null}
            </View>
          ) : (
            <ScrollView contentContainerStyle={styles.form} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              {/* Hero */}
              <Text style={styles.eyebrow}>GIGGIFI 20-20</Text>
              <Text style={styles.title}>Quick Moments</Text>
              <Text style={styles.subtitle}>
                A short live performance at your door: 20 or 40 minutes at a fixed price. Book with at least {QUICK_MOMENTS_MIN_LEAD_HOURS} hours&apos; notice.
              </Text>

              {/* Search + categories */}
              <View style={styles.searchWrap}>
                <Feather name="search" size={18} color={mock.textSoft} />
                <TextInput
                  value={search}
                  onChangeText={setSearch}
                  placeholder="Search singers, magicians, poets…"
                  placeholderTextColor={mock.textSoft}
                  style={styles.searchInput}
                  returnKeyType="search"
                  autoCorrect={false}
                />
                {search ? (
                  <Pressable onPress={() => setSearch("")} hitSlop={8} accessibilityLabel="Clear search">
                    <Feather name="x" size={16} color={mock.textSoft} />
                  </Pressable>
                ) : null}
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
                {QUICK_MOMENT_CATEGORY_CHIPS.map((c) => (
                  <CategoryPill key={c} label={c} active={category === c} onPress={() => setCategory(c)} />
                ))}
              </ScrollView>

              {/* Moment */}
              <LabelCaps text="PICK A MOMENT" />
              <MomentCards selected={format} onSelect={setFormat} />

              {/* Duration (prices come from the server) */}
              {data?.durations?.length ? (
                <>
                  <LabelCaps text="CHOOSE DURATION" />
                  <DurationCards durations={data.durations} selected={duration} onSelect={setDuration} />
                  <Text style={styles.note}>{TRAVEL_NOTE}</Text>
                </>
              ) : null}

              {/* When */}
              <LabelCaps text="WHEN?" />
              <View style={styles.whenRow}>
                {(["now", "pick"] as const).map((m) => {
                  const active = whenMode === m;
                  return (
                    <Pressable
                      key={m}
                      onPress={() => setWhenMode(m)}
                      style={[styles.whenChip, active && styles.whenChipActive]}
                      accessibilityRole="button"
                      accessibilityState={{ selected: active }}
                    >
                      <Text style={[styles.whenText, active && styles.whenTextActive]}>{m === "now" ? "Now" : "Pick time"}</Text>
                    </Pressable>
                  );
                })}
              </View>
              {whenMode === "now" ? (
                <Text style={styles.note}>An artist arrives {QUICK_MOMENTS_MIN_LEAD_HOURS} hours from now or later.</Text>
              ) : (
                <>
                  <View style={styles.pickRow}>
                    <DateField label="DATE" value={pickDate} onChange={setPickDate} minimumDate={new Date()} />
                    <TimeField label="TIME" hour={pickHour} onChange={setPickHour} />
                  </View>
                  {!leadOk ? (
                    <Text style={styles.warn}>Quick Moments need at least {QUICK_MOMENTS_MIN_LEAD_HOURS} hours&apos; notice. Pick a later time.</Text>
                  ) : null}
                </>
              )}

              {locationStatus === "denied" ? (
                <View style={styles.locationWarning}>
                  <Feather name="map-pin" size={16} color={colors.warn} />
                  <View style={styles.locationWarningBody}>
                    <Text style={styles.locationWarningTitle}>Turn on location to find artists near you</Text>
                    <Text style={styles.locationWarningText}>We couldn&apos;t get your location. Check your app permissions and try again.</Text>
                    <Pressable onPress={retryLocation} style={styles.locationRetryButton}>
                      <Text style={styles.locationRetryText}>Try again</Text>
                    </Pressable>
                  </View>
                </View>
              ) : null}

              {/* Available near you: only what the server really returned */}
              {sections.heading ? (
                <View style={styles.availHeader}>
                  <Text style={styles.availTitle}>Available near you</Text>
                  {sections.anyOnline ? (
                    <View style={styles.onlineTag}>
                      <View style={styles.onlineDot} />
                      <Text style={styles.onlineTagText}>ONLINE NOW</Text>
                    </View>
                  ) : null}
                </View>
              ) : null}

              {data?.featured ? (
                <FeaturedCard item={data.featured} onPress={() => goToBook(data.featured!.artistId, data.featured!.displayName)} />
              ) : null}

              {sections.forMoment && data ? (
                <>
                  <RowTitle title={format ? `Best for ${QUICK_MOMENT_SHORT_LABEL[format]}` : "Artists near you"} />
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rail}>
                    {data.forMoment.map((item) => (
                      <ArtistTile key={item.artistId} item={item} onPress={() => goToBook(item.artistId, item.displayName)} />
                    ))}
                  </ScrollView>
                </>
              ) : null}

              {sections.mostViewed && data ? (
                <>
                  <RowTitle title="Most viewed this week" />
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rail}>
                    {data.mostViewed.map((item) => (
                      <ArtistTile key={item.artistId} item={item} onPress={() => goToBook(item.artistId, item.displayName)} />
                    ))}
                  </ScrollView>
                </>
              ) : null}

              {sections.reels && data ? (
                <>
                  <RowTitle title="Reels from artists near you" />
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rail}>
                    {data.reels.map((reel) => (
                      <ReelTile
                        key={`${reel.artistId}:${reel.videoUrl}`}
                        reel={reel}
                        fallbackImage={imageByArtist.get(reel.artistId) ?? null}
                        onPress={() => setReelUri(reel.videoUrl)}
                      />
                    ))}
                  </ScrollView>
                </>
              ) : null}

              {sections.noArtistsNearby ? (
                <Text style={styles.emptyLine}>No Quick Moments artists are free near you right now.</Text>
              ) : null}

              {loading && !data ? <ActivityIndicator color={colors.pink} style={styles.loader} /> : null}
              {loadError ? <Text style={styles.error}>{loadError}</Text> : null}
              {error ? <Text style={styles.error}>{error}</Text> : null}

              {/* room for the sticky bar */}
              <View style={styles.barSpacer} />
            </ScrollView>
          )}

          {/* Sticky summary + CTA */}
          {!results ? (
            <View style={styles.barWrap} pointerEvents="box-none">
              <LinearGradient colors={["transparent", colors.ink + "F2", colors.ink]} locations={[0, 0.35, 1]} style={StyleSheet.absoluteFill} pointerEvents="none" />
              <View style={styles.bar}>
                <View style={styles.barSummary}>
                  <Text style={styles.barMoment} numberOfLines={1}>
                    {format ? QUICK_MOMENT_FORMAT_LABEL[format] : "Pick a moment"}
                  </Text>
                  <Text style={styles.barMeta} numberOfLines={1}>{duration} min · {fromPrice}</Text>
                </View>
              </View>
              <Btn
                label={ctaLabel}
                onPress={() => void runSearch()}
                disabled={ctaDisabled}
                loading={searching || locationStatus === "detecting"}
                style={styles.cta}
              />
            </View>
          ) : null}
        </KeyboardAvoidingView>
      </SafeAreaView>
      <FullScreenVideoPlayer visible={reelUri !== null} uri={reelUri} onClose={() => setReelUri(null)} />
    </GradientBackground>
  );
}

// Big, full-width portrait card so a client can actually see the artist's
// video before picking one — same active-only-plays discipline as
// FeaturedArtistCard on the home screen (see its comment): only the card
// currently in view loads real media, everything else stays unloaded so we
// don't OOM decoding a dozen videos in a scrollable list.
function MatchCard({ item, fromPrice, isActive, onPress }: { item: QuickMomentMatch; fromPrice: number | null; isActive: boolean; onPress: () => void }) {
  const { muted, toggleMuted } = useVideoMute();
  const videoSource = item.introVideoUrl ?? item.showreelUrl ?? null;
  const name = item.stageName ?? "GiggiFi Artist";
  const initial = name.trim().charAt(0).toUpperCase();
  const [c1, c2] = duotoneFor(item.id);

  const player = useVideoPlayer(null, (instance) => {
    instance.loop = true;
    instance.muted = true;
  });

  useEffect(() => {
    if (!videoSource) return;
    let cancelled = false;
    if (isActive) {
      player.replaceAsync(videoSource).then(() => {
        if (cancelled) return;
        player.muted = muted;
        player.play();
      }).catch((err) => captureError(err, "quick-moment-card-video-load"));
    } else {
      player.pause();
      player.replaceAsync(null).catch((err) => captureError(err, "quick-moment-card-video-unload"));
    }
    return () => { cancelled = true; };
  }, [isActive, videoSource, player, muted]);

  return (
    <Pressable style={styles.resultCard} onPress={onPress}>
      {videoSource && isActive ? (
        <VideoView player={player} style={styles.resultVideo} contentFit="cover" nativeControls={false} pointerEvents="none" />
      ) : item.profileImageUrl ? (
        <Image source={{ uri: item.profileImageUrl }} style={StyleSheet.absoluteFill} contentFit="cover" />
      ) : (
        <LinearGradient colors={[c1, c2]} style={StyleSheet.absoluteFill}>
          <Text style={styles.resultInitial}>{initial}</Text>
        </LinearGradient>
      )}

      <LinearGradient
        colors={["transparent", colors.ink + "1A", colors.ink + "F0"]}
        locations={[0, 0.5, 1]}
        style={StyleSheet.absoluteFill}
      />

      {videoSource && isActive ? (
        <Pressable
          onPress={toggleMuted}
          style={styles.resultMuteButton}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={muted ? "Unmute video" : "Mute video"}
        >
          <Feather name={muted ? "volume-x" : "volume-2"} size={14} color={colors.text} />
        </Pressable>
      ) : null}

      {item.performerType ? (
        <View style={styles.resultTagBadge}>
          <Text style={styles.resultTagBadgeText}>{item.performerType.toUpperCase()}</Text>
        </View>
      ) : null}

      <View style={styles.resultInfo}>
        <Text style={styles.resultName} numberOfLines={1}>{name}</Text>
        <View style={styles.resultRow}>
          <Feather name="map-pin" size={11} color={colors.textDim} />
          <Text style={styles.resultLoc}>{item.city ? `${item.city} · ` : ""}{nearLabel(item)}</Text>
        </View>
        <View style={styles.resultBottomRow}>
          <Text style={styles.resultPrice}>{fromPrice != null ? `From ${formatINR(fromPrice)} + travel` : "Fixed price + travel"}</Text>
          <View style={styles.resultCta}>
            <Text style={styles.resultCtaText}>Book</Text>
            <Feather name="chevron-right" size={14} color={colors.text} />
          </View>
        </View>
      </View>
    </Pressable>
  );
}


const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },
  form: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.xxl, gap: spacing.sm },
  eyebrow: { fontFamily: fonts.mono, fontSize: 11, color: colors.orange, letterSpacing: 2, marginBottom: spacing.xs },
  title: { fontFamily: fonts.displayBold, fontSize: 30, color: colors.text },
  subtitle: { fontFamily: fonts.body, fontSize: 13.5, lineHeight: 19, color: colors.textDim, marginBottom: spacing.xs },
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    minHeight: 46,
    paddingHorizontal: spacing.md,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: mock.cardBorder,
    backgroundColor: mock.cardFill,
    marginTop: spacing.xs,
  },
  searchInput: { flex: 1, fontFamily: fonts.body, fontSize: 13.5, color: colors.text, paddingVertical: 10 },
  chips: { gap: spacing.xs, paddingVertical: spacing.xs },
  note: { fontFamily: fonts.body, fontSize: 12, lineHeight: 17, color: colors.textMute },
  warn: { fontFamily: fonts.body, fontSize: 12, color: colors.warn },
  whenRow: { flexDirection: "row", gap: spacing.sm },
  whenChip: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 12,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.lineStrong,
    backgroundColor: colors.surface,
  },
  whenChipActive: { borderColor: colors.pink, backgroundColor: colors.pink + "14" },
  whenText: { fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.textDim },
  whenTextActive: { fontFamily: fonts.bodySemiBold, color: colors.text },
  pickRow: { flexDirection: "row", gap: spacing.sm },
  availHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: spacing.md },
  availTitle: { fontFamily: fonts.displayBold, fontSize: 21, color: colors.text },
  onlineTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radii.pill,
    backgroundColor: colors.ok + "1F",
  },
  onlineDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.ok },
  onlineTagText: { fontFamily: fonts.monoMedium, fontSize: 10, letterSpacing: 0.8, color: colors.ok },
  rail: { gap: spacing.sm, paddingRight: spacing.lg, paddingBottom: spacing.xs },
  emptyLine: { fontFamily: fonts.body, fontSize: 14, color: colors.textDim, marginTop: spacing.md },
  loader: { marginTop: spacing.lg },
  error: { fontFamily: fonts.body, fontSize: 12.5, color: colors.err, marginTop: spacing.xs },
  barSpacer: { height: 150 },
  barWrap: { position: "absolute", left: 0, right: 0, bottom: 0, paddingHorizontal: spacing.lg, paddingTop: spacing.xl, paddingBottom: spacing.sm },
  bar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: spacing.xs },
  barSummary: { flex: 1, gap: 2 },
  barMoment: { fontFamily: fonts.displayMedium, fontSize: 15, color: colors.text },
  barMeta: { fontFamily: fonts.bodyMedium, fontSize: 12.5, color: colors.textDim },
  cta: {},
  locationWarning: {
    flexDirection: "row",
    gap: spacing.sm,
    padding: spacing.sm,
    borderRadius: radii.md,
    backgroundColor: colors.warn + "14",
    borderWidth: 1,
    borderColor: colors.warn + "40",
    marginTop: spacing.sm,
  },
  locationWarningBody: { flex: 1, gap: 4 },
  locationWarningTitle: { fontFamily: fonts.bodySemiBold, fontSize: 13, color: colors.warn },
  locationWarningText: { fontFamily: fonts.body, fontSize: 12, lineHeight: 16, color: colors.textDim },
  locationRetryButton: {
    alignSelf: "flex-start",
    marginTop: 4,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: radii.pill,
    backgroundColor: colors.warn + "26",
    borderWidth: 1,
    borderColor: colors.warn + "66",
  },
  locationRetryText: { fontFamily: fonts.bodySemiBold, fontSize: 12, color: colors.warn },
  resultsScroll: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.xxl, gap: spacing.sm },
  resultsHeaderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: spacing.lg, paddingTop: spacing.md, marginBottom: spacing.md },
  resultsTitle: { fontFamily: fonts.displayMedium, fontSize: 17, color: colors.text },
  startOver: { fontFamily: fonts.bodyMedium, fontSize: 12.5, color: colors.pink },
  resultCard: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    borderRadius: radii.xl,
    overflow: "hidden",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.lineStrong,
    marginBottom: spacing.md,
    // react-native-web needs an explicit positioned ancestor for
    // StyleSheet.absoluteFill children (video/image/gradient below) to
    // actually fill the card — native doesn't need this, but web does.
    position: "relative",
  },
  resultInitial: { flex: 1, textAlign: "center", textAlignVertical: "center", fontFamily: fonts.display, fontSize: 64, color: colors.textMute },
  // Explicit pixel width/height rather than StyleSheet.absoluteFill —
  // expo-video's contentFit="cover" isn't reliably applied on web, so the video
  // (a replaced element) needs an explicit box to stretch into.
  resultVideo: { position: "absolute", top: 0, left: 0, width: CARD_WIDTH, height: CARD_HEIGHT },
  resultMuteButton: {
    position: "absolute",
    top: spacing.md,
    right: spacing.md,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.ink + "99",
    alignItems: "center",
    justifyContent: "center",
  },
  resultTagBadge: {
    position: "absolute",
    top: spacing.md,
    left: spacing.md,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radii.pill,
    backgroundColor: colors.ink + "99",
  },
  resultTagBadgeText: { fontFamily: fonts.mono, fontSize: 10, color: colors.text, letterSpacing: 0.6 },
  resultInfo: { position: "absolute", left: spacing.md, right: spacing.md, bottom: spacing.md, gap: 3 },
  resultName: { fontFamily: fonts.display, fontSize: 22, color: colors.text },
  resultRow: { flexDirection: "row", alignItems: "center", gap: 5, flexWrap: "wrap" },
  resultLoc: { fontFamily: fonts.body, fontSize: 12.5, color: colors.textDim },
  resultBottomRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: spacing.xs },
  resultPrice: { fontFamily: fonts.bodySemiBold, fontSize: 14, color: colors.text },
  resultCta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radii.pill,
    backgroundColor: colors.pink,
  },
  resultCtaText: { fontFamily: fonts.bodySemiBold, fontSize: 12.5, color: colors.text },
});
