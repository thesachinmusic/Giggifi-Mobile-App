import { ScrollView, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { GradientBackground } from "@/components/GradientBackground";
import { SuspendedAccountNotice } from "@/components/SuspendedAccountNotice";
import { spacing } from "@/theme";

// Shown when a signed-in session is blocked mid-use (api.ts: 401 with code
// ACCOUNT_SUSPENDED). The token is already cleared by then.
export default function AccountSuspendedScreen() {
  return (
    <GradientBackground>
      <SafeAreaView style={styles.safe}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <SuspendedAccountNotice onBack={() => router.replace("/verify")} />
        </ScrollView>
      </SafeAreaView>
    </GradientBackground>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  scroll: { flexGrow: 1, justifyContent: "center", paddingHorizontal: spacing.lg, paddingVertical: spacing.xl },
});
