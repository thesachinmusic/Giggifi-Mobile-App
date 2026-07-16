import { useState } from "react";
import { Image, KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { GradientBackground } from "@/components/GradientBackground";
import { GradientButton } from "@/components/GradientButton";
import { useAuth } from "@/lib/auth-context";
import { ApiError } from "@/lib/api";
import { colors, fonts, radii, spacing } from "@/theme";

export default function LoginScreen() {
  const { requestOtp } = useAuth();
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const digits = phone.replace(/\D/g, "");
  const canSubmit = digits.length === 10;

  async function handleContinue() {
    if (!canSubmit) return;
    setLoading(true);
    setError("");
    try {
      await requestOtp(digits);
      router.push({ pathname: "/(auth)/otp", params: { phone: digits } });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not send OTP. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <GradientBackground>
      <SafeAreaView style={styles.safe}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.flex}>
          <View style={styles.brand}>
            <Image source={require("@/assets/images/giggifi-logo.png")} style={styles.logo} resizeMode="contain" />
          </View>

          <View style={styles.pitch}>
            <Text style={styles.eyebrow}>BOOK VERIFIED ARTISTS</Text>
            <Text style={styles.headline}>
              Find your{"\n"}perfect <Text style={styles.headlineAccent}>artist</Text>.
            </Text>
            <Text style={styles.sub}>Singers, DJs, bands, dancers and more — booked and paid for, safely, in minutes.</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.label}>PHONE NUMBER</Text>
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
            <GradientButton label="Continue" onPress={handleContinue} disabled={!canSubmit} loading={loading} style={styles.button} />
            <Text style={styles.terms}>By continuing, you agree to GiggFi's Terms & Privacy Policy.</Text>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </GradientBackground>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  safe: { flex: 1, paddingHorizontal: spacing.lg },
  brand: { paddingTop: spacing.lg, alignItems: "flex-start" },
  logo: { height: 40, width: 140 },
  pitch: { marginTop: spacing.xxl, marginBottom: spacing.xl },
  eyebrow: {
    fontFamily: fonts.mono,
    fontSize: 12,
    color: colors.orange,
    letterSpacing: 1.5,
    marginBottom: spacing.md,
  },
  headline: {
    fontFamily: fonts.display,
    fontSize: 44,
    lineHeight: 46,
    color: colors.text,
    marginBottom: spacing.md,
  },
  headlineAccent: {
    fontFamily: fonts.displayMedium,
    fontStyle: "italic",
  },
  sub: {
    fontFamily: fonts.body,
    fontSize: 15,
    lineHeight: 22,
    color: colors.textMute,
    maxWidth: 340,
  },
  card: { marginTop: "auto", marginBottom: spacing.xl, gap: spacing.sm },
  label: {
    fontFamily: fonts.mono,
    fontSize: 11,
    color: colors.textMute,
    letterSpacing: 1,
    marginBottom: 4,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.ink2,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
  },
  prefix: {
    fontFamily: fonts.bodyMedium,
    fontSize: 15,
    color: colors.textDim,
    marginRight: spacing.sm,
  },
  input: {
    flex: 1,
    paddingVertical: 14,
    fontFamily: fonts.body,
    fontSize: 15,
    color: colors.text,
  },
  error: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.err,
  },
  button: { marginTop: spacing.sm },
  terms: {
    fontFamily: fonts.body,
    fontSize: 11.5,
    color: colors.textMute,
    textAlign: "center",
    lineHeight: 16,
  },
});
