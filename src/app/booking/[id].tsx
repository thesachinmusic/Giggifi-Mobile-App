import { useCallback, useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Linking, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useFocusEffect, useLocalSearchParams } from "expo-router";
import RazorpayCheckout from "react-native-razorpay";
import { GradientBackground } from "@/components/GradientBackground";
import { GradientButton as Btn } from "@/components/GradientButton";
import { GlassCard } from "@/components/GlassCard";
import { useAuth } from "@/lib/auth-context";
import {
  fetchBooking,
  fetchBookingPaymentStatus,
  createRazorpayOrder,
  verifyRazorpayPayment,
  respondToBooking,
  ApiError,
  type BookingDetail,
} from "@/lib/api";
import { STATUS_LABEL } from "@/lib/booking-status";
import { HELPLINE_NUMBER } from "@/lib/constants";
import { recoverPendingPayment } from "@/lib/pending-payment-recovery";
import { clearPendingPayment, getPendingPayment, setPendingPayment, type PendingPayment } from "@/lib/pending-payment-storage";
import { colors, fonts, radii, spacing } from "@/theme";

// Statuses where the other side is expected to act soon (artist hasn't
// responded yet, or the client hasn't paid yet) — worth polling for while
// this screen is open. Once past these, nothing changes fast enough to be
// worth a background request every 30s.
const POLLABLE_STATUSES = new Set(["ENQUIRY_SENT", "ENQUIRY_VIEWED", "AWAITING_PAYMENT"]);
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

  const load = useCallback(async () => {
    try {
      const { booking: b } = await fetchBooking(id);
      setBooking(b);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't load this booking.");
    } finally {
      setLoading(false);
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
          if (!cancelled && resolved) {
            setPendingPaymentState(null);
            await load();
            return;
          }
        }

        try {
          const status = await fetchBookingPaymentStatus(id);
          if (!cancelled && status.payment?.status === "PAID" && status.bookingStatus !== "AWAITING_PAYMENT") {
            if (stored?.bookingId === id) await clearPendingPayment();
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
      const order = await createRazorpayOrder(booking.id);
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
      if (description) setPayError(description);
      else if (err instanceof ApiError) setPayError(err.message);
      setPaying(false);
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
      await load();
    } catch {
      const stuck: PendingPayment = {
        bookingId: booking.id,
        razorpayOrderId: razorpayResult.razorpay_order_id,
        razorpayPaymentId: razorpayResult.razorpay_payment_id,
        razorpaySignature: razorpayResult.razorpay_signature,
      };
      await setPendingPayment(stuck);
      setPendingPaymentState(stuck);
      // One immediate retry before settling into the calm "confirming" state —
      // cheap, and resolves the common transient-network case right away.
      const { resolved } = await recoverPendingPayment();
      if (resolved) {
        setPendingPaymentState(null);
        await load();
      }
    } finally {
      setPaying(false);
    }
  }

  async function handleRespond(action: "accept_quote" | "cancel_by_booker") {
    setResponding(action === "accept_quote" ? "accept" : "decline");
    setRespondError("");
    try {
      await respondToBooking(id, action);
      await load();
    } catch (err) {
      setRespondError(err instanceof ApiError ? err.message : "Could not update this booking. Please try again.");
    } finally {
      setResponding(null);
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

  // Not `error || !booking`: once a booking has loaded successfully, a later
  // background refresh failure (poll, focus-refresh) shouldn't blank out an
  // already-working screen — only block rendering if we never got data at all.
  if (!booking) {
    return (
      <GradientBackground>
        <SafeAreaView style={styles.centered}>
          <Text style={styles.muted}>{error || "Booking not found."}</Text>
        </SafeAreaView>
      </GradientBackground>
    );
  }

  const otherParty = booking.viewerRole === "ARTIST" ? booking.booker.name : booking.artist.name;

  return (
    <GradientBackground>
      <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
        <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={80}>
          <View style={styles.header}>
            <Text style={styles.eventName} numberOfLines={1}>{booking.eventName}</Text>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{STATUS_LABEL[booking.status] ?? booking.status}</Text>
            </View>
          </View>

          <GlassCard style={styles.summaryCard}>
            <SummaryRow icon="user" label={booking.viewerRole === "ARTIST" ? "Client" : "Artist"} value={otherParty ?? "—"} />
            <SummaryRow icon="map-pin" label="City" value={booking.eventCity} />
            <SummaryRow icon="calendar" label="Date" value={new Date(booking.eventDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })} />
            {booking.venueName ? <SummaryRow icon="home" label="Venue" value={booking.venueName} /> : null}
            {booking.totalAmount ? <SummaryRow icon="credit-card" label="Total" value={`₹${booking.totalAmount.toLocaleString("en-IN")}`} /> : null}
            {booking.payment ? <SummaryRow icon="shield" label="Payment" value={booking.payment.status} /> : null}
          </GlassCard>

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
                  onPress={() => handleRespond("cancel_by_booker")}
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
                  Payment received. We're confirming your booking — this usually takes under a minute.
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
              <Btn
                label={booking.totalAmount ? `Pay ₹${booking.totalAmount.toLocaleString("en-IN")}` : "Pay Now"}
                onPress={handlePay}
                loading={paying}
                style={styles.payButton}
              />
            </GlassCard>
          ) : null}

          <GlassCard style={styles.helplineCard}>
            <View style={styles.helplineRow}>
              <Feather name="headphones" size={18} color={colors.purple} />
              <Text style={styles.helplineTitle}>Need help with this booking?</Text>
            </View>
            <Text style={styles.helplineBody}>
              For your safety, GiggiFi handles all communication between clients and artists. For any queries, contact our helpline — don't try to reach the artist directly.
            </Text>
            <Pressable style={styles.helplineButton} onPress={() => Linking.openURL(`tel:${HELPLINE_NUMBER}`)}>
              <Feather name="phone" size={15} color="#fff" />
              <Text style={styles.helplineButtonText}>Call {HELPLINE_NUMBER}</Text>
            </Pressable>
          </GlassCard>
        </KeyboardAvoidingView>
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

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },
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
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: radii.pill, backgroundColor: "rgba(168,85,247,0.15)" },
  badgeText: { fontFamily: fonts.mono, fontSize: 10, color: colors.text },
  summaryCard: { marginHorizontal: spacing.lg, gap: spacing.sm, marginBottom: spacing.lg },
  payCard: { marginHorizontal: spacing.lg, gap: spacing.sm, marginBottom: spacing.lg },
  payRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  payText: { flex: 1, fontFamily: fonts.body, fontSize: 13, lineHeight: 18, color: colors.textDim },
  recoveryRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  recoveryText: { flex: 1, fontFamily: fonts.body, fontSize: 13, lineHeight: 18, color: colors.text },
  payButton: {},
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
  muted: { fontFamily: fonts.body, fontSize: 14, color: colors.textMute, paddingHorizontal: spacing.lg },
});
