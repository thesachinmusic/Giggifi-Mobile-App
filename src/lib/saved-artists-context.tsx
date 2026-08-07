import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useAuth } from "./auth-context";
import { fetchSavedArtistIds, saveArtist, unsaveArtist } from "./api";
import { captureError } from "./telemetry";

interface SavedArtistsContextValue {
  savedIds: Set<string>;
  isSaved: (artistId: string) => boolean;
  toggle: (artistId: string) => Promise<void>;
}

const SavedArtistsContext = createContext<SavedArtistsContextValue | null>(null);

export function SavedArtistsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!user) {
      setSavedIds(new Set());
      return;
    }
    fetchSavedArtistIds()
      .then(({ artistIds }) => setSavedIds(new Set(artistIds)))
      .catch((err) => captureError(err, "saved-artists-fetch"));
  }, [user]);

  const toggle = useCallback(async (artistId: string) => {
    const wasSaved = savedIds.has(artistId);
    setSavedIds((prev) => {
      const next = new Set(prev);
      if (wasSaved) next.delete(artistId);
      else next.add(artistId);
      return next;
    });
    try {
      if (wasSaved) await unsaveArtist(artistId);
      else await saveArtist(artistId);
    } catch {
      // Revert on failure — the request bounced, so the UI shouldn't lie about state.
      setSavedIds((prev) => {
        const next = new Set(prev);
        if (wasSaved) next.add(artistId);
        else next.delete(artistId);
        return next;
      });
    }
  }, [savedIds]);

  const isSaved = useCallback((artistId: string) => savedIds.has(artistId), [savedIds]);

  const value = useMemo(() => ({ savedIds, isSaved, toggle }), [savedIds, isSaved, toggle]);

  return <SavedArtistsContext.Provider value={value}>{children}</SavedArtistsContext.Provider>;
}

export function useSavedArtists() {
  const ctx = useContext(SavedArtistsContext);
  if (!ctx) throw new Error("useSavedArtists must be used within SavedArtistsProvider");
  return ctx;
}
