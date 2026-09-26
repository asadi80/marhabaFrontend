// src/types/index.ts

export type Lang = "en" | "ar";

// ─────────────────────────────────────────────────────────────
// Content
// ─────────────────────────────────────────────────────────────

export interface Content {
  id?: string;
  key?: string;
  title?: string;
  description?: string;
  content?: string;
  image?: string;
  created_at?: string;
  updated_at?: string;
}

// ─────────────────────────────────────────────────────────────
// Navigation
// ─────────────────────────────────────────────────────────────

export interface NavLink {
  id: string;
  label: string;
  href: string;
}

// ─────────────────────────────────────────────────────────────
// Listing
// ─────────────────────────────────────────────────────────────

export interface BlockedDateRange {
  id?: string;
  startDate: string;
  endDate: string;
  reason?: string;
}

export interface Listing {
  id: string | number;

  title?: string;
  description?: string;

  price?: number | string;

  location?: string;

  category?: string;
  type?: string;
  propertyType?: string;

  tags?: string[];

  images?: string[];

  distance?: number;

  coordinates?: {
    lat: number;
    lng: number;
  };

  is_active?: boolean;
  status?: string;

  host_id?: string;

  created_at?: string;
  updated_at?: string;

  blocked_dates?: BlockedDateRange[];
}

// ─────────────────────────────────────────────────────────────
// User
// ─────────────────────────────────────────────────────────────

export interface AppUser {
  id: string;

  name: string;
  email: string;

  phone_number?: string;

  role?: "user" | "host" | "admin" | "super_admin" | string;

  status?: string;

  status_reason?: string | null;

  host_expiry_date?: string | null;

  email_verified?: boolean;

  created_at?: string;
  createdAt?: string;

  updated_at?: string;
}

// ─────────────────────────────────────────────────────────────
// Booking Status
// ─────────────────────────────────────────────────────────────

export type BookingStatus =
  | "pending"
  | "confirmed"
  | "checked_in"
  | "checked_out"
  | "cancelled"
  | "no_show";

// ─────────────────────────────────────────────────────────────
// Booking
// ─────────────────────────────────────────────────────────────

export interface Booking {
  id: string;

  listing_id: string;

  user_id: string;

  check_in: string | Date;

  check_out: string | Date;

  /**
   * Optional formatted dates returned by the API.
   *
   * Example:
   * "Aug 27, 2026"
   */
  check_in_display?: string;

  check_out_display?: string;

  total_price: number;

  guests: number;

  status: BookingStatus;

  listing?: Listing;

  user?: AppUser;

  created_at?: string;

  updated_at?: string;

  checked_in_at?: string | Date | null;

  checked_out_at?: string | Date | null;

  no_show?: boolean | null;
}

// ─────────────────────────────────────────────────────────────
// Coordinates
// ─────────────────────────────────────────────────────────────

export interface Coordinates {
  lat: number;
  lng: number;
}

// ─────────────────────────────────────────────────────────────
// Location
// ─────────────────────────────────────────────────────────────

export interface Location {
  lat: number;
  lng: number;

  address?: string;
  city?: string;
  country?: string;
}

// ─────────────────────────────────────────────────────────────
// API Response
// ─────────────────────────────────────────────────────────────

export interface ApiResponse<T = any> {
  success?: boolean;

  message?: string;

  data?: T;

  error?: string;

  [key: string]: any;
}

// ─────────────────────────────────────────────────────────────
// Auth Response
// ─────────────────────────────────────────────────────────────

export interface AuthResponse {
  success?: boolean;

  message?: string;

  token?: string;

  accessToken?: string;

  refreshToken?: string;

  user?: AppUser;

  data?: {
    token?: string;
    accessToken?: string;
    refreshToken?: string;
    user?: AppUser;
  };
}

// ─────────────────────────────────────────────────────────────
// Listings Response
// ─────────────────────────────────────────────────────────────

export interface ListingsResponse {
  success?: boolean;

  listings: Listing[];

  total?: number;

  page?: number;

  limit?: number;

  pages?: number;
}

// ─────────────────────────────────────────────────────────────
// Bookings Response
// ─────────────────────────────────────────────────────────────

export interface BookingsResponse {
  success?: boolean;

  bookings: Booking[];

  total?: number;

  page?: number;

  limit?: number;

  pages?: number;
}