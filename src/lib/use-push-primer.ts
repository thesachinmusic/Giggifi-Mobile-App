import { useCallback, useRef } from "react";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import type { BottomSheetModal } from "@gorhom/bottom-sheet";
import { registerDeviceForPush, requestPushPermission } from "./push-notifications";
import { recordPushPromptDecline, shouldShowPushPrimer } from "./push-permission-storage";
import { captureError } from "./telemetry";

// Decides whether to show the priming sheet at all, and handles both
// outcomes once shown. Never calls the OS prompt directly — that only ever
// happens via requestPushPermission(), triggered from handleClosed below.
//
// `onClosed` fires once the sheet has fully closed, regardless of outcome
// (enable, not-now, swipe, backdrop tap) — the caller uses this to chain
// the next onboarding sheet (see src/lib/use-offers-optin.ts) immediately
// after this one is gone, not on top of it.
export function usePushPrimer(onClosed?: () => void) {
  const sheetRef = useRef<BottomSheetModal>(null);
  // Which action resolved the sheet, read once by handleClosed and reset —
  // NOT read by the button handlers themselves. BottomSheetModal's own
  // onDismiss fires on every close, including the dismiss() call inside an
  // "enable" tap, so bookkeeping has to live in exactly one place
  // (handleClosed) or an enable would also get double-counted as a decline.
  const outcomeRef = useRef<"enable" | null>(null);

  const maybePresent = useCallback(async (): Promise<boolean> => {
    if (!Device.isDevice) return false;

    const { status, canAskAgain } = await Notifications.getPermissionsAsync();
    if (status === "granted") return false;
    // OS won't show its dialog again — the inbox's "denied" card is the
    // only path back for this user, not another sheet.
    if (status === "denied" && !canAskAgain) return false;

    if (await shouldShowPushPrimer()) {
      sheetRef.current?.present();
      return true;
    }
    return false;
  }, []);

  const handleEnable = useCallback(() => {
    outcomeRef.current = "enable";
    sheetRef.current?.dismiss();
  }, []);

  const handleNotNow = useCallback(() => {
    sheetRef.current?.dismiss();
  }, []);

  const handleClosed = useCallback(async () => {
    const outcome = outcomeRef.current;
    outcomeRef.current = null;

    if (outcome === "enable") {
      const granted = await requestPushPermission();
      if (granted) {
        await registerDeviceForPush().catch((err) => captureError(err, "push-token-register-after-enable"));
      } else {
        // An OS-level decline still counts toward the 3-try cap.
        await recordPushPromptDecline();
      }
    } else {
      // Not-now tap, backdrop tap, or swipe-to-dismiss — all implicit declines.
      await recordPushPromptDecline();
    }

    onClosed?.();
  }, [onClosed]);

  return { sheetRef, maybePresent, handleEnable, handleNotNow, handleClosed };
}
