import { useCallback, useEffect, useState } from "react";
import { View, ActivityIndicator, Platform } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { BottomSheetModalProvider } from "@gorhom/bottom-sheet";
import { Stack } from "expo-router";
import * as Sentry from "@sentry/react-native";
import * as SplashScreen from "expo-splash-screen";
import * as Updates from "expo-updates";
import { StatusBar } from "expo-status-bar";
import { AuthProvider, useAuth } from "@/lib/auth-context";
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
import { AgeGateScreen } from "@/components/AgeGateScreen";
import { useAppFonts } from "@/theme/typography";
import { colors } from "@/theme";

initTelemetry();

SplashScreen.preventAutoHideAsync().catch((err) => captureError(err, "splash-prevent-auto-hide"));

function PushRegistrar() {
  usePushRegistration();
  return null;
}

// Full-screen, non-dismissable overlay enforcing the 18+ requirement
// (Play Store / legal) -- mirrors the website's own needsAgeGate check in
// components/giggifi-app.tsx. Rendered as the last child inside
// AuthProvider so it sits on top of the Stack navigator and every modal
// screen in it once a logged-in user has no dateOfBirth on file; returns
// null the rest of the time (logged out, still loading, or already has a
// DOB on record), so it never blocks the phone/OTP flow itself.
function AgeGate() {
  const { user, isLoading } = useAuth();
  if (isLoading || !user || user.dateOfBirth) return null;
  return <AgeGateScreen />;
}

// Confirmed root cause of "OTA published but nothing changes on device even
// after force-closing and reopening": expo-updates' native ON_LOAD default
// only starts a background fetch on cold start and applies it on a LATER
// cold start — it never blocks the current launch (fallbackToCacheTimeout
// governs how long it's willing to wait, and older installed builds may
// predate that being raised from its 0 default). A background fetch tied to
// the app process doesn't survive the process being killed, so a real-world
// "open, immediately force-close, reopen" cycle can repeat forever without
// ever giving one fetch enough wall-clock time to finish — no update ever
// gets cached, let alone applied.
//
// This explicitly awaits the check+fetch, then reloads immediately once a
// newer update is ready, so a fresh OTA can apply within the SAME cold
// start it was fetched in — rather than requiring one extra full relaunch
// on top of whatever it already took for the fetch to survive. Runs once
// on mount, before the user has meaningfully interacted with anything, so
// an occasional reload here reads as normal app startup, not a disruption
// mid-task.
function OtaUpdateChecker() {
  useEffect(() => {
    if (!Updates.isEnabled) return;
    (async () => {
      try {
        const result = await Updates.checkForUpdateAsync();
        if (!result.isAvailable) return;
        await Updates.fetchUpdateAsync();
        await Updates.reloadAsync();
      } catch (err) {
        // No network, rate-limited, etc. — the existing cached/embedded
        // bundle keeps running; not worth surfacing to the user.
        captureError(err, "ota-update-check");
      }
    })();
  }, []);
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
                <OtaUpdateChecker />
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
                  {/* Mandatory phone/OTP gate for a fresh install or any
                      other logged-out state — see index.tsx's redirect and
                      this screen's own top comment. gestureEnabled: false
                      because index.tsx replaces its own history entry, so
                      there's no meaningful screen underneath to swipe back
                      to; hardware/edge-swipe back should do nothing, not
                      reveal a blank frame. */}
                  <Stack.Screen name="verify" options={{ headerShown: false, gestureEnabled: false }} />
                  <Stack.Screen name="(tabs)" />
                  {/* headerShown: false, not headerTransparent — a
                      headerTransparent native header floats its own
                      touchable native view over the whole screen, and on
                      Android that's the confirmed reason tapping the hero
                      video here did nothing (see ArtistHero's own comment):
                      react-native-screens' transparent header on Android has
                      documented touch-swallowing bugs for content under it.
                      video-feed.tsx (this feature's confirmed-working
                      reference) has no native header at all — this makes
                      artist/[id] match that instead. A custom back button is
                      rendered in the hero itself now that the native one is
                      gone. */}
                  <Stack.Screen name="artist/[id]" options={{ headerShown: false }} />
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
                    name="edit-profile"
                    options={{
                      headerShown: true,
                      headerTitle: "Edit Profile",
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
                  <Stack.Screen
                    name="how-it-works"
                    options={{
                      headerShown: true,
                      headerTitle: "Secure Payment",
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
                  <Stack.Screen
                    name="booking/rebook"
                    options={{
                      headerShown: true,
                      headerTitle: "Book Again",
                      headerTintColor: colors.text,
                      headerStyle: { backgroundColor: colors.ink },
                      headerBackTitle: "Back",
                    }}
                  />
                  {/* headerTitle deliberately omitted here — the screen sets
                      it itself via <Stack.Screen options={{ title }} />
                      once the group's real label loads, same composability
                      expo-router already supports for every screen below. */}
                  <Stack.Screen
                    name="discover/[group]"
                    options={{
                      headerShown: true,
                      headerTintColor: colors.text,
                      headerStyle: { backgroundColor: colors.ink },
                      headerBackTitle: "Back",
                    }}
                  />
                </Stack>
              </NotificationsProvider>
            </VideoMuteProvider>
          </SavedArtistsProvider>
        <AgeGate />
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
