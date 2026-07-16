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

export function fetchArtists(params: { category?: string; city?: string; search?: string } = {}) {
  const query = new URLSearchParams();
  if (params.category && params.category !== "All") query.set("category", params.category);
  if (params.city) query.set("city", params.city);
  if (params.search) query.set("search", params.search);
  const qs = query.toString();
  return request<{ artists: ArtistSummary[]; total: number }>(`/api/mobile/artists${qs ? `?${qs}` : ""}`);
}

export function fetchArtist(id: string) {
  return request<{ artist: ArtistSummary }>(`/api/mobile/artist/${id}`);
}

// ─── Bookings ───

export function fetchBookings() {
  return request<{ bookings: Booking[] }>("/api/mobile/bookings");
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
