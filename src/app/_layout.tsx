import { useCallback, useEffect, useState } from "react";
import { View, ActivityIndicator, Platform } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { BottomSheetModalProvider } from "@gorhom/bottom-sheet";
import { Stack } from "expo-router";
import * as Sentry from "@sentry/react-native";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { AuthProvider } from "@/lib/auth-context";
import { SavedArtistsProvider } from "@/lib/saved-artists-context";
import { NotificationsProvider } from "@/lib/notifications-context";
import { VideoMuteProvider } from "@/lib/video-mute-context";
import { usePushRegistration } from "@/lib/push-notifications";
import { useNotificationRouter } from "@/lib/notification-router";
import { NotificationToastHost } from "@/lib/toast-host";
import { recoverPendingPayment } from "@/lib/pending-payment-recovery";
import { useAppForeground } from "@/lib/use-app-foreground";
import { initTelemetry, captureError } from "@/lib/telemetry";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { IntroSplash } from "@/components/IntroSplash";
import { useAppFonts } from "@/theme/typography";
import { colors } from "@/theme";

initTelemetry();

SplashScreen.preventAutoHideAsync().catch((err) => captureError(err, "splash-prevent-auto-hide"));

function PushRegistrar() {
  usePushRegistration();
  return null;
}

// Routes a tapped notification to its actionUrl — cold start and a tap
// while already running both flow through the same effect. See
// src/lib/notification-router.ts for why this is safe against index.tsx's
// own <Redirect>.
//
// Not mounted on web at all (see below) — expo-notifications has no web
// implementation of getLastNotificationResponseAsync/
// useLastNotificationResponse (confirmed via node_modules source: unlike
// permissions and listeners, which degrade gracefully on web, this one
// throws "not available on web" the moment it's called).
function NotificationTapHandler() {
  useNotificationRouter();
  return null;
}

// App-wide backstop for a Razorpay payment whose verify call never landed —
// retries on cold start and every time the app returns to the foreground,
// regardless of which screen is open. The booking screen itself also
// retries on focus; this covers the case where the user never navigates
// back to that exact screen before reopening the app.
function PendingPaymentRecovery() {
  const retry = useCallback(() => {
    recoverPendingPayment().catch((err) => captureError(err, "pending-payment-recovery"));
  }, []);

  useEffect(() => {
    retry();
  }, [retry]);

  useAppForeground(retry);

  return null;
}

function RootLayoutContent() {
  const [fontsLoaded, fontError] = useAppFonts();
  const [showIntro, setShowIntro] = useState(true);

  useEffect(() => {
    if (fontsLoaded || fontError) SplashScreen.hideAsync().catch((err) => captureError(err, "splash-hide"));
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
            <VideoMuteProvider>
              <NotificationsProvider>
                <PushRegistrar />
                {Platform.OS !== "web" ? <NotificationTapHandler /> : null}
                <NotificationToastHost />
                <PendingPaymentRecovery />
                <StatusBar style="light" />
                <Stack
                  screenOptions={{
                    headerShown: false,
                    contentStyle: { backgroundColor: colors.ink },
                  }}
                >
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
                  <Stack.Screen
                    name="notification-settings"
                    options={{
                      headerShown: true,
                      headerTitle: "Notification Settings",
                      headerTintColor: colors.text,
                      headerStyle: { backgroundColor: colors.ink },
                      headerBackTitle: "Back",
                    }}
                  />
                  <Stack.Screen
                    name="saved"
                    options={{
                      headerShown: true,
                      headerTitle: "Saved Artists",
                      headerTintColor: colors.text,
                      headerStyle: { backgroundColor: colors.ink },
                      headerBackTitle: "Back",
                    }}
                  />
                  <Stack.Screen
                    name="delete-account"
                    options={{
                      headerShown: true,
                      headerTitle: "Delete Account",
                      headerTintColor: colors.text,
                      headerStyle: { backgroundColor: colors.ink },
                      headerBackTitle: "Back",
                    }}
                  />
                  <Stack.Screen name="ask-giggfi" options={{ presentation: "modal" }} />
                  <Stack.Screen name="notifications" options={{ presentation: "modal" }} />
                  <Stack.Screen name="video-feed" options={{ presentation: "fullScreenModal", animation: "fade" }} />
                  <Stack.Screen
                    name="quick-moments/index"
                    options={{
                      headerShown: true,
                      headerTitle: "Quick Moments",
                      headerTintColor: colors.text,
                      headerStyle: { backgroundColor: colors.ink },
                      headerBackTitle: "Back",
                    }}
                  />
                  <Stack.Screen
                    name="quick-moments/book"
                    options={{
                      headerShown: true,
                      headerTitle: "Book a Slot",
                      headerTintColor: colors.text,
                      headerStyle: { backgroundColor: colors.ink },
                      headerBackTitle: "Back",
                    }}
                  />
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
              </NotificationsProvider>
            </VideoMuteProvider>
          </SavedArtistsProvider>
        </AuthProvider>
      </BottomSheetModalProvider>
      {showIntro ? <IntroSplash onFinish={() => setShowIntro(false)} /> : null}
    </GestureHandlerRootView>
  );
}

// ErrorBoundary is the outermost thing — it has to wrap the font-loading
// gate and the intro splash too, not just the fully-loaded app, since a
// render throw can happen during either of those. Sentry.wrap adds native
// crash tracking and screen/touch breadcrumbs around the same root; it
// no-ops the same way captureError does when EXPO_PUBLIC_SENTRY_DSN isn't set.
function RootLayout() {
  return (
    <ErrorBoundary>
      <RootLayoutContent />
    </ErrorBoundary>
  );
}

export default Sentry.wrap(RootLayout);
