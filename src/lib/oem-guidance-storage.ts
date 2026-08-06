import { readJSON, writeJSON } from "./local-storage";

const KEY = "giggifi_oem_card_seen";

export function hasSeenOemCard(): Promise<boolean> {
  return readJSON<boolean>(KEY, false);
}

export function markOemCardSeen(): Promise<void> {
  return writeJSON(KEY, true);
}
