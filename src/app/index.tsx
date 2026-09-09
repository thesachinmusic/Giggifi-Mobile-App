import { ActivityIndicator, View } from "react-native";
import { Redirect } from "expo-router";
import { useAuth } from "@/lib/auth-context";
import { colors } from "@/theme";

export default function Index() {
  const { isLoading, hasStoredSession } = useAuth();

  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.ink, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color={colors.pink} />
      </View>
    );
  }

  // App-only gate (the website stays login-free — no equivalent wall
  // there): a fresh install, or any other logged-out state (explicit
  // logout, expired 30-day token), lands on /verify before Home is
  // reachable at all. hasStoredSession is the same signal every other
  // logged-in-vs-guest check in this app already uses (see auth-context.tsx
  // and profile.tsx's own logged-out card) — deliberately not a separate
  // "have I launched before" flag, since that would gate the wrong thing
  // for someone who verified once and later logged out. Once verified,
  // this never shows again until the token actually expires or the user
  // explicitly logs out (same existing session-persistence mechanism,
  // nothing new here) — an existing logged-in session on app update skips
  // straight past this exactly as before.
  return <Redirect href={hasStoredSession ? "/(tabs)" : "/verify"} />;
}
