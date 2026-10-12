import { SUPPORT_EMAIL } from "./constants";

// Wording copied from the live Booking, Cancellation & Refund Policy
// (giggifi.com/refund, version 1.0, effective 7 October 2026): clause 3.5 and
// the tables in 4.1 and 4.2. Do not reword these; if the policy changes,
// copy the new text here. refund-summary.test.ts pins the strings.
export const COOLING_OFF_TEXT =
  "Cooling-off immediately after booking. A Booker may cancel for a full refund within 2 hours of paying, provided the Event is more than 7 days away. Giggifi absorbs the Gateway Charge. To use this, contact support; refunds are handled by hand (see section 10).";

export interface RefundRow {
  notice: string;
  refund: string;
}

// 4.1: Booker cancels, standard Booking ("Refund to Booker (of Booking Fee)").
export const STANDARD_REFUND_ROWS: RefundRow[] = [
  { notice: "More than 14 days before Event", refund: "100%" },
  { notice: "7 to 14 days before Event", refund: "75%" },
  { notice: "3 to 7 days before Event", refund: "50%" },
  { notice: "Less than 3 days before Event", refund: "25%" },
  { notice: "On the Event Date", refund: "0%" },
  { notice: "After the Event Start Time", refund: "0%" },
];

// 4.2: Booker cancels, Quick Moment ("Refund to Booker").
export const QUICK_MOMENT_REFUND_ROWS: RefundRow[] = [
  { notice: "Before the Artist indicates they are on the way", refund: "100% (Platform Fee refunded)" },
  { notice: "After the Artist indicates they are on the way, before arrival", refund: "50%" },
  { notice: "After arrival is confirmed", refund: "0%" },
];

export const QUICK_MOMENT_NO_IN_APP_CANCEL = "Cancelling a paid Quick Moment is done through support; there is no in-app cancellation after payment.";

// Opens the mail app with the booking reference filled in, so support can
// find the booking and check the event date.
export function cancellationMailto(booking: { id: string; eventName: string; eventDate: string }): string {
  const subject = `Cancel booking ${booking.id}`;
  const body = [
    "Hello GiggiFi,",
    "",
    "I need to cancel this booking.",
    `Booking reference: ${booking.id}`,
    `Event: ${booking.eventName}`,
    `Event date: ${booking.eventDate}`,
    "",
    "Please tell me what happens next.",
  ].join("\n");
  return `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
