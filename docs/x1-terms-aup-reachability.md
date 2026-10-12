# X1: Booker Terms 8.2 and Acceptable Use Policy 5.1 vs the Client App

Written 2026-10-13 from the code on `release/client-1.0.0` and the legal text on website `origin/main`. The live pages at giggifi.com/booker-terms and giggifi.com/acceptable-use (GET, HTTP 200) carry the same clause text as the repo. Nothing was run on a phone: "reachable" below means a screen and a tap path exist in the code.

## Booker Terms

| Promise | Where the app meets it | Result |
|---|---|---|
| **8.1** On the day, contact us immediately through the Platform | Help card with helpline call button on every booking ([booking/[id].tsx](../src/app/booking/[id].tsx), "Need help with this booking?"). No in-app chat or message to support. | Reachable by phone only. The Terms say "through the Platform"; there is no in-app message. |
| **8.2** Open a dispute through the Platform, or contact support, within 48 hours of the end of the Event | "Report a problem with this booking" opens [DisputeSheet.tsx](../src/components/DisputeSheet.tsx) and sends `raise_dispute`. Shown only when the booking is `PAYMENT_HELD` or `EVENT_COMPLETED`. Helpline and contact@giggifi.com also on the booking. | Reachable. See gaps below. |
| **8.3** Keep the conversation on Giggifi | Booking help card says not to contact the artist directly before payment. Contact details are shown to both sides after payment. | Partly: the app does not repeat the "keep it on Giggifi" advice after contact is revealed. |
| **8.5** Harassment, threats or harm are a safety matter | "Report the artist's behaviour" (reasons: Harassment or abuse, Unsafe behaviour, Seemed intoxicated or aggressive) sends `concern: "other_party"`. The backend emails these as urgent. Helpline always shown. | Reachable once the production flag is ON and the backend route is live (both done for the 1.0.0 production profile, see below). |

Gaps for 8.2:
1. The 48-hour limit is not shown in the app, on purpose (copy must not state time limits). The server decides what is allowed. The button disappears when the booking moves on to payout (the cron does this 2 days after the event), so the app's window and the Terms' 48 hours are close but not tied together. Confirm with the backend owner what the server does with a dispute raised after 48 hours.
2. `EVENT_UPCOMING` is not allowed by the server for disputes, and the app follows it. If any paid booking ever sits in `EVENT_UPCOMING`, the dispute button is missing and only the helpline is offered. Not seen in the code paths read; needs a check against real data.
3. Terms 8.2 says "the process is in the Terms of Service, clause 13". The app links the Terms, but not the Booker Terms (see below).

## Acceptable Use Policy

| Promise | Where the app meets it | Result |
|---|---|---|
| **5.1** Use the reporting tools on the Platform, or contact contact@giggifi.com | Report on a review ([ReviewsList.tsx](../src/components/ReviewsList.tsx)), on an artist profile ([artist/[id].tsx](../src/app/artist/[id].tsx)), on a booking and on the other party (booking screen). Email address shown in the dispute and cancel cards. | Reachable for reviews, artists and bookings. |
| **5.3** In immediate danger, call the emergency services first | Not in the app. The report sheet does not say it. | Gap (copy). |
| **5.4** Reporting can be anonymous, reporter not disclosed | Report sheet says "We don't share who reported it." Reports need a verified phone number, so they are not anonymous to Giggifi. | Matches the second half. "May report anonymously" is not offered. |

Gaps for 5.1:
1. **Vendors cannot be reported.** [vendor/[id].tsx](../src/app/vendor/[id].tsx) has no Report action. The AUP covers any content on the Platform. Fix: add the same sheet with a vendor target (needs a backend target type).
2. Quick Moments reels, artist videos and photos have no report entry of their own (the artist-profile report covers them only loosely).
3. **Neither the Booker Terms nor the Acceptable Use Policy is linked anywhere in the app.** The app links only Terms of Service, Privacy Policy and the Cancellation & Refund Policy (verify screen, payment card, profile). The Terms of Service incorporate the AUP by reference. Fix: add two links next to the existing ones (JS only, OTA-safe).

## Production flag
`EXPO_PUBLIC_BOOKING_REPORTS` is set to `"true"` in the `production` profile of `eas.json` (commit e8924ff). Website `origin/main` accepts `targetType: "booking"` with `concern` (`app/api/mobile/report/route.ts`, `lib/services/report-service.ts`). Preview builds and OTAs keep the two booking report buttons hidden.

## Needs a phone
- Dispute sheet and "Report" sheets on Android with the keyboard open.
- That a real dispute moves the booking to "In dispute" and the next-steps card shows.
- That an urgent safety report really reaches the grievance inbox.
