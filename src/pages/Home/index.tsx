import { useState, useEffect, useCallback, useRef } from "react";

import { Link, useNavigate } from "react-router-dom";

import { useLanguage } from "../../hooks/useLanguage";

import { useAuth } from "../../context/AuthContext";

import LoadingScreen from "../../components/LoadingScreen";

import Navbar from "../../components/Navbar";

import ListingsMap from "../../components/ListingsMap";

import type { Listing, NavLink } from "../../types";

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

const API_BASE =
  import.meta.env.VITE_API_URL || "https://api.mar-haba.ly/api/v1";

// Pull the listings array out of whichever shape the API returned.
// Handles:
// { listings }
// { data: [...] }
// { data: { listings: [...] } }
const parseListings = (data: any): Listing[] => {
  if (Array.isArray(data?.listings)) return data.listings;

  if (Array.isArray(data?.data?.listings)) {
    return data.data.listings;
  }

  if (Array.isArray(data?.data)) {
    return data.data;
  }

  return [];
};

export default function Home() {
  const navigate = useNavigate();

  const { lang, t, toggleLanguage } = useLanguage();

  const content = t;

  const isAr = lang === "ar";

  // Keep a ref so callbacks that must not depend on `isAr`
  // still see the latest value without being recreated
  // on every language toggle.
  const isArRef = useRef(isAr);

  isArRef.current = isAr;

  // ============================================================
  // AUTH STATE
  // ============================================================

  const {
    user,
    isAuthenticated,
    isLoading: authLoading,
  } = useAuth();

  // ============================================================
  // UI STATE
  // ============================================================

  const [year] = useState(new Date().getFullYear());

  const [activeCategory, setActiveCategory] = useState<string | null>(
    null,
  );

  // ============================================================
  // LISTINGS + LOCATION STATE
  // ============================================================

  const [listings, setListings] = useState<Listing[]>([]);

  const [userCoords, setUserCoords] = useState<Coords | null>(null);

  // Selected search distance in kilometers
  const [distance, setDistance] = useState(10);

  const [listingsLoading, setListingsLoading] = useState(true);

  const [locationError, setLocationError] = useState<string | null>(
    null,
  );

  const [locationPermission, setLocationPermission] = useState(false);

  // ============================================================
  // STATS STATE
  // ============================================================

  const [stats, setStats] = useState<Stats>({
    total_travelers: 0,
    total_hosts: 0,
    total_bookings: 0,
    total_listings: 0,
  });

  // ============================================================
  // CATEGORIES
  // ============================================================

  const categories: Category[] = [
    {
      key: "beachfront",
      icon: "🏖️",
      label: isAr ? "شاطئ" : "Beachfront",
    },
    {
      key: "mountain",
      icon: "🏔️",
      label: isAr ? "جبال" : "Mountain",
    },
    {
      key: "city",
      icon: "🏙️",
      label: isAr ? "مدينة" : "City",
    },
    {
      key: "countryside",
      icon: "🏡",
      label: isAr ? "ريفي" : "Countryside",
    },
    {
      key: "pool",
      icon: "🏊",
      label: isAr ? "مسبح" : "Pool",
    },
    {
      key: "desert",
      icon: "🏜️",
      label: isAr ? "صحراء" : "Desert",
    },
    {
      key: "camping",
      icon: "🏕️",
      label: isAr ? "تخييم" : "Camping",
    },
    {
      key: "cabins",
      icon: "🛖",
      label: isAr ? "كوخ" : "Cabins",
    },
  ];

  const cardColors = [
    "bg-amber-50",
    "bg-sky-50",
    "bg-purple-50",
    "bg-emerald-50",
    "bg-pink-50",
    "bg-lime-50",
  ];

  const activeCatLabel = categories.find(
    (c) => c.key === activeCategory,
  )?.label;

  // ============================================================
  // FILTERED LISTINGS
  // ============================================================

  const filteredListings = activeCategory
    ? listings.filter((listing) => {
        const haystack = [
          (listing as any).category,
          (listing as any).type,
          (listing as any).propertyType,
          ...(Array.isArray((listing as any).tags)
            ? (listing as any).tags
            : []),
          listing.title,
          listing.description,
        ]
          .filter((s): s is string => Boolean(s))
          .map((s) => s.toLowerCase());

        return haystack.some((s) =>
          s.includes(activeCategory.toLowerCase()),
        );
      })
    : listings;

  // ============================================================
  // FETCH STATS
  // ============================================================

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/stats/simple`);

      const data = await res.json();

      if (!res.ok) {
        throw new Error(
          data.message || "Failed to fetch statistics",
        );
      }

      if (data.success && data.data) {
        setStats({
          total_travelers:
            Number(data.data.total_travelers) || 0,

          total_hosts:
            Number(data.data.total_hosts) || 0,

          total_bookings:
            Number(data.data.total_bookings) || 0,

          total_listings:
            Number(data.data.total_listings) || 0,
        });
      }
    } catch (error) {
      console.error("Error fetching stats:", error);
    }
  }, []);

  // ============================================================
  // FETCH LISTINGS
  // ============================================================

  // IMPORTANT:
  // This callback intentionally does NOT depend on `distance`.
  //
  // The distance is passed explicitly to this function.
  // This prevents changing the distance from recreating the
  // callback and accidentally triggering geolocation again.

  const fetchListings = useCallback(
    async (coords: Coords | null, radius: number) => {
      setListingsLoading(true);

      try {
        // ========================================================
        // USER LOCATION → NEARBY LISTINGS
        // ========================================================

        if (coords) {
          const params = new URLSearchParams({
            lat: String(coords.lat),
            lng: String(coords.lng),
            radius: String(radius),
            limit: "100",
          });

          console.log("📍 Fetching nearby listings:", {
            lat: coords.lat,
            lng: coords.lng,
            radius,
          });

          const res = await fetch(
            `${API_BASE}/listings/nearby?${params.toString()}`,
          );

          if (!res.ok) {
            const errorData = await res
              .json()
              .catch(() => null);

            throw new Error(
              errorData?.error || `HTTP ${res.status}`,
            );
          }

          const data = await res.json();

          console.log("🏠 Nearby listings:", data);

          setListings(parseListings(data));

          setLocationPermission(true);

          return;
        }

        // ========================================================
        // NO LOCATION → NORMAL LISTINGS
        // ========================================================

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
    },
    [],
  );

  // ============================================================
  // GET USER LOCATION
  // ============================================================

  // NOTE:
  // This callback reads language from `isArRef`.
  // It does not depend on `isAr`, so changing language will NOT
  // request the user's location again.

  const getUserLocation = useCallback(() => {
    setLocationError(null);

    const ar = isArRef.current;

    // ==========================================================
    // GEOLOCATION NOT SUPPORTED
    // ==========================================================

    if (!navigator.geolocation) {
      setLocationError(
        ar
          ? "متصفحك لا يدعم تحديد الموقع"
          : "Your browser doesn't support geolocation",
      );

      setUserCoords(null);

      fetchListings(null, distance);

      return;
    }

    setListingsLoading(true);

    // ==========================================================
    // REQUEST LOCATION
    // ==========================================================

    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const c: Coords = {
          lat: coords.latitude,
          lng: coords.longitude,
        };

        console.log("📍 User location:", c);

        // Do NOT fetch here.
        //
        // The useEffect below watches userCoords + distance
        // and performs the listing request.
        //
        // This prevents duplicate requests.

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
        fetchListings(null, distance);
      },

      {
        timeout: 10000,
        maximumAge: 60000,
      },
    );
  }, [fetchListings, distance]);

  // ============================================================
  // REFRESH LISTINGS WHEN LOCATION OR DISTANCE CHANGES
  // ============================================================

  useEffect(() => {
    if (!userCoords) {
      return;
    }

    fetchListings(userCoords, distance);
  }, [userCoords, distance, fetchListings]);

  // ============================================================
  // INITIAL DATA LOAD
  // ============================================================

  useEffect(() => {
    fetchStats();

    getUserLocation();
  }, [fetchStats, getUserLocation]);

  // ============================================================
  // HANDLERS
  // ============================================================

  const handleCategoryClick = (key: string) => {
    setActiveCategory((prev) =>
      prev === key ? null : key,
    );
  };

  // ============================================================
  // USER INITIALS
  // ============================================================

  const userInitials =
    user?.name
      ?.split(" ")
      .map((n) => n[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() ?? "?";

  // Avoid unused-variable TypeScript warning if userInitials
  // isn't currently displayed.
  void userInitials;

  // ============================================================
  // NAV LINKS
  // ============================================================

  const NAV_LINKS: NavLink[] = isAuthenticated
    ? [
        {
          id: "listings",
          label: isAr ? "تصفح" : "Browse",
          href: "/listings",
        },
      ]
    : [
        {
          id: "how-to-book",
          label: isAr ? "كيفية الحجز" : "How to Book",
          href: "/how-to-book",
        },
        {
          id: "start-hosting",
          label: isAr ? "ابدأ الاستضافة" : "Start Hosting",
          href: "/start-hosting",
        },
      ];

  // ============================================================
  // LOADING
  // ============================================================

  if (authLoading) {
    return <LoadingScreen />;
  }

  // ============================================================
  // RENDER
  // ============================================================

  return (
    <div
      dir={isAr ? "rtl" : "ltr"}
      className="bg-white min-h-screen text-gray-900"
    >
      {/* NAVBAR */}

      <Navbar
        NAV_LINKS={NAV_LINKS}
        user={isAuthenticated ? user : null}
        lang={lang}
        toggleLanguage={toggleLanguage}
      />

      {/* ========================================================
          CATEGORIES
      ======================================================== */}

      <div className="border-b border-gray-100">
        <div className="max-w-screen-xl mx-auto px-4 sm:px-6 pt-8">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
            <p className="text-[10px] tracking-[0.12em] uppercase text-gray-400 font-semibold">
              {isAr ? "تصفح حسب النوع" : "Browse by type"}
            </p>

            <button
              onClick={getUserLocation}
              disabled={listingsLoading}
              aria-label={
                isAr
                  ? "أظهر القريب مني"
                  : "Show listings near me"
              }
              className="bg-[#1a1a2e] hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed border-none rounded-full px-4 py-1.5 text-[12px] flex items-center gap-2 cursor-pointer transition-all text-yellow-400 font-medium"
            >
              <span>📍</span>

              {listingsLoading
                ? isAr
                  ? "جاري التحميل..."
                  : "Loading..."
                : locationPermission
                  ? isAr
                    ? "قريب منك"
                    : "Near you"
                  : isAr
                    ? "أظهر القريب مني"
                    : "Show near me"}
            </button>
          </div>

          <div className="flex gap-3 overflow-x-auto pb-4 scrollbar-hide">
            {categories.map((cat) => (
              <div
                key={cat.key}
                onClick={() =>
                  handleCategoryClick(cat.key)
                }
                title={
                  isAr
                    ? `تصفية: ${cat.label}`
                    : `Filter: ${cat.label}`
                }
                className={`flex items-center gap-2 cursor-pointer flex-shrink-0 px-4 py-2.5 rounded-xl border transition-all ${
                  activeCategory === cat.key
                    ? "border-yellow-400 bg-yellow-50 text-gray-900"
                    : "border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50"
                }`}
              >
                <span className="text-lg leading-none">
                  {cat.icon}
                </span>

                <span className="text-xs font-medium whitespace-nowrap">
                  {cat.label}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ========================================================
          LISTINGS
      ======================================================== */}

      <div className="max-w-screen-xl mx-auto px-4 sm:px-6 py-10">
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <div>
            <h2
              className={`font-semibold text-[clamp(20px,4vw,28px)] text-gray-900 ${
                isAr ? "font-arabic" : ""
              }`}
            >
              {activeCategory
                ? isAr
                  ? `أماكن: ${activeCatLabel}`
                  : `${activeCatLabel} stays`
                : locationPermission
                  ? isAr
                    ? "أماكن قريبة منك"
                    : "Places near you"
                  : isAr
                    ? "أماكن إقامة مميزة"
                    : "Featured stays"}
            </h2>

            {activeCategory && (
              <button
                onClick={() => setActiveCategory(null)}
                className="mt-1.5 inline-flex items-center gap-1.5 bg-gray-100 text-gray-700 border-none rounded-full px-3 py-1 text-xs cursor-pointer hover:bg-gray-200 transition-colors"
              >
                {
                  categories.find(
                    (c) => c.key === activeCategory,
                  )?.icon
                }{" "}

                {activeCatLabel}

                <span className="opacity-70 ms-0.5">
                  ✕
                </span>
              </button>
            )}
          </div>

          {/* ======================================================
              RIGHT SIDE CONTROLS
          ====================================================== */}

          <div className="flex items-center gap-3 flex-wrap">
            {locationError && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-full px-3 py-1.5 text-xs text-yellow-700 inline-flex items-center gap-1.5">
                <span>📍</span>
                {locationError}
              </div>
            )}

            {/* DISTANCE SELECTOR */}

            {locationPermission && userCoords && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500">
                  {isAr ? "المسافة" : "Distance"}
                </span>

                <select
                  value={distance}
                  onChange={(e) => {
                    setDistance(Number(e.target.value));
                  }}
                  className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white cursor-pointer focus:outline-none focus:ring-2 focus:ring-yellow-400/50"
                  aria-label={
                    isAr
                      ? "اختيار المسافة"
                      : "Select distance"
                  }
                >
                  <option value={5}>5 km</option>
                  <option value={10}>10 km</option>
                  <option value={20}>20 km</option>
                  <option value={50}>50 km</option>
                  <option value={100}>100 km</option>
                </select>
              </div>
            )}

            <Link
              to="/listings"
              className="text-sm font-semibold text-gray-900 hover:text-yellow-600 transition-colors"
            >
              {isAr ? "عرض الكل" : "Show all"} →
            </Link>
          </div>
        </div>

        {/* MAP */}

        <ListingsMap
          listings={filteredListings}
          userLocation={userCoords}
          isAr={isAr}
          onSelect={(id) =>
            navigate(`/listings/${id}`)
          }
          className="w-full h-[420px] sm:h-[520px] mb-8 rounded-2xl overflow-hidden border border-gray-100"
        />

        {/* ======================================================
            LOADING
        ====================================================== */}

        {listingsLoading ? (
          <div className="min-h-[300px] sm:min-h-[400px] flex items-center justify-center">
            <div className="w-10 h-10 border-[3px] border-yellow-400 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filteredListings.length === 0 ? (
          /* ====================================================
             EMPTY STATE
          ==================================================== */

          <div className="text-center py-16 px-6 bg-gray-50 rounded-2xl border border-gray-100">
            <div className="text-5xl mb-4">
              {activeCategory
                ? categories.find(
                    (c) => c.key === activeCategory,
                  )?.icon
                : "🏠"}
            </div>

            <p className="text-gray-500 text-sm mb-4">
              {activeCategory
                ? isAr
                  ? `لا توجد إقامات من نوع "${activeCatLabel}"`
                  : `No ${activeCatLabel} stays found near you`
                : isAr
                  ? "لا توجد قوائم قريبة من موقعك"
                  : "No listings found near your location"}
            </p>

            {activeCategory ? (
              <button
                onClick={() => setActiveCategory(null)}
                className="bg-transparent border-none text-yellow-600 cursor-pointer text-sm font-medium underline"
              >
                {isAr
                  ? "← عرض كل الإقامات"
                  : "← Show all stays"}
              </button>
            ) : (
              <button
                onClick={getUserLocation}
                className="bg-transparent border-none text-yellow-600 cursor-pointer text-sm font-medium underline"
              >
                {isAr ? "حاول مرة أخرى" : "Try again"} →
              </button>
            )}
          </div>
        ) : (
          /* ====================================================
             LISTING CARDS
          ==================================================== */

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredListings.map((listing, index) => (
              <div
                key={listing.id ?? index}
                onClick={() =>
                  navigate(`/listings/${listing.id}`)
                }
                className="cursor-pointer rounded-2xl overflow-hidden border border-gray-100 hover:shadow-lg hover:-translate-y-1 transition-all"
              >
                <div
                  className={`w-full aspect-[4/3] overflow-hidden relative ${
                    cardColors[index % cardColors.length]
                  }`}
                >
                  {listing.images?.[0] ? (
                    <img
                      src={listing.images[0]}
                      alt={listing.title}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-5xl">
                      {["🏙️", "🏡", "🏛️", "🕌"][
                        index % 4
                      ]}
                    </div>
                  )}

                  {/* FAVORITE */}

                  <button
                    type="button"
                    aria-label={
                      isAr
                        ? "أضف إلى المفضلة"
                        : "Add to favorites"
                    }
                    onClick={(e) => {
                      e.stopPropagation();
                    }}
                    className="absolute top-3 end-3 bg-white/90 rounded-full w-8 h-8 flex items-center justify-center cursor-pointer hover:bg-white transition-colors border-none shadow-sm"
                  >
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 14 14"
                      fill="none"
                    >
                      <path
                        d="M7 12.5S1 9 1 4.5a3 3 0 0 1 6 0 3 3 0 0 1 6 0C13 9 7 12.5 7 12.5z"
                        stroke="#222"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </button>

                  {/* FEATURED */}

                  <div className="absolute top-3 start-3 bg-white text-gray-900 rounded-md px-2.5 py-1 text-[11px] font-semibold shadow-sm">
                    {isAr
                      ? "🏆 مميز"
                      : "🏆 Featured"}
                  </div>

                  {/* DISTANCE */}

                  {(listing as any).distance !==
                    undefined &&
                    (listing as any).distance !== null && (
                      <div className="absolute bottom-3 end-3 bg-black/70 text-white rounded-full px-2.5 py-1 text-[11px] font-medium">
                        📍{" "}
                        {Number(
                          (listing as any).distance,
                        ).toFixed(1)}{" "}
                        {isAr ? "كم" : "km"}
                      </div>
                    )}
                </div>

                {/* LISTING INFO */}

                <div className="px-4 py-3">
                  <div className="font-semibold text-sm text-gray-900 mb-0.5">
                    {(listing as any).location?.split(
                      ",",
                    )[0] ||
                      listing.title?.slice(0, 30)}
                  </div>

                  <div className="text-[13px] text-gray-400 mb-1.5">
                    {listing.title?.slice(0, 50) ||
                      "Beautiful Space"}
                  </div>

                  <div className="text-sm text-gray-900">
                    <strong className="font-bold">
                      {listing.price}
                    </strong>{" "}
                    {isAr ? "دينار" : "LYD"} /{" "}
                    {isAr ? "ليلة" : "night"}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ========================================================
          STATS
      ======================================================== */}

      <div className="bg-[#1a1a2e] my-10 py-10 sm:py-12 px-4 sm:px-6 rounded-none">
        <div className="max-w-3xl mx-auto grid grid-cols-2 sm:grid-cols-4 gap-6 text-center">
          {[
            {
              val: stats.total_travelers?.toLocaleString(),
              suffix: "+",
              label: content.happyTravelers,
            },
            {
              val: stats.total_hosts?.toLocaleString(),
              suffix: "+",
              label: content.activeHosts,
            },
            {
              val: stats.total_bookings?.toLocaleString(),
              suffix: "+",
              label: content.bookingsMade,
            },
            {
              val: stats.total_listings?.toLocaleString(),
              suffix: "+",
              label: content.listingMade,
            },
          ].map(({ val, suffix, label }) => (
            <div key={label}>
              <div
                className={`font-bold text-[clamp(24px,5vw,38px)] leading-none text-white mb-1.5 ${
                  isAr ? "font-arabic" : ""
                }`}
              >
                {val}

                <span className="text-yellow-400">
                  {suffix}
                </span>
              </div>

              <div className="text-[11px] sm:text-[12px] tracking-widest uppercase text-white/40">
                {label}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ========================================================
          CHOOSE PATH
      ======================================================== */}

      <div className="max-w-screen-xl mx-auto px-4 sm:px-6 py-10">
        <div className="mb-7">
          <div className="text-[10px] tracking-[0.12em] uppercase text-gray-400 mb-1.5">
            {content.whoAreYou}
          </div>

          <h2
            className={`font-semibold text-[clamp(20px,4vw,28px)] text-gray-900 ${
              isAr ? "font-arabic" : ""
            }`}
          >
            {content.choosePath}
          </h2>
        </div>

        <p className="text-sm text-gray-400 mb-7">
          {isAr
            ? "اكتشف كيف يمكننا مساعدتك في رحلتك"
            : "Discover how we can help with your journey"}
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {/* TRAVELER */}

          <div className="rounded-2xl p-7 sm:p-9 relative overflow-hidden min-h-[300px] sm:min-h-[340px] flex flex-col justify-end border border-gray-100 bg-white">
            <div
              className={`text-4xl sm:text-5xl absolute top-6 sm:top-7 ${
                isAr
                  ? "left-6 sm:left-7"
                  : "right-6 sm:right-7"
              }`}
            >
              ✈️
            </div>

            <span className="inline-block px-3 py-1 rounded-full text-[11px] font-semibold mb-3 bg-[#0C447C22] text-[#0C447C] w-fit">
              {content.traveler}
            </span>

            <div
              className={`font-semibold text-[20px] sm:text-[24px] leading-[1.2] text-gray-900 mb-3 ${
                isAr ? "font-arabic" : ""
              }`}
            >
              {content.travelerTagline}
            </div>

            <p className="text-[13px] leading-[1.7] text-gray-500 mb-5">
              {content.travelerDesc}
            </p>

            <ul className="list-none mb-6 flex flex-col gap-2">
              {[
                content.travelerPerk1,
                content.travelerPerk2,
                content.travelerPerk3,
                content.travelerPerk4,
              ].map((p) => (
                <li
                  key={p}
                  className="flex items-center gap-2.5 text-[13px] text-gray-700"
                >
                  <span className="w-[18px] h-[18px] rounded-full bg-[#0C447C] flex items-center justify-center shrink-0">
                    <svg
                      width="8"
                      height="8"
                      viewBox="0 0 8 8"
                      fill="none"
                    >
                      <path
                        d="M1 4l2 2 4-4"
                        stroke="#fff"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </span>

                  {p}
                </li>
              ))}
            </ul>

            {!isAuthenticated && (
              <Link
                to="/signup"
                className="inline-flex items-center gap-1.5 bg-[#1a1a2e] text-yellow-400 px-5 py-2.5 rounded-lg text-[13px] font-semibold no-underline hover:opacity-85 transition-opacity w-fit"
              >
                {content.getStartedAs}{" "}
                {content.traveler?.toLowerCase()} →
              </Link>
            )}
          </div>

          {/* HOST */}

          <div className="rounded-2xl p-7 sm:p-9 relative overflow-hidden min-h-[300px] sm:min-h-[340px] flex flex-col justify-end bg-[#1a1a2e]">
            <div
              className={`text-4xl sm:text-5xl absolute top-6 sm:top-7 ${
                isAr
                  ? "left-6 sm:left-7"
                  : "right-6 sm:right-7"
              }`}
            >
              🏠
            </div>

            <span className="inline-block px-3 py-1 rounded-full text-[11px] font-semibold mb-3 bg-yellow-400/15 text-yellow-400 w-fit">
              {content.host}
            </span>

            <div
              className={`font-semibold text-[20px] sm:text-[24px] leading-[1.2] text-white mb-3 ${
                isAr ? "font-arabic" : ""
              }`}
            >
              {content.hostTagline}
            </div>

            <p className="text-[13px] leading-[1.7] text-white/50 mb-5">
              {content.hostDesc}
            </p>

            <ul className="list-none mb-6 flex flex-col gap-2">
              {[
                content.hostPerk1,
                content.hostPerk2,
                content.hostPerk3,
                content.hostPerk4,
              ].map((p) => (
                <li
                  key={p}
                  className="flex items-center gap-2.5 text-[13px] text-white/80"
                >
                  <span className="w-[18px] h-[18px] rounded-full bg-yellow-400 flex items-center justify-center shrink-0">
                    <svg
                      width="8"
                      height="8"
                      viewBox="0 0 8 8"
                      fill="none"
                    >
                      <path
                        d="M1 4l2 2 4-4"
                        stroke="#1a1a2e"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </span>

                  {p}
                </li>
              ))}
            </ul>

            {!isAuthenticated && (
              <Link
                to="/signup"
                className="inline-flex items-center gap-1.5 bg-yellow-400 text-[#1a1a2e] px-5 py-2.5 rounded-lg text-[13px] font-semibold no-underline hover:opacity-85 transition-opacity w-fit"
              >
                {content.getStartedAs}{" "}
                {content.host?.toLowerCase()} →
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* ========================================================
          CTA
      ======================================================== */}

      {!isAuthenticated && (
        <div className="max-w-screen-xl mx-auto px-4 sm:px-6 py-10">
          <div className="relative bg-[#1a1a2e] rounded-2xl px-6 sm:px-12 py-12 sm:py-16 text-center overflow-hidden">
            <div className="relative z-10">
              <div className="text-[10px] tracking-[0.12em] uppercase text-yellow-400/60 mb-3">
                {content.ready}
              </div>

              <h2
                className={`font-semibold text-[clamp(22px,5vw,36px)] text-white mb-3 leading-[1.15] ${
                  isAr ? "font-arabic" : ""
                }`}
              >
                {content.ctaTitle}
              </h2>

              <p className="text-sm sm:text-[15px] text-white/45 max-w-[460px] mx-auto mb-7 leading-[1.75]">
                {content.ctaDesc}
              </p>

              <div className="flex gap-3 justify-center flex-wrap">
                <Link
                  to="/signup"
                  className="bg-yellow-400 text-[#1a1a2e] px-6 sm:px-7 py-3 sm:py-3.5 rounded-lg text-sm font-bold no-underline"
                >
                  {content.createAccount} →
                </Link>

                <Link
                  to="/login"
                  className="bg-white/10 text-white px-6 sm:px-7 py-3 sm:py-3.5 rounded-lg text-sm font-medium no-underline border border-white/20"
                >
                  {content.signIn}
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          FOOTER
      ======================================================== */}

      <footer className="bg-[#111] px-4 sm:px-6 pt-12 pb-7">
        <div className="max-w-screen-xl mx-auto">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 mb-10 pb-10 border-b border-[#222]">
            <div>
              <Link
                to="/"
                className="no-underline font-medium text-[26px] tracking-wide font-arabic"
                style={{ color: "#ffffff" }}
              >
                مر
                <span
                  className="font-bold"
                  style={{ color: "#e8c547" }}
                >
                  حبا
                </span>
              </Link>

              <p className="text-sm text-[#555] leading-[1.7] mt-3">
                {content.footerDesc}
              </p>
            </div>

            {[
              {
                heading: content.travelersHeading,
                links: [
                  {
                    label: content.howToBook,
                    href: "/how-to-book",
                  },
                  {
                    label: content.paymentMethods,
                    href: "/payment-methods",
                  },
                  {
                    label: content.travelTips,
                    href: "/travel-tips",
                  },
                ],
              },
              {
                heading: content.hostsHeading,
                links: [
                  {
                    label: content.startHosting,
                    href: "/start-hosting",
                  },
                  {
                    label: content.hostResources,
                    href: "/host-resources",
                  },
                  {
                    label: content.pricingTips,
                    href: "/pricing-tips",
                  },
                ],
              },
              {
                heading: content.supportHeading,
                links: [
                  {
                    label: content.helpCenter,
                    href: "/help-center",
                  },
                  {
                    label: content.safetyInfo,
                    href: "/safety-info",
                  },
                  {
                    label: content.contactUs,
                    href: "/contact",
                  },
                ],
              },
            ].map(({ heading, links }) => (
              <div key={heading}>
                <div className="text-[11px] tracking-[0.1em] uppercase text-[#555] mb-4 font-semibold">
                  {heading}
                </div>

                {links.map((link) => (
                  <Link
                    key={link.href}
                    to={link.href}
                    className="block text-[13px] text-[#999] no-underline mb-2.5 hover:text-yellow-400 transition-colors"
                  >
                    {link.label}
                  </Link>
                ))}
              </div>
            ))}
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <p className="text-xs text-[#444]">
              &copy;{year} Marhaba. {content.rights}
            </p>

            <div className="flex gap-5">
              <Link
                to="/privacy"
                className="text-xs text-[#999] no-underline hover:text-yellow-400 transition-colors"
              >
                {content.privacy}
              </Link>

              <Link
                to="/terms"
                className="text-xs text-[#999] no-underline hover:text-yellow-400 transition-colors"
              >
                {content.terms}
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}