import { describe, expect, it } from "vitest";
import { CATEGORIES, canonicalCategory } from "./categories";

// Spellings come from the website's lib/artist-matching.ts / enquiry-categories.ts.
describe("client categories", () => {
  const labels = CATEGORIES.map((c) => c.label as string);

  it("has Sufi and Bhajan / Jamming as their own top-level categories", () => {
    expect(labels).toContain("Sufi");
    expect(labels).toContain("Bhajan / Jamming");
  });

  it("offers Poet and Sketch Artist as Browse pills", () => {
    expect(labels).toContain("Poet");
    expect(labels).toContain("Sketch Artist");
  });

  it("no longer offers the old names", () => {
    expect(labels).not.toContain("Sufi Band");
    expect(labels).not.toContain("Bhajan Clubbing");
    expect(labels).not.toContain("Caricature");
  });

  it("maps old names to today's names, case-insensitively", () => {
    expect(canonicalCategory("Sufi Band")).toBe("Sufi");
    expect(canonicalCategory("bhajan clubbing")).toBe("Bhajan / Jamming");
    expect(canonicalCategory(" Caricature ")).toBe("Sketch Artist");
  });

  it("leaves current names untouched", () => {
    for (const label of labels) expect(canonicalCategory(label)).toBe(label);
    expect(canonicalCategory("Sketch Artist")).toBe("Sketch Artist");
    expect(canonicalCategory("Poet")).toBe("Poet");
  });
});
