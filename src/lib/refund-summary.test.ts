import { describe, expect, it } from "vitest";
import { cancellationMailto, COOLING_OFF_TEXT, QUICK_MOMENT_REFUND_ROWS, STANDARD_REFUND_ROWS } from "./refund-summary";

describe("refund summary (pinned to the live policy wording)", () => {
  it("keeps the 3.5 cooling-off sentence", () => {
    expect(COOLING_OFF_TEXT).toContain("cancel within 2 hours of paying, provided the Event is more than 7 days away");
    expect(COOLING_OFF_TEXT).toContain("less payment gateway charges");
    expect(COOLING_OFF_TEXT).not.toContain("absorbs");
  });
  it("keeps the 4.1 percentages in order", () => {
    expect(STANDARD_REFUND_ROWS.map((r) => r.refund)).toEqual(["100%", "75%", "50%", "25%", "0%", "0%"]);
  });
  it("keeps the 4.2 Quick Moment rows", () => {
    expect(QUICK_MOMENT_REFUND_ROWS.map((r) => r.refund)).toEqual(["100% (Platform Fee refunded)", "50%", "0%"]);
  });
});

describe("cancellationMailto", () => {
  it("prefills the booking reference, event and date", () => {
    const url = cancellationMailto({ id: "bk_123", eventName: "Riya's Sangeet", eventDate: "2026-12-01" });
    expect(url.startsWith("mailto:contact@giggifi.com?subject=")).toBe(true);
    const body = decodeURIComponent(url.split("body=")[1]);
    expect(body).toContain("Booking reference: bk_123");
    expect(body).toContain("Event: Riya's Sangeet");
    expect(body).toContain("Event date: 2026-12-01");
    expect(decodeURIComponent(url.split("subject=")[1].split("&")[0])).toBe("Cancel booking bk_123");
  });
});
