import { API_BASE_URL } from "./api";

const PROBE_TIMEOUT_MS = 8_000;

// True when GiggiFi's server answers at all (any HTTP status). Uses a plain
// request because the app has no network-state module, and adding one would
// need a new native build.
export async function canReachServer(): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
  try {
    await fetch(`${API_BASE_URL}/api/mobile/session`, { method: "GET", signal: controller.signal });
    return true;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}
