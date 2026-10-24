import { describe, expect, it } from "vitest";
import { completeProfileRoute, isProfileComplete } from "./profile-completion";
import type { SessionUser } from "./api";

const files = (import.meta as unknown as { glob: (p: string[], o: object) => Record<string, string> }).glob(
  ["../components/ProfileCompletionBadge.tsx"],
  { query: "?raw", import: "default", eager: true },
);

const user = (over: Partial<SessionUser> = {}): SessionUser => ({
  id: "u1", name: null, email: null, phone: null, image: null, role: "CLIENT", onboardingState: null,
  hasArtistProfile: false, hasBookerProfile: false, ...over,
});

describe("Home 'Complete your profile' strip", () => {
  it("sends someone with no client profile to the screen that creates it", () => {
    expect(completeProfileRoute(user({ hasBookerProfile: false }))).toBe("/booker-profile");
  });

  it("sends someone who already has a client profile to Edit profile (the optional details)", () => {
    expect(completeProfileRoute(user({ hasBookerProfile: true }))).toBe("/edit-profile");
  });

  it("the strip uses that rule and no longer pushes /edit-profile directly", () => {
    const src = Object.values(files)[0];
    expect(src).toContain("completeProfileRoute(user)");
    expect(src).not.toMatch(/router\.push\("\/edit-profile"\)/);
  });

  it("when the strip shows is unchanged: only until the six optional details are filled", () => {
    expect(isProfileComplete(null)).toBe(false);
    expect(isProfileComplete(user({ name: "Asha Rao", email: "a@b.com", gender: "Female", dateOfBirth: "1990-01-01", religion: "Hindu", anniversary: "2015-01-01" }))).toBe(true);
    expect(isProfileComplete(user({ name: "Asha Rao", email: "a@b.com" }))).toBe(false);
  });
});
