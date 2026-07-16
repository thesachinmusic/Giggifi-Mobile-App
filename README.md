# GiggFi Mobile App

Native iOS/Android client, built with Expo + React Native + Expo Router,
styled to match the GiggFi website's dark premium brand (colors/fonts
ported 1:1 from `app/globals.css` / `tailwind.config.mjs` in the website
repo — see [src/theme](src/theme)).

This app has no backend of its own — every screen calls the existing
GiggFi Next.js API at `giggifi.com` (`app/api/mobile/*` on the
`GIGGIFI-WEBSITE-` repo, a Bearer-token auth layer that already existed
there, separate from the cookie-based NextAuth session the website itself
uses). Keep the two repos in sync on API contracts; don't duplicate
backend logic here.

- API base URL: `EXPO_PUBLIC_API_URL` (see `.env.example`)
- API client: [src/lib/api.ts](src/lib/api.ts)
- Auth: phone OTP via Twilio Verify (`/api/mobile/send-otp` +
  `/api/mobile/verify-otp`), session token stored with `expo-secure-store`
  — see [src/lib/auth-context.tsx](src/lib/auth-context.tsx). Requires
  `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` / `TWILIO_VERIFY_SERVICE_SID`
  to actually be set on the backend, or OTP send will fail.

## What's built

- Phone OTP login → 6-digit verify → session persisted across app restarts
- Home: category rail + "popular now" artist rail
- Browse: search + category filter, full artist grid
- Artist detail: profile, stats, chips, inline "Send Enquiry" form
  (posts a real `ENQUIRY` booking via `POST /api/mobile/bookings`)
- Bookings: read-only list of the signed-in user's bookings
- Profile: session info + logout

## Not built yet

- No payment/checkout screen — the website's `/api/razorpay/*` routes are
  cookie-session-only, there's no mobile (Bearer-token) equivalent yet
- No artist-side screens (dashboard, KYC, calendar) — client/booker flows only
- Enquiry form has no date picker yet (defaults to 30 days out, matching the backend's fallback)

## Get started

```bash
npm install
npx expo start
```

Then open in a [development build](https://docs.expo.dev/develop/development-builds/introduction/), Android emulator, iOS simulator, or [Expo Go](https://expo.dev/go).
