import { describe, expect, it } from "vitest";

// Text the 16 Oct 2026 audit removed. It must not come back. Comments are skipped.
const BANNED = [
  "Saved artists and notification preferences",
  "finding you a backup",
  "don't try to reach the artist directly",
];

function visibleLines(source: string): string[] {
  return source.split("\n").filter((line) => !/^\s*(\/\/|\*|\/\*)/.test(line));
}

describe("audit wording stays out of the app", () => {
  const all = (import.meta as unknown as { glob: (p: string[], o: object) => Record<string, string> }).glob(
    ["../**/*.ts", "../**/*.tsx", "!../**/*.test.ts", "!../**/*.test.tsx"],
    { query: "?raw", import: "default", eager: true },
  );
  const files = Object.keys(all);
  it("finds the source files", () => expect(files.length).toBeGreaterThan(50));
  it.each(BANNED)("no file says %s", (phrase) => {
    const hits = files.filter((f) => visibleLines(all[f]).some((l) => l.includes(phrase)));
    expect(hits).toEqual([]);
  });
  it("the delete screen has no fixed number of days", () => {
    const file = files.find((f) => f.endsWith("app/delete-account.tsx"));
    expect(file).toBeTruthy();
    expect(all[file as string]).not.toMatch(/within 30 days/);
  });
});
