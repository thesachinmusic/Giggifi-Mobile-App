import { describe, expect, it } from "vitest";

// A debug log that runs in a release build is noise on the user's device (and a place for something
// sensitive to slip out later). Every console.log / debug / info in the app must sit behind __DEV__.
// console.error is not covered: ErrorBoundary keeps it on purpose, as the only record of a crash
// until a Sentry DSN exists.
const files = (import.meta as unknown as { glob: (p: string[], o: object) => Record<string, string> }).glob(
  ["../**/*.ts", "../**/*.tsx"],
  { query: "?raw", import: "default", eager: true },
);

describe("console logging in release builds", () => {
  it("every console.log / debug / info is behind __DEV__", () => {
    const offenders: string[] = [];
    for (const [file, src] of Object.entries(files)) {
      if (/\.test\.tsx?$/.test(file)) continue;
      src.split("\n").forEach((line, i) => {
        const code = line.trim();
        if (code.startsWith("//") || code.startsWith("*")) return;
        if (/console\.(log|debug|info)\(/.test(code) && !/__DEV__/.test(code)) offenders.push(`${file}:${i + 1}`);
      });
    }
    expect(offenders).toEqual([]);
  });

  it("the push log helper is silent outside development", () => {
    const key = Object.keys(files).find((k) => /(^|\/)push-notifications\.ts$/.test(k));
    expect(key).toBeTruthy();
    expect(files[key as string]).toMatch(/if \(__DEV__\) console\.log\(`\[GIGGIFI PUSH\]/);
  });
});
