import * as Location from "expo-location";
import { getCachedLocation, setCachedLocation } from "./location-cache";

// Why a location could not be read — each one needs different words and a
// different next step, so they are never merged into one "denied".
export type LocationFailure = "denied" | "blocked" | "gps_off" | "timeout" | "unknown";

export type DeviceLocationResult = { ok: true; coords: { lat: number; lng: number } } | { ok: false; reason: LocationFailure };

// A GPS fix that never arrives (indoors, poor signal) would leave the screen
// waiting for good, so give up after this long.
export const LOCATION_TIMEOUT_MS = 15_000;

class LocationTimeout extends Error {}

function failureFrom(err: unknown): LocationFailure {
  if (err instanceof LocationTimeout) return "timeout";
  const code = (err as { code?: string } | null)?.code;
  if (code === "E_LOCATION_SERVICES_DISABLED") return "gps_off";
  if (code === "E_LOCATION_TIMEOUT") return "timeout";
  return "unknown";
}

// Recent saved fix first; otherwise ask for permission and read the GPS.
export async function getDeviceLocation(): Promise<DeviceLocationResult> {
  const cached = await getCachedLocation();
  if (cached) return { ok: true, coords: cached };

  try {
    const permission = await Location.requestForegroundPermissionsAsync();
    if (permission.status !== "granted") {
      return { ok: false, reason: permission.canAskAgain === false ? "blocked" : "denied" };
    }
    if (!(await Location.hasServicesEnabledAsync())) return { ok: false, reason: "gps_off" };

    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new LocationTimeout()), LOCATION_TIMEOUT_MS);
    });
    try {
      const position = await Promise.race([Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }), timeout]);
      const coords = { lat: position.coords.latitude, lng: position.coords.longitude };
      await setCachedLocation(coords.lat, coords.lng);
      return { ok: true, coords };
    } finally {
      clearTimeout(timer);
    }
  } catch (err) {
    return { ok: false, reason: failureFrom(err) };
  }
}

// Plain-English copy per failure. Never shows raw error text.
export const LOCATION_FAILURE_COPY: Record<LocationFailure, { title: string; text: string }> = {
  denied: {
    title: "Location permission is needed",
    text: "Allow location so we can find artists near you.",
  },
  blocked: {
    title: "Location is blocked for GiggiFi",
    text: "Open Settings, allow location for GiggiFi, then come back and try again.",
  },
  gps_off: {
    title: "Your phone's location is switched off",
    text: "Turn on location in your phone's quick settings, then try again.",
  },
  timeout: {
    title: "Finding your location is taking too long",
    text: "Move to an open area or check your signal, then try again.",
  },
  unknown: {
    title: "We couldn't get your location",
    text: "Please try again.",
  },
};
