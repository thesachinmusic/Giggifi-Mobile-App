import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import { GradientBackground } from "@/components/GradientBackground";
import { GradientButton } from "@/components/GradientButton";
import { OtpInput } from "@/components/OtpInput";
import { useAuth } from "@/lib/auth-context";
import { ApiError } from "@/lib/api";
import { colors, fonts, spacing } from "@/theme";

export default function OtpScreen() {
  const { phone } = useLocalSearchParams<{ phone: string }>();
  const { confirmOtp, requestOtp } = useAuth();
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [resent, setResent] = useState(false);

  async function handleVerify() {
    if (otp.length !== 6) return;
    setLoading(true);
    setError("");
    try {
      await confirmOtp(phone, otp);
      router.replace("/(tabs)");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Verification failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    setError("");
    try {
      await requestOtp(phone);
      setResent(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not resend OTP.");
    }
  }

  return (
    <GradientBackground>
      <SafeAreaView style={styles.safe}>
        <View style={styles.head}>
          <Text style={styles.step}>STEP 2 OF 2</Text>
          <Text style={styles.title}>Enter the code</Text>
          <Text style={styles.sub}>We sent a 6-digit code to +91 {phone}</Text>
        </View>

        <OtpInput value={otp} onChange={setOtp} />
        {error ? <Text style={styles.error}>{error}</Text> : null}

        <GradientButton label="Verify & continue" onPress={handleVerify} disabled={otp.length !== 6} loading={loading} style={styles.button} />

        <Pressable onPress={handleResend} style={styles.resend}>
          <Text style={styles.resendText}>{resent ? "Code sent again" : "Didn't get it? Resend code"}</Text>
        </Pressable>
      </SafeAreaView>
    </GradientBackground>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, paddingHorizontal: spacing.lg, paddingTop: spacing.xxl },
  head: { marginBottom: spacing.xl },
  step: {
    fontFamily: fonts.mono,
    fontSize: 11,
    color: colors.textMute,
    letterSpacing: 1,
    marginBottom: spacing.sm,
  },
  title: {
    fontFamily: fonts.display,
    fontSize: 32,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  sub: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.textMute,
  },
  error: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.err,
    marginTop: spacing.md,
  },
  button: { marginTop: spacing.xl },
  resend: { marginTop: spacing.lg, alignItems: "center" },
  resendText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    color: colors.textDim,
  },
});
