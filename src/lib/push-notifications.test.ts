import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  isDevice: true,
  permission: "granted",
  projectId: "proj-123" as string | undefined,
  tokenImpl: async () => ({ data: "ExponentPushToken[SECRET-TOKEN-VALUE]" }) as { data: string },
  post: vi.fn(async (_t: string) => ({ success: true })),
  channelsImpl: async () => {},
}));

vi.mock("react-native", () => ({ Platform: { OS: "android" } }));
vi.mock("react", () => ({ useCallback: (f: unknown) => f, useEffect: () => {}, useRef: (v: unknown) => ({ current: v }) }));
vi.mock("expo-device", () => ({ get isDevice() { return m.isDevice; } }));
vi.mock("expo-constants", () => ({ default: { get expoConfig() { return { extra: { eas: { projectId: m.projectId } } }; } } }));
vi.mock("expo-notifications", () => ({
  setNotificationHandler: () => {},
  setNotificationCategoryAsync: async () => {},
  setNotificationChannelAsync: async () => m.channelsImpl(),
  AndroidImportance: { MAX: 5, HIGH: 4, DEFAULT: 3 },
  getPermissionsAsync: async () => ({ status: m.permission }),
  getExpoPushTokenAsync: () => m.tokenImpl(),
  requestPermissionsAsync: async () => ({ status: m.permission }),
}));
const FakeApiError = vi.hoisted(() => class extends Error { status: number; constructor(status: number, message: string) { super(message); this.status = status; } });
vi.mock("./api", () => ({ ApiError: FakeApiError, registerPushToken: (t: string) => m.post(t) }));
vi.mock("./auth-context", () => ({ useAuth: () => ({ user: null }) }));
vi.mock("./use-app-foreground", () => ({ useAppForeground: () => {} }));
vi.mock("./telemetry", () => ({ captureError: () => {} }));
const store = vi.hoisted(() => ({ data: {} as Record<string, unknown> }));
vi.mock("./local-storage", () => ({
  readJSON: async (k: string, f: unknown) => (k in store.data ? store.data[k] : f),
  writeJSON: async (k: string, v: unknown) => { store.data[k] = v; },
}));

import { registerDeviceForPushDetailed } from "./push-notifications";
import { getPushStatus } from "./push-status";

let logs: string[];
beforeEach(() => {
  store.data = {};
  m.isDevice = true; m.permission = "granted"; m.projectId = "proj-123";
  m.tokenImpl = async () => ({ data: "ExponentPushToken[SECRET-TOKEN-VALUE]" });
  m.channelsImpl = async () => {};
  m.post.mockClear(); m.post.mockResolvedValue({ success: true });
  logs = [];
  vi.spyOn(console, "log").mockImplementation((...a: unknown[]) => { logs.push(a.join(" ")); });
});

describe("registerDeviceForPushDetailed", () => {
  it("happy path: registers the token once and records success", async () => {
    const r = await registerDeviceForPushDetailed("test");
    expect(r).toEqual({ ok: true, step: "done", error: null });
    expect(m.post).toHaveBeenCalledTimes(1);
    expect(m.post).toHaveBeenCalledWith("ExponentPushToken[SECRET-TOKEN-VALUE]");
    expect((await getPushStatus()).lastOkAt).not.toBeNull();
  });

  it("never logs the token or the project id", async () => {
    await registerDeviceForPushDetailed("test");
    const all = logs.join("\n");
    expect(all).toContain("[GIGGIFI PUSH]");
    expect(all).not.toContain("SECRET-TOKEN-VALUE");
    expect(all).not.toContain("proj-123");
  });

  it("stops (without throwing) at each early exit and says where", async () => {
    m.isDevice = false;
    expect((await registerDeviceForPushDetailed("t")).step).toBe("device");
    m.isDevice = true; m.permission = "undetermined";
    expect((await registerDeviceForPushDetailed("t")).step).toBe("permission");
    m.permission = "granted"; m.projectId = undefined;
    expect((await registerDeviceForPushDetailed("t")).step).toBe("project-id");
    expect(m.post).not.toHaveBeenCalled();
  });

  it("an Expo token failure is recorded at expo-token and does not throw", async () => {
    m.tokenImpl = async () => { throw new Error("Default FirebaseApp is not initialized"); };
    const r = await registerDeviceForPushDetailed("t");
    expect(r).toMatchObject({ ok: false, step: "expo-token" });
    expect(r.error).toContain("FirebaseApp");
    expect((await getPushStatus()).step).toBe("expo-token");
  });

  it("a channel-setup failure is non-fatal", async () => {
    m.channelsImpl = async () => { throw new Error("channel boom"); };
    const r = await registerDeviceForPushDetailed("t");
    expect(r.ok).toBe(true);
    expect(logs.join("\n")).toContain("channels failed (continuing)");
  });

  it("a failed POST reports the HTTP status", async () => {
    m.post.mockRejectedValue(new FakeApiError(401, "Login required."));
    const r = await registerDeviceForPushDetailed("t");
    expect(r).toMatchObject({ ok: false, step: "post" });
    expect(r.error).toContain("HTTP 401");
  });
});
