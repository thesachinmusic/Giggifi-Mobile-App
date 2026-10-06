import { useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { PushPrimerSheet } from "@/components/PushPrimerSheet";
import { usePushPrimer } from "@/lib/use-push-primer";

// Asks for notifications right after login — when a signed-in user reaches
// Home — instead of only after their first enquiry. The same hook decides
// whether the sheet is due: nothing if permission is already granted (or
// denied for good), otherwise the existing cap applies (at most 3 declines,
// re-asked no sooner than 14 days apart — see push-permission-storage.ts).
// Tried once per app session so tab switches never re-trigger it.
let attemptedThisSession = false;

export function HomePushPrimer() {
  const { user } = useAuth();
  const { sheetRef, maybePresent, handleEnable, handleNotNow, handleClosed } = usePushPrimer();

  useEffect(() => {
    if (!user || attemptedThisSession) return;
    // Let Home finish its first render before a sheet slides over it.
    const timer = setTimeout(() => {
      attemptedThisSession = true;
      maybePresent().catch(() => {});
    }, 1500);
    return () => clearTimeout(timer);
  }, [user, maybePresent]);

  return <PushPrimerSheet ref={sheetRef} onEnable={handleEnable} onNotNow={handleNotNow} onClosed={handleClosed} />;
}
