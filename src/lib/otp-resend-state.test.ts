import { beforeEach, describe, expect, it } from "vitest";
import { getResendState, MAX_RESENDS, recordFirstSend, recordResend, remainingCooldownSeconds, resetAllResendStates } from "./otp-resend-state";

beforeEach(() => resetAllResendStates());

describe("otp resend state", () => {
  it("escalates the cooldown and counts resends", () => {
    recordFirstSend("9", 0);
    expect(remainingCooldownSeconds("9", 0)).toBe(0);
    recordResend("9", 0);
    expect(remainingCooldownSeconds("9", 0)).toBe(30);
    recordResend("9", 40_000);
    expect(remainingCooldownSeconds("9", 40_000)).toBe(60);
    recordResend("9", 120_000);
    expect(getResendState("9", 120_000)?.resendCount).toBe(MAX_RESENDS);
  });

  it("keeps the cooldown running while the sheet is closed", () => {
    recordResend("9", 0);
    expect(remainingCooldownSeconds("9", 10_000)).toBe(20);
  });

  it("forgets a phone after an hour", () => {
    recordResend("9", 0);
    expect(getResendState("9", 61 * 60 * 1000)).toBeNull();
  });
});
