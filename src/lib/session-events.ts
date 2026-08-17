// Lets api.ts (a plain module, not a component) tell AuthProvider to clear
// its in-memory user on a real 401 — the two can't reach each other via
// props/context, so this is a minimal pub-sub bridge instead of a circular
// import between auth-context.tsx and api.ts.
type Listener = () => void;

const listeners = new Set<Listener>();

export function onSessionExpired(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function emitSessionExpired(): void {
  listeners.forEach((fn) => fn());
}
