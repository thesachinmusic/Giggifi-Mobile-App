import { useCallback, useEffect, useRef, useState } from "react";
import * as Notifications from "expo-notifications";
import { router, usePathname, type Href } from "expo-router";
import { NotificationToast, type ToastData } from "@/components/NotificationToast";
import { resolveNotificationHref } from "./notification-links";
import type { NotificationCategory } from "./api";

const AUTO_DISMISS_MS = 5000;

// Lets non-component modules (api.ts's global 401 handler) surface a toast
// through the same host/animation as a real push notification, without one
// having actually arrived. NotificationToastHost is mounted once near the
// root, so this is a minimal pub-sub bridge rather than routing a fake
// event through expo-notifications.
type LocalToastListener = (toast: ToastData) => void;
let localToastListener: LocalToastListener | null = null;

export function showToast(toast: Omit<ToastData, "id">): void {
  localToastListener?.({ id: `local-${Date.now()}`, ...toast });
}

// Foreground-arrival toast — separate from NotificationTapHandler (which
// only fires for a tap, cold-start or warm) and from
// NotificationsProvider's own addNotificationReceivedListener (which just
// refreshes the inbox/badge). Multiple independent listeners on the same
// expo-notifications emitter is expected and fine.
export function NotificationToastHost() {
  const [toast, setToast] = useState<ToastData | null>(null);
  const pathname = usePathname();
  const pathnameRef = useRef(pathname);
  pathnameRef.current = pathname;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hrefRef = useRef<Href | null>(null);

  const present = useCallback((next: ToastData) => {
    hrefRef.current = null;
    setToast(next);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setToast(null), AUTO_DISMISS_MS);
  }, []);

  useEffect(() => {
    localToastListener = present;
    return () => {
      if (localToastListener === present) localToastListener = null;
    };
  }, [present]);

  useEffect(() => {
    const sub = Notifications.addNotificationReceivedListener((event) => {
      const data = event.request.content.data as { actionUrl?: unknown; category?: NotificationCategory } | undefined;
      const href = resolveNotificationHref(data?.actionUrl);

      // Don't interrupt the user with a toast for the screen they're already on.
      if (typeof href === "string" && href === pathnameRef.current) return;

      present({
        id: event.request.identifier,
        title: event.request.content.title ?? "GiggiFi",
        body: event.request.content.body ?? "",
        category: data?.category ?? "SUPPORT",
      });
      hrefRef.current = href;
    });
    return () => sub.remove();
  }, [present]);

  const handlePress = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setToast(null);
    if (hrefRef.current) router.push(hrefRef.current);
  }, []);

  return <NotificationToast toast={toast} onPress={handlePress} />;
}
