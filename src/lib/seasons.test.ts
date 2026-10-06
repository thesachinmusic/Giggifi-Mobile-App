import { describe, expect, it } from "vitest";
import { seasonKeyForTitle } from "./seasons";

describe("seasonKeyForTitle", () => {
  it("maps the current and upcoming tile titles", () => {
    expect(seasonKeyForTitle("Wedding Special")).toBe("wedding");
    expect(seasonKeyForTitle("Wedding Season")).toBe("wedding");
    expect(seasonKeyForTitle("Corporate Events")).toBe("corporate");
    expect(seasonKeyForTitle("Bhajan Clubbing")).toBe("bhajan");
    expect(seasonKeyForTitle("Sufi Special")).toBe("sufi");
    expect(seasonKeyForTitle("Ganpati Special")).toBe("ganpati");
    expect(seasonKeyForTitle("Navratri Special")).toBe("navratri");
    expect(seasonKeyForTitle("Diwali Special")).toBe("diwali");
    expect(seasonKeyForTitle("Christmas Special")).toBe("christmas");
    expect(seasonKeyForTitle("Eid Special")).toBe("eid");
  });

  it("resolves the combined Bhajan & Sufi title to bhajan", () => {
    expect(seasonKeyForTitle("Bhajan & Sufi")).toBe("bhajan");
  });

  it("returns null for a festival with no season page config", () => {
    expect(seasonKeyForTitle("Holi Special")).toBeNull();
    expect(seasonKeyForTitle("Heidi Night")).toBeNull();
  });
});
