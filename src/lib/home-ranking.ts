// Ranks Home's artist rail by proximity to the user's chosen city without
// ever dropping anyone. GiggiFi's catalog is Mumbai-only today, so a hard
// city filter (the Zepto/Blinkit model) would empty the app for every other
// city — and unlike a delivery app, artists travel (travelAvailable already
// exists in the schema). Local artists surface first, then travel-ready
// artists from elsewhere (flagged in the UI via travelsToYourCity), then
// everyone else in their original order. Browse's own city filter is
// unaffected by this — it still removes results, deliberately.
export function rankByHomeCity<T extends { city: string | null; travelAvailable: boolean }>(
  items: T[],
  homeCity: string | null,
): T[] {
  if (!homeCity) return items;
  const local: T[] = [];
  const travelReady: T[] = [];
  const rest: T[] = [];
  for (const item of items) {
    if (item.city === homeCity) local.push(item);
    else if (item.travelAvailable) travelReady.push(item);
    else rest.push(item);
  }
  return [...local, ...travelReady, ...rest];
}

export function travelsToYourCity<T extends { city: string | null; travelAvailable: boolean }>(
  item: T,
  homeCity: string | null,
): boolean {
  return Boolean(homeCity) && item.city !== homeCity && item.travelAvailable;
}
