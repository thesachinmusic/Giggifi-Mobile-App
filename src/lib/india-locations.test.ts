import { describe, expect, it } from "vitest";
import { normalizeCustomCity } from "./india-locations";

describe("normalizeCustomCity", () => {
  it("tidies spacing and capitals", () => {
    expect(normalizeCustomCity("  barpeta   road ")).toBe("Barpeta Road");
  });
  it("rejects empty, too short, digits and symbols", () => {
    for (const bad of ["", " ", "a", "123", "city<script>", "9876543210"]) expect(normalizeCustomCity(bad)).toBeNull();
  });
});
