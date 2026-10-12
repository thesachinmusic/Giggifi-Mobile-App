# X2: Cancellation & Refund Policy vs the Client App

Written 2026-10-13 from the policy on website `origin/main` (`content/legal/docs/booking-cancellation-refund-policy.md`), the website note `docs/refund-policy-vs-product.md`, and the app code on `release/client-1.0.0`. Nothing was run on a phone.

## What the app does
- **Before payment:** the client can decline a quote in the app (`cancel_by_booker`, allowed for enquiry sent, quote received and awaiting payment). Matches the policy (no money involved).
- **After payment:** the client has **no cancel button**. The booking screen now shows "Need to cancel? Contact support" for `PAYMENT_HELD` and `EVENT_UPCOMING` ([booking/[id].tsx](../src/app/booking/[id].tsx)), with the helpline and contact@giggifi.com, and says refunds follow the Cancellation & Refund Policy. The policy link is on the payment card and the profile screen.
- **Dispute:** separate from cancelling. It raises a dispute and stops the payout; the app makes no refund promise.

## Gaps (policy promise vs app)
| Policy | App today | Gap |
|---|---|---|
| **3.5** Full refund if cancelled within 2 hours of paying and the event is more than 7 days away. "To use this, contact support." | Support entry only. No timer, no mention of the 2 hours. | The policy itself says contact support, so the entry matches. The client is not told the window exists, so they may not ask in time. The admin checks the window by hand. |
| **4.1** Tiered refunds (100 / 75 / 50 / 25 / 0% by notice) | No calculator, no preview of what the client would get. | Client cannot see their refund before calling. Backend tool "Cancel a paid booking" supports only a full refund; partial amounts need the dispute route (website note). |
| **4.2** Quick Moment: 100% before the artist is on the way, 50% after | Quick Moment bookings show the same support entry. The "artist on the way" state is visible in the app, but there is no cancel. | Same as above. The policy states there is no in-app cancel after payment for Quick Moments. |
| **4.3** Artist cancels: 100% refund | The app shows the cancelled status and the backup-artist flow. A refund is queued on the backend. | The app does not say "your refund is on its way" or when. Refund is sent by hand (policy 10.2: within 7 business days). The client has no refund status screen. |
| **10.2** Refund within 7 business days | Not shown anywhere in the app. | No tracking, no reminder. |
| **10.5** Written breakdown of a partial refund | Not shown in the app. | Manual, by email. |
| **EVENT_COMPLETED** | Dispute button, no cancel. | Correct: nothing to cancel after the event. |

## Is the "contact support" entry enough for Play?
It states honestly that paid cancellation is by support. The gap that matters is expectation: the policy sells tiered refunds and a 2-hour cooling-off, while the app gives no way to see or start them in the app. Options, cheapest first:
1. (Copy, OTA-safe) Add one line to the card: "If you cancel within 2 hours of paying and your event is more than 7 days away, you get a full refund." Needs the legal owner's approval because it restates a policy clause.
2. (Backend + app) A "Request cancellation" button that creates a support ticket with the booking id, so the admin has the timestamp and the 2-hour check is automatic.
3. (Larger) Refund preview and refund status on the booking screen, once the backend records refunds.

## Questions
1. Do you want option 1 or 2 for 1.0.0?
2. Should a client see "refund requested / refund sent" on the booking after an artist cancel? The backend would need to expose the refund state.
