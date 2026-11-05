// src/pages/User-dashboard/index.tsx

import React, { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { useAuth } from "../../context/AuthContext";
import { useLanguage } from "../../hooks/useLanguage";
import Navbar from "../../components/Navbar";
import ListingsMap from "../../components/ListingsMap";
import { apiService } from "../../services/api";

/* ==========================================================================
   CONSTANTS
========================================================================== */

const API_BASE =
  import.meta.env.VITE_API_URL || "https://api.mar-haba.ly/api/v1";

const USER_ROLE = "user";

const RADIUS_OPTIONS = [5, 10, 20, 50, 100];

/* ==========================================================================
   TYPES
========================================================================== */

interface Listing {
  id: string;
  title: string;
  location: string;
  price: number;
  images?: string[];
  coordinates?: { lat: number; lng: number };
  is_active: boolean;
  latitude?: string | number;
  longitude?: string | number;
}

type BookingStatus =
  | "confirmed"
  | "pending"
  | "cancelled"
  | "checked_in"
  | "checked_out";
interface Booking {
  id: string;
  listing_id: string;
  listing?: Listing;
  check_in: string;
  check_out: string;
  guests: number;
  total_price: number;
  status: BookingStatus;
  created_at?: string;
  createdAt?: string;
}

interface Coords {
  lat: number;
  lng: number;
}

/* ==========================================================================
   STATIC DATA
========================================================================== */

const AVATAR_PALETTE = [
  { bg: "#EEEDFE", c: "#3C3489" },
  { bg: "#E6F1FB", c: "#0C447C" },
  { bg: "#EAF3DE", c: "#27500A" },
  { bg: "#FAEEDA", c: "#633806" },
  { bg: "#E1F5EE", c: "#085041" },
  { bg: "#FBEAF0", c: "#72243E" },
];

const STATUS_STYLES: Record<
  BookingStatus,
  { bg: string; c: string; label: [string, string] }
> = {
  confirmed: { bg: "#EAF3DE", c: "#27500A", label: ["confirmed", "مؤكد"] },
  pending: { bg: "#FAEEDA", c: "#633806", label: ["pending", "قيد الانتظار"] },
  cancelled: { bg: "#FCEBEB", c: "#791F1F", label: ["cancelled", "ملغي"] },
};

/* ==========================================================================
   HELPERS
========================================================================== */

const toRole = (role?: string) => String(role || "").toLowerCase();

const nightsBetween = (checkIn: string, checkOut: string) =>
  Math.ceil(
    (new Date(checkOut).getTime() - new Date(checkIn).getTime()) / 86400000,
  );

const haversineDistanceKm = (
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
) => {
  const EARTH_RADIUS_KM = 6371;

  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;

  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const getAvatarColors = (name: string) =>
  AVATAR_PALETTE[(name?.charCodeAt(0) ?? 0) % AVATAR_PALETTE.length];

const getInitials = (name: string) =>
  name
    ?.split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() ?? "";

const getStatusStyle = (status: BookingStatus) =>
  STATUS_STYLES[status] ?? {
    bg: "#F1EFE8",
    c: "#444",
    label: [status, status] as [string, string],
  };

/**
 * Normalize whatever shape the listings API returns into a plain array.
 * Handles: [ ... ], { data: [...] }, { data: { listings: [...] } }, { listings: [...] }
 */
const extractListingsArray = (payload: any): any[] => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data?.listings)) return payload.data.listings;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.listings)) return payload.listings;
  return [];
};

/** Normalize whatever shape the bookings API returns into a plain array. */
const extractBookingsArray = (payload: any): Booking[] => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data?.bookings)) return payload.data.bookings;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.bookings)) return payload.bookings;
  return [];
};

const getIPGeolocation = async (): Promise<Coords | null> => {
  try {
    const res = await fetch("https://ipapi.co/json/");
    if (!res.ok) return null;

    const data = await res.json();

    if (data?.latitude !== undefined && data?.longitude !== undefined) {
      const lat = Number(data.latitude);
      const lng = Number(data.longitude);
      if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng };
    }
  } catch {
    /* ignore network/parse errors */
  }

  return null;
};

const Skeleton = ({ className = "" }: { className?: string }) => (
  <div className={`animate-pulse rounded-lg bg-gray-200/80 ${className}`} />
);

const Spinner = () => (
  <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
);

const PinIcon = ({ size = 14 }: { size?: number }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="currentColor"
    className="shrink-0"
  >
    <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" />
    <circle cx="12" cy="9" r="3" fill="white" />
  </svg>
);

/* ==========================================================================
   COMPONENT
========================================================================== */

export default function UserDashboard() {
  const navigate = useNavigate();

  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const { lang, toggleLanguage } = useLanguage();

  const isAr = lang === "ar";
  const t = (en: string, ar: string) => (isAr ? ar : en);

  const [listings, setListings] = useState<Listing[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);

  const [listingsLoading, setListingsLoading] = useState(true);
  const [bookingsLoading, setBookingsLoading] = useState(true);

  const [userLocation, setUserLocation] = useState<Coords | null>(null);
  const [locationResolved, setLocationResolved] = useState(false);

  const [searchRadius, setSearchRadius] = useState(10);
  const [activeTab, setActiveTab] = useState("nearby");
  const [activeMarkerId, setActiveMarkerId] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const notify = useCallback(
    (msg: string, ok = true) => setToast({ msg, ok }),
    [],
  );

  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(null), 3200);
    return () => window.clearTimeout(id);
  }, [toast]);

  const isAuthorizedUser =
    isAuthenticated && !!user && toRole((user as any).role) === USER_ROLE;

  /* ------------------------- Formatting helpers ------------------------- */

  const formatDate = (value?: string) => {
    if (!value) return "—";

    const datePart = value.slice(0, 10);
    const [year, month, day] = datePart.split("-").map(Number);

    if (!year || !month || !day) return value;

    return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString(
      isAr ? "ar-LY" : "en-US",
      {
        year: "numeric",
        month: "long",
        day: "numeric",
        timeZone: "UTC",
      },
    );
  };

  const formatPrice = (value: number | string) => {
    const amount = Number(value);
    if (!Number.isFinite(amount)) return "0";

    return new Intl.NumberFormat(isAr ? "ar-LY" : "en-US", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  /* ------------------------- Auth + role guard -------------------------- */

  useEffect(() => {
    if (authLoading) return;

    if (!isAuthenticated || !user) {
      navigate("/login", { replace: true });
      return;
    }

    const role = toRole((user as any).role);

    if (role !== USER_ROLE) {
      navigate(role === "host" ? "/host-dashboard" : "/login", {
        replace: true,
      });
    }
  }, [authLoading, isAuthenticated, user, navigate]);

  /* ------------------------- Resolve user location ---------------------- */

  const resolveUserLocation = async () => {
    // 1. Browser GPS
    if ("geolocation" in navigator) {
      try {
        const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 60000,
          }),
        );

        setUserLocation({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        });
        setLocationResolved(true);
        return;
      } catch {
        /* GPS unavailable or denied: continue to IP lookup */
      }
    }

    // 2. IP-based geolocation
    const ipLocation = await getIPGeolocation();

    if (ipLocation) {
      setUserLocation(ipLocation);
      setLocationResolved(true);
      return;
    }

    // 3. No location available: stop the loading state so the page doesn't wait forever
    setUserLocation(null);
    setListingsLoading(false);
    setLocationResolved(true);
  };

  /* ---------------------------- Fetch bookings -------------------------- */

  const fetchBookings = async () => {
    try {
      // Bookings are user-specific, so this is a protected call
      const response =
        await apiService.getProtectedData<any>("/api/v1/bookings");

      if (!response.success || !response.data) {
        console.error("Failed to fetch bookings:", response.message);
        return;
      }

      setBookings(extractBookingsArray(response.data));
    } catch (error) {
      console.error("Error fetching bookings:", error);
    } finally {
      setBookingsLoading(false);
    }
  };

  /* --------------------------- Fetch listings --------------------------- */

  // The backend decides which listings are inside the radius (no client-side filtering).
  // Example: /listings/nearby?lat=32.88&lng=13.19&radius=10&limit=100
  const fetchListings = async (location: Coords, radius: number) => {
    setListingsLoading(true);

    try {
      const params = new URLSearchParams({
        lat: String(location.lat),
        lng: String(location.lng),
        radius: String(radius),
        limit: "100",
      });

      const res = await fetch(
        `${API_BASE}/listings/nearby?${params.toString()}`,
      );

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const payload = await res.json();
      const rawListings = extractListingsArray(payload);

      const transformed: Listing[] = rawListings.map((item) => {
        const lat =
          item.latitude !== undefined && item.latitude !== null
            ? Number(item.latitude)
            : item.coordinates?.lat !== undefined
              ? Number(item.coordinates.lat)
              : undefined;

        const lng =
          item.longitude !== undefined && item.longitude !== null
            ? Number(item.longitude)
            : item.coordinates?.lng !== undefined
              ? Number(item.coordinates.lng)
              : undefined;

        const coords =
          lat !== undefined &&
          lng !== undefined &&
          Number.isFinite(lat) &&
          Number.isFinite(lng)
            ? { lat, lng }
            : undefined;

        return {
          id: item.id,
          title: item.title,
          location: item.location,
          price: parseFloat(item.price) || 0,
          images: item.images || [],
          is_active: item.is_active !== false,
          latitude: item.latitude,
          longitude: item.longitude,
          coordinates: coords,
        };
      });

      setListings(transformed.filter((listing) => listing.is_active !== false));
    } catch (error) {
      console.error("Error fetching nearby listings:", error);
      setListings([]);
    } finally {
      setListingsLoading(false);
    }
  };

  /* ----------------------------- Effects -------------------------------- */

  // Resolve the location and load bookings together
  useEffect(() => {
    if (!isAuthorizedUser) return;

    resolveUserLocation();
    fetchBookings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthorizedUser]);

  // Listings depend on location and radius
  useEffect(() => {
    if (!isAuthorizedUser || !userLocation) return;

    fetchListings(userLocation, searchRadius);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthorizedUser, userLocation, searchRadius]);

  /* ----------------------------- Handlers ------------------------------- */

  const retryLocation = () => {
    setLocationResolved(false);
    setListingsLoading(true);
    resolveUserLocation();
  };

  const openInMaps = (listing: Listing) => {
    if (!listing.coordinates) return;

    const { lat, lng } = listing.coordinates;
    window.open(
      `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`,
      "_blank",
    );
  };

  const getDirectionsTo = (listing: Listing) => {
    if (!userLocation) {
      notify(
        t("Enable location services first", "قم بتفعيل خدمات الموقع أولاً"),
        false,
      );
      return;
    }

    if (!listing.coordinates) return;

    const { lat: userLat, lng: userLng } = userLocation;
    const { lat: listingLat, lng: listingLng } = listing.coordinates;

    window.open(
      `https://www.google.com/maps/dir/${userLat},${userLng}/${listingLat},${listingLng}`,
      "_blank",
    );
  };

  const cancelBooking = async (id: string) => {
    if (!confirm(t("Cancel this booking?", "هل تريد إلغاء هذا الحجز؟"))) return;

    setCancellingId(id);

    try {
      const response = await apiService.putProtectedData(
        `/api/bookings/${id}`,
        { action: "cancel" },
      );

      if (response.success) {
        notify(t("Booking cancelled", "تم إلغاء الحجز"));
        await fetchBookings();
      }
    } catch (error) {
      console.error("Failed to cancel booking:", error);
      notify(
        error instanceof Error ? error.message : "Failed to cancel booking",
        false,
      );
    } finally {
      setCancellingId(null);
    }
  };

  /* ------------------------------ Guards -------------------------------- */

  // Only wait for auth. Listings and bookings never block the page.
  if (authLoading || !isAuthorizedUser) return null;

  const { bg: avatarBg, c: avatarColor } = getAvatarColors(user!.name);
  const initials = getInitials(user!.name);

  const memberSince = (user as any)?.created_at || (user as any)?.createdAt;

  // Used by the Navbar: the top links on desktop, and the bottom tab bar on phones
  const TABS = [
    { id: "nearby", label: t("Nearby Places", "الأماكن القريبة"), icon: "📍" },
    {
      id: "bookings",
      label: `${t("Bookings", "الحجوزات")}${bookingsLoading ? "" : ` (${bookings.length})`}`,
      icon: "📅",
    },
    {
      id: "listings",
      label: t("Browse Listings", "تصفح العقارات"),
      icon: "🔍",
      href: "/listings",
    },
  ];

  /* ------------------------------ Render -------------------------------- */

  return (
    <div
      className={`min-h-screen bg-gray-50 text-gray-900 ${isAr ? "font-arabic" : "font-sans"}`}
      dir={isAr ? "rtl" : "ltr"}
    >
      <Navbar
        NAV_LINKS={TABS}
        user={user}
        lang={lang}
        toggleLanguage={toggleLanguage}
        onTabChange={(tabId: string) => {
          if (tabId === "nearby" || tabId === "bookings") setActiveTab(tabId);
        }}
        defaultActiveId={activeTab}
      />

      {/* Toast */}
      {toast && (
        <div className="pointer-events-none fixed inset-x-0 top-[calc(env(safe-area-inset-top)+72px)] z-[60] flex justify-center px-4">
          <div
            className={`rounded-full px-4 py-2.5 text-sm font-medium shadow-lg ${
              toast.ok ? "bg-[#1a1a2e] text-white" : "bg-red-600 text-white"
            }`}
          >
            {toast.msg}
          </div>
        </div>
      )}

      <main className="mx-auto max-w-[1200px] px-4 pb-28 pt-4 md:p-6 md:pb-10">
        {/* ========================= Profile ========================= */}
        <div className="mb-5 flex items-center gap-3 rounded-2xl bg-white p-4 shadow-sm">
          <div
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-sm font-semibold"
            style={{ background: avatarBg, color: avatarColor }}
          >
            {initials}
          </div>

          <div className="min-w-0">
            <div className="truncate text-lg font-bold leading-tight text-gray-900">
              {user!.name}
            </div>
            {memberSince && (
              <div className="mt-0.5 text-xs text-gray-400">
                {t("Member since", "عضو منذ")} {formatDate(memberSince)}
              </div>
            )}
          </div>
        </div>

        {/* ========================= NEARBY ========================= */}
        {activeTab === "nearby" && (
          <div>
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className="text-lg font-bold text-gray-900">
                {t("Nearby places", "الأماكن القريبة")}
                {!listingsLoading && locationResolved && (
                  <span className="ms-2 text-sm font-normal text-gray-400">
                    ({listings.length})
                  </span>
                )}
              </h2>
            </div>

            {/* Radius chips */}
            <div className="-mx-4 mb-4 overflow-x-auto px-4 md:mx-0 md:px-0">
              <div className="flex items-center gap-2">
                <span className="shrink-0 text-xs font-medium uppercase tracking-wide text-gray-400">
                  {t("Radius", "نصف القطر")}
                </span>

                {RADIUS_OPTIONS.map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setSearchRadius(v)}
                    className={`shrink-0 whitespace-nowrap rounded-full px-3.5 py-2 text-sm font-medium transition active:scale-95 ${
                      searchRadius === v
                        ? "bg-[#1a1a2e] text-[#e8c547]"
                        : "bg-white text-gray-600 shadow-sm"
                    }`}
                  >
                    {v} {t("km", "كم")}
                  </button>
                ))}
              </div>
            </div>

            {/* Location unavailable */}
            {locationResolved && !userLocation && (
              <div className="mb-4 flex items-start gap-3 rounded-2xl bg-amber-50 p-4 text-sm text-amber-900">
                <span className="text-xl leading-none">📍</span>
                <div className="flex-1">
                  <p>
                    {t(
                      "We couldn't detect your location. Turn on location services to see places near you.",
                      "تعذر تحديد موقعك. فعّل خدمات الموقع لرؤية الأماكن القريبة منك.",
                    )}
                  </p>
                  <button
                    type="button"
                    onClick={retryLocation}
                    className="mt-2 rounded-lg bg-amber-100 px-3.5 py-2 text-sm font-semibold text-amber-900 active:scale-95"
                  >
                    🔄 {t("Try again", "حاول مرة أخرى")}
                  </button>
                </div>
              </div>
            )}

            {/* Map */}
            {locationResolved ? (
              <ListingsMap
                listings={listings}
                userLocation={userLocation}
                isAr={isAr}
                onSelect={(id) => {
                  setActiveMarkerId(String(id));
                  navigate(`/listings/${id}`);
                }}
                className="mb-5 h-[clamp(280px,45vw,440px)] w-full overflow-hidden rounded-2xl"
              />
            ) : (
              <Skeleton className="mb-5 h-[clamp(280px,45vw,440px)] w-full rounded-2xl" />
            )}

            {/* Listing cards */}
            {listingsLoading ? (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="overflow-hidden rounded-2xl bg-white shadow-sm"
                  >
                    <Skeleton className="h-44 w-full rounded-none" />
                    <div className="space-y-3 p-4">
                      <Skeleton className="h-5 w-3/4" />
                      <Skeleton className="h-4 w-1/2" />
                      <Skeleton className="h-7 w-1/3" />
                      <Skeleton className="h-11 w-full rounded-xl" />
                    </div>
                  </div>
                ))}
              </div>
            ) : listings.length > 0 ? (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {listings.map((listing) => {
                  const distanceKm =
                    userLocation && listing.coordinates
                      ? haversineDistanceKm(
                          userLocation.lat,
                          userLocation.lng,
                          listing.coordinates.lat,
                          listing.coordinates.lng,
                        ).toFixed(1)
                      : null;

                  return (
                    <article
                      key={listing.id}
                      className={`overflow-hidden rounded-2xl bg-white shadow-sm transition ${
                        activeMarkerId === listing.id
                          ? "ring-2 ring-[#e8c547]"
                          : ""
                      }`}
                    >
                      <div className="relative h-44 overflow-hidden bg-gray-100">
                        <img
                          src={listing.images?.[0] || "/placeholder.jpg"}
                          alt={listing.title}
                          className="h-full w-full object-cover"
                          onError={(e) => {
                            e.currentTarget.src = "/placeholder.jpg";
                          }}
                        />

                        {distanceKm && (
                          <span className="absolute end-3 top-3 rounded-full bg-[#1a1a2e]/90 px-2.5 py-1 text-[11px] font-medium text-[#e8c547]">
                            {distanceKm} {t("km", "كم")}
                          </span>
                        )}
                      </div>

                      <div className="p-4">
                        <h3 className="truncate text-base font-semibold text-gray-900">
                          {listing.title}
                        </h3>

                        <p className="mt-1 flex items-center gap-1 text-sm text-gray-400">
                          <span className="text-[#e8c547]">
                            <PinIcon size={12} />
                          </span>
                          <span className="truncate">{listing.location}</span>
                        </p>

                        <p className="mt-2 text-xl font-bold text-[#1a1a2e]">
                          {formatPrice(listing.price)} {t("LYD", "دينار")}
                          <span className="text-sm font-normal text-gray-500">
                            {" "}
                            / {t("night", "ليلة")}
                          </span>
                        </p>

                        <Link
                          to={`/listings/${listing.id}`}
                          className="mt-3 flex min-h-[44px] w-full items-center justify-center rounded-xl bg-[#1a1a2e] text-sm font-semibold text-[#e8c547] no-underline active:scale-[0.98]"
                        >
                          {t("View details", "عرض التفاصيل")} →
                        </Link>

                        {listing.coordinates && (
                          <div className="mt-2 flex gap-2">
                            <button
                              onClick={() => openInMaps(listing)}
                              className="flex min-h-[44px] flex-1 items-center justify-center gap-1.5 rounded-xl bg-emerald-50 text-sm font-semibold text-emerald-700 active:scale-[0.98]"
                            >
                              <PinIcon /> {t("View on map", "عرض على الخريطة")}
                            </button>

                            <button
                              onClick={() => getDirectionsTo(listing)}
                              className="flex min-h-[44px] flex-1 items-center justify-center gap-1.5 rounded-xl bg-gray-100 text-sm font-semibold text-gray-700 active:scale-[0.98]"
                            >
                              🧭 {t("Directions", "اتجاهات")}
                            </button>
                          </div>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : (
              locationResolved &&
              userLocation && (
                <div className="rounded-2xl bg-white p-10 text-center shadow-sm">
                  <div className="mb-2 text-4xl">🧭</div>
                  <p className="text-lg font-bold text-gray-700">
                    {t("Nothing nearby", "لا توجد أماكن قريبة")}
                  </p>
                  <p className="mb-4 mt-1 text-sm text-gray-400">
                    {isAr
                      ? `لا توجد أماكن ضمن ${searchRadius} كم`
                      : `No places within ${searchRadius} km`}
                  </p>

                  <button
                    onClick={() => setSearchRadius(50)}
                    className="min-h-[44px] rounded-xl bg-[#1a1a2e] px-5 text-sm font-semibold text-[#e8c547] active:scale-95"
                  >
                    {t("Expand to 50 km", "توسيع إلى 50 كم")} →
                  </button>
                </div>
              )
            )}
          </div>
        )}

        {/* ========================= BOOKINGS ========================= */}
        {activeTab === "bookings" && (
          <div>
            <h2 className="mb-3 text-lg font-bold text-gray-900">
              {t("My bookings", "حجوزاتي")}
            </h2>

            {bookingsLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="space-y-3 rounded-2xl bg-white p-4 shadow-sm"
                  >
                    <div className="flex justify-between gap-4">
                      <Skeleton className="h-5 w-1/2" />
                      <Skeleton className="h-5 w-20 rounded-full" />
                    </div>
                    <Skeleton className="h-4 w-1/3" />
                    <div className="grid grid-cols-2 gap-3">
                      <Skeleton className="h-9" />
                      <Skeleton className="h-9" />
                      <Skeleton className="h-9" />
                      <Skeleton className="h-9" />
                    </div>
                    <Skeleton className="h-11 w-full rounded-xl" />
                  </div>
                ))}
              </div>
            ) : bookings.length === 0 ? (
              <div className="rounded-2xl bg-white p-10 text-center shadow-sm">
                <div className="mb-2 text-4xl">📅</div>
                <p className="text-lg font-bold text-gray-700">
                  {t("No bookings yet", "لا توجد حجوزات بعد")}
                </p>
                <p className="mb-4 mt-1 text-sm text-gray-400">
                  {t(
                    "Discover amazing places to stay",
                    "اكتشف أماكن رائعة للإقامة",
                  )}
                </p>
                <Link
                  to="/listings"
                  className="inline-flex min-h-[44px] items-center rounded-xl bg-[#1a1a2e] px-6 text-sm font-semibold text-[#e8c547] no-underline"
                >
                  {t("Browse listings", "استعرض القوائم")} →
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                {bookings.map((booking) => {
                  const {
                    bg: statusBg,
                    c: statusColor,
                    label,
                  } = getStatusStyle(booking.status);
                  const nightCount = nightsBetween(
                    booking.check_in,
                    booking.check_out,
                  );
                  const createdAt = booking.created_at || booking.createdAt;
                  const cancelled = booking.status === "cancelled";

                  const details = [
                    {
                      label: t("Check-in", "تسجيل الوصول"),
                      value: formatDate(booking.check_in),
                    },
                    {
                      label: t("Check-out", "تسجيل المغادرة"),
                      value: formatDate(booking.check_out),
                    },
                    {
                      label: t("Nights", "الليالي"),
                      value: `${nightCount} ${nightCount === 1 ? t("night", "ليلة") : t("nights", "ليالي")}`,
                    },
                    {
                      label: t("Guests", "الضيوف"),
                      value: `${booking.guests} ${booking.guests === 1 ? t("guest", "ضيف") : t("guests", "ضيوف")}`,
                    },
                  ];

                  return (
                    <article
                      key={booking.id}
                      className="overflow-hidden rounded-2xl bg-white shadow-sm"
                    >
                      <div className="p-4">
                        <div className="flex items-start justify-between gap-3">
                          <h3 className="min-w-0 truncate text-[15px] font-semibold text-gray-900">
                            {booking.listing?.title || t("Listing", "قائمة")}
                          </h3>

                          <span
                            className="shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold capitalize"
                            style={{ background: statusBg, color: statusColor }}
                          >
                            {isAr ? label[1] : label[0]}
                          </span>
                        </div>

                        {booking.listing?.location && (
                          <p className="mt-1 flex items-center gap-1 text-sm text-gray-400">
                            <PinIcon size={12} />
                            <span className="truncate">
                              {booking.listing.location}
                            </span>
                          </p>
                        )}

                        <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 rounded-xl bg-gray-50 p-3">
                          {details.map(({ label: l, value }) => (
                            <div key={l} className="min-w-0">
                              <div className="text-[11px] font-medium uppercase tracking-wide text-gray-400">
                                {l}
                              </div>
                              <div className="mt-0.5 text-sm font-medium text-gray-800">
                                {value}
                              </div>
                            </div>
                          ))}
                        </div>

                        <div className="mt-4 flex items-end justify-between gap-3">
                          <div>
                            <div className="text-[11px] font-medium uppercase tracking-wide text-gray-400">
                              {t("Total", "المجموع")}
                            </div>
                            <div className="text-xl font-bold text-[#1a1a2e]">
                              {formatPrice(booking.total_price)}{" "}
                              {t("LYD", "دينار")}
                            </div>
                          </div>

                          {createdAt && (
                            <div className="text-end text-xs text-gray-400">
                              {t("Booked", "تم الحجز")} {formatDate(createdAt)}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2 border-t border-gray-100 bg-gray-50/60 p-3">
                        {/* View listing: show for every booking except cancelled */}
                          <Link
                            to={`/listings/${booking.listing_id}`}
                            className="flex min-h-[44px] flex-1 items-center justify-center rounded-xl bg-[#1a1a2e] px-4 text-sm font-semibold text-[#e8c547] no-underline active:scale-[0.97]"
                          >
                            {t("View listing", "عرض القائمة")}
                          </Link>
                     

                        {/* Cancel: only pending or confirmed */}
                        {(booking.status === "pending" ||
                          booking.status === "confirmed") && (
                          <button
                            onClick={() => cancelBooking(booking.id)}
                            disabled={cancellingId === booking.id}
                            className="flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-xl bg-red-50 px-4 text-sm font-semibold text-red-700 active:scale-[0.97] disabled:opacity-60"
                          >
                            {cancellingId === booking.id ? (
                              <Spinner />
                            ) : (
                              t("Cancel", "إلغاء")
                            )}
                          </button>
                        )}

                        {/* Maps */}
                        {booking.listing?.coordinates && (
                          <button
                            onClick={() => openInMaps(booking.listing!)}
                            className="flex min-h-[44px] flex-1 items-center justify-center gap-1.5 rounded-xl bg-emerald-50 px-4 text-sm font-semibold text-emerald-700 active:scale-[0.97]"
                          >
                            <PinIcon /> {t("Maps", "خريطة")}
                          </button>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
