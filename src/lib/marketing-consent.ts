// Mirrors lib/consent/marketing-consent-text.ts on the website repo. The
// PATCH /api/mobile/notification-preferences endpoint hard-rejects enabling
// OFFER unless consentTextVersion matches a version it recognises — if the
// website repo adds a new version, this must be updated to match, or every
// "enable offers" tap in the app starts failing.
export const CURRENT_MARKETING_CONSENT_VERSION = "v1-2026-08";

export const MARKETING_CONSENT_TEXT =
  "Yes, send me offers and promotions — price drops on artists I've saved, new artists in my city, and seasonal deals. I can withdraw this any time from Settings.";
