// Plain logic for the My enquiries screens. No React in this file, so it is easy to test.

export interface MyEnquiry {
  id: string;
  visibility: string;
  category: string;
  eventType: string;
  eventDate: string;
  city: string;
  budgetMin: number | null;
  budgetMax: number | null;
  status: string;
  createdAt: string;
  replyCount: number;
  sentTo: string | null;
}

export interface EnquiryReply {
  id: string;
  name: string;
  kind: "ARTIST" | "VENDOR";
  city: string | null;
  imageUrl: string | null;
  quoteAmount: number | null;
  message: string;
  createdAt: string;
}

export interface EnquiryReplies {
  enquiry: { id: string; eventType: string; eventDate: string; city: string; status: string };
  replies: EnquiryReply[];
}

export const rupees = (n: number): string => `₹${Math.round(n).toLocaleString("en-IN")}`;

export function replyCountText(n: number): string {
  if (n <= 0) return "No replies yet";
  return n === 1 ? "1 reply" : `${n} replies`;
}

// A reply may have no price: the person only wrote a message.
export const priceText = (quoteAmount: number | null): string => (quoteAmount && quoteAmount > 0 ? rupees(quoteAmount) : "No price shared");

export const statusText = (status: string): string => (status === "OPEN" ? "Open" : "Closed");

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export function dateText(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

export const kindText = (kind: "ARTIST" | "VENDOR"): string => (kind === "VENDOR" ? "Vendor" : "Artist");

export function sentToText(e: Pick<MyEnquiry, "sentTo" | "visibility">): string {
  if (e.sentTo) return `Sent to ${e.sentTo}`;
  return e.visibility === "PUBLIC" ? "Sent to matching artists" : "Sent";
}
