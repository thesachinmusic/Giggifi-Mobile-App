import { useEffect, useRef, useState } from "react";
import { Linking, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { GradientButton } from "@/components/GradientButton";
import { OtpInput } from "@/components/OtpInput";
import { useAuth } from "@/lib/auth-context";
import { ApiError } from "@/lib/api";
import { HELPLINE_NUMBER } from "@/lib/constants";
import { colors, fonts, radii, spacing } from "@/theme";

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

// Phone number + OTP entry, embedded directly inside whatever screen needs
// it (a booking form, an enquiry, a Quick Moment) instead of navigating to
// a separate login screen — there is no standalone login screen anymore.
// Whatever the caller was filling in stays exactly as it was; this just
// renders inline where the "Book"/"Send" action would otherwise be, and
// calls onVerified() once the session is live so the caller can retry its
// own submit.
export function InlinePhoneVerification({ onVerified }: { onVerified: () => void }) {
  const { requestOtp, confirmOtp } = useAuth();
  const [phone, setPhone] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState("");
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState("");
  const [resending, setResending] = useState(false);
  const [resendCount, setResendCount] = useState(0);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);
  const verifyingRef = useRef(false);

  useEffect(() => {
    if (!otpSent) return;
    const timer = setInterval(() => setCooldownSeconds((s) => (s > 0 ? s - 1 : 0)), 1000);
    return () => clearInterval(timer);
  }, [otpSent]);

  const digits = phone.replace(/\D/g, "");
  const canSendOtp = digits.length === 10;

  async function handleSendOtp() {
    if (!canSendOtp) return;
    setSending(true);
    setError("");
    try {
      await requestOtp(digits);
      setOtpSent(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not send OTP. Please try again.");
    } finally {
      setSending(false);
    }
  }

  async function handleVerify() {
    if (otp.length !== 6 || verifyingRef.current) return;
    verifyingRef.current = true;
    setVerifying(true);
    setError("");
    try {
      await confirmOtp(digits, otp);
      onVerified();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Verification failed. Please try again.");
      verifyingRef.current = false;
    } finally {
      setVerifying(false);
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
      await requestOtp(digits);
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
    <View style={styles.card}>
      <View style={styles.header}>
        <Feather name="shield" size={16} color={colors.purple} />
        <Text style={styles.title}>Verify your number to continue</Text>
      </View>
      <Text style={styles.sub}>
        {otpSent ? `We sent a 6-digit code to +91 ${digits}` : "We'll text you a one-time code — no password, no account to set up."}
      </Text>

      {!otpSent ? (
        <>
          <View style={styles.inputRow}>
            <Text style={styles.prefix}>+91</Text>
            <TextInput
              value={phone}
              onChangeText={setPhone}
              placeholder="98765 43210"
              placeholderTextColor={colors.textMute}
              keyboardType="number-pad"
              maxLength={10}
              style={styles.input}
            />
          </View>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <GradientButton label="Send OTP" onPress={handleSendOtp} disabled={!canSendOtp} loading={sending} style={styles.button} />
        </>
      ) : (
        <>
          <OtpInput value={otp} onChange={setOtp} />
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <GradientButton label="Verify & continue" onPress={handleVerify} disabled={otp.length !== 6} loading={verifying} style={styles.button} />
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
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.sm },
  header: { flexDirection: "row", alignItems: "center", gap: 8 },
  title: { fontFamily: fonts.bodySemiBold, fontSize: 14.5, color: colors.text },
  sub: { fontFamily: fonts.body, fontSize: 12.5, lineHeight: 18, color: colors.textDim, marginBottom: spacing.xs },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.ink2,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
  },
  prefix: { fontFamily: fonts.bodyMedium, fontSize: 15, color: colors.textDim, marginRight: spacing.sm },
  input: { flex: 1, paddingVertical: 14, fontFamily: fonts.body, fontSize: 15, color: colors.text },
  error: { fontFamily: fonts.body, fontSize: 13, color: colors.err },
  button: { marginTop: spacing.xs },
  resend: { marginTop: spacing.sm, alignItems: "center" },
  resendText: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.textDim },
  resendTextDisabled: { color: colors.textMute },
});
