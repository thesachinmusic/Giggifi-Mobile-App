# GiggFi Mobile App

Native iOS/Android client, built with Expo + React Native + Expo Router.

This app has no backend of its own — every screen calls the existing
GiggFi Next.js API at `giggifi.com` (see the `GIGGIFI-WEBSITE-` repo for
routes, Prisma schema, auth, and Razorpay integration). Keep the two repos
in sync on API contracts; don't duplicate backend logic here.

- API base URL: `EXPO_PUBLIC_API_URL` (see `.env.example`)
- API client: [src/lib/api.ts](src/lib/api.ts)

## Known gap before real screens can authenticate

The website's API routes authenticate via NextAuth session cookies
(`getServerAuthSession()`), which a native app doesn't have. Before
building any screen that needs a logged-in user, the backend needs a
mobile-friendly auth path (e.g. a token-issuing endpoint the app can send
as a Bearer token) — `apiFetch`'s `authToken` option is a placeholder for
that, not a working integration yet.

## Get started

```bash
npm install
npx expo start
```

Then open in a [development build](https://docs.expo.dev/develop/development-builds/introduction/), Android emulator, iOS simulator, or [Expo Go](https://expo.dev/go).
