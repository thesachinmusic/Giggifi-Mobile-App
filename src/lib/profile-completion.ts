import type { SessionUser } from "./api";
import { realName } from "./format";

// The 6 soft fields Home's "complete your profile" nudge tracks — every
// one individually optional, never a forced step. Deliberately separate
// from BookerProfile's own completeness (fullName/email/city/state/photo,
// see profile.tsx) — that's booking-readiness, this is general personal
// enrichment, and the two shouldn't be conflated into one nudge.
export function isProfileComplete(user: SessionUser | null): boolean {
  if (!user) return false;
  return Boolean(realName(user.name) && user.email && user.gender && user.dateOfBirth && user.religion && user.anniversary);
}

// Where Home's "Complete your profile" strip should open. Someone with no client profile yet
// goes to the screen that creates it (name, email, city, state), because that profile is what
// enquiries and bookings need. Edit profile only saves the optional personal details, so it
// stays for people who already have a client profile.
export function completeProfileRoute(user: Pick<SessionUser, "hasBookerProfile">): "/booker-profile" | "/edit-profile" {
  return user.hasBookerProfile ? "/edit-profile" : "/booker-profile";
}
