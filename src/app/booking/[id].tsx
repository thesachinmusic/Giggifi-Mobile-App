import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, Linking, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import * as Location from "expo-location";
import { useFocusEffect, useLocalSearchParams } from "expo-router";
import RazorpayCheckout from "react-native-razorpay";
import { GradientBackground } from "@/components/GradientBackground";
import { GradientButton as Btn } from "@/components/GradientButton";
import { GlassCard } from "@/components/GlassCard";
import { Skeleton } from "@/components/Skeleton";
import { StatusBadge } from "@/components/StatusBadge";
import { useAuth } from "@/lib/auth-context";
import {
  fetchBooking,
  fetchBookingPaymentStatus,
  fetchQuickMomentLocation,
  createRazorpayOrder,
  verifyRazorpayPayment,
  respondToBooking,
  submitReview,
  ApiError,
  type BookingDetail,
  type QuickMomentLocation,
} from "@/lib/api";
import { PAYMENT_STATUS_LABEL } from "@/lib/booking-status";
import { HELPLINE_NUMBER } from "@/lib/constants";
import { hapticSuccess } from "@/lib/haptics";
import { QUICK_MOMENT_FORMAT_LABEL } from "@/lib/quick-moments";
import { haversineKm, formatTimeAgo } from "@/lib/geo";
import { recoverPendingPayment } from "@/lib/pending-payment-recovery";
import { clearPendingPayment, getPendingPayment, setPendingPayment, type PendingPayment } from "@/lib/pending-payment-storage";
import { colors, fonts, radii, spacing } from "@/theme";

// Statuses where the other side is expected to act soon (artist hasn't
// responded yet, or the client hasn't paid yet) — worth polling for while
// this screen is open. Once past these, nothing changes fast enough to be
// worth a background request every 30s.
const POLLABLE_STATUSES = new Set(["ENQUIRY_SENT", "ENQUIRY_VIEWED", "AWAITING_PAYMENT"]);
const LOCATION_POLL_MS = 10_000;
const POLL_INTERVAL_MS = 30_000;

export default function BookingDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const [booking, setBooking] = useState<BookingDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [paying, setPaying] = useState(false);
  const [payError, setPayError] = useState("");
  const [pendingPayment, setPendingPaymentState] = useState<PendingPayment | null>(null);
  const [responding, setResponding] = useState<"accept" | "decline" | null>(null);
  const [respondError, setRespondError] = useState("");
  const [termsAccepted, setTermsAccepted] = useState(false);

  // load() is shared across several call sites (direct focus call, two
  // await-chained calls inside the pending-payment recovery IIFE below, and
  // the polling interval further down) — each of those already guards its
  // OWN state updates with its own effect-scoped `cancelled` flag, but load()
  // didn't guard its OWN three setState calls, so a slow fetchBooking()
  // resolving after the screen had already unmounted (e.g. hardware back
  // pressed mid-request) still fired setState on an unmounted component and
  // crashed to the ErrorBoundary. One mount-scoped ref covers every caller.
  const mountedRef = useRef(true);
  useEffect(() => () => { mountedRef.current = false; }, []);

  const load = useCallback(async () => {
    try {
      const { booking: b } = await fetchBooking(id);
      if (!mountedRef.current) return;
      setBooking(b);
    } catch (err) {
      if (!mountedRef.current) return;
      setError(err instanceof ApiError ? err.message : "Couldn't load this booking.");
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [id]);

  // Every time this screen opens: refresh the booking outright (fixes the
  // general staleness case — e.g. an artist's quote arriving while this
  // screen wasn't open), then retry a stuck verify for this booking, and
  // separately ask the server directly (payment-status) in case the webhook
  // or the reconciliation cron already resolved it — either path clears the
  // stored pending payment and reloads once the booking has actually moved.
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      load();

      (async () => {
        const stored = await getPendingPayment();
        if (!cancelled) setPendingPaymentState(stored && stored.bookingId === id ? stored : null);

        if (stored?.bookingId === id) {
          const { resolved } = await recoverPendingPayment();
          if (cancelled) return;
          if (resolved) {
            setPendingPaymentState(null);
            await load();
            return;
          }
        }
        if (cancelled) return;

        try {
          const status = await fetchBookingPaymentStatus(id);
          if (cancelled) return;
          if (status.payment?.status === "PAID" && status.bookingStatus !== "AWAITING_PAYMENT") {
            if (stored?.bookingId === id) await clearPendingPayment();
            if (cancelled) return;
            setPendingPaymentState(null);
            await load();
          }
        } catch {
          // Background self-heal check — a failed poll here isn't user-facing.
        }
      })();

      return () => {
        cancelled = true;
      };
    }, [id, load]),
  );

  // Polls while waiting on the other side to act. useFocusEffect's cleanup
  // fires on blur as well as unmount, so this stops on its own the moment
  // the screen loses focus — no separate AppState/blur handling needed.
  useFocusEffect(
    useCallback(() => {
      if (!booking || !POLLABLE_STATUSES.has(booking.status)) return;

      const interval = setInterval(load, POLL_INTERVAL_MS);
      return () => clearInterval(interval);
    }, [booking?.status, load]),
  );

  async function handlePay() {
    if (!booking) return;
    setPaying(true);
    setPayError("");
    let razorpayResult: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string } | null = null;
    try {
      const order = await createRazorpayOrder(booking.id, undefined, termsAccepted);
      razorpayResult = await RazorpayCheckout.open({
        key: order.keyId,
        amount: order.amount,
        currency: order.currency,
        order_id: order.orderId,
        name: "GiggiFi",
        description: order.eventName,
        prefill: { name: user?.name ?? undefined, email: user?.email ?? undefined, contact: user?.phone ?? undefined },
        theme: { color: colors.pink },
      });
    } catch (err) {
      // Covers both createRazorpayOrder (plain ApiError) and
      // RazorpayCheckout.open() (Razorpay's own error shape, including a
      // silent cancel) — neither case has moved any money, so a red error
      // here is fine; a cancel just has no description and stays silent.
      const description = (err as { error?: { description?: string }; description?: string })?.error?.description
        ?? (err as { description?: string })?.description;
      if (mountedRef.current) {
        if (description) setPayError(description);
        else if (err instanceof ApiError) setPayError(err.message);
        setPaying(false);
      }
      return;
    }

    // Razorpay succeeded — money has moved. From here on, never show a red
    // error; a failed verify just means the confirmation hasn't landed yet.
    try {
      await verifyRazorpayPayment({
        bookingId: booking.id,
        razorpay_order_id: razorpayResult.razorpay_order_id,
        razorpay_payment_id: razorpayResult.razorpay_payment_id,
        razorpay_signature: razorpayResult.razorpay_signature,
      });
      hapticSuccess();
      await load();
    } catch {
      const stuck: PendingPayment = {
        bookingId: booking.id,
        razorpayOrderId: razorpayResult.razorpay_order_id,
        razorpayPaymentId: razorpayResult.razorpay_payment_id,
        razorpaySignature: razorpayResult.razorpay_signature,
      };
      await setPendingPayment(stuck);
      if (mountedRef.current) setPendingPaymentState(stuck);
      // One immediate retry before settling into the calm "confirming" state —
      // cheap, and resolves the common transient-network case right away.
      const { resolved } = await recoverPendingPayment();
      if (resolved) {
        hapticSuccess();
        if (mountedRef.current) setPendingPaymentState(null);
        await load();
      }
    } finally {
      if (mountedRef.current) setPaying(false);
    }
  }

  async function handleRespond(action: "accept_quote" | "cancel_by_booker") {
    setResponding(action === "accept_quote" ? "accept" : "decline");
    setRespondError("");
    try {
      await respondToBooking(id, action);
      await load();
    } catch (err) {
      if (mountedRef.current) setRespondError(err instanceof ApiError ? err.message : "Could not update this booking. Please try again.");
    } finally {
      if (mountedRef.current) setResponding(null);
    }
  }

  function handleDeclineQuote() {
    Alert.alert("Decline this quote?", "This permanently cancels the booking — you can't undo this.", [
      { text: "Keep booking", style: "cancel" },
      { text: "Decline", style: "destructive", onPress: () => handleRespond("cancel_by_booker") },
    ]);
  }

  if (loading) {
    return (
      <GradientBackground>
        <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
          <View style={styles.header}>
            <Skeleton width="60%" height={24} />
            <Skeleton width={70} height={22} borderRadius={radii.pill} />
          </View>
          <GlassCard style={styles.summaryCard}>
            <Skeleton height={16} width="80%" />
            <Skeleton height={16} width="60%" />
            <Skeleton height={16} width="70%" />
          </GlassCard>
        </SafeAreaView>
      </GradientBackground>
    );
  }

  // Not `error || !booking`: once a booking has loaded successfully, a later
  // background refresh failure (poll, focus-refresh) shouldn't blank out an
  // already-working screen — only block rendering if we never got data at all.
  if (!booking) {
    return (
      <GradientBackground>
        <SafeAreaView style={styles.centered}>
          <Text style={styles.muted}>{error || "Booking not found."}</Text>
          <Pressable style={styles.retryButton} onPress={load}>
            <Text style={styles.retryButtonText}>Try again</Text>
          </Pressable>
        </SafeAreaView>
      </GradientBackground>
    );
  }

  const otherParty = booking.viewerRole === "ARTIST" ? booking.booker.name : booking.artist.name;

  return (
    <GradientBackground>
      <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
        <ScrollView style={styles.flex} contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <Text style={styles.eventName} numberOfLines={1}>{booking.eventName}</Text>
            <StatusBadge status={booking.status} />
          </View>

          <GlassCard style={styles.summaryCard}>
            <SummaryRow icon="user" label={booking.viewerRole === "ARTIST" ? "Client" : "Artist"} value={otherParty ?? "—"} />
            <SummaryRow icon="map-pin" label="City" value={booking.eventCity} />
            <SummaryRow icon="calendar" label="Date" value={new Date(booking.eventDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })} />
            {booking.venueName ? <SummaryRow icon="home" label="Venue" value={booking.venueName} /> : null}
            {booking.format === "QUICK_MOMENT" && booking.travelFeeAmount ? (
              <>
                <SummaryRow
                  icon="music"
                  label="Performance"
                  value={`₹${((booking.quotedPrice ?? 0) - booking.travelFeeAmount).toLocaleString("en-IN")}`}
                />
                <SummaryRow
                  icon="navigation"
                  label={`Travel (${booking.travelDistanceKm?.toFixed(1) ?? "?"} km)`}
                  value={`₹${booking.travelFeeAmount.toLocaleString("en-IN")}`}
                />
              </>
            ) : null}
            {booking.totalAmount ? <SummaryRow icon="credit-card" label="Total" value={`₹${booking.totalAmount.toLocaleString("en-IN")}`} /> : null}
            {booking.payment ? (
              <SummaryRow icon="shield" label="Payment" value={PAYMENT_STATUS_LABEL[booking.payment.status] ?? booking.payment.status} />
            ) : null}
          </GlassCard>

          {booking.viewerRole === "BOOKER" ? (
            <View style={styles.equipmentNote}>
              <Feather name="info" size={14} color={colors.textMute} style={styles.equipmentNoteIcon} />
              <Text style={styles.equipmentNoteText}>
                This booking includes the artist/performance only — sound & equipment are not
                included. You must arrange your own sound system, or you can inquire with us
                about your sound requirements and we&apos;ll help arrange it.
              </Text>
            </View>
          ) : null}

          {booking.format === "QUICK_MOMENT" && booking.viewerRole === "BOOKER" && booking.status !== "AWAITING_PAYMENT" ? (
            <QuickMomentPanel booking={booking} />
          ) : null}

          {booking.status === "QUOTE_RECEIVED" && booking.viewerRole === "BOOKER" ? (
            <GlassCard style={styles.payCard}>
              <View style={styles.quoteRow}>
                <View>
                  <Text style={styles.priceLabel}>QUOTE FROM {booking.artist.name?.toUpperCase() ?? "ARTIST"}</Text>
                  <Text style={styles.price}>{booking.quotedPrice ? `₹${booking.quotedPrice.toLocaleString("en-IN")}` : "—"}</Text>
                </View>
              </View>
              {respondError ? <Text style={styles.error}>{respondError}</Text> : null}
              <View style={styles.quoteActions}>
                <Pressable
                  style={styles.declineButton}
                  onPress={handleDeclineQuote}
                  disabled={responding !== null}
                >
                  {responding === "decline" ? <ActivityIndicator size="small" color={colors.textDim} /> : <Text style={styles.declineButtonText}>Decline</Text>}
                </Pressable>
                <Btn
                  label="Accept & Continue"
                  onPress={() => handleRespond("accept_quote")}
                  loading={responding === "accept"}
                  disabled={responding !== null}
                  style={styles.acceptButton}
                />
              </View>
            </GlassCard>
          ) : null}

          {booking.status === "AWAITING_PAYMENT" && booking.viewerRole === "BOOKER" && pendingPayment?.bookingId === booking.id ? (
            <GlassCard style={styles.payCard}>
              <View style={styles.recoveryRow}>
                <ActivityIndicator size="small" color={colors.ok} />
                <Text style={styles.recoveryText}>
                  Payment received. We&apos;re confirming your booking — this usually takes under a minute.
                </Text>
              </View>
            </GlassCard>
          ) : booking.status === "AWAITING_PAYMENT" && booking.viewerRole === "BOOKER" ? (
            <GlassCard style={styles.payCard}>
              <View style={styles.payRow}>
                <Feather name="check-circle" size={16} color={colors.ok} />
                <Text style={styles.payText}>{booking.artist.name} accepted — pay securely to confirm your event.</Text>
              </View>
              {payError ? <Text style={styles.error}>{payError}</Text> : null}
              <Pressable style={styles.termsRow} onPress={() => setTermsAccepted((v) => !v)}>
                <Feather name={termsAccepted ? "check-square" : "square"} size={17} color={termsAccepted ? colors.purple : colors.textMute} />
                <Text style={styles.termsText}>
                  I agree to the{" "}
                  <Text style={styles.termsLink} onPress={() => Linking.openURL("https://giggifi.com/terms")}>Terms of Service</Text>,{" "}
                  <Text style={styles.termsLink} onPress={() => Linking.openURL("https://giggifi.com/privacy")}>Privacy Policy</Text>, and{" "}
                  <Text style={styles.termsLink} onPress={() => Linking.openURL("https://giggifi.com/refund")}>Cancellation &amp; Refund Policy</Text>.
                </Text>
              </Pressable>
              <Btn
                label={booking.totalAmount ? `Pay ₹${booking.totalAmount.toLocaleString("en-IN")}` : "Pay Now"}
                onPress={handlePay}
                loading={paying}
                disabled={!termsAccepted}
                style={styles.payButton}
              />
            </GlassCard>
          ) : null}

          {booking.revealedContact ? <RevealedContactCard contact={booking.revealedContact} /> : null}

          {booking.review ? (
            <ReviewSubmittedCard review={booking.review} />
          ) : booking.canReview ? (
            <ReviewFormCard bookingId={booking.id} onSubmitted={load} />
          ) : null}

          <GlassCard style={styles.helplineCard}>
            <View style={styles.helplineRow}>
              <Feather name="headphones" size={18} color={colors.purple} />
              <Text style={styles.helplineTitle}>{booking.revealedContact ? "Need help? Contact GiggiFi" : "Need help with this booking?"}</Text>
            </View>
            <Text style={styles.helplineBody}>
              {booking.revealedContact
                ? "For support, disputes, or anything that needs GiggiFi's help, reach our team directly."
                : "For your safety, GiggiFi handles all communication between clients and artists. For any queries, contact our helpline — don't try to reach the artist directly."}
            </Text>
            <Pressable style={styles.helplineButton} onPress={() => Linking.openURL(`tel:${HELPLINE_NUMBER}`)}>
              <Feather name="phone" size={15} color="#fff" />
              <Text style={styles.helplineButtonText}>Call {HELPLINE_NUMBER}</Text>
            </Pressable>
          </GlassCard>
        </ScrollView>
      </SafeAreaView>
    </GradientBackground>
  );
}

function SummaryRow({ icon, label, value }: { icon: keyof typeof Feather.glyphMap; label: string; value: string }) {
  return (
    <View style={styles.summaryRow}>
      <Feather name={icon} size={13} color={colors.textMute} />
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={styles.summaryValue} numberOfLines={1}>{value}</Text>
    </View>
  );
}

// See [[privacy-constraint]] — shown only once payment has cleared
// (revealedContact non-null). Delivered as a notification at the moment
// payment clears too (see the website's contact-reveal-service.ts); this
// card is where it persists afterward instead of only living in the
// notification list.
function RevealedContactCard({ contact }: { contact: NonNullable<BookingDetail["revealedContact"]> }) {
  const digits = contact.phone?.replace(/[^\d+]/g, "") ?? "";
  return (
    <GlassCard style={styles.revealedContactCard}>
      <View style={styles.revealedContactHeader}>
        <Feather name="unlock" size={16} color={colors.ok} />
        <Text style={styles.revealedContactTitle}>Contact details unlocked</Text>
      </View>
      <Text style={styles.revealedContactBody}>
        Your booking is confirmed — you can now reach {contact.name} directly to coordinate the event.
      </Text>
      <View style={styles.revealedContactRow}>
        <Text style={styles.revealedContactName}>{contact.name}</Text>
        <Text style={styles.revealedContactPhone}>{contact.phone ?? "Not available"}</Text>
      </View>
      {digits ? (
        <View style={styles.revealedContactActions}>
          <Pressable style={styles.revealedContactCallButton} onPress={() => Linking.openURL(`tel:${digits}`)}>
            <Feather name="phone" size={14} color="#fff" />
            <Text style={styles.revealedContactCallText}>Call</Text>
          </Pressable>
          <Pressable style={styles.revealedContactWhatsappButton} onPress={() => Linking.openURL(`https://wa.me/${digits.replace(/^\+/, "")}`)}>
            <Feather name="message-circle" size={14} color="#25d366" />
            <Text style={styles.revealedContactWhatsappText}>WhatsApp</Text>
          </Pressable>
        </View>
      ) : null}
    </GlassCard>
  );
}

// Mirrors the website's own minimal "Leave a review" section (built for
// the Auto Review Request email flow — this is where a client who opens
// that email in the app actually lands). Shown only when
// canReview is true — booker, event actually completed, not already
// reviewed — same gate the server enforces on submit, this is just the UI
// reflection of it.
function ReviewFormCard({ bookingId, onSubmitted }: { bookingId: string; onSubmitted: () => Promise<void> }) {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit() {
    if (!rating || !comment.trim()) return;
    setSubmitting(true);
    setError("");
    try {
      await submitReview(bookingId, { rating, comment: comment.trim() });
      await onSubmitted();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not submit your review. Please try again.");
      setSubmitting(false);
    }
  }

  return (
    <GlassCard style={styles.reviewCard}>
      <Text style={styles.reviewTitle}>How was your experience?</Text>
      <View style={styles.reviewStars}>
        {[1, 2, 3, 4, 5].map((star) => (
          <Pressable key={star} onPress={() => setRating(star)} hitSlop={6} accessibilityRole="button" accessibilityLabel={`${star} star${star === 1 ? "" : "s"}`}>
            <Feather name="star" size={28} color={star <= rating ? colors.orange : colors.line} />
          </Pressable>
        ))}
      </View>
      <TextInput
        value={comment}
        onChangeText={setComment}
        placeholder="Tell us about the performance…"
        placeholderTextColor={colors.textMute}
        multiline
        style={styles.reviewInput}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Btn
        label="Submit Review"
        onPress={handleSubmit}
        loading={submitting}
        disabled={!rating || !comment.trim()}
        style={styles.payButton}
      />
    </GlassCard>
  );
}

function ReviewSubmittedCard({ review }: { review: NonNullable<BookingDetail["review"]> }) {
  return (
    <GlassCard style={styles.reviewCard}>
      <View style={styles.reviewSubmittedHeader}>
        <Feather name="check-circle" size={16} color={colors.ok} />
        <Text style={styles.reviewTitle}>Thanks for your review</Text>
      </View>
      <View style={styles.reviewStars}>
        {[1, 2, 3, 4, 5].map((star) => (
          <Feather key={star} name="star" size={18} color={star <= review.rating ? colors.orange : colors.line} />
        ))}
      </View>
      <Text style={styles.reviewSubmittedComment}>{review.comment}</Text>
    </GlassCard>
  );
}

// Booker-side only — the app is booker-facing (artists manage en-route/
// arrival/completion from the website dashboard, see quick-moments-client.tsx
// there), so this only ever displays state, never advances it.
function QuickMomentPanel({ booking }: { booking: BookingDetail }) {
  const [location, setLocation] = useState<QuickMomentLocation | null>(null);
  const [myCoords, setMyCoords] = useState<{ lat: number; lng: number } | null>(null);
  const tracking = Boolean(booking.enRouteAt) && !booking.arrivedAt;

  // Polling, not a Pusher subscription — see the doc comment on
  // fetchQuickMomentLocation in lib/api.ts for why.
  useEffect(() => {
    if (!tracking) return;
    let cancelled = false;
    function poll() {
      fetchQuickMomentLocation(booking.id)
        .then((loc) => { if (!cancelled) setLocation(loc); })
        .catch(() => {
          // A missed poll just waits for the next tick — no user-facing error.
        });
    }
    poll();
    const interval = setInterval(poll, LOCATION_POLL_MS);
    return () => { cancelled = true; clearInterval(interval); };
  }, [tracking, booking.id]);

  // One-shot — only used to turn the artist's last-known point into a
  // rough "X km away" readout, not a live map (see AGENTS.md-driven research:
  // expo-maps is alpha and needs an API key this environment doesn't have).
  useEffect(() => {
    if (!tracking) return;
    let cancelled = false;
    Location.requestForegroundPermissionsAsync()
      .then(({ status }) => (status === "granted" ? Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }) : null))
      .then((pos) => {
        if (!cancelled && pos) setMyCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [tracking]);

  const distanceKm = tracking && location?.active && location.lat != null && location.lng != null && myCoords
    ? haversineKm(myCoords.lat, myCoords.lng, location.lat, location.lng)
    : null;

  const formatLabel = booking.quickMomentFormat ? QUICK_MOMENT_FORMAT_LABEL[booking.quickMomentFormat] : "Quick Moment";

  return (
    <GlassCard style={styles.qmCard}>
      <Text style={styles.qmTitle}>{formatLabel}</Text>

      <View style={styles.qmSteps}>
        <QuickMomentStep label="Booked & paid" done />
        <QuickMomentStep label="Artist on the way" done={Boolean(booking.enRouteAt)} active={!booking.enRouteAt} />
        <QuickMomentStep label="Artist arrived" done={Boolean(booking.arrivedAt)} active={Boolean(booking.enRouteAt) && !booking.arrivedAt} />
        <QuickMomentStep label="Performance completed" done={Boolean(booking.completedAt)} active={Boolean(booking.arrivedAt) && !booking.completedAt} last />
      </View>

      {tracking ? (
        <View style={styles.qmTrackingBox}>
          <ActivityIndicator size="small" color={colors.pink} />
          <Text style={styles.qmTrackingText}>
            {distanceKm != null ? `About ${distanceKm < 1 ? "under 1" : distanceKm.toFixed(1)} km away` : "Artist is on the way"}
            {location?.updatedAt ? ` · updated ${formatTimeAgo(location.updatedAt)}` : ""}
          </Text>
        </View>
      ) : null}

      {booking.arrivalOtpCode && !booking.arrivedAt ? (
        <OtpCallout label="ARRIVAL CODE" hint="Share this with the artist when they arrive" code={booking.arrivalOtpCode} />
      ) : null}
      {booking.completionOtpCode && booking.arrivedAt && !booking.completedAt ? (
        <OtpCallout label="COMPLETION CODE" hint="Share this once the performance is done" code={booking.completionOtpCode} />
      ) : null}
    </GlassCard>
  );
}

function QuickMomentStep({ label, done, active, last }: { label: string; done: boolean; active?: boolean; last?: boolean }) {
  return (
    <View style={[styles.qmStepRow, last && styles.qmStepRowLast]}>
      <View style={[styles.qmDot, done ? styles.qmDotDone : active ? styles.qmDotActive : styles.qmDotPending]} />
      <Text style={[styles.qmStepText, done && styles.qmStepTextDone]}>{label}</Text>
    </View>
  );
}

function OtpCallout({ label, hint, code }: { label: string; hint: string; code: string }) {
  return (
    <View style={styles.otpBox}>
      <Text style={styles.otpLabel}>{label}</Text>
      <Text style={styles.otpCode}>{code}</Text>
      <Text style={styles.otpHint}>{hint}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },
  scroll: { paddingBottom: spacing.xxl },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.md },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    marginBottom: spacing.md,
  },
  eventName: { flex: 1, fontFamily: fonts.display, fontSize: 22, color: colors.text },
  summaryCard: { marginHorizontal: spacing.lg, gap: spacing.sm, marginBottom: spacing.lg },
  equipmentNote: {
    flexDirection: "row", gap: 8, alignItems: "flex-start",
    marginHorizontal: spacing.lg, marginBottom: spacing.lg,
    backgroundColor: colors.ink2, borderWidth: 1, borderColor: colors.line, borderRadius: radii.sm,
    padding: 12,
  },
  equipmentNoteIcon: { marginTop: 2 },
  equipmentNoteText: { flex: 1, fontFamily: fonts.body, fontSize: 12, lineHeight: 17, color: colors.textMute },
  payCard: { marginHorizontal: spacing.lg, gap: spacing.sm, marginBottom: spacing.lg },
  payRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  payText: { flex: 1, fontFamily: fonts.body, fontSize: 13, lineHeight: 18, color: colors.textDim },
  recoveryRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  recoveryText: { flex: 1, fontFamily: fonts.body, fontSize: 13, lineHeight: 18, color: colors.text },
  payButton: {},
  termsRow: { flexDirection: "row", alignItems: "flex-start", gap: 9, marginBottom: spacing.sm },
  termsText: { flex: 1, fontFamily: fonts.body, fontSize: 12, lineHeight: 17, color: colors.textDim },
  termsLink: { color: colors.purple, fontFamily: fonts.bodyMedium },
  quoteRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  priceLabel: { fontFamily: fonts.mono, fontSize: 10, color: colors.textMute, letterSpacing: 0.5, marginBottom: 4 },
  price: { fontFamily: fonts.display, fontSize: 26, color: colors.text },
  quoteActions: { flexDirection: "row", gap: spacing.sm },
  declineButton: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.lineStrong,
  },
  declineButtonText: { fontFamily: fonts.bodySemiBold, fontSize: 14, color: colors.textDim },
  acceptButton: { flex: 1.4 },
  error: { fontFamily: fonts.body, fontSize: 12.5, color: colors.err },
  summaryRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  summaryLabel: { fontFamily: fonts.mono, fontSize: 10, color: colors.textMute, letterSpacing: 0.5, width: 60 },
  summaryValue: { flex: 1, fontFamily: fonts.bodyMedium, fontSize: 13.5, color: colors.text },
  qmCard: { marginHorizontal: spacing.lg, gap: spacing.md, marginBottom: spacing.lg },
  qmTitle: { fontFamily: fonts.mono, fontSize: 10, color: colors.orange, letterSpacing: 1 },
  qmSteps: { gap: 0 },
  qmStepRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingBottom: spacing.sm },
  qmStepRowLast: { paddingBottom: 0 },
  qmDot: { width: 8, height: 8, borderRadius: 4 },
  qmDotDone: { backgroundColor: colors.ok },
  qmDotActive: { backgroundColor: colors.pink },
  qmDotPending: { backgroundColor: colors.line },
  qmStepText: { fontFamily: fonts.body, fontSize: 13, color: colors.textMute },
  qmStepTextDone: { color: colors.textDim, fontFamily: fonts.bodyMedium },
  qmTrackingBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    padding: spacing.sm,
    borderRadius: radii.md,
    backgroundColor: "rgba(236,72,153,0.08)",
  },
  qmTrackingText: { flex: 1, fontFamily: fonts.bodyMedium, fontSize: 12.5, color: colors.text },
  otpBox: {
    padding: spacing.md,
    borderRadius: radii.md,
    backgroundColor: colors.ink2,
    borderWidth: 1,
    borderColor: colors.lineStrong,
    alignItems: "center",
    gap: 4,
  },
  otpLabel: { fontFamily: fonts.mono, fontSize: 10, color: colors.textMute, letterSpacing: 1 },
  otpCode: { fontFamily: fonts.display, fontSize: 32, color: colors.text, letterSpacing: 4 },
  otpHint: { fontFamily: fonts.body, fontSize: 11.5, color: colors.textMute, textAlign: "center" },
  helplineCard: { marginHorizontal: spacing.lg, gap: spacing.sm, marginBottom: spacing.lg },
  helplineRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  helplineTitle: { fontFamily: fonts.bodySemiBold, fontSize: 14.5, color: colors.text },
  helplineBody: { fontFamily: fonts.body, fontSize: 12.5, lineHeight: 18, color: colors.textDim },
  helplineButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 13,
    borderRadius: radii.lg,
    backgroundColor: colors.purple,
  },
  helplineButtonText: { fontFamily: fonts.bodySemiBold, fontSize: 14, color: "#fff" },
  revealedContactCard: { marginHorizontal: spacing.lg, gap: spacing.sm, marginBottom: spacing.lg, borderColor: "rgba(52,211,153,0.3)" },
  revealedContactHeader: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  revealedContactTitle: { fontFamily: fonts.bodySemiBold, fontSize: 14.5, color: colors.text },
  revealedContactBody: { fontFamily: fonts.body, fontSize: 12.5, lineHeight: 18, color: colors.textDim },
  revealedContactRow: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    backgroundColor: colors.ink2, borderRadius: radii.sm, paddingHorizontal: 14, paddingVertical: 12,
  },
  revealedContactName: { fontFamily: fonts.body, fontSize: 12.5, color: colors.textDim },
  revealedContactPhone: { fontFamily: fonts.bodySemiBold, fontSize: 15, color: colors.text },
  revealedContactActions: { flexDirection: "row", gap: spacing.sm },
  revealedContactCallButton: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7,
    paddingVertical: 11, borderRadius: radii.lg, backgroundColor: colors.ok,
  },
  revealedContactCallText: { fontFamily: fonts.bodySemiBold, fontSize: 13, color: "#fff" },
  revealedContactWhatsappButton: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7,
    paddingVertical: 11, borderRadius: radii.lg, backgroundColor: "rgba(37,211,102,0.15)",
    borderWidth: 1, borderColor: "rgba(37,211,102,0.35)",
  },
  revealedContactWhatsappText: { fontFamily: fonts.bodySemiBold, fontSize: 13, color: "#25d366" },
  reviewCard: { marginHorizontal: spacing.lg, gap: spacing.sm, marginBottom: spacing.lg },
  reviewTitle: { fontFamily: fonts.bodySemiBold, fontSize: 14.5, color: colors.text },
  reviewStars: { flexDirection: "row", gap: 6 },
  reviewInput: {
    minHeight: 70,
    textAlignVertical: "top",
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
  reviewSubmittedHeader: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  reviewSubmittedComment: { fontFamily: fonts.body, fontSize: 13, lineHeight: 18, color: colors.textDim },
  muted: { fontFamily: fonts.body, fontSize: 14, color: colors.textMute, paddingHorizontal: spacing.lg, textAlign: "center" },
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
