import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";

// Same web/native branch as auth-storage.ts and push-permission-storage.ts —
// expo-secure-store's web shim isn't reliable on this SDK version, so web
// falls back to localStorage. Shared here now that a third and fourth
// caller need the identical pattern.
export async function readJSON<T>(key: string, fallback: T): Promise<T> {
  const raw =
    Platform.OS === "web"
      ? typeof localStorage === "undefined" ? null : localStorage.getItem(key)
      : await SecureStore.getItemAsync(key);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export async function writeJSON<T>(key: string, value: T): Promise<void> {
  const raw = JSON.stringify(value);
  if (Platform.OS === "web") {
    if (typeof localStorage !== "undefined") localStorage.setItem(key, raw);
    return;
  }
  await SecureStore.setItemAsync(key, raw);
}
