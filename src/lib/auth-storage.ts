import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";

const TOKEN_KEY = "giggifi_session_token";

// expo-secure-store's web shim isn't reliable on this SDK version (throws
// rather than falling back), so branch to localStorage on web explicitly.
// Native (iOS/Android) is unaffected — it always goes through SecureStore.

// SecureStore has no abort/timeout support of its own, and a stuck native
// call (seen on some Android devices/OS versions) previously hung these
// functions forever — the exact same failure mode api.ts's request() used
// to have, except this one sits underneath EVERY caller here, including
// auth-context.tsx's refreshSession(), which runs on every app launch
// before any screen renders. A hang here isn't a stuck spinner on one
// screen, it's a permanently blank app. Racing against a timeout lets
// every caller move on — getStoredToken() falls back to "no token" (the
// same as a real logged-out state, and recoverable via a normal re-login)
// rather than blocking app startup indefinitely.
const SECURE_STORE_TIMEOUT_MS = 8000;

function withTimeout<T>(promise: Promise<T>, fallback: T): Promise<T> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(fallback), SECURE_STORE_TIMEOUT_MS);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      () => {
        clearTimeout(timer);
        resolve(fallback);
      },
    );
  });
}

export async function getStoredToken(): Promise<string | null> {
  if (Platform.OS === "web") {
    return typeof localStorage === "undefined" ? null : localStorage.getItem(TOKEN_KEY);
  }
  return withTimeout(SecureStore.getItemAsync(TOKEN_KEY), null);
}

export async function setStoredToken(token: string): Promise<void> {
  if (Platform.OS === "web") {
    if (typeof localStorage !== "undefined") localStorage.setItem(TOKEN_KEY, token);
    return;
  }
  // Best-effort, same as clearStoredToken below — a hung write shouldn't
  // block the caller (e.g. confirmOtp) forever; the next getStoredToken()
  // read will just come back empty and the user re-authenticates.
  await withTimeout(SecureStore.setItemAsync(TOKEN_KEY, token), undefined);
}

export async function clearStoredToken(): Promise<void> {
  if (Platform.OS === "web") {
    if (typeof localStorage !== "undefined") localStorage.removeItem(TOKEN_KEY);
    return;
  }
  await withTimeout(SecureStore.deleteItemAsync(TOKEN_KEY), undefined);
}
