import { readJSON, writeJSON } from "./local-storage";

// Small, secret-free record of the last push-registration attempt, so a
// failure that used to be invisible (no logs, no error tracking) can be seen
// on the Notification Settings screen. In memory + the app's existing
// key-value store (expo-secure-store via local-storage.ts). Never holds a
// token value — only booleans, a step name and a short message.

export interface PushStatus {
  lastAttemptAt: string | null; // ISO time of the most recent attempt
  lastOkAt: string | null; // ISO time of the last successful POST /push-token
  step: string; // last step reached, e.g. "permission", "expo-token", "post", "done"
  ok: boolean | null; // null = never attempted on this install
  error: string | null; // short message, no secrets
}

const KEY = "giggifi_push_status";
const EMPTY: PushStatus = { lastAttemptAt: null, lastOkAt: null, step: "never", ok: null, error: null };

let memory: PushStatus | null = null;

export async function getPushStatus(): Promise<PushStatus> {
  if (memory) return memory;
  try {
    memory = { ...EMPTY, ...(await readJSON<Partial<PushStatus>>(KEY, {})) };
  } catch {
    memory = { ...EMPTY };
  }
  return memory;
}

// Cheap, in-memory-only progress marker used between steps.
export function markPushStep(step: string): void {
  memory = { ...(memory ?? EMPTY), step };
}

export async function recordPushResult(result: { ok: boolean; step: string; error?: string | null }): Promise<PushStatus> {
  const now = new Date().toISOString();
  const prev = await getPushStatus();
  memory = {
    lastAttemptAt: now,
    lastOkAt: result.ok ? now : prev.lastOkAt,
    step: result.step,
    ok: result.ok,
    error: result.ok ? null : (result.error ?? "Unknown error").slice(0, 200),
  };
  try {
    await writeJSON(KEY, memory);
  } catch {
    // Best effort — the in-memory copy still serves this session.
  }
  return memory;
}
