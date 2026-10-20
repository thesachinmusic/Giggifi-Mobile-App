import { describe, expect, it } from "vitest";

// The vendor profile offers Report and Block like the artist profile does.
const files = (import.meta as unknown as { glob: (p: string[], o: object) => Record<string, string> }).glob(
  ["../app/vendor/[[]id].tsx", "../app/artist/[[]id].tsx", "./api.ts"],
  { query: "?raw", import: "default", eager: true },
);
const read = (suffix: string) => {
  const key = Object.keys(files).find((k) => k.endsWith(suffix));
  expect(key, suffix).toBeTruthy();
  return files[key as string];
};

describe("vendor profile Report and Block", () => {
  const vendor = () => read("vendor/[id].tsx");
  it("reports with the vendor-profile target and the vendor id", () => {
    expect(vendor()).toMatch(/targetType="vendor-profile"/);
    expect(vendor()).toMatch(/targetId=\{vendor\.id\}/);
  });
  it("blocks through the user id the vendor API already sends", () => {
    expect(vendor()).toMatch(/confirmAndBlock\(\{ userId: vendor\.userId \}\)/);
  });
  it("the report target type includes vendor-profile", () => {
    expect(read("api.ts")).toMatch(/ReportTargetType = "review" \| "artist-profile" \| "vendor-profile" \| "booking"/);
  });
  it("is always visible, like the artist profile (no booking-reports switch)", () => {
    expect(vendor()).not.toMatch(/BOOKING_REPORTS_ENABLED/);
    expect(read("artist/[id].tsx")).not.toMatch(/BOOKING_REPORTS_ENABLED/);
  });
  it("uses plain accessibility labels, no promises", () => {
    expect(vendor()).toMatch(/accessibilityLabel="Report this profile"/);
    expect(vendor()).toMatch(/accessibilityLabel="Block this person"/);
  });
});
