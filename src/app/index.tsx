import { ActivityIndicator, View } from "react-native";
import { Redirect } from "expo-router";
import { useAuth } from "@/lib/auth-context";
import { colors } from "@/theme";

export default function Index() {
  const { user, isLoading, hasStoredSession } = useAuth();

  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.ink, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color={colors.pink} />
      </View>
    );
  }

  // hasStoredSession, not just user: a cold start on a flaky connection can
  // fail the network call that hydrates `user` even though the stored token
  // is still valid — that shouldn't bounce a logged-in user back to the
  // phone-number screen. Screens that need real profile data already
  // handle `user` being briefly null.
  return <Redirect href={user || hasStoredSession ? "/(tabs)" : "/(auth)/login"} />;
}
