import { useEffect, useRef, useState } from "react";
import { AppState, View, ActivityIndicator, type AppStateStatus } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { BottomSheetModalProvider } from "@gorhom/bottom-sheet";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { AuthProvider } from "@/lib/auth-context";
import { SavedArtistsProvider } from "@/lib/saved-artists-context";
import { usePushRegistration } from "@/lib/push-notifications";
import { recoverPendingPayment } from "@/lib/pending-payment-recovery";
import { IntroSplash } from "@/components/IntroSplash";
import { useAppFonts } from "@/theme/typography";
import { colors } from "@/theme";

SplashScreen.preventAutoHideAsync().catch(() => {});

function PushRegistrar() {
  usePushRegistration();
  return null;
}

// App-wide backstop for a Razorpay payment whose verify call never landed —
// retries on cold start and every time the app returns to the foreground,
// regardless of which screen is open. The booking screen itself also
// retries on focus; this covers the case where the user never navigates
// back to that exact screen before reopening the app.
function PendingPaymentRecovery() {
  const appState = useRef(AppState.currentState);

  useEffect(() => {
    recoverPendingPayment().catch(() => {});

    const subscription = AppState.addEventListener("change", (next: AppStateStatus) => {
      const cameToForeground = appState.current.match(/inactive|background/) && next === "active";
      appState.current = next;
      if (cameToForeground) {
        recoverPendingPayment().catch(() => {});
      }
    });

    return () => subscription.remove();
  }, []);

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
            <PendingPaymentRecovery />
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
