import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import { GradientBackground } from "@/components/GradientBackground";
import { GradientButton } from "@/components/GradientButton";
import { DateField } from "@/components/DateField";
import { TimeField } from "@/components/TimeField";
import { KeyboardAvoidingScreen } from "@/components/KeyboardAvoidingScreen";
import { ApiError, createRecurringSeries, type RecurringCadence } from "@/lib/api";
import { colors, fonts, radii, spacing } from "@/theme";

const CADENCES: { key: RecurringCadence; label: string }[] = [
  { key: "WEEKLY", label: "Weekly" },
  { key: "BIWEEKLY", label: "Every 2 weeks" },
  { key: "MONTHLY", label: "Monthly" },
];

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function NewRecurringSeriesScreen() {
  const { artistId, artistName, ratePerEvent } = useLocalSearchParams<{ artistId: string; artistName: string; ratePerEvent: string }>();

  const [cadence, setCadence] = useState<RecurringCadence>("WEEKLY");
  const [dayOfWeek, setDayOfWeek] = useState(new Date().getDay());
  const [hour, setHour] = useState(19);
  const [eventName, setEventName] = useState(`Recurring set with ${artistName ?? "artist"}`);
  const [eventCity, setEventCity] = useState("");
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [ongoing, setOngoing] = useState(true);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const canSubmit = eventName.trim().length > 1 && eventCity.trim().length > 1 && Boolean(startDate) && (ongoing || Boolean(endDate));

  async function handleSubmit() {
    if (!canSubmit || !startDate || !artistId) return;
    setSaving(true);
    setError("");
    try {
      const res = await createRecurringSeries({
        artistId,
        cadence,
        dayOfWeek,
        time: `${String(hour).padStart(2, "0")}:00`,
        eventName: eventName.trim(),
        eventCity: eventCity.trim(),
        startDate: startDate.toISOString(),
        endDate: !ongoing && endDate ? endDate.toISOString() : undefined,
      });
      router.replace({ pathname: "/recurring-series/[id]", params: { id: res.series.id } });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't set up the recurring booking. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <GradientBackground>
      <SafeAreaView style={styles.safe} edges={["bottom"]}>
        <KeyboardAvoidingScreen>
          <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <Text style={styles.title}>Book on a recurring schedule</Text>
            <Text style={styles.subtitle}>
              {artistName ? `${artistName} · ` : ""}₹{ratePerEvent ? Number(ratePerEvent).toLocaleString("en-IN") : "—"} per occurrence, locked in for 3 months.
            </Text>

            <Text style={styles.fieldLabel}>HOW OFTEN</Text>
            <View style={styles.pillRow}>
              {CADENCES.map((c) => (
                <Pressable key={c.key} style={[styles.pill, cadence === c.key && styles.pillSelected]} onPress={() => setCadence(c.key)}>
                  <Text style={[styles.pillText, cadence === c.key && styles.pillTextSelected]}>{c.label}</Text>
                </Pressable>
              ))}
            </View>

            <Text style={styles.fieldLabel}>DAY OF THE WEEK</Text>
            <View style={styles.pillRow}>
              {DAYS.map((d, idx) => (
                <Pressable key={d} style={[styles.dayPill, dayOfWeek === idx && styles.pillSelected]} onPress={() => setDayOfWeek(idx)}>
                  <Text style={[styles.pillText, dayOfWeek === idx && styles.pillTextSelected]}>{d}</Text>
                </Pressable>
              ))}
            </View>

            <TimeField label="TIME" hour={hour} onChange={setHour} />

            <Text style={styles.fieldLabel}>EVENT NAME</Text>
            <TextInput
              value={eventName}
              onChangeText={setEventName}
              placeholder="e.g. Friday Jazz Night"
              placeholderTextColor={colors.textMute}
              style={styles.input}
            />

            <Text style={styles.fieldLabel}>CITY</Text>
            <TextInput
              value={eventCity}
              onChangeText={setEventCity}
              placeholder="e.g. Mumbai"
              placeholderTextColor={colors.textMute}
              style={styles.input}
            />

            <DateField label="STARTS ON" value={startDate} onChange={setStartDate} />

            <Text style={styles.fieldLabel}>ENDS</Text>
            <View style={styles.pillRow}>
              <Pressable style={[styles.pill, ongoing && styles.pillSelected]} onPress={() => setOngoing(true)}>
                <Text style={[styles.pillText, ongoing && styles.pillTextSelected]}>Ongoing</Text>
              </Pressable>
              <Pressable style={[styles.pill, !ongoing && styles.pillSelected]} onPress={() => setOngoing(false)}>
                <Text style={[styles.pillText, !ongoing && styles.pillTextSelected]}>Pick an end date</Text>
              </Pressable>
            </View>
            {!ongoing ? <DateField label="ENDS ON" value={endDate} onChange={setEndDate} minimumDate={startDate ?? undefined} /> : null}

            <Text style={styles.note}>
              Each occurrence is a real booking request the artist accepts or declines individually — nothing is ever auto-charged. You'll pay for each one after it's accepted, same as any other booking.
            </Text>

            {error ? <Text style={styles.error}>{error}</Text> : null}
            <GradientButton label="Set up recurring booking" onPress={handleSubmit} disabled={!canSubmit} loading={saving} style={styles.submitButton} />
          </ScrollView>
        </KeyboardAvoidingScreen>
      </SafeAreaView>
    </GradientBackground>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  scroll: { padding: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.xs },
  title: { fontFamily: fonts.display, fontSize: 20, color: colors.text },
  subtitle: { fontFamily: fonts.body, fontSize: 13, color: colors.textMute, lineHeight: 18, marginBottom: spacing.sm },
  fieldLabel: { fontFamily: fonts.mono, fontSize: 10, color: colors.textMute, letterSpacing: 0.5, marginTop: spacing.sm },
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
  pillRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 4 },
  pill: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: radii.pill, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.ink2 },
  dayPill: { width: 44, alignItems: "center", paddingVertical: 8, borderRadius: radii.pill, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.ink2 },
  pillSelected: { borderColor: colors.purple, backgroundColor: "rgba(168,85,247,0.18)" },
  pillText: { fontFamily: fonts.bodyMedium, fontSize: 12.5, color: colors.textDim },
  pillTextSelected: { color: "#fff" },
  note: { fontFamily: fonts.body, fontSize: 11.5, color: colors.textMute, lineHeight: 16, marginTop: spacing.md },
  error: { fontFamily: fonts.body, fontSize: 13, color: colors.err, marginTop: spacing.sm },
  submitButton: { marginTop: spacing.md },
});
