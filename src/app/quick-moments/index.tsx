import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Dimensions, FlatList, Pressable, ScrollView, StyleSheet, Text, TextInput, View, type ViewToken } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useVideoPlayer, VideoView } from "expo-video";
import { Feather } from "@expo/vector-icons";
import * as Location from "expo-location";
import { router } from "expo-router";
import { GradientBackground } from "@/components/GradientBackground";
import { GradientButton as Btn } from "@/components/GradientButton";
import { duotoneFor } from "@/lib/palette";
import { captureError } from "@/lib/telemetry";
import { fetchQuickMomentsMatch, ApiError, type QuickMomentMatch, type QuickMomentFormat } from "@/lib/api";
import { QUICK_MOMENT_FORMATS } from "@/lib/quick-moments";
import { colors, fonts, radii, spacing } from "@/theme";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const CARD_WIDTH = SCREEN_WIDTH - spacing.lg * 2;
const CARD_HEIGHT = CARD_WIDTH * 1.15;

type LocationStatus = "detecting" | "ready" | "denied";

export default function QuickMomentsBrowseScreen() {
  const [format, setFormat] = useState<QuickMomentFormat | null>(null);
  const [budget, setBudget] = useState("");
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locationStatus, setLocationStatus] = useState<LocationStatus>("detecting");
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState("");
  const [results, setResults] = useState<QuickMomentMatch[] | null>(null);
  const searchedRef = useRef(false);

  // Detected the moment the screen opens — no separate "find nearby" step to
  // ask for permission first. High accuracy so the radius match is real GPS,
  // not a coarse network-based estimate.
  async function detectLocation() {
    setLocationStatus("detecting");
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        setLocationStatus("denied");
        return;
      }
      const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      setCoords({ lat: position.coords.latitude, lng: position.coords.longitude });
      setLocationStatus("ready");
    } catch {
      setLocationStatus("denied");
    }
  }

  useEffect(() => {
    void detectLocation();
  }, []);

  async function runSearch() {
    if (!format || !coords) return;
    setSearching(true);
    setError("");
    try {
      const { results: matched } = await fetchQuickMomentsMatch({
        lat: coords.lat,
        lng: coords.lng,
        budgetMax: budget ? Number(budget) : undefined,
      });
      setResults(matched);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't find nearby artists right now.");
    } finally {
      setSearching(false);
    }
  }

  // Auto-runs the moment both a format is picked and location resolves — the
  // "Find nearby artists" button below still works as a manual trigger/retry.
  useEffect(() => {
    if (format && coords && !searchedRef.current) {
      searchedRef.current = true;
      void runSearch();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [format, coords]);

  function reset() {
    setResults(null);
    setError("");
    searchedRef.current = false;
  }

  const [activeIndex, setActiveIndex] = useState(0);
  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 65 }).current;
  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    if (viewableItems[0]?.index != null) setActiveIndex(viewableItems[0].index);
  }).current;

  function openArtist(item: QuickMomentMatch) {
    if (!format) return;
    router.push({
      pathname: "/quick-moments/book",
      params: {
        artistId: item.id,
        format,
        stageName: item.stageName ?? "",
        pricePerSlot: item.pricePerSlot != null ? String(item.pricePerSlot) : "",
      },
    });
  }

  return (
    <GradientBackground>
      <SafeAreaView style={styles.safe} edges={["bottom"]}>
        {results ? (
          <View style={styles.flex}>
            <View style={styles.resultsHeaderRow}>
              <Text style={styles.resultsTitle}>{results.length} artist{results.length === 1 ? "" : "s"} nearby</Text>
              <Pressable onPress={reset}><Text style={styles.startOver}>Start over</Text></Pressable>
            </View>
            {results.length === 0 ? (
              <Text style={styles.muted}>No one's offering Quick Moments in your area yet — try a wider budget.</Text>
            ) : (
              <FlatList
                data={results}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.resultsScroll}
                showsVerticalScrollIndicator={false}
                viewabilityConfig={viewabilityConfig}
                onViewableItemsChanged={onViewableItemsChanged}
                initialNumToRender={2}
                maxToRenderPerBatch={2}
                windowSize={3}
                removeClippedSubviews
                renderItem={({ item, index }) => (
                  <MatchCard item={item} isActive={index === activeIndex} onPress={() => openArtist(item)} />
                )}
              />
            )}
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.form} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <Text style={styles.eyebrow}>GIGGIFI 20-20</Text>
            <Text style={styles.title}>Quick Moments</Text>
            <Text style={styles.subtitle}>
              A spontaneous ~15 minute performance, priced by the artist. Book with at least 2 hours' notice.
            </Text>

            <FormLabel text="PICK A MOMENT" />
            {QUICK_MOMENT_FORMATS.map((f) => (
              <Pressable
                key={f.key}
                onPress={() => setFormat(f.key)}
                style={[styles.formatCard, format === f.key && styles.formatCardActive]}
              >
                <Text style={styles.formatEmoji}>{f.emoji}</Text>
                <View style={styles.formatBody}>
                  <Text style={styles.formatLabel}>{f.label}</Text>
                  <Text style={styles.formatBlurb}>{f.blurb}</Text>
                </View>
                {format === f.key ? <Feather name="check-circle" size={18} color={colors.pink} /> : null}
              </Pressable>
            ))}

            <FormLabel text="MAX BUDGET (OPTIONAL)" />
            <TextInput
              value={budget}
              onChangeText={(v) => setBudget(v.replace(/[^0-9]/g, ""))}
              placeholder="e.g. 3000"
              placeholderTextColor={colors.textMute}
              keyboardType="number-pad"
              style={styles.input}
            />

            {locationStatus === "denied" ? (
              <View style={styles.locationWarning}>
                <Feather name="map-pin" size={16} color={colors.warn} />
                <View style={styles.locationWarningBody}>
                  <Text style={styles.locationWarningTitle}>Turn on location to find artists near you</Text>
                  <Text style={styles.locationWarningText}>We couldn't get your location. Check your app permissions and try again.</Text>
                  <Pressable onPress={detectLocation} style={styles.locationRetryButton}>
                    <Text style={styles.locationRetryText}>Try again</Text>
                  </Pressable>
                </View>
              </View>
            ) : null}

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <Btn
              label={searching ? "Finding nearby artists…" : locationStatus === "detecting" ? "Detecting your location…" : "Find nearby artists"}
              onPress={() => { searchedRef.current = true; void runSearch(); }}
              disabled={!format || locationStatus !== "ready"}
              loading={searching || locationStatus === "detecting"}
              style={styles.submitButton}
            />
          </ScrollView>
        )}
      </SafeAreaView>
    </GradientBackground>
  );
}

function FormLabel({ text }: { text: string }) {
  return <Text style={styles.label}>{text}</Text>;
}

// Big, full-width portrait card so a client can actually see the artist's
// video before picking one — same active-only-plays discipline as
// FeaturedArtistCard on the home screen (see its comment): only the card
// currently in view loads real media, everything else stays unloaded so we
// don't OOM decoding a dozen videos in a scrollable list.
function MatchCard({ item, isActive, onPress }: { item: QuickMomentMatch; isActive: boolean; onPress: () => void }) {
  const [muted, setMuted] = useState(true);
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
        colors={["transparent", "rgba(12,7,16,0.1)", "rgba(12,7,16,0.94)"]}
        locations={[0, 0.5, 1]}
        style={StyleSheet.absoluteFill}
      />

      {videoSource && isActive ? (
        <Pressable onPress={() => setMuted((v) => !v)} style={styles.resultMuteButton}>
          <Feather name={muted ? "volume-x" : "volume-2"} size={14} color="#fff" />
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
          <Feather name="map-pin" size={11} color="rgba(255,255,255,0.7)" />
          <Text style={styles.resultLoc}>{item.city ? `${item.city} · ` : ""}{item.distanceKm.toFixed(1)} km away</Text>
        </View>
        <View style={styles.resultBottomRow}>
          {item.pricePerSlot ? (
            <Text style={styles.resultPrice}>From ₹{item.pricePerSlot.toLocaleString("en-IN")}</Text>
          ) : <View />}
          <View style={styles.resultCta}>
            <Text style={styles.resultCtaText}>Book</Text>
            <Feather name="chevron-right" size={14} color="#fff" />
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
  eyebrow: {
    fontFamily: fonts.mono,
    fontSize: 11,
    color: colors.orange,
    letterSpacing: 2,
    marginBottom: spacing.sm,
  },
  title: {
    fontFamily: fonts.display,
    fontSize: 28,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontFamily: fonts.body,
    fontSize: 13.5,
    lineHeight: 19,
    color: colors.textDim,
    marginBottom: spacing.md,
  },
  label: {
    fontFamily: fonts.mono,
    fontSize: 10,
    color: colors.textMute,
    letterSpacing: 0.5,
    marginTop: spacing.sm,
    marginBottom: 2,
  },
  formatCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    padding: spacing.sm,
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    marginBottom: spacing.xs,
  },
  formatCardActive: {
    borderColor: colors.pink,
    backgroundColor: "rgba(236,72,153,0.08)",
  },
  formatEmoji: { fontSize: 26 },
  formatBody: { flex: 1, gap: 2 },
  formatLabel: { fontFamily: fonts.displayMedium, fontSize: 15, color: colors.text },
  formatBlurb: { fontFamily: fonts.body, fontSize: 12, lineHeight: 16, color: colors.textMute },
  input: {
    backgroundColor: colors.ink2,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.sm,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.text,
  },
  error: { fontFamily: fonts.body, fontSize: 12.5, color: colors.err, marginTop: spacing.xs },
  locationWarning: {
    flexDirection: "row",
    gap: spacing.sm,
    padding: spacing.sm,
    borderRadius: radii.md,
    backgroundColor: "rgba(245,158,11,0.08)",
    borderWidth: 1,
    borderColor: "rgba(245,158,11,0.25)",
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
    backgroundColor: "rgba(245,158,11,0.15)",
    borderWidth: 1,
    borderColor: "rgba(245,158,11,0.4)",
  },
  locationRetryText: { fontFamily: fonts.bodySemiBold, fontSize: 12, color: colors.warn },
  submitButton: { marginTop: spacing.lg },
  resultsScroll: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.xxl, gap: spacing.sm },
  resultsHeaderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: spacing.lg, paddingTop: spacing.md, marginBottom: spacing.md },
  resultsTitle: { fontFamily: fonts.displayMedium, fontSize: 17, color: colors.text },
  startOver: { fontFamily: fonts.bodyMedium, fontSize: 12.5, color: colors.pink },
  muted: { fontFamily: fonts.body, fontSize: 14, color: colors.textMute, marginTop: spacing.lg, paddingHorizontal: spacing.lg },
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
  resultInitial: { flex: 1, textAlign: "center", textAlignVertical: "center", fontFamily: fonts.display, fontSize: 64, color: "rgba(255,255,255,0.18)" },
  // Explicit pixel width/height rather than StyleSheet.absoluteFill —
  // expo-video's contentFit="cover" isn't reliably applied on web (confirmed
  // against the Expo docs), so the video (a replaced element) needs an
  // explicit box to stretch into rather than relying on inset:0 + cover.
  resultVideo: { position: "absolute", top: 0, left: 0, width: CARD_WIDTH, height: CARD_HEIGHT },
  resultMuteButton: {
    position: "absolute",
    top: spacing.md,
    right: spacing.md,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(0,0,0,0.5)",
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
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  resultTagBadgeText: { fontFamily: fonts.mono, fontSize: 10, color: "#fff", letterSpacing: 0.6 },
  resultInfo: { position: "absolute", left: spacing.md, right: spacing.md, bottom: spacing.md, gap: 3 },
  resultName: { fontFamily: fonts.display, fontSize: 22, color: "#fff" },
  resultRow: { flexDirection: "row", alignItems: "center", gap: 5, flexWrap: "wrap" },
  resultLoc: { fontFamily: fonts.body, fontSize: 12.5, color: "rgba(255,255,255,0.75)" },
  resultBottomRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: spacing.xs },
  resultPrice: { fontFamily: fonts.bodySemiBold, fontSize: 14, color: "#fff" },
  resultCta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radii.pill,
    backgroundColor: colors.pink,
  },
  resultCtaText: { fontFamily: fonts.bodySemiBold, fontSize: 12.5, color: "#fff" },
});
