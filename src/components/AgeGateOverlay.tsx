import { useState } from "react";
import { Modal, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import DateTimePicker, { type DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { Feather } from "@expo/vector-icons";
import { GradientBackground } from "@/components/GradientBackground";
import { GlassCard } from "@/components/GlassCard";
import { GradientButton } from "@/components/GradientButton";
import { useAuth } from "@/lib/auth-context";
import { confirmDateOfBirth, ApiError } from "@/lib/api";
import { captureError } from "@/lib/telemetry";
import { colors, fonts, radii, spacing } from "@/theme";

// Formats a Date using its LOCAL calendar fields, not toISOString() (which
// converts to UTC first and can shift the date back a day depending on the
// device's timezone) — matches how the website's <input type="date"> submits
// a plain YYYY-MM-DD, which the backend then parses as UTC midnight.
function toDateOnlyString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// Blocking, full-screen age-gate — Play Store + DPDP require confirming a
// user is 18+ before they can use the app. Mounted once at the app root
// (see _layout.tsx) inside AuthProvider, and shows itself automatically
// whenever a logged-in user's dateOfBirth is still null; there's no route
// to navigate to, it just overlays whatever screen is underneath until
// confirmDateOfBirth() succeeds and refreshSession() clears the gate. The
// actual 18+ check happens server-side (see confirm-dob route) — this
// screen never persists an under-18 date, it just surfaces the error.
export function AgeGateOverlay() {
  const { user, isLoading, refreshSession } = useAuth();
  const [date, setDate] = useState<Date | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [draft, setDraft] = useState(new Date());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  if (isLoading || !user || user.dateOfBirth) return null;

  function openPicker() {
    setDraft(date ?? new Date());
    setPickerOpen(true);
  }

  function handleChange(event: DateTimePickerEvent, next?: Date) {
    if (Platform.OS === "android") {
      setPickerOpen(false);
      if (event.type === "set" && next) setDate(next);
      return;
    }
    if (next) setDraft(next);
  }

  async function handleConfirm() {
    if (!date) {
      setError("Please select your date of birth.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      await confirmDateOfBirth(toDateOnlyString(date));
      await refreshSession();
    } catch (err) {
      captureError(err, "age-gate-confirm-dob");
      setError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <View style={styles.root}>
      <GradientBackground>
        <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
          <View style={styles.content}>
            <Feather name="shield" size={28} color={colors.purple} />
            <Text style={styles.title}>Confirm your age</Text>
            <Text style={styles.sub}>
              GiggiFi is for users 18 and older. Please confirm your date of birth to continue.
            </Text>

            <GlassCard style={styles.card}>
              <Text style={styles.label}>Date of birth</Text>
              <Pressable onPress={openPicker} style={styles.trigger}>
                <Text style={date ? styles.valueText : styles.placeholderText}>
                  {date ? formatDate(date) : "Select a date"}
                </Text>
                <Feather name="calendar" size={16} color={colors.textMute} />
              </Pressable>
            </GlassCard>

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <GradientButton label="Confirm" onPress={handleConfirm} loading={submitting} disabled={!date} />
          </View>
        </SafeAreaView>
      </GradientBackground>

      {pickerOpen && Platform.OS === "android" ? (
        <DateTimePicker value={draft} mode="date" maximumDate={new Date()} onChange={handleChange} />
      ) : null}

      {Platform.OS === "ios" ? (
        <Modal visible={pickerOpen} transparent animationType="fade" onRequestClose={() => setPickerOpen(false)}>
          <Pressable style={styles.backdrop} onPress={() => setPickerOpen(false)}>
            <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
              <DateTimePicker value={draft} mode="date" display="inline" maximumDate={new Date()} onChange={handleChange} themeVariant="dark" />
              <Pressable
                style={styles.doneButton}
                onPress={() => {
                  setDate(draft);
                  setPickerOpen(false);
                }}
              >
                <Text style={styles.doneText}>Done</Text>
              </Pressable>
            </Pressable>
          </Pressable>
        </Modal>
      ) : null}
    </View>
  );
}

function formatDate(date: Date) {
  return date.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

const styles = StyleSheet.create({
  root: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 900,
  },
  safe: { flex: 1 },
  content: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  title: {
    fontFamily: fonts.display,
    fontSize: 22,
    color: colors.text,
    marginTop: spacing.sm,
  },
  sub: {
    fontFamily: fonts.body,
    fontSize: 13.5,
    color: colors.textMute,
    lineHeight: 20,
    marginBottom: spacing.sm,
  },
  card: { marginBottom: spacing.sm, gap: 4 },
  label: {
    fontFamily: fonts.mono,
    fontSize: 10,
    color: colors.textMute,
    letterSpacing: 0.5,
  },
  trigger: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 6,
  },
  valueText: {
    fontFamily: fonts.body,
    fontSize: 15,
    color: colors.text,
  },
  placeholderText: {
    fontFamily: fonts.body,
    fontSize: 15,
    color: colors.textMute,
  },
  error: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.err,
  },
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: colors.ink2,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    padding: spacing.lg,
    paddingBottom: spacing.xl,
    borderWidth: 1,
    borderColor: colors.line,
  },
  doneButton: {
    marginTop: spacing.sm,
    alignItems: "center",
    paddingVertical: 12,
    borderRadius: radii.md,
    backgroundColor: colors.purple,
  },
  doneText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 14,
    color: "#fff",
  },
});
