import { useEffect, useRef } from "react";
import * as Notifications from "expo-notifications";
import { router, useRootNavigationState } from "expo-router";
import { useAuth } from "./auth-context";
import { resolveNotificationHref } from "./notification-links";

// Routes a tapped notification to its actionUrl — covers both cold start
// (app fully killed, tap launches it) and a tap while already running,
// via the same code path. useLastNotificationResponse() reports both cases
// through one reactive value.
//
// Gating on useRootNavigationState()?.key (rather than threading a "pending
// url" through index.tsx's own <Redirect>) avoids racing it: before the
// root navigator commits, rootState has no key and this effect no-ops; by
// the time it does have one, index.tsx's own effect has already fired
// (React commits sibling effects in tree order — this component sits
// before <Stack> in _layout.tsx, so its effect runs first on every pass,
// and the re-run that actually navigates only happens once rootState
// updates, i.e. after the default redirect has already landed).
export function useNotificationRouter() {
  const response = Notifications.useLastNotificationResponse();
  const rootState = useRootNavigationState();
  const { user } = useAuth();
  const handledId = useRef<string | null>(null);

  useEffect(() => {
    if (!response) return; // undefined = still loading, null = none yet
    if (!rootState?.key) return; // navigator hasn't committed an initial route yet

    const id = response.notification.request.identifier;
    if (id === handledId.current) return;

    const href = resolveNotificationHref(response.notification.request.content.data?.actionUrl);
    if (!href) {
      handledId.current = id; // unroutable — never retry this one
      return;
    }

    // Not marked handled: if the user isn't signed in yet (still on the
    // login flow), retry once auth settles — `user` re-entering the deps
    // below re-runs this effect against the same still-unhandled response.
    if (!user) return;

    handledId.current = id;
    router.push(href);
  }, [response, rootState?.key, user]);
}
