import { useEffect, useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useVideoPlayer, VideoView } from "expo-video";
import { Feather } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { GradientBackground } from "@/components/GradientBackground";
import { GradientButton as Btn } from "@/components/GradientButton";
import { GlassCard } from "@/components/GlassCard";
import { DateField } from "@/components/DateField";
import { StateCityField } from "@/components/StateCityField";
import { RatingBadge } from "@/components/RatingBadge";
import { fetchArtist, sendEnquiry, saveBookerProfile, ApiError, type ArtistSummary, type QuickMomentFormat } from "@/lib/api";
import { QUICK_MOMENT_FORMATS } from "@/lib/quick-moments";
import { duotoneFor } from "@/lib/palette";
import { useAuth } from "@/lib/auth-context";
import { usePushPrimer } from "@/lib/use-push-primer";
import { PushPrimerSheet } from "@/components/PushPrimerSheet";
import { useOffersOptIn } from "@/lib/use-offers-optin";
import { OffersOptInSheet } from "@/components/OffersOptInSheet";
import { captureError } from "@/lib/telemetry";
import { colors, fonts, radii, spacing } from "@/theme";

export default function ArtistDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { refreshSession } = useAuth();
  const [artist, setArtist] = useState<ArtistSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [showForm, setShowForm] = useState(false);
  const [eventType, setEventType] = useState("");
  const [eventCity, setEventCity] = useState("");
  const [eventDate, setEventDate] = useState<Date | null>(null);
  const [budgetAmount, setBudgetAmount] = useState("");
  const [specialRequests, setSpecialRequests] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [formError, setFormError] = useState("");

  const {
    sheetRef: offersSheetRef,
    maybePresent: maybePresentOffersOptIn,
    handleAccept: handleOffersAccept,
    handleDecline: handleOffersDecline,
    handleClosed: handleOffersClosed,
  } = useOffersOptIn();

  // Offers opt-in shows right after the push primer sheet is gone — never
  // on top of it — regardless of how the primer resolved (or whether it
  // even presented at all, e.g. permission already granted).
  const {
    sheetRef: pushSheetRef,
    maybePresent: maybePresentPushPrimer,
    handleEnable: handlePushEnable,
    handleNotNow: handlePushNotNow,
    handleClosed: handlePushClosed,
  } = usePushPrimer(() => {
    maybePresentOffersOptIn();
  });

  const [qmFormat, setQmFormat] = useState<QuickMomentFormat | null>(null);

  const [needsBookerProfile, setNeedsBookerProfile] = useState(false);
  const [profileFullName, setProfileFullName] = useState("");
  const [profileEmail, setProfileEmail] = useState("");
  const [profileCity, setProfileCity] = useState("");
  const [profileState, setProfileState] = useState("");
  const [profileSubmitting, setProfileSubmitting] = useState(false);
  const [profileError, setProfileError] = useState("");

  useEffect(() => {
    fetchArtist(id)
      .then(({ artist: result }) => {
        setArtist(result);
        setEventCity(result.city ?? "");
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : "Couldn't load this artist."))
      .finally(() => setLoading(false));
  }, [id]);

  async function handleSubmitEnquiry() {
    if (!artist || !eventType || !eventCity || !eventDate) return;
    setSubmitting(true);
    setFormError("");
    try {
      await sendEnquiry({
        artistId: artist.id,
        eventType,
        eventCity,
        eventDate: eventDate.toISOString(),
        specialRequests: specialRequests || undefined,
        budgetAmount: budgetAmount ? Number(budgetAmount) : undefined,
      });
      setSent(true);
      // If the primer sheet didn't present (already granted, or denied and
      // can't ask again), there's nothing for its onClosed chain to fire —
      // go straight to the offers opt-in instead of losing it silently.
      maybePresentPushPrimer().then((shown) => {
        if (!shown) maybePresentOffersOptIn();
      });
    } catch (err) {
      // First-time bookers have no BookerProfile row yet — collect it inline
      // instead of dead-ending the enquiry they already filled in.
      if (err instanceof ApiError && err.status === 404) {
        setProfileCity((prev) => prev || eventCity);
        setNeedsBookerProfile(true);
      } else {
        setFormError(err instanceof ApiError ? err.message : "Could not send enquiry. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCompleteProfileAndSubmit() {
    if (!profileFullName || !profileEmail || !profileCity || !profileState) return;
    setProfileSubmitting(true);
    setProfileError("");
    try {
      await saveBookerProfile({ fullName: profileFullName, email: profileEmail, city: profileCity, state: profileState });
      await refreshSession();
      setNeedsBookerProfile(false);
      await handleSubmitEnquiry();
    } catch (err) {
      setProfileError(err instanceof ApiError ? err.message : "Could not save your details. Please try again.");
    } finally {
      setProfileSubmitting(false);
    }
  }

  if (loading) {
    return (
      <GradientBackground>
        <SafeAreaView style={styles.centered}>
          <ActivityIndicator color={colors.pink} />
        </SafeAreaView>
      </GradientBackground>
    );
  }

  if (error || !artist) {
    return (
      <GradientBackground>
        <SafeAreaView style={styles.centered}>
          <Text style={styles.muted}>{error || "Artist not found."}</Text>
        </SafeAreaView>
      </GradientBackground>
    );
  }

  const name = artist.stageName ?? "GiggiFi Artist";
  const initial = name.trim().charAt(0).toUpperCase();
  const [c1, c2] = duotoneFor(artist.id);
  const chips = [...artist.genres, ...artist.eventTypes].slice(0, 8);

  return (
    <GradientBackground>
      <KeyboardAvoidingView style={styles.scrollFlex} behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={80}>
      <ScrollView style={styles.scrollFlex} contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <ArtistHero artist={artist} c1={c1} c2={c2} initial={initial} />

        <View style={styles.body}>
          {artist.performerType ? <Text style={styles.tagline}>{artist.performerType.toUpperCase()}</Text> : null}
          <View style={styles.nameRow}>
            <Text style={styles.name}>{name}</Text>
            <RatingBadge rating={artist.avgRating} size={15} />
          </View>

          {artist.city ? (
            <View style={styles.row}>
              <Feather name="map-pin" size={13} color={colors.textMute} />
              <Text style={styles.loc}>{artist.city}{artist.state ? `, ${artist.state}` : ""}</Text>
            </View>
          ) : null}

          <View style={styles.availabilityRow}>
            <View style={[styles.availabilityDot, artist.availability ? styles.availabilityDotOn : styles.availabilityDotOff]} />
            <Text style={styles.availabilityText}>{artist.availability ? "Available now" : "Currently unavailable"}</Text>
            {artist.quickMomentsEnabled ? (
              <View style={styles.qmBadge}>
                <Feather name="zap" size={10} color={colors.orange} />
                <Text style={styles.qmBadgeText}>Quick Moments</Text>
              </View>
            ) : null}
          </View>

          {/* Bio is intentionally not shown — it's free text an artist
              writes themselves, and unlike stageName it isn't run through
              maskName(), so artists sometimes write their real name
              directly into it, defeating the masking used everywhere
              else on this screen. */}

          <View style={styles.statsRow}>
            {artist.yearsExperience ? <Stat label="YEARS" value={String(artist.yearsExperience)} /> : null}
            {artist.reviewCount ? <Stat label="REVIEWS" value={String(artist.reviewCount)} /> : null}
            <Stat label="TRAVEL" value={artist.travelAvailable ? "Yes" : "Local"} />
          </View>

          {chips.length ? (
            <View style={styles.chipRow}>
              {chips.map((chip) => (
                <View key={chip} style={styles.chip}>
                  <Text style={styles.chipText}>{chip}</Text>
                </View>
              ))}
            </View>
          ) : null}

          {artist.languages.length ? (
            <View style={styles.languagesBlock}>
              <Text style={styles.fieldLabel}>LANGUAGES</Text>
              <View style={styles.chipRow}>
                {artist.languages.map((lang) => (
                  <View key={lang} style={styles.chip}>
                    <Text style={styles.chipText}>{lang}</Text>
                  </View>
                ))}
              </View>
            </View>
          ) : null}

          <GlassCard style={styles.priceCard}>
            <View style={styles.priceRow}>
              <View>
                <Text style={styles.priceLabel}>STARTING AT</Text>
                <Text style={styles.price}>{artist.ratePerEvent ? `₹${artist.ratePerEvent.toLocaleString("en-IN")}` : "On request"}</Text>
              </View>
              {artist.priceNegotiable ? (
                <View style={styles.negotiableBadge}>
                  <Text style={styles.negotiableText}>Negotiable</Text>
                </View>
              ) : null}
            </View>

            {sent ? (
              <View style={styles.sentBox}>
                <Feather name="check-circle" size={18} color={colors.ok} />
                <Text style={styles.sentText}>Enquiry sent — {name.split(" ")[0]} will respond soon.</Text>
              </View>
            ) : needsBookerProfile ? (
              <View style={styles.form}>
                <Text style={styles.profileIntro}>One last step — tell us a bit about you and we'll send your enquiry.</Text>
                <FormField label="FULL NAME" value={profileFullName} onChangeText={setProfileFullName} placeholder="Your name" />
                <FormField label="EMAIL" value={profileEmail} onChangeText={setProfileEmail} placeholder="you@email.com" keyboardType="email-address" autoCapitalize="none" />
                <StateCityField city={profileCity} onChangeCity={setProfileCity} state={profileState} onChangeState={setProfileState} />
                {profileError ? <Text style={styles.error}>{profileError}</Text> : null}
                <Btn
                  label="Continue & Send Enquiry"
                  onPress={handleCompleteProfileAndSubmit}
                  disabled={!profileFullName || !profileEmail || !profileCity || !profileState}
                  loading={profileSubmitting || submitting}
                  style={styles.formButton}
                />
                <Pressable onPress={() => setNeedsBookerProfile(false)}>
                  <Text style={styles.profileBack}>Back</Text>
                </Pressable>
              </View>
            ) : showForm ? (
              <View style={styles.form}>
                <FormField label="EVENT TYPE" value={eventType} onChangeText={setEventType} placeholder="Wedding, Birthday, Corporate…" />
                <StateCityField city={eventCity} onChangeCity={setEventCity} cityLabel="EVENT CITY" />
                <DateField label="EVENT DATE" value={eventDate} onChange={setEventDate} />
                <FormField
                  label="YOUR BUDGET (OPTIONAL)"
                  value={budgetAmount}
                  onChangeText={(v) => setBudgetAmount(v.replace(/[^0-9]/g, ""))}
                  placeholder={artist.ratePerEvent ? `Artist's rate: ₹${artist.ratePerEvent.toLocaleString("en-IN")}` : "e.g. 12000"}
                  keyboardType="number-pad"
                />
                <FormField label="NOTES (OPTIONAL)" value={specialRequests} onChangeText={setSpecialRequests} placeholder="Anything the artist should know" multiline />
                {formError ? <Text style={styles.error}>{formError}</Text> : null}
                <Btn
                  label="Send Enquiry"
                  onPress={handleSubmitEnquiry}
                  disabled={!eventType || !eventCity || !eventDate}
                  loading={submitting}
                  style={styles.formButton}
                />
              </View>
            ) : (
              <Btn label="Send Enquiry" onPress={() => setShowForm(true)} style={styles.formButton} />
            )}

            <View style={styles.escrow}>
              <Feather name="shield" size={16} color={colors.purple} />
              <Text style={styles.escrowText}>Payments are held securely until the event is confirmed done.</Text>
            </View>
          </GlassCard>

          {artist.quickMomentsEnabled ? (
            <GlassCard style={styles.qmCard}>
              <View style={styles.qmCardHeader}>
                <View>
                  <Text style={styles.qmCardEyebrow}>GIGGIFI 20-20</Text>
                  <Text style={styles.qmCardTitle}>Book a Quick Moment</Text>
                </View>
                {artist.quickMomentsAvgRating != null ? (
                  <View style={styles.qmRating}>
                    <RatingBadge rating={artist.quickMomentsAvgRating} size={12} />
                    <Text style={styles.qmRatingLabel}>Quick Moments</Text>
                  </View>
                ) : null}
              </View>
              <Text style={styles.qmCardBlurb}>
                A short, spontaneous ~15 minute performance — priced by {name.split(" ")[0]}, not negotiable.
                {artist.quickMomentsPricePerSlot ? ` ₹${artist.quickMomentsPricePerSlot.toLocaleString("en-IN")} / slot.` : ""}
              </Text>
              <View style={styles.qmPillWrap}>
                {QUICK_MOMENT_FORMATS.map((f) => (
                  <Pressable
                    key={f.key}
                    onPress={() => setQmFormat(f.key)}
                    style={[styles.qmPill, qmFormat === f.key && styles.qmPillActive]}
                  >
                    <Text style={styles.qmPillEmoji}>{f.emoji}</Text>
                    <Text style={[styles.qmPillText, qmFormat === f.key && styles.qmPillTextActive]}>{f.label}</Text>
                  </Pressable>
                ))}
              </View>
              <Btn
                label="Continue"
                disabled={!qmFormat}
                onPress={() => {
                  if (!qmFormat) return;
                  router.push({
                    pathname: "/quick-moments/book",
                    params: {
                      artistId: artist.id,
                      format: qmFormat,
                      stageName: name,
                      pricePerSlot: artist.quickMomentsPricePerSlot != null ? String(artist.quickMomentsPricePerSlot) : "",
                    },
                  });
                }}
                style={styles.formButton}
              />
            </GlassCard>
          ) : null}
        </View>
      </ScrollView>
      </KeyboardAvoidingView>

      <PushPrimerSheet ref={pushSheetRef} onEnable={handlePushEnable} onNotNow={handlePushNotNow} onClosed={handlePushClosed} />
      <OffersOptInSheet ref={offersSheetRef} onAccept={handleOffersAccept} onDecline={handleOffersDecline} onClosed={handleOffersClosed} />
    </GradientBackground>
  );
}

function ArtistHero({ artist, c1, c2, initial }: { artist: ArtistSummary; c1: string; c2: string; initial: string }) {
  const [muted, setMuted] = useState(true);
  const videoSource = artist.introVideoUrl ?? artist.showreelUrl ?? null;

  const player = useVideoPlayer(null, (instance) => {
    instance.loop = true;
    instance.muted = true;
  });

  // Explicitly await the remote source loading before commanding play — calling
  // play() in the same tick the source is set can race ahead of the network
  // load on slower connections, leaving the hero stuck on a frozen first frame.
  useEffect(() => {
    if (!videoSource) return;
    let cancelled = false;
    player.replaceAsync(videoSource).then(() => {
      if (cancelled) return;
      player.muted = muted;
      player.play();
    }).catch((err) => captureError(err, "artist-video-load"));
    return () => {
      cancelled = true;
    };
  }, [videoSource, player]);

  useEffect(() => {
    if (videoSource) player.muted = muted;
  }, [muted, player, videoSource]);

  return (
    <View style={styles.hero} pointerEvents="box-none">
      {videoSource ? (
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <VideoView player={player} style={StyleSheet.absoluteFill} contentFit="cover" nativeControls={false} />
        </View>
      ) : artist.profileImageUrl ? (
        <Image source={{ uri: artist.profileImageUrl }} style={StyleSheet.absoluteFill} contentFit="cover" />
      ) : (
        <LinearGradient colors={[c1, c2]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill}>
          <Text style={styles.heroInitial}>{initial}</Text>
        </LinearGradient>
      )}
      {videoSource ? (
        <Pressable onPress={() => setMuted((v) => !v)} style={styles.heroMuteButton}>
          <Feather name={muted ? "volume-x" : "volume-2"} size={15} color="#fff" />
        </Pressable>
      ) : null}
    </View>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function FormField({
  label,
  multiline,
  ...props
}: { label: string; multiline?: boolean } & React.ComponentProps<typeof TextInput>) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        {...props}
        multiline={multiline}
        placeholderTextColor={colors.textMute}
        style={[styles.fieldInput, multiline ? styles.fieldInputMultiline : null]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },
  scrollFlex: { flex: 1 },
  scroll: { paddingBottom: spacing.xxl },
  hero: { aspectRatio: 1, position: "relative" },
  heroInitial: {
    flex: 1,
    textAlign: "center",
    textAlignVertical: "center",
    fontFamily: fonts.display,
    fontSize: 160,
    color: "rgba(255,255,255,0.16)",
  },
  heroMuteButton: {
    position: "absolute",
    top: spacing.md,
    right: spacing.md,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center",
    justifyContent: "center",
  },
  body: { padding: spacing.lg, marginTop: -radii.xl, backgroundColor: colors.ink, borderTopLeftRadius: radii.xl * 1.5, borderTopRightRadius: radii.xl * 1.5 },
  tagline: {
    fontFamily: fonts.mono,
    fontSize: 12,
    color: colors.orange,
    letterSpacing: 1.5,
    marginBottom: spacing.sm,
  },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: spacing.sm },
  name: {
    fontFamily: fonts.display,
    fontSize: 34,
    color: colors.text,
  },
  row: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: spacing.md },
  loc: { fontFamily: fonts.body, fontSize: 14, color: colors.textMute },
  availabilityRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: spacing.md },
  availabilityDot: { width: 7, height: 7, borderRadius: 3.5 },
  availabilityDotOn: { backgroundColor: colors.ok },
  availabilityDotOff: { backgroundColor: colors.textMute },
  availabilityText: { fontFamily: fonts.bodyMedium, fontSize: 12.5, color: colors.textDim },
  qmBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginLeft: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.orange,
  },
  qmBadgeText: { fontFamily: fonts.mono, fontSize: 9.5, color: colors.orange, letterSpacing: 0.3 },
  languagesBlock: { marginBottom: spacing.lg, gap: spacing.xs },
  statsRow: {
    flexDirection: "row",
    gap: spacing.xl,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    marginBottom: spacing.lg,
  },
  stat: { gap: 2 },
  statValue: {
    fontFamily: fonts.display,
    fontSize: 20,
    color: colors.text,
  },
  statLabel: {
    fontFamily: fonts.mono,
    fontSize: 9,
    color: colors.textMute,
    letterSpacing: 0.5,
  },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: spacing.lg },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: "rgba(255,255,255,0.03)",
  },
  chipText: {
    fontFamily: fonts.mono,
    fontSize: 10.5,
    color: colors.textMute,
  },
  priceCard: { gap: spacing.md },
  priceRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  priceLabel: {
    fontFamily: fonts.mono,
    fontSize: 10,
    color: colors.textMute,
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  price: {
    fontFamily: fonts.display,
    fontSize: 26,
    color: colors.text,
  },
  negotiableBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radii.pill,
    backgroundColor: "rgba(34,197,94,0.15)",
  },
  negotiableText: {
    fontFamily: fonts.mono,
    fontSize: 10,
    color: colors.ok,
  },
  formButton: {},
  form: { gap: spacing.sm },
  field: { gap: 4 },
  fieldLabel: {
    fontFamily: fonts.mono,
    fontSize: 10,
    color: colors.textMute,
    letterSpacing: 0.5,
  },
  fieldInput: {
    backgroundColor: colors.ink2,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.sm,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.text,
  },
  fieldInputMultiline: { minHeight: 70, textAlignVertical: "top" },
  profileIntro: { fontFamily: fonts.body, fontSize: 13, lineHeight: 18, color: colors.textDim },
  profileBack: { fontFamily: fonts.bodyMedium, fontSize: 12.5, color: colors.textMute, textAlign: "center", marginTop: 2 },
  error: { fontFamily: fonts.body, fontSize: 12.5, color: colors.err },
  sentBox: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  sentText: { flex: 1, fontFamily: fonts.body, fontSize: 13.5, color: colors.text },
  escrow: {
    flexDirection: "row",
    gap: spacing.sm,
    alignItems: "flex-start",
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  escrowText: { flex: 1, fontFamily: fonts.body, fontSize: 12, lineHeight: 17, color: colors.textMute },
  qmCard: { marginTop: spacing.lg, gap: spacing.sm },
  qmCardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  qmCardEyebrow: { fontFamily: fonts.mono, fontSize: 10, color: colors.orange, letterSpacing: 1, marginBottom: 2 },
  qmCardTitle: { fontFamily: fonts.displayMedium, fontSize: 17, color: colors.text },
  qmRating: { alignItems: "flex-end", gap: 2 },
  qmRatingLabel: { fontFamily: fonts.mono, fontSize: 9, color: colors.textMute },
  qmCardBlurb: { fontFamily: fonts.body, fontSize: 12.5, lineHeight: 18, color: colors.textDim },
  qmPillWrap: { gap: spacing.xs },
  qmPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    padding: spacing.sm,
    borderRadius: radii.md,
    backgroundColor: colors.ink2,
    borderWidth: 1,
    borderColor: colors.line,
  },
  qmPillActive: { borderColor: colors.pink, backgroundColor: "rgba(236,72,153,0.08)" },
  qmPillEmoji: { fontSize: 18 },
  qmPillText: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.textDim },
  qmPillTextActive: { color: colors.text, fontFamily: fonts.bodySemiBold },
  muted: { fontFamily: fonts.body, fontSize: 14, color: colors.textMute },
});
