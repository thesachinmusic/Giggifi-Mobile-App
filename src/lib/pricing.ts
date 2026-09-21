// What a booking costs the client, for showing the price BEFORE a booking exists
// (the artist profile's Book Now and the plan-my-event checkout). Display only:
// the server computes and stores the real numbers, and after booking the app
// shows those instead (see booking/[id].tsx). This mirrors computeBookingPricing
// in the website's lib/pricing.ts — keep the two in step.
//
//   Client pays = (artist's price − any offer) + service fee (10% of the ORIGINAL
//   price) + GST (18% of that fee). An artist-offered discount comes off the
//   artist's side only: the fee and GST never shrink with it.
const CLIENT_FEE_RATE = 0.1;
const GST_RATE = 0.18;
// The artist-side 14% (10% commission + 4% platform fee) — only used here to cap
// a discount the way the server does, so the artist never goes below ₹0.
const ARTIST_FEE_RATE_PARTS = [0.1, 0.04] as const;

export interface ClientPriceBreakdown {
  // The artist's original price, before any offer.
  artistPrice: number;
  // What the artist's offer takes off (0 with no offer).
  offerDiscount: number;
  serviceFee: number;
  gst: number;
  total: number;
}

export function clientPriceBreakdown(originalPrice: number, requestedDiscount = 0): ClientPriceBreakdown {
  const price = Math.max(0, Math.round(originalPrice));
  const serviceFee = Math.round(price * CLIENT_FEE_RATE);
  const gst = Math.round(serviceFee * GST_RATE);
  const artistFees = ARTIST_FEE_RATE_PARTS.reduce((sum, rate) => sum + Math.round(price * rate), 0);
  const requested = Math.max(0, Math.round(Number.isFinite(requestedDiscount) ? requestedDiscount : 0));
  const offerDiscount = Math.min(requested, Math.max(0, price - artistFees));
  return { artistPrice: price, offerDiscount, serviceFee, gst, total: price - offerDiscount + serviceFee + gst };
}
