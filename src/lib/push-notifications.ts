import { useCallback, useEffect, useRef } from "react";
import { Platform } from "react-native";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import { useAuth } from "./auth-context";
import { registerPushToken } from "./api";
import { useAppForeground } from "./use-app-foreground";
import { captureError } from "./telemetry";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

// Six categories matching exactly what the backend sends as `channelId` in
// the Expo push payload (website repo: lib/notifications/channels/expo-push.ts)
// — a marketing offer must never interrupt at the same level as a payment
// failure, so importance is set per-category, not once globally.
const CHANNELS: Record<string, { name: string; importance: Notifications.AndroidImportance }> = {
  bookings: { name: "Bookings", importance: Notifications.AndroidImportance.MAX },
  payments: { name: "Payments", importance: Notifications.AndroidImportance.MAX },
  event_day: { name: "Event Day", importance: Notifications.AndroidImportance.MAX },
  security: { name: "Security", importance: Notifications.AndroidImportance.HIGH },
  support: { name: "Support", importance: Notifications.AndroidImportance.DEFAULT },
  // DEFAULT, not LOW — offers should still show with sound, just never as a
  // heads-up popup the way bookings/payments/event_day do.
  offers: { name: "Offers", importance: Notifications.AndroidImportance.DEFAULT },
};

// setNotificationChannelAsync is an idempotent upsert — safe to call on
// every app start/foreground, no "does it already exist" guard needed.
async function ensureAndroidChannels(): Promise<void> {
  if (Platform.OS !== "android") return;
  await Promise.all(
    Object.entries(CHANNELS).map(([id, cfg]) =>
      Notifications.setNotificationChannelAsync(id, {
        name: cfg.name,
        importance: cfg.importance,
        sound: "default",
        vibrationPattern: [0, 250, 250, 250],
      }),
    ),
  );
}

// Silent path: returns a token only if permission is ALREADY granted, never
// prompts. Used by the auto-run registration effect below (bugs 5/6) — the
// explicit ask only ever happens via requestPushPermission(), triggered from
// the primer sheet after the user has a reason to say yes.
async function getTokenIfPermitted(): Promise<string | null> {
  if (!Device.isDevice) return null; // push tokens don't work on simulators/emulators

  await ensureAndroidChannels();

  const { status } = await Notifications.getPermissionsAsync();
  if (status !== "granted") return null;

  const projectId = Constants.expoConfig?.extra?.eas?.projectId;
  if (!projectId) return null;

  const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
  return token;
}

// Only ever called from the push-primer sheet's "Enable" button — this is
// the one and only place the OS permission dialog is triggered. iOS shows
// this at most once, so it must never fire automatically on login.
export async function requestPushPermission(): Promise<boolean> {
  await ensureAndroidChannels();
  const { status } = await Notifications.requestPermissionsAsync({
    ios: { allowAlert: true, allowBadge: true, allowSound: true },
    android: {},
  });
  return status === "granted";
}

export async function registerDeviceForPush(): Promise<void> {
  const token = await getTokenIfPermitted();
  if (token) await registerPushToken(token);
}

// Registers this device's push token against the logged-in user whenever
// auth state settles on a signed-in user, AND re-syncs on every foreground
// (Expo push tokens can rotate silently — a stale one kills push for that
// device with no signal otherwise). Never requests permission itself —
// purely a silent re-sync of an already-granted permission.
export function usePushRegistration() {
  const { user } = useAuth();
  const userRef = useRef(user);
  userRef.current = user;

  const trySilentRegister = useCallback(() => {
    if (!userRef.current) return Promise.resolve();
    return registerDeviceForPush().catch((err) => captureError(err, "push-token-register-silent"));
  }, []);

  useEffect(() => {
    trySilentRegister();
  }, [user, trySilentRegister]);

  useAppForeground(trySilentRegister);
}
