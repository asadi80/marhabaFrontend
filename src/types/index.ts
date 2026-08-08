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
}

export interface AppUser {
  name?: string;
  role?: "user" | "host" | string;
  [key: string]: unknown;
}
