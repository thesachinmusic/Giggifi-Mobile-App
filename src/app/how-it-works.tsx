import { Linking, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { GradientBackground } from "@/components/GradientBackground";
import { GlassCard } from "@/components/GlassCard";
import { colors, fonts, spacing } from "@/theme";

const STEPS: { icon: keyof typeof Feather.glyphMap; title: string; body: string }[] = [
  {
    icon: "credit-card",
    title: "You pay to confirm the booking",
    body: "Payment is collected upfront when you confirm — but it isn't handed to the artist or vendor yet.",
  },
  {
    icon: "lock",
    title: "Held securely until the event is done",
    body: "Payments are held securely until the event is confirmed done — same protection on every booking, every category.",
  },
  {
    icon: "check-circle",
    title: "Event happens, then payout releases",
    body: "Once the event is marked completed, the payout is released to the artist or vendor — not a moment before.",
  },
  {
    icon: "shield",
    title: "Something go wrong? You're covered",
    body: "If there's a dispute, GiggiFi steps in before any payout is released — see the full Cancellation & Refund Policy below.",
  },
];

// Slide 3 of Home's hero carousel ("Secure Payment" / "How it works →")
// pointed at nothing until now — this is that destination. Copy mirrors
// the exact escrow language already used on artist/[id].tsx, vendor/[id].tsx
// and quick-moments/book.tsx ("held securely until the event is confirmed
// done") rather than inventing new wording for the same mechanism.
export default function HowItWorksScreen() {
  return (
    <GradientBackground>
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <Text style={styles.eyebrow}>SECURE PAYMENT</Text>
          <Text style={styles.title}>You pay only after{"\n"}the event is done</Text>
          <Text style={styles.sub}>Here&apos;s exactly how your money is protected, start to finish.</Text>

          {STEPS.map((step, i) => (
            <GlassCard key={step.title} style={styles.stepCard}>
              <View style={styles.stepRow}>
                <View style={styles.stepIcon}>
                  <Feather name={step.icon} size={16} color={colors.purple} />
                </View>
                <View style={styles.stepTextWrap}>
                  <Text style={styles.stepNumber}>STEP {i + 1}</Text>
                  <Text style={styles.stepTitle}>{step.title}</Text>
                  <Text style={styles.stepBody}>{step.body}</Text>
                </View>
              </View>
            </GlassCard>
          ))}

          <Text style={styles.policyLink} onPress={() => Linking.openURL("https://giggifi.com/refund")}>
            Read the full Cancellation & Refund Policy →
          </Text>
        </ScrollView>
      </SafeAreaView>
    </GradientBackground>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  scroll: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.xxl },
  eyebrow: { fontFamily: fonts.mono, fontSize: 11, color: colors.orange, letterSpacing: 2, marginBottom: spacing.sm },
  title: { fontFamily: fonts.display, fontSize: 26, lineHeight: 31, color: colors.text, marginBottom: spacing.xs },
  sub: { fontFamily: fonts.body, fontSize: 13.5, color: colors.textMute, marginBottom: spacing.lg },
  stepCard: { marginBottom: spacing.sm },
  stepRow: { flexDirection: "row", gap: spacing.sm },
  stepIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: "rgba(168,85,247,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  stepTextWrap: { flex: 1 },
  stepNumber: { fontFamily: fonts.mono, fontSize: 9.5, color: colors.textMute, letterSpacing: 1, marginBottom: 2 },
  stepTitle: { fontFamily: fonts.bodySemiBold, fontSize: 14, color: colors.text, marginBottom: 3 },
  stepBody: { fontFamily: fonts.body, fontSize: 12.5, lineHeight: 18, color: colors.textDim },
  policyLink: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 13,
    color: colors.purple,
    textAlign: "center",
    marginTop: spacing.md,
  },
});
