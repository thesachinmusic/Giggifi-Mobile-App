import { useCallback, useRef } from "react";
import type { BottomSheetModal } from "@gorhom/bottom-sheet";
import { updateNotificationPreferences } from "./api";
import { CURRENT_MARKETING_CONSENT_VERSION } from "./marketing-consent";
import { hasSeenOffersOptIn, markOffersOptInSeen } from "./offers-optin-storage";
import { captureError } from "./telemetry";

// One-time marketing-consent opt-in, shown right after the push-permission
// primer resolves (see src/app/artist/[id].tsx) — never at the same time as
// it, and never again once the user has seen it once, accept or decline.
export function useOffersOptIn() {
  const sheetRef = useRef<BottomSheetModal>(null);
  // Same fix as use-push-primer.ts: BottomSheetModal's onDismiss fires on
  // every close including the dismiss() call inside "accept", so the
  // accept/decline outcome is recorded once, in handleClosed, not split
  // across two competing handlers.
  const acceptedRef = useRef(false);

  const maybePresent = useCallback(async (): Promise<void> => {
    if (await hasSeenOffersOptIn()) return;
    sheetRef.current?.present();
  }, []);

  const handleAccept = useCallback(() => {
    acceptedRef.current = true;
    sheetRef.current?.dismiss();
  }, []);

  const handleDecline = useCallback(() => {
    sheetRef.current?.dismiss();
  }, []);

  const handleClosed = useCallback(async () => {
    const accepted = acceptedRef.current;
    acceptedRef.current = false;
    await markOffersOptInSeen();
    if (accepted) {
      // Same consent write path as the settings screen's OFFER toggle —
      // same endpoint, same consent text version, same audit trail. Not a
      // shortcut consent record.
      await updateNotificationPreferences({
        categories: { OFFER: true },
        marketingConsent: { granted: true, consentTextVersion: CURRENT_MARKETING_CONSENT_VERSION },
      }).catch((err) => captureError(err, "offers-optin-consent-write"));
    }
  }, []);

  return { sheetRef, maybePresent, handleAccept, handleDecline, handleClosed };
}
