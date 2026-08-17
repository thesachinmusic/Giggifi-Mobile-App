import { useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import { GradientBackground } from "@/components/GradientBackground";
import { GlassCard } from "@/components/GlassCard";
import { GradientButton as Btn } from "@/components/GradientButton";
import { useAuth } from "@/lib/auth-context";
import { deleteAccount, ApiError } from "@/lib/api";
import { captureError } from "@/lib/telemetry";
import { colors, fonts, radii, spacing } from "@/theme";

const DELETED_ITEMS = [
  "Your name, email, and phone number",
  "Profile photos, videos, and bio",
  "Saved artists and notification preferences",
  "Device push-notification data",
];

const RETAINED_ITEMS = [
  "Past booking and payment records (Indian tax/GST law requires we keep these)",
  "KYC/verification documents, if you completed artist or vendor verification",
  "Reviews you left or received, with your name removed",
];

// In-app account deletion — the mandatory counterpart to the public
// giggifi.com/delete-account web page (Google Play requires both an in-app
// path and a web resource for any app that supports account creation).
// Same retained-vs-deleted split as the website's version, and both call
// the same deleteUserAccount() logic server-side — see
// GiggFi-Website/lib/services/account-deletion-service.ts.
export default function DeleteAccountScreen() {
  const { logout } = useAuth();
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

  async function handleConfirm() {
    setDeleting(true);
    setError("");
    try {
      await deleteAccount();
      await logout();
      router.replace("/(auth)/login");
    } catch (err) {
      captureError(err, "account-delete");
      setError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
      setDeleting(false);
    }
  }

  return (
    <GradientBackground>
      <SafeAreaView style={styles.safe} edges={["bottom"]}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <Text style={styles.title}>Delete your account</Text>
          <Text style={styles.sub}>This is permanent and cannot be undone.</Text>

          <GlassCard style={styles.card}>
            <View style={styles.cardHeader}>
              <Feather name="check" size={15} color={colors.ok} />
              <Text style={styles.cardTitle}>What gets deleted</Text>
            </View>
            {DELETED_ITEMS.map((item) => (
              <Text key={item} style={styles.itemText}>• {item}</Text>
            ))}
          </GlassCard>

          <GlassCard style={StyleSheet.flatten([styles.card, styles.warnCard])}>
            <View style={styles.cardHeader}>
              <Feather name="alert-triangle" size={15} color={colors.orange} />
              <Text style={styles.cardTitle}>What we keep, and why</Text>
            </View>
            {RETAINED_ITEMS.map((item) => (
              <Text key={item} style={styles.itemText}>• {item}</Text>
            ))}
          </GlassCard>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          {confirming ? (
            <View style={styles.confirmBlock}>
              <Text style={styles.confirmText}>
                You&apos;ll be signed out immediately and won&apos;t be able to log back into this account.
              </Text>
              <Btn label="Yes, permanently delete my account" onPress={handleConfirm} loading={deleting} variant="destructive" />
              {!deleting ? (
                <Text style={styles.cancelLink} onPress={() => setConfirming(false)}>Cancel</Text>
              ) : null}
            </View>
          ) : (
            <Text style={styles.deleteLink} onPress={() => setConfirming(true)}>
              Delete my account
            </Text>
          )}
        </ScrollView>
      </SafeAreaView>
    </GradientBackground>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  scroll: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl },
  title: {
    fontFamily: fonts.display,
    fontSize: 24,
    color: colors.text,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  sub: {
    fontFamily: fonts.body,
    fontSize: 13.5,
    color: colors.textMute,
    marginBottom: spacing.lg,
  },
  card: { marginBottom: spacing.md, gap: 8 },
  warnCard: { borderColor: "rgba(255,138,61,0.3)" },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 },
  cardTitle: { fontFamily: fonts.bodySemiBold, fontSize: 14, color: colors.text },
  itemText: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.textDim,
    lineHeight: 20,
  },
  error: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.err,
    marginBottom: spacing.md,
  },
  deleteLink: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 14.5,
    color: colors.err,
    textAlign: "center",
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: "rgba(239,68,68,0.35)",
    backgroundColor: "rgba(239,68,68,0.08)",
  },
  confirmBlock: {
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: "rgba(239,68,68,0.35)",
    backgroundColor: "rgba(239,68,68,0.08)",
    gap: spacing.sm,
  },
  confirmText: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.textDim,
    marginBottom: spacing.xs,
  },
  cancelLink: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13.5,
    color: colors.textMute,
    textAlign: "center",
    marginTop: spacing.xs,
  },
});
