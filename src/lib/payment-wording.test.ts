import { describe, expect, it } from "vitest";

// There is no payment deadline in the app's rules. Text that says a slot is locked or can be lost must not come back.
// Comments are skipped. "lock it in for your enquiry" (choosing an artist, not paying) is allowed.
const BANNED: Array<[string, RegExp]> = [
  ["lock in the slot", /lock in the slot/],
  ["to lock in", /to lock in/],
  ["lock it in", /lock it in(?! for your enquiry)/],
  ["keep your date", /keep your date/],
  ["avoid losing", /avoid losing/],
  ["pay now to", /pay now to/i],
];

function visibleLines(source: string): string[] {
  return source.split("\n").filter((line) => !/^\s*(\/\/|\*|\/\*)/.test(line));
}

describe("payment wording stays neutral", () => {
  const all = (import.meta as unknown as { glob: (p: string[], o: object) => Record<string, string> }).glob(
    ["../**/*.ts", "../**/*.tsx", "!../**/*.test.ts", "!../**/*.test.tsx"],
    { query: "?raw", import: "default", eager: true },
  );
  const files = Object.keys(all);
  it("finds the source files", () => expect(files.length).toBeGreaterThan(50));
  it.each(BANNED)("no file says %s", (_label, pattern) => {
    const hits = files.filter((f) => visibleLines(all[f]).some((l) => pattern.test(l)));
    expect(hits).toEqual([]);
  });
});
