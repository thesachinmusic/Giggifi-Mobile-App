import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { clearStoredToken, getStoredToken, setStoredToken } from "./auth-storage";
import { fetchSession, sendOtp, verifyOtp, unregisterPushToken, type SessionUser } from "./api";
import { onSessionExpired } from "./session-events";
import { captureError } from "./telemetry";

interface AuthContextValue {
  user: SessionUser | null;
  isLoading: boolean;
  // True as soon as a stored token exists, independent of whether the
  // network call to hydrate `user` has succeeded yet — lets index.tsx tell
  // "not logged in" apart from "logged in, but couldn't reach the server
  // on this cold start" (see refreshSession below).
  hasStoredSession: boolean;
  requestOtp: (phone: string) => Promise<void>;
  confirmOtp: (phone: string, otp: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [hasStoredSession, setHasStoredSession] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const refreshSession = useCallback(async () => {
    const token = await getStoredToken();
    if (!token) {
      setUser(null);
      setHasStoredSession(false);
      return;
    }
    setHasStoredSession(true);
    try {
      const { session } = await fetchSession();
      setUser(session?.user ?? null);
      if (!session?.user) {
        await clearStoredToken();
        setHasStoredSession(false);
      }
    } catch {
      // A real 401 already triggers the global session-expired handler in
      // api.ts's request() (clears the token, resets state below) — this
      // catch only guards network/server failures, which
      // shouldn't log the user out. Cold-starting on a flaky connection
      // with a valid stored token now keeps hasStoredSession true instead
      // of bouncing straight to the phone-number screen.
    }
  }, []);

  useEffect(() => {
    refreshSession().finally(() => setIsLoading(false));
  }, [refreshSession]);

  useEffect(() => {
    return onSessionExpired(() => {
      setUser(null);
      setHasStoredSession(false);
    });
  }, []);

  const requestOtp = useCallback(async (phone: string) => {
    await sendOtp(phone);
  }, []);

  const confirmOtp = useCallback(async (phone: string, otp: string) => {
    const { token, user: sessionUser } = await verifyOtp(phone, otp);
    await setStoredToken(token);
    setUser(sessionUser);
    setHasStoredSession(true);
  }, []);

  const logout = useCallback(async () => {
    // Best-effort — a logged-out device shouldn't keep receiving this user's
    // push notifications, but a failed unregister shouldn't block sign-out.
    await unregisterPushToken().catch((err) => captureError(err, "push-token-unregister-on-logout"));
    await clearStoredToken();
    setUser(null);
    setHasStoredSession(false);
  }, []);

  const value = useMemo(
    () => ({ user, isLoading, hasStoredSession, requestOtp, confirmOtp, logout, refreshSession }),
    [user, isLoading, hasStoredSession, requestOtp, confirmOtp, logout, refreshSession],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
