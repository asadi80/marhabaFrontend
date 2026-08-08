export type Lang = "en" | "ar";

export interface Content {
  heroBadge: string;
  heroTitle1: string;
  heroTitle2: string;
  heroTitle3: string;
  heroSubtitle: string;
  createAccount: string;
  signIn: string;
  dashboard: string;
  verifiedHosts: string;
  securePayments: string;
  support247: string;
  whoAreYou: string;
  choosePath: string;
  traveler: string;
  travelerTagline: string;
  travelerDesc: string;
  travelerPerk1: string;
  travelerPerk2: string;
  travelerPerk3: string;
  travelerPerk4: string;
  host: string;
  hostTagline: string;
  hostDesc: string;
  hostPerk1: string;
  hostPerk2: string;
  hostPerk3: string;
  hostPerk4: string;
  getStartedAs: string;
  ready: string;
  ctaTitle: string;
  ctaDesc: string;
  footerDesc: string;
  travelersHeading: string;
  howToBook: string;
  paymentMethods: string;
  travelTips: string;
  hostsHeading: string;
  startHosting: string;
  hostResources: string;
  pricingTips: string;
  supportHeading: string;
  helpCenter: string;
  safetyInfo: string;
  contactUs: string;
  rights: string;
  privacy: string;
  terms: string;
  happyTravelers: string;
  activeHosts: string;
  bookingsMade: string;
  listingMade: string;
}

export interface NavLink {
  id: string;
  label: string;
  href: string;
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
}

export interface AppUser {
  id: string;
  name: string;
  email: string;
  role: "user" | "host" | "admin" | "super_admin";
  status?: string;
  phone_number?: string;
  email_verified?: boolean;
  createdAt?: string;
  userType?: string;
  [key: string]: unknown;
}

export interface Booking {
  id: string;
  listing_id: string;
  user_id: string;
  check_in: string | Date;
  check_out: string | Date;
  total_price: number;
  guests: number;
  status: "pending" | "confirmed" | "checked_in" | "checked_out" | "cancelled" | "no_show";
  listing?: Listing;
  user?: AppUser;
  created_at?: string;
  updated_at?: string;
  checked_in_at?: string | Date;
  checked_out_at?: string | Date;
  no_show?: boolean;
}

export interface Coordinates {
  lat: number;
  lng: number;
}

export interface Location {
  lat: number;
  lng: number;
  address?: string;
  city?: string;
  country?: string;
}

// ─── API Response Types ──────────────────────────────────────────────────────

export interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
  errors?: Array<{
    field: string;
    message: string;
    value?: any;
  }>;
}

export interface AuthResponse {
  user: AppUser;
  tokens: {
    accessToken: string;
    refreshToken: string;
  };
}

export interface ListingsResponse {
  listings: Listing[];
  total?: number;
  page?: number;
  limit?: number;
  totalPages?: number;
}

export interface BookingsResponse {
  bookings: Booking[];
  total?: number;
  page?: number;
  limit?: number;
  totalPages?: number;
}

// ─── Component Props Types ──────────────────────────────────────────────────

export interface NavbarProps {
  NAV_LINKS: NavLink[];
  user: AppUser | null;
  lang: Lang;
  toggleLanguage: () => void;
  onTabChange?: (tabId: string) => void;
}

export interface GoogleMapProps {
  userLocation: Coordinates | null;
  listings: Listing[];
  onDirections: (listing: Listing) => void;
  isAr: boolean;
}

export interface ListingCardProps {
  listing: Listing;
  userLocation?: Coordinates | null;
  onOpenMaps?: (listing: Listing) => void;
  onGetDirections?: (listing: Listing) => void;
  isAr?: boolean;
}