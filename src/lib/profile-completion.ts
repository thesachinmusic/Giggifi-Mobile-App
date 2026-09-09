import type { SessionUser } from "./api";

// The 6 soft fields Home's "complete your profile" nudge tracks — every
// one individually optional, never a forced step. Deliberately separate
// from BookerProfile's own completeness (fullName/email/city/state/photo,
// see profile.tsx) — that's booking-readiness, this is general personal
// enrichment, and the two shouldn't be conflated into one nudge.
export function isProfileComplete(user: SessionUser | null): boolean {
  if (!user) return false;
  return Boolean(user.name && user.email && user.gender && user.dateOfBirth && user.religion && user.anniversary);
}
