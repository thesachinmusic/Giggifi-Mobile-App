// Same four reasons the website treats as safety reports (urgent email).
// unsafe_venue is artist-only, so the client app never offers it.
const SAFETY_REASONS = new Set(["harassment", "unsafe_behaviour", "unsafe_venue", "intoxicated_or_aggressive"]);

export const EMERGENCY_LINE = "If you are in immediate danger, call 112 first.";

export function isSafetyReason(reason: string | null | undefined): boolean {
  return reason != null && SAFETY_REASONS.has(reason);
}
