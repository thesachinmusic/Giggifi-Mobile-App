import { readJSON, writeJSON } from "./local-storage";

const KEY = "giggifi_offers_optin_seen";

export function hasSeenOffersOptIn(): Promise<boolean> {
  return readJSON<boolean>(KEY, false);
}

export function markOffersOptInSeen(): Promise<void> {
  return writeJSON(KEY, true);
}
