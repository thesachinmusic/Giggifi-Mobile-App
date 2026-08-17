export const STATUS_LABEL: Record<string, string> = {
  ENQUIRY_SENT: "Enquiry sent",
  ENQUIRY_VIEWED: "Enquiry viewed",
  QUOTE_RECEIVED: "Quote received",
  QUOTE_ACCEPTED: "Quote accepted",
  AWAITING_PAYMENT: "Awaiting payment",
  PAYMENT_HELD: "Confirmed",
  EVENT_UPCOMING: "Upcoming",
  EVENT_COMPLETED: "Completed",
  PAYOUT_PROCESSING: "Payout processing",
  PAYOUT_RELEASED: "Paid out",
  CANCELLED_BY_ARTIST: "Cancelled by artist",
  CANCELLED_BY_BOOKER: "Cancelled",
  DISPUTED: "In dispute",
  RESOLVED: "Resolved",
};

// Semantic tone for StatusBadge — mirrors the theme's ok/warn/err trio
// (colors.ts) instead of every status sharing the same purple regardless of
// whether it's good, needs action, or went wrong.
export type StatusTone = "ok" | "warn" | "err" | "neutral";

export const STATUS_TONE: Record<string, StatusTone> = {
  ENQUIRY_SENT: "neutral",
  ENQUIRY_VIEWED: "neutral",
  QUOTE_RECEIVED: "warn",
  QUOTE_ACCEPTED: "ok",
  AWAITING_PAYMENT: "warn",
  PAYMENT_HELD: "ok",
  EVENT_UPCOMING: "ok",
  EVENT_COMPLETED: "ok",
  PAYOUT_PROCESSING: "neutral",
  PAYOUT_RELEASED: "ok",
  CANCELLED_BY_ARTIST: "err",
  CANCELLED_BY_BOOKER: "err",
  DISPUTED: "err",
  RESOLVED: "ok",
};

// Mirrors Prisma's PaymentStatus enum (GiggFi-Website/prisma/schema.prisma) —
// booking.payment.status was rendered raw (PAID/PENDING) with no label map,
// unlike every other status field on this screen.
export const PAYMENT_STATUS_LABEL: Record<string, string> = {
  PENDING: "Pending",
  REQUIRES_ACTION: "Action required",
  PAID: "Paid",
  FAILED: "Failed",
  REFUNDED: "Refunded",
  CANCELLED: "Cancelled",
};
