import { describe, expect, it } from "vitest";
import { displayName, isPhoneLikeName, realName } from "./format";

describe("phone-as-name guard", () => {
  it("spots phone-like names", () => {
    for (const n of ["9876543210", "+91 98765 43210", "(022) 2345-6789", " 919876543210 "]) expect(isPhoneLikeName(n)).toBe(true);
  });
  it("keeps real names, including ones with a few digits", () => {
    for (const n of ["Asha", "Dj 7", "Rahul K", ""]) expect(isPhoneLikeName(n)).toBe(false);
    expect(isPhoneLikeName(null)).toBe(false);
  });
  it("falls back to Guest and skips phone-like candidates", () => {
    expect(displayName("9876543210", null)).toBe("Guest");
    expect(displayName(null, "9876543210", "Asha")).toBe("Asha");
    expect(realName(undefined, "")).toBeNull();
  });
});
