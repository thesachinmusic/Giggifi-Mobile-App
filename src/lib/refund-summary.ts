import { SUPPORT_EMAIL } from "./constants";

// Wording follows the Booking, Cancellation & Refund Policy (clause 3.5 and
// the tables in 4.1 and 4.2). The cooling-off sentence was changed in October
// 2026 so that Giggifi does not absorb gateway charges; the published policy
// must be changed to match BEFORE this app version is released.
// refund-summary.test.ts pins the strings.
export const COOLING_OFF_TEXT =
  "Cooling-off immediately after booking. A Booker may cancel within 2 hours of paying, provided the Event is more than 7 days away. The refund is the amount paid less payment gateway charges. To use this, contact support; refunds are handled by hand (see section 10).";

export const REFUND_TABLE_NOTE =
  "Percentages are of the Booking Fee. Payment gateway charges may be deducted from a refund. Your bank or payment provider decides how long a refund takes to reach you.";

export const SUPPORT_HOURS_TEXT = "Support is open 9 AM to 11 PM IST.";

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
