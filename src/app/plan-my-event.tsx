import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useVideoPlayer, VideoView } from "expo-video";
import * as Location from "expo-location";
import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import { GradientBackground } from "@/components/GradientBackground";
import { GradientButton } from "@/components/GradientButton";
import { GlassCard } from "@/components/GlassCard";
import { DateField } from "@/components/DateField";
import { TimeField } from "@/components/TimeField";
import { PlacesAutocompleteField } from "@/components/PlacesAutocompleteField";
import {
  ApiError,
  matchQuickBooking,
  saveBookerProfile,
  sendEnquiry,
  type MatchedArtist,
  type PlaceDetails,
} from "@/lib/api";
import { isValidEmail, maskName } from "@/lib/format";
import { useAuth } from "@/lib/auth-context";
import { captureError } from "@/lib/telemetry";
import { DURATION_MULTIPLIERS, FULL_SHOW_MINUTES, getDurationAdjustedPrice, isSoloPerformerType } from "@/lib/duration-pricing";
import { colors, fonts, gradients, radii, spacing } from "@/theme";

const ARTIST_TYPES = [
  { label: "Singer", emoji: "🎤" },
  { label: "DJ", emoji: "🎧" },
  { label: "Band", emoji: "🎸" },
  { label: "Anchor", emoji: "🎙️" },
  { label: "Comedian", emoji: "🎭" },
  { label: "Instrumentalist", emoji: "🎻" },
  { label: "Magician", emoji: "🎩" },
  { label: "Dancer", emoji: "💃" },
  { label: "Celebrity", emoji: "⭐" },
  { label: "Not Sure", emoji: "🤔" },
];

const GENDER_OPTIONS = ["No preference", "Male", "Female"];

const BUDGETS = [
  { label: "Under ₹25K", key: "under-25k", display: "Under ₹25,000" },
  { label: "₹25K – ₹50K", key: "25k-50k", display: "₹25,000 – ₹50,000" },
  { label: "₹50K – ₹1L", key: "50k-1l", display: "₹50,000 – ₹1,00,000" },
  { label: "₹1L – ₹3L", key: "1l-3l", display: "₹1,00,000 – ₹3,00,000" },
  { label: "₹3L+", key: "3l-plus", display: "₹3,00,000 and above" },
] as const;

const BUDGET_BOUNDS: Record<string, { min: number; max?: number }> = {
  "under-25k": { min: 0, max: 25_000 },
  "25k-50k": { min: 25_000, max: 50_000 },
  "50k-1l": { min: 50_000, max: 100_000 },
  "1l-3l": { min: 100_000, max: 300_000 },
  "3l-plus": { min: 300_000 },
};

const EVENT_TYPES = [
  "Wedding", "Birthday Party", "Corporate Event", "Sangeet / Mehendi",
  "Concert", "Festival", "College Fest", "Product Launch",
  "Anniversary", "Private Party", "Other",
];

const LANGUAGES = ["Hindi", "English", "Marathi", "Punjabi", "Gujarati", "Tamil", "Telugu", "Bengali"];

const OUTER_PHASES = ["Artist Selection", "Event Details", "Review & Pay"];

function formatPrice(rate: number | null) {
  return rate ? `₹${rate.toLocaleString("en-IN")}` : "Custom Quote";
}

function formatHourString(hour: number): string {
  return `${hour.toString().padStart(2, "0")}:00`;
}

// ─── Shared step chrome ─────────────────────────────────────────────────────

function WizardStepper({ outerStep }: { outerStep: number }) {
  return (
    <View style={styles.stepperRow}>
      {OUTER_PHASES.map((label, i) => (
        <View key={label} style={styles.stepperItemWrap}>
          <View style={styles.stepperItem}>
            <View style={[styles.stepperDot, i < outerStep ? styles.stepperDotDone : i === outerStep ? styles.stepperDotActive : null]}>
              {i < outerStep ? <Feather name="check" size={14} color="#fff" /> : <Text style={styles.stepperDotText}>{i + 1}</Text>}
            </View>
            <Text style={[styles.stepperLabel, i === outerStep && styles.stepperLabelActive]} numberOfLines={1}>{label}</Text>
          </View>
          {i < OUTER_PHASES.length - 1 ? <View style={[styles.stepperLine, i < outerStep && styles.stepperLineDone]} /> : null}
        </View>
      ))}
    </View>
  );
}

function WizardChip({ label, emoji, selected, onPress }: { label: string; emoji?: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, selected && styles.chipSelected]}>
      {emoji ? <Text style={styles.chipEmoji}>{emoji}</Text> : null}
      <Text style={[styles.chipLabel, selected && styles.chipLabelSelected]}>{label}</Text>
      {selected ? <Feather name="check-circle" size={16} color={colors.purple} /> : null}
    </Pressable>
  );
}

function DurationOrb({ label, sub, selected, onPress }: { label: string; sub: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.orb, selected && styles.orbSelected]}>
      <Text style={styles.orbLabel}>{label}</Text>
      <Text style={[styles.orbSub, selected && styles.orbSubSelected]}>{sub}</Text>
    </Pressable>
  );
}

// ─── Result card ────────────────────────────────────────────────────────────

function ResultCard({ artist, selected, artistType, duration, onPress }: { artist: MatchedArtist; selected: boolean; artistType: string; duration: number; onPress: () => void }) {
  const name = maskName(artist.fullName || artist.stageName) || "Artist";
  const price = getDurationAdjustedPrice(artist.ratePerEvent, artistType, duration);
  const budgetColor =
    artist.budgetLabel === "Great Value · Fits your budget" ? colors.ok :
    artist.budgetLabel === "Fits your budget" ? "#60a5fa" : colors.purple;

  return (
    <Pressable onPress={onPress} style={[styles.card, selected && styles.cardSelected]}>
      {artist.profileImageUrl ? (
        <Image source={{ uri: artist.profileImageUrl }} style={StyleSheet.absoluteFill} contentFit="cover" />
      ) : (
        <LinearGradient colors={[colors.purple, colors.magenta]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill}>
          <Text style={styles.cardInitial}>{name[0]}</Text>
        </LinearGradient>
      )}
      <LinearGradient colors={["transparent", "rgba(7,3,13,0.55)", "rgba(7,3,13,0.95)"]} locations={[0, 0.4, 1]} style={StyleSheet.absoluteFill} />

      {artist.introVideoUrl ? (
        <View style={styles.cardPlayHint}>
          <Feather name="play" size={14} color="#fff" />
        </View>
      ) : null}

      <View style={styles.cardTopRow}>
        {artist.kycStatus === "APPROVED" ? (
          <View style={styles.verifiedBadge}><Text style={styles.verifiedText}>✓ Verified</Text></View>
        ) : <View />}
        {selected ? (
          <View style={styles.cardCheck}><Feather name="check" size={13} color="#fff" /></View>
        ) : null}
      </View>

      <View style={styles.cardBottom}>
        <Text style={styles.cardName} numberOfLines={1}>{name}</Text>
        <Text style={styles.cardMeta} numberOfLines={1}>{[artist.performerType, artist.city].filter(Boolean).join(" · ")}</Text>
        <View style={[styles.cardPriceBadge, { backgroundColor: `${budgetColor}22`, borderColor: `${budgetColor}44` }]}>
          <Text style={[styles.cardPriceText, { color: budgetColor }]}>{formatPrice(price)}{artist.priceNegotiable ? " · Negotiable" : ""}</Text>
        </View>
      </View>
    </Pressable>
  );
}

// ─── Preview modal — listen before choosing ────────────────────────────────

function PreviewVideo({ videoUrl }: { videoUrl: string }) {
  const player = useVideoPlayer(videoUrl, (instance) => {
    instance.loop = true;
    instance.play();
  });
  return <VideoView player={player} style={StyleSheet.absoluteFill} contentFit="cover" nativeControls />;
}

function PreviewModal({
  artist, isSelected, artistType, duration, onClose, onChoose,
}: {
  artist: MatchedArtist; isSelected: boolean; artistType: string; duration: number; onClose: () => void; onChoose: () => void;
}) {
  const name = maskName(artist.fullName || artist.stageName) || "Artist";
  const price = getDurationAdjustedPrice(artist.ratePerEvent, artistType, duration);
  const budgetColor =
    artist.budgetLabel === "Great Value · Fits your budget" ? colors.ok :
    artist.budgetLabel === "Fits your budget" ? "#60a5fa" : colors.purple;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.modalBackdrop} onPress={onClose}>
        <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
          <ScrollView showsVerticalScrollIndicator={false}>
            <View style={styles.modalHero}>
              {artist.introVideoUrl ? (
                <PreviewVideo videoUrl={artist.introVideoUrl} />
              ) : artist.profileImageUrl ? (
                <Image source={{ uri: artist.profileImageUrl }} style={StyleSheet.absoluteFill} contentFit="cover" />
              ) : (
                <LinearGradient colors={[colors.purple, colors.magenta]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill}>
                  <Text style={styles.modalInitial}>{name[0]}</Text>
                </LinearGradient>
              )}
              <Pressable
                onPress={onClose}
                style={styles.modalCloseButton}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Close"
              >
                <Feather name="x" size={16} color="#fff" />
              </Pressable>
            </View>

            <View style={styles.modalBody}>
              <View style={styles.modalNameRow}>
                <Text style={styles.modalName}>{name}</Text>
                {artist.kycStatus === "APPROVED" ? (
                  <View style={styles.verifiedBadge}><Text style={styles.verifiedText}>✓ Verified</Text></View>
                ) : null}
              </View>
              <Text style={styles.modalMeta}>{[artist.performerType, artist.city].filter(Boolean).join(" · ")}</Text>

              {artist.bio ? <Text style={styles.modalBio}>{artist.bio}</Text> : null}

              <View style={[styles.modalPriceBlock, { backgroundColor: `${budgetColor}14`, borderColor: `${budgetColor}35` }]}>
                <View>
                  <Text style={styles.modalPriceLabel}>{duration && duration !== FULL_SHOW_MINUTES ? `FOR ${duration} MINS` : "FULL SHOW"}</Text>
                  <Text style={styles.modalPrice}>{formatPrice(price)}</Text>
                </View>
                {artist.priceNegotiable ? (
                  <View style={[styles.negotiablePill, { backgroundColor: `${budgetColor}22` }]}>
                    <Text style={[styles.negotiablePillText, { color: budgetColor }]}>Negotiable</Text>
                  </View>
                ) : null}
              </View>

              <View style={styles.modalActions}>
                <Pressable style={styles.modalBackButton} onPress={onClose}>
                  <Text style={styles.modalBackText}>Back to results</Text>
                </Pressable>
                <Pressable style={styles.modalChooseWrap} onPress={onChoose}>
                  <LinearGradient colors={gradients.brand} locations={gradients.brandLocations} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.modalChooseButton}>
                    <Text style={styles.modalChooseText}>{isSelected ? "Selected ✓" : "Choose Artist"}</Text>
                  </LinearGradient>
                </Pressable>
              </View>
            </View>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ─── Main screen ────────────────────────────────────────────────────────────

export default function PlanMyEventScreen() {
  const { user, refreshSession } = useAuth();

  const [outerStep, setOuterStep] = useState(0);
  const [innerStep, setInnerStep] = useState(0);

  // Artist Selection
  const [artistType, setArtistType] = useState("");
  const [genderPref, setGenderPref] = useState("No preference");
  const [duration, setDuration] = useState(0);
  const [city, setCity] = useState("");
  const [budgetKey, setBudgetKey] = useState("");
  const [loadingMatches, setLoadingMatches] = useState(false);
  const [artists, setArtists] = useState<MatchedArtist[] | null>(null);
  const [genderRelaxed, setGenderRelaxed] = useState(false);
  const [selectedArtist, setSelectedArtist] = useState<MatchedArtist | null>(null);
  const [previewArtist, setPreviewArtist] = useState<MatchedArtist | null>(null);

  // Event Details
  const [eventType, setEventType] = useState("");
  const [eventDate, setEventDate] = useState<Date | null>(null);
  const [eventHour, setEventHour] = useState(18);
  const [languages, setLanguages] = useState<string[]>([]);
  const [venueName, setVenueName] = useState("");
  const [venueAddress, setVenueAddress] = useState("");
  const [notes, setNotes] = useState("");

  // Review & Pay
  const [bookingMode, setBookingMode] = useState<"ENQUIRY" | "QUICK_BOOKING">("ENQUIRY");
  const [myOffer, setMyOffer] = useState("");
  const [needsBookerProfile, setNeedsBookerProfile] = useState(false);
  const [profileFullName, setProfileFullName] = useState("");
  const [profileEmail, setProfileEmail] = useState("");
  const [profileCity, setProfileCity] = useState("");
  const [profileState, setProfileState] = useState("");
  const [profileSubmitting, setProfileSubmitting] = useState(false);
  const [profileError, setProfileError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [doneBookingId, setDoneBookingId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const geoRequested = useRef(false);
  const budget = BUDGETS.find((b) => b.key === budgetKey);

  // Silent city auto-detect — no dedicated city step, just background context
  // to make matching meaningful, same behavior as the website's wizard.
  useEffect(() => {
    if (geoRequested.current) return;
    geoRequested.current = true;
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") return;
        const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
        const [address] = await Location.reverseGeocodeAsync({ latitude: position.coords.latitude, longitude: position.coords.longitude });
        const detected = address?.city ?? address?.subregion ?? address?.region ?? "";
        if (detected) setCity((c) => c || detected);
      } catch (err) {
        captureError(err, "plan-my-event-geolocation");
      }
    })();
  }, []);

  // Non-solo categories skip the duration choice entirely — always full show.
  useEffect(() => {
    if (artistType && !isSoloPerformerType(artistType)) {
      setDuration(FULL_SHOW_MINUTES);
    }
  }, [artistType]);

  async function findArtists() {
    setLoadingMatches(true);
    try {
      const data = await matchQuickBooking({
        artistType,
        city: city || undefined,
        budgetKey: budgetKey as "under-25k" | "25k-50k" | "50k-1l" | "1l-3l" | "3l-plus",
        gender: genderPref !== "No preference" ? (genderPref as "Male" | "Female") : undefined,
      });
      setArtists(data.artists ?? []);
      setGenderRelaxed(Boolean(data.genderRelaxed));
    } catch (err) {
      captureError(err, "plan-my-event-match");
      setArtists([]);
    } finally {
      setLoadingMatches(false);
    }
  }

  const canInnerNext = [!!artistType, true, duration > 0, !!budgetKey][innerStep];

  function handleInnerNext() {
    if (innerStep === 3) void findArtists();
    setInnerStep((s) => s + 1);
  }

  function selectArtist(a: MatchedArtist) {
    setSelectedArtist(a);
    setOuterStep(1);
  }

  function toggleLanguage(lang: string) {
    setLanguages((current) => (current.includes(lang) ? current.filter((l) => l !== lang) : [...current, lang]));
  }

  const canEventDetailsNext = !!eventType && !!eventDate && venueAddress.trim().length > 0;

  const offerAmount = myOffer.trim() ? parseInt(myOffer.trim(), 10) : null;
  const offerValid = offerAmount !== null && !isNaN(offerAmount) && offerAmount >= 500;

  const selectedArtistName = selectedArtist ? (maskName(selectedArtist.fullName || selectedArtist.stageName) || "Artist") : "";
  const adjustedPrice = selectedArtist ? getDurationAdjustedPrice(selectedArtist.ratePerEvent, artistType, duration) : null;

  async function submitBooking() {
    if (!selectedArtist) return;
    setSubmitting(true);
    setError("");
    try {
      const bounds = BUDGET_BOUNDS[budgetKey];
      const genderNote = genderPref !== "No preference" ? `Preferred artist gender: ${genderPref}. ` : "";
      const isQuickBooking = bookingMode === "QUICK_BOOKING";

      const data = await sendEnquiry({
        artistId: selectedArtist.id,
        eventName: `${eventType} — ${user?.name?.trim() || "Client"}`,
        eventType,
        eventDate: eventDate ? eventDate.toISOString() : undefined,
        eventStartTime: formatHourString(eventHour),
        eventCity: city.trim() || (venueAddress ? venueAddress : ""),
        duration,
        mode: bookingMode,
        quotedPrice: isQuickBooking ? adjustedPrice ?? undefined : undefined,
        budgetAmount: isQuickBooking ? undefined : (offerValid ? offerAmount! : bounds?.max ?? bounds?.min),
        specialRequests: (genderNote + notes.trim()).trim() || undefined,
        venueName: venueName.trim() || undefined,
        venueAddress: venueAddress.trim() || undefined,
        languagePref: languages,
      });
      setDoneBookingId(data.bookingId ?? null);
      setDone(true);
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        setProfileCity((prev) => prev || city);
        setNeedsBookerProfile(true);
      } else {
        setError(err instanceof ApiError ? err.message : "Could not send your request. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCompleteProfileAndSubmit() {
    if (!profileFullName || !isValidEmail(profileEmail) || !profileCity || !profileState) return;
    setProfileSubmitting(true);
    setProfileError("");
    try {
      await saveBookerProfile({ fullName: profileFullName, email: profileEmail, city: profileCity, state: profileState });
      await refreshSession();
      setNeedsBookerProfile(false);
      await submitBooking();
    } catch (err) {
      setProfileError(err instanceof ApiError ? err.message : "Could not save your details. Please try again.");
    } finally {
      setProfileSubmitting(false);
    }
  }

  function handleBack() {
    if (outerStep === 0) {
      if (innerStep === 4) { setArtists(null); setInnerStep(3); return; }
      if (innerStep > 0) { setInnerStep((s) => s - 1); return; }
      router.back();
      return;
    }
    if (outerStep === 1) { setOuterStep(0); setInnerStep(4); return; }
    setOuterStep(1);
  }

  function handlePlaceSelect(place: PlaceDetails) {
    setVenueName(place.name || place.address);
    setVenueAddress(place.address);
    if (place.city) setCity(place.city);
  }

  // ── Success screen ──
  if (done) {
    return (
      <GradientBackground>
        <SafeAreaView style={styles.doneSafe}>
          <View style={styles.doneCheck}><Feather name="check" size={30} color="#fff" /></View>
          <Text style={styles.doneTitle}>{bookingMode === "QUICK_BOOKING" ? "Booking Confirmed!" : "Enquiry Sent!"}</Text>
          <Text style={styles.doneSub}>
            {bookingMode === "QUICK_BOOKING"
              ? `You're set at ${formatPrice(adjustedPrice)} — complete payment to lock in ${selectedArtistName}.`
              : `${selectedArtistName} will review your offer and respond. You'll only be asked to pay once they accept.`}
          </Text>

          <GlassCard style={styles.doneSummaryCard}>
            <Text style={styles.doneSummaryTitle}>{bookingMode === "QUICK_BOOKING" ? "Your Booking" : "Your Enquiry"} Summary</Text>
            {[
              ["Artist", selectedArtistName],
              ["Event", eventType],
              ["City", city],
              bookingMode === "QUICK_BOOKING" ? ["Price", formatPrice(adjustedPrice)] : ["Your Offer", offerValid ? `₹${offerAmount!.toLocaleString("en-IN")}` : (budget?.display ?? "")],
            ].map(([l, v]) => (
              <View key={l} style={styles.doneSummaryRow}>
                <Text style={styles.doneSummaryLabel}>{l}</Text>
                <Text style={styles.doneSummaryValue}>{v}</Text>
              </View>
            ))}
          </GlassCard>

          <View style={styles.doneActions}>
            {bookingMode === "QUICK_BOOKING" && doneBookingId ? (
              <Pressable onPress={() => router.replace({ pathname: "/booking/[id]", params: { id: doneBookingId } })} style={styles.doneCtaWrap}>
                <LinearGradient colors={gradients.brand} locations={gradients.brandLocations} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.doneCta}>
                  <Text style={styles.doneCtaText}>Complete Payment →</Text>
                </LinearGradient>
              </Pressable>
            ) : (
              <Pressable onPress={() => router.replace("/(tabs)/bookings")} style={styles.doneCtaWrap}>
                <LinearGradient colors={gradients.brand} locations={gradients.brandLocations} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.doneCta}>
                  <Text style={styles.doneCtaText}>Track My Enquiry →</Text>
                </LinearGradient>
              </Pressable>
            )}
            <Pressable onPress={() => router.replace("/(tabs)/browse")} style={styles.doneSecondaryButton}>
              <Text style={styles.doneSecondaryText}>Browse Artists</Text>
            </Pressable>
          </View>
        </SafeAreaView>
      </GradientBackground>
    );
  }

  const nextDisabled =
    outerStep === 0 ? (innerStep < 4 ? !canInnerNext : true) :
    outerStep === 1 ? !canEventDetailsNext :
    submitting;

  const footerLabel =
    outerStep === 0 && innerStep === 3 ? "Find Artists →" :
    outerStep === 2 ? (submitting ? (bookingMode === "QUICK_BOOKING" ? "Booking…" : "Sending…") : bookingMode === "QUICK_BOOKING" ? `Book Now — ${formatPrice(adjustedPrice)}` : "Send My Offer") :
    "Continue →";

  function handleFooterPress() {
    if (outerStep === 0) { handleInnerNext(); return; }
    if (outerStep === 1) { setOuterStep(2); return; }
    void submitBooking();
  }

  return (
    <GradientBackground>
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <View style={styles.header}>
          <Pressable
            onPress={handleBack}
            style={styles.backButton}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <Feather name="arrow-left" size={16} color={colors.textDim} />
          </Pressable>
          <View style={styles.headerTextWrap}>
            <Text style={styles.headerTitle}>Book the Perfect Artist</Text>
            <Text style={styles.headerSub}>Real artists, real prices, shown before you commit.</Text>
          </View>
        </View>
        <WizardStepper outerStep={outerStep} />

        <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={80}>
          <ScrollView style={styles.flex} contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

            {/* Artist Selection */}
            {outerStep === 0 && innerStep === 0 ? (
              <View>
                <Text style={styles.stepTitle}>What type of artist?</Text>
                <Text style={styles.stepSub}>Select the type of artist you need for your event.</Text>
                <View style={styles.chipGrid}>
                  {ARTIST_TYPES.map(({ label, emoji }) => (
                    <View key={label} style={styles.chipGridItem}>
                      <WizardChip label={label} emoji={emoji} selected={artistType === label} onPress={() => setArtistType(label)} />
                    </View>
                  ))}
                </View>
              </View>
            ) : null}

            {outerStep === 0 && innerStep === 1 ? (
              <View>
                <Text style={styles.stepTitle}>Artist preference</Text>
                <Text style={styles.stepSub}>Optional — we&apos;ll match you regardless if you have no preference.</Text>
                <View style={styles.chipColumn}>
                  {GENDER_OPTIONS.map((g) => (
                    <WizardChip key={g} label={g} selected={genderPref === g} onPress={() => setGenderPref(g)} />
                  ))}
                </View>
              </View>
            ) : null}

            {outerStep === 0 && innerStep === 2 ? (
              <View>
                {isSoloPerformerType(artistType) ? (
                  <>
                    <Text style={styles.stepTitle}>How long do you need them?</Text>
                    <Text style={styles.stepSub}>Shorter sets cost less — pick what fits your event.</Text>
                    <View style={styles.orbRow}>
                      <DurationOrb label="60 mins" sub={`${Math.round((DURATION_MULTIPLIERS[60] ?? 1) * 100)}% of price`} selected={duration === 60} onPress={() => setDuration(60)} />
                      <DurationOrb label="120 mins" sub={`${Math.round((DURATION_MULTIPLIERS[120] ?? 1) * 100)}% of price`} selected={duration === 120} onPress={() => setDuration(120)} />
                      <DurationOrb label="Full Show" sub={`${FULL_SHOW_MINUTES} mins · Full price`} selected={duration === FULL_SHOW_MINUTES} onPress={() => setDuration(FULL_SHOW_MINUTES)} />
                    </View>
                  </>
                ) : (
                  <>
                    <Text style={styles.stepTitle}>Full performance booking</Text>
                    <Text style={styles.stepSub}>
                      {artistType || "This act"} is booked for the complete show ({FULL_SHOW_MINUTES} mins) — the full group performs regardless of set length, so there&apos;s no shorter option here.
                    </Text>
                    <View style={styles.infoCard}>
                      <Text style={styles.infoCardTitle}>Full Show</Text>
                      <Text style={styles.infoCardSub}>{FULL_SHOW_MINUTES} minutes · Full price</Text>
                    </View>
                  </>
                )}
              </View>
            ) : null}

            {outerStep === 0 && innerStep === 3 ? (
              <View>
                <Text style={styles.stepTitle}>What&apos;s your budget?</Text>
                <Text style={styles.stepSub}>A rough range to start with — you&apos;ll see each artist&apos;s real price next.</Text>
                <View style={styles.chipColumn}>
                  {BUDGETS.map((b) => (
                    <WizardChip key={b.key} label={b.label} selected={budgetKey === b.key} onPress={() => setBudgetKey(b.key)} />
                  ))}
                </View>
              </View>
            ) : null}

            {outerStep === 0 && innerStep === 4 ? (
              <View>
                {loadingMatches ? (
                  <View style={styles.loadingBlock}>
                    <ActivityIndicator color={colors.purple} size="large" />
                    <Text style={styles.loadingText}>Finding the best artists for you…</Text>
                  </View>
                ) : (
                  <>
                    <Text style={styles.stepTitle}>{artists && artists.length > 0 ? `${artists.length} Artist${artists.length !== 1 ? "s" : ""} Found` : "No Artists Found"}</Text>
                    <Text style={styles.stepSubTight}>Real profiles, real videos — tap one to preview, then lock it in for your enquiry.</Text>
                    {city ? <Text style={styles.cityNote}>📍 Showing artists near {city}</Text> : null}
                    {genderRelaxed ? (
                      <Text style={styles.relaxedNote}>No {genderPref.toLowerCase()} artists have confirmed their profile yet — showing everyone who matches your other criteria instead.</Text>
                    ) : null}

                    {artists && artists.length === 0 ? (
                      <View style={styles.emptyBlock}>
                        <Text style={styles.emptyEmoji}>🎭</Text>
                        <Text style={styles.emptyTitle}>No artists found</Text>
                        <Text style={styles.emptySub}>Try a different category, city, or budget range.</Text>
                        <Pressable onPress={() => { setArtists(null); setInnerStep(0); }} style={styles.emptyRetryWrap}>
                          <LinearGradient colors={gradients.brand} locations={gradients.brandLocations} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.emptyRetry}>
                            <Text style={styles.emptyRetryText}>Try Again</Text>
                          </LinearGradient>
                        </Pressable>
                      </View>
                    ) : (
                      <FlatList
                        data={artists ?? []}
                        keyExtractor={(item) => item.id}
                        numColumns={2}
                        columnWrapperStyle={styles.resultsRow}
                        scrollEnabled={false}
                        renderItem={({ item }) => (
                          <View style={styles.resultsCell}>
                            <ResultCard artist={item} selected={selectedArtist?.id === item.id} artistType={artistType} duration={duration} onPress={() => setPreviewArtist(item)} />
                          </View>
                        )}
                      />
                    )}
                  </>
                )}
              </View>
            ) : null}

            {/* Event Details */}
            {outerStep === 1 ? (
              <View>
                {selectedArtist ? (
                  <View style={styles.selectedArtistRow}>
                    <View style={styles.selectedArtistAvatar}>
                      {selectedArtist.profileImageUrl ? (
                        <Image source={{ uri: selectedArtist.profileImageUrl }} style={StyleSheet.absoluteFill} contentFit="cover" />
                      ) : (
                        <Text style={styles.selectedArtistInitial}>{selectedArtistName[0]}</Text>
                      )}
                    </View>
                    <View style={styles.flex1}>
                      <Text style={styles.selectedArtistName}>{selectedArtistName}</Text>
                      <Text style={styles.selectedArtistMeta}>{selectedArtist.performerType} · {selectedArtist.city}</Text>
                    </View>
                  </View>
                ) : null}

                <Text style={styles.sectionTitle}>Event details</Text>
                <Text style={styles.stepSub}>Tell {selectedArtistName || "the artist"} what to expect.</Text>

                <Text style={styles.fieldGroupLabel}>EVENT TYPE</Text>
                <View style={styles.chipGrid}>
                  {EVENT_TYPES.map((t) => (
                    <View key={t} style={styles.chipGridItem}>
                      <WizardChip label={t} selected={eventType === t} onPress={() => setEventType(t)} />
                    </View>
                  ))}
                </View>

                <View style={styles.dateTimeRow}>
                  <View style={styles.flex1}><DateField label="EVENT DATE *" value={eventDate} onChange={setEventDate} /></View>
                  <TimeField label="START TIME" hour={eventHour} onChange={setEventHour} />
                </View>

                <Text style={styles.fieldGroupLabel}>PERFORMING LANGUAGE (OPTIONAL)</Text>
                <View style={styles.langRow}>
                  {LANGUAGES.map((lang) => (
                    <Pressable key={lang} onPress={() => toggleLanguage(lang)} style={[styles.langChip, languages.includes(lang) && styles.langChipSelected]}>
                      <Text style={[styles.langChipText, languages.includes(lang) && styles.langChipTextSelected]}>{languages.includes(lang) ? "✓ " : ""}{lang}</Text>
                    </Pressable>
                  ))}
                </View>

                <PlacesAutocompleteField
                  label="VENUE ADDRESS *"
                  placeholder='e.g. "Satra Plaza Vashi"'
                  value={venueName || venueAddress}
                  onChangeText={(t) => { setVenueName(t); setVenueAddress(t); }}
                  onSelect={handlePlaceSelect}
                />

                <View style={styles.notesField}>
                  <Text style={styles.fieldGroupLabel}>SPECIAL REQUIREMENTS (OPTIONAL)</Text>
                  <TextInput
                    value={notes}
                    onChangeText={setNotes}
                    placeholder="e.g. Specific songs, dress code, stage requirements…"
                    placeholderTextColor={colors.textMute}
                    multiline
                    style={styles.notesInput}
                  />
                </View>
              </View>
            ) : null}

            {/* Review & Pay */}
            {outerStep === 2 ? (
              <View>
                <Text style={styles.sectionTitle}>Review & Pay</Text>
                <Text style={styles.stepSub}>
                  {bookingMode === "QUICK_BOOKING"
                    ? `Book ${selectedArtistName || "the artist"} now at their listed price — pay on the next step.`
                    : `Free to send — you'll only be asked to pay once ${selectedArtistName || "the artist"} accepts your offer.`}
                </Text>

                <View style={styles.modeToggle}>
                  <Pressable style={[styles.modeTab, bookingMode === "QUICK_BOOKING" && styles.modeTabActive]} onPress={() => setBookingMode("QUICK_BOOKING")}>
                    <Text style={styles.modeTabTitle}>Book Now</Text>
                    <Text style={styles.modeTabPrice}>{formatPrice(adjustedPrice)}</Text>
                  </Pressable>
                  <Pressable style={[styles.modeTab, bookingMode === "ENQUIRY" && styles.modeTabActive]} onPress={() => setBookingMode("ENQUIRY")}>
                    <Text style={styles.modeTabTitle}>Send My Offer</Text>
                    <Text style={styles.modeTabSub}>Name your price</Text>
                  </Pressable>
                </View>

                {bookingMode === "ENQUIRY" ? (
                  <View style={styles.offerField}>
                    <Text style={styles.fieldGroupLabel}>YOUR OFFER (₹, OPTIONAL)</Text>
                    <TextInput
                      value={myOffer}
                      onChangeText={(t) => setMyOffer(t.replace(/[^0-9]/g, ""))}
                      placeholder={`e.g. ${adjustedPrice ? Math.round(adjustedPrice * 0.9) : "12000"}`}
                      placeholderTextColor={colors.textMute}
                      keyboardType="number-pad"
                      style={styles.offerInput}
                    />
                    <Text style={styles.offerHint}>
                      {adjustedPrice ? `Their listed price for this duration is ${formatPrice(adjustedPrice)} — leave blank to send your budget range instead.` : "Leave blank to send your budget range instead."}
                    </Text>
                    {myOffer && !offerValid ? <Text style={styles.offerError}>Minimum offer is ₹500.</Text> : null}
                  </View>
                ) : null}

                <GlassCard style={styles.summaryCard}>
                  <Text style={styles.summaryTitle}>{bookingMode === "QUICK_BOOKING" ? "Your Booking" : "Your Enquiry"}</Text>
                  {[
                    ["Artist", selectedArtistName],
                    ["Event", `${eventType}, ${city}`],
                    ["Date", eventDate ? eventDate.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—"],
                    ["Duration", duration ? `${duration} mins` : "—"],
                    bookingMode === "QUICK_BOOKING" ? ["Price", formatPrice(adjustedPrice)] : ["Your Offer", offerValid ? `₹${offerAmount!.toLocaleString("en-IN")}` : (budget?.display ?? "—")],
                    ["Venue", venueName || venueAddress || "—"],
                  ].map(([l, v]) => (
                    <View key={l} style={styles.summaryRow}>
                      <Text style={styles.summaryLabel}>{l}</Text>
                      <Text style={styles.summaryValue} numberOfLines={1}>{v}</Text>
                    </View>
                  ))}
                </GlassCard>

                {needsBookerProfile ? (
                  <View style={styles.profileForm}>
                    <Text style={styles.profileIntro}>One last step — tell us a bit about you and we&apos;ll send your request.</Text>
                    <FormField label="FULL NAME" value={profileFullName} onChangeText={setProfileFullName} placeholder="Your name" />
                    <FormField label="EMAIL" value={profileEmail} onChangeText={setProfileEmail} placeholder="you@email.com" keyboardType="email-address" autoCapitalize="none" />
                    {profileEmail && !isValidEmail(profileEmail) ? <Text style={styles.emailError}>Enter a valid email address.</Text> : null}
                    <FormField label="CITY" value={profileCity} onChangeText={setProfileCity} placeholder="Your city" />
                    <FormField label="STATE" value={profileState} onChangeText={setProfileState} placeholder="Your state" />
                    {profileError ? <Text style={styles.offerError}>{profileError}</Text> : null}
                    <GradientButton
                      label="Continue & Send"
                      onPress={handleCompleteProfileAndSubmit}
                      disabled={!profileFullName || !isValidEmail(profileEmail) || !profileCity || !profileState}
                      loading={profileSubmitting}
                    />
                    <Pressable onPress={() => setNeedsBookerProfile(false)}>
                      <Text style={styles.profileBack}>Back</Text>
                    </Pressable>
                  </View>
                ) : null}

                {error ? <Text style={styles.offerError}>{error}</Text> : null}
              </View>
            ) : null}

          </ScrollView>

          {!(outerStep === 0 && innerStep === 4) && !needsBookerProfile ? (
            <View style={styles.footer}>
              <Pressable onPress={handleFooterPress} disabled={nextDisabled} style={{ opacity: nextDisabled ? 0.5 : 1 }}>
                <LinearGradient colors={gradients.brand} locations={gradients.brandLocations} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.footerButton}>
                  {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.footerButtonText}>{footerLabel}</Text>}
                </LinearGradient>
              </Pressable>
              {outerStep === 2 ? (
                <Text style={styles.footerNote}>{bookingMode === "QUICK_BOOKING" ? "🔒 You'll pay on the next step to confirm" : "🔒 Free to send · You pay only once the artist accepts"}</Text>
              ) : null}
            </View>
          ) : null}
        </KeyboardAvoidingView>
      </SafeAreaView>

      {previewArtist ? (
        <PreviewModal
          artist={previewArtist}
          isSelected={selectedArtist?.id === previewArtist.id}
          artistType={artistType}
          duration={duration}
          onClose={() => setPreviewArtist(null)}
          onChoose={() => { selectArtist(previewArtist); setPreviewArtist(null); }}
        />
      ) : null}
    </GradientBackground>
  );
}

function FormField({
  label, ...props
}: { label: string } & React.ComponentProps<typeof TextInput>) {
  return (
    <View style={styles.formField}>
      <Text style={styles.fieldGroupLabel}>{label}</Text>
      <TextInput {...props} placeholderTextColor={colors.textMute} style={styles.formFieldInput} />
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },
  flex1: { flex: 1, minWidth: 0 },
  header: { flexDirection: "row", alignItems: "flex-start", gap: spacing.sm, paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
  backButton: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: "rgba(255,255,255,0.07)",
    alignItems: "center", justifyContent: "center", flexShrink: 0,
  },
  headerTextWrap: { flex: 1, paddingTop: 2 },
  headerTitle: { fontFamily: fonts.bodySemiBold, fontSize: 15, color: colors.text },
  headerSub: { fontFamily: fonts.body, fontSize: 11.5, color: colors.textMute, marginTop: 2 },

  stepperRow: { flexDirection: "row", alignItems: "flex-start", paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.xs },
  stepperItemWrap: { flexDirection: "row", alignItems: "flex-start", flex: 1 },
  stepperItem: { alignItems: "center", gap: 5, minWidth: 0 },
  stepperDot: {
    width: 26, height: 26, borderRadius: 13, alignItems: "center", justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.06)", borderWidth: 1, borderColor: colors.lineStrong,
  },
  stepperDotActive: { borderColor: colors.purple, borderWidth: 2 },
  stepperDotDone: { backgroundColor: colors.purple, borderWidth: 0 },
  stepperDotText: { fontFamily: fonts.bodySemiBold, fontSize: 11, color: colors.textMute },
  stepperLabel: { fontFamily: fonts.mono, fontSize: 9, color: colors.textMute, textAlign: "center" },
  stepperLabelActive: { color: colors.pink, fontFamily: fonts.bodySemiBold },
  stepperLine: { flex: 1, height: 2, backgroundColor: colors.line, marginTop: 12, marginHorizontal: 4 },
  stepperLineDone: { backgroundColor: colors.purple },

  scroll: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.xxl },
  stepTitle: { fontFamily: fonts.display, fontSize: 24, color: colors.text, marginBottom: 4 },
  stepSub: { fontFamily: fonts.body, fontSize: 13.5, color: colors.textMute, marginBottom: spacing.lg, lineHeight: 19 },
  stepSubTight: { fontFamily: fonts.body, fontSize: 12.5, color: colors.textMute, marginBottom: spacing.sm },
  sectionTitle: { fontFamily: fonts.displayMedium, fontSize: 20, color: colors.text, marginBottom: 4 },

  chipGrid: { flexDirection: "row", flexWrap: "wrap", marginHorizontal: -spacing.xs / 2 },
  chipGridItem: { width: "50%", paddingHorizontal: spacing.xs / 2, marginBottom: spacing.xs },
  chipColumn: { gap: spacing.xs },
  chip: {
    flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 13, paddingHorizontal: 14,
    borderRadius: radii.md, backgroundColor: "rgba(255,255,255,0.04)", borderWidth: 1, borderColor: colors.line,
  },
  chipSelected: { backgroundColor: "rgba(168,85,247,0.16)", borderColor: colors.purple },
  chipEmoji: { fontSize: 17 },
  chipLabel: { flex: 1, fontFamily: fonts.bodyMedium, fontSize: 13.5, color: colors.textDim },
  chipLabelSelected: { color: colors.text, fontFamily: fonts.bodySemiBold },

  orbRow: { flexDirection: "row", justifyContent: "center", gap: spacing.md, flexWrap: "wrap" },
  orb: {
    width: 118, height: 118, borderRadius: 59, alignItems: "center", justifyContent: "center", gap: 4,
    backgroundColor: "rgba(255,255,255,0.05)", borderWidth: 1, borderColor: colors.lineStrong,
  },
  orbSelected: { borderColor: colors.purple, borderWidth: 2, backgroundColor: "rgba(168,85,247,0.14)" },
  orbLabel: { fontFamily: fonts.bodySemiBold, fontSize: 15, color: colors.text },
  orbSub: { fontFamily: fonts.body, fontSize: 10.5, color: colors.textMute, textAlign: "center", paddingHorizontal: 8 },
  orbSubSelected: { color: colors.text },

  infoCard: { borderRadius: radii.lg, borderWidth: 1, borderColor: "rgba(168,85,247,0.25)", backgroundColor: "rgba(168,85,247,0.06)", padding: spacing.lg, alignItems: "center" },
  infoCardTitle: { fontFamily: fonts.bodySemiBold, fontSize: 20, color: colors.text, marginBottom: 4 },
  infoCardSub: { fontFamily: fonts.body, fontSize: 13, color: colors.textMute },

  loadingBlock: { alignItems: "center", justifyContent: "center", gap: spacing.md, paddingVertical: 60 },
  loadingText: { fontFamily: fonts.bodySemiBold, fontSize: 16, color: colors.text },
  cityNote: { fontFamily: fonts.body, fontSize: 12, color: colors.purple, marginBottom: spacing.xs },
  relaxedNote: { fontFamily: fonts.body, fontSize: 12, color: colors.orange, marginBottom: spacing.md },

  emptyBlock: { alignItems: "center", paddingVertical: 40 },
  emptyEmoji: { fontSize: 44, marginBottom: spacing.sm },
  emptyTitle: { fontFamily: fonts.bodySemiBold, fontSize: 17, color: colors.text, marginBottom: 6 },
  emptySub: { fontFamily: fonts.body, fontSize: 13, color: colors.textMute, marginBottom: spacing.lg, textAlign: "center" },
  emptyRetryWrap: {},
  emptyRetry: { paddingHorizontal: 26, paddingVertical: 12, borderRadius: radii.pill },
  emptyRetryText: { fontFamily: fonts.bodySemiBold, fontSize: 14, color: "#fff" },

  resultsRow: { gap: spacing.sm },
  resultsCell: { flex: 1, marginBottom: spacing.sm },
  card: { aspectRatio: 3 / 4, borderRadius: radii.lg, overflow: "hidden", backgroundColor: colors.ink2, borderWidth: 1, borderColor: colors.line },
  cardSelected: { borderColor: colors.purple, borderWidth: 2 },
  cardInitial: { flex: 1, textAlign: "center", textAlignVertical: "center", fontFamily: fonts.display, fontSize: 40, color: "rgba(255,255,255,0.5)" },
  cardPlayHint: {
    position: "absolute", top: "42%", left: "42%", width: 34, height: 34, borderRadius: 17,
    backgroundColor: "rgba(0,0,0,0.45)", borderWidth: 1, borderColor: "rgba(255,255,255,0.3)",
    alignItems: "center", justifyContent: "center",
  },
  cardTopRow: { position: "absolute", top: 8, left: 8, right: 8, flexDirection: "row", justifyContent: "space-between" },
  verifiedBadge: { backgroundColor: "rgba(0,0,0,0.55)", borderWidth: 1, borderColor: "rgba(52,211,153,0.4)", borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3 },
  verifiedText: { fontFamily: fonts.bodySemiBold, fontSize: 9.5, color: colors.ok },
  cardCheck: { width: 22, height: 22, borderRadius: 11, backgroundColor: colors.purple, alignItems: "center", justifyContent: "center" },
  cardBottom: { position: "absolute", left: 0, right: 0, bottom: 0, padding: 10 },
  cardName: { fontFamily: fonts.bodySemiBold, fontSize: 13.5, color: "#fff", marginBottom: 2 },
  cardMeta: { fontFamily: fonts.body, fontSize: 10.5, color: "rgba(255,255,255,0.7)", marginBottom: 6 },
  cardPriceBadge: { alignSelf: "flex-start", borderRadius: 20, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 3 },
  cardPriceText: { fontFamily: fonts.bodySemiBold, fontSize: 10 },

  modalBackdrop: { flex: 1, backgroundColor: "rgba(5,3,10,0.88)", alignItems: "center", justifyContent: "center", padding: spacing.md },
  modalCard: { width: "100%", maxWidth: 400, maxHeight: "92%", borderRadius: radii.xl, overflow: "hidden", backgroundColor: colors.ink },
  modalHero: { width: "100%", aspectRatio: 3 / 4, backgroundColor: "#000" },
  modalInitial: { flex: 1, textAlign: "center", textAlignVertical: "center", fontFamily: fonts.display, fontSize: 56, color: "rgba(255,255,255,0.5)" },
  modalCloseButton: {
    position: "absolute", top: 10, right: 10, width: 32, height: 32, borderRadius: 16,
    backgroundColor: "rgba(0,0,0,0.55)", alignItems: "center", justifyContent: "center",
  },
  modalBody: { padding: spacing.lg, gap: spacing.xs },
  modalNameRow: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  modalName: { fontFamily: fonts.bodySemiBold, fontSize: 19, color: colors.text },
  modalMeta: { fontFamily: fonts.body, fontSize: 13, color: colors.textMute, marginBottom: spacing.sm },
  modalBio: { fontFamily: fonts.body, fontSize: 13, lineHeight: 19, color: colors.textDim, marginBottom: spacing.md },
  modalPriceBlock: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderRadius: radii.lg, borderWidth: 1, padding: spacing.md, marginVertical: spacing.sm },
  modalPriceLabel: { fontFamily: fonts.mono, fontSize: 10, color: colors.textMute, letterSpacing: 0.6, marginBottom: 2 },
  modalPrice: { fontFamily: fonts.bodySemiBold, fontSize: 21, color: colors.text },
  negotiablePill: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  negotiablePillText: { fontFamily: fonts.bodySemiBold, fontSize: 11 },
  modalActions: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm },
  modalBackButton: {
    flex: 1, paddingVertical: 13, borderRadius: radii.pill, alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.06)", borderWidth: 1, borderColor: colors.lineStrong,
  },
  modalBackText: { fontFamily: fonts.bodySemiBold, fontSize: 13.5, color: colors.textDim },
  modalChooseWrap: { flex: 1 },
  modalChooseButton: { paddingVertical: 13, borderRadius: radii.pill, alignItems: "center" },
  modalChooseText: { fontFamily: fonts.bodySemiBold, fontSize: 13.5, color: "#fff" },

  selectedArtistRow: {
    flexDirection: "row", alignItems: "center", gap: spacing.sm, backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1, borderColor: colors.line, borderRadius: radii.lg, padding: spacing.sm, marginBottom: spacing.lg,
  },
  selectedArtistAvatar: { width: 44, height: 44, borderRadius: 12, overflow: "hidden", backgroundColor: "rgba(168,85,247,0.2)", alignItems: "center", justifyContent: "center" },
  selectedArtistInitial: { fontFamily: fonts.bodySemiBold, fontSize: 17, color: colors.purple },
  selectedArtistName: { fontFamily: fonts.bodySemiBold, fontSize: 14, color: colors.text },
  selectedArtistMeta: { fontFamily: fonts.body, fontSize: 12, color: colors.textMute },

  fieldGroupLabel: { fontFamily: fonts.mono, fontSize: 10.5, color: colors.textMute, letterSpacing: 0.6, marginBottom: spacing.xs, textTransform: "uppercase" },
  dateTimeRow: { flexDirection: "row", gap: spacing.sm, marginBottom: spacing.lg },
  langRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: spacing.lg },
  langChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.05)", borderWidth: 1, borderColor: colors.line },
  langChipSelected: { backgroundColor: "rgba(168,85,247,0.16)", borderColor: colors.purple },
  langChipText: { fontFamily: fonts.bodyMedium, fontSize: 12.5, color: colors.textDim },
  langChipTextSelected: { color: colors.text, fontFamily: fonts.bodySemiBold },

  notesField: { marginTop: spacing.lg, gap: 4 },
  notesInput: {
    backgroundColor: colors.ink2, borderWidth: 1, borderColor: colors.line, borderRadius: radii.sm,
    paddingHorizontal: 12, paddingVertical: 10, minHeight: 70, textAlignVertical: "top",
    fontFamily: fonts.body, fontSize: 14, color: colors.text,
  },

  modeToggle: { flexDirection: "row", gap: spacing.sm, marginBottom: spacing.lg },
  modeTab: { flex: 1, padding: 12, borderRadius: radii.lg, backgroundColor: "rgba(255,255,255,0.03)", borderWidth: 1, borderColor: colors.line },
  modeTabActive: { backgroundColor: "rgba(168,85,247,0.14)", borderColor: colors.purple },
  modeTabTitle: { fontFamily: fonts.bodySemiBold, fontSize: 13, color: colors.text },
  modeTabPrice: { fontFamily: fonts.bodySemiBold, fontSize: 12, color: colors.pink, marginTop: 2 },
  modeTabSub: { fontFamily: fonts.body, fontSize: 12, color: colors.textMute, marginTop: 2 },

  offerField: { marginBottom: spacing.lg },
  offerInput: {
    backgroundColor: colors.ink2, borderWidth: 1, borderColor: colors.line, borderRadius: radii.sm,
    paddingHorizontal: 14, paddingVertical: 12, fontFamily: fonts.bodySemiBold, fontSize: 15, color: colors.text,
  },
  offerHint: { fontFamily: fonts.body, fontSize: 11, color: colors.textMute, marginTop: 6 },
  offerError: { fontFamily: fonts.body, fontSize: 12, color: colors.err, marginTop: 6 },
  emailError: { fontFamily: fonts.body, fontSize: 12, color: colors.err, marginTop: -6 },

  summaryCard: { marginBottom: spacing.lg, gap: 6 },
  summaryTitle: { fontFamily: fonts.mono, fontSize: 10.5, color: colors.textMute, letterSpacing: 0.6, textTransform: "uppercase", marginBottom: spacing.xs },
  summaryRow: { flexDirection: "row", justifyContent: "space-between", gap: spacing.md },
  summaryLabel: { fontFamily: fonts.body, fontSize: 13, color: colors.textMute, flexShrink: 0 },
  summaryValue: { fontFamily: fonts.bodySemiBold, fontSize: 13, color: colors.text, flexShrink: 1, textAlign: "right" },

  profileForm: { gap: spacing.sm, marginBottom: spacing.lg },
  profileIntro: { fontFamily: fonts.body, fontSize: 13, lineHeight: 18, color: colors.textDim, marginBottom: spacing.xs },
  profileBack: { fontFamily: fonts.bodyMedium, fontSize: 12.5, color: colors.textMute, textAlign: "center", marginTop: 2 },
  formField: { gap: 4, marginBottom: spacing.sm },
  formFieldInput: {
    backgroundColor: colors.ink2, borderWidth: 1, borderColor: colors.line, borderRadius: radii.sm,
    paddingHorizontal: 12, paddingVertical: 10, fontFamily: fonts.body, fontSize: 14, color: colors.text,
  },

  footer: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.md },
  footerButton: { paddingVertical: 15, borderRadius: radii.pill, alignItems: "center", justifyContent: "center" },
  footerButtonText: { fontFamily: fonts.bodySemiBold, fontSize: 15, color: "#fff" },
  footerNote: { fontFamily: fonts.body, fontSize: 10.5, color: colors.textMute, textAlign: "center", marginTop: spacing.sm },

  doneSafe: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: spacing.xl, gap: spacing.lg },
  doneCheck: { width: 68, height: 68, borderRadius: 34, backgroundColor: colors.purple, alignItems: "center", justifyContent: "center" },
  doneTitle: { fontFamily: fonts.display, fontSize: 24, color: colors.text, textAlign: "center" },
  doneSub: { fontFamily: fonts.body, fontSize: 13.5, lineHeight: 20, color: colors.textMute, textAlign: "center" },
  doneSummaryCard: { width: "100%", gap: 6 },
  doneSummaryTitle: { fontFamily: fonts.mono, fontSize: 10.5, color: colors.textMute, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: spacing.xs },
  doneSummaryRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 4 },
  doneSummaryLabel: { fontFamily: fonts.body, fontSize: 13, color: colors.textMute },
  doneSummaryValue: { fontFamily: fonts.bodySemiBold, fontSize: 13, color: colors.text },
  doneActions: { width: "100%", gap: spacing.sm },
  doneCtaWrap: {},
  doneCta: { paddingVertical: 14, borderRadius: radii.pill, alignItems: "center" },
  doneCtaText: { fontFamily: fonts.bodySemiBold, fontSize: 14, color: "#fff" },
  doneSecondaryButton: { paddingVertical: 14, borderRadius: radii.pill, alignItems: "center", backgroundColor: "rgba(255,255,255,0.06)", borderWidth: 1, borderColor: colors.lineStrong },
  doneSecondaryText: { fontFamily: fonts.bodySemiBold, fontSize: 14, color: colors.textDim },
});
