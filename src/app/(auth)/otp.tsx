import { useEffect, useRef, useState } from "react";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import { GradientBackground } from "@/components/GradientBackground";
import { GradientButton } from "@/components/GradientButton";
import { OtpInput } from "@/components/OtpInput";
import { useAuth } from "@/lib/auth-context";
import { ApiError } from "@/lib/api";
import { HELPLINE_NUMBER } from "@/lib/constants";
import { colors, fonts, spacing } from "@/theme";

// Matches the backend's own limits (10/phone/hour, 30/IP/hour) — escalating
// so a user can't rack up SMS spend faster than the server would reject
// anyway, and stops offering resend once further taps would just be noise.
const RESEND_COOLDOWNS_SECONDS = [30, 60, 120];
const MAX_RESENDS = RESEND_COOLDOWNS_SECONDS.length;

function formatCountdown(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export default function OtpScreen() {
  const { phone } = useLocalSearchParams<{ phone: string }>();
  const { confirmOtp, requestOtp } = useAuth();
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [resending, setResending] = useState(false);
  const [resendCount, setResendCount] = useState(0);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);
  const verifyingRef = useRef(false);

  // One continuous interval for the whole screen lifetime rather than one
  // per second — a functional update is enough to keep it correct, and it
  // no-ops cheaply whenever there's no active cooldown.
  useEffect(() => {
    const timer = setInterval(() => setCooldownSeconds((s) => (s > 0 ? s - 1 : 0)), 1000);
    return () => clearInterval(timer);
  }, []);

  async function handleVerify() {
    if (otp.length !== 6 || verifyingRef.current) return;
    verifyingRef.current = true;
    setLoading(true);
    setError("");
    try {
      await confirmOtp(phone, otp);
      router.replace("/(tabs)");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Verification failed. Please try again.");
      verifyingRef.current = false;
    } finally {
      setLoading(false);
    }
  }

  // Auto-submit once all 6 digits are present — from a paste, OS autofill,
  // or manual entry — instead of requiring a button tap.
  useEffect(() => {
    if (otp.length === 6) handleVerify();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [otp]);

  async function handleResend() {
    if (cooldownSeconds > 0 || resendCount >= MAX_RESENDS || resending) return;
    setError("");
    setResending(true);
    try {
      await requestOtp(phone);
      setResendCount((c) => c + 1);
      setCooldownSeconds(RESEND_COOLDOWNS_SECONDS[resendCount]);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not resend OTP.");
    } finally {
      setResending(false);
    }
  }

  const capReached = resendCount >= MAX_RESENDS;

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

        {capReached ? (
          <Pressable style={styles.resend} onPress={() => Linking.openURL(`tel:${HELPLINE_NUMBER}`)}>
            <Text style={styles.resendText}>Still not received? Call our helpline {HELPLINE_NUMBER}</Text>
          </Pressable>
        ) : (
          <Pressable onPress={handleResend} style={styles.resend} disabled={cooldownSeconds > 0 || resending}>
            <Text style={[styles.resendText, cooldownSeconds > 0 ? styles.resendTextDisabled : null]}>
              {cooldownSeconds > 0 ? `Resend in ${formatCountdown(cooldownSeconds)}` : "Didn't get it? Resend code"}
            </Text>
          </Pressable>
        )}
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
  resendTextDisabled: {
    color: colors.textMute,
  },
});
