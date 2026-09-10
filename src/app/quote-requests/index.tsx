import { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import { GradientBackground } from "@/components/GradientBackground";
import { GradientButton } from "@/components/GradientButton";
import { GlassCard } from "@/components/GlassCard";
import { fetchMyQuoteRequests, type QuoteRequestListItem, type QuoteRequestStatus } from "@/lib/api";
import { captureError } from "@/lib/telemetry";
import { colors, fonts, radii, spacing } from "@/theme";

const STATUS_LABEL: Record<QuoteRequestStatus, string> = {
  OPEN: "Awaiting quotes",
  PARTIALLY_FULFILLED: "Partially booked",
  FULFILLED: "Fully booked",
  EXPIRED: "Expired",
  CANCELLED: "Cancelled",
};

const STATUS_COLOR: Record<QuoteRequestStatus, string> = {
  OPEN: colors.purple,
  PARTIALLY_FULFILLED: "#f59e0b",
  FULFILLED: "#22c55e",
  EXPIRED: colors.textMute,
  CANCELLED: colors.textMute,
};

export default function QuoteRequestsScreen() {
  const [items, setItems] = useState<QuoteRequestListItem[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    fetchMyQuoteRequests()
      .then((res) => setItems(res.quoteRequests))
      .catch((err) => captureError(err, "quote-requests-load"))
      .finally(() => setLoading(false));
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  return (
    <GradientBackground>
      <SafeAreaView style={styles.safe} edges={["bottom"]}>
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <Text style={styles.title}>Get a Quote</Text>
          <Text style={styles.subtitle}>Describe every performer you need for an event in one request — compare quotes side by side.</Text>

          <GradientButton label="New quote request" onPress={() => router.push("/quote-requests/new")} style={styles.newButton} />

          {loading ? (
            <View style={styles.centered}><ActivityIndicator color={colors.pink} /></View>
          ) : items.length === 0 ? (
            <GlassCard style={styles.emptyCard}>
              <Feather name="file-text" size={20} color={colors.textMute} />
              <Text style={styles.emptyText}>No quote requests yet — create one to ask several artists at once.</Text>
            </GlassCard>
          ) : (
            items.map((qr) => {
              const respondedCount = qr.lineItems.filter((li) => li._count.responses > 0).length;
              return (
                <Pressable key={qr.id} onPress={() => router.push({ pathname: "/quote-requests/[id]", params: { id: qr.id } })}>
                  <GlassCard style={styles.card}>
                    <View style={styles.cardHeadRow}>
                      <Text style={styles.cardTitle} numberOfLines={1}>{qr.eventName}</Text>
                      <View style={[styles.statusPill, { backgroundColor: `${STATUS_COLOR[qr.status]}22` }]}>
                        <Text style={[styles.statusText, { color: STATUS_COLOR[qr.status] }]}>{STATUS_LABEL[qr.status]}</Text>
                      </View>
                    </View>
                    <Text style={styles.cardMeta}>
                      {qr.eventCity} · {new Date(qr.eventDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                    </Text>
                    <Text style={styles.cardMeta}>
                      {qr.lineItems.length} need{qr.lineItems.length === 1 ? "" : "s"} · {respondedCount} with quotes
                    </Text>
                  </GlassCard>
                </Pressable>
              );
            })
          )}
        </ScrollView>
      </SafeAreaView>
    </GradientBackground>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  scroll: { padding: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.sm },
  title: { fontFamily: fonts.display, fontSize: 22, color: colors.text },
  subtitle: { fontFamily: fonts.body, fontSize: 13, color: colors.textMute, lineHeight: 18, marginBottom: spacing.sm },
  newButton: { marginBottom: spacing.md },
  centered: { paddingVertical: spacing.xxl, alignItems: "center" },
  emptyCard: { alignItems: "center", gap: spacing.sm, paddingVertical: spacing.lg },
  emptyText: { fontFamily: fonts.body, fontSize: 13, color: colors.textMute, textAlign: "center" },
  card: { gap: 4, marginBottom: spacing.xs },
  cardHeadRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm },
  cardTitle: { flex: 1, fontFamily: fonts.bodySemiBold, fontSize: 15, color: colors.text },
  statusPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: radii.pill },
  statusText: { fontFamily: fonts.mono, fontSize: 10 },
  cardMeta: { fontFamily: fonts.body, fontSize: 12, color: colors.textMute },
});
