import { describe, expect, it } from "vitest";

// Standing rule: everything a user can read in the app is plain English. No Hindi
// script and no Hinglish words, anywhere in src (comments are skipped).
const HINGLISH =
  /\b(chalu|karo|karoge|karein|karna|nahi|nahin|aap|aapka|aapke|kya|kaise|abhi|mein|dobara|pehle|kripya|shukriya|dhanyavaad|theek|galat|jaldi|zaroori|jankari|kholo|likho|sakte|sakta|baaki|shuru|khatam|chahiye|milega|bhejo|dekho|batao|wala|wali|hoga|hogi|raha|rahi|dabao|wapas|jagah|tumhara|dikhoge|ghante)\b/i;
const DEVANAGARI = /[ऀ-ॿ]/;

function visibleLines(source: string): string[] {
  return source
    .split("\n")
    .filter((line) => !/^\s*(\/\/|\*|\/\*)/.test(line))
    .map((line) => line.replace(/\/\/.*$/, ""));
}

describe("app text is English only", () => {
  // Every source file as text (Vite's glob; typed loosely because this project does
  // not include Node or Vite client types). Test files are left out.
  const all = (import.meta as unknown as { glob: (p: string[], o: object) => Record<string, string> }).glob(
    ["../**/*.ts", "../**/*.tsx", "!../**/*.test.ts", "!../**/*.test.tsx"],
    { query: "?raw", import: "default", eager: true },
  );
  const files = Object.keys(all);
  it("finds the source files", () => expect(files.length).toBeGreaterThan(50));
  it("no Hindi script and no Hinglish words in any screen, component or library file", () => {
    const hits: string[] = [];
    for (const file of files) {
      visibleLines(all[file]).forEach((line, i) => {
        if (DEVANAGARI.test(line) || HINGLISH.test(line)) hits.push(`${file}:${i + 1}`);
      });
    }
    expect(hits).toEqual([]);
  });
});
