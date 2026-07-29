import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useLocalSearchParams } from "expo-router";
import RazorpayCheckout from "react-native-razorpay";
import { GradientBackground } from "@/components/GradientBackground";
import { GradientButton as Btn } from "@/components/GradientButton";
import { GlassCard } from "@/components/GlassCard";
import { useAuth } from "@/lib/auth-context";
import {
  fetchBooking,
  fetchBookingMessages,
  sendBookingMessage,
  createRazorpayOrder,
  verifyRazorpayPayment,
  respondToBooking,
  ApiError,
  type BookingDetail,
  type BookingMessage,
} from "@/lib/api";
import { STATUS_LABEL } from "@/lib/booking-status";
import { colors, fonts, radii, spacing } from "@/theme";

export default function BookingDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const [booking, setBooking] = useState<BookingDetail | null>(null);
  const [messages, setMessages] = useState<BookingMessage[]>([]);
  const [viewerActor, setViewerActor] = useState<string>("BOOKER");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [paying, setPaying] = useState(false);
  const [payError, setPayError] = useState("");
  const [responding, setResponding] = useState<"accept" | "decline" | null>(null);
  const [respondError, setRespondError] = useState("");

  const load = useCallback(async () => {
    try {
      const [{ booking: b }, { messages: m, viewerActor: va }] = await Promise.all([
        fetchBooking(id),
        fetchBookingMessages(id),
      ]);
      setBooking(b);
      setMessages(m);
      setViewerActor(va);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't load this booking.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  async function handlePay() {
    if (!booking) return;
    setPaying(true);
    setPayError("");
    try {
      const order = await createRazorpayOrder(booking.id);
      const result = await RazorpayCheckout.open({
        key: order.keyId,
        amount: order.amount,
        currency: order.currency,
        order_id: order.orderId,
        name: "GiggiFi",
        description: order.eventName,
        prefill: { name: user?.name ?? undefined, email: user?.email ?? undefined, contact: user?.phone ?? undefined },
        theme: { color: colors.pink },
      });
      await verifyRazorpayPayment({
        bookingId: booking.id,
        razorpay_order_id: result.razorpay_order_id,
        razorpay_payment_id: result.razorpay_payment_id,
        razorpay_signature: result.razorpay_signature,
      });
      await load();
    } catch (err) {
      // Razorpay rejects with its own error shape on cancel/failure — a user
      // backing out of checkout isn't an error worth surfacing.
      const description = (err as { error?: { description?: string }; description?: string })?.error?.description
        ?? (err as { description?: string })?.description;
      if (description) setPayError(description);
      else if (err instanceof ApiError) setPayError(err.message);
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

  async function handleSend() {
    if (!draft.trim()) return;
    setSending(true);
    try {
      const { message } = await sendBookingMessage(id, draft.trim());
      setMessages((prev) => [...prev, message]);
      setDraft("");
    } catch {
      // Keep the draft so the user can retry.
    } finally {
      setSending(false);
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

  if (error || !booking) {
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

          {booking.status === "AWAITING_PAYMENT" && booking.viewerRole === "BOOKER" ? (
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

          <Text style={styles.messagesTitle}>Messages</Text>
          <FlatList
            data={messages}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.messageList}
            ListEmptyComponent={<Text style={styles.muted}>No messages yet — say hello.</Text>}
            renderItem={({ item }) => {
              const isMine = item.actor === viewerActor;
              return (
                <View style={[styles.messageRow, isMine ? styles.messageRowMine : null]}>
                  <View style={[styles.messageBubble, isMine ? styles.messageBubbleMine : null]}>
                    <Text style={styles.messageText}>{item.body}</Text>
                  </View>
                </View>
              );
            }}
          />

          <View style={styles.composer}>
            <TextInput
              value={draft}
              onChangeText={setDraft}
              placeholder="Type a message…"
              placeholderTextColor={colors.textMute}
              style={styles.composerInput}
              multiline
            />
            <Pressable style={styles.sendButton} onPress={handleSend} disabled={sending || !draft.trim()}>
              {sending ? <ActivityIndicator size="small" color="#fff" /> : <Feather name="send" size={16} color="#fff" />}
            </Pressable>
          </View>
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
  messagesTitle: { fontFamily: fonts.displayMedium, fontSize: 15, color: colors.text, paddingHorizontal: spacing.lg, marginBottom: spacing.sm },
  messageList: { paddingHorizontal: spacing.lg, gap: spacing.xs, flexGrow: 1 },
  messageRow: { flexDirection: "row" },
  messageRowMine: { justifyContent: "flex-end" },
  messageBubble: {
    maxWidth: "78%",
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
  },
  messageBubbleMine: { backgroundColor: colors.purple, borderColor: colors.purple },
  messageText: { fontFamily: fonts.body, fontSize: 13.5, color: colors.text, lineHeight: 19 },
  composer: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
  },
  composerInput: {
    flex: 1,
    maxHeight: 100,
    backgroundColor: colors.ink2,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.text,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.pink,
    alignItems: "center",
    justifyContent: "center",
  },
  muted: { fontFamily: fonts.body, fontSize: 14, color: colors.textMute, paddingHorizontal: spacing.lg },
});
