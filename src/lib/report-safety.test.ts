import { describe, expect, it } from "vitest";
import { EMERGENCY_LINE, isSafetyReason } from "./report-safety";

describe("isSafetyReason", () => {
  it("is true for the safety reasons", () => {
    for (const r of ["harassment", "unsafe_behaviour", "intoxicated_or_aggressive"]) expect(isSafetyReason(r)).toBe(true);
  });
  it("is false for the others and for nothing", () => {
    for (const r of ["spam", "no_show_or_late", "outside_payment_pressure", "poor_quality", "other", null, undefined]) expect(isSafetyReason(r)).toBe(false);
  });
  it("uses the exact wording", () => {
    expect(EMERGENCY_LINE).toBe("If you are in immediate danger, call 112 first.");
  });
});
