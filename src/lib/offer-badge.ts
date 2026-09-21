import type { ArtistOfferBadge } from "@/lib/api";

// Short label for a discovery-card / profile badge. Display only — this app
// does not compute or apply a discount from it.
export function offerBadgeLabel(offer: Pick<ArtistOfferBadge, "discountType" | "discountValue">): string {
  if (offer.discountType === "PERCENTAGE") return `${offer.discountValue}% OFF`;
  if (offer.discountType === "FLAT_AMOUNT") return `₹${offer.discountValue.toLocaleString("en-IN")} OFF`;
  return "OFFER";
}
