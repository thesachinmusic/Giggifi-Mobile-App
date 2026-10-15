import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Image, KeyboardAvoidingView, Linking, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { GradientBackground } from "@/components/GradientBackground";
import { InlinePhoneVerification } from "@/components/InlinePhoneVerification";
import { canReachServer } from "@/lib/connectivity";
import { useAppForeground } from "@/lib/use-app-foreground";
import { colors, fonts, radii, spacing } from "@/theme";

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
  // "checking" shows the form straight away; only a failed check swaps it for
  // the offline state, so a slow network never hides the sign-in form.
  const [connection, setConnection] = useState<"checking" | "online" | "offline">("checking");
  const [retrying, setRetrying] = useState(false);

  const check = useCallback(async () => {
    setRetrying(true);
    const reachable = await canReachServer();
    setConnection(reachable ? "online" : "offline");
    setRetrying(false);
  }, []);

  useEffect(() => {
    void check();
  }, [check]);
  // Coming back from Settings after switching data on.
  useAppForeground(() => {
    if (connection === "offline") void check();
  });

  return (
    <GradientBackground>
      <SafeAreaView style={styles.safe}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.flex}>
          <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
            <View style={styles.brand}>
              <Image source={require("@/assets/images/giggifi-logo-cropped.png")} style={styles.logo} resizeMode="contain" />
              <Text style={styles.tagline}>Book artists & vendors for your event.</Text>
            </View>
            {connection === "offline" ? (
              <View style={styles.offline} accessibilityRole="alert">
                <Text style={styles.offlineTitle}>No internet connection</Text>
                <Text style={styles.offlineText}>GiggiFi needs the internet to send your code. Check your Wi-Fi or mobile data, then try again.</Text>
                <Pressable style={styles.retry} onPress={check} disabled={retrying} accessibilityRole="button">
                  {retrying ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.retryText}>Try again</Text>}
                </Pressable>
              </View>
            ) : (
              <InlinePhoneVerification onVerified={() => router.replace("/(tabs)")} />
            )}
            <Text style={styles.legal}>
              <Text style={styles.legalLink} onPress={() => Linking.openURL("https://giggifi.com/terms")}>Terms of Service</Text>{"  ·  "}
              <Text style={styles.legalLink} onPress={() => Linking.openURL("https://giggifi.com/booker-terms")}>Booker Terms</Text>{"  ·  "}
              <Text style={styles.legalLink} onPress={() => Linking.openURL("https://giggifi.com/acceptable-use")}>Acceptable Use</Text>{"  ·  "}
              <Text style={styles.legalLink} onPress={() => Linking.openURL("https://giggifi.com/privacy")}>Privacy Policy</Text>{"  ·  "}
              <Text style={styles.legalLink} onPress={() => Linking.openURL("https://giggifi.com/refund")}>Refund Policy</Text>
            </Text>
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
  legal: { fontFamily: fonts.body, fontSize: 11.5, lineHeight: 17, color: "rgba(255,255,255,0.5)", textAlign: "center" },
  legalLink: { color: "rgba(255,255,255,0.8)", textDecorationLine: "underline" },
  offline: { gap: spacing.sm, alignItems: "center" },
  offlineTitle: { fontFamily: fonts.bodySemiBold, fontSize: 16, color: colors.text },
  offlineText: { fontFamily: fonts.body, fontSize: 13, lineHeight: 19, color: colors.textDim, textAlign: "center" },
  retry: { minWidth: 140, alignItems: "center", paddingVertical: 12, paddingHorizontal: spacing.lg, borderRadius: radii.pill, backgroundColor: colors.purple, marginTop: spacing.xs },
  retryText: { fontFamily: fonts.bodySemiBold, fontSize: 14, color: "#fff" },
  tagline: { fontFamily: fonts.body, fontSize: 13, color: "rgba(255,255,255,0.6)" },
});
