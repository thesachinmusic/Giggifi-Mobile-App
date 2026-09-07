import { readJSON, writeJSON } from "./local-storage";

// Local-only for now — deliberately NOT synced to BookerProfile on the
// backend yet. Persisting this for real (so it survives a reinstall / is
// visible to an admin) needs a BookerType taxonomy decision (the mock's
// Restaurant/Venue, Corporate, Event Company options don't map cleanly
// onto the existing INDIVIDUAL | CORPORATE | PLANNER | AGENCY enum) and a
// gstNumber field on BookerProfile — both flagged back rather than guessed.
// This local version already satisfies "don't re-ask on repeat visits".
export type BusinessType = "RESTAURANT" | "CORPORATE" | "EVENT_COMPANY";

export interface BusinessDetails {
  type: BusinessType;
  businessName: string;
  city: string;
  monthlyVolume: string;
}

const KEY = "giggifi_business_details";

export function getBusinessDetails(): Promise<BusinessDetails | null> {
  return readJSON<BusinessDetails | null>(KEY, null);
}

export function setBusinessDetails(details: BusinessDetails): Promise<void> {
  return writeJSON(KEY, details);
}
