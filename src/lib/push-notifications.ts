import { useCallback, useEffect, useRef } from "react";
import { Platform } from "react-native";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import { useAuth } from "./auth-context";
import { ApiError, registerPushToken } from "./api";
import { markPushStep, recordPushResult } from "./push-status";
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

// Cross-platform runtime API (no native config/build needed either side) —
// matches the "giggifi-cta" categoryId the backend attaches whenever a
// push has an actionUrl (see expo-push.ts). Registered once at import
// time, same as the handler above; idempotent, safe to re-run.
// notification-router.ts already treats a button tap identically to a
// body tap (it never inspects actionIdentifier, just reads the
// notification's own actionUrl either way), so no separate navigation
// path is needed for this.
Notifications.setNotificationCategoryAsync("giggifi-cta", [
  { identifier: "view", buttonTitle: "View", options: { opensAppToForeground: true } },
]).catch((err) => captureError(err, "notification-category-register"));

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

function plog(message: string): void {
  console.log(`[GIGGIFI PUSH] ${message}`);
}

// Error text only (never a token), short enough to show in the UI.
function errText(err: unknown): string {
  return (err instanceof Error ? err.message : String(err)).slice(0, 200);
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

export interface PushRegistrationResult {
  ok: boolean;
  step: string;
  error: string | null;
}

// One registration attempt, step by step. Never throws: every exit is logged
// ("[GIGGIFI PUSH] …", booleans/status only — never a token or project id)
// and recorded in push-status so Notification Settings can show what
// happened. Does NOT prompt for permission (see requestPushPermission).
export async function registerDeviceForPushDetailed(source: string): Promise<PushRegistrationResult> {
  const finish = async (ok: boolean, step: string, error?: string): Promise<PushRegistrationResult> => {
    plog(ok ? "registration complete" : `registration stopped at ${step}: ${error ?? "unknown"}`);
    await recordPushResult({ ok, step, error });
    return { ok, step, error: ok ? null : (error ?? "Unknown error").slice(0, 200) };
  };

  plog(`start source=${source} platform=${Platform.OS}`);
  markPushStep("start");

  if (!Device.isDevice) return finish(false, "device", "Push needs a physical device");
  plog("isDevice=true");

  // Channels are nice to have, not a gate: a failure must never stop the
  // permission check or the token fetch.
  markPushStep("channels");
  try {
    await ensureAndroidChannels();
    plog("channels ok");
  } catch (err) {
    plog(`channels failed (continuing): ${errText(err)}`);
    captureError(err, "push-channels-setup");
  }

  markPushStep("permission");
  let status: string;
  try {
    ({ status } = await Notifications.getPermissionsAsync());
  } catch (err) {
    captureError(err, "push-permission-check");
    return finish(false, "permission", errText(err));
  }
  plog(`permission status=${status}`);
  if (status !== "granted") return finish(false, "permission", `Notification permission is ${status}`);

  markPushStep("project-id");
  const projectId = Constants.expoConfig?.extra?.eas?.projectId;
  plog(`projectId present=${Boolean(projectId)}`);
  if (!projectId) return finish(false, "project-id", "EAS project id missing from app config");

  markPushStep("expo-token");
  let expoToken: string;
  try {
    ({ data: expoToken } = await Notifications.getExpoPushTokenAsync({ projectId }));
  } catch (err) {
    captureError(err, "push-expo-token");
    return finish(false, "expo-token", errText(err));
  }
  plog(`expo token obtained=${Boolean(expoToken)}`);
  if (!expoToken) return finish(false, "expo-token", "Expo returned no push token");

  markPushStep("post");
  try {
    await registerPushToken(expoToken);
    plog("POST /push-token ok (HTTP 2xx)");
  } catch (err) {
    captureError(err, "push-token-post");
    const detail = err instanceof ApiError ? `HTTP ${err.status}: ${err.message}` : errText(err);
    plog(`POST /push-token failed: ${detail}`);
    return finish(false, "post", detail);
  }

  return finish(true, "done");
}

// Same name and "resolves even on failure" behaviour the primer callers
// already rely on, but the outcome is now logged + recorded.
export async function registerDeviceForPush(): Promise<void> {
  await registerDeviceForPushDetailed("primer");
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
    if (!userRef.current) {
      plog("silent register skipped: no signed-in user yet");
      return Promise.resolve();
    }
    plog("silent register: user present");
    return registerDeviceForPushDetailed("silent").then(() => undefined, (err) => captureError(err, "push-token-register-silent"));
  }, []);

  useEffect(() => {
    trySilentRegister();
  }, [user, trySilentRegister]);

  useAppForeground(trySilentRegister);
}
