import { describe, expect, it } from "vitest";
import { SUPPORT_EMAIL } from "./constants";

// The single public support email is contact@giggifi.com. admin@giggifi.com is for staff and official work
// (the grievance contact) and is never the support address shown in Help and support.
const files = (import.meta as unknown as { glob: (p: string[], o: object) => Record<string, string> }).glob(
  ["../app/(tabs)/profile.tsx", "../app/booking/[[]id].tsx", "../lib/refund-summary.ts"],
  { query: "?raw", import: "default", eager: true },
);

describe("support email", () => {
  it("is contact@giggifi.com", () => {
    expect(SUPPORT_EMAIL).toBe("contact@giggifi.com");
  });
  it("the Profile 'Help and support' card uses the shared constant, not its own copy", () => {
    const key = Object.keys(files).find((k) => k.endsWith("(tabs)/profile.tsx"));
    expect(key).toBeTruthy();
    const src = files[key as string];
    expect(src).toMatch(/import \{[^}]*SUPPORT_EMAIL[^}]*\} from "@\/lib\/constants"/);
    expect(src).not.toMatch(/const SUPPORT_EMAIL\s*=/);
    expect(src).not.toMatch(/admin@giggifi\.com/);
  });
});
