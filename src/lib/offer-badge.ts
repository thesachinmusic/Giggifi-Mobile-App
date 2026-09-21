import type { ArtistOfferBadge } from "@/lib/api";

// Short label for a discovery-card / profile badge. Display only — this app
// does not compute or apply a discount from it.
// The price a QUICK_BOOKING will actually be charged with the offer applied —
// the same rule as applyOfferDiscount on the server (the discount comes off the
// price before the platform fee/GST, a FREEBIE never changes it). Used only to
// SHOW the amount; the server computes the real one from the offerId.
export function priceWithOffer(
  price: number,
  offer: Pick<ArtistOfferBadge, "discountType" | "discountValue"> | null | undefined,
): number {
  if (!offer) return price;
  if (offer.discountType === "PERCENTAGE") return Math.max(0, price - Math.round(price * (offer.discountValue / 100)));
  if (offer.discountType === "FLAT_AMOUNT") return Math.max(0, price - offer.discountValue);
  return price;
}

export function offerBadgeLabel(offer: Pick<ArtistOfferBadge, "discountType" | "discountValue">): string {
  if (offer.discountType === "PERCENTAGE") return `${offer.discountValue}% OFF`;
  if (offer.discountType === "FLAT_AMOUNT") return `₹${offer.discountValue.toLocaleString("en-IN")} OFF`;
  return "OFFER";
}
