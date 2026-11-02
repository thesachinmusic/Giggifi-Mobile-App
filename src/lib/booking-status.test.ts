import { describe, expect, it } from "vitest";
import { canRaiseDispute, isPaidAndUpcoming } from "./booking-status";

describe("canRaiseDispute", () => {
  it("allows only PAYMENT_HELD and EVENT_COMPLETED", () => {
    expect(canRaiseDispute("PAYMENT_HELD")).toBe(true);
    expect(canRaiseDispute("EVENT_COMPLETED")).toBe(true);
    for (const s of ["ENQUIRY_SENT", "AWAITING_PAYMENT", "EVENT_UPCOMING", "DISPUTED", "CANCELLED_BY_BOOKER"]) {
      expect(canRaiseDispute(s)).toBe(false);
    }
  });
});

describe("isPaidAndUpcoming", () => {
  it("is true for paid bookings before the event", () => {
    expect(isPaidAndUpcoming("PAYMENT_HELD")).toBe(true);
    expect(isPaidAndUpcoming("EVENT_UPCOMING")).toBe(true);
    expect(isPaidAndUpcoming("EVENT_COMPLETED")).toBe(false);
    expect(isPaidAndUpcoming("AWAITING_PAYMENT")).toBe(false);
  });
});
