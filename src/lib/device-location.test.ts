import { beforeEach, describe, expect, it, vi } from "vitest";

const loc = vi.hoisted(() => ({
  requestForegroundPermissionsAsync: vi.fn(),
  hasServicesEnabledAsync: vi.fn(),
  getCurrentPositionAsync: vi.fn(),
  Accuracy: { High: 4 },
}));
vi.mock("expo-location", () => loc);
const cache = vi.hoisted(() => ({ getCachedLocation: vi.fn(), setCachedLocation: vi.fn() }));
vi.mock("./location-cache", () => cache);

import { getDeviceLocation, LOCATION_TIMEOUT_MS } from "./device-location";

beforeEach(() => {
  vi.useRealTimers();
  Object.values(loc).forEach((f) => typeof f === "function" && "mockReset" in f && (f as ReturnType<typeof vi.fn>).mockReset());
  cache.getCachedLocation.mockReset().mockResolvedValue(null);
  cache.setCachedLocation.mockReset();
  loc.hasServicesEnabledAsync.mockResolvedValue(true);
});

describe("getDeviceLocation", () => {
  it("uses a recent saved fix without asking", async () => {
    cache.getCachedLocation.mockResolvedValue({ lat: 1, lng: 2 });
    await expect(getDeviceLocation()).resolves.toEqual({ ok: true, coords: { lat: 1, lng: 2 } });
    expect(loc.requestForegroundPermissionsAsync).not.toHaveBeenCalled();
  });

  it("says denied when the user can still be asked again", async () => {
    loc.requestForegroundPermissionsAsync.mockResolvedValue({ status: "denied", canAskAgain: true });
    await expect(getDeviceLocation()).resolves.toEqual({ ok: false, reason: "denied" });
  });

  it("says blocked when Android will not ask again", async () => {
    loc.requestForegroundPermissionsAsync.mockResolvedValue({ status: "denied", canAskAgain: false });
    await expect(getDeviceLocation()).resolves.toEqual({ ok: false, reason: "blocked" });
  });

  it("says gps_off when location services are disabled", async () => {
    loc.requestForegroundPermissionsAsync.mockResolvedValue({ status: "granted", canAskAgain: true });
    loc.hasServicesEnabledAsync.mockResolvedValue(false);
    await expect(getDeviceLocation()).resolves.toEqual({ ok: false, reason: "gps_off" });
  });

  it("says timeout when no fix arrives in time", async () => {
    vi.useFakeTimers();
    loc.requestForegroundPermissionsAsync.mockResolvedValue({ status: "granted", canAskAgain: true });
    loc.getCurrentPositionAsync.mockReturnValue(new Promise(() => {}));
    const pending = getDeviceLocation();
    await vi.advanceTimersByTimeAsync(LOCATION_TIMEOUT_MS + 1);
    await expect(pending).resolves.toEqual({ ok: false, reason: "timeout" });
  });

  it("returns and saves the position on success", async () => {
    loc.requestForegroundPermissionsAsync.mockResolvedValue({ status: "granted", canAskAgain: true });
    loc.getCurrentPositionAsync.mockResolvedValue({ coords: { latitude: 19, longitude: 72 } });
    await expect(getDeviceLocation()).resolves.toEqual({ ok: true, coords: { lat: 19, lng: 72 } });
    expect(cache.setCachedLocation).toHaveBeenCalledWith(19, 72);
  });

  it("maps an unknown error to unknown", async () => {
    loc.requestForegroundPermissionsAsync.mockResolvedValue({ status: "granted", canAskAgain: true });
    loc.getCurrentPositionAsync.mockRejectedValue(new Error("boom"));
    await expect(getDeviceLocation()).resolves.toEqual({ ok: false, reason: "unknown" });
  });
});
