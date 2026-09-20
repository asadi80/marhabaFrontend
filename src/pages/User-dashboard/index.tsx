// src/pages/User-dashboard/index.tsx
import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useLanguage } from "../../hooks/useLanguage";
import LoadingScreen from "../../components/LoadingScreen";
import Navbar from "../../components/Navbar";
import ListingsMap from "../../components/ListingsMap";
import { apiService } from "../../services/api";

// ---------- Constants ----------

const API_BASE =
  import.meta.env.VITE_API_URL || "https://api.mar-haba.ly/api/v1";

const USER_ROLE = "user";
const RADIUS_OPTIONS = [5, 10, 20, 50, 100];

// ---------- Types ----------

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

type BookingStatus = "confirmed" | "pending" | "cancelled";

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

// ---------- Static data ----------

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

// ---------- Helpers ----------

const toRole = (role?: string) => String(role || "").toLowerCase();

const nightsBetween = (checkIn: string, checkOut: string) =>
  Math.ceil(
    (new Date(checkOut).getTime() - new Date(checkIn).getTime()) / 86400000
  );

const haversineDistanceKm = (
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
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
 * Handles:
 *   - [ ... ]
 *   - { data: [...] }
 *   - { data: { listings: [...] } }
 *   - { listings: [...] }
 */
const extractListingsArray = (payload: any): any[] => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data?.listings)) return payload.data.listings;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.listings)) return payload.listings;
  return [];
};

/**
 * Normalize whatever shape the bookings API returns into a plain array.
 */
const extractBookingsArray = (payload: any): Booking[] => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data?.bookings)) return payload.data.bookings;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.bookings)) return payload.bookings;
  return [];
};

// IP-based fallback geolocation, used when the browser denies/lacks GPS access.
const getIPGeolocation = async (): Promise<Coords | null> => {
  try {
    const res = await fetch("https://ipapi.co/json/");
    if (!res.ok) return null;
    const data = await res.json();
    if (data?.latitude && data?.longitude) {
      return { lat: data.latitude as number, lng: data.longitude as number };
    }
  } catch {
    // Ignore network/parse errors — caller falls back to no location.
  }
  return null;
};

// ---------- Component ----------

export default function UserDashboard() {
  const navigate = useNavigate();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const { lang, toggleLanguage } = useLanguage();
  const isAr = lang === "ar";

  const [listings, setListings] = useState<Listing[]>([]);
  const [filtered, setFiltered] = useState<Listing[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [listingsLoading, setListingsLoading] = useState(true);
  const [userLocation, setUserLocation] = useState<Coords | null>(null);
  const [searchRadius, setSearchRadius] = useState(10);
  const [activeTab, setActiveTab] = useState("nearby");
  const [activeMarkerId, setActiveMarkerId] = useState<string | null>(null);

  const isAuthorizedUser =
    isAuthenticated && !!user && toRole((user as any).role) === USER_ROLE;

  // ---------- Formatting helpers ----------

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
      }
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

  // ---------- Auth + role guard ----------

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
      return;
    }
  }, [authLoading, isAuthenticated, user, navigate]);

  // ---------- Initial data load ----------
  // Listings are PUBLIC — fetch them as soon as the page is authorized,
  // in parallel with location + bookings. Each one resolves independently
  // so a slow geolocation prompt doesn't block the map from rendering.

  useEffect(() => {
    if (!isAuthorizedUser) return;

    resolveUserLocation();
    fetchListings();
    fetchBookings();
  }, [isAuthorizedUser]);

  // Re-filter whenever the radius changes.
  useEffect(() => {
    if (!userLocation) {
      setFiltered(listings);
      return;
    }

    setFiltered(
      listings.filter(
        (l) =>
          l.coordinates &&
          haversineDistanceKm(
            userLocation.lat,
            userLocation.lng,
            l.coordinates.lat,
            l.coordinates.lng
          ) <= searchRadius
      )
    );
  }, [listings, userLocation, searchRadius]);

  const resolveUserLocation = async () => {
    // 1. Try browser GPS.
    if ("geolocation" in navigator) {
      try {
        const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 0,
          })
        );
        setUserLocation({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        });
        return;
      } catch {
        // GPS unavailable or denied — fall through to IP lookup.
      }
    }

    // 2. Try IP-based geolocation.
    const ipLocation = await getIPGeolocation();
    if (ipLocation) {
      setUserLocation(ipLocation);
      return;
    }

    // 3. Give up — userLocation stays null; filter will show all listings.
    setUserLocation(null);
  };

  const fetchListings = async () => {
    setListingsLoading(true);

    try {
      // /listings is a PUBLIC endpoint. No auth required — plain fetch
      // avoids failures when the token is expired/mid-refresh.
      const res = await fetch(`${API_BASE}/listings`);

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      const payload = await res.json();
      const rawListings = extractListingsArray(payload);

      const transformed: Listing[] = rawListings.map((item) => {
        // Prefer top-level latitude/longitude, fall back to coordinates object.
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

      const active = transformed.filter((l) => l.is_active !== false);
      setListings(active);
      setFiltered(active);
    } catch (error) {
      console.error("Error fetching listings:", error);
      // Explicitly clear so the empty state is honest.
      setListings([]);
      setFiltered([]);
    } finally {
      setListingsLoading(false);
    }
  };

  const fetchBookings = async () => {
    try {
      // Bookings ARE user-specific — keep the protected call.
      const response =
        await apiService.getProtectedData<any>("/api/v1/bookings");

      if (!response.success || !response.data) {
        console.error("Failed to fetch bookings:", response.message);
        return;
      }

      setBookings(extractBookingsArray(response.data));
    } catch (error) {
      console.error("Error fetching bookings:", error);
    }
  };

  // ---------- Handlers ----------

  const filterByDistance = (radius: number) => {
    setSearchRadius(radius);
  };

  const openInMaps = (listing: Listing) => {
    if (!listing.coordinates) return;
    window.open(
      `https://www.google.com/maps/search/?api=1&query=${listing.coordinates.lat},${listing.coordinates.lng}`,
      "_blank"
    );
  };

  const getDirectionsTo = (listing: Listing) => {
    if (!userLocation) {
      alert(
        isAr ? "قم بتفعيل خدمات الموقع أولاً" : "Enable location services first"
      );
      return;
    }
    if (!listing.coordinates) return;

    window.open(
      `https://www.google.com/maps/dir/${userLocation.lat},${userLocation.lng}/${listing.coordinates.lat},${listing.coordinates.lng}`,
      "_blank"
    );
  };

  const cancelBooking = async (id: string) => {
    if (!confirm(isAr ? "هل تريد إلغاء هذا الحجز؟" : "Cancel this booking?"))
      return;

    try {
      const response = await apiService.putProtectedData(
        `/api/bookings/${id}`,
        { action: "cancel" }
      );
      if (response.success) fetchBookings();
    } catch (error) {
      console.error("Failed to cancel booking:", error);
      alert(
        error instanceof Error ? error.message : "Failed to cancel booking"
      );
    }
  };

  // ---------- Early returns ----------

  if (authLoading) return <LoadingScreen />;
  if (!isAuthorizedUser) return null;

  const { bg: avatarBg, c: avatarColor } = getAvatarColors(user!.name);
  const initials = getInitials(user!.name);

  const TABS = [
    { id: "nearby", label: isAr ? "الأماكن القريبة" : "Nearby Places" },
    {
      id: "bookings",
      label: `${isAr ? "الحجوزات" : "Bookings"} (${bookings.length})`,
    },
    {
      id: "listings",
      label: isAr ? "تصفح العقارات" : "Browse Listings",
      href: "/listings",
    },
  ];

  const displayFontClass = isAr
    ? "font-['Cairo','Tajawal',sans-serif]"
    : "font-['Fraunces',serif]";
  const bodyFontClass = isAr
    ? "font-['Cairo','Tajawal',sans-serif]"
    : "font-['DM_Mono',monospace]";

  // ---------- Render ----------

  return (
    <div
      className={`min-h-screen bg-[#f7f6f2] ${isAr ? "rtl" : "ltr"} ${bodyFontClass}`}
    >
      <Navbar
        NAV_LINKS={TABS}
        user={user}
        lang={lang}
        toggleLanguage={toggleLanguage}
        onTabChange={(tabId: string) => setActiveTab(tabId)}
      />

      <main className="max-w-[1200px] mx-auto p-4 md:p-6">
        {/* Profile strip */}
        <div className="bg-white rounded-xl border border-black/7 p-4 md:p-5 mb-5 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center text-[13px] font-medium"
              style={{ background: avatarBg, color: avatarColor }}
            >
              {initials}
            </div>
            <div>
              <div
                className={`${displayFontClass} font-light text-xl text-[#111118] leading-tight ${isAr ? "italic" : ""}`}
              >
                {user!.name}
              </div>
              <div className="text-[11px] text-gray-400 mt-0.5">
                {isAr ? "عضو منذ" : "member since"}{" "}
                {formatDate(
                  user!.created_at ||
                    user!.createdAt ||
                    new Date().toISOString()
                )}
              </div>
            </div>
          </div>
          <div className="flex gap-5 flex-wrap">
            {[
              {
                label: isAr ? "الحجوزات" : "bookings",
                value: bookings.length,
              },
              { label: isAr ? "القريبة" : "nearby", value: filtered.length },
            ].map(({ label, value }) => (
              <div key={label} className={isAr ? "text-left" : "text-right"}>
                <div
                  className={`${displayFontClass} font-light text-2xl text-[#111118] leading-tight ${isAr ? "italic" : ""}`}
                >
                  {value}
                </div>
                <div className="text-[10px] tracking-wide uppercase text-gray-300 mt-0.5">
                  {label}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* NEARBY TAB */}
        {activeTab === "nearby" && (
          <div>
            <div className="flex items-center justify-between flex-wrap gap-2.5 mb-4">
              <div
                className={`${displayFontClass} font-light text-xl text-[#111118] ${isAr ? "italic" : ""}`}
              >
                {isAr ? "الأماكن القريبة" : "nearby places"}
                <span className="text-[13px] font-normal not-italic text-gray-400 ml-2">
                  ({filtered.length})
                </span>
              </div>
              <div className="flex items-center gap-2">
                <label className="text-[11px] tracking-wide uppercase text-gray-400">
                  {isAr ? "نصف القطر" : "radius"}
                </label>
                <select
                  onChange={(e) => filterByDistance(parseInt(e.target.value))}
                  value={searchRadius}
                  className="px-2.5 py-1.5 bg-[#fafaf8] border border-black/12 rounded-md text-xs outline-none"
                >
                  {RADIUS_OPTIONS.map((v) => (
                    <option key={v} value={v}>
                      {v} {isAr ? "كم" : "km"}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Map — shared component. Mounts immediately; data flows in
                as the listings fetch resolves. */}
            <ListingsMap
              listings={filtered}
              userLocation={userLocation}
              isAr={isAr}
              onSelect={(id) => {
                // Match Home: navigate to the listing. The map's own
                // popup already gives users a peek without navigating.
                setActiveMarkerId(String(id));
                navigate(`/listings/${id}`);
              }}
              className="w-full h-[clamp(280px,45vw,440px)] mb-5"
            />

            {/* Listing cards */}
            {listingsLoading && filtered.length === 0 ? (
              <div className="min-h-[200px] flex items-center justify-center bg-white rounded-xl border border-black/7">
                <div className="w-8 h-8 border-[3px] border-[#e8c547] border-t-transparent rounded-full animate-spin" />
              </div>
            ) : filtered.length > 0 ? (
              <div className="flex flex-col gap-4">
                {filtered.map((listing) => {
                  const distanceKm =
                    userLocation && listing.coordinates
                      ? haversineDistanceKm(
                          userLocation.lat,
                          userLocation.lng,
                          listing.coordinates.lat,
                          listing.coordinates.lng
                        ).toFixed(1)
                      : null;

                  return (
                    <div
                      key={listing.id}
                      className={`flex flex-col sm:flex-row gap-5 bg-white rounded-xl border border-black/7 overflow-hidden transition-all hover:-translate-y-0.5 hover:shadow-lg ${
                        activeMarkerId === listing.id
                          ? "ring-2 ring-[#e8c547]"
                          : ""
                      }`}
                    >
                      <div className="relative sm:w-[200px] sm:min-w-[200px] h-[200px] sm:h-[180px] overflow-hidden">
                        <img
                          src={listing.images?.[0] || "/placeholder.jpg"}
                          alt={listing.title}
                          className="w-full h-full object-cover transition-transform hover:scale-105"
                        />
                        {distanceKm && (
                          <div className="absolute top-2 right-2 bg-[rgba(26,26,46,.85)] text-[#e8c547] text-[10px] px-2 py-0.5 rounded-full">
                            {distanceKm} {isAr ? "كم" : "km"}
                          </div>
                        )}
                      </div>
                      <div className="flex-1 p-4 sm:p-0 sm:py-4 sm:pr-5 flex flex-col justify-between">
                        <div>
                          <div className="text-base font-medium text-[#111118] mb-1.5">
                            {listing.title}
                          </div>
                          <div className="text-[13px] text-gray-400 mb-2.5 flex items-center gap-1">
                            <svg
                              width="12"
                              height="12"
                              viewBox="0 0 24 24"
                              fill="currentColor"
                              className="text-[#e8c547]"
                            >
                              <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
                            </svg>
                            {listing.location}
                          </div>
                          <div
                            className={`${displayFontClass} font-light text-2xl text-[#1a1a2e] mb-3 ${isAr ? "italic" : ""}`}
                          >
                            {listing.price} {isAr ? " دينار" : "LYD"}
                            <span className="text-base font-normal not-italic text-[#242323]">
                              / {isAr ? "ليلة" : "night"}
                            </span>
                          </div>
                        </div>
                        <div className="flex gap-2.5 flex-wrap">
                          <Link
                            to={`/listings/${listing.id}`}
                            className="bg-[#1a1a2e] text-[#e8c547] px-5 py-2.5 rounded-lg text-[13px] transition-opacity hover:opacity-90"
                          >
                            {isAr ? "عرض التفاصيل" : "view details"} →
                          </Link>
                          {listing.coordinates && (
                            <>
                              <button
                                onClick={() => openInMaps(listing)}
                                className="bg-[#1D9E75] text-white border-none rounded-lg px-5 py-2.5 text-[13px] cursor-pointer flex items-center gap-1.5"
                              >
                                <svg
                                  width="14"
                                  height="14"
                                  viewBox="0 0 24 24"
                                  fill="currentColor"
                                >
                                  <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" />
                                  <circle cx="12" cy="9" r="3" />
                                </svg>
                                {isAr ? "عرض على الخريطة" : "view on map"}
                              </button>
                              <button
                                onClick={() => getDirectionsTo(listing)}
                                className="bg-gray-100 text-[#1a1a2e] border border-gray-200 rounded-lg px-5 py-2.5 text-[13px] cursor-pointer flex items-center gap-1.5"
                              >
                                <svg
                                  width="14"
                                  height="14"
                                  viewBox="0 0 24 24"
                                  fill="currentColor"
                                >
                                  <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" />
                                  <circle cx="12" cy="9" r="3" />
                                </svg>
                                {isAr ? "اتجاهات" : "directions"}
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-16 px-8 bg-white rounded-xl border border-black/7">
                <div
                  className={`${displayFontClass} font-light text-2xl text-gray-300 mb-3 ${isAr ? "italic" : ""}`}
                >
                  {isAr ? "لا توجد أماكن قريبة" : "nothing nearby"}
                </div>
                <p className="text-sm text-gray-400 mb-4">
                  {isAr
                    ? `لا توجد أماكن ضمن ${searchRadius} كم`
                    : `No places within ${searchRadius} km`}
                </p>
                <button
                  onClick={() => filterByDistance(50)}
                  className="bg-none border-none text-[#185FA5] text-[13px] cursor-pointer font-medium"
                >
                  {isAr ? "توسيع إلى 50 كم →" : "expand to 50 km →"}
                </button>
              </div>
            )}
          </div>
        )}

        {/* BOOKINGS TAB */}
        {activeTab === "bookings" && (
          <div>
            <div
              className={`${displayFontClass} font-light text-xl text-[#111118] mb-4 ${isAr ? "italic" : ""}`}
            >
              {isAr ? "حجوزاتي" : "my bookings"}
            </div>
            {bookings.length === 0 ? (
              <div className="text-center py-16 px-4 bg-white rounded-xl border border-black/7">
                <div
                  className={`${displayFontClass} font-light text-2xl text-gray-300 mb-3 ${isAr ? "italic" : ""}`}
                >
                  {isAr ? "لا توجد حجوزات بعد" : "no bookings yet"}
                </div>
                <p className="text-[13px] text-gray-400 mb-4">
                  {isAr
                    ? "اكتشف أماكن رائعة للإقامة"
                    : "Discover amazing places to stay"}
                </p>
                <Link
                  to="/listings"
                  className="bg-[#1a1a2e] text-[#e8c547] px-6 py-2.5 rounded-lg text-[13px] inline-block"
                >
                  {isAr ? "استعرض القوائم →" : "browse listings →"}
                </Link>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {bookings.map((booking) => {
                  const {
                    bg: statusBg,
                    c: statusColor,
                    label,
                  } = getStatusStyle(booking.status);
                  const nightCount = nightsBetween(
                    booking.check_in,
                    booking.check_out
                  );

                  return (
                    <div
                      key={booking.id}
                      className="bg-white rounded-xl border border-black/7 p-4 md:p-5"
                    >
                      <div className="flex items-center justify-between flex-wrap gap-2 mb-1.5">
                        <div className="text-sm font-medium text-[#111118]">
                          {booking.listing?.title ||
                            (isAr ? "قائمة" : "Listing")}
                        </div>
                        <span
                          className="text-[10px] font-medium tracking-wide uppercase px-2.5 py-0.5 rounded-full"
                          style={{ background: statusBg, color: statusColor }}
                        >
                          {isAr ? label[1] : label[0]}
                        </span>
                      </div>
                      <div className="text-xs text-gray-400 mb-4">
                        {booking.listing?.location}
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                        {[
                          {
                            label: isAr ? "تسجيل الوصول" : "check-in",
                            value: formatDate(booking.check_in),
                          },
                          {
                            label: isAr ? "تسجيل المغادرة" : "check-out",
                            value: formatDate(booking.check_out),
                          },
                          {
                            label: isAr ? "الليالي" : "nights",
                            value: `${nightCount} ${
                              nightCount === 1
                                ? isAr
                                  ? "ليلة"
                                  : "night"
                                : isAr
                                  ? "ليالي"
                                  : "nights"
                            }`,
                          },
                          {
                            label: isAr ? "الضيوف" : "guests",
                            value: `${booking.guests} ${
                              booking.guests === 1
                                ? isAr
                                  ? "ضيف"
                                  : "guest"
                                : isAr
                                  ? "ضيوف"
                                  : "guests"
                            }`,
                          },
                        ].map(({ label, value }) => (
                          <div key={label}>
                            <div className="text-[10px] tracking-wide uppercase text-gray-300 mb-0.5">
                              {label}
                            </div>
                            <div className="text-xs text-[#111118]">
                              {value}
                            </div>
                          </div>
                        ))}
                      </div>

                      <div>
                        <div className="text-[10px] tracking-wide uppercase text-gray-300 mb-0.5">
                          {isAr ? "المجموع" : "total"}
                        </div>
                        <div
                          className={`${displayFontClass} font-light text-xl text-[#1a1a2e] ${isAr ? "italic" : ""}`}
                        >
                          {formatPrice(booking.total_price)}{" "}
                          {isAr ? "دينار" : "LYD"}
                        </div>
                      </div>

                      <div className="flex gap-2 flex-wrap mt-4">
                        {booking.status !== "cancelled" && (
                          <>
                            <Link
                              to={`/listings/${booking.listing_id}`}
                              className="bg-[#1a1a2e] text-[#e8c547] px-3.5 py-1.5 rounded-md text-xs"
                            >
                              {isAr ? "عرض القائمة" : "view listing"}
                            </Link>
                            <button
                              onClick={() => cancelBooking(booking.id)}
                              className="bg-none border border-[rgba(163,45,45,.25)] text-[#A32D2D] px-3.5 py-1.5 rounded-md text-xs cursor-pointer"
                            >
                              {isAr ? "إلغاء" : "cancel"}
                            </button>
                          </>
                        )}
                        {booking.listing?.coordinates && (
                          <button
                            onClick={() => openInMaps(booking.listing!)}
                            className="bg-[#1D9E75] text-white border-none rounded-md px-3.5 py-1.5 text-xs cursor-pointer flex items-center gap-1.5"
                          >
                            <svg
                              width="12"
                              height="12"
                              viewBox="0 0 24 24"
                              fill="currentColor"
                            >
                              <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" />
                              <circle cx="12" cy="9" r="3" />
                            </svg>
                            {isAr ? "خريطة" : "maps"}
                          </button>
                        )}
                      </div>
                      <div className="text-[11px] text-gray-300 mt-3">
                        {isAr ? "تم الحجز" : "booked"}{" "}
                        {formatDate(
                          booking.created_at ||
                            booking.createdAt ||
                            new Date().toISOString()
                        )}
                      </div>
                    </div>
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