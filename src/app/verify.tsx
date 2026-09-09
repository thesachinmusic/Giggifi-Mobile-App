import { Image, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { GradientBackground } from "@/components/GradientBackground";
import { InlinePhoneVerification } from "@/components/InlinePhoneVerification";
import { fonts, spacing } from "@/theme";

// Mandatory first stop for a fresh install / logged-out state — reached
// only via index.tsx's own redirect when !hasStoredSession, replacing
// that history entry, so there's nothing meaningful underneath to swipe
// or hardware-back to (see this screen's Stack.Screen registration in
// _layout.tsx). Reuses InlinePhoneVerification exactly as booking-time
// verification does — same OTP endpoints, same find-or-create-by-phone
// account logic already live on the backend (verify-otp/route.ts), same
// 30-day session token. No separate profile-details step after this by
// design; straight to Home once verified, per the explicit "not a second
// wall" instruction — profile fields are collected later via Home's
// soft completion nudge instead.
export default function VerifyScreen() {
  return (
    <GradientBackground>
      <SafeAreaView style={styles.safe}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.flex}>
          <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
            <View style={styles.brand}>
              <Image source={require("@/assets/images/giggifi-logo-cropped.png")} style={styles.logo} resizeMode="contain" />
              <Text style={styles.tagline}>Book artists & vendors in minutes.</Text>
            </View>
            <InlinePhoneVerification onVerified={() => router.replace("/(tabs)")} />
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </GradientBackground>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },
  scroll: { flexGrow: 1, justifyContent: "center", paddingHorizontal: spacing.lg, paddingVertical: spacing.xl, gap: spacing.xl },
  brand: { alignItems: "center", gap: spacing.xs },
  logo: { width: 96, height: 96 },
  tagline: { fontFamily: fonts.body, fontSize: 13, color: "rgba(255,255,255,0.6)" },
});
