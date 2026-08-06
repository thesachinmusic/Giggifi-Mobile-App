import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";

const KEY = "giggifi_push_prompt_state";
const MAX_ATTEMPTS = 3;
const REASK_AFTER_DAYS = 14;

interface PushPromptState {
  declineCount: number;
  lastDeclinedAt: string | null;
}

const DEFAULT_STATE: PushPromptState = { declineCount: 0, lastDeclinedAt: null };

// Same web/native branch as auth-storage.ts — expo-secure-store's web shim
// isn't reliable on this SDK version, so web falls back to localStorage.
async function readState(): Promise<PushPromptState> {
  const raw =
    Platform.OS === "web"
      ? typeof localStorage === "undefined" ? null : localStorage.getItem(KEY)
      : await SecureStore.getItemAsync(KEY);
  if (!raw) return DEFAULT_STATE;
  try {
    return JSON.parse(raw) as PushPromptState;
  } catch {
    return DEFAULT_STATE;
  }
}

async function writeState(state: PushPromptState): Promise<void> {
  const raw = JSON.stringify(state);
  if (Platform.OS === "web") {
    if (typeof localStorage !== "undefined") localStorage.setItem(KEY, raw);
    return;
  }
  await SecureStore.setItemAsync(KEY, raw);
}

export async function recordPushPromptDecline(): Promise<void> {
  const state = await readState();
  await writeState({ declineCount: state.declineCount + 1, lastDeclinedAt: new Date().toISOString() });
}

// True if the priming sheet should be shown: never declined, or declined
// fewer than 3 times and at least 14 days since the last decline.
export async function shouldShowPushPrimer(): Promise<boolean> {
  const { declineCount, lastDeclinedAt } = await readState();
  if (declineCount === 0) return true;
  if (declineCount >= MAX_ATTEMPTS) return false;
  if (!lastDeclinedAt) return true;
  const daysSince = (Date.now() - new Date(lastDeclinedAt).getTime()) / (24 * 60 * 60 * 1000);
  return daysSince >= REASK_AFTER_DAYS;
}
