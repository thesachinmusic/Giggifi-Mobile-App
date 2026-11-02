import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { ApiError } from "@/lib/api";
import { GRIEVANCE_EMAIL, HELPLINE_NUMBER } from "@/lib/constants";
import { colors, fonts, radii, spacing } from "@/theme";

// Login/OTP verify answers a suspended account with 403 "This account has been
// suspended." A blocked token mid-session is a 401 with code ACCOUNT_SUSPENDED
// (handled in api.ts, which opens the account-suspended screen).
export function isSuspendedAccountError(err: unknown): boolean {
  return err instanceof ApiError && (err.code === "ACCOUNT_SUSPENDED" || (err.status === 403 && /suspended/i.test(err.message)));
}

export function SuspendedAccountNotice({ onBack }: { onBack: () => void }) {
  return (
    <View style={styles.card} accessibilityRole="alert">
      <View style={styles.header}>
        <Feather name="alert-circle" size={18} color={colors.err} />
        <Text style={styles.title}>Your account is on hold</Text>
      </View>
      <Text style={styles.body}>
        We have paused this account, so you can&apos;t sign in right now. This can happen when we are checking a report or a payment problem.
      </Text>
      <Text style={styles.body}>
        If you think this is a mistake, please contact us. Tell us the phone number you used, and we will look into it.
      </Text>
      <Pressable style={styles.action} onPress={() => Linking.openURL(`mailto:${GRIEVANCE_EMAIL}?subject=Account%20on%20hold`)} accessibilityRole="button">
        <Feather name="mail" size={15} color="#fff" />
        <Text style={styles.actionText}>Email {GRIEVANCE_EMAIL}</Text>
      </Pressable>
      <Pressable style={styles.action} onPress={() => Linking.openURL(`tel:${HELPLINE_NUMBER}`)} accessibilityRole="button">
        <Feather name="phone" size={15} color="#fff" />
        <Text style={styles.actionText}>Call {HELPLINE_NUMBER}</Text>
      </Pressable>
      <Pressable style={styles.back} onPress={onBack} accessibilityRole="button">
        <Text style={styles.backText}>Use a different number</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.sm },
  header: { flexDirection: "row", alignItems: "center", gap: 8 },
  title: { fontFamily: fonts.bodySemiBold, fontSize: 15.5, color: colors.text },
  body: { fontFamily: fonts.body, fontSize: 13, lineHeight: 19, color: colors.textDim },
  action: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    paddingVertical: 12,
    borderRadius: radii.pill,
    backgroundColor: colors.purple,
  },
  actionText: { fontFamily: fonts.bodySemiBold, fontSize: 14, color: "#fff" },
  back: { alignItems: "center", marginTop: spacing.xs },
  backText: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.textDim },
});
