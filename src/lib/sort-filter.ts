import type { ArtistSummary, VendorSummary } from "@/lib/api";

type Listing = ArtistSummary | VendorSummary;

export type SortOption = "recommended" | "price_low" | "price_high" | "experience" | "top_rated";

export const SORT_OPTIONS: { key: SortOption; label: string }[] = [
  { key: "recommended", label: "Recommended" },
  { key: "top_rated", label: "Top Rated" },
  { key: "price_low", label: "Price: Low to High" },
  { key: "price_high", label: "Price: High to Low" },
  { key: "experience", label: "Most Experienced" },
];

export interface FilterState {
  minPrice: string;
  maxPrice: string;
  travelReady: boolean;
  negotiableOnly: boolean;
}

export const DEFAULT_FILTERS: FilterState = {
  minPrice: "",
  maxPrice: "",
  travelReady: false,
  negotiableOnly: false,
};

export function countActiveFilters(filters: FilterState) {
  let count = 0;
  if (filters.minPrice) count += 1;
  if (filters.maxPrice) count += 1;
  if (filters.travelReady) count += 1;
  if (filters.negotiableOnly) count += 1;
  return count;
}

function getPrice(item: Listing): number | null {
  return "ratePerEvent" in item ? item.ratePerEvent : item.startingPrice;
}

export function applySortAndFilters<T extends Listing>(items: T[], sort: SortOption, filters: FilterState): T[] {
  let result = items;

  const min = filters.minPrice ? Number(filters.minPrice) : null;
  const max = filters.maxPrice ? Number(filters.maxPrice) : null;

  if (min != null && !Number.isNaN(min)) {
    result = result.filter((a) => (getPrice(a) ?? 0) >= min);
  }
  if (max != null && !Number.isNaN(max)) {
    result = result.filter((a) => (getPrice(a) ?? 0) <= max);
  }
  if (filters.travelReady) {
    result = result.filter((a) => a.travelAvailable);
  }
  if (filters.negotiableOnly) {
    result = result.filter((a) => a.priceNegotiable);
  }

  const sorted = [...result];
  if (sort === "price_low") {
    sorted.sort((a, b) => (getPrice(a) ?? Infinity) - (getPrice(b) ?? Infinity));
  } else if (sort === "price_high") {
    sorted.sort((a, b) => (getPrice(b) ?? -1) - (getPrice(a) ?? -1));
  } else if (sort === "experience") {
    sorted.sort((a, b) => (b.yearsExperience ?? -1) - (a.yearsExperience ?? -1));
  } else if (sort === "top_rated") {
    sorted.sort((a, b) => (b.avgRating ?? -1) - (a.avgRating ?? -1));
  }

  return sorted;
}
