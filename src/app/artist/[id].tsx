import { useCallback, useEffect, useRef, useState } from "react";
import { Dimensions, KeyboardAvoidingView, Platform, Pressable, ScrollView, Share, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useVideoPlayer, VideoView } from "expo-video";
import { Feather } from "@expo/vector-icons";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { GradientBackground } from "@/components/GradientBackground";
import { GradientButton as Btn } from "@/components/GradientButton";
import { GlassCard } from "@/components/GlassCard";
import { AvailabilityCalendar } from "@/components/AvailabilityCalendar";
import { InlinePhoneVerification } from "@/components/InlinePhoneVerification";
import { DateField } from "@/components/DateField";
import { StateCityField } from "@/components/StateCityField";
import { RatingBadge } from "@/components/RatingBadge";
import { ReviewsList } from "@/components/ReviewsList";
import { VideoModal } from "@/components/VideoModal";
import { Skeleton } from "@/components/Skeleton";
import { fetchArtist, sendEnquiry, saveBookerProfile, fetchEventPlans, ApiError, type ArtistSummary, type QuickMomentFormat, type RepertoireData, type EventPlanSummary } from "@/lib/api";
import { isValidEmail } from "@/lib/format";
import { QUICK_MOMENT_FORMATS } from "@/lib/quick-moments";
import { DURATION_OPTIONS, DURATION_MULTIPLIERS, FULL_SHOW_MINUTES, getDurationAdjustedPrice, isSoloPerformerType } from "@/lib/duration-pricing";
import { duotoneFor } from "@/lib/palette";
import { useAuth } from "@/lib/auth-context";
import { useSavedArtists } from "@/lib/saved-artists-context";
import { useVideoMute } from "@/lib/video-mute-context";
import { usePushPrimer } from "@/lib/use-push-primer";
import { PushPrimerSheet } from "@/components/PushPrimerSheet";
import { useOffersOptIn } from "@/lib/use-offers-optin";
import { OffersOptInSheet } from "@/components/OffersOptInSheet";
import { captureError } from "@/lib/telemetry";
import { colors, fonts, gradients, radii, spacing } from "@/theme";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

type ProfileTab = "about" | "media" | "packages" | "repertoire" | "reviews";
const TABS: { key: ProfileTab; label: string }[] = [
  { key: "about", label: "About" },
  { key: "media", label: "Media" },
  { key: "packages", label: "Packages" },
  { key: "repertoire", label: "Repertoire" },
  { key: "reviews", label: "Reviews" },
];

// Same transform the website's artist profile uses (cloudinaryThumb in
// app/artists/[id]/artist-public-profile.tsx) — a static frame grab so the
// Media tab's grid doesn't have to decode N videos at once just to show
// thumbnails.
function cloudinaryThumb(url: string): string | null {
  if (!url.includes("cloudinary.com") || !url.includes("/video/upload/")) return null;
  return url
    .replace("/video/upload/", "/video/upload/w_480,h_640,c_fill,f_jpg,so_1/")
    .replace(/\.(mp4|mov|webm)(\?.*)?$/, ".jpg");
}

export default function ArtistDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { refreshSession } = useAuth();
  const insets = useSafeAreaInsets();
  const [artist, setArtist] = useState<ArtistSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<ProfileTab>("about");

  // Tracks the price card's scroll offset (bodyY + its own y within body)
  // so the sticky CTA can jump straight to the booking form instead of
  // just toggling it open somewhere off-screen.
  const scrollRef = useRef<ScrollView>(null);
  const [bodyY, setBodyY] = useState(0);
  const [priceCardY, setPriceCardY] = useState(0);
  // Set when the sticky CTA opens the form from its collapsed state — the
  // form doesn't exist in the tree yet at that point, so the ScrollView's
  // content isn't tall enough for scrollTo's target to land correctly.
  // Cleared (and the scroll actually fired) from the form container's own
  // onLayout, once its rendered height is part of the scrollable content.
  const pendingScrollRef = useRef(false);

  const [showForm, setShowForm] = useState(false);
  const [eventType, setEventType] = useState("");
  const [eventCity, setEventCity] = useState("");
  const [eventDate, setEventDate] = useState<Date | null>(null);
  const [budgetAmount, setBudgetAmount] = useState("");
  // My Event Hub — lets the client tag this enquiry to an already-created
  // event plan so its "spent" figure includes this booking once it's
  // actually committed. Fetched lazily (only once the form actually opens)
  // rather than on every profile load — most profile views never reach it.
  const [eventPlans, setEventPlans] = useState<EventPlanSummary[]>([]);
  const [selectedEventPlanId, setSelectedEventPlanId] = useState<string | null>(null);
  const [duration, setDuration] = useState<number | null>(null);
  const [bookingMode, setBookingMode] = useState<"ENQUIRY" | "QUICK_BOOKING">("ENQUIRY");
  const [specialRequests, setSpecialRequests] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [sentBookingId, setSentBookingId] = useState<string | null>(null);
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

  const [needsPhoneVerification, setNeedsPhoneVerification] = useState(false);
  const [needsBookerProfile, setNeedsBookerProfile] = useState(false);
  const [profileFullName, setProfileFullName] = useState("");
  const [profileEmail, setProfileEmail] = useState("");
  const [profileCity, setProfileCity] = useState("");
  const [profileState, setProfileState] = useState("");
  const [profileSubmitting, setProfileSubmitting] = useState(false);
  const [profileError, setProfileError] = useState("");

  // Guards every setState below against firing after this screen has
  // unmounted — tapping an artist card then immediately hitting back
  // (common while flicking through a list) can otherwise let a slow
  // fetchArtist() land on an already-unmounted screen and crash to the
  // ErrorBoundary.
  const mountedRef = useRef(true);
  useEffect(() => () => { mountedRef.current = false; }, []);

  const loadArtist = useCallback(() => {
    setLoading(true);
    setError("");
    fetchArtist(id)
      .then(({ artist: result }) => {
        if (!mountedRef.current) return;
        setArtist(result);
        setEventCity(result.city ?? "");
      })
      .catch((err) => {
        if (mountedRef.current) setError(err instanceof ApiError ? err.message : "Couldn't load this artist.");
      })
      .finally(() => {
        if (mountedRef.current) setLoading(false);
      });
  }, [id]);

  useEffect(() => {
    loadArtist();
  }, [loadArtist]);

  useEffect(() => {
    if (!showForm || eventPlans.length > 0) return;
    fetchEventPlans()
      .then(({ plans }) => { if (mountedRef.current) setEventPlans(plans); })
      .catch((err) => captureError(err, "artist-profile-event-plans-fetch"));
  }, [showForm, eventPlans.length]);

  async function handleSubmitEnquiry() {
    if (!artist || !eventType || !eventCity || !eventDate) return;
    setSubmitting(true);
    setFormError("");
    try {
      const effectiveDuration = duration ?? FULL_SHOW_MINUTES;
      const priceForDuration = getDurationAdjustedPrice(artist.ratePerEvent, artist.performerType, effectiveDuration);
      const { bookingId } = await sendEnquiry({
        artistId: artist.id,
        eventType,
        eventCity,
        eventDate: eventDate.toISOString(),
        specialRequests: specialRequests || undefined,
        duration: effectiveDuration,
        mode: bookingMode,
        budgetAmount: bookingMode === "ENQUIRY" && budgetAmount ? Number(budgetAmount) : undefined,
        quotedPrice: bookingMode === "QUICK_BOOKING" ? priceForDuration ?? undefined : undefined,
        eventPlanId: selectedEventPlanId ?? undefined,
      });
      if (!mountedRef.current) return;
      setSentBookingId(bookingId);
      setSent(true);
      // If the primer sheet didn't present (already granted, or denied and
      // can't ask again), there's nothing for its onClosed chain to fire —
      // go straight to the offers opt-in instead of losing it silently.
      // Guarded the same as every other post-await continuation here even
      // though it only touches sheet refs (no setState) — cheap insurance,
      // not the crash source (see ArtistHero below for that).
      maybePresentPushPrimer().then((shown) => {
        if (!mountedRef.current) return;
        if (!shown) maybePresentOffersOptIn();
      });
    } catch (err) {
      if (!mountedRef.current) return;
      // Not signed in at all yet — verify inline, right here, then retry
      // the exact same enquiry with everything they already filled in.
      if (err instanceof ApiError && err.status === 401) {
        setNeedsPhoneVerification(true);
      } else if (err instanceof ApiError && err.status === 404) {
        // First-time bookers have no BookerProfile row yet — collect it inline
        // instead of dead-ending the enquiry they already filled in.
        setProfileCity((prev) => prev || eventCity);
        setNeedsBookerProfile(true);
      } else {
        setFormError(err instanceof ApiError ? err.message : "Could not send enquiry. Please try again.");
      }
    } finally {
      if (mountedRef.current) setSubmitting(false);
    }
  }

  async function handleCompleteProfileAndSubmit() {
    if (!profileFullName || !isValidEmail(profileEmail) || !profileCity || !profileState) return;
    setProfileSubmitting(true);
    setProfileError("");
    try {
      await saveBookerProfile({ fullName: profileFullName, email: profileEmail, city: profileCity, state: profileState });
      await refreshSession();
      if (!mountedRef.current) return;
      setNeedsBookerProfile(false);
      await handleSubmitEnquiry();
    } catch (err) {
      if (mountedRef.current) setProfileError(err instanceof ApiError ? err.message : "Could not save your details. Please try again.");
    } finally {
      if (mountedRef.current) setProfileSubmitting(false);
    }
  }

  // bodyY only ever reads 0 before its onLayout has fired at all — the hero
  // above it is always taller than 0, so a real post-layout value never
  // legitimately lands on exactly 0. Scrolling to a stale/unmeasured target
  // would land at the very top of the screen, which is worse than not
  // scrolling, so skip it entirely rather than guess.
  function scrollToPriceCard() {
    if (bodyY === 0) return;
    scrollRef.current?.scrollTo({ y: Math.max(bodyY + priceCardY - spacing.md, 0), animated: true });
  }

  // The sticky CTA always lands on the Packages tab (where the booking form
  // lives) and makes sure it's visible — switching tabs first if needed,
  // then scrolling once that tab's content is actually in the tree.
  function handleStickyPress() {
    if (activeTab !== "packages") {
      pendingScrollRef.current = true;
      setActiveTab("packages");
      return;
    }
    if (showForm || needsBookerProfile || needsPhoneVerification) {
      scrollToPriceCard();
      return;
    }
    pendingScrollRef.current = true;
    setShowForm(true);
  }

  if (loading) {
    return (
      <GradientBackground>
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <Skeleton height={SCREEN_WIDTH} borderRadius={0} />
          <View style={styles.body}>
            <Skeleton width={120} height={12} style={styles.skeletonTagline} />
            <Skeleton width="60%" height={30} style={styles.skeletonName} />
            <Skeleton width={100} height={14} style={styles.skeletonLoc} />
            <Skeleton height={140} borderRadius={radii.xl} style={styles.skeletonPriceCard} />
          </View>
        </ScrollView>
      </GradientBackground>
    );
  }

  if (error || !artist) {
    return (
      <GradientBackground>
        <SafeAreaView style={styles.centered}>
          <Text style={styles.muted}>{error || "Artist not found."}</Text>
          <Pressable style={styles.retryButton} onPress={loadArtist}>
            <Text style={styles.retryButtonText}>Try again</Text>
          </Pressable>
        </SafeAreaView>
      </GradientBackground>
    );
  }

  const name = artist.stageName ?? "GiggiFi Artist";
  const initial = name.trim().charAt(0).toUpperCase();
  const [c1, c2] = duotoneFor(artist.id);
  const solo = isSoloPerformerType(artist.performerType);
  const effectiveDuration = duration ?? FULL_SHOW_MINUTES;
  const adjustedPrice = getDurationAdjustedPrice(artist.ratePerEvent, artist.performerType, effectiveDuration);
  const videos = [
    artist.introVideoUrl ? { url: artist.introVideoUrl, label: "Intro" } : null,
    artist.showreelUrl && artist.showreelUrl !== artist.introVideoUrl ? { url: artist.showreelUrl, label: "Showreel" } : null,
  ].filter((v): v is { url: string; label: string } => v !== null);

  return (
    <GradientBackground>
      <KeyboardAvoidingView style={styles.scrollFlex} behavior={Platform.OS === "ios" ? "padding" : "height"} keyboardVerticalOffset={80}>
      <ScrollView
        ref={scrollRef}
        style={styles.scrollFlex}
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <ArtistHero artist={artist} c1={c1} c2={c2} initial={initial} />

        <View style={styles.body} onLayout={(e) => setBodyY(e.nativeEvent.layout.y)}>
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

          <View style={styles.statsRow}>
            {artist.yearsExperience ? <Stat label="YEARS" value={String(artist.yearsExperience)} /> : null}
            {artist.reviewCount ? <Stat label="REVIEWS" value={String(artist.reviewCount)} /> : null}
            <Stat label="TRAVEL" value={artist.travelAvailable ? "Yes" : "Local"} />
          </View>

          {/* Tabs — mirrors the website's About/Media/Packages/Reviews profile structure */}
          <View style={styles.tabBar}>
            {TABS.map((t) => (
              <Pressable
                key={t.key}
                onPress={() => setActiveTab(t.key)}
                style={[styles.tabPill, activeTab === t.key && styles.tabPillActive]}
              >
                <Text style={[styles.tabPillText, activeTab === t.key && styles.tabPillTextActive]}>{t.label}</Text>
              </Pressable>
            ))}
          </View>

          {activeTab === "about" ? (
            <AboutTab artist={artist} />
          ) : activeTab === "media" ? (
            <MediaTab videos={videos} c1={c1} c2={c2} />
          ) : activeTab === "repertoire" ? (
            <RepertoireTab repertoire={artist.repertoire ?? null} />
          ) : activeTab === "reviews" ? (
            <ReviewsTab reviews={artist.recentReviews ?? []} />
          ) : (
            <View onLayout={(e) => setPriceCardY(e.nativeEvent.layout.y)}>
            <GlassCard style={styles.priceCard}>
              <View style={styles.priceRow}>
                <View>
                  <Text style={styles.priceLabel}>{solo && duration != null ? `FOR ${effectiveDuration} MINS` : "STARTING AT"}</Text>
                  <Text style={styles.price}>{adjustedPrice ? `₹${adjustedPrice.toLocaleString("en-IN")}` : "On request"}</Text>
                </View>
                {artist.priceNegotiable ? (
                  <View style={styles.negotiableBadge}>
                    <Text style={styles.negotiableText}>Negotiable</Text>
                  </View>
                ) : null}
              </View>

              {solo ? (
                <View style={styles.durationRow}>
                  {DURATION_OPTIONS.map((d) => (
                    <Pressable
                      key={d}
                      onPress={() => setDuration(d)}
                      style={[styles.durationPill, effectiveDuration === d && styles.durationPillActive]}
                    >
                      <Text style={[styles.durationPillText, effectiveDuration === d && styles.durationPillTextActive]}>
                        {d === FULL_SHOW_MINUTES ? "Full Show" : `${d} min`}
                      </Text>
                      <Text style={[styles.durationPillSub, effectiveDuration === d && styles.durationPillTextActive]}>
                        {Math.round((DURATION_MULTIPLIERS[d] ?? 1) * 100)}% price
                      </Text>
                    </Pressable>
                  ))}
                </View>
              ) : null}

              {sent ? (
                <View style={styles.form}>
                  <View style={styles.sentBox}>
                    <Feather name="check-circle" size={18} color={colors.ok} />
                    <Text style={styles.sentText}>Enquiry sent — {name.split(" ")[0]} will respond soon.</Text>
                  </View>
                  {sentBookingId ? (
                    <Btn
                      label="View booking"
                      onPress={() => router.push({ pathname: "/booking/[id]", params: { id: sentBookingId } })}
                      style={styles.formButton}
                    />
                  ) : null}
                </View>
              ) : needsPhoneVerification ? (
                <View style={styles.form}>
                  <InlinePhoneVerification
                    onVerified={() => {
                      setNeedsPhoneVerification(false);
                      void handleSubmitEnquiry();
                    }}
                  />
                </View>
              ) : needsBookerProfile ? (
                <View style={styles.form}>
                  <Text style={styles.profileIntro}>One last step — tell us a bit about you and we&apos;ll send your enquiry.</Text>
                  <FormField label="FULL NAME" value={profileFullName} onChangeText={setProfileFullName} placeholder="Your name" />
                  <FormField label="EMAIL" value={profileEmail} onChangeText={setProfileEmail} placeholder="you@email.com" keyboardType="email-address" autoCapitalize="none" />
                  {profileEmail && !isValidEmail(profileEmail) ? <Text style={styles.emailError}>Enter a valid email address.</Text> : null}
                  <StateCityField city={profileCity} onChangeCity={setProfileCity} state={profileState} onChangeState={setProfileState} />
                  {profileError ? <Text style={styles.error}>{profileError}</Text> : null}
                  <Btn
                    label="Continue & Send Enquiry"
                    onPress={handleCompleteProfileAndSubmit}
                    disabled={!profileFullName || !isValidEmail(profileEmail) || !profileCity || !profileState}
                    loading={profileSubmitting || submitting}
                    style={styles.formButton}
                  />
                  <Pressable onPress={() => setNeedsBookerProfile(false)}>
                    <Text style={styles.profileBack}>Back</Text>
                  </Pressable>
                </View>
              ) : showForm ? (
                <View
                  style={styles.form}
                  onLayout={() => {
                    if (!pendingScrollRef.current) return;
                    pendingScrollRef.current = false;
                    scrollToPriceCard();
                  }}
                >
                  <View style={styles.modeToggle}>
                    <Pressable
                      style={[styles.modeTab, bookingMode === "QUICK_BOOKING" && styles.modeTabActive]}
                      onPress={() => setBookingMode("QUICK_BOOKING")}
                    >
                      <Text style={[styles.modeTabText, bookingMode === "QUICK_BOOKING" && styles.modeTabTextActive]}>
                        Book Now{adjustedPrice ? ` — ₹${adjustedPrice.toLocaleString("en-IN")}` : ""}
                      </Text>
                    </Pressable>
                    <Pressable
                      style={[styles.modeTab, bookingMode === "ENQUIRY" && styles.modeTabActive]}
                      onPress={() => setBookingMode("ENQUIRY")}
                    >
                      <Text style={[styles.modeTabText, bookingMode === "ENQUIRY" && styles.modeTabTextActive]}>Send My Offer</Text>
                    </Pressable>
                  </View>

                  <FormField label="EVENT TYPE" value={eventType} onChangeText={setEventType} placeholder="Wedding, Birthday, Corporate…" />
                  <StateCityField city={eventCity} onChangeCity={setEventCity} cityLabel="EVENT CITY" />
                  <DateField label="EVENT DATE" value={eventDate} onChange={setEventDate} />
                  {bookingMode === "ENQUIRY" ? (
                    <FormField
                      label="YOUR BUDGET (OPTIONAL)"
                      value={budgetAmount}
                      onChangeText={(v) => setBudgetAmount(v.replace(/[^0-9]/g, ""))}
                      placeholder={adjustedPrice ? `Artist's rate: ₹${adjustedPrice.toLocaleString("en-IN")}` : "e.g. 12000"}
                      keyboardType="number-pad"
                    />
                  ) : (
                    <Text style={styles.bookNowNote}>
                      You&apos;ll pay the listed price — ₹{adjustedPrice?.toLocaleString("en-IN") ?? "—"}
                      {solo ? ` for ${effectiveDuration} mins` : ""}.
                    </Text>
                  )}
                  {eventPlans.length > 0 ? (
                    <View style={styles.field}>
                      <Text style={styles.fieldLabel}>ATTACH TO AN EVENT (OPTIONAL)</Text>
                      <View style={styles.eventPlanChipRow}>
                        {eventPlans.map((p) => (
                          <Pressable
                            key={p.id}
                            onPress={() => setSelectedEventPlanId((cur) => (cur === p.id ? null : p.id))}
                            style={[styles.eventPlanChip, selectedEventPlanId === p.id && styles.eventPlanChipActive]}
                          >
                            <Text style={[styles.eventPlanChipText, selectedEventPlanId === p.id && styles.eventPlanChipTextActive]}>
                              {p.eventName}
                            </Text>
                          </Pressable>
                        ))}
                      </View>
                    </View>
                  ) : null}
                  <FormField label="NOTES (OPTIONAL)" value={specialRequests} onChangeText={setSpecialRequests} placeholder="Anything the artist should know" multiline />
                  <View style={styles.equipmentNote}>
                    <Feather name="info" size={14} color={colors.textMute} style={styles.equipmentNoteIcon} />
                    <Text style={styles.equipmentNoteText}>
                      This booking includes the artist/performance only — sound & equipment are not
                      included. You must arrange your own sound system, or you can inquire with us
                      about your sound requirements and we&apos;ll help arrange it.
                    </Text>
                  </View>
                  {formError ? <Text style={styles.error}>{formError}</Text> : null}
                  <Btn
                    label={bookingMode === "QUICK_BOOKING" ? "Book Now" : "Send Enquiry"}
                    onPress={handleSubmitEnquiry}
                    disabled={!eventType || !eventCity || !eventDate}
                    loading={submitting}
                    style={styles.formButton}
                  />
                </View>
              ) : (
                <Btn label="Enquire Now" onPress={() => setShowForm(true)} style={styles.formButton} />
              )}

              <View style={styles.escrow}>
                <Feather name="shield" size={16} color={colors.purple} />
                <Text style={styles.escrowText}>Payments are held securely until the event is confirmed done.</Text>
              </View>
            </GlassCard>

            <AvailabilityCalendar artistId={artist.id} />
            </View>
          )}

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

      {!sent ? (
        <View style={[styles.stickyBar, { paddingBottom: insets.bottom + spacing.sm }]}>
          <View style={styles.stickyPriceWrap}>
            <Text style={styles.stickyPriceLabel}>{solo ? "FROM" : "STARTING AT"}</Text>
            <Text style={styles.stickyPrice}>{adjustedPrice ? `₹${adjustedPrice.toLocaleString("en-IN")}` : "On request"}</Text>
          </View>
          <Pressable style={styles.stickyButtonWrap} onPress={handleStickyPress}>
            <LinearGradient colors={gradients.brand} locations={gradients.brandLocations} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0.3 }} style={styles.stickyButton}>
              <Text style={styles.stickyButtonText}>Enquire Now</Text>
            </LinearGradient>
          </Pressable>
        </View>
      ) : null}

      <PushPrimerSheet ref={pushSheetRef} onEnable={handlePushEnable} onNotNow={handlePushNotNow} onClosed={handlePushClosed} />
      <OffersOptInSheet ref={offersSheetRef} onAccept={handleOffersAccept} onDecline={handleOffersDecline} onClosed={handleOffersClosed} />
    </GradientBackground>
  );
}

// ─── About tab ──────────────────────────────────────────────────────────────

function AboutTab({ artist }: { artist: ArtistSummary }) {
  const highlights: { icon: keyof typeof Feather.glyphMap; title: string; desc: string }[] = [
    ...(artist.kycStatus === "APPROVED" ? [{ icon: "shield" as const, title: "Verified Artist", desc: "Identity & KYC verified" }] : []),
    { icon: "clock", title: "Fast Response", desc: "Usually replies within 2 hrs" },
    { icon: "award", title: "Professional", desc: `${artist.yearsExperience ?? 5}+ years experience` },
    { icon: "users", title: "All Events", desc: "Wedding, corporate & more" },
  ];

  return (
    <View style={styles.tabContent}>
      {artist.genres.length ? (
        <View style={styles.aboutBlock}>
          <Text style={styles.aboutBlockLabel}>GENRES</Text>
          <View style={styles.chipRow}>
            {artist.genres.map((g) => (
              <View key={g} style={styles.chip}><Text style={styles.chipText}>{g}</Text></View>
            ))}
          </View>
        </View>
      ) : null}

      {artist.eventTypes.length ? (
        <View style={styles.aboutBlock}>
          <Text style={styles.aboutBlockLabel}>AVAILABLE FOR</Text>
          <View style={styles.chipRow}>
            {artist.eventTypes.map((e) => (
              <View key={e} style={styles.chip}><Text style={styles.chipText}>{e}</Text></View>
            ))}
          </View>
        </View>
      ) : null}

      {artist.languages.length ? (
        <View style={styles.aboutBlock}>
          <Text style={styles.aboutBlockLabel}>LANGUAGES</Text>
          <View style={styles.row}>
            <Feather name="globe" size={14} color={colors.textMute} />
            <Text style={styles.loc}>{artist.languages.join(", ")}</Text>
          </View>
        </View>
      ) : null}

      <View style={styles.highlightsGrid}>
        {highlights.map((h) => (
          <View key={h.title} style={styles.highlightCard}>
            <Feather name={h.icon} size={16} color={colors.purple} />
            <Text style={styles.highlightTitle}>{h.title}</Text>
            <Text style={styles.highlightDesc}>{h.desc}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

// ─── Media tab ──────────────────────────────────────────────────────────────

function MediaTab({ videos, c1, c2 }: { videos: { url: string; label: string }[]; c1: string; c2: string }) {
  const [playingUrl, setPlayingUrl] = useState<string | null>(null);

  if (videos.length === 0) {
    return (
      <View style={styles.mediaEmpty}>
        <Feather name="video-off" size={22} color={colors.textMute} />
        <Text style={styles.mediaEmptyText}>No videos yet.</Text>
      </View>
    );
  }

  return (
    <View style={styles.tabContent}>
      <View style={styles.mediaGrid}>
        {videos.map((v) => {
          const thumb = cloudinaryThumb(v.url);
          return (
            <Pressable key={v.url} onPress={() => setPlayingUrl(v.url)} style={styles.mediaTile}>
              {thumb ? (
                <Image source={{ uri: thumb }} style={StyleSheet.absoluteFill} contentFit="cover" />
              ) : (
                <LinearGradient colors={[c1, c2]} style={StyleSheet.absoluteFill} />
              )}
              <View style={styles.mediaTileOverlay} pointerEvents="none">
                <View style={styles.mediaTilePlay}>
                  <Feather name="play" size={16} color="#fff" />
                </View>
              </View>
              <Text style={styles.mediaTileLabel}>{v.label}</Text>
            </Pressable>
          );
        })}
      </View>
      <VideoModal visible={playingUrl !== null} uri={playingUrl} onClose={() => setPlayingUrl(null)} />
    </View>
  );
}

// ─── Repertoire tab ─────────────────────────────────────────────────────────

// Mirrors the website's public Repertoire section — same data, same
// privacy rule (title/language/moodTag only, never lyrics/keys/notes;
// enforced server-side on the endpoint, not just here).
function RepertoireTab({ repertoire }: { repertoire: RepertoireData | null }) {
  if (!repertoire || repertoire.groups.length === 0) {
    return (
      <View style={styles.mediaEmpty}>
        <Feather name="music" size={22} color={colors.textMute} />
        <Text style={styles.mediaEmptyText}>No repertoire yet.</Text>
      </View>
    );
  }
  return (
    <View style={styles.tabContent}>
      <View style={styles.repertoireMetaRow}>
        <Text style={styles.repertoireMetaText}>
          {repertoire.totalSongs} song{repertoire.totalSongs === 1 ? "" : "s"}
        </Text>
        {repertoire.languages.length ? (
          <Text style={styles.repertoireMetaText}> · {repertoire.languages.join(", ")}</Text>
        ) : null}
      </View>
      {repertoire.groups.map((group) => (
        <View key={group.moodTag} style={styles.aboutBlock}>
          <Text style={styles.aboutBlockLabel}>{group.moodTag.toUpperCase()}</Text>
          <View style={styles.repertoireSongList}>
            {group.songs.map((song) => (
              <View key={song.id} style={styles.repertoireSongRow}>
                <Feather name="music" size={12} color={colors.textMute} />
                <Text style={styles.repertoireSongTitle}>{song.title}</Text>
              </View>
            ))}
          </View>
        </View>
      ))}
    </View>
  );
}

// ─── Reviews tab ────────────────────────────────────────────────────────────

function ReviewsTab({ reviews }: { reviews: NonNullable<ArtistSummary["recentReviews"]> }) {
  if (reviews.length === 0) {
    return (
      <View style={styles.mediaEmpty}>
        <Text style={styles.mediaEmptyEmoji}>⭐</Text>
        <Text style={styles.mediaEmptyText}>No reviews yet</Text>
        <Text style={styles.mediaEmptySub}>Reviews appear after a completed booking.</Text>
      </View>
    );
  }
  return (
    <View style={styles.tabContent}>
      <ReviewsList reviews={reviews} />
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

// ─── Hero ───────────────────────────────────────────────────────────────────

function ArtistHero({ artist, c1, c2, initial }: { artist: ArtistSummary; c1: string; c2: string; initial: string }) {
  const { muted, toggleMuted } = useVideoMute();
  const { isSaved, toggle } = useSavedArtists();
  const saved = isSaved(artist.id);
  const videoSource = artist.introVideoUrl ?? artist.showreelUrl ?? null;
  // Tapping the hero opens the shared full-screen VideoModal — the hero's
  // own ambient muted loop underneath is untouched by that (never paused,
  // never made to expand in place), so there's no in-place "playing" state
  // here anymore and nothing for the modal's close to hand back to.
  const [videoModalOpen, setVideoModalOpen] = useState(false);

  async function handleShare() {
    try {
      await Share.share({
        message: `Check out ${artist.stageName ?? "this artist"} on GiggiFi: https://giggifi.com/discover/artist/${artist.id}`,
        url: `https://giggifi.com/discover/artist/${artist.id}`,
      });
    } catch (err) {
      captureError(err, "artist-share");
    }
  }

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

  // This screen stays reachable via back-navigation without unmounting
  // immediately, so leaving it (e.g. to the enquiry flow, or back to Home)
  // would otherwise leave the hero video's audio playing underneath.
  //
  // The cleanup below is guarded with try/catch — this is the confirmed
  // root cause of the recurring "Something went wrong" crash on back
  // navigation from this screen: useVideoPlayer (via expo's
  // useReleasingSharedObject) registers its own release-on-unmount effect
  // BEFORE this useFocusEffect runs (it's declared earlier in this
  // component), and React fires effect cleanups in declaration order, not
  // reversed — so on a real unmount (not just a blur), the player's native
  // object is already released by the time this cleanup calls
  // player.pause(). expo-modules-core's SharedObject.release() explicitly
  // documents that any further native call after release throws
  // synchronously. That synchronous throw during the unmount commit is
  // exactly what the ErrorBoundary was catching — a different bug than the
  // async setState-after-unmount pattern fixed elsewhere on this screen,
  // which is why patching that one didn't stop this crash.
  useFocusEffect(
    useCallback(() => {
      if (videoSource) {
        player.muted = muted;
        player.play();
      }
      return () => {
        try {
          player.pause();
        } catch {
          // Expected when the screen is truly unmounting, not just
          // blurring — see comment above.
        }
      };
    }, [videoSource, muted, player]),
  );

  function handleHeroPress() {
    if (!videoSource) return;
    setVideoModalOpen(true);
  }

  return (
    <View style={styles.hero} pointerEvents="box-none">
      {videoSource ? (
        <Pressable style={StyleSheet.absoluteFill} onPress={handleHeroPress}>
          {/* surfaceType="textureView" — see video-feed.tsx's VideoFeedCard
              for the full explanation: Android's default SurfaceView
              rendering can swallow taps meant for this Pressable even with
              pointerEvents="none" set, since it composites through a
              separate native window outside RN's normal view hierarchy. */}
          <VideoView
            player={player}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            nativeControls={false}
            pointerEvents="none"
            surfaceType="textureView"
          />
          <View style={styles.heroPlayHint} pointerEvents="none">
            <Feather name="play" size={18} color="#fff" />
          </View>
        </Pressable>
      ) : artist.profileImageUrl ? (
        <Image source={{ uri: artist.profileImageUrl }} style={StyleSheet.absoluteFill} contentFit="cover" />
      ) : (
        <LinearGradient colors={[c1, c2]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill}>
          <Text style={styles.heroInitial}>{initial}</Text>
        </LinearGradient>
      )}

      <View style={styles.heroActions}>
        <Pressable
          onPress={() => toggle(artist.id)}
          style={styles.heroActionButton}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={saved ? "Remove from saved" : "Save artist"}
        >
          <Feather name="heart" size={16} color={saved ? colors.pink : "#fff"} />
        </Pressable>
        <Pressable
          onPress={handleShare}
          style={styles.heroActionButton}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Share artist"
        >
          <Feather name="share-2" size={16} color="#fff" />
        </Pressable>
      </View>

      {videoSource ? (
        <Pressable
          onPress={toggleMuted}
          style={styles.heroMuteButton}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={muted ? "Unmute video" : "Mute video"}
        >
          <Feather name={muted ? "volume-x" : "volume-2"} size={15} color="#fff" />
        </Pressable>
      ) : null}

      <VideoModal visible={videoModalOpen} uri={videoSource} onClose={() => setVideoModalOpen(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.md, paddingHorizontal: spacing.xl },
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
  heroPlayHint: {
    position: "absolute",
    top: "50%",
    left: "50%",
    marginTop: -22,
    marginLeft: -22,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(0,0,0,0.35)",
    alignItems: "center",
    justifyContent: "center",
  },
  heroActions: {
    position: "absolute",
    top: spacing.md,
    left: spacing.md,
    flexDirection: "row",
    gap: 8,
  },
  heroActionButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center",
    justifyContent: "center",
  },
  stickyBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    backgroundColor: colors.ink,
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  stickyPriceWrap: { flex: 1 },
  stickyPriceLabel: { fontFamily: fonts.mono, fontSize: 9, color: colors.textMute, letterSpacing: 0.5 },
  stickyPrice: { fontFamily: fonts.display, fontSize: 19, color: colors.text },
  stickyButtonWrap: { flexShrink: 0 },
  stickyButton: { paddingHorizontal: 24, paddingVertical: 13, borderRadius: radii.lg, alignItems: "center", justifyContent: "center" },
  stickyButtonText: { fontFamily: fonts.bodySemiBold, fontSize: 14, color: "#fff" },
  skeletonTagline: { marginBottom: spacing.sm },
  skeletonName: { marginBottom: spacing.sm },
  skeletonLoc: { marginBottom: spacing.lg },
  skeletonPriceCard: { marginTop: spacing.md },
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
  tabBar: {
    flexDirection: "row",
    gap: 4,
    padding: 4,
    borderRadius: radii.lg,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: colors.line,
    marginBottom: spacing.lg,
  },
  tabPill: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: radii.md,
    alignItems: "center",
  },
  tabPillActive: { backgroundColor: colors.pink },
  tabPillText: { fontFamily: fonts.bodyMedium, fontSize: 12.5, color: colors.textMute },
  tabPillTextActive: { color: "#fff", fontFamily: fonts.bodySemiBold },
  tabContent: { marginBottom: spacing.lg },
  aboutBlock: { marginBottom: spacing.lg },
  aboutBlockLabel: { fontFamily: fonts.mono, fontSize: 10, color: colors.textMute, letterSpacing: 0.5, marginBottom: spacing.xs },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
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
  eventPlanChipRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  eventPlanChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.ink2,
  },
  eventPlanChipActive: { borderColor: colors.pink, backgroundColor: "rgba(236,72,153,0.08)" },
  eventPlanChipText: { fontFamily: fonts.bodyMedium, fontSize: 12, color: colors.textDim },
  eventPlanChipTextActive: { color: colors.text, fontFamily: fonts.bodySemiBold },
  highlightsGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  highlightCard: {
    width: "47%",
    padding: spacing.sm,
    borderRadius: radii.md,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: colors.line,
    gap: 3,
  },
  highlightTitle: { fontFamily: fonts.bodySemiBold, fontSize: 13, color: colors.text },
  highlightDesc: { fontFamily: fonts.body, fontSize: 11, color: colors.textMute },
  mediaGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  mediaTile: {
    width: "48%",
    aspectRatio: 9 / 16,
    borderRadius: radii.lg,
    overflow: "hidden",
    backgroundColor: colors.ink2,
    borderWidth: 1,
    borderColor: colors.line,
    position: "relative",
  },
  mediaTileOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.25)",
    alignItems: "center",
    justifyContent: "center",
  },
  mediaTilePlay: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  mediaTileLabel: {
    position: "absolute",
    bottom: 8,
    left: 10,
    fontFamily: fonts.bodyMedium,
    fontSize: 11,
    color: "#fff",
  },
  mediaEmpty: {
    alignItems: "center",
    gap: spacing.xs,
    paddingVertical: spacing.xl,
    marginBottom: spacing.lg,
    borderRadius: radii.xl,
    backgroundColor: "rgba(255,255,255,0.03)",
    borderWidth: 1,
    borderColor: colors.line,
  },
  mediaEmptyEmoji: { fontSize: 26, marginBottom: 2 },
  mediaEmptyText: { fontFamily: fonts.bodySemiBold, fontSize: 13.5, color: colors.textDim },
  mediaEmptySub: { fontFamily: fonts.body, fontSize: 12, color: colors.textMute },
  repertoireMetaRow: { flexDirection: "row", marginBottom: spacing.md },
  repertoireMetaText: { fontFamily: fonts.mono, fontSize: 11, color: colors.textMute },
  repertoireSongList: { gap: 6 },
  repertoireSongRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  repertoireSongTitle: { fontFamily: fonts.body, fontSize: 13.5, color: colors.textDim, flexShrink: 1 },
  priceCard: { gap: spacing.md, marginBottom: spacing.sm },
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
  durationRow: { flexDirection: "row", gap: spacing.sm },
  durationPill: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 10,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.ink2,
  },
  durationPillActive: { borderColor: colors.pink, backgroundColor: "rgba(236,72,153,0.08)" },
  durationPillText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    color: colors.textDim,
  },
  durationPillSub: {
    fontFamily: fonts.mono,
    fontSize: 10,
    color: colors.textMute,
    marginTop: 2,
  },
  durationPillTextActive: { color: colors.text, fontFamily: fonts.bodySemiBold },
  modeToggle: {
    flexDirection: "row",
    padding: 4,
    borderRadius: radii.pill,
    backgroundColor: colors.ink2,
    borderWidth: 1,
    borderColor: colors.line,
  },
  modeTab: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: radii.pill,
    alignItems: "center",
  },
  modeTabActive: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.lineStrong,
  },
  modeTabText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    color: colors.textMute,
  },
  modeTabTextActive: { color: colors.text, fontFamily: fonts.bodySemiBold },
  bookNowNote: {
    fontFamily: fonts.body,
    fontSize: 12.5,
    lineHeight: 18,
    color: colors.textDim,
  },
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
  emailError: { fontFamily: fonts.body, fontSize: 12, color: colors.err, marginTop: -6 },
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
  equipmentNote: {
    flexDirection: "row", gap: 8, alignItems: "flex-start",
    backgroundColor: colors.ink2, borderWidth: 1, borderColor: colors.line, borderRadius: radii.sm,
    padding: 12,
  },
  equipmentNoteIcon: { marginTop: 2 },
  equipmentNoteText: { flex: 1, fontFamily: fonts.body, fontSize: 12, lineHeight: 17, color: colors.textMute },
  qmCard: { marginTop: spacing.sm, gap: spacing.sm },
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
  muted: { fontFamily: fonts.body, fontSize: 14, color: colors.textMute, textAlign: "center" },
  retryButton: {
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
});
