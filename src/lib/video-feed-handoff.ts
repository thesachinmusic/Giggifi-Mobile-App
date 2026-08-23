export interface VideoFeedItem {
  id: string;
  stageName: string | null;
  performerType: string | null;
  city: string | null;
  videoUrl: string;
  profileImageUrl: string | null;
  avgRating?: number | null;
}

// In-memory relay for handing a swipeable video list off to /video-feed —
// route params have to stay serializable/short, and re-fetching the whole
// rail on the viewer screen would be wasteful when the caller already has
// the data in memory. Set right before router.push, read once on mount,
// then cleared so a stale list can't leak into a later, unrelated open.
let pending: { items: VideoFeedItem[]; startIndex: number } | null = null;

export function setPendingVideoFeed(items: VideoFeedItem[], startIndex: number): void {
  pending = { items, startIndex };
}

export function takePendingVideoFeed(): { items: VideoFeedItem[]; startIndex: number } | null {
  const value = pending;
  pending = null;
  return value;
}
