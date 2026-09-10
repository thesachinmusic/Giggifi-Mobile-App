import { useCallback, useEffect, useRef, useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Image } from "expo-image";
import { Feather } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { GradientBackground } from "@/components/GradientBackground";
import { GradientButton as Btn } from "@/components/GradientButton";
import { GlassCard } from "@/components/GlassCard";
import { AvailabilityCalendar } from "@/components/AvailabilityCalendar";
import { InlinePhoneVerification } from "@/components/InlinePhoneVerification";
import { DateField } from "@/components/DateField";
import { StateCityField } from "@/components/StateCityField";
import { Skeleton } from "@/components/Skeleton";
import {
  fetchRebookCheck,
  fetchArtistAvailability,
  sendEnquiry,
  ApiError,
  type RebookCheckResult,
} from "@/lib/api";
import { CATEGORIES } from "@/lib/categories";
import { DURATION_OPTIONS, DURATION_MULTIPLIERS, FULL_SHOW_MINUTES, getDurationAdjustedPrice, isSoloPerformerType } from "@/lib/duration-pricing";
import { duotoneFor } from "@/lib/palette";
import { captureError } from "@/lib/telemetry";
import { colors, fonts, radii, spacing } from "@/theme";

// Book Again — a fresh enquiry pre-filled from a past COMPLETED booking with
// the same artist. Deliberately NOT a re-confirmation shortcut: this always
// runs through sendEnquiry() in mode "ENQUIRY" (never QUICK_BOOKING), so the
// resulting booking lands as ENQUIRY_SENT and the artist has to accept it
// again exactly like a first-time request — see handleSubmit below.
export default function RebookScreen() {
  const { bookingId } = useLocalSearchParams<{ bookingId: string }>();

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [check, setCheck] = useState<RebookCheckResult | null>(null);

  const [eventType, setEventType] = useState("");
  const [eventCity, setEventCity] = useState("");
  const [eventState, setEventState] = useState("");
  const [venueType, setVenueType] = useState("");
  const [eventDate, setEventDate] = useState<Date | null>(null);
  const [duration, setDuration] = useState<number | null>(null);
  const [budgetAmount, setBudgetAmount] = useState("");
  const [specialRequests, setSpecialRequests] = useState("");

  const [dateCheck, setDateCheck] = useState<"idle" | "checking" | "available" | "blocked">("idle");

  const [needsPhoneVerification, setNeedsPhoneVerification] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [sent, setSent] = useState(false);
  const [sentBookingId, setSentBookingId] = useState<string | null>(null);

  const mountedRef = useRef(true);
  useEffect(() => () => { mountedRef.current = false; }, []);

  const load = useCallback(() => {
    if (!bookingId) return;
    setLoading(true);
    setLoadError("");
    fetchRebookCheck(bookingId)
      .then((result) => {
        if (!mountedRef.current) return;
        setCheck(result);
        if (result.eligible && result.prefill) {
          setEventType(result.prefill.eventType ?? "");
          setEventCity(result.prefill.eventCity ?? "");
          setEventState(result.prefill.eventState ?? "");
          setVenueType(result.prefill.venueType ?? "");
          const perf = result.artist?.performerType ?? null;
          const solo = isSoloPerformerType(perf);
          setDuration(solo && (DURATION_OPTIONS as readonly number[]).includes(result.prefill.duration) ? result.prefill.duration : null);
        }
      })
      .catch((err) => {
        if (mountedRef.current) setLoadError(err instanceof ApiError ? err.message : "Couldn't load this artist's details.");
      })
      .finally(() => {
        if (mountedRef.current) setLoading(false);
      });
  }, [bookingId]);

  useEffect(() => { load(); }, [load]);

  // The real pre-submit slot-availability check — same public calendar
  // service the artist profile's own AvailabilityCalendar reads from
  // (ArtistBlockedDate + real bookings via getAvailabilityForRange), just
  // narrowed to the one date the client just picked, so a Book Again
  // request can't be submitted for a day the artist is already committed.
  useEffect(() => {
    if (!eventDate || !check?.artist?.id) {
      setDateCheck("idle");
      return;
    }
    let cancelled = false;
    setDateCheck("checking");
    const key = eventDate.toISOString().slice(0, 10);
    fetchArtistAvailability(check.artist.id, key, key)
      .then((availability) => {
        if (cancelled) return;
        const blocked = availability.bookingLockedDates.includes(key) || availability.dates[key] === "UNAVAILABLE";
        setDateCheck(blocked ? "blocked" : "available");
      })
      .catch((err) => {
        if (cancelled) return;
        // Fail open on a check we couldn't complete (network hiccup) — same
        // as the fresh-booking flow, which never hard-blocks on this either;
        // the calendar below still shows whatever it last loaded.
        captureError(err, "rebook-date-availability-check");
        setDateCheck("idle");
      });
    return () => { cancelled = true; };
  }, [eventDate, check?.artist?.id]);

  async function handleSubmit() {
    if (!check?.artist || !check.prefill || !eventType || !eventCity || !eventDate || dateCheck === "blocked") return;
    setSubmitting(true);
    setFormError("");
    try {
      const effectiveDuration = duration ?? check.prefill.duration ?? FULL_SHOW_MINUTES;
      const { bookingId: newBookingId } = await sendEnquiry({
        artistId: check.artist.id,
        // Always a fresh ENQUIRY, never QUICK_BOOKING — Book Again must
        // never silently re-confirm; the artist has to accept this exactly
        // like a brand-new request.
        mode: "ENQUIRY",
        eventType,
        eventCity,
        eventDate: eventDate.toISOString(),
        duration: effectiveDuration,
        audienceSize: check.prefill.audienceSize || undefined,
        venueType: venueType || undefined,
        specialRequests: specialRequests || undefined,
        budgetAmount: budgetAmount ? Number(budgetAmount) : undefined,
        languagePref: check.prefill.languagePref?.length ? check.prefill.languagePref : undefined,
      });
      if (!mountedRef.current) return;
      setSentBookingId(newBookingId);
      setSent(true);
    } catch (err) {
      if (!mountedRef.current) return;
      if (err instanceof ApiError && err.status === 401) {
        setNeedsPhoneVerification(true);
      } else {
        setFormError(err instanceof ApiError ? err.message : "Could not send your request. Please try again.");
      }
    } finally {
      if (mountedRef.current) setSubmitting(false);
    }
  }

  function goToSimilarArtists() {
    const performerType = check?.artist?.performerType ?? null;
    const knownCategory = performerType && (CATEGORIES as readonly { label: string }[]).some((c) => c.label === performerType);
    router.replace({
      pathname: "/(tabs)/browse",
      params: knownCategory
        ? { category: performerType!, vertical: "artist" }
        : { vertical: "artist", ...(performerType ? { search: performerType } : {}) },
    });
  }

  if (loading) {
    return (
      <GradientBackground>
        <ScrollView contentContainerStyle={styles.scroll}>
          <Skeleton width="60%" height={22} style={{ marginBottom: spacing.md }} />
          <Skeleton height={120} borderRadius={radii.xl} style={{ marginBottom: spacing.md }} />
          <Skeleton height={220} borderRadius={radii.xl} />
        </ScrollView>
      </GradientBackground>
    );
  }

  if (loadError || !check) {
    return (
      <GradientBackground>
        <View style={styles.centered}>
          <Text style={styles.muted}>{loadError || "Something went wrong."}</Text>
          <Pressable style={styles.retryButton} onPress={load}>
            <Text style={styles.retryButtonText}>Try again</Text>
          </Pressable>
        </View>
      </GradientBackground>
    );
  }

  // Live eligibility failed — the artist was removed, suspended, or made
  // their profile private since this client's last booking with them.
  // Never a dead end: straight to similar artists in the same category.
  if (!check.eligible) {
    const name = check.artist?.stageName ?? "This artist";
    const [c1, c2] = duotoneFor(check.artist?.id ?? bookingId ?? "x");
    return (
      <GradientBackground>
        <View style={styles.centered}>
          <View style={[styles.unavailableIcon, { backgroundColor: c1 }]}>
            <Feather name="user-x" size={28} color="#fff" />
          </View>
          <Text style={styles.unavailableTitle}>{name} is no longer on GiggiFi</Text>
          <Text style={styles.muted}>{check.reason ?? "This artist isn't accepting bookings right now."}</Text>
          <Btn label="Find similar artists" onPress={goToSimilarArtists} style={styles.formButton} />
          <Pressable onPress={() => router.back()}>
            <Text style={styles.backLink}>Go back</Text>
          </Pressable>
        </View>
      </GradientBackground>
    );
  }

  const artist = check.artist!;
  const prefill = check.prefill!;
  const name = artist.stageName ?? "GiggiFi Artist";
  const initial = name.trim().charAt(0).toUpperCase();
  const [c1, c2] = duotoneFor(artist.id);
  const solo = isSoloPerformerType(artist.performerType);
  const effectiveDuration = duration ?? prefill.duration ?? FULL_SHOW_MINUTES;
  const adjustedPrice = getDurationAdjustedPrice(artist.currentRate, artist.performerType, effectiveDuration);

  return (
    <GradientBackground>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : "height"} keyboardVerticalOffset={80}>
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <View style={styles.artistRow}>
            {artist.profileImageUrl ? (
              <Image source={{ uri: artist.profileImageUrl }} style={styles.avatar} contentFit="cover" />
            ) : (
              <View style={[styles.avatar, styles.avatarFallback, { backgroundColor: c1 }]}>
                <Text style={styles.avatarInitial}>{initial}</Text>
              </View>
            )}
            <View style={styles.artistInfo}>
              <Text style={styles.artistName}>{name}</Text>
              {artist.performerType ? <Text style={styles.artistTag}>{artist.performerType}</Text> : null}
            </View>
          </View>

          <GlassCard style={styles.rateCard}>
            <Text style={styles.rateLabel}>{name.split(" ")[0]}&apos;s CURRENT RATE</Text>
            <Text style={styles.rateValue}>{adjustedPrice ? `₹${adjustedPrice.toLocaleString("en-IN")}` : "On request"}</Text>
            <Text style={styles.rateNote}>
              This is today&apos;s rate, fetched fresh — it may differ from your last booking with {name.split(" ")[0]}.
            </Text>
          </GlassCard>

          {sent ? (
            <GlassCard style={styles.formCard}>
              <View style={styles.sentBox}>
                <Feather name="check-circle" size={18} color={colors.ok} />
                <Text style={styles.sentText}>
                  Request sent — {name.split(" ")[0]} will need to accept it, just like any new booking.
                </Text>
              </View>
              {sentBookingId ? (
                <Btn
                  label="View booking"
                  onPress={() => router.replace({ pathname: "/booking/[id]", params: { id: sentBookingId } })}
                  style={styles.formButton}
                />
              ) : null}
            </GlassCard>
          ) : needsPhoneVerification ? (
            <GlassCard style={styles.formCard}>
              <InlinePhoneVerification
                onVerified={() => {
                  setNeedsPhoneVerification(false);
                  void handleSubmit();
                }}
              />
            </GlassCard>
          ) : (
            <GlassCard style={styles.formCard}>
              <Text style={styles.formIntro}>
                This sends {name.split(" ")[0]} a brand-new request — they&apos;ll need to accept it again before anything is confirmed.
              </Text>

              <FormField label="EVENT TYPE" value={eventType} onChangeText={setEventType} placeholder="Wedding, Birthday, Corporate…" />
              <StateCityField city={eventCity} onChangeCity={setEventCity} state={eventState} onChangeState={setEventState} cityLabel="EVENT CITY" />
              <FormField label="VENUE TYPE" value={venueType} onChangeText={setVenueType} placeholder="Indoor, Outdoor, Banquet Hall…" />
              <DateField label="EVENT DATE" value={eventDate} onChange={setEventDate} />

              {dateCheck === "checking" ? (
                <Text style={styles.dateHint}>Checking {name.split(" ")[0]}&apos;s availability…</Text>
              ) : dateCheck === "blocked" ? (
                <Text style={styles.dateBlocked}>
                  <Feather name="alert-triangle" size={12} color={colors.err} /> {name.split(" ")[0]} already has a booking on this date — pick another.
                </Text>
              ) : dateCheck === "available" ? (
                <Text style={styles.dateOk}>
                  <Feather name="check" size={12} color={colors.ok} /> This date looks open.
                </Text>
              ) : null}

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

              <FormField
                label="YOUR BUDGET (OPTIONAL)"
                value={budgetAmount}
                onChangeText={(v) => setBudgetAmount(v.replace(/[^0-9]/g, ""))}
                placeholder={adjustedPrice ? `Current rate: ₹${adjustedPrice.toLocaleString("en-IN")}` : "e.g. 12000"}
                keyboardType="number-pad"
              />
              <FormField label="NOTES (OPTIONAL)" value={specialRequests} onChangeText={setSpecialRequests} placeholder="Anything the artist should know" multiline />

              {formError ? <Text style={styles.error}>{formError}</Text> : null}
              <Btn
                label="Send Request"
                onPress={handleSubmit}
                disabled={!eventType || !eventCity || !eventDate || dateCheck === "blocked"}
                loading={submitting}
                style={styles.formButton}
              />
            </GlassCard>
          )}

          {!sent ? <AvailabilityCalendar artistId={artist.id} /> : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </GradientBackground>
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
  flex: { flex: 1 },
  scroll: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.md, padding: spacing.xl },
  muted: { fontFamily: fonts.body, fontSize: 14, color: colors.textMute, textAlign: "center" },
  retryButton: {
    marginTop: spacing.sm,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.pink,
  },
  retryButtonText: { fontFamily: fonts.bodySemiBold, fontSize: 13, color: colors.pink },
  unavailableIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.sm,
  },
  unavailableTitle: {
    fontFamily: fonts.displayMedium,
    fontSize: 19,
    color: colors.text,
    textAlign: "center",
  },
  backLink: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.textDim, marginTop: spacing.sm },
  formButton: { marginTop: spacing.sm, width: "100%" },
  artistRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  avatar: { width: 52, height: 52, borderRadius: 26 },
  avatarFallback: { alignItems: "center", justifyContent: "center" },
  avatarInitial: { fontFamily: fonts.display, fontSize: 20, color: "#fff" },
  artistInfo: { gap: 2 },
  artistName: { fontFamily: fonts.displayMedium, fontSize: 18, color: colors.text },
  artistTag: { fontFamily: fonts.body, fontSize: 12, color: colors.textMute },
  rateCard: { gap: 4 },
  rateLabel: { fontFamily: fonts.mono, fontSize: 10, color: colors.textMute, letterSpacing: 0.5 },
  rateValue: { fontFamily: fonts.display, fontSize: 26, color: colors.text },
  rateNote: { fontFamily: fonts.body, fontSize: 12, color: colors.textMute, marginTop: 4 },
  formCard: { gap: spacing.sm },
  formIntro: { fontFamily: fonts.body, fontSize: 13, color: colors.textMute, marginBottom: spacing.xs },
  sentBox: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingVertical: spacing.sm },
  sentText: { flex: 1, fontFamily: fonts.body, fontSize: 13.5, color: colors.text },
  field: { gap: 6 },
  fieldLabel: { fontFamily: fonts.mono, fontSize: 10, color: colors.textMute, letterSpacing: 0.5 },
  fieldInput: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.text,
    backgroundColor: colors.ink2,
  },
  fieldInputMultiline: { minHeight: 80, textAlignVertical: "top" },
  dateHint: { fontFamily: fonts.body, fontSize: 12, color: colors.textMute },
  dateBlocked: { fontFamily: fonts.bodyMedium, fontSize: 12.5, color: colors.err },
  dateOk: { fontFamily: fonts.bodyMedium, fontSize: 12.5, color: colors.ok },
  durationRow: { flexDirection: "row", gap: spacing.xs },
  durationPill: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 10,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.ink2,
  },
  durationPillActive: { borderColor: colors.pink, backgroundColor: "rgba(236,72,153,0.1)" },
  durationPillText: { fontFamily: fonts.bodySemiBold, fontSize: 12.5, color: colors.text },
  durationPillSub: { fontFamily: fonts.body, fontSize: 10, color: colors.textMute, marginTop: 2 },
  durationPillTextActive: { color: colors.pink },
  error: { fontFamily: fonts.body, fontSize: 12.5, color: colors.err },
});
