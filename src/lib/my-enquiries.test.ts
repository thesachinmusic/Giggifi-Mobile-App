import { describe, expect, it } from "vitest";
import { resolveNotificationHref } from "./notification-links";
import { dateText, kindText, priceText, replyCountText, rupees, sentToText, statusText } from "./my-enquiries";

const read = (import.meta as unknown as { glob: (p: string[], o: object) => Record<string, string> }).glob(
  ["./my-enquiries.ts", "../app/my-enquiries.tsx", "../app/my-enquiry.tsx", "../app/(tabs)/profile.tsx", "../app/_layout.tsx", "./api.ts"],
  { query: "?raw", import: "default", eager: true },
);
const src = (name: string) => Object.entries(read).find(([k]) => k.endsWith(name))![1];

describe("text helpers", () => {
  it("reply counts", () => {
    expect(replyCountText(0)).toBe("No replies yet");
    expect(replyCountText(1)).toBe("1 reply");
    expect(replyCountText(3)).toBe("3 replies");
  });
  it("price is in rupees, or says none was shared (never ₹0)", () => {
    expect(rupees(60000)).toBe("₹60,000");
    expect(priceText(60000)).toBe("₹60,000");
    expect(priceText(null)).toBe("No price shared");
    expect(priceText(0)).toBe("No price shared");
  });
  it("status, date, kind and who it was sent to", () => {
    expect(statusText("OPEN")).toBe("Open");
    expect(statusText("CLOSED")).toBe("Closed");
    expect(dateText("2026-12-10T00:00:00.000Z")).toBe("10 Dec 2026");
    expect(dateText("x")).toBe("");
    expect(kindText("VENDOR")).toBe("Vendor");
    expect(kindText("ARTIST")).toBe("Artist");
    expect(sentToText({ sentTo: "Shaadi Decor", visibility: "PERSONAL" })).toBe("Sent to Shaadi Decor");
    expect(sentToText({ sentTo: null, visibility: "PUBLIC" })).toBe("Sent to matching artists");
  });
});

describe("opening from a notification", () => {
  it("/my-enquiries is an allowed link; unknown links still are not", () => {
    expect(resolveNotificationHref("/my-enquiries")).toBe("/my-enquiries");
    expect(resolveNotificationHref("/my-enquiries/x")).toBeNull();
    expect(resolveNotificationHref("/somewhere-else")).toBeNull();
  });
});

function visibleText(code: string): string {
  const noComments = code.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
  const strings = noComments.match(/"[^"\n]{3,}"|`[^`\n]{3,}`/g) ?? [];
  const jsx = noComments.match(/>([^<>{}\n]{3,})</g) ?? [];
  return [...strings, ...jsx].join("\n");
}

describe("the screens", () => {
  const FILES = ["my-enquiries.ts", "app/my-enquiries.tsx", "app/my-enquiry.tsx"];
  it("use plain words: no refund, cancel, pause, guarantee, escrow, 'verified' or percentages", () => {
    for (const f of FILES) expect(visibleText(src(f)), f).not.toMatch(/refund|cancel|pause|escrow|guarantee|protected|safe payment|24\/7|platform credit|verified|%/i);
  });
  it("are view only: no accept, book or pay button, and no phone or email shown", () => {
    for (const f of ["app/my-enquiries.tsx", "app/my-enquiry.tsx"]) {
      const t = visibleText(src(f));
      expect(t, f).not.toMatch(/accept|book now|pay |phone|email|whatsapp/i);
    }
  });
  it("read only from the two app routes", () => {
    const api = src("/api.ts");
    expect(api).toContain('"/api/mobile/enquiries/mine"');
    expect(api).toContain("/api/mobile/enquiries/${encodeURIComponent(enquiryId)}/responses");
  });
  it("are registered and reachable from the profile menu", () => {
    expect(src("app/_layout.tsx")).toContain('name="my-enquiries"');
    expect(src("app/_layout.tsx")).toContain('name="my-enquiry"');
    expect(src("(tabs)/profile.tsx")).toContain('router.push("/my-enquiries")');
  });
});
