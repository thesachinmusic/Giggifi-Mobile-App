import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import * as Notifications from "expo-notifications";
import { useAuth } from "./auth-context";
import { useAppForeground } from "./use-app-foreground";
import { fetchNotifications, markAllNotificationsRead, markNotificationRead, type NotificationItem } from "./api";

const PAGE_SIZE = 20;

interface NotificationsContextValue {
  notifications: NotificationItem[];
  unreadCount: number;
  loading: boolean;
  loadingMore: boolean;
  error: string;
  hasMore: boolean;
  refresh: () => Promise<void>;
  loadMore: () => Promise<void>;
  markRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
}

const NotificationsContext = createContext<NotificationsContextValue | null>(null);

// Single source of truth for the bell badge, the inbox list, and the app
// icon badge — previously each fetched independently and never synced
// (reading an item in the inbox never decremented the bell). Refreshes on
// user change, app foreground, and any push arriving while foregrounded.
export function NotificationsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const userRef = useRef(user);
  userRef.current = user;

  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const [nextCursor, setNextCursor] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!userRef.current) return;
    setLoading(true);
    try {
      const { notifications: results, unreadCount: count, nextCursor: cursor } = await fetchNotifications({ limit: PAGE_SIZE });
      setNotifications(results);
      setUnreadCount(count);
      setNextCursor(cursor);
      setError("");
    } catch {
      // Leave prior list in place — a background refresh failure shouldn't
      // blank an already-populated inbox. The screen decides whether to
      // surface `error` as a blocking state based on whether it has data.
      setError("Couldn't load your notifications.");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadMore = useCallback(async () => {
    if (!userRef.current || !nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const { notifications: results, nextCursor: cursor } = await fetchNotifications({ cursor: nextCursor, limit: PAGE_SIZE });
      setNotifications((prev) => [...prev, ...results]);
      setNextCursor(cursor);
    } catch {
      // Silent — the user can just scroll again to retry, no need to
      // interrupt an otherwise-populated list over a "load more" blip.
    } finally {
      setLoadingMore(false);
    }
  }, [nextCursor, loadingMore]);

  useEffect(() => {
    if (!user) {
      setNotifications([]);
      setUnreadCount(0);
      setNextCursor(null);
      setError("");
      return;
    }
    refresh();
  }, [user, refresh]);

  useAppForeground(refresh);

  useEffect(() => {
    const sub = Notifications.addNotificationReceivedListener(() => refresh());
    return () => sub.remove();
  }, [refresh]);

  useEffect(() => {
    Notifications.setBadgeCountAsync(unreadCount).catch(() => {});
  }, [unreadCount]);

  const markRead = useCallback(async (id: string) => {
    const wasUnread = notifications.find((n) => n.id === id)?.read === false;
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    if (wasUnread) setUnreadCount((prev) => Math.max(0, prev - 1));
    try {
      await markNotificationRead(id);
    } catch {
      // Revert precisely — matches src/lib/saved-artists-context.tsx's toggle().
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: !wasUnread ? n.read : false } : n)));
      if (wasUnread) setUnreadCount((prev) => prev + 1);
    }
  }, [notifications]);

  const markAllRead = useCallback(async () => {
    const prevNotifications = notifications;
    const prevUnreadCount = unreadCount;
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnreadCount(0);
    try {
      await markAllNotificationsRead();
    } catch {
      setNotifications(prevNotifications);
      setUnreadCount(prevUnreadCount);
    }
  }, [notifications, unreadCount]);

  const value = useMemo(
    () => ({
      notifications,
      unreadCount,
      loading,
      loadingMore,
      error,
      hasMore: nextCursor !== null,
      refresh,
      loadMore,
      markRead,
      markAllRead,
    }),
    [notifications, unreadCount, loading, loadingMore, error, nextCursor, refresh, loadMore, markRead, markAllRead],
  );

  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>;
}

export function useNotifications() {
  const ctx = useContext(NotificationsContext);
  if (!ctx) throw new Error("useNotifications must be used within NotificationsProvider");
  return ctx;
}
