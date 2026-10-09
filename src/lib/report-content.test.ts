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
