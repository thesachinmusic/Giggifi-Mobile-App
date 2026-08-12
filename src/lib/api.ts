import { getStoredToken } from "./auth-storage";

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? "https://giggifi.com";

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, options: RequestInit = {}, withAuth = true): Promise<T> {
  const token = withAuth ? await getStoredToken() : null;

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
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

export function fetchArtists(params: { category?: string; city?: string; search?: string; sort?: "recommended" | "trending" | "rating" } = {}) {
  const query = new URLSearchParams();
  if (params.category && params.category !== "All") query.set("category", params.category);
  if (params.city) query.set("city", params.city);
  if (params.search) query.set("search", params.search);
  if (params.sort) query.set("sort", params.sort);
  const qs = query.toString();
  return request<{ artists: ArtistSummary[]; total: number }>(`/api/mobile/artists${qs ? `?${qs}` : ""}`);
}

export function fetchArtist(id: string) {
  return request<{ artist: ArtistSummary }>(`/api/mobile/artist/${id}`);
}

export function fetchFeatured() {
  return request<{ artists: ArtistSummary[]; total: number }>("/api/mobile/featured");
}

// ─── Vendors ───

export function fetchVendors(params: { category?: string; city?: string; search?: string; sort?: "recommended" | "rating" } = {}) {
  const query = new URLSearchParams();
  if (params.category && params.category !== "All") query.set("category", params.category);
  if (params.city) query.set("city", params.city);
  if (params.search) query.set("search", params.search);
  if (params.sort) query.set("sort", params.sort);
  const qs = query.toString();
  return request<{ vendors: VendorSummary[]; total: number }>(`/api/mobile/vendors${qs ? `?${qs}` : ""}`);
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

// ─── Saved artists ───

export function fetchSavedArtistIds() {
  return request<{ artistIds: string[] }>("/api/mobile/saved-artists");
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
  eventCity: string;
  audienceSize?: number;
  duration?: number;
  specialRequests?: string;
  budgetAmount?: number;
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
