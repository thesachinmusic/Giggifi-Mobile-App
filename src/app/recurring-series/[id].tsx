import { useCallback, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { GradientBackground } from "@/components/GradientBackground";
import { GradientButton } from "@/components/GradientButton";
import { GlassCard } from "@/components/GlassCard";
import {
  fetchRecurringSeriesDetail,
  pauseRecurringSeries,
  resumeRecurringSeries,
  cancelRecurringSeries,
  skipNextRecurringOccurrence,
  reconfirmRecurringSeriesRate,
  ApiError,
  type RecurringSeriesSummary,
  type RecurringOccurrenceStatus,
} from "@/lib/api";
import { captureError } from "@/lib/telemetry";
import { colors, fonts, radii, spacing } from "@/theme";

const CADENCE_LABEL: Record<string, string> = { WEEKLY: "Weekly", BIWEEKLY: "Every 2 weeks", MONTHLY: "Monthly" };
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const OCCURRENCE_LABEL: Record<RecurringOccurrenceStatus, string> = {
  PENDING_ARTIST_ACCEPTANCE: "Waiting on artist",
  ACCEPTED: "Accepted",
  DECLINED_BY_ARTIST: "Declined",
  SKIPPED: "Skipped",
  BACKUP_FILLED: "Filled by backup artist",
  FULFILLED: "Completed",
};

export default function RecurringSeriesDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [series, setSeries] = useState<RecurringSeriesSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    if (!id) return;
    fetchRecurringSeriesDetail(id)
      .then((res) => setSeries(res.series))
      .catch((err) => captureError(err, "recurring-series-detail-load"))
      .finally(() => setLoading(false));
  }, [id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function runAction(action: () => Promise<unknown>) {
    setBusy(true);
    try {
      await action();
      load();
    } catch (err) {
      Alert.alert("Couldn't do that", err instanceof ApiError ? err.message : "Please try again.");
    } finally {
      setBusy(false);
    }
  }

  if (loading || !series) {
    return (
      <GradientBackground>
        <SafeAreaView style={styles.safe} edges={["bottom"]}>
          <View style={styles.centered}><ActivityIndicator color={colors.pink} /></View>
        </SafeAreaView>
      </GradientBackground>
    );
  }

  const artistName = series.artist.stageName ?? series.artist.fullName ?? "Artist";
  const needsReconfirm = new Date(series.rateLockExpiresAt).getTime() <= Date.now();

  return (
    <GradientBackground>
      <SafeAreaView style={styles.safe} edges={["bottom"]}>
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <Text style={styles.title}>{series.eventName}</Text>
          <Text style={styles.subtitle}>{artistName} · {series.eventCity}</Text>
          <Text style={styles.subtitle}>{CADENCE_LABEL[series.cadence]} on {DAYS[series.dayOfWeek]}s at {series.time} · ₹{series.rate.toLocaleString("en-IN")}/occurrence</Text>

          {needsReconfirm ? (
            <GlassCard style={styles.reconfirmCard}>
              <Text style={styles.reconfirmTitle}>Rate reconfirmation needed</Text>
              <Text style={styles.reconfirmBody}>
                This series' 3-month rate lock has expired — new occurrences won't be scheduled until you reconfirm.
              </Text>
              <GradientButton
                label={`Reconfirm ₹${series.rate.toLocaleString("en-IN")}/occurrence`}
                onPress={() => runAction(() => reconfirmRecurringSeriesRate(series.id))}
                loading={busy}
                style={styles.actionButton}
              />
            </GlassCard>
          ) : null}

          {series.status !== "CANCELLED" ? (
            <View style={styles.actionsRow}>
              {series.status === "ACTIVE" ? (
                <Pressable style={styles.secondaryButton} onPress={() => runAction(() => pauseRecurringSeries(series.id))} disabled={busy}>
                  <Feather name="pause" size={14} color={colors.text} />
                  <Text style={styles.secondaryButtonText}>Pause</Text>
                </Pressable>
              ) : (
                <Pressable style={styles.secondaryButton} onPress={() => runAction(() => resumeRecurringSeries(series.id))} disabled={busy}>
                  <Feather name="play" size={14} color={colors.text} />
                  <Text style={styles.secondaryButtonText}>Resume</Text>
                </Pressable>
              )}
              <Pressable style={styles.secondaryButton} onPress={() => runAction(() => skipNextRecurringOccurrence(series.id))} disabled={busy}>
                <Feather name="skip-forward" size={14} color={colors.text} />
                <Text style={styles.secondaryButtonText}>Skip next</Text>
              </Pressable>
              <Pressable
                style={styles.secondaryButton}
                onPress={() =>
                  Alert.alert("Cancel this series?", "Future occurrences will stop being scheduled. Already-accepted bookings aren't affected.", [
                    { text: "Keep it", style: "cancel" },
                    { text: "Cancel series", style: "destructive", onPress: () => runAction(() => cancelRecurringSeries(series.id)) },
                  ])
                }
                disabled={busy}
              >
                <Feather name="x-circle" size={14} color={colors.err} />
                <Text style={[styles.secondaryButtonText, { color: colors.err }]}>Cancel</Text>
              </Pressable>
            </View>
          ) : null}

          <Text style={styles.sectionTitle}>Occurrences</Text>
          {series.occurrences.length === 0 ? (
            <Text style={styles.emptyText}>No occurrences yet — they're created automatically a week before each date.</Text>
          ) : (
            series.occurrences.map((occ) => (
              <GlassCard key={occ.id} style={styles.occCard}>
                <View style={styles.occRow}>
                  <Text style={styles.occDate}>
                    {new Date(occ.scheduledDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                  </Text>
                  <Text style={styles.occStatus}>{OCCURRENCE_LABEL[occ.status]}</Text>
                </View>
                {occ.booking ? (
                  <View style={styles.occBookingRow}>
                    <Text style={styles.occBookingAmount}>₹{(occ.booking.totalAmount ?? 0).toLocaleString("en-IN")}</Text>
                    {occ.booking.status === "AWAITING_PAYMENT" ? (
                      <GradientButton
                        label="Pay now"
                        onPress={() => router.push({ pathname: "/booking/[id]", params: { id: occ.booking!.id } })}
                        style={styles.payButton}
                      />
                    ) : (
                      <Pressable onPress={() => router.push({ pathname: "/booking/[id]", params: { id: occ.booking!.id } })}>
                        <Text style={styles.viewBookingLink}>View booking</Text>
                      </Pressable>
                    )}
                  </View>
                ) : null}
              </GlassCard>
            ))
          )}
        </ScrollView>
      </SafeAreaView>
    </GradientBackground>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  scroll: { padding: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.xs },
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },
  title: { fontFamily: fonts.display, fontSize: 20, color: colors.text },
  subtitle: { fontFamily: fonts.body, fontSize: 12.5, color: colors.textMute },
  reconfirmCard: { gap: spacing.xs, marginTop: spacing.md, borderColor: "rgba(245,158,11,0.4)", borderWidth: 1 },
  reconfirmTitle: { fontFamily: fonts.bodySemiBold, fontSize: 14, color: "#f59e0b" },
  reconfirmBody: { fontFamily: fonts.body, fontSize: 12.5, color: colors.textMute, lineHeight: 18 },
  actionButton: { marginTop: spacing.xs },
  actionsRow: { flexDirection: "row", gap: spacing.xs, marginTop: spacing.md, flexWrap: "wrap" },
  secondaryButton: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 12, paddingVertical: 9, borderRadius: radii.pill,
    borderWidth: 1, borderColor: colors.line, backgroundColor: "rgba(255,255,255,0.035)",
  },
  secondaryButtonText: { fontFamily: fonts.bodyMedium, fontSize: 12.5, color: colors.text },
  sectionTitle: { fontFamily: fonts.display, fontSize: 16, color: colors.text, marginTop: spacing.lg },
  emptyText: { fontFamily: fonts.body, fontSize: 13, color: colors.textMute },
  occCard: { gap: 6, marginBottom: spacing.xs },
  occRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  occDate: { fontFamily: fonts.bodySemiBold, fontSize: 13.5, color: colors.text },
  occStatus: { fontFamily: fonts.mono, fontSize: 10.5, color: colors.textMute },
  occBookingRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  occBookingAmount: { fontFamily: fonts.bodySemiBold, fontSize: 14, color: colors.purple },
  payButton: { paddingHorizontal: spacing.md },
  viewBookingLink: { fontFamily: fonts.bodyMedium, fontSize: 12.5, color: colors.purple },
});
