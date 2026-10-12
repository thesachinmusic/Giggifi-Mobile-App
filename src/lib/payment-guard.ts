import type { PendingPayment } from "@/lib/pending-payment-storage";

// After this long without the server confirming a payment the app reported
// as paid, stop showing a spinner and send the user to support instead.
export const PENDING_STALE_MS = 15 * 60 * 1000;

export function isPendingStale(pending: Pick<PendingPayment, "savedAt">, now = Date.now()): boolean {
  return pending.savedAt != null && now - pending.savedAt > PENDING_STALE_MS;
}

export type CheckoutDecision = "ok" | "payment_in_progress" | "already_paid";

// Decides whether the Pay button may create a NEW Razorpay order. The server
// only blocks a new order once the booking has left AWAITING_PAYMENT, so in
// the gap between "Razorpay took the money" and "the booking moved on", a
// second tap would charge the client twice.
export function checkoutDecision(input: {
  hasPendingForThisBooking: boolean;
  server: { bookingStatus: string; paymentStatus: string | null } | null;
}): CheckoutDecision {
  if (input.hasPendingForThisBooking) return "payment_in_progress";
  const s = input.server;
  if (s && (s.paymentStatus === "PAID" || s.bookingStatus !== "AWAITING_PAYMENT")) return "already_paid";
  return "ok";
}
