import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("expo-router", () => ({ router: { replace: vi.fn() } }));
vi.mock("./auth-storage", () => ({ getStoredToken: vi.fn(), clearStoredToken: vi.fn() }));
vi.mock("./session-events", () => ({ emitSessionExpired: vi.fn() }));
vi.mock("./toast-host", () => ({ showToast: vi.fn() }));

import { canReachServer } from "./connectivity";

afterEach(() => vi.unstubAllGlobals());

describe("canReachServer", () => {
  it("is true for any HTTP answer, even an error status", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 500 }));
    await expect(canReachServer()).resolves.toBe(true);
  });
  it("is false when the request fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Network request failed")));
    await expect(canReachServer()).resolves.toBe(false);
  });
});
