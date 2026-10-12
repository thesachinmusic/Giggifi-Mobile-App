import { describe, expect, it } from "vitest";
import { checkoutDecision, isPendingStale, PENDING_STALE_MS } from "./payment-guard";

describe("checkoutDecision", () => {
  it("blocks a new order while a paid-but-unconfirmed payment is stored", () => {
    expect(checkoutDecision({ hasPendingForThisBooking: true, server: null })).toBe("payment_in_progress");
  });
  it("blocks when the server already has a PAID payment, even if the booking has not moved yet", () => {
    expect(checkoutDecision({ hasPendingForThisBooking: false, server: { bookingStatus: "AWAITING_PAYMENT", paymentStatus: "PAID" } })).toBe("already_paid");
  });
  it("blocks when the booking is no longer awaiting payment", () => {
    expect(checkoutDecision({ hasPendingForThisBooking: false, server: { bookingStatus: "PAYMENT_HELD", paymentStatus: "PAID" } })).toBe("already_paid");
    expect(checkoutDecision({ hasPendingForThisBooking: false, server: { bookingStatus: "CANCELLED_BY_ARTIST", paymentStatus: null } })).toBe("already_paid");
  });
  it("allows a normal first payment and a retry after a failed or cancelled one", () => {
    expect(checkoutDecision({ hasPendingForThisBooking: false, server: { bookingStatus: "AWAITING_PAYMENT", paymentStatus: "PENDING" } })).toBe("ok");
    expect(checkoutDecision({ hasPendingForThisBooking: false, server: { bookingStatus: "AWAITING_PAYMENT", paymentStatus: "FAILED" } })).toBe("ok");
    expect(checkoutDecision({ hasPendingForThisBooking: false, server: null })).toBe("ok");
  });
});

describe("isPendingStale", () => {
  it("is stale only after the window, and never for old entries without a time", () => {
    expect(isPendingStale({ savedAt: 0 }, PENDING_STALE_MS + 1)).toBe(true);
    expect(isPendingStale({ savedAt: 0 }, PENDING_STALE_MS - 1)).toBe(false);
    expect(isPendingStale({}, 10 ** 12)).toBe(false);
  });
});
