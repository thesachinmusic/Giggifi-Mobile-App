import { useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Linking, Modal, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { ApiError, respondToBooking } from "@/lib/api";
import { GRIEVANCE_EMAIL, HELPLINE_NUMBER, SUPPORT_EMAIL } from "@/lib/constants";
import { captureError } from "@/lib/telemetry";
import { colors, fonts, radii, spacing } from "@/theme";

const MIN_REASON_LENGTH = 10;

interface DisputeSheetProps {
  visible: boolean;
  bookingId: string;
  onClose: () => void;
  // Called once the dispute is raised, so the booking screen can reload.
  onRaised: () => Promise<void>;
}

// "Report a problem with this booking" — raises a dispute through the mobile
// booking PATCH (action raise_dispute). The backend only allows it from
// PAYMENT_HELD and EVENT_COMPLETED; the caller decides when to show it.
export function DisputeSheet(props: DisputeSheetProps) {
  return (
    <Modal visible={props.visible} transparent animationType="fade" onRequestClose={props.onClose}>
      {/* Mounted only while open, so every open starts with a fresh form. */}
      {props.visible ? <DisputeForm {...props} /> : null}
    </Modal>
  );
}

function DisputeForm({ bookingId, onClose, onRaised }: DisputeSheetProps) {
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  const canSubmit = reason.trim().length >= MIN_REASON_LENGTH && !submitting;

  async function handleSubmit() {
    if (!canSubmit) return;
    setSubmitting(true);
    setError("");
    try {
      await respondToBooking(bookingId, "raise_dispute", reason.trim());
      setDone(true);
      // The sheet's own success view is already showing; a failed refresh
      // must not turn a raised dispute into an error message.
      await onRaised().catch(() => {});
    } catch (err) {
      captureError(err, "raise-dispute");
      setError(
        err instanceof ApiError && err.status === 400
          ? "This booking can't be reported right now. Please call our helpline."
          : "Could not send your report. Please try again, or call our helpline.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <KeyboardAvoidingView style={styles.backdrop} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close" />
      <View style={styles.sheet}>
        {done ? (
          <>
            <Text style={styles.title}>We have your report</Text>
            <DisputeNextSteps />
            <Pressable style={styles.primary} onPress={onClose} accessibilityRole="button">
              <Text style={styles.primaryText}>Done</Text>
            </Pressable>
          </>
        ) : (
          <>
            <Text style={styles.title}>Report a problem with this booking</Text>
            <Text style={styles.body}>
              Tell us what went wrong. Our team will contact you.
            </Text>
            <Text style={styles.warn}>
              Important: raising a dispute stops the payout to the artist for this booking. This also applies before the event. Only continue if you really have a problem.
            </Text>
            <TextInput
              style={styles.input}
              value={reason}
              onChangeText={setReason}
              placeholder="What happened?"
              placeholderTextColor={colors.textMute}
              multiline
              maxLength={1000}
            />
            {reason.trim().length > 0 && reason.trim().length < MIN_REASON_LENGTH ? (
              <Text style={styles.hint}>Please write a little more so we can help.</Text>
            ) : null}
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <View style={styles.actions}>
              <Pressable style={styles.secondary} onPress={onClose} accessibilityRole="button">
                <Text style={styles.secondaryText}>Cancel</Text>
              </Pressable>
              <Pressable style={[styles.primary, !canSubmit && styles.primaryDisabled]} onPress={handleSubmit} disabled={!canSubmit} accessibilityRole="button">
                {submitting ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.primaryText}>Send report</Text>}
              </Pressable>
            </View>
          </>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

// Shown in the sheet after raising, and on the booking screen while the
// booking is in dispute.
export function DisputeNextSteps() {
  return (
    <View style={styles.steps}>
      <Text style={styles.body}>What happens next:</Text>
      <Text style={styles.body}>Our team will contact you. The payout to the artist for this booking is stopped while the dispute is open.</Text>
      <Text style={styles.body}>Need to talk to someone now?</Text>
      <Text style={styles.link} onPress={() => Linking.openURL(`tel:${HELPLINE_NUMBER}`)} accessibilityRole="link">
        Call {HELPLINE_NUMBER}
      </Text>
      <Text style={styles.link} onPress={() => Linking.openURL(`mailto:${SUPPORT_EMAIL}`)} accessibilityRole="link">
        Email {SUPPORT_EMAIL}
      </Text>
      <Text style={styles.hint}>For a complaint about how we handled this, write to {GRIEVANCE_EMAIL}.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" },
  sheet: {
    backgroundColor: colors.ink2,
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
    padding: spacing.lg,
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.line,
  },
  title: { fontFamily: fonts.bodySemiBold, fontSize: 17, color: colors.text },
  body: { fontFamily: fonts.body, fontSize: 13, lineHeight: 19, color: colors.textDim },
  warn: { fontFamily: fonts.bodySemiBold, fontSize: 12.5, lineHeight: 18, color: colors.err },
  hint: { fontFamily: fonts.body, fontSize: 12, lineHeight: 17, color: colors.textMute },
  link: { fontFamily: fonts.bodySemiBold, fontSize: 13.5, color: colors.purple, paddingVertical: 2 },
  steps: { gap: spacing.xs },
  input: {
    minHeight: 96,
    maxHeight: 160,
    padding: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.line,
    color: colors.text,
    fontFamily: fonts.body,
    fontSize: 13,
    textAlignVertical: "top",
  },
  error: { fontFamily: fonts.body, fontSize: 12.5, color: colors.err },
  actions: { flexDirection: "row", gap: spacing.sm, justifyContent: "flex-end" },
  primary: {
    minWidth: 110,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
    paddingVertical: 11,
    borderRadius: radii.pill,
    backgroundColor: colors.pink,
  },
  primaryDisabled: { opacity: 0.45 },
  primaryText: { fontFamily: fonts.bodySemiBold, fontSize: 13.5, color: "#fff" },
  secondary: { paddingHorizontal: spacing.lg, paddingVertical: 11 },
  secondaryText: { fontFamily: fonts.bodySemiBold, fontSize: 13.5, color: colors.textDim },
});
