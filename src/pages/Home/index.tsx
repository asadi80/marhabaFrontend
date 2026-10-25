import { useState, useEffect, useCallback, useRef } from "react";

import { Link, useNavigate } from "react-router-dom";

import { useLanguage } from "../../hooks/useLanguage";

import { useAuth } from "../../context/AuthContext";

import Navbar from "../../components/Navbar";

import ListingsMap from "../../components/ListingsMap";

import type { Listing } from "../../types";

/* ==========================================================================
   TYPES
========================================================================== */

interface Category {
  key: string;
  icon: string;
  label: string;
}

interface Stats {
  total_travelers: number;
  total_hosts: number;
  total_bookings: number;
  total_listings: number;
}

type Coords = {
  lat: number;
  lng: number;
};

/* ==========================================================================
   CONSTANTS
========================================================================== */

const API_BASE = import.meta.env.VITE_API_URL || "https://api.mar-haba.ly/api/v1";

const DISTANCE_OPTIONS = [5, 10, 20, 50, 100];

// Where the "Dashboard" tab goes for each role. Make sure these match your router.
const DASHBOARD_PATHS: Record<string, string> = {
  host: "/host-dashboard",
  admin: "/admin-dashboard",
  super_admin: "/admin-dashboard",
  user: "/user-dashboard",
};

// Pull the listings array out of whichever shape the API returned.
// Handles: { listings }, { data: [...] }, { data: { listings: [...] } }
const parseListings = (data: any): Listing[] => {
  if (Array.isArray(data?.listings)) return data.listings;
  if (Array.isArray(data?.data?.listings)) return data.data.listings;
  if (Array.isArray(data?.data)) return data.data;
  return [];
};

const Skeleton = ({ className = "" }: { className?: string }) => (
  <div className={`animate-pulse rounded-lg bg-gray-200/80 ${className}`} />
);

const Check = ({ stroke }: { stroke: string }) => (
  <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
    <path d="M1 4l2 2 4-4" stroke={stroke} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

/* ==========================================================================
   COMPONENT
========================================================================== */

export default function Home() {
  const navigate = useNavigate();

  const { lang, t, toggleLanguage } = useLanguage();

  const content = t;

  const isAr = lang === "ar";
  const tr = (en: string, ar: string) => (isAr ? ar : en);

  // Keep refs so callbacks that must not depend on `isAr` / `distance`
  // still see the latest value without being recreated (which would
  // re-request the user's location).
  const isArRef = useRef(isAr);
  isArRef.current = isAr;

  const { user, isAuthenticated, isLoading: authLoading } = useAuth();

  /* ------------------------------ UI state ------------------------------ */

  const [year] = useState(new Date().getFullYear());

  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  /* ------------------------ Listings + location ------------------------- */

  const [listings, setListings] = useState<Listing[]>([]);

  const [userCoords, setUserCoords] = useState<Coords | null>(null);

  // Selected search distance in kilometers
  const [distance, setDistance] = useState(10);

  const distanceRef = useRef(distance);
  distanceRef.current = distance;

  const [listingsLoading, setListingsLoading] = useState(true);

  const [locationError, setLocationError] = useState<string | null>(null);

  const [locationPermission, setLocationPermission] = useState(false);

  /* ------------------------------- Stats -------------------------------- */

  const [stats, setStats] = useState<Stats>({
    total_travelers: 0,
    total_hosts: 0,
    total_bookings: 0,
    total_listings: 0,
  });

  const [statsLoading, setStatsLoading] = useState(true);

  /* ----------------------------- Categories ----------------------------- */

  const categories: Category[] = [
    { key: "beachfront", icon: "🏖️", label: tr("Beachfront", "شاطئ") },
    { key: "mountain", icon: "🏔️", label: tr("Mountain", "جبال") },
    { key: "city", icon: "🏙️", label: tr("City", "مدينة") },
    { key: "countryside", icon: "🏡", label: tr("Countryside", "ريفي") },
    { key: "pool", icon: "🏊", label: tr("Pool", "مسبح") },
    { key: "desert", icon: "🏜️", label: tr("Desert", "صحراء") },
    { key: "camping", icon: "🏕️", label: tr("Camping", "تخييم") },
    { key: "cabins", icon: "🛖", label: tr("Cabins", "كوخ") },
  ];

  const cardColors = ["bg-amber-50", "bg-sky-50", "bg-purple-50", "bg-emerald-50", "bg-pink-50", "bg-lime-50"];

  const activeCat = categories.find((c) => c.key === activeCategory);
  const activeCatLabel = activeCat?.label;

  /* -------------------------- Filtered listings ------------------------- */

  const filteredListings = activeCategory
    ? listings.filter((listing) => {
        const haystack = [
          (listing as any).category,
          (listing as any).type,
          (listing as any).propertyType,
          ...(Array.isArray((listing as any).tags) ? (listing as any).tags : []),
          listing.title,
          listing.description,
        ]
          .filter((s): s is string => Boolean(s))
          .map((s) => s.toLowerCase());

        return haystack.some((s) => s.includes(activeCategory.toLowerCase()));
      })
    : listings;

  /* ------------------------------ Fetch stats --------------------------- */

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/stats/simple`);

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || "Failed to fetch statistics");
      }

      if (data.success && data.data) {
        setStats({
          total_travelers: Number(data.data.total_travelers) || 0,
          total_hosts: Number(data.data.total_hosts) || 0,
          total_bookings: Number(data.data.total_bookings) || 0,
          total_listings: Number(data.data.total_listings) || 0,
        });
      }
    } catch (error) {
      console.error("Error fetching stats:", error);
    } finally {
      setStatsLoading(false);
    }
  }, []);

  /* ----------------------------- Fetch listings ------------------------- */

  // This callback intentionally does NOT depend on `distance`: the radius is passed in,
  // so changing the distance never recreates it or triggers geolocation again.
  const fetchListings = useCallback(async (coords: Coords | null, radius: number) => {
    setListingsLoading(true);

    try {
      // User location -> nearby listings
      if (coords) {
        const params = new URLSearchParams({
          lat: String(coords.lat),
          lng: String(coords.lng),
          radius: String(radius),
          limit: "100",
        });

        const res = await fetch(`${API_BASE}/listings/nearby?${params.toString()}`);

        if (!res.ok) {
          const errorData = await res.json().catch(() => null);
          throw new Error(errorData?.error || `HTTP ${res.status}`);
        }

        const data = await res.json();

        setListings(parseListings(data));
        setLocationPermission(true);

        return;
      }

      // No location -> normal listings
      const res = await fetch(`${API_BASE}/listings`);

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      const data = await res.json();

      setListings(parseListings(data));
      setLocationPermission(false);
    } catch (error) {
      console.error("Error fetching listings:", error);

      setListings([]);
      setLocationPermission(false);
    } finally {
      setListingsLoading(false);
    }
  }, []);

  /* ---------------------------- Get user location ----------------------- */

  // Reads language and distance from refs, so changing either one does NOT ask for the location again.
  const getUserLocation = useCallback(() => {
    setLocationError(null);

    const ar = isArRef.current;

    // Geolocation not supported
    if (!navigator.geolocation) {
      setLocationError(ar ? "متصفحك لا يدعم تحديد الموقع" : "Your browser doesn't support geolocation");

      setUserCoords(null);

      fetchListings(null, distanceRef.current);

      return;
    }

    setListingsLoading(true);

    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const c: Coords = { lat: coords.latitude, lng: coords.longitude };

        // Do NOT fetch here. The effect below watches userCoords + distance and
        // performs the listing request, which prevents duplicate requests.
        setUserCoords(c);
        setLocationPermission(true);
        setLocationError(null);
      },

      (err) => {
        console.error("Geolocation error:", err);

        setLocationError(
          err.code === 1
            ? ar
              ? "الرجاء السماح بالوصول إلى الموقع"
              : "Please allow location access"
            : ar
              ? "تعذر الحصول على موقعك"
              : "Unable to get your location",
        );

        setUserCoords(null);

        // Fall back to normal listings
        fetchListings(null, distanceRef.current);
      },

      { timeout: 10000, maximumAge: 60000 },
    );
  }, [fetchListings]);

  /* ------------------------------- Effects ------------------------------ */

  // Refresh listings when the location or distance changes
  useEffect(() => {
    if (!userCoords) return;

    fetchListings(userCoords, distance);
  }, [userCoords, distance, fetchListings]);

  // Initial data load
  useEffect(() => {
    fetchStats();
    getUserLocation();
  }, [fetchStats, getUserLocation]);

  /* ------------------------------ Handlers ------------------------------ */

  const handleCategoryClick = (key: string) => {
    setActiveCategory((prev) => (prev === key ? null : key));
  };

  /* ------------------------------ Nav links ----------------------------- */
  // These show as the top links on desktop and as the bottom tab bar on phones.
  // The page never waits for auth: while it is still loading we show neutral links
  // and hide the sign-up buttons, so nothing flashes or jumps.

  const role = String(user?.role || "").toLowerCase();

  const NAV_LINKS = authLoading
    ? [
        { id: "home", label: "Home", labelAr: "الرئيسية", href: "/", icon: "🏡" },
        { id: "listings", label: "Browse", labelAr: "تصفح", href: "/listings", icon: "🔍" },
      ]
    : isAuthenticated
      ? [
          { id: "home", label: "Home", labelAr: "الرئيسية", href: "/", icon: "🏡" },
          { id: "listings", label: "Browse", labelAr: "تصفح", href: "/listings", icon: "🔍" },
          {
            id: "dashboard",
            label: "Dashboard",
            labelAr: "لوحة التحكم",
            href: DASHBOARD_PATHS[role] || DASHBOARD_PATHS.user,
            icon: "👤",
          },
        ]
      : [
          { id: "home", label: "Home", labelAr: "الرئيسية", href: "/", icon: "🏡" },
          { id: "listings", label: "Browse", labelAr: "تصفح", href: "/listings", icon: "🔍" },
          { id: "how-to-book", label: "How to Book", labelAr: "كيفية الحجز", href: "/how-to-book", icon: "📖" },
          { id: "start-hosting", label: "Start Hosting", labelAr: "ابدأ الاستضافة", href: "/start-hosting", icon: "🏠" },
        ];

  const showGuestUI = !authLoading && !isAuthenticated;

  /* -------------------------------- Render ------------------------------ */

  return (
    <div
      dir={isAr ? "rtl" : "ltr"}
      className={`min-h-screen bg-gray-50 pb-16 text-gray-900 md:pb-0 ${isAr ? "font-arabic" : "font-sans"}`}
    >
      <Navbar
        NAV_LINKS={NAV_LINKS}
        user={isAuthenticated ? user : null}
        lang={lang}
        toggleLanguage={toggleLanguage}
        defaultActiveId="home"
      />

      {/* ====================== CATEGORIES ====================== */}

      <div className="border-b border-gray-100 bg-white">
        <div className="mx-auto max-w-screen-xl px-4 pt-5 sm:px-6 sm:pt-8">
          <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-gray-400">
            {tr("Browse by type", "تصفح حسب النوع")}
          </p>

          <div className="-mx-4 flex gap-2.5 overflow-x-auto px-4 pb-4 [scrollbar-width:none] sm:mx-0 sm:px-0 [&::-webkit-scrollbar]:hidden">
            {categories.map((cat) => (
              <button
                key={cat.key}
                type="button"
                onClick={() => handleCategoryClick(cat.key)}
                title={tr(`Filter: ${cat.label}`, `تصفية: ${cat.label}`)}
                aria-pressed={activeCategory === cat.key}
                className={`flex w-[84px] shrink-0 cursor-pointer flex-col items-center gap-1 rounded-2xl border px-2 py-3 transition active:scale-95 ${
                  activeCategory === cat.key
                    ? "border-yellow-400 bg-yellow-50 text-gray-900"
                    : "border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:bg-gray-50"
                }`}
              >
                <span className="text-2xl leading-none">{cat.icon}</span>
                <span className="whitespace-nowrap text-xs font-medium">{cat.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ======================== LISTINGS ======================== */}

      <div className="mx-auto max-w-screen-xl px-4 py-6 sm:px-6 sm:py-10">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <h2
              className={`text-[clamp(20px,4vw,28px)] font-bold leading-tight text-gray-900 ${isAr ? "font-arabic" : ""}`}
            >
              {activeCategory
                ? tr(`${activeCatLabel} stays`, `أماكن: ${activeCatLabel}`)
                : locationPermission
                  ? tr("Places near you", "أماكن قريبة منك")
                  : tr("Featured stays", "أماكن إقامة مميزة")}
            </h2>

            {/* The selected category is already highlighted above and named in the heading, so this is only a clear button */}
            {activeCategory && (
              <button
                onClick={() => setActiveCategory(null)}
                className="mt-1 cursor-pointer border-none bg-transparent p-0 text-xs font-medium text-yellow-700 underline"
              >
                ✕ {tr("Clear filter", "إزالة التصفية")}
              </button>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={getUserLocation}
              disabled={listingsLoading}
              aria-label={tr("Show listings near me", "أظهر القريب مني")}
              className="flex min-h-[40px] cursor-pointer items-center gap-2 rounded-full border-none bg-[#1a1a2e] px-4 text-[12px] font-medium text-yellow-400 transition active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <span>📍</span>

              {listingsLoading
                ? tr("Loading...", "جاري التحميل...")
                : locationPermission
                  ? tr("Update location", "تحديث الموقع")
                  : tr("Show near me", "أظهر القريب مني")}
            </button>

            <Link to="/listings" className="text-sm font-semibold text-gray-900 no-underline hover:text-yellow-600">
              {tr("Show all", "عرض الكل")} →
            </Link>
          </div>
        </div>

        {locationError && (
          <div className="mb-4 inline-flex items-center gap-1.5 rounded-2xl border border-yellow-200 bg-yellow-50 px-3.5 py-2 text-xs text-yellow-800">
            <span>📍</span>
            {locationError}
          </div>
        )}

        {/* Distance chips */}
        {locationPermission && userCoords && (
          <div className="-mx-4 mb-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
            <div className="flex items-center gap-2">
              <span className="shrink-0 text-xs font-medium uppercase tracking-wide text-gray-400">
                {tr("Distance", "المسافة")}
              </span>

              {DISTANCE_OPTIONS.map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setDistance(v)}
                  aria-label={tr(`Select ${v} km`, `اختيار ${v} كم`)}
                  className={`shrink-0 whitespace-nowrap rounded-full px-3.5 py-2 text-sm font-medium transition active:scale-95 ${
                    distance === v ? "bg-[#1a1a2e] text-yellow-400" : "bg-white text-gray-600 shadow-sm"
                  }`}
                >
                  {v} {tr("km", "كم")}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* MAP */}

        <ListingsMap
          listings={filteredListings}
          userLocation={userCoords}
          isAr={isAr}
          onSelect={(id) => navigate(`/listings/${id}`)}
          className="mb-6 h-[280px] w-full overflow-hidden rounded-2xl border border-gray-100 sm:mb-8 sm:h-[520px]"
        />

        {/* Loading: card placeholders */}
        {listingsLoading ? (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="overflow-hidden rounded-2xl bg-white shadow-sm">
                <Skeleton className="aspect-[4/3] w-full rounded-none" />
                <div className="space-y-2 p-4">
                  <Skeleton className="h-4 w-1/2" />
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-4 w-1/3" />
                </div>
              </div>
            ))}
          </div>
        ) : filteredListings.length === 0 ? (
          /* Empty state */
          <div className="rounded-2xl bg-white px-6 py-14 text-center shadow-sm">
            <div className="mb-3 text-5xl">{activeCat ? activeCat.icon : "🏠"}</div>

            <p className="mb-4 text-sm text-gray-500">
              {activeCategory
                ? tr(`No ${activeCatLabel} stays found near you`, `لا توجد إقامات من نوع "${activeCatLabel}"`)
                : tr("No listings found near your location", "لا توجد قوائم قريبة من موقعك")}
            </p>

            {activeCategory ? (
              <button
                onClick={() => setActiveCategory(null)}
                className="min-h-[44px] cursor-pointer rounded-xl border-none bg-[#1a1a2e] px-5 text-sm font-semibold text-yellow-400 active:scale-95"
              >
                {tr("← Show all stays", "← عرض كل الإقامات")}
              </button>
            ) : (
              <button
                onClick={getUserLocation}
                className="min-h-[44px] cursor-pointer rounded-xl border-none bg-[#1a1a2e] px-5 text-sm font-semibold text-yellow-400 active:scale-95"
              >
                {tr("Try again", "حاول مرة أخرى")} →
              </button>
            )}
          </div>
        ) : (
          /* Listing cards */
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filteredListings.map((listing, index) => {
              const place = (listing as any).location?.split(",")[0];
              const dist = (listing as any).distance;

              return (
                <div
                  key={listing.id ?? index}
                  onClick={() => navigate(`/listings/${listing.id}`)}
                  className="cursor-pointer overflow-hidden rounded-2xl bg-white shadow-sm transition active:scale-[0.99] md:hover:-translate-y-1 md:hover:shadow-lg"
                >
                  <div className={`relative aspect-[4/3] w-full overflow-hidden ${cardColors[index % cardColors.length]}`}>
                    {listing.images?.[0] ? (
                      <img src={listing.images[0]} alt={listing.title} className="h-full w-full object-cover" loading="lazy" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-5xl">
                        {["🏙️", "🏡", "🏛️", "🕌"][index % 4]}
                      </div>
                    )}

                    {/* FAVORITE */}
                    <button
                      type="button"
                      aria-label={tr("Add to favorites", "أضف إلى المفضلة")}
                      onClick={(e) => {
                        e.stopPropagation();
                      }}
                      className="absolute end-3 top-3 flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border-none bg-white/90 shadow-sm transition hover:bg-white"
                    >
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                        <path
                          d="M7 12.5S1 9 1 4.5a3 3 0 0 1 6 0 3 3 0 0 1 6 0C13 9 7 12.5 7 12.5z"
                          stroke="#222"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </button>

                    {/* DISTANCE */}
                    {dist !== undefined && dist !== null && (
                      <div className="absolute bottom-3 end-3 rounded-full bg-black/70 px-2.5 py-1 text-[11px] font-medium text-white">
                        📍 {Number(dist).toFixed(1)} {tr("km", "كم")}
                      </div>
                    )}
                  </div>

                  <div className="px-4 py-3">
                    {/* Place name, then the listing title (only when the place name isn't just the title again) */}
                    <div className="truncate text-sm font-semibold text-gray-900">
                      {place || listing.title?.slice(0, 30)}
                    </div>

                    {place && (
                      <div className="mb-1.5 mt-0.5 truncate text-[13px] text-gray-400">
                        {listing.title?.slice(0, 50) || "Beautiful Space"}
                      </div>
                    )}

                    <div className="mt-1.5 text-sm text-gray-900">
                      <strong className="font-bold">{listing.price}</strong> {tr("LYD", "دينار")} / {tr("night", "ليلة")}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ========================== STATS ========================== */}

      <div className="my-6 bg-[#1a1a2e] px-4 py-9 sm:my-10 sm:px-6 sm:py-12">
        <div className="mx-auto grid max-w-3xl grid-cols-2 gap-6 text-center sm:grid-cols-4">
          {[
            { val: stats.total_travelers?.toLocaleString(), suffix: "+", label: content.happyTravelers },
            { val: stats.total_hosts?.toLocaleString(), suffix: "+", label: content.activeHosts },
            { val: stats.total_bookings?.toLocaleString(), suffix: "+", label: content.bookingsMade },
            { val: stats.total_listings?.toLocaleString(), suffix: "+", label: content.listingMade },
          ].map(({ val, suffix, label }) => (
            <div key={label}>
              <div
                className={`mb-1.5 text-[clamp(24px,5vw,38px)] font-bold leading-none text-white ${isAr ? "font-arabic" : ""}`}
              >
                {statsLoading ? (
                  <Skeleton className="mx-auto h-9 w-16 !bg-white/15" />
                ) : (
                  <>
                    {val}
                    <span className="text-yellow-400">{suffix}</span>
                  </>
                )}
              </div>

              <div className="text-[11px] uppercase tracking-widest text-white/40 sm:text-[12px]">{label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ======================= CHOOSE PATH ======================= */}

      <div className="mx-auto max-w-screen-xl px-4 py-6 sm:px-6 sm:py-10">
        <div className="mb-2">
          <div className="mb-1.5 text-[10px] uppercase tracking-[0.12em] text-gray-400">{content.whoAreYou}</div>

          <h2 className={`text-[clamp(20px,4vw,28px)] font-bold text-gray-900 ${isAr ? "font-arabic" : ""}`}>
            {content.choosePath}
          </h2>
        </div>

        <p className="mb-6 text-sm text-gray-400">
          {tr("Discover how we can help with your journey", "اكتشف كيف يمكننا مساعدتك في رحلتك")}
        </p>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          {/* TRAVELER */}

          <div className="relative flex min-h-[300px] flex-col justify-end overflow-hidden rounded-2xl bg-white p-6 shadow-sm sm:min-h-[340px] sm:p-9">
            <div className={`absolute top-6 text-4xl sm:top-7 sm:text-5xl ${isAr ? "left-6 sm:left-7" : "right-6 sm:right-7"}`}>
              ✈️
            </div>

            <span className="mb-3 inline-block w-fit rounded-full bg-[#0C447C22] px-3 py-1 text-[11px] font-semibold text-[#0C447C]">
              {content.traveler}
            </span>

            <div className={`mb-3 text-[20px] font-bold leading-[1.2] text-gray-900 sm:text-[24px] ${isAr ? "font-arabic" : ""}`}>
              {content.travelerTagline}
            </div>

            <p className="mb-5 text-[13px] leading-[1.7] text-gray-500">{content.travelerDesc}</p>

            <ul className="mb-6 flex list-none flex-col gap-2 p-0">
              {[content.travelerPerk1, content.travelerPerk2, content.travelerPerk3, content.travelerPerk4].map((p) => (
                <li key={p} className="flex items-center gap-2.5 text-[13px] text-gray-700">
                  <span className="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full bg-[#0C447C]">
                    <Check stroke="#fff" />
                  </span>
                  {p}
                </li>
              ))}
            </ul>

            {showGuestUI && (
              <Link
                to="/signup"
                className="inline-flex min-h-[44px] w-fit items-center gap-1.5 rounded-xl bg-[#1a1a2e] px-5 text-[13px] font-semibold text-yellow-400 no-underline active:scale-[0.97]"
              >
                {content.getStartedAs} {content.traveler?.toLowerCase()} →
              </Link>
            )}
          </div>

          {/* HOST */}

          <div className="relative flex min-h-[300px] flex-col justify-end overflow-hidden rounded-2xl bg-[#1a1a2e] p-6 sm:min-h-[340px] sm:p-9">
            <div className={`absolute top-6 text-4xl sm:top-7 sm:text-5xl ${isAr ? "left-6 sm:left-7" : "right-6 sm:right-7"}`}>
              🏠
            </div>

            <span className="mb-3 inline-block w-fit rounded-full bg-yellow-400/15 px-3 py-1 text-[11px] font-semibold text-yellow-400">
              {content.host}
            </span>

            <div className={`mb-3 text-[20px] font-bold leading-[1.2] text-white sm:text-[24px] ${isAr ? "font-arabic" : ""}`}>
              {content.hostTagline}
            </div>

            <p className="mb-5 text-[13px] leading-[1.7] text-white/50">{content.hostDesc}</p>

            <ul className="mb-6 flex list-none flex-col gap-2 p-0">
              {[content.hostPerk1, content.hostPerk2, content.hostPerk3, content.hostPerk4].map((p) => (
                <li key={p} className="flex items-center gap-2.5 text-[13px] text-white/80">
                  <span className="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full bg-yellow-400">
                    <Check stroke="#1a1a2e" />
                  </span>
                  {p}
                </li>
              ))}
            </ul>

            {showGuestUI && (
              <Link
                to="/signup"
                className="inline-flex min-h-[44px] w-fit items-center gap-1.5 rounded-xl bg-yellow-400 px-5 text-[13px] font-semibold text-[#1a1a2e] no-underline active:scale-[0.97]"
              >
                {content.getStartedAs} {content.host?.toLowerCase()} →
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* ============================ CTA ============================ */}

      {showGuestUI && (
        <div className="mx-auto max-w-screen-xl px-4 py-6 sm:px-6 sm:py-10">
          <div className="relative overflow-hidden rounded-2xl bg-[#1a1a2e] px-6 py-12 text-center sm:px-12 sm:py-16">
            <div className="relative z-10">
              <div className="mb-3 text-[10px] uppercase tracking-[0.12em] text-yellow-400/60">{content.ready}</div>

              <h2 className={`mb-3 text-[clamp(22px,5vw,36px)] font-bold leading-[1.15] text-white ${isAr ? "font-arabic" : ""}`}>
                {content.ctaTitle}
              </h2>

              <p className="mx-auto mb-7 max-w-[460px] text-sm leading-[1.75] text-white/45 sm:text-[15px]">
                {content.ctaDesc}
              </p>

              <div className="flex flex-wrap justify-center gap-3">
                <Link
                  to="/signup"
                  className="flex min-h-[48px] items-center rounded-xl bg-yellow-400 px-7 text-sm font-bold text-[#1a1a2e] no-underline active:scale-[0.97]"
                >
                  {content.createAccount} →
                </Link>

                <Link
                  to="/login"
                  className="flex min-h-[48px] items-center rounded-xl border border-white/20 bg-white/10 px-7 text-sm font-medium text-white no-underline active:scale-[0.97]"
                >
                  {content.signIn}
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =========================== FOOTER =========================== */}

      <footer className="bg-[#111] px-4 pb-24 pt-10 sm:px-6 sm:pt-12 md:pb-7">
        <div className="mx-auto max-w-screen-xl">
          <div className="mb-8 grid grid-cols-2 gap-8 border-b border-[#222] pb-8 lg:grid-cols-4">
            <div className="col-span-2 lg:col-span-1">
              <Link
                to="/"
                className="font-arabic text-[26px] font-medium tracking-wide no-underline"
                style={{ color: "#ffffff" }}
              >
                مر
                <span className="font-bold" style={{ color: "#e8c547" }}>
                  حبا
                </span>
              </Link>

              <p className="mt-3 text-sm leading-[1.7] text-[#777]">{content.footerDesc}</p>
            </div>

            {[
              {
                heading: content.travelersHeading,
                links: [
                  { label: content.howToBook, href: "/how-to-book" },
                  { label: content.paymentMethods, href: "/payment-methods" },
                  { label: content.travelTips, href: "/travel-tips" },
                ],
              },
              {
                heading: content.hostsHeading,
                links: [
                  { label: content.startHosting, href: "/start-hosting" },
                  { label: content.hostResources, href: "/host-resources" },
                  { label: content.pricingTips, href: "/pricing-tips" },
                ],
              },
              {
                heading: content.supportHeading,
                links: [
                  { label: content.helpCenter, href: "/help-center" },
                  { label: content.safetyInfo, href: "/safety-info" },
                  { label: content.contactUs, href: "/contact" },
                ],
              },
            ].map(({ heading, links }) => (
              <div key={heading}>
                <div className="mb-4 text-[11px] font-semibold uppercase tracking-[0.1em] text-[#777]">{heading}</div>

                {links.map((link) => (
                  <Link
                    key={link.href}
                    to={link.href}
                    className="mb-3 block text-[13px] text-[#aaa] no-underline hover:text-yellow-400"
                  >
                    {link.label}
                  </Link>
                ))}
              </div>
            ))}
          </div>

          <div className="flex flex-col items-center justify-between gap-3 sm:flex-row">
            <p className="text-xs text-[#666]">
              &copy;{year} Marhaba. {content.rights}
            </p>

            <div className="flex gap-5">
              <Link to="/privacy" className="text-xs text-[#aaa] no-underline hover:text-yellow-400">
                {content.privacy}
              </Link>

              <Link to="/terms" className="text-xs text-[#aaa] no-underline hover:text-yellow-400">
                {content.terms}
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}