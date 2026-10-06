import { beforeEach, describe, expect, it, vi } from "vitest";

const kv = vi.hoisted(() => ({ data: {} as Record<string, string> }));
vi.mock("react-native", () => ({ Platform: { OS: "ios" } }));
vi.mock("expo-secure-store", () => ({
  getItemAsync: async (k: string) => kv.data[k] ?? null,
  setItemAsync: async (k: string, v: string) => { kv.data[k] = v; },
}));

import { recordPushPromptDecline, shouldShowPushPrimer } from "./push-permission-storage";

// The existing primer cap that the Home-entry primer reuses unchanged.
describe("push primer cap (3 declines, 14-day re-ask)", () => {
  beforeEach(() => { kv.data = {}; vi.useRealTimers(); });

  it("shows when never declined", async () => expect(await shouldShowPushPrimer()).toBe(true));

  it("after one decline: hidden for 14 days, then shown again", async () => {
    await recordPushPromptDecline();
    expect(await shouldShowPushPrimer()).toBe(false);
    vi.useFakeTimers();
    vi.setSystemTime(Date.now() + 15 * 24 * 60 * 60 * 1000);
    expect(await shouldShowPushPrimer()).toBe(true);
  });

  it("after 3 declines: never again", async () => {
    await recordPushPromptDecline(); await recordPushPromptDecline(); await recordPushPromptDecline();
    vi.useFakeTimers();
    vi.setSystemTime(Date.now() + 365 * 24 * 60 * 60 * 1000);
    expect(await shouldShowPushPrimer()).toBe(false);
  });
});
