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
  bio: string | null;
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

export interface NotificationItem {
  id: string;
  title: string;
  body: string;
  type: string;
  read: boolean;
  actionUrl: string | null;
  createdAt: string;
}

export interface Booking {
  id: string;
  eventName: string;
  eventType: string;
  eventDate: string;
  eventCity: string;
  status: string;
  totalAmount: number | null;
  artist?: { stageName: string | null; fullName: string | null; performerType: string | null; profileImageUrl: string | null; city: string | null };
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
}

export interface BookingMessage {
  id: string;
  actor: "ARTIST" | "BOOKER" | "ADMIN" | "SYSTEM";
  body: string;
  createdAt: string;
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

export function fetchNotifications() {
  return request<{ notifications: NotificationItem[]; unreadCount: number }>("/api/mobile/notifications");
}

export function markNotificationRead(id: string) {
  return request<{ success: true }>("/api/mobile/notifications", {
    method: "PATCH",
    body: JSON.stringify({ id }),
  });
}

// ─── Bookings ───

export function fetchBookings() {
  return request<{ bookings: Booking[] }>("/api/mobile/bookings");
}

export function fetchBooking(id: string) {
  return request<{ booking: BookingDetail }>(`/api/mobile/booking/${id}`);
}

export function fetchBookingMessages(id: string) {
  return request<{ messages: BookingMessage[]; viewerActor: string }>(`/api/mobile/booking/${id}/messages`);
}

export function sendBookingMessage(id: string, body: string) {
  return request<{ message: BookingMessage }>(`/api/mobile/booking/${id}/messages`, {
    method: "POST",
    body: JSON.stringify({ body }),
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

export function sendEnquiry(input: {
  artistId: string;
  eventName?: string;
  eventType: string;
  eventDate?: string;
  eventCity: string;
  audienceSize?: number;
  duration?: number;
  specialRequests?: string;
}) {
  return request<{ success: true; bookingId: string }>("/api/mobile/bookings", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

// ─── Profile ───

export function updateProfile(input: { name?: string; image?: string }) {
  return request<{ success: true; user: SessionUser }>("/api/mobile/profile", {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}
