import { describe, expect, it } from "vitest";
import { cancellationMailto, COOLING_OFF_TEXT, REFUND_PROCESSING_SENTENCE, QUICK_MOMENT_REFUND_NOTE, STANDARD_REFUND_NOTE, QUICK_MOMENT_REFUND_ROWS, STANDARD_REFUND_ROWS } from "./refund-summary";

describe("refund summary (pinned to the live policy wording)", () => {
  it("keeps the 3.5 cooling-off sentence", () => {
    expect(COOLING_OFF_TEXT).toContain("cancel within 2 hours of paying, provided the Event is more than 7 days away");
    // Neutral: no amount, no "full refund", and nothing about who bears the gateway charge in this window.
    expect(COOLING_OFF_TEXT).not.toMatch(/gateway|absorb|less |full refund/i);
    expect(COOLING_OFF_TEXT).toContain("The Refund Policy explains the amount");
  });
  it("keeps the 4.1 percentages in order", () => {
    expect(STANDARD_REFUND_ROWS.map((r) => r.refund)).toEqual(["100%", "75%", "50%", "25%", "0%", "0%"]);
  });
  it("keeps the 4.2 Quick Moment rows", () => {
    expect(QUICK_MOMENT_REFUND_ROWS.map((r) => r.refund)).toEqual(["100% (Platform Fee refunded)", "50%", "0%"]);
  });
});

describe("refund notes", () => {
  it("standard note says the percentages are of the Booking Fee and when the Platform Fee comes back", () => {
    expect(STANDARD_REFUND_NOTE).toContain("of the Booking Fee");
    expect(STANDARD_REFUND_NOTE).toContain("more than 14 days");
    expect(STANDARD_REFUND_NOTE).toContain("where the Refund Policy says so");
  });
  it("Quick Moment note does not guess what the percentages apply to", () => {
    expect(QUICK_MOMENT_REFUND_NOTE).not.toContain("Booking Fee");
    expect(QUICK_MOMENT_REFUND_NOTE).toContain("Refund Policy");
  });
});

describe("refund sentence (owner decision R1)", () => {
  it("is the exact approved sentence, with no full, partial or amount", () => {
    expect(REFUND_PROCESSING_SENTENCE).toBe("Your refund will be processed as per the Refund Policy, after deducting the cancellation charges and payment gateway charges that apply to your cancellation window, along with any applicable taxes.");
    expect(REFUND_PROCESSING_SENTENCE).not.toMatch(/full|partial|₹|100%/i);
  });
  it("no text shown on the cancel card says full refund or partial refund", () => {
    const all = [COOLING_OFF_TEXT, STANDARD_REFUND_NOTE, QUICK_MOMENT_REFUND_NOTE, ...STANDARD_REFUND_ROWS.map((r) => r.notice + r.refund), ...QUICK_MOMENT_REFUND_ROWS.map((r) => r.notice + r.refund)].join(" ");
    expect(all).not.toMatch(/full refund|partial refund/i);
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
