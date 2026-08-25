import { ActivityIndicator, View } from "react-native";
import { Redirect } from "expo-router";
import { useAuth } from "@/lib/auth-context";
import { colors } from "@/theme";

export default function Index() {
  const { isLoading } = useAuth();

  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.ink, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color={colors.pink} />
      </View>
    );
  }

  // No login wall — browsing (artists, Reels, Quick Moments) is open to
  // everyone, logged in or not. (tabs) itself has no auth guard; a phone/
  // OTP verification is only ever asked for inline, at the moment someone
  // actually tries to book/enquire (see artist/[id].tsx, plan-my-event.tsx).
  return <Redirect href="/(tabs)" />;
}
