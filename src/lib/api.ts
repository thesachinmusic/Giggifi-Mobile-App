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
  const token = withAuth ? await getStoredToken() : null;

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
  } finally {
    clearTimeout(timeout);
    externalSignal?.removeEventListener("abort", onExternalAbort);
  }

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    // A real 401 on an authenticated request means the token itself is
    // dead — every screen would otherwise show its own generic error while
    // silently stuck logged-in-but-broken. sendOtp/verifyOtp (withAuth:
    // false) are excluded since a wrong OTP isn't a session expiring.
    if (response.status === 401 && withAuth) {
      await clearStoredToken();
      emitSessionExpired();
      showToast({ title: "Session expired", body: "Please sign in again.", category: "SECURITY" });
      router.replace("/(auth)/login");
    }
    throw new ApiError(response.status, body.error ?? "Something went wrong.");
  }
  return body as T;
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
}

export interface ReviewSummary {
  rating: number;
  comment: string;
  eventType: string | null;
  createdAt: string;
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
  viewerRole: "ARTIST" | "BOOKER";
  artist: { id: string; name: string | null; performerType: string | null; profileImageUrl: string | null; city: string | null };
  booker: { id: string; name: string | null; city: string | null };
  payment: { status: string; amount: number; platformFee: number; paidAt: string | null; releasedAt: string | null } | null;
  // Quick Moments — format is "FULL_GIG" for every booking except these.
  format: "FULL_GIG" | "QUICK_MOMENT";
  quickMomentFormat: QuickMomentFormat | null;
  requestedWindowStart: string | null;
  enRouteAt: string | null;
  arrivedAt: string | null;
  completedAt: string | null;
  // Only ever populated for the booker (viewerRole === "BOOKER") — the
  // website never sends these to the artist side, see the API route comment.
  arrivalOtpCode: string | null;
  completionOtpCode: string | null;
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
}

export function fetchQuickMomentsMatch(params: { lat: number; lng: number; budgetMax?: number; slotStartTime?: string }) {
  const query = new URLSearchParams();
  query.set("lat", String(params.lat));
  query.set("lng", String(params.lng));
  if (params.budgetMax) query.set("budgetMax", String(params.budgetMax));
  if (params.slotStartTime) query.set("slotStartTime", params.slotStartTime);
  return request<{ results: QuickMomentMatch[]; total: number }>(`/api/mobile/quick-moments/match?${query.toString()}`);
}

export function bookQuickMoment(input: {
  artistId: string;
  quickMomentFormat: QuickMomentFormat;
  slotStartTime: string;
  venueAddress: string;
  eventCity: string;
  specialRequests?: string;
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

export function fetchArtist(id: string) {
  return request<{ artist: ArtistSummary }>(`/api/mobile/artist/${id}`);
}

export function fetchFeatured() {
  return request<{ artists: ArtistSummary[]; total: number }>("/api/mobile/featured");
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

// ─── Announcements ───
// Backend endpoint ships in a later phase (admin console). Until then this
// 404s and callers treat that identically to "no announcements" — see
// src/components/AnnouncementBanner.tsx.

export interface Announcement {
  id: string;
  title: string;
  body: string;
  imageUrl: string | null;
  actionUrl: string | null;
}

export function fetchAnnouncements() {
  return request<{ announcements: Announcement[] }>("/api/mobile/announcements");
}

// ─── Bookings ───

export function fetchBookings() {
  return request<{ bookings: Booking[] }>("/api/mobile/bookings");
}

export function fetchBooking(id: string) {
  return request<{ booking: BookingDetail }>(`/api/mobile/booking/${id}`);
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
}

export function createRazorpayOrder(bookingId: string, couponCode?: string) {
  return request<RazorpayOrder>("/api/mobile/razorpay/order", {
    method: "POST",
    body: JSON.stringify({ bookingId, couponCode }),
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

export function saveBookerProfile(input: { fullName: string; email: string; city: string; state: string; companyName?: string }) {
  return request<{ success: true }>("/api/mobile/booker-profile", {
    method: "POST",
    body: JSON.stringify({
      ...input,
      bookerType: "INDIVIDUAL",
      terms: { service: true, escrow: true },
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
  languagePref?: string[];
}) {
  return request<{ success: true; bookingId: string }>("/api/mobile/bookings", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function respondToBooking(id: string, action: "accept_quote" | "cancel_by_booker", reason?: string) {
  return request<{ success: true; status: string }>(`/api/mobile/booking/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ action, reason }),
  });
}

// ─── Profile ───

export function updateProfile(input: { name?: string; image?: string }) {
  return request<{ success: true; user: SessionUser }>("/api/mobile/profile", {
    method: "PATCH",
    body: JSON.stringify(input),
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
