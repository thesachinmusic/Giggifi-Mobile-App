import { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import { GradientBackground } from "@/components/GradientBackground";
import { GlassCard } from "@/components/GlassCard";
import { fetchMyRecurringSeries, type RecurringSeriesSummary, type RecurringSeriesStatus } from "@/lib/api";
import { captureError } from "@/lib/telemetry";
import { colors, fonts, radii, spacing } from "@/theme";

const CADENCE_LABEL: Record<string, string> = { WEEKLY: "Weekly", BIWEEKLY: "Every 2 weeks", MONTHLY: "Monthly" };
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const STATUS_LABEL: Record<RecurringSeriesStatus, string> = { ACTIVE: "Active", PAUSED: "Paused", CANCELLED: "Cancelled" };
const STATUS_COLOR: Record<RecurringSeriesStatus, string> = { ACTIVE: "#22c55e", PAUSED: "#f59e0b", CANCELLED: colors.textMute };

export default function RecurringSeriesListScreen() {
  const [series, setSeries] = useState<RecurringSeriesSummary[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    fetchMyRecurringSeries()
      .then((res) => setSeries(res.series))
      .catch((err) => captureError(err, "recurring-series-load"))
      .finally(() => setLoading(false));
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  return (
    <GradientBackground>
      <SafeAreaView style={styles.safe} edges={["bottom"]}>
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <Text style={styles.title}>Recurring Bookings</Text>
          <Text style={styles.subtitle}>Set one up from any artist's profile page.</Text>

          {loading ? (
            <View style={styles.centered}><ActivityIndicator color={colors.pink} /></View>
          ) : series.length === 0 ? (
            <GlassCard style={styles.emptyCard}>
              <Feather name="repeat" size={20} color={colors.textMute} />
              <Text style={styles.emptyText}>No recurring bookings yet.</Text>
            </GlassCard>
          ) : (
            series.map((s) => {
              const needsReconfirm = new Date(s.rateLockExpiresAt).getTime() <= Date.now();
              const artistName = s.artist.stageName ?? s.artist.fullName ?? "Artist";
              return (
                <Pressable key={s.id} onPress={() => router.push({ pathname: "/recurring-series/[id]", params: { id: s.id } })}>
                  <GlassCard style={styles.card}>
                    <View style={styles.cardHeadRow}>
                      <Text style={styles.cardTitle} numberOfLines={1}>{s.eventName}</Text>
                      <View style={[styles.statusPill, { backgroundColor: `${STATUS_COLOR[s.status]}22` }]}>
                        <Text style={[styles.statusText, { color: STATUS_COLOR[s.status] }]}>{STATUS_LABEL[s.status]}</Text>
                      </View>
                    </View>
                    <Text style={styles.cardMeta}>{artistName} · {s.eventCity}</Text>
                    <Text style={styles.cardMeta}>{CADENCE_LABEL[s.cadence]} on {DAYS[s.dayOfWeek]}s · ₹{s.rate.toLocaleString("en-IN")}/occurrence</Text>
                    {needsReconfirm ? (
                      <View style={styles.reconfirmBadge}>
                        <Feather name="alert-circle" size={12} color="#f59e0b" />
                        <Text style={styles.reconfirmText}>Rate needs reconfirmation</Text>
                      </View>
                    ) : null}
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
  subtitle: { fontFamily: fonts.body, fontSize: 13, color: colors.textMute, marginBottom: spacing.sm },
  centered: { paddingVertical: spacing.xxl, alignItems: "center" },
  emptyCard: { alignItems: "center", gap: spacing.sm, paddingVertical: spacing.lg },
  emptyText: { fontFamily: fonts.body, fontSize: 13, color: colors.textMute, textAlign: "center" },
  card: { gap: 4, marginBottom: spacing.xs },
  cardHeadRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm },
  cardTitle: { flex: 1, fontFamily: fonts.bodySemiBold, fontSize: 15, color: colors.text },
  statusPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: radii.pill },
  statusText: { fontFamily: fonts.mono, fontSize: 10 },
  cardMeta: { fontFamily: fonts.body, fontSize: 12, color: colors.textMute },
  reconfirmBadge: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 4 },
  reconfirmText: { fontFamily: fonts.bodyMedium, fontSize: 11.5, color: "#f59e0b" },
});
