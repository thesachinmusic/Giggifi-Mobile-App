// Config-driven so content can change without a release — NOT a real
// committed deals engine. Sachin has explicitly said actual terms aren't
// finalized; every card here is illustrative only. The screen renders a
// visible "example — details to be confirmed" disclaimer alongside these
// until real terms are locked in and this whole file is replaced with
// final copy (at which point the disclaimer should come out too).
export type BusinessDealCategory = "restaurants" | "corporates" | "eventCompanies";

export interface BusinessDeal {
  id: string;
  tag: string;
  headline: string;
  body: string;
}

export const BUSINESS_DEAL_TABS: { key: BusinessDealCategory; label: string }[] = [
  { key: "restaurants", label: "Restaurants" },
  { key: "corporates", label: "Corporates" },
  { key: "eventCompanies", label: "Event Cos." },
];

export const BUSINESS_DEALS: Record<BusinessDealCategory, BusinessDeal[]> = {
  restaurants: [
    {
      id: "restaurants-recurring-slots",
      tag: "Recurring",
      headline: "Weekly live music slots",
      body: "A recurring artist booking for weekend service, on one standing calendar instead of a fresh enquiry every week.",
    },
    {
      id: "restaurants-bundle-dj-band",
      tag: "Bundle",
      headline: "Bundle a DJ with a live band",
      body: "Combine a DJ and a live band under one negotiated rate across your event calendar.",
    },
  ],
  corporates: [
    {
      id: "corporates-priority-support",
      tag: "Priority",
      headline: "Priority booking & support",
      body: "Faster quotes and a dedicated point of contact for every corporate event you run.",
    },
    {
      id: "corporates-consolidated-invoicing",
      tag: "Invoicing",
      headline: "Consolidated monthly invoicing",
      body: "One GST invoice covering every booking in a month, instead of one per event.",
    },
  ],
  eventCompanies: [
    {
      id: "event-companies-multi-artist-bundle",
      tag: "Bundle",
      headline: "Multi-artist package pricing",
      body: "Bundle artists across the events you run for clients under one negotiated rate.",
    },
    {
      id: "event-companies-dedicated-account",
      tag: "Priority",
      headline: "Dedicated account support",
      body: "One GiggiFi contact across every event you run this season, not a new thread each time.",
    },
  ],
};
