import { readJSON, writeJSON } from "./local-storage";

const KEY = "giggifi_home_city";

export function getHomeCity(): Promise<string | null> {
  return readJSON<string | null>(KEY, null);
}

export function setHomeCity(city: string | null): Promise<void> {
  return writeJSON(KEY, city);
}
