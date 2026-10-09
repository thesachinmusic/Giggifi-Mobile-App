import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("expo-router", () => ({ router: { replace: vi.fn() } }));
vi.mock("./auth-storage", () => ({ getStoredToken: vi.fn(async () => "tok"), clearStoredToken: vi.fn() }));
vi.mock("./session-events", () => ({ emitSessionExpired: vi.fn() }));
vi.mock("./toast-host", () => ({ showToast: vi.fn() }));

import { ApiError, reportContent } from "./api";

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

describe("reportContent", () => {
  it("sends a booking report with concern and no extra fields", async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => ({ ok: true }) });
    await reportContent({ targetType: "booking", targetId: "b1", reason: "harassment", concern: "other_party" });
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ targetType: "booking", targetId: "b1", reason: "harassment", concern: "other_party" });
  });

  it("clears the session and opens the suspended screen on 401 + ACCOUNT_SUSPENDED", async () => {
    const { router } = await import("expo-router");
    const { emitSessionExpired } = await import("./session-events");
    const { showToast } = await import("./toast-host");
    fetchMock.mockResolvedValue({ ok: false, status: 401, json: async () => ({ error: "This account has been suspended.", code: "ACCOUNT_SUSPENDED" }) });
    await expect(reportContent({ targetType: "review", targetId: "r1", reason: "spam" })).rejects.toMatchObject({ status: 401, code: "ACCOUNT_SUSPENDED" });
    expect(router.replace).toHaveBeenCalledWith("/account-suspended");
    expect(emitSessionExpired).toHaveBeenCalled();
    expect(showToast).not.toHaveBeenCalled();
  });

  it("keeps the expired-session behaviour for a 401 without the code", async () => {
    const { router } = await import("expo-router");
    const { showToast } = await import("./toast-host");
    vi.mocked(router.replace).mockClear();
    fetchMock.mockResolvedValue({ ok: false, status: 401, json: async () => ({ error: "Login required." }) });
    await expect(reportContent({ targetType: "review", targetId: "r1", reason: "spam" })).rejects.toMatchObject({ status: 401 });
    expect(router.replace).toHaveBeenCalledWith("/(tabs)");
    expect(showToast).toHaveBeenCalled();
  });

  it("POSTs the report to /api/mobile/report with the bearer token", async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => ({ ok: true }) });
    await expect(reportContent({ targetType: "review", targetId: "r1", reason: "spam", note: "n" })).resolves.toEqual({ ok: true });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toMatch(/\/api\/mobile\/report$/);
    expect(init.method).toBe("POST");
    expect(init.headers.Authorization).toBe("Bearer tok");
    expect(JSON.parse(init.body)).toEqual({ targetType: "review", targetId: "r1", reason: "spam", note: "n" });
  });

  it("surfaces the server's message on failure (e.g. rate limit)", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 429, json: async () => ({ error: "Too many reports. Please try again later." }) });
    await expect(reportContent({ targetType: "artist-profile", targetId: "a1", reason: "fake" })).rejects.toMatchObject({
      status: 429,
      message: "Too many reports. Please try again later.",
    });
    await expect(reportContent({ targetType: "artist-profile", targetId: "a1", reason: "fake" })).rejects.toBeInstanceOf(ApiError);
  });
});
