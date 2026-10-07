import { describe, expect, it } from "vitest";
import {
  availabilityLabel,
  combineDateAndHour,
  earliestSlot,
  formatINR,
  isLeadTimeOk,
  MOMENT_IMAGES,
  nearLabel,
  priceForDuration,
  QUICK_MOMENT_CATEGORY_CHIPS,
  QUICK_MOMENT_KIND,
  SHOW_QUICK_MOMENT_DISTANCE,
  visibleSections,
} from "./quick-moments";
import type { QuickMomentDiscover, QuickMomentDiscoverItem } from "./api";

const item = (over: Partial<QuickMomentDiscoverItem> = {}): QuickMomentDiscoverItem => ({
  artistId: "a1", displayName: "A**a", performerType: "Singer", category: "Singers", profileImageUrl: null,
  distanceKm: 0.5, online: true, availableFrom: null, ...over,
});
const feed = (over: Partial<QuickMomentDiscover> = {}): QuickMomentDiscover => ({
  durations: [{ minutes: 20, priceINR: 1500 }, { minutes: 40, priceINR: 2500 }],
  travel: { freeKm: 5, note: "" }, featured: null, forMoment: [], mostViewed: [], reels: [], emptyReason: null, ...over,
});

describe("prices come from the server's durations", () => {
  it("looks up by minutes; unknown -> null", () => {
    const d = feed().durations;
    expect(priceForDuration(d, 20)).toBe(1500);
    expect(priceForDuration(d, 40)).toBe(2500);
    expect(priceForDuration(null, 20)).toBeNull();
    expect(priceForDuration([{ minutes: 20, priceINR: 1800 }], 40)).toBeNull();
  });
  it("formats rupees", () => {
    expect(formatINR(1500)).toBe("₹1,500");
  });
});

describe("distance is not shown", () => {
  it("'Near you' while the flag is off", () => {
    expect(SHOW_QUICK_MOMENT_DISTANCE).toBe(false);
    expect(nearLabel({ distanceKm: 0.5 })).toBe("Near you");
    expect(nearLabel({ distanceKm: 12.3 })).not.toMatch(/km/);
  });
});

describe("availability wording", () => {
  it("online / offline with the time they are back", () => {
    expect(availabilityLabel({ online: true, availableFrom: null })).toBe("Online now");
    expect(availabilityLabel({ online: false, availableFrom: "6:00 PM" })).toBe("Offline · available from 6:00 PM");
    expect(availabilityLabel({ online: false, availableFrom: null })).toBe("Offline");
  });
});

describe("sections with nothing real are hidden", () => {
  it("no response yet: nothing at all", () => {
    expect(visibleSections(null)).toMatchObject({ featured: false, forMoment: false, mostViewed: false, reels: false, heading: false, noArtistsNearby: false });
  });
  it("empty feed: nothing; only NO_ARTISTS_NEARBY gives a line", () => {
    expect(visibleSections(feed())).toMatchObject({ heading: false, noArtistsNearby: false });
    expect(visibleSections(feed({ emptyReason: "NO_ARTISTS_NEARBY" }))).toMatchObject({ heading: false, noArtistsNearby: true });
  });
  it("only the sections that have data show", () => {
    const v = visibleSections(feed({ forMoment: [item()], reels: [{ artistId: "a1", displayName: "A**a", videoUrl: "u", thumbnailUrl: null }] }));
    expect(v).toMatchObject({ featured: false, forMoment: true, mostViewed: false, reels: true, heading: true, anyOnline: true });
  });
  it("featured is shown only when the server sends one", () => {
    expect(visibleSections(feed({ featured: item() })).featured).toBe(true);
    expect(visibleSections(feed()).featured).toBe(false);
  });
  it("'ONLINE NOW' only if someone is online", () => {
    expect(visibleSections(feed({ forMoment: [item({ online: false, availableFrom: "6:00 PM" })] })).anyOnline).toBe(false);
  });
});

describe("time", () => {
  const now = new Date("2027-03-10T14:20:00");
  it("earliest slot is 2+ hours out, on a whole hour", () => {
    const s = earliestSlot(now);
    expect(s.getHours()).toBe(17);
    expect(s.getMinutes()).toBe(0);
    expect(s.getTime()).toBeGreaterThanOrEqual(now.getTime() + 2 * 3600 * 1000);
  });
  it("exactly on an hour stays", () => {
    expect(earliestSlot(new Date("2027-03-10T14:00:00")).getHours()).toBe(16);
  });
  it("lead time check needs 2 hours", () => {
    expect(isLeadTimeOk(new Date("2027-03-10T16:00:00"), now)).toBe(false);
    expect(isLeadTimeOk(new Date("2027-03-10T16:20:00"), now)).toBe(true);
  });
  it("combines a date with a chosen hour", () => {
    expect(combineDateAndHour(new Date("2027-03-12T05:30:00"), 19).getHours()).toBe(19);
  });
});

describe("moment cards and chips", () => {
  it("each booking format maps to the server's moment", () => {
    expect(QUICK_MOMENT_KIND).toEqual({ BIRTHDAY_SURPRISE: "BIRTHDAY", ANNIVERSARY_SERENADE: "ANNIVERSARY", JUST_BECAUSE: "JUST_BECAUSE" });
  });
  it("no moment photo exists yet: the card falls back to the drawn art (no category photo is used)", () => {
    expect(Object.values(MOMENT_IMAGES).every((v) => v === null)).toBe(true);
  });
  it("the category chips are exactly the server's list", () => {
    expect(QUICK_MOMENT_CATEGORY_CHIPS).toEqual(["All", "Singers", "Instrumentalists", "Duo", "Comedians", "Magicians", "Sketch artists", "Poets"]);
  });
});
