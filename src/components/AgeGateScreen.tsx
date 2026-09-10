import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { GradientButton } from "@/components/GradientButton";
import { DateField } from "@/components/DateField";
import { useAuth } from "@/lib/auth-context";
import { confirmDateOfBirth, ApiError } from "@/lib/api";
import { colors, fonts, spacing } from "@/theme";

const TODAY = new Date();
const MIN_BIRTH_DATE = new Date(new Date().setFullYear(TODAY.getFullYear() - 100));

// Full-screen, non-dismissable age verification gate — rendered by
// _layout.tsx on top of the entire app (including the tab navigator) any
// time a logged-in user has no dateOfBirth on file yet. There is no close
// button and no way to navigate away: this mirrors the website's
// AgeGatePanel (components/giggifi-app.tsx / AgeGatePanel.tsx), which is
// the same legal/Play-Store 18+ requirement enforced here for parity.
//
// Unlike edit-profile.tsx's optional DOB field (a soft nudge for users who
// already passed this gate), submission here goes through
// confirmDateOfBirth only — the real under-18 rejection happens
// server-side in /api/auth/confirm-dob, which this screen surfaces
// verbatim and refuses to proceed past.
export function AgeGateScreen() {
  const { refreshSession } = useAuth();
  const [dob, setDob] = useState<Date | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit() {
    if (!dob) {
      setError("Enter your date of birth to continue.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      await confirmDateOfBirth(dob.toISOString());
      // Re-fetches the session so `user.dateOfBirth` is populated and this
      // gate stops rendering — no local state flag needed, _layout.tsx
      // re-derives visibility from the refreshed `user` on every render.
      await refreshSession();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't save your date of birth. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <View style={styles.overlay}>
      <SafeAreaView style={styles.safe}>
        <View style={styles.content}>
          <Text style={styles.eyebrow}>ONE LAST STEP</Text>
          <Text style={styles.title}>Confirm your age</Text>
          <Text style={styles.body}>
            Giggifi is only for users 18 and older. Enter your date of birth to continue.
          </Text>

          <DateField label="DATE OF BIRTH" value={dob} onChange={setDob} minimumDate={MIN_BIRTH_DATE} maximumDate={TODAY} />

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <GradientButton label="Continue" onPress={handleSubmit} loading={submitting} style={styles.button} />
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1000,
    backgroundColor: colors.ink,
  },
  safe: { flex: 1 },
  content: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  },
  eyebrow: {
    fontFamily: fonts.mono,
    fontSize: 11,
    letterSpacing: 1,
    color: colors.textMute,
  },
  title: {
    fontFamily: fonts.display,
    fontSize: 26,
    color: colors.text,
    marginTop: -4,
  },
  body: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.textMute,
    lineHeight: 20,
    marginBottom: spacing.sm,
  },
  error: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.err,
  },
  button: { marginTop: spacing.sm },
});
