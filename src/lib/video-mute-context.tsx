import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { readJSON, writeJSON } from "./local-storage";

const KEY = "giggifi_video_muted";

interface VideoMuteContextValue {
  muted: boolean;
  toggleMuted: () => void;
}

const VideoMuteContext = createContext<VideoMuteContextValue | null>(null);

// Shared across every autoplay video surface (Reels, Home's Featured/Fresh
// Picks rails) — previously each card held its own local `useState(true)`,
// so unmuting one video had no effect on the next one you scrolled to; it
// just looked broken. One toggle here now covers all of them, and persists
// across app restarts the same way local-storage.ts's other preferences do.
export function VideoMuteProvider({ children }: { children: ReactNode }) {
  const [muted, setMuted] = useState(true);

  useEffect(() => {
    readJSON<boolean>(KEY, true).then(setMuted);
  }, []);

  const toggleMuted = useCallback(() => {
    setMuted((prev) => {
      const next = !prev;
      writeJSON(KEY, next).catch(() => {});
      return next;
    });
  }, []);

  const value = useMemo(() => ({ muted, toggleMuted }), [muted, toggleMuted]);

  return <VideoMuteContext.Provider value={value}>{children}</VideoMuteContext.Provider>;
}

export function useVideoMute() {
  const ctx = useContext(VideoMuteContext);
  if (!ctx) throw new Error("useVideoMute must be used within VideoMuteProvider");
  return ctx;
}
