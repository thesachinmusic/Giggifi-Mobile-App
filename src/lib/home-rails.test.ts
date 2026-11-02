import { describe, expect, it } from "vitest";
import { featuredQueryString, featuredRail, FRESH_LIMIT, freshRail, POPULAR_LIMIT, popularRail } from "./home-rails";
import type { ArtistSummary } from "./api";

const a = (id: string, over: Partial<ArtistSummary> = {}) => ({ id, ...over }) as ArtistSummary;
const ids = (list: { id: string }[]) => list.map((x) => x.id);
const many = (n: number, prefix = "a") => Array.from({ length: n }, (_, i) => a(`${prefix}${i}`));

describe("Popular right now = most booked, in the server's order", () => {
  it("keeps the booking-count order and caps the rail", () => {
    const sorted = many(20);
    expect(ids(popularRail(sorted))).toEqual(ids(sorted.slice(0, POPULAR_LIMIT)));
  });
  it("does not reshuffle (the old daily shuffle is gone)", () => {
    const sorted = [a("z"), a("b"), a("m")];
    expect(ids(popularRail(sorted))).toEqual(["z", "b", "m"]);
  });
});

describe("Fresh picks = newest first, never repeating Popular", () => {
  it("keeps newest-first order", () => {
    expect(ids(freshRail([a("n1"), a("n2"), a("n3")], []))).toEqual(["n1", "n2", "n3"]);
  });
  it("drops anyone shown under Popular", () => {
    const fresh = freshRail([a("n1"), a("p1"), a("n2"), a("p2"), a("n3")], [a("p1"), a("p2")]);
    expect(ids(fresh)).toEqual(["n1", "n2", "n3"]);
  });
  it("no artist is in both rails", () => {
    const newest = many(30, "x");
    const popular = popularRail([...many(5, "x"), ...many(10, "p")]);
    const fresh = freshRail(newest, popular);
    const both = ids(fresh).filter((id) => ids(popular).includes(id));
    expect(both).toEqual([]);
    expect(fresh.length).toBeLessThanOrEqual(FRESH_LIMIT);
  });
});

describe("Featured artists: Promoted only for paid", () => {
  it("paid artists are promoted, fill artists are not", () => {
    const list = featuredRail([a("paid1")], [a("fill1", { isFeatured: true })]);
    expect(list.find((x) => x.id === "paid1")?.isFeatured).toBe(true);
    expect(list.find((x) => x.id === "fill1")?.isFeatured).toBe(false); // whatever the server sent
  });
  it("paid come first, then fill; an artist in both shows once, as paid", () => {
    const list = featuredRail([a("p1"), a("p2")], [a("f1"), a("p2"), a("f2")]);
    expect(ids(list)).toEqual(["p1", "p2", "f1", "f2"]);
    expect(list.map((x) => x.isFeatured)).toEqual([true, true, false, false]);
  });
  it("an older backend with no fill list still works", () => {
    expect(ids(featuredRail([a("p1")], []))).toEqual(["p1"]);
    expect(featuredRail([], [])).toEqual([]);
  });
});

describe("the Home city is sent to /featured only when there is one", () => {
  it("adds ?city= when set (trimmed, URL-encoded)", () => {
    expect(featuredQueryString("Mumbai")).toBe("?city=Mumbai");
    expect(featuredQueryString("  Navi Mumbai ")).toBe("?city=Navi%20Mumbai");
  });
  it("sends nothing without a city", () => {
    expect(featuredQueryString(null)).toBe("");
    expect(featuredQueryString(undefined)).toBe("");
    expect(featuredQueryString("   ")).toBe("");
  });
});
