import { router } from "expo-router";
import { clearStoredToken, getStoredToken } from "./auth-storage";
import { emitSessionExpired } from "./session-events";
import { showToast } from "./toast-host";

export const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? "https://giggifi.com";
const REQUEST_TIMEOUT_MS = 15_000;

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

// A distinct subclass (not a bare ApiError) so callers that care can tell
// "server said no" apart from "never reached the server" — status 0 keeps
// it compatible with existing `instanceof ApiError` fallback handling.
export class NetworkError extends ApiError {
  constructor() {
    super(0, "Couldn't reach GiggiFi — check your internet connection and try again.");
  }
}

async function request<T>(path: string, options: RequestInit = {}, withAuth = true): Promise<T> {
  // Our own controller drives the actual fetch (so the 15s timeout always
  // applies), but a caller-supplied signal — e.g. browse.tsx cancelling a
  // stale search when the user types again — aborts it too. Listening
  // rather than passing the external signal straight to fetch keeps a
  // single source of truth for why the request ended.
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const externalSignal = options.signal;
  const onExternalAbort = () => controller.abort();
  if (externalSignal) {
    if (externalSignal.aborted) controller.abort();
    else externalSignal.addEventListener("abort", onExternalAbort);
  }

  // Races the *whole* request — token lookup included — against the same
  // 15s window. getStoredToken() used to be awaited before the controller
  // even existed, so a SecureStore call that hangs (seen on some Android
  // devices/OS versions, and whenever the underlying connection stalls
  // without a clean TCP reset) left the caller's promise pending forever:
  // no timeout, no error, just a spinner stuck on-screen for good (found
  // via the identical bug in the artist app's copy of this function).
  // SecureStore has no abort support, so the stuck call itself can't be
  // cancelled — but racing it still lets this function move on and reject
  // once the clock runs out, which is all a caller needs to stop spinning
  // and show an error.
  const timedOut = new Promise<never>((_, reject) => {
    controller.signal.addEventListener("abort", () => reject(new NetworkError()), { once: true });
  });

  const attempt = (async (): Promise<T> => {
    const token = withAuth ? await getStoredToken() : null;

    let response: Response;
    try {
      response = await fetch(`${API_BASE_URL}${path}`, {
        ...options,
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...options.headers,
        },
      });
    } catch {
      // Covers a hung request past REQUEST_TIMEOUT_MS, a flat-out unreachable
      // host, and a caller-triggered cancellation — none of these are "server
      // said no", so none should be reported as one. Callers that care about
      // telling a real cancellation apart from a real network failure check
      // their own AbortController's `.aborted` in the catch, since every case
      // here throws the same NetworkError.
      throw new NetworkError();
    }

    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      // A 401 with a token attached means that token died (30-day expiry, or
      // revoked server-side) — every screen would otherwise show its own
      // generic error while silently stuck logged-in-but-broken, so clear it
      // and say so. A 401 with NO token was never a session to begin with —
      // it's just an anonymous user hitting an auth-required endpoint (e.g.
      // the first tap on "Book"), which the calling screen already handles by
      // rendering InlinePhoneVerification; no toast, no navigation needed.
      // sendOtp/verifyOtp (withAuth: false) are excluded from all of this
      // since a wrong OTP isn't a session expiring.
      if (response.status === 401 && withAuth && token) {
        await clearStoredToken();
        emitSessionExpired();
        showToast({ title: "Session expired", body: "Please sign in again.", category: "SECURITY" });
        router.replace("/(tabs)");
      }
      throw new ApiError(response.status, body.error ?? "Something went wrong.");
    }
    return body as T;
  })();

  try {
    return await Promise.race([attempt, timedOut]);
  } finally {
    clearTimeout(timeout);
    externalSignal?.removeEventListener("abort", onExternalAbort);
  }
}

// ─── Types (mirrors app/api/mobile/* response shapes on the website repo) ───

export interface SessionUser {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  image: string | null;
  role: "CLIENT" | "ARTIST" | null;
  onboardingState: string | null;
  hasArtistProfile: boolean;
  hasBookerProfile: boolean;
  // Soft, self-reported profile-completion fields — undefined on any
  // response shape that doesn't select them, same convention as
  // performanceVideos elsewhere in this file. dateOfBirth is set via a
  // separate endpoint (confirmDateOfBirth below), not updateProfile.
  dateOfBirth?: string | null;
  gender?: string | null;
  religion?: string | null;
  anniversary?: string | null;
}

export interface ReviewSummary {
  rating: number;
  comment: string;
  eventType: string | null;
  createdAt: string;
}

// Same shape as the website's own RepertoireData (artist-public-profile.tsx)
// — songs grouped by moodTag only. No lyrics/musicalKey/notes ever appear
// here; the mobile artist-profile endpoint enforces that server-side.
export interface RepertoireData {
  totalSongs: number;
  languages: string[];
  yearsExperience: number | null;
  groups: { moodTag: string; songs: { id: string; title: string }[] }[];
}

export interface ArtistSummary {
  id: string;
  stageName: string | null;
  fullName: null;
  performerType: string | null;
  otherTypes: string[];
  genres: string[];
  eventTypes: string[];
  languages: string[];
  city: string | null;
  state: string | null;
  gender?: string | null;
  ratePerEvent: number | null;
  profileImageUrl: string | null;
  introVideoUrl: string | null;
  showreelUrl?: string | null;
  // The artist's own-managed performance video gallery (Artist App's Media
  // tab, up to 5, each carrying up to 3 fixed occasion tags used by Home's
  // Seasonal Picks) — undefined on list endpoints that don't select it,
  // same convention as quickMoments* below. Was being uploaded and stored
  // correctly all along; the mobile artist-detail endpoint just never
  // selected/returned it, so it silently never appeared here. tags: [] on
  // any video uploaded before tagging existed.
  performanceVideos?: { url: string; tags: string[] }[];
  availability: boolean;
  travelAvailable: boolean;
  yearsExperience: number | null;
  priceNegotiable: boolean;
  kycStatus?: string;
  userId: string;
  avgRating?: number | null;
  reviewCount?: number;
  recentReviews?: ReviewSummary[];
  isFeatured?: boolean;
  // Quick Moments — undefined on list endpoints that don't select these.
  quickMomentsEnabled?: boolean;
  quickMomentsPricePerSlot?: number | null;
  quickMomentsRadiusKm?: number | null;
  quickMomentsAvgRating?: number | null;
  quickMomentsReviewCount?: number;
  bookingCount?: number;
  // Only present on the single-artist detail endpoint — undefined on list
  // endpoints that don't select it, null when the artist has nothing
  // showcased.
  repertoire?: RepertoireData | null;
}

export interface VendorSummary {
  id: string;
  businessName: string | null;
  contactName?: string | null;
  category: string | null;
  subcategories: string[];
  bio: string | null;
  city: string | null;
  state: string | null;
  serviceAreas?: string[];
  startingPrice: number | null;
  priceNegotiable: boolean;
  yearsExperience?: number | null;
  profileImageUrl: string | null;
  portfolioPhotos: string[];
  portfolioVideoUrl?: string | null;
  travelAvailable: boolean;
  kycStatus?: string;
  userId: string;
  avgRating?: number | null;
  reviewCount?: number;
  recentReviews?: ReviewSummary[];
}

export interface MatchResult {
  id: string;
  city: string | null;
  profileImageUrl: string | null;
  matchReasons: string[];
  [key: string]: unknown;
}

export type NotificationCategory = "BOOKING" | "PAYMENT" | "EVENT_DAY" | "SECURITY" | "SUPPORT" | "OFFER";
export type NotificationPriority = "CRITICAL" | "HIGH" | "NORMAL" | "LOW";

export interface NotificationItem {
  id: string;
  title: string;
  body: string;
  type: string;
  category: NotificationCategory;
  priority: NotificationPriority;
  read: boolean;
  actionUrl: string | null;
  imageUrl: string | null;
  createdAt: string;
  expiresAt: string | null;
}

export interface Booking {
  id: string;
  eventName: string;
  eventType: string;
  eventDate: string;
  eventCity: string;
  status: string;
  totalAmount: number | null;
  artist?: { stageName: string | null; performerType: string | null; profileImageUrl: string | null; city: string | null };
  booker?: { fullName: string | null; city: string | null };
  payment?: { status: string; amount: number } | null;
}

export interface BookingDetail {
  id: string;
  status: string;
  escrowStatus: string;
  eventName: string;
  eventType: string;
  eventDate: string;
  eventCity: string;
  venueName: string | null;
  venueAddress: string | null;
  audienceSize: number;
  duration: number;
  specialRequests: string | null;
  quotedPrice: number | null;
  totalAmount: number | null;
  // Booker-only preview of the same auto-applied discount real order
  // creation uses (see createRazorpayOrder) — 0 when not eligible, or for
  // the artist's own view of this booking. Never shown as a promo/banner
  // anywhere; just a quiet line item in the price breakdown when > 0.
  firstBookingDiscount: number;
  viewerRole: "ARTIST" | "BOOKER";
  // Only non-null once payment has cleared — see [[privacy-constraint]].
  // The other party's real name + phone, delivered as a notification the
  // moment payment succeeds and persisted here afterward.
  revealedContact: { name: string; phone: string | null } | null;
  artist: { id: string; name: string | null; performerType: string | null; profileImageUrl: string | null; city: string | null };
  booker: { id: string; name: string | null; city: string | null };
  payment: { status: string; amount: number; platformFee: number; paidAt: string | null; releasedAt: string | null } | null;
  // Quick Moments — format is "FULL_GIG" for every booking except these.
  format: "FULL_GIG" | "QUICK_MOMENT";
  quickMomentFormat: QuickMomentFormat | null;
  travelDistanceKm: number | null;
  travelFeeAmount: number | null;
  requestedWindowStart: string | null;
  enRouteAt: string | null;
  arrivedAt: string | null;
  completedAt: string | null;
  // Only ever populated for the booker (viewerRole === "BOOKER") — the
  // website never sends these to the artist side, see the API route comment.
  arrivalOtpCode: string | null;
  completionOtpCode: string | null;
  // Always false for the artist side — an artist can't review their own
  // booking, enforced server-side, not just by this flag.
  canReview: boolean;
  review: { id: string; rating: number; comment: string } | null;
  // Auto Invoice — set once payment clears. A direct, publicly-fetchable
  // Cloudinary "raw" PDF URL, not gated behind any signed-URL exchange.
  invoiceUrl: string | null;
  invoiceNumber: string | null;
}

// ─── Quick Moments ("Giggifi 20-20") ───

export type QuickMomentFormat = "BIRTHDAY_SURPRISE" | "ANNIVERSARY_SERENADE" | "JUST_BECAUSE";

export interface QuickMomentMatch {
  id: string;
  stageName: string | null;
  performerType: string | null;
  city: string | null;
  profileImageUrl: string | null;
  introVideoUrl: string | null;
  showreelUrl: string | null;
  pricePerSlot: number | null;
  distanceKm: number;
  // Tiered by distance (see calculateQuickMomentsTravelFee server-side) —
  // already added on top of pricePerSlot in totalFromPrice, never silently
  // bundled with no explanation.
  travelFee: number;
  totalFromPrice: number;
}

export function fetchQuickMomentsMatch(params: { lat: number; lng: number; radiusKm?: number; budgetMax?: number; slotStartTime?: string }) {
  const query = new URLSearchParams();
  query.set("lat", String(params.lat));
  query.set("lng", String(params.lng));
  if (params.radiusKm) query.set("radiusKm", String(params.radiusKm));
  if (params.budgetMax) query.set("budgetMax", String(params.budgetMax));
  if (params.slotStartTime) query.set("slotStartTime", params.slotStartTime);
  return request<{ results: QuickMomentMatch[]; total: number; radiusKm: number }>(`/api/mobile/quick-moments/match?${query.toString()}`);
}

export function bookQuickMoment(input: {
  artistId: string;
  quickMomentFormat: QuickMomentFormat;
  slotStartTime: string;
  venueAddress: string;
  eventCity: string;
  specialRequests?: string;
  // Recomputed server-side against the artist's registered location — never
  // trust a client-supplied distance/fee for what actually gets charged.
  clientLat: number;
  clientLng: number;
}) {
  return request<{ success: true; bookingId: string }>("/api/mobile/quick-moments/book", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export interface QuickMomentLocation {
  active: boolean;
  lat: number | null;
  lng: number | null;
  updatedAt: string | null;
}

// Polling, not a Pusher subscription — pusher-js's React Native support is
// deprecated and its suggested replacement was unpublished in 2022. The
// artist reports periodically (not continuously) from the website
// dashboard, so a poll every ~10s here delivers the same practical
// freshness without a dead client dependency.
export function fetchQuickMomentLocation(bookingId: string) {
  return request<QuickMomentLocation>(`/api/quick-moments/${bookingId}/location`);
}

// ─── Auth ───

export function sendOtp(phone: string) {
  return request<{ success: true; phone: string }>("/api/mobile/send-otp", {
    method: "POST",
    body: JSON.stringify({ phone }),
  }, false);
}

export function verifyOtp(phone: string, otp: string) {
  return request<{ token: string; user: SessionUser }>("/api/mobile/verify-otp", {
    method: "POST",
    body: JSON.stringify({ phone, otp }),
  }, false);
}

export function fetchSession() {
  return request<{ session: { user: SessionUser } | null }>("/api/mobile/session");
}

// ─── Artists ───

// Shared with fetchVendors — matches the query params both /api/mobile/artists
// and /api/mobile/vendors accept (the server ignores gender for vendors, see
// its buildWhere comment, so it's safe to send unconditionally from Browse).
export type ListingSort = "recommended" | "top_rated" | "price_low" | "price_high" | "experience";

export interface ListingParams {
  category?: string;
  city?: string;
  search?: string;
  sort?: ListingSort | "trending"; // trending is artists-only (Home's "Fresh picks" rail)
  cursor?: string;
  limit?: number;
  minPrice?: string;
  maxPrice?: string;
  travelReady?: boolean;
  negotiableOnly?: boolean;
  gender?: string;
}

function listingQueryString(params: ListingParams): string {
  const query = new URLSearchParams();
  if (params.category && params.category !== "All") query.set("category", params.category);
  if (params.city) query.set("city", params.city);
  if (params.search) query.set("search", params.search);
  if (params.sort) query.set("sort", params.sort);
  if (params.cursor) query.set("cursor", params.cursor);
  if (params.limit) query.set("limit", String(params.limit));
  if (params.minPrice) query.set("minPrice", params.minPrice);
  if (params.maxPrice) query.set("maxPrice", params.maxPrice);
  if (params.travelReady) query.set("travelReady", "1");
  if (params.negotiableOnly) query.set("negotiableOnly", "1");
  if (params.gender && params.gender !== "Any") query.set("gender", params.gender);
  return query.toString();
}

export function fetchArtists(params: ListingParams = {}, signal?: AbortSignal) {
  const qs = listingQueryString(params);
  return request<{ artists: ArtistSummary[]; total: number; nextCursor: string | null }>(
    `/api/mobile/artists${qs ? `?${qs}` : ""}`,
    { signal },
  );
}

// Tag-group discovery (e.g. "devotional") — every artist with a video
// tagged into that group, not the single-tag Home Seasonal Picks. See
// GET /api/mobile/artist/by-group on the website; unknown/missing group
// is a 400, not an empty list — surfaced to the caller via request()'s
// existing ApiError handling.
export interface TagGroupResult {
  video: { url: string; tags: string[] };
  artist: ArtistSummary;
}

export function fetchArtistsByGroup(group: string) {
  return request<{ group: { key: string; label: string }; results: TagGroupResult[] }>(
    `/api/mobile/artist/by-group?group=${encodeURIComponent(group)}`,
  );
}

export function fetchArtist(id: string) {
  return request<{ artist: ArtistSummary }>(`/api/mobile/artist/${id}`);
}

export function fetchFeatured() {
  return request<{ artists: ArtistSummary[]; total: number }>("/api/mobile/featured");
}

// Home's "X events booked this week" strip — visible is computed
// server-side (count >= 50), not hardcoded here, so the threshold has one
// source of truth. See app/api/mobile/social-proof/route.ts on the website.
export function fetchSocialProof() {
  return request<{ count: number; visible: boolean }>("/api/mobile/social-proof");
}

// Home's "Seasonal Picks" rail. isActive here is the website's dated-vs-
// evergreen distinction (see getActiveSeasonalPicks), not a visibility
// toggle — every entry returned is meant to render, already filtered
// server-side by the admin kill-switch and today's date.
export interface SeasonalPick {
  id: string;
  title: string;
  icon: string | null;
  isActive: boolean;
  isEvergreen: boolean;
}

export function fetchSeasonalPicks() {
  return request<{ picks: SeasonalPick[] }>("/api/mobile/seasonal-picks");
}

// Home's "From Real Events" rail — admin-approved reviews with real
// uploaded media only (see app/api/mobile/real-events/route.ts). No
// booker identity is ever included, by design.
export interface RealEvent {
  id: string;
  rating: number;
  comment: string;
  mediaUrls: string[];
  eventType: string;
  eventCity: string;
  artistName: string;
  createdAt: string;
}

export function fetchRealEvents() {
  return request<{ events: RealEvent[] }>("/api/mobile/real-events");
}

// Home's admin-controlled announcement banner (giggifi.com/admin/
// announcements). Server already resolves active/in-window/audience-
// matched candidates — the app just renders whichever one it's given.
export interface Announcement {
  id: string;
  title: string;
  body: string;
  imageUrl: string | null;
  actionUrl: string | null;
}

export function fetchAnnouncements() {
  return request<{ announcements: Announcement[] }>("/api/mobile/announcements?app=client");
}

// ─── Business flow ───

export function logBusinessDealInterest(dealCategory: "restaurants" | "corporates" | "eventCompanies", dealId: string) {
  return request<{ success: true }>("/api/mobile/business/deal-interest", {
    method: "POST",
    body: JSON.stringify({ dealCategory, dealId }),
  });
}

// Best-effort sync onto the caller's existing BookerProfile (see the
// website route's own comment: this never creates one from scratch). Local
// storage stays the source of truth for "has this device already filled
// the form" — this just means the business team can also see submitted
// details for real, not only on the submitting device.
export function syncBusinessDetails(input: {
  bookerType: "RESTAURANT" | "CORPORATE" | "EVENT_COMPANY";
  businessName: string;
  city: string;
  monthlyVolume: string;
}) {
  return request<{ success: true }>("/api/mobile/business/details", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

// ─── Vendors ───

export function fetchVendors(params: ListingParams = {}, signal?: AbortSignal) {
  const qs = listingQueryString(params);
  return request<{ vendors: VendorSummary[]; total: number; nextCursor: string | null }>(
    `/api/mobile/vendors${qs ? `?${qs}` : ""}`,
    { signal },
  );
}

export function fetchVendor(id: string) {
  return request<{ vendor: VendorSummary }>(`/api/mobile/vendor/${id}`);
}

export function sendVendorEnquiry(input: {
  vendorId: string;
  eventType: string;
  eventCity: string;
  eventDate?: string;
  guestCount?: number;
  durationHours?: number;
  budgetMin?: number;
  budgetMax?: number;
  description: string;
}) {
  return request<{ success: true; enquiryId: string }>("/api/mobile/enquiries", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

// ─── Ask GiggFi (smart match assistant) ───

export function fetchMatch(input: {
  kind: "artist" | "vendor";
  type: string;
  eventType?: string;
  city?: string;
  budgetKey: "under-25k" | "25k-50k" | "50k-1l" | "1l-3l" | "3l-plus";
}) {
  return request<{ kind: "artist" | "vendor"; results: MatchResult[]; total: number }>("/api/mobile/match", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

// ─── Plan My Event (guided wizard match — same endpoint the website's
// /quick-booking wizard uses; no /api/mobile prefix needed, request() takes
// any path). Names come back UNMASKED — callers must run maskName() before
// display, see src/lib/format.ts. ───

export interface MatchedArtist {
  id: string;
  fullName: string | null;
  stageName: string | null;
  bio: string | null;
  performerType: string | null;
  city: string | null;
  languages: string[] | null;
  profileImageUrl: string | null;
  introVideoUrl: string | null;
  ratePerEvent: number | null;
  priceNegotiable: boolean;
  availability: boolean;
  kycStatus: string | null;
  yearsExperience: number | null;
  budgetLabel: string;
}

export function matchQuickBooking(input: {
  artistType: string;
  city?: string;
  budgetKey: "under-25k" | "25k-50k" | "50k-1l" | "1l-3l" | "3l-plus";
  gender?: "Male" | "Female";
}) {
  return request<{ artists: MatchedArtist[]; total: number; genderRelaxed?: boolean }>("/api/quick-booking/match", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export interface PlacePrediction {
  place_id: string;
  main_text: string;
  secondary_text: string;
}

export interface PlaceDetails {
  name: string;
  address: string;
  city: string;
  state: string;
  lat: number | null;
  lng: number | null;
}

export function placesAutocomplete(input: string) {
  return request<PlacePrediction[]>(`/api/places/autocomplete?input=${encodeURIComponent(input)}`);
}

export function placesDetails(placeId: string) {
  return request<PlaceDetails>(`/api/places/details?place_id=${encodeURIComponent(placeId)}`);
}

// ─── Saved artists ───

export function fetchSavedArtistIds() {
  return request<{ artistIds: string[] }>("/api/mobile/saved-artists");
}

export function fetchSavedArtists() {
  return request<{ artistIds: string[]; artists: ArtistSummary[] }>("/api/mobile/saved-artists?expand=1");
}

export function saveArtist(artistId: string) {
  return request<{ success: true }>("/api/mobile/saved-artists", {
    method: "POST",
    body: JSON.stringify({ artistId }),
  });
}

export function unsaveArtist(artistId: string) {
  return request<{ success: true }>(`/api/mobile/saved-artists?artistId=${encodeURIComponent(artistId)}`, {
    method: "DELETE",
  });
}

// ─── Notifications ───

export function fetchNotifications(params?: { cursor?: string; limit?: number }) {
  const query = new URLSearchParams();
  if (params?.cursor) query.set("cursor", params.cursor);
  if (params?.limit) query.set("limit", String(params.limit));
  const qs = query.toString();
  return request<{ notifications: NotificationItem[]; nextCursor: string | null; unreadCount: number }>(
    `/api/mobile/notifications${qs ? `?${qs}` : ""}`,
  );
}

export function markNotificationRead(id: string) {
  return request<{ success: true }>("/api/mobile/notifications", {
    method: "PATCH",
    body: JSON.stringify({ id }),
  });
}

export function markAllNotificationsRead() {
  return request<{ success: true }>("/api/mobile/notifications", {
    method: "PATCH",
    body: JSON.stringify({ all: true }),
  });
}

// ─── Notification preferences ───

export interface NotificationPreferences {
  categories: Record<NotificationCategory, boolean>;
  quietHoursStart: number;
  quietHoursEnd: number;
  marketingConsent: {
    granted: boolean;
    grantedAt: string | null;
    consentTextVersion: string | null;
  };
}

export function fetchNotificationPreferences() {
  return request<NotificationPreferences>("/api/mobile/notification-preferences");
}

export function updateNotificationPreferences(patch: {
  categories?: Partial<Record<NotificationCategory, boolean>>;
  quietHoursStart?: number;
  quietHoursEnd?: number;
  marketingConsent?: { granted: boolean; consentTextVersion: string };
}) {
  return request<{ success: true }>("/api/mobile/notification-preferences", {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
}

// ─── Bookings ───

export function fetchBookings() {
  return request<{ bookings: Booking[] }>("/api/mobile/bookings");
}

export function fetchBooking(id: string) {
  return request<{ booking: BookingDetail }>(`/api/mobile/booking/${id}`);
}

// ─── Book Again / Your Regulars ───

export interface RebookArtist {
  id: string;
  stageName: string | null;
  performerType: string | null;
  profileImageUrl: string | null;
  city: string | null;
  state?: string | null;
  // Always fetched fresh at tap-time — never the quotedPrice/totalAmount
  // frozen on the old booking. See the website route's own comment.
  currentRate: number | null;
  priceNegotiable?: boolean;
  availability?: boolean;
}

export interface RebookPrefill {
  eventType: string;
  eventCity: string;
  eventState: string | null;
  venueType: string | null;
  venueName: string | null;
  duration: number;
  audienceSize: number;
  languagePref: string[];
}

export interface RebookCheckResult {
  eligible: boolean;
  reason: string | null;
  artist: RebookArtist | null;
  prefill: RebookPrefill | null;
}

// Step 1 of Book Again — live eligibility + current rate + what to
// pre-fill, for one specific completed booking. Never creates anything;
// the actual new request still goes through sendEnquiry() -> the normal
// enquiry flow, so the artist always has to accept it again.
export function fetchRebookCheck(originalBookingId: string) {
  return request<RebookCheckResult>(`/api/mobile/booking/${originalBookingId}/rebook-check`);
}

export interface RegularArtistEntry {
  artist: RebookArtist & { eligible: boolean };
  bookingCount: number;
  lastBookingId: string;
  lastEventDate: string;
}

// "Your Regulars" — artists with 2+ completed bookings with this client in
// the last 6 months. Always a live server-computed list, never curated.
export function fetchRegulars() {
  return request<{ regulars: RegularArtistEntry[] }>("/api/mobile/bookings/regulars");
}

export interface DayAvailability {
  globallyAvailable: boolean;
  dates: Record<string, "AVAILABLE" | "PENDING" | "UNAVAILABLE">;
  bookingLockedDates: string[];
}

// Same public, unauthenticated calendar endpoint AvailabilityCalendar uses
// (GET /api/artist/[id]/availability) — reused here (not a separate
// availability rule) for the real pre-submit slot check Book Again needs:
// a specific picked date, not a whole month.
export function fetchArtistAvailability(artistId: string, from: string, to: string) {
  return request<DayAvailability>(`/api/artist/${artistId}/availability?from=${from}&to=${to}`, {}, false);
}

// ─── My Event Hub ───

export interface EventPlanSummary {
  id: string;
  eventName: string;
  eventDate: string;
  totalBudget: number | null;
}

export interface EventPlanChecklistItem {
  label: string;
  done: boolean;
  // Set when this row was added via the category picker rather than the
  // free-text field — old plans and free-text rows just omit these, which
  // is fine, not a broken/legacy state.
  kind?: "artist" | "vendor";
  category?: string;
  // Client-set planning number — separate from `spent` below, never
  // derived from a real booking.
  allocatedAmount?: number;
  // Live-computed on the server from real Bookings tagged to this plan —
  // never sent back on PATCH, never stored. Always false for vendor rows:
  // vendors have no committed/paid booking flow on this platform yet (see
  // getEventPlanDetail's comment on the website repo), so there's no real
  // signal to check — only artist rows can ever be genuinely "Booked".
  isBooked?: boolean;
}

export interface EventPlanDetail {
  id: string;
  eventName: string;
  eventDate: string;
  totalBudget: number | null;
  checklist: EventPlanChecklistItem[];
  // Always the real, live sum over tagged bookings — never editable,
  // never manually entered. See getEventPlanDetail on the website repo.
  spent: number;
  categories: { category: string; amount: number }[];
  bookings: { id: string; artistName: string; status: string; totalAmount: number | null }[];
}

export function fetchEventPlans() {
  return request<{ plans: EventPlanSummary[] }>("/api/mobile/event-plans");
}

export function createEventPlan(input: { eventName: string; eventDate: string; totalBudget?: number }) {
  return request<{ id: string }>("/api/mobile/event-plans", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function fetchEventPlan(id: string) {
  return request<{ plan: EventPlanDetail }>(`/api/mobile/event-plans/${id}`);
}

export function updateEventPlanChecklist(id: string, checklist: EventPlanChecklistItem[]) {
  return request<{ success: true }>(`/api/mobile/event-plans/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ checklist }),
  });
}

// ─── Payments (Razorpay) ───

export interface RazorpayOrder {
  orderId: string;
  amount: number;
  currency: string;
  keyId: string;
  bookingId: string;
  eventName: string;
  discountPct: number;
  firstBookingDiscount: number;
  referralRewardDiscount: number;
}

export function createRazorpayOrder(bookingId: string, couponCode?: string, termsAccepted?: boolean) {
  return request<RazorpayOrder>("/api/mobile/razorpay/order", {
    method: "POST",
    body: JSON.stringify({ bookingId, couponCode, termsAccepted }),
  });
}

export function verifyRazorpayPayment(input: {
  bookingId: string;
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}) {
  return request<{ success: true; bookingId: string }>("/api/mobile/razorpay/verify", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export interface BookingPaymentStatus {
  bookingId: string;
  bookingStatus: string;
  escrowStatus: string;
  payment: {
    status: string;
    providerStatus: string | null;
    paidAt: string | null;
    failureMessage: string | null;
  } | null;
}

// Poll target for when verifyRazorpayPayment fails after a successful
// checkout (dropped network, app backgrounded) — the webhook or the
// reconciliation cron will have already moved the booking on regardless of
// whether this call ever landed, so this just lets the UI find out.
export function fetchBookingPaymentStatus(bookingId: string) {
  return request<BookingPaymentStatus>(`/api/mobile/booking/${bookingId}/payment-status`);
}

// ─── Push notifications ───

export function registerPushToken(token: string) {
  return request<{ success: true }>("/api/mobile/push-token", {
    method: "POST",
    body: JSON.stringify({ token }),
  });
}

export function unregisterPushToken() {
  return request<{ success: true }>("/api/mobile/push-token", { method: "DELETE" });
}

// ─── Account deletion ───

export function deleteAccount() {
  return request<{ ok: true }>("/api/mobile/account/delete", { method: "POST" });
}

// No terms field — a client never accepts anything at profile-completion
// time. Terms/Privacy/Cancellation acceptance happens exactly once, as an
// explicit checkbox immediately before payment (see createRazorpayOrder),
// stamped on the Booking itself, not the profile.
export function saveBookerProfile(input: { fullName: string; email: string; city: string; state: string; companyName?: string }) {
  return request<{ success: true }>("/api/mobile/booker-profile", {
    method: "POST",
    body: JSON.stringify({
      ...input,
      bookerType: "INDIVIDUAL",
    }),
  });
}

export function sendEnquiry(input: {
  artistId: string;
  eventName?: string;
  eventType: string;
  eventDate?: string;
  eventStartTime?: string;
  eventCity: string;
  audienceSize?: number;
  duration?: number;
  specialRequests?: string;
  budgetAmount?: number;
  mode?: "ENQUIRY" | "QUICK_BOOKING";
  quotedPrice?: number;
  venueName?: string;
  venueAddress?: string;
  venueType?: string;
  languagePref?: string[];
  eventPlanId?: string;
}) {
  return request<{ success: true; bookingId: string }>("/api/mobile/bookings", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

// Mirrors the website's own booking-detail review form exactly (same
// endpoint pattern, same one-review-per-booking rule enforced server-side).
export function submitReview(bookingId: string, input: { rating: number; comment: string }) {
  return request<{ review: { id: string; rating: number; comment: string; createdAt: string } }>(
    `/api/mobile/booking/${bookingId}/review`,
    { method: "POST", body: JSON.stringify(input) },
  );
}

export function respondToBooking(id: string, action: "accept_quote" | "cancel_by_booker", reason?: string) {
  return request<{ success: true; status: string }>(`/api/mobile/booking/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ action, reason }),
  });
}

// ─── Profile ───

export function updateProfile(input: { name?: string; image?: string; email?: string; gender?: string; religion?: string; anniversary?: string }) {
  return request<{ success: true; user: SessionUser }>("/api/mobile/profile", {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

// Date of birth goes through this dedicated endpoint, not updateProfile —
// it's the one place the real under-18 block (Play Store/DPDP compliance)
// is enforced; an invalid/too-young date is deliberately rejected and
// never persisted (see the website route's own comment). Already
// mobile-ready via Bearer token, shared with the website's own age gate.
export function confirmDateOfBirth(dateOfBirth: string) {
  return request<{ success: true }>("/api/auth/confirm-dob", {
    method: "POST",
    body: JSON.stringify({ dateOfBirth }),
  });
}

// ─── Business Accounts (Organizations) ───

export type OrganizationType = "RESTAURANT" | "EVENT_COMPANY" | "CORPORATE";
export type OrganizationMemberRole = "OWNER" | "ADMIN" | "BOOKER";
export type OrganizationMemberStatus = "INVITED" | "ACTIVE" | "REMOVED";
export type NetTermsStatus = "NOT_ELIGIBLE" | "PENDING_APPROVAL" | "APPROVED";

export interface OrganizationSummary {
  id: string;
  name: string;
  type: OrganizationType;
  role: OrganizationMemberRole;
}

export interface OrganizationMemberInfo {
  id: string;
  userId: string;
  name: string | null;
  phone: string | null;
  role: OrganizationMemberRole;
  status: OrganizationMemberStatus;
  joinedAt: string | null;
}

export interface OrganizationDetail {
  id: string;
  name: string;
  type: OrganizationType;
  myRole: OrganizationMemberRole;
  canSeeBilling: boolean;
  members: OrganizationMemberInfo[];
}

export function fetchMyOrganizations() {
  return request<{ organizations: OrganizationSummary[] }>("/api/mobile/organizations");
}

export function createOrganization(input: { name: string; type: OrganizationType; gstin?: string }) {
  return request<{ organization: OrganizationSummary & { gstin: string | null; netTermsStatus: NetTermsStatus } }>(
    "/api/mobile/organizations",
    { method: "POST", body: JSON.stringify(input) },
  );
}

export function fetchOrganization(id: string) {
  return request<{ organization: OrganizationDetail }>(`/api/mobile/organizations/${id}`);
}

export function inviteOrganizationMember(organizationId: string, input: { phone: string; role: "ADMIN" | "BOOKER" }) {
  return request<{ member: { id: string; userId: string; role: OrganizationMemberRole; status: OrganizationMemberStatus } }>(
    `/api/mobile/organizations/${organizationId}/invite`,
    { method: "POST", body: JSON.stringify(input) },
  );
}

export interface OrganizationInvite {
  memberId: string;
  organizationId: string;
  organizationName: string;
  organizationType: OrganizationType;
  role: OrganizationMemberRole;
  invitedAt: string;
}

export function fetchMyOrganizationInvites() {
  return request<{ invites: OrganizationInvite[] }>("/api/mobile/organizations/invites/mine");
}

export function acceptOrganizationInvite(memberId: string) {
  return request<{ member: { id: string; organizationId: string; status: OrganizationMemberStatus } }>(
    `/api/mobile/organizations/invites/${memberId}/accept`,
    { method: "POST" },
  );
}

export interface OrganizationBilling {
  id: string;
  gstin: string | null;
  billingContactName: string | null;
  billingContactEmail: string | null;
  billingContactPhone: string | null;
  netTermsStatus: NetTermsStatus;
  netTermsApprovedAt: string | null;
}

export function fetchOrganizationBilling(organizationId: string) {
  return request<{ billing: OrganizationBilling }>(`/api/mobile/organizations/${organizationId}/billing`);
}

// ─── Get a Quote (RFP) ───
// One event, one or more independently-quotable performer needs — build a
// request once instead of enquiring artist-by-artist. Distinct from
// sendEnquiry() above, which stays the single-artist flow, unchanged.

export type QuoteRequestStatus = "OPEN" | "PARTIALLY_FULFILLED" | "FULFILLED" | "EXPIRED" | "CANCELLED";
export type QuoteLineItemStatus = "OPEN" | "WIDENED" | "FULFILLED" | "EXPIRED";
export type QuoteResponseStatus = "PENDING" | "ACCEPTED" | "DECLINED" | "EXPIRED";

// Same category vocabulary the backend matches against
// (lib/enquiry-categories.ts) — keep in sync with that file.
export const QUOTE_CATEGORIES = [
  "Singer",
  "Live Band",
  "DJ",
  "Comedian / Stand-Up",
  "Anchor / Emcee",
  "Dancer",
  "Instrumentalist",
  "Magician",
  "Photo / Video",
  "Celebrity",
  "Other",
] as const;

export interface QuoteRequestLineItemInput {
  category: string;
  genre?: string;
  quantity?: number;
  notes?: string;
}

export interface QuoteRequestLineItemSummary {
  id: string;
  quoteRequestId: string;
  category: string;
  genre: string | null;
  quantity: number;
  notes: string | null;
  status: QuoteLineItemStatus;
  widenedAt: string | null;
  widenedReason: string | null;
  createdAt: string;
  _count: { responses: number };
}

export interface QuoteRequestListItem {
  id: string;
  eventName: string;
  eventType: string;
  eventDate: string;
  eventCity: string;
  budgetMin: number | null;
  budgetMax: number | null;
  status: QuoteRequestStatus;
  responseDeadline: string;
  createdAt: string;
  lineItems: QuoteRequestLineItemSummary[];
}

export interface QuoteResponseWithArtist {
  id: string;
  lineItemId: string;
  quotedPrice: number;
  message: string | null;
  status: QuoteResponseStatus;
  bookingId: string | null;
  createdAt: string;
  artist: { id: string; stageName: string | null; fullName: string | null; profileImageUrl: string | null };
}

export interface QuoteRequestLineItemDetail {
  id: string;
  category: string;
  genre: string | null;
  quantity: number;
  notes: string | null;
  status: QuoteLineItemStatus;
  widenedAt: string | null;
  widenedReason: string | null;
  responses: QuoteResponseWithArtist[];
}

export interface QuoteRequestBookingSummary {
  id: string;
  status: string;
  totalAmount: number | null;
  invoiceUrl: string | null;
  invoiceNumber: string | null;
  quoteResponse: { lineItemId: string } | null;
}

export interface QuoteRequestDetail {
  id: string;
  eventName: string;
  eventType: string;
  eventDate: string;
  eventCity: string;
  budgetMin: number | null;
  budgetMax: number | null;
  status: QuoteRequestStatus;
  responseDeadline: string;
  createdAt: string;
  lineItems: QuoteRequestLineItemDetail[];
  bookings: QuoteRequestBookingSummary[];
}

export interface QuoteBillingSummary {
  totalAmount: number;
  bookingsCount: number;
  allPaid: boolean;
}

export function fetchMyQuoteRequests() {
  return request<{ quoteRequests: QuoteRequestListItem[] }>("/api/mobile/quote-requests");
}

export function createQuoteRequest(input: {
  eventName: string;
  eventType: string;
  eventDate: string;
  eventCity: string;
  budgetMin?: number;
  budgetMax?: number;
  organizationId?: string;
  lineItems: QuoteRequestLineItemInput[];
}) {
  return request<{ success: true; quoteRequest: { id: string } }>("/api/mobile/quote-requests", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function fetchQuoteRequest(id: string) {
  return request<{ quoteRequest: QuoteRequestDetail; billingSummary: QuoteBillingSummary }>(
    `/api/mobile/quote-requests/${id}`,
  );
}

export function acceptQuoteResponse(responseId: string) {
  return request<{ success: true; bookingId: string }>(`/api/mobile/quote-requests/responses/${responseId}/accept`, {
    method: "POST",
  });
}

export interface BookerProfile {
  id: string;
  fullName: string;
  email: string;
  companyName: string | null;
  bookerType: "INDIVIDUAL" | "CORPORATE" | "PLANNER" | "AGENCY";
  city: string | null;
  state: string | null;
  kycVerified: boolean;
}

export function fetchMyProfile() {
  return request<{ bookerProfile: BookerProfile | null }>("/api/mobile/profile");
}

export async function uploadProfilePhoto(uri: string, mimeType: string): Promise<{ url: string }> {
  const token = await getStoredToken();
  const filename = uri.split("/").pop() ?? "photo.jpg";
  const formData = new FormData();
  formData.append("file", { uri, name: filename, type: mimeType } as unknown as Blob);

  const response = await fetch(`${API_BASE_URL}/api/mobile/upload`, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    body: formData,
  });

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new ApiError(response.status, body.error ?? "Could not upload photo.");
  }
  return body as { url: string };
}
