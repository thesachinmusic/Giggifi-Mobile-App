import { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { GradientBackground } from "@/components/GradientBackground";
import { GradientButton as Btn } from "@/components/GradientButton";
import { GlassCard } from "@/components/GlassCard";
import { DateField } from "@/components/DateField";
import { TimeField } from "@/components/TimeField";
import { StateCityField } from "@/components/StateCityField";
import { bookQuickMoment, ApiError, type QuickMomentFormat } from "@/lib/api";
import { QUICK_MOMENT_FORMAT_LABEL, QUICK_MOMENTS_MIN_LEAD_HOURS } from "@/lib/quick-moments";
import { colors, fonts, radii, spacing } from "@/theme";

// Comfortably past the server's minimum lead time by default, so the form
// opens already valid — the fields exist for the user to move it later or
// earlier (down to the minimum), not to force them through an empty picker
// for a value that has one sane starting point anyway.
function defaultSlotStart(): Date {
  return new Date(Date.now() + (QUICK_MOMENTS_MIN_LEAD_HOURS + 1) * 60 * 60 * 1000);
}

function combine(date: Date, hour: number): Date {
  const d = new Date(date);
  d.setHours(hour, 0, 0, 0);
  return d;
}

export default function QuickMomentsBookScreen() {
  const params = useLocalSearchParams<{
    artistId: string;
    format: QuickMomentFormat;
    stageName?: string;
    pricePerSlot?: string;
    distanceKm?: string;
    travelFee?: string;
    clientLat?: string;
    clientLng?: string;
  }>();
  const { artistId, format } = params;
  const stageName = params.stageName || "this artist";
  const pricePerSlot = params.pricePerSlot ? Number(params.pricePerSlot) : null;
  const distanceKm = params.distanceKm ? Number(params.distanceKm) : null;
  const travelFee = params.travelFee ? Number(params.travelFee) : 0;
  const clientLat = params.clientLat ? Number(params.clientLat) : null;
  const clientLng = params.clientLng ? Number(params.clientLng) : null;
  const totalPrice = pricePerSlot != null ? pricePerSlot + travelFee : null;

  const initial = defaultSlotStart();
  const [date, setDate] = useState<Date>(initial);
  const [hour, setHour] = useState<number>(initial.getHours());
  const [venueAddress, setVenueAddress] = useState("");
  const [eventCity, setEventCity] = useState("");
  const [specialRequests, setSpecialRequests] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const slotStart = combine(date, hour);
  const minStart = new Date(Date.now() + QUICK_MOMENTS_MIN_LEAD_HOURS * 60 * 60 * 1000);
  const leadTimeOk = slotStart >= minStart;
  const canSubmit = Boolean(venueAddress && eventCity && leadTimeOk && clientLat != null && clientLng != null);

  async function handleSubmit() {
    if (!canSubmit || clientLat == null || clientLng == null) return;
    setSubmitting(true);
    setError("");
    try {
      const { bookingId } = await bookQuickMoment({
        artistId,
        quickMomentFormat: format,
        slotStartTime: slotStart.toISOString(),
        venueAddress,
        eventCity,
        specialRequests: specialRequests || undefined,
        clientLat,
        clientLng,
      });
      router.replace({ pathname: "/booking/[id]", params: { id: bookingId } });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not book this Quick Moment. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <GradientBackground>
      <SafeAreaView style={styles.safe} edges={["bottom"]}>
        <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : "height"} keyboardVerticalOffset={80}>
          <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <GlassCard style={styles.summaryCard}>
              <Text style={styles.summaryEyebrow}>{QUICK_MOMENT_FORMAT_LABEL[format]?.toUpperCase()}</Text>
              <Text style={styles.summaryName}>{stageName}</Text>
              {pricePerSlot ? <Text style={styles.summaryPrice}>₹{pricePerSlot.toLocaleString("en-IN")} <Text style={styles.summaryPriceUnit}>/ slot</Text></Text> : null}
              {distanceKm != null ? (
                <View style={styles.breakdown}>
                  <View style={styles.breakdownRow}>
                    <Text style={styles.breakdownLabel}>Performance</Text>
                    <Text style={styles.breakdownValue}>₹{(pricePerSlot ?? 0).toLocaleString("en-IN")}</Text>
                  </View>
                  <View style={styles.breakdownRow}>
                    <Text style={styles.breakdownLabel}>Travel ({distanceKm.toFixed(1)} km)</Text>
                    <Text style={styles.breakdownValue}>{travelFee > 0 ? `₹${travelFee.toLocaleString("en-IN")}` : "Free"}</Text>
                  </View>
                  <View style={styles.breakdownTotalRow}>
                    <Text style={styles.breakdownTotalLabel}>Subtotal</Text>
                    <Text style={styles.breakdownTotalValue}>₹{(totalPrice ?? 0).toLocaleString("en-IN")}</Text>
                  </View>
                  <Text style={styles.breakdownNote}>Platform fee & GST added at checkout.</Text>
                </View>
              ) : null}
            </GlassCard>

            <FormLabel text="WHEN" />
            <View style={styles.row}>
              <DateField label="DATE" value={date} onChange={setDate} minimumDate={new Date()} />
              <TimeField label="TIME" hour={hour} onChange={setHour} />
            </View>
            {!leadTimeOk ? (
              <Text style={styles.hint}>Quick Moments need at least {QUICK_MOMENTS_MIN_LEAD_HOURS} hours&apos; notice — pick a later time.</Text>
            ) : null}

            <FormLabel text="VENUE ADDRESS" />
            <TextInput
              value={venueAddress}
              onChangeText={setVenueAddress}
              placeholder="Where should the artist come to?"
              placeholderTextColor={colors.textMute}
              style={styles.input}
              multiline
            />

            <StateCityField city={eventCity} onChangeCity={setEventCity} cityLabel="CITY" />

            <FormLabel text="NOTES (OPTIONAL)" />
            <TextInput
              value={specialRequests}
              onChangeText={setSpecialRequests}
              placeholder="Anything the artist should know"
              placeholderTextColor={colors.textMute}
              style={[styles.input, styles.inputMultiline]}
              multiline
            />

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <Btn
              label={totalPrice ? `Book for ₹${totalPrice.toLocaleString("en-IN")}` : "Book this Quick Moment"}
              onPress={handleSubmit}
              disabled={!canSubmit}
              loading={submitting}
              style={styles.submitButton}
            />

            <View style={styles.escrow}>
              <Feather name="shield" size={16} color={colors.purple} />
              <Text style={styles.escrowText}>Payment is held securely until the artist confirms they&apos;ve arrived and performed.</Text>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </GradientBackground>
  );
}

function FormLabel({ text }: { text: string }) {
  return <Text style={styles.label}>{text}</Text>;
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },
  scroll: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.xxl, gap: spacing.sm },
  summaryCard: { gap: 4, marginBottom: spacing.sm },
  summaryEyebrow: { fontFamily: fonts.mono, fontSize: 10, color: colors.orange, letterSpacing: 1 },
  summaryName: { fontFamily: fonts.display, fontSize: 20, color: colors.text },
  summaryPrice: { fontFamily: fonts.displayMedium, fontSize: 15, color: colors.text, marginTop: 2 },
  summaryPriceUnit: { fontFamily: fonts.body, fontSize: 12, color: colors.textMute },
  breakdown: { marginTop: spacing.sm, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.line, gap: 4 },
  breakdownRow: { flexDirection: "row", justifyContent: "space-between" },
  breakdownLabel: { fontFamily: fonts.body, fontSize: 12.5, color: colors.textDim },
  breakdownValue: { fontFamily: fonts.body, fontSize: 12.5, color: colors.textDim },
  breakdownTotalRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 4 },
  breakdownTotalLabel: { fontFamily: fonts.bodySemiBold, fontSize: 14, color: colors.text },
  breakdownTotalValue: { fontFamily: fonts.bodySemiBold, fontSize: 14, color: colors.text },
  breakdownNote: { fontFamily: fonts.body, fontSize: 10.5, color: colors.textMute, marginTop: 2 },
  label: {
    fontFamily: fonts.mono,
    fontSize: 10,
    color: colors.textMute,
    letterSpacing: 0.5,
    marginTop: spacing.sm,
    marginBottom: 2,
  },
  row: { flexDirection: "row", gap: spacing.sm },
  hint: { fontFamily: fonts.body, fontSize: 12, color: colors.warn, marginTop: 2 },
  input: {
    backgroundColor: colors.ink2,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.sm,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.text,
  },
  inputMultiline: { minHeight: 70, textAlignVertical: "top" },
  error: { fontFamily: fonts.body, fontSize: 12.5, color: colors.err, marginTop: spacing.xs },
  submitButton: { marginTop: spacing.lg },
  escrow: {
    flexDirection: "row",
    gap: spacing.sm,
    alignItems: "flex-start",
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  escrowText: { flex: 1, fontFamily: fonts.body, fontSize: 12, lineHeight: 17, color: colors.textMute },
});
