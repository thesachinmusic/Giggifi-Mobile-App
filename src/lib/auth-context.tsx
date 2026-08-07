import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { clearStoredToken, getStoredToken, setStoredToken } from "./auth-storage";
import { fetchSession, sendOtp, verifyOtp, unregisterPushToken, type SessionUser } from "./api";
import { captureError } from "./telemetry";

interface AuthContextValue {
  user: SessionUser | null;
  isLoading: boolean;
  requestOtp: (phone: string) => Promise<void>;
  confirmOtp: (phone: string, otp: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshSession = useCallback(async () => {
    const token = await getStoredToken();
    if (!token) {
      setUser(null);
      return;
    }
    try {
      const { session } = await fetchSession();
      setUser(session?.user ?? null);
      if (!session?.user) await clearStoredToken();
    } catch {
      setUser(null);
    }
  }, []);

  useEffect(() => {
    refreshSession().finally(() => setIsLoading(false));
  }, [refreshSession]);

  const requestOtp = useCallback(async (phone: string) => {
    await sendOtp(phone);
  }, []);

  const confirmOtp = useCallback(async (phone: string, otp: string) => {
    const { token, user: sessionUser } = await verifyOtp(phone, otp);
    await setStoredToken(token);
    setUser(sessionUser);
  }, []);

  const logout = useCallback(async () => {
    // Best-effort — a logged-out device shouldn't keep receiving this user's
    // push notifications, but a failed unregister shouldn't block sign-out.
    await unregisterPushToken().catch((err) => captureError(err, "push-token-unregister-on-logout"));
    await clearStoredToken();
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, isLoading, requestOtp, confirmOtp, logout, refreshSession }),
    [user, isLoading, requestOtp, confirmOtp, logout, refreshSession],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
