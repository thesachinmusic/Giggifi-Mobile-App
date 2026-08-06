import { useEffect } from "react";
import { AppState, type AppStateStatus } from "react-native";

// One place that knows how to detect "app came to the foreground" — used by
// PendingPaymentRecovery, NotificationsProvider, and usePushRegistration.
export function useAppForeground(onForeground: () => void): void {
  useEffect(() => {
    const appState = { current: AppState.currentState };
    const sub = AppState.addEventListener("change", (next: AppStateStatus) => {
      const cameToForeground = appState.current.match(/inactive|background/) && next === "active";
      appState.current = next;
      if (cameToForeground) onForeground();
    });
    return () => sub.remove();
  }, [onForeground]);
}
