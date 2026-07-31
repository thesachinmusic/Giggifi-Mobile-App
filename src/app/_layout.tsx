import { useEffect, useState } from "react";
import { View, ActivityIndicator } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { BottomSheetModalProvider } from "@gorhom/bottom-sheet";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { AuthProvider } from "@/lib/auth-context";
import { SavedArtistsProvider } from "@/lib/saved-artists-context";
import { usePushRegistration } from "@/lib/push-notifications";
import { IntroSplash } from "@/components/IntroSplash";
import { useAppFonts } from "@/theme/typography";
import { colors } from "@/theme";

SplashScreen.preventAutoHideAsync().catch(() => {});

function PushRegistrar() {
  usePushRegistration();
  return null;
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useAppFonts();
  const [showIntro, setShowIntro] = useState(true);

  useEffect(() => {
    if (fontsLoaded || fontError) SplashScreen.hideAsync().catch(() => {});
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.ink, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color={colors.pink} />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <BottomSheetModalProvider>
        <AuthProvider>
          <SavedArtistsProvider>
            <PushRegistrar />
            <StatusBar style="light" />
            <Stack
              screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: colors.ink },
              }}
            >
              <Stack.Screen name="(auth)" />
              <Stack.Screen name="(tabs)" />
              <Stack.Screen
                name="artist/[id]"
                options={{
                  headerShown: true,
                  headerTransparent: true,
                  headerTitle: "",
                  headerTintColor: colors.text,
                  headerBackTitle: "Back",
                }}
              />
              <Stack.Screen
                name="vendor/[id]"
                options={{
                  headerShown: true,
                  headerTransparent: true,
                  headerTitle: "",
                  headerTintColor: colors.text,
                  headerBackTitle: "Back",
                }}
              />
              <Stack.Screen
                name="booker-profile"
                options={{
                  headerShown: true,
                  headerTitle: "My Profile",
                  headerTintColor: colors.text,
                  headerStyle: { backgroundColor: colors.ink },
                  headerBackTitle: "Back",
                }}
              />
              <Stack.Screen name="ask-giggfi" options={{ presentation: "modal" }} />
              <Stack.Screen name="notifications" options={{ presentation: "modal" }} />
              <Stack.Screen
                name="booking/[id]"
                options={{
                  headerShown: true,
                  headerTitle: "Booking",
                  headerTintColor: colors.text,
                  headerStyle: { backgroundColor: colors.ink },
                  headerBackTitle: "Back",
                }}
              />
            </Stack>
          </SavedArtistsProvider>
        </AuthProvider>
      </BottomSheetModalProvider>
      {showIntro ? <IntroSplash onFinish={() => setShowIntro(false)} /> : null}
    </GestureHandlerRootView>
  );
}
