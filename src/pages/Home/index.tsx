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

type Coords = { lat: number; lng: number };

const API_BASE =
  import.meta.env.VITE_API_URL || "https://api.mar-haba.ly/api/v1";

// Pull the listings array out of whichever shape the API returned.
// Handles: { listings }, { data: [...] }, { data: { listings: [...] } }
const parseListings = (data: any): Listing[] => {
  if (Array.isArray(data?.listings)) return data.listings;
  if (Array.isArray(data?.data?.listings)) return data.data.listings;
  if (Array.isArray(data?.data)) return data.data;
  return [];
};

export default function Home() {
  const navigate = useNavigate();
  const { lang, t, toggleLanguage } = useLanguage();

  const content = t;
  const isAr = lang === "ar";

  // Keep a ref so callbacks that must not depend on `isAr` still see the
  // latest value without being re-created on every language toggle.
  const isArRef = useRef(isAr);
  isArRef.current = isAr;

  // ============================================================
  // AUTH STATE
  // ============================================================

  const { user, isAuthenticated, isLoading: authLoading } = useAuth();

  const userType = (user?.role || "user").toLowerCase();

  // ============================================================
  // UI STATE
  // ============================================================

  const [year] = useState(new Date().getFullYear());
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  // ============================================================
  // LISTINGS + LOCATION STATE
  // ============================================================

  const [listings, setListings] = useState<Listing[]>([]);
  const [userCoords, setUserCoords] = useState<Coords | null>(null);
  const [listingsLoading, setListingsLoading] = useState(true);
  const [locationError, setLocationError] = useState<string | null>(null);
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
    { key: "beachfront", icon: "🏖️", label: isAr ? "شاطئ" : "Beachfront" },
    { key: "mountain", icon: "🏔️", label: isAr ? "جبال" : "Mountain" },
    { key: "city", icon: "🏙️", label: isAr ? "مدينة" : "City" },
    { key: "countryside", icon: "🏡", label: isAr ? "ريفي" : "Countryside" },
    { key: "pool", icon: "🏊", label: isAr ? "مسبح" : "Pool" },
    { key: "desert", icon: "🏜️", label: isAr ? "صحراء" : "Desert" },
    { key: "camping", icon: "🏕️", label: isAr ? "تخييم" : "Camping" },
    { key: "cabins", icon: "🛖", label: isAr ? "كوخ" : "Cabins" },
  ];

  const cardColors = [
    "bg-amber-100",
    "bg-sky-100",
    "bg-purple-100",
    "bg-emerald-100",
    "bg-pink-100",
    "bg-lime-100",
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

        return haystack.some((s) => s.includes(activeCategory.toLowerCase()));
      })
    : listings;

  // ============================================================
  // FETCH STATS (public, no token)
  // ============================================================

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
    }
  }, []);

  // ============================================================
  // FETCH LISTINGS
  // ============================================================

  const fetchListings = useCallback(async (coords: Coords | null) => {
    setListingsLoading(true);

    try {
      if (coords) {
        const params = new URLSearchParams({
          lat: String(coords.lat),
          lng: String(coords.lng),
          radius: "100",
          limit: "100",
        });

        const res = await fetch(
          `${API_BASE}/listings)}`,
        );

        if (res.ok) {
          const list = parseListings(await res.json());

          if (list.length > 0) {
            setListings(list);
            setLocationPermission(true);
            return;
          }
        }
      }

      const res = await fetch(`${API_BASE}/listings`);

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      setListings(parseListings(await res.json()));
      setLocationPermission(false);
    } catch (error) {
      console.error("Error fetching listings:", error);
      // Clear stale data so the UI shows the empty state instead of
      // listings from a previous successful request.
      setListings([]);
      setLocationPermission(false);
    } finally {
      setListingsLoading(false);
    }
  }, []);

  // ============================================================
  // GET USER LOCATION
  //
  // NOTE: reads language from `isArRef` so this callback does NOT
  // need to depend on `isAr` (which would re-request geolocation on
  // every language toggle).
  // ============================================================

  const getUserLocation = useCallback(() => {
    setLocationError(null);
    const ar = isArRef.current;

    if (!navigator.geolocation) {
      setLocationError(
        ar
          ? "متصفحك لا يدعم تحديد الموقع"
          : "Your browser doesn't support geolocation",
      );

      fetchListings(null);
      return;
    }

    setListingsLoading(true);

    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const c = { lat: coords.latitude, lng: coords.longitude };
        setUserCoords(c);
        fetchListings(c);
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

        fetchListings(null);
      },

      {
        timeout: 10000,
        maximumAge: 60000,
      },
    );
  }, [fetchListings]);

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
    setActiveCategory((prev) => (prev === key ? null : key));
  };

  const getDashboardRoute = () => {
    switch (userType) {
      case "host":
        return "/host-dashboard";
      case "admin":
      case "super_admin":
        return "/admin";
      default:
        return "/user-dashboard";
    }
  };

  const getDashboardLabel = () => {
    switch (userType) {
      case "host":
        return isAr ? "لوحة المضيف" : "Host Dashboard";
      case "admin":
      case "super_admin":
        return isAr ? "لوحة الإدارة" : "Admin Dashboard";
      default:
        return isAr ? "لوحة المستخدم" : "User Dashboard";
    }
  };

  const handleDashboardRedirect = () => {
    navigate(getDashboardRoute());
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

  // ============================================================
  // NAV LINKS
  // ============================================================

  const NAV_LINKS: NavLink[] = isAuthenticated
    ? [{ id: "listings", label: isAr ? "تصفح" : "Browse", href: "/listings" }]
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
        ini={userInitials}
      />

      {/* HERO */}
      <section className="relative min-h-[480px] sm:min-h-[580px] flex items-center overflow-hidden bg-gradient-to-br from-[#1a1a2e] via-[#2d2d5e] to-[#1a1a2e]">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_20%_50%,rgba(232,197,71,0.15)_0%,transparent_60%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_80%_20%,rgba(55,138,221,0.1)_0%,transparent_50%)]" />
          <div
            className="absolute inset-0 opacity-[0.04]"
            style={{
              backgroundImage:
                "repeating-linear-gradient(45deg,#e8c547 0px,#e8c547 1px,transparent 1px,transparent 40px)",
            }}
          />
        </div>

        <div className="relative max-w-screen-xl mx-auto px-4 sm:px-6 py-14 sm:py-20 w-full">
          <div className="inline-flex items-center gap-2 bg-yellow-400/15 border border-yellow-400/30 text-yellow-400 px-3.5 py-1.5 rounded-full text-[10px] sm:text-[11px] tracking-widest uppercase mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 shrink-0" />
            {content.heroBadge}
          </div>

          <h1
            className={`font-light text-[clamp(32px,8vw,72px)] text-white leading-[1.1] max-w-[640px] mb-5 ${
              isAr ? "font-arabic" : "font-serif italic"
            }`}
          >
            {content.heroTitle1} {content.heroTitle2}{" "}
            <em className="not-italic text-yellow-400">{content.heroTitle3}</em>
          </h1>

          <p className="text-sm sm:text-base text-white/60 max-w-[480px] leading-[1.75] mb-9">
            {content.heroSubtitle}
          </p>

          {isAuthenticated ? (
            <div className="flex gap-3 flex-wrap">
              <button
                onClick={handleDashboardRedirect}
                className="inline-flex items-center gap-2 bg-yellow-400 text-[#1a1a2e] px-6 sm:px-7 py-3 sm:py-3.5 rounded-xl text-sm font-semibold border-none cursor-pointer hover:bg-yellow-300 hover:-translate-y-px transition-all"
              >
                {getDashboardLabel()} →
              </button>

              <Link
                to="/listings"
                className="inline-flex items-center gap-2 bg-white/10 text-white px-6 sm:px-7 py-3 sm:py-3.5 rounded-xl text-sm font-medium no-underline border border-white/20 hover:bg-white/15 transition-colors"
              >
                {isAr ? "تصفح الإقامات" : "Browse Stays"}
              </Link>
            </div>
          ) : (
            <div className="flex gap-3 flex-wrap">
              <Link
                to="/signup"
                className="inline-flex items-center gap-2 bg-yellow-400 text-[#1a1a2e] px-6 sm:px-7 py-3 sm:py-3.5 rounded-xl text-sm font-semibold no-underline hover:bg-yellow-300 hover:-translate-y-px transition-all"
              >
                {content.createAccount} →
              </Link>

              <Link
                to="/login"
                className="inline-flex items-center gap-2 bg-white/10 text-white px-6 sm:px-7 py-3 sm:py-3.5 rounded-xl text-sm font-medium no-underline border border-white/20 hover:bg-white/15 transition-colors"
              >
                {content.signIn}
              </Link>
            </div>
          )}

          <div className="flex gap-5 sm:gap-7 mt-10 flex-wrap">
            {[
              content.verifiedHosts,
              content.securePayments,
              content.support247,
            ].map((item) => (
              <div
                key={item}
                className="flex items-center gap-2 text-xs text-white/50"
              >
                <span className="w-[18px] h-[18px] rounded-full bg-yellow-400/20 border border-yellow-400/40 flex items-center justify-center shrink-0">
                  <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                    <path
                      d="M1 4l2 2 4-4"
                      stroke="#e8c547"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </span>
                {item}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CATEGORIES */}
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
                isAr ? "أظهر القريب مني" : "Show listings near me"
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

          <div className="flex gap-6 sm:gap-8 overflow-x-auto pb-4 scrollbar-hide">
            {categories.map((cat) => (
              <div
                key={cat.key}
                onClick={() => handleCategoryClick(cat.key)}
                title={isAr ? `تصفية: ${cat.label}` : `Filter: ${cat.label}`}
                className={`flex flex-col items-center gap-2 cursor-pointer flex-shrink-0 pb-2 border-b-2 transition-all ${
                  activeCategory === cat.key
                    ? "opacity-100 border-yellow-400"
                    : "opacity-50 border-transparent hover:opacity-80"
                }`}
              >
                <span className="text-2xl">{cat.icon}</span>
                <span className="text-xs font-medium whitespace-nowrap text-gray-900">
                  {cat.label}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* LISTINGS */}
      <div className="max-w-screen-xl mx-auto px-4 sm:px-6 py-10">
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <div>
            <h2
              className={`font-light text-[clamp(20px,4vw,30px)] text-gray-900 ${
                isAr ? "font-arabic" : "font-serif italic"
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
                className="mt-1.5 inline-flex items-center gap-1.5 bg-[#1a1a2e] text-yellow-400 border-none rounded-full px-3 py-1 text-xs cursor-pointer"
              >
                {categories.find((c) => c.key === activeCategory)?.icon}{" "}
                {activeCatLabel}
                <span className="opacity-70 ms-0.5">✕</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-3">
            {locationError && (
              <div className="bg-yellow-400/20 rounded-2xl px-3 py-1.5 text-xs text-yellow-700 inline-flex items-center gap-1.5">
                <span>📍</span>
                {locationError}
              </div>
            )}

            <Link
              to="/listings"
              className="text-sm font-semibold text-gray-900 underline cursor-pointer"
            >
              {isAr ? "عرض الكل" : "Show all"} →
            </Link>
          </div>
        </div>

        <ListingsMap
          listings={filteredListings}
          userLocation={userCoords}
          isAr={isAr}
          onSelect={(id) => navigate(`/listings/${id}`)}
          className="w-full h-[420px] sm:h-[520px] mb-8"
        />

        {listingsLoading ? (
          <div className="min-h-[300px] sm:min-h-[400px] flex items-center justify-center">
            <div className="w-10 h-10 border-[3px] border-yellow-400 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filteredListings.length === 0 ? (
          <div className="text-center py-16 px-6 bg-gray-50 rounded-2xl">
            <div className="text-5xl mb-4">
              {activeCategory
                ? categories.find((c) => c.key === activeCategory)?.icon
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
                className="bg-transparent border-none text-yellow-500 cursor-pointer text-sm underline"
              >
                {isAr ? "← عرض كل الإقامات" : "← Show all stays"}
              </button>
            ) : (
              <button
                onClick={getUserLocation}
                className="bg-transparent border-none text-yellow-500 cursor-pointer text-sm underline"
              >
                {isAr ? "حاول مرة أخرى" : "Try again"} →
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredListings.map((listing, index) => (
              <div
                key={listing.id ?? index}
                onClick={() => navigate(`/listings/${listing.id}`)}
                className="cursor-pointer rounded-2xl overflow-hidden hover:-translate-y-1 transition-transform"
              >
                <div
                  className={`w-full aspect-[4/3] rounded-2xl overflow-hidden relative mb-3 ${
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
                      {["🏙️", "🏡", "🏛️", "🕌"][index % 4]}
                    </div>
                  )}

                  <button
                    type="button"
                    aria-label={
                      isAr ? "أضف إلى المفضلة" : "Add to favorites"
                    }
                    className="absolute top-3 end-3 bg-white/90 rounded-full w-8 h-8 flex items-center justify-center cursor-pointer hover:bg-white transition-colors border-none"
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

                  <div className="absolute top-3 start-3 bg-white text-gray-900 rounded-md px-2.5 py-1 text-[11px] font-semibold">
                    {isAr ? "🏆 مميز" : "🏆 Featured"}
                  </div>

                  {(listing as any).distance !== undefined &&
                    (listing as any).distance !== null && (
                      <div className="absolute bottom-3 end-3 bg-black/70 text-white rounded-full px-2.5 py-1 text-[11px] font-medium">
                        📍 {(listing as any).distance} {isAr ? "كم" : "km"}
                      </div>
                    )}
                </div>

                <div className="px-1">
                  <div className="font-semibold text-sm text-gray-900 mb-0.5">
                    {(listing as any).location?.split(",")[0] ||
                      listing.title?.slice(0, 30)}
                  </div>

                  <div className="text-[13px] text-gray-400 mb-1">
                    {listing.title?.slice(0, 50) || "Beautiful Space"}
                  </div>

                  <div className="text-sm text-gray-900">
                    <strong className="font-bold">{listing.price}</strong>{" "}
                    {isAr ? "دينار" : "LYD"} / {isAr ? "ليلة" : "night"}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* STATS */}
      <div className="bg-[#1a1a2e] my-10 py-10 sm:py-12 px-4 sm:px-6">
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
                className={`font-light text-[clamp(28px,5vw,44px)] leading-none text-white mb-1.5 ${
                  isAr ? "font-arabic" : "font-serif italic"
                }`}
              >
                {val}
                <span className="text-yellow-400">{suffix}</span>
              </div>

              <div className="text-[11px] sm:text-[12px] tracking-widest uppercase text-white/40">
                {label}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* CHOOSE PATH */}
      <div className="max-w-screen-xl mx-auto px-4 sm:px-6 py-10">
        <div className="mb-7">
          <div className="text-[10px] tracking-[0.12em] uppercase text-gray-400 mb-1.5">
            {content.whoAreYou}
          </div>

          <h2
            className={`font-light text-[clamp(20px,4vw,30px)] text-gray-900 ${
              isAr ? "font-arabic" : "font-serif italic"
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
          <div className="rounded-[20px] p-7 sm:p-9 relative overflow-hidden min-h-[300px] sm:min-h-[340px] flex flex-col justify-end bg-gradient-to-br from-[#e6f3ff] to-[#cce4ff]">
            <div
              className={`text-4xl sm:text-5xl absolute top-6 sm:top-7 ${
                isAr ? "left-6 sm:left-7" : "right-6 sm:right-7"
              }`}
            >
              ✈️
            </div>

            <span className="inline-block px-3 py-1 rounded-full text-[11px] font-semibold mb-3 bg-[#0C447C22] text-[#0C447C] w-fit">
              {content.traveler}
            </span>

            <div
              className={`font-light text-[22px] sm:text-[26px] leading-[1.2] text-gray-900 mb-3 ${
                isAr ? "font-arabic" : "font-serif italic"
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
                    <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
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
                className="inline-flex items-center gap-1.5 bg-[#1a1a2e] text-yellow-400 px-5 py-2.5 rounded-[10px] text-[13px] font-semibold no-underline hover:opacity-85 transition-opacity w-fit"
              >
                {content.getStartedAs} {content.traveler?.toLowerCase()} →
              </Link>
            )}
          </div>

          {/* HOST */}
          <div className="rounded-[20px] p-7 sm:p-9 relative overflow-hidden min-h-[300px] sm:min-h-[340px] flex flex-col justify-end bg-gradient-to-br from-[#1a1a2e] to-[#2d2d5e]">
            <div
              className={`text-4xl sm:text-5xl absolute top-6 sm:top-7 ${
                isAr ? "left-6 sm:left-7" : "right-6 sm:right-7"
              }`}
            >
              🏠
            </div>

            <span className="inline-block px-3 py-1 rounded-full text-[11px] font-semibold mb-3 bg-yellow-400/15 text-yellow-400 w-fit">
              {content.host}
            </span>

            <div
              className={`font-light text-[22px] sm:text-[26px] leading-[1.2] text-white mb-3 ${
                isAr ? "font-arabic" : "font-serif italic"
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
                    <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
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
                className="inline-flex items-center gap-1.5 bg-yellow-400 text-[#1a1a2e] px-5 py-2.5 rounded-[10px] text-[13px] font-semibold no-underline hover:opacity-85 transition-opacity w-fit"
              >
                {content.getStartedAs} {content.host?.toLowerCase()} →
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* CTA */}
      {!isAuthenticated && (
        <div className="max-w-screen-xl mx-auto px-4 sm:px-6 py-10">
          <div className="relative bg-gradient-to-br from-[#1a1a2e] to-[#2d2d5e] rounded-3xl px-6 sm:px-12 py-12 sm:py-16 text-center overflow-hidden">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,rgba(232,197,71,0.2)_0%,transparent_60%)]" />

            <div className="relative z-10">
              <div className="text-[10px] tracking-[0.12em] uppercase text-yellow-400/60 mb-3">
                {content.ready}
              </div>

              <h2
                className={`font-light text-[clamp(24px,6vw,44px)] text-white mb-3 leading-[1.15] ${
                  isAr ? "font-arabic" : "font-serif italic"
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
                  className="bg-yellow-400 text-[#1a1a2e] px-6 sm:px-7 py-3 sm:py-3.5 rounded-xl text-sm font-bold no-underline"
                >
                  {content.createAccount} →
                </Link>

                <Link
                  to="/login"
                  className="bg-white/10 text-white px-6 sm:px-7 py-3 sm:py-3.5 rounded-xl text-sm font-medium no-underline border border-white/20"
                >
                  {content.signIn}
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* FOOTER */}
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
                <span className="font-bold" style={{ color: "#e8c547" }}>
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