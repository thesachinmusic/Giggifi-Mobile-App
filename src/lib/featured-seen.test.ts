import { describe, expect, it } from "vitest";
import { SEEN_REPEAT_MS, idsToReport } from "./featured-seen";

const read = (import.meta as unknown as { glob: (p: string[], o: object) => Record<string, string> }).glob(["../app/(tabs)/index.tsx", "./api.ts"], { query: "?raw", import: "default", eager: true });
const src = (name: string) => Object.entries(read).find(([k]) => k.endsWith(name))![1];

describe("which ids are sent", () => {
  it("each artist once, then not again for 30 minutes, then again", () => {
    const mem = new Map<string, number>();
    expect(idsToReport(["a", "b"], 1_000, mem)).toEqual(["a", "b"]);
    expect(idsToReport(["a", "b", "c"], 1_000 + 60_000, mem)).toEqual(["c"]);
    expect(idsToReport(["a", "b"], 1_000 + SEEN_REPEAT_MS - 1, mem)).toEqual([]);
    expect(idsToReport(["a", "b"], 1_000 + SEEN_REPEAT_MS, mem)).toEqual(["a", "b"]);
  });
  it("no repeats in one list, no empty ids, at most 8", () => {
    const mem = new Map<string, number>();
    expect(idsToReport(["a", "a", "", "b"], 5, mem)).toEqual(["a", "b"]);
    expect(idsToReport(Array.from({ length: 20 }, (_, i) => `id${i}`), 5, mem)).toHaveLength(8);
    expect(idsToReport([], 5, mem)).toEqual([]);
  });
});

describe("wiring", () => {
  const HOME = src("(tabs)/index.tsx");
  it("sends only the paid list, only while Home is in front and the rail is on screen", () => {
    expect(HOME).toContain("if (!focused || !featuredSectionVisible || featured.length === 0) return;");
    expect(HOME).toContain("sendFeaturedSeen(idsToReport(featured.map((a) => a.id)));");
    expect(HOME).not.toMatch(/sendFeaturedSeen\([^)]*featuredFill/);
  });
  it("the request needs no login, sends only artist ids, and ignores any failure", () => {
    const api = src("/api.ts");
    expect(api).toContain('"/api/mobile/featured/seen", { method: "POST", body: JSON.stringify({ artistIds }) }, false)');
    expect(api).toContain(".catch(() => undefined)");
  });
});
