import { useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { ApiError, reportContent, type ReportReason, type ReportTargetType } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { captureError } from "@/lib/telemetry";
import { colors, fonts, radii, spacing } from "@/theme";

const REASONS: { value: ReportReason; label: string }[] = [
  { value: "inappropriate", label: "Inappropriate content" },
  { value: "abusive", label: "Abusive or offensive" },
  { value: "fake", label: "Fake or misleading" },
  { value: "spam", label: "Spam" },
  { value: "impersonation", label: "Impersonation" },
  { value: "other", label: "Something else" },
];

interface ReportSheetProps {
  visible: boolean;
  onClose: () => void;
  targetType: ReportTargetType;
  targetId: string;
  // "review" | "artist profile" — only used in the heading.
  noun: string;
}

// Simple report sheet (Google Play user-generated-content requirement) for a
// review or an artist profile. The report goes to Giggifi's support inbox via
// POST /api/mobile/report; nothing about it is shown to the reported person.
export function ReportSheet(props: ReportSheetProps) {
  const { visible, onClose } = props;
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      {/* Mounted only while open, so every open starts with a fresh form. */}
      {visible ? <ReportForm {...props} /> : null}
    </Modal>
  );
}

function ReportForm({ onClose, targetType, targetId, noun }: ReportSheetProps) {
  const { user } = useAuth();
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit() {
    if (!reason || submitting) return;
    setSubmitting(true);
    setError("");
    try {
      await reportContent({ targetType, targetId, reason, note: note.trim() || undefined });
      setDone(true);
    } catch (err) {
      captureError(err, "content-report");
      if (err instanceof ApiError && err.status === 401) {
        setError("Please verify your phone number first, then report again.");
      } else {
        setError(err instanceof ApiError ? err.message : "Couldn't send your report. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <KeyboardAvoidingView style={styles.backdrop} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close" />
        <View style={styles.sheet}>
          {done ? (
            <>
              <Text style={styles.title}>Thanks for letting us know</Text>
              <Text style={styles.body}>Our team will review this {noun}. We don&apos;t share who reported it.</Text>
              <Pressable style={styles.primary} onPress={onClose} accessibilityRole="button">
                <Text style={styles.primaryText}>Done</Text>
              </Pressable>
            </>
          ) : (
            <>
              <Text style={styles.title}>Report this {noun}</Text>
              <Text style={styles.body}>
                {user ? "What's wrong with it?" : "You'll need to verify your phone number to send a report."}
              </Text>
              <View style={styles.chips}>
                {REASONS.map((r) => (
                  <Pressable
                    key={r.value}
                    style={[styles.chip, reason === r.value && styles.chipActive]}
                    onPress={() => setReason(r.value)}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: reason === r.value }}
                  >
                    <Text style={[styles.chipText, reason === r.value && styles.chipTextActive]}>{r.label}</Text>
                  </Pressable>
                ))}
              </View>
              <TextInput
                style={styles.input}
                value={note}
                onChangeText={setNote}
                placeholder="Add details (optional)"
                placeholderTextColor={colors.textMute}
                multiline
                maxLength={1000}
              />
              {error ? <Text style={styles.error}>{error}</Text> : null}
              <View style={styles.actions}>
                <Pressable style={styles.secondary} onPress={onClose} accessibilityRole="button">
                  <Text style={styles.secondaryText}>Cancel</Text>
                </Pressable>
                <Pressable
                  style={[styles.primary, (!reason || submitting) && styles.primaryDisabled]}
                  onPress={handleSubmit}
                  disabled={!reason || submitting}
                  accessibilityRole="button"
                >
                  {submitting ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.primaryText}>Send report</Text>}
                </Pressable>
              </View>
            </>
          )}
        </View>
      </KeyboardAvoidingView>
    </>
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
  chips: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.line,
  },
  chipActive: { borderColor: colors.pink, backgroundColor: "rgba(236,72,153,0.15)" },
  chipText: { fontFamily: fonts.body, fontSize: 12.5, color: colors.textDim },
  chipTextActive: { color: colors.text },
  input: {
    minHeight: 64,
    maxHeight: 120,
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
