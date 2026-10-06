import { beforeEach, describe, expect, it, vi } from "vitest";

const store = vi.hoisted(() => ({ data: {} as Record<string, unknown> }));
vi.mock("./local-storage", () => ({
  readJSON: async (key: string, fallback: unknown) => (key in store.data ? store.data[key] : fallback),
  writeJSON: async (key: string, value: unknown) => { store.data[key] = value; },
}));

describe("push-status", () => {
  beforeEach(() => { store.data = {}; vi.resetModules(); });

  it("starts as never attempted", async () => {
    const { getPushStatus } = await import("./push-status");
    const s = await getPushStatus();
    expect(s.ok).toBeNull();
    expect(s.lastOkAt).toBeNull();
  });

  it("failure records step + trimmed error and is not 'registered'", async () => {
    const { recordPushResult } = await import("./push-status");
    const s = await recordPushResult({ ok: false, step: "expo-token", error: "x".repeat(500) });
    expect(s).toMatchObject({ ok: false, step: "expo-token", lastOkAt: null });
    expect(s.error).toHaveLength(200);
  });

  it("success sets lastOkAt; a later failure keeps it but shows the error; survives restart", async () => {
    const first = await import("./push-status");
    await first.recordPushResult({ ok: true, step: "done" });
    const okAt = (await first.getPushStatus()).lastOkAt;
    expect(okAt).not.toBeNull();
    const after = await first.recordPushResult({ ok: false, step: "post", error: "HTTP 500" });
    expect(after.lastOkAt).toBe(okAt);
    vi.resetModules();
    const second = await import("./push-status");
    expect((await second.getPushStatus()).error).toBe("HTTP 500");
  });
});
