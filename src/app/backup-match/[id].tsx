import { useCallback, useState } from "react";
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { GradientBackground } from "@/components/GradientBackground";
import { GradientButton } from "@/components/GradientButton";
import { GlassCard } from "@/components/GlassCard";
import { fetchBackupMatchAttempt, approveBackupMatch, declineBackupMatch, ApiError, type BackupMatchAttempt } from "@/lib/api";
import { captureError } from "@/lib/telemetry";
import { colors, fonts, radii, spacing } from "@/theme";

export default function BackupMatchScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [attempt, setAttempt] = useState<BackupMatchAttempt | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    if (!id) return;
    fetchBackupMatchAttempt(id)
      .then((res) => setAttempt(res.attempt))
      .catch((err) => captureError(err, "backup-match-load"))
      .finally(() => setLoading(false));
  }, [id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function handleApprove() {
    if (!attempt) return;
    setBusy(true);
    try {
      const res = await approveBackupMatch(attempt.id);
      router.replace({ pathname: "/booking/[id]", params: { id: res.bookingId } });
    } catch (err) {
      Alert.alert("Couldn't confirm", err instanceof ApiError ? err.message : "Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function handleDecline() {
    if (!attempt) return;
    Alert.alert("Decline this replacement?", "You can still book another artist yourself for this date.", [
      { text: "Never mind", style: "cancel" },
      {
        text: "Decline",
        style: "destructive",
        onPress: async () => {
          setBusy(true);
          try {
            await declineBackupMatch(attempt.id);
            router.back();
          } catch (err) {
            Alert.alert("Couldn't decline", err instanceof ApiError ? err.message : "Please try again.");
          } finally {
            setBusy(false);
          }
        },
      },
    ]);
  }

  if (loading || !attempt) {
    return (
      <GradientBackground>
        <SafeAreaView style={styles.safe} edges={["bottom"]}>
          <View style={styles.centered}><ActivityIndicator color={colors.pink} /></View>
        </SafeAreaView>
      </GradientBackground>
    );
  }

  const cancelledName = attempt.cancelledArtist.stageName ?? attempt.cancelledArtist.fullName ?? "Your artist";
  const urgent = attempt.noticeWindowHours < 72;

  return (
    <GradientBackground>
      <SafeAreaView style={styles.safe} edges={["bottom"]}>
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <Text style={styles.eyebrow}>{attempt.originalBooking.eventName}</Text>

          {attempt.status === "AUTO_MATCHED" && attempt.matchedArtist ? (
            <>
              <View style={styles.iconWrap}>
                <Feather name="refresh-cw" size={22} color={colors.purple} />
              </View>
              <Text style={styles.title}>{cancelledName} had to cancel — here's a replacement</Text>
              <Text style={styles.subtitle}>Same date and city. Review the price below and confirm to book them.</Text>

              <GlassCard style={styles.compareCard}>
                <View style={styles.compareRow}>
                  <Text style={styles.compareLabel}>Was</Text>
                  <Text style={styles.compareArtist}>{cancelledName}</Text>
                  <Text style={styles.comparePrice}>₹{(attempt.originalBooking.quotedPrice ?? 0).toLocaleString("en-IN")}</Text>
                </View>
                <View style={styles.compareDivider} />
                <View style={styles.compareRow}>
                  <Text style={styles.compareLabel}>Now</Text>
                  <Text style={styles.compareArtist}>{attempt.matchedArtist.stageName ?? attempt.matchedArtist.fullName ?? "Replacement artist"}</Text>
                  <Text style={[styles.comparePrice, styles.comparePriceNew]}>₹{(attempt.matchedArtist.ratePerEvent ?? 0).toLocaleString("en-IN")}</Text>
                </View>
              </GlassCard>

              <GradientButton label={busy ? "Confirming…" : "Approve & book this artist"} onPress={handleApprove} disabled={busy} loading={busy} style={styles.primaryButton} />
              <GradientButton label="Decline" onPress={handleDecline} disabled={busy} variant="destructive" style={styles.declineButton} />
            </>
          ) : attempt.status === "ESCALATED_NO_MATCH" ? (
            <>
              <View style={styles.iconWrap}>
                <Feather name="clock" size={22} color="#f59e0b" />
              </View>
              <Text style={styles.title}>{cancelledName} had to cancel</Text>
              <Text style={styles.subtitle}>
                {urgent
                  ? "This is close to your event date and we don't have an automatic match yet — we may not find a replacement in time. Our team has been alerted and is working on it now."
                  : "We're working on finding you a backup — our team has been alerted and doesn't have an automatic match yet, but there's still time before your event."}
              </Text>
              <GlassCard style={styles.statusCard}>
                <Feather name="loader" size={16} color={colors.textMute} />
                <Text style={styles.statusText}>We're working on finding you a backup. You'll be notified the moment we do.</Text>
              </GlassCard>
              <Text style={styles.paymentNote}>Your payment for the original booking has been refunded.</Text>
            </>
          ) : (
            <>
              <View style={styles.iconWrap}>
                <Feather name="check-circle" size={22} color={colors.ok} />
              </View>
              <Text style={styles.title}>This is resolved</Text>
              <Text style={styles.subtitle}>
                {attempt.newBookingId ? "You approved a replacement artist for this event." : "You declined the replacement — you're free to book someone else for this date."}
              </Text>
              {attempt.newBookingId ? (
                <GradientButton
                  label="View booking"
                  onPress={() => router.push({ pathname: "/booking/[id]", params: { id: attempt.newBookingId! } })}
                  style={styles.primaryButton}
                />
              ) : null}
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </GradientBackground>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  scroll: { padding: spacing.lg, paddingBottom: spacing.xxl, alignItems: "center" },
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },
  eyebrow: { fontFamily: fonts.mono, fontSize: 11, color: colors.textMute, letterSpacing: 0.5, marginBottom: spacing.md, textAlign: "center" },
  iconWrap: { width: 52, height: 52, borderRadius: 26, backgroundColor: "rgba(255,255,255,0.06)", alignItems: "center", justifyContent: "center", marginBottom: spacing.md },
  title: { fontFamily: fonts.display, fontSize: 19, color: colors.text, textAlign: "center", marginBottom: spacing.xs },
  subtitle: { fontFamily: fonts.body, fontSize: 13.5, color: colors.textMute, textAlign: "center", lineHeight: 20, marginBottom: spacing.lg, paddingHorizontal: spacing.sm },
  compareCard: { width: "100%", gap: spacing.sm, marginBottom: spacing.lg },
  compareRow: { gap: 2 },
  compareLabel: { fontFamily: fonts.mono, fontSize: 10, color: colors.textMute, letterSpacing: 0.5 },
  compareArtist: { fontFamily: fonts.bodySemiBold, fontSize: 14, color: colors.text },
  comparePrice: { fontFamily: fonts.bodySemiBold, fontSize: 18, color: colors.textMute },
  comparePriceNew: { color: colors.purple },
  compareDivider: { height: 1, backgroundColor: colors.line },
  primaryButton: { width: "100%", marginBottom: spacing.sm },
  declineButton: { width: "100%" },
  statusCard: { width: "100%", flexDirection: "row", alignItems: "center", gap: spacing.sm, marginBottom: spacing.md },
  statusText: { flex: 1, fontFamily: fonts.body, fontSize: 12.5, color: colors.textMute, lineHeight: 18 },
  paymentNote: { fontFamily: fonts.body, fontSize: 12, color: colors.textMute, textAlign: "center" },
});
