import { useCallback, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { GradientBackground } from "@/components/GradientBackground";
import { GradientButton } from "@/components/GradientButton";
import { GlassCard } from "@/components/GlassCard";
import {
  fetchQuoteRequest,
  acceptQuoteResponse,
  ApiError,
  type QuoteRequestDetail,
  type QuoteBillingSummary,
  type QuoteLineItemStatus,
} from "@/lib/api";
import { captureError } from "@/lib/telemetry";
import { colors, fonts, radii, spacing } from "@/theme";

const LINE_ITEM_STATUS_LABEL: Record<QuoteLineItemStatus, string> = {
  OPEN: "Waiting for quotes",
  WIDENED: "Widened search — still waiting",
  FULFILLED: "Booked",
  EXPIRED: "Expired",
};

export default function QuoteRequestDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [quoteRequest, setQuoteRequest] = useState<QuoteRequestDetail | null>(null);
  const [billing, setBilling] = useState<QuoteBillingSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [acceptingId, setAcceptingId] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!id) return;
    fetchQuoteRequest(id)
      .then((res) => {
        setQuoteRequest(res.quoteRequest);
        setBilling(res.billingSummary);
      })
      .catch((err) => captureError(err, "quote-request-detail-load"))
      .finally(() => setLoading(false));
  }, [id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function handleAccept(responseId: string) {
    setAcceptingId(responseId);
    try {
      const res = await acceptQuoteResponse(responseId);
      load();
      Alert.alert("Booking created", "This artist is confirmed — pay now to lock in the slot.", [
        { text: "Later", style: "cancel" },
        { text: "Pay now", onPress: () => router.push({ pathname: "/booking/[id]", params: { id: res.bookingId } }) },
      ]);
    } catch (err) {
      Alert.alert("Couldn't accept", err instanceof ApiError ? err.message : "Please try again.");
    } finally {
      setAcceptingId(null);
    }
  }

  if (loading || !quoteRequest) {
    return (
      <GradientBackground>
        <SafeAreaView style={styles.safe} edges={["bottom"]}>
          <View style={styles.centered}><ActivityIndicator color={colors.pink} /></View>
        </SafeAreaView>
      </GradientBackground>
    );
  }

  return (
    <GradientBackground>
      <SafeAreaView style={styles.safe} edges={["bottom"]}>
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <Text style={styles.title}>{quoteRequest.eventName}</Text>
          <Text style={styles.subtitle}>
            {quoteRequest.eventCity} · {new Date(quoteRequest.eventDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
          </Text>

          {billing && billing.bookingsCount > 0 ? (
            <GlassCard style={styles.billingCard}>
              <View style={styles.billingHeadRow}>
                <Feather name="file-text" size={16} color={colors.purple} />
                <Text style={styles.billingTitle}>Consolidated billing</Text>
              </View>
              <View style={styles.row}>
                <Text style={styles.rowLabel}>Bookings confirmed</Text>
                <Text style={styles.rowValue}>{billing.bookingsCount}</Text>
              </View>
              <View style={styles.row}>
                <Text style={styles.rowLabel}>Total for this event</Text>
                <Text style={styles.rowValue}>₹{billing.totalAmount.toLocaleString("en-IN")}</Text>
              </View>
              <View style={styles.row}>
                <Text style={styles.rowLabel}>Status</Text>
                <Text style={styles.rowValue}>{billing.allPaid ? "All paid" : "Payment pending"}</Text>
              </View>
            </GlassCard>
          ) : null}

          {quoteRequest.lineItems.map((li, idx) => (
            <GlassCard key={li.id} style={styles.lineItemCard}>
              <View style={styles.lineItemHeadRow}>
                <Text style={styles.lineItemTitle}>#{idx + 1} · {li.category}{li.genre ? ` (${li.genre})` : ""}</Text>
                <Text style={styles.lineItemStatus}>{LINE_ITEM_STATUS_LABEL[li.status]}</Text>
              </View>
              {li.notes ? <Text style={styles.lineItemNotes}>{li.notes}</Text> : null}

              {li.responses.length === 0 ? (
                <Text style={styles.noResponses}>No quotes yet.</Text>
              ) : (
                li.responses.map((r) => {
                  const artistName = r.artist.stageName ?? r.artist.fullName ?? "Artist";
                  return (
                    <View key={r.id} style={styles.responseRow}>
                      <View style={styles.responseText}>
                        <Text style={styles.responseArtist}>{artistName}</Text>
                        <Text style={styles.responsePrice}>₹{r.quotedPrice.toLocaleString("en-IN")}</Text>
                        {r.message ? <Text style={styles.responseMessage}>{r.message}</Text> : null}
                        <Text style={styles.responseStatus}>
                          {r.status === "PENDING" ? "Awaiting your decision" : r.status === "ACCEPTED" ? "Accepted — booked" : r.status === "DECLINED" ? "Not selected" : "Expired"}
                        </Text>
                      </View>
                      {r.status === "PENDING" && li.status !== "FULFILLED" ? (
                        <GradientButton
                          label={acceptingId === r.id ? "Booking…" : "Accept"}
                          loading={acceptingId === r.id}
                          onPress={() => handleAccept(r.id)}
                          style={styles.acceptButton}
                        />
                      ) : null}
                    </View>
                  );
                })
              )}
            </GlassCard>
          ))}
        </ScrollView>
      </SafeAreaView>
    </GradientBackground>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  scroll: { padding: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.sm },
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },
  title: { fontFamily: fonts.display, fontSize: 22, color: colors.text },
  subtitle: { fontFamily: fonts.body, fontSize: 13, color: colors.textMute, marginBottom: spacing.sm },
  billingCard: { gap: spacing.xs, marginBottom: spacing.sm },
  billingHeadRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 2 },
  billingTitle: { fontFamily: fonts.bodySemiBold, fontSize: 14, color: colors.text },
  row: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 3 },
  rowLabel: { fontFamily: fonts.body, fontSize: 12.5, color: colors.textMute },
  rowValue: { fontFamily: fonts.bodyMedium, fontSize: 12.5, color: colors.text },
  lineItemCard: { gap: spacing.xs, marginBottom: spacing.xs },
  lineItemHeadRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm },
  lineItemTitle: { flex: 1, fontFamily: fonts.bodySemiBold, fontSize: 14, color: colors.text },
  lineItemStatus: { fontFamily: fonts.mono, fontSize: 10, color: colors.textMute },
  lineItemNotes: { fontFamily: fonts.body, fontSize: 12, color: colors.textMute },
  noResponses: { fontFamily: fonts.body, fontSize: 12.5, color: colors.textMute, fontStyle: "italic" },
  responseRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingTop: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    marginTop: spacing.xs,
  },
  responseText: { flex: 1, gap: 2 },
  responseArtist: { fontFamily: fonts.bodySemiBold, fontSize: 13, color: colors.text },
  responsePrice: { fontFamily: fonts.bodySemiBold, fontSize: 15, color: colors.purple },
  responseMessage: { fontFamily: fonts.body, fontSize: 12, color: colors.textMute },
  responseStatus: { fontFamily: fonts.body, fontSize: 11, color: colors.textMute },
  acceptButton: { paddingHorizontal: spacing.md },
});
