
import { useEffect, useState, useCallback, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useLanguage } from "../../hooks/useLanguage";
import { useAuth } from "../../context/AuthContext";
import Navbar from "../../components/Navbar";
import LoadingScreen from "../../components/LoadingScreen";
import { apiService } from "../../services/api";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Host {
  name?: string;
}

interface Listing {
  id: string;
  title: string;
  location: string;
  price: number;
  images?: string[];
  host?: Host;
  is_active?: boolean;
}

interface Filters {
  location: string;
  minPrice: string;
  maxPrice: string;
}

interface ListingsResponse {
  listings?: Listing[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

const EMPTY_FILTERS: Filters = {
  location: "",
  minPrice: "",
  maxPrice: "",
};

const AVATAR_PAL = [
  { bg: "bg-[#EEEDFE]", color: "text-[#3C3489]" },
  { bg: "bg-[#E6F1FB]", color: "text-[#0C447C]" },
  { bg: "bg-[#EAF3DE]", color: "text-[#27500A]" },
  { bg: "bg-[#FAEEDA]", color: "text-[#633806]" },
  { bg: "bg-[#E1F5EE]", color: "text-[#085041]" },
  { bg: "bg-[#FBEAF0]", color: "text-[#72243E]" },
];

const getAvatar = (name?: string) =>
  AVATAR_PAL[(name?.charCodeAt(0) ?? 0) % AVATAR_PAL.length];

const getInitials = (name?: string) =>
  name
    ?.split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() || "H";

// ─── Component ────────────────────────────────────────────────────────────────

export default function ListingsPage() {
  const navigate = useNavigate();

  const { lang, t, toggleLanguage } = useLanguage();

  const {
    user,
    isAuthenticated,
    isLoading: authLoading,
  } = useAuth();

  const isAr = lang === "ar";

  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [error, setError] = useState("");

  // ──────────────────────────────────────────────────────────────────────────
  // AUTHENTICATION
  // ──────────────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (authLoading) return;

    if (!isAuthenticated || !user) {
      console.log("❌ User is not authenticated. Redirecting to login.");

      navigate("/login", {
        replace: true,
        state: {
          from: "/listings",
        },
      });
    }
  }, [authLoading, isAuthenticated, user, navigate]);

  // ──────────────────────────────────────────────────────────────────────────
  // FETCH LISTINGS
  // ──────────────────────────────────────────────────────────────────────────

  const fetchListings = useCallback(
    async (activeFilters: Filters) => {
      console.log("========================================");
      console.log("🏠 FETCH LISTINGS START");
      console.log("========================================");

      console.log("Authenticated:", isAuthenticated);
      console.log("User:", user);
      console.log("Filters:", activeFilters);

      if (!isAuthenticated || !user) {
        console.log("❌ Not authenticated. Request cancelled.");
        return;
      }

      setLoading(true);
      setError("");

      try {
        const params = new URLSearchParams();

        if (activeFilters.location.trim()) {
          params.append(
            "location",
            activeFilters.location.trim()
          );
        }

        if (activeFilters.minPrice) {
          params.append(
            "minPrice",
            activeFilters.minPrice
          );
        }

        if (activeFilters.maxPrice) {
          params.append(
            "maxPrice",
            activeFilters.maxPrice
          );
        }

        const query = params.toString();

        const endpoint = query
          ? `/api/v1/listings?${query}`
          : "/api/v1/listings";

        console.log("➡️ API endpoint:", endpoint);

        const response =
          await apiService.getProtectedData<ListingsResponse>(
            endpoint
          );

        console.log("📦 FULL API RESPONSE:");
        console.log(response);

        // ──────────────────────────────────────────────────────────────
        // API ERROR
        // ──────────────────────────────────────────────────────────────

        if (!response.success) {
          console.error(
            "❌ API returned success=false:",
            response
          );

          throw new Error(
            response.message ||
              (isAr
                ? "تعذر تحميل القوائم"
                : "Failed to load listings")
          );
        }

        // ──────────────────────────────────────────────────────────────
        // NO DATA
        // ──────────────────────────────────────────────────────────────

        if (!response.data) {
          console.log("⚠️ API returned no data.");
          console.log("➡️ Setting listings to empty array.");

          setListings([]);
          return;
        }

        console.log("📋 response.data:");
        console.log(response.data);

        const data = response.data;

        // ──────────────────────────────────────────────────────────────
        // SUPPORT BOTH:
        //
        // 1. { listings: [...] }
        //
        // 2. [...]
        // ──────────────────────────────────────────────────────────────

        const allListings: Listing[] = Array.isArray(data)
          ? data
          : data.listings || [];

        console.log("🏠 ALL LISTINGS:");
        console.log(allListings);

        console.log(
          "🏠 Total listings:",
          allListings.length
        );

        // ──────────────────────────────────────────────────────────────
        // NO LISTINGS
        // ──────────────────────────────────────────────────────────────

        if (allListings.length === 0) {
          console.log("ℹ️ No listings found.");
          console.log(
            "➡️ The UI will display 'No listings found'."
          );

          setListings([]);
          return;
        }

        // ──────────────────────────────────────────────────────────────
        // FILTER ACTIVE LISTINGS
        // ──────────────────────────────────────────────────────────────

        const activeListings = allListings.filter(
          (listing) => listing.is_active !== false
        );

        console.log("✅ ACTIVE LISTINGS:");
        console.log(activeListings);

        console.log(
          "✅ Active listings count:",
          activeListings.length
        );

        // ──────────────────────────────────────────────────────────────
        // ALL LISTINGS ARE INACTIVE
        // ──────────────────────────────────────────────────────────────

        if (activeListings.length === 0) {
          console.log(
            "ℹ️ Listings exist, but all listings are inactive."
          );

          console.log(
            "➡️ The UI will display 'No listings found'."
          );

          setListings([]);
          return;
        }

        // ──────────────────────────────────────────────────────────────
        // SAVE LISTINGS
        // ──────────────────────────────────────────────────────────────

        console.log(
          "🎉 Setting listings:",
          activeListings
        );

        setListings(activeListings);

      } catch (err) {
        console.error(
          "🔥 FAILED TO FETCH LISTINGS:",
          err
        );

        const errorMessage =
          err instanceof Error
            ? err.message
            : isAr
              ? "حدث خطأ أثناء تحميل القوائم"
              : "Something went wrong while loading listings";

        console.error(
          "🔥 Error message:",
          errorMessage
        );

        setError(errorMessage);
        setListings([]);

      } finally {
        console.log("========================================");
        console.log("🏠 FETCH LISTINGS END");
        console.log("========================================");

        setLoading(false);
      }
    },
    [isAuthenticated, user, isAr]
  );

  // ──────────────────────────────────────────────────────────────────────────
  // INITIAL FETCH
  // ──────────────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (authLoading) return;

    if (isAuthenticated && user) {
      console.log(
        "🚀 Authentication confirmed. Fetching listings..."
      );

      fetchListings(EMPTY_FILTERS);
    }
  }, [
    authLoading,
    isAuthenticated,
    user,
    fetchListings,
  ]);

  // ──────────────────────────────────────────────────────────────────────────
  // SEARCH
  // ──────────────────────────────────────────────────────────────────────────

  const handleSearch = (e: FormEvent) => {
    e.preventDefault();

    console.log("🔎 Searching listings...");
    console.log("Search filters:", filters);

    fetchListings(filters);
  };

  const clearFilters = () => {
    console.log("🧹 Clearing listing filters.");

    setFilters(EMPTY_FILTERS);
    fetchListings(EMPTY_FILTERS);
  };

  // ──────────────────────────────────────────────────────────────────────────
  // LOADING / AUTH GUARD
  // ──────────────────────────────────────────────────────────────────────────

  if (authLoading) {
    return <LoadingScreen />;
  }

  if (!isAuthenticated || !user) {
    return <LoadingScreen />;
  }

  // ──────────────────────────────────────────────────────────────────────────
  // USER INFO
  // ──────────────────────────────────────────────────────────────────────────

  const userInitials = getInitials(user.name);
  const hostAviFallback = getAvatar(user.name);

  // ──────────────────────────────────────────────────────────────────────────
  // STYLES
  // ──────────────────────────────────────────────────────────────────────────

  const inputClass = `
    w-full py-2.5 px-3
    bg-[#fafaf8]
    border border-black/10
    rounded-lg
    text-[13px]
    text-[#111118]
    outline-none
    transition-all
    placeholder:text-[#c0bfbb]
    hover:border-black/20
    focus:border-[#185FA5]
    focus:shadow-[0_0_0_3px_rgba(24,95,165,0.08)]
    focus:bg-white
    ${
      isAr
        ? "font-['Cairo','Tajawal',sans-serif]"
        : "font-['DM_Mono',monospace]"
    }
  `;

  return (
    <div
      className="min-h-screen bg-[#f7f6f2]"
      dir={isAr ? "rtl" : "ltr"}
      style={{
        fontFamily: isAr
          ? "'Cairo', 'Tajawal', sans-serif"
          : "'DM Mono', monospace",
      }}
    >
      {/* ───────────────── NAVBAR ───────────────── */}

      <Navbar
        NAV_LINKS={[
          {
            id: "dashboard",
            label: t.dashboard,
            href: "/dashboard",
          },
          {
            id: "browse",
            label: t.browse,
            href: "/listings",
          },
        ]}
        user={user}
        lang={lang}
        toggleLanguage={toggleLanguage}
        defaultActiveId="browse"
        ini={userInitials}
      />

      {/* ───────────────── MAIN ───────────────── */}

      <main className="max-w-[1100px] mx-auto px-4 md:px-6 py-7">

        {/* HEADER */}

        <div className="mb-6 animate-[fadeUp_0.45s_cubic-bezier(0.22,1,0.36,1)_both]">

          <div className="text-[10px] tracking-[0.12em] uppercase text-[#999] mb-1.5">
            {t.explore}
          </div>

          <h1
            className={`
              font-light
              text-[clamp(24px,4vw,36px)]
              text-[#111118]
              leading-tight
              ${
                isAr
                  ? "font-['Cairo','Tajawal',sans-serif]"
                  : "font-['Fraunces',serif] italic"
              }
            `}
          >
            {t.browseListings}
          </h1>

          {/* Logged-in user */}

          <div className="flex items-center gap-2 mt-3">

            <div
              className={`
                w-7 h-7 rounded-full
                flex items-center justify-center
                text-[10px] font-medium
                ${hostAviFallback.bg}
                ${hostAviFallback.color}
              `}
            >
              {userInitials}
            </div>

            <span className="text-[11px] text-[#888]">
              {isAr
                ? `مرحباً ${user.name}`
                : `Welcome, ${user.name}`}
            </span>

          </div>
        </div>

        {/* ───────────────── FILTER BAR ───────────────── */}

        <div
          className="
            bg-white
            rounded-[14px]
            border border-black/7
            border-t-[3px]
            border-t-[#e8c547]
            px-6 py-5
            mb-6
            animate-[fadeUp_0.45s_cubic-bezier(0.22,1,0.36,1)_0.07s_both]
          "
        >
          <form onSubmit={handleSearch}>

            <div className="flex flex-wrap gap-2.5 items-end">

              {/* Location */}

              <div className="flex-[2_1_180px] min-w-0">

                <label className="block text-[10px] tracking-[0.09em] uppercase text-[#999] mb-1.5">
                  {t.location}
                </label>

                <div className="relative">

                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none">
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 12 12"
                      fill="none"
                    >
                      <path
                        d="M6 1C4.07 1 2.5 2.57 2.5 4.5c0 2.78 3.5 6.5 3.5 6.5s3.5-3.72 3.5-6.5C9.5 2.57 7.93 1 6 1zm0 5a1.5 1.5 0 110-3 1.5 1.5 0 010 3z"
                        fill="#bbb"
                      />
                    </svg>
                  </span>

                  <input
                    type="text"
                    placeholder={t.anywhere}
                    value={filters.location}
                    onChange={(e) =>
                      setFilters({
                        ...filters,
                        location: e.target.value,
                      })
                    }
                    className={`${inputClass} pl-7`}
                  />

                </div>
              </div>

              {/* Min price */}

              <div className="flex-[1_1_110px] min-w-0">

                <label className="block text-[10px] tracking-[0.09em] uppercase text-[#999] mb-1.5">
                  {t.minPrice}
                </label>

                <div className="relative">

                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-[#bbb] pointer-events-none">
                    $
                  </span>

                  <input
                    type="number"
                    min="0"
                    placeholder="0"
                    value={filters.minPrice}
                    onChange={(e) =>
                      setFilters({
                        ...filters,
                        minPrice: e.target.value,
                      })
                    }
                    className={`${inputClass} pl-[22px]`}
                  />

                </div>
              </div>

              {/* Max price */}

              <div className="flex-[1_1_110px] min-w-0">

                <label className="block text-[10px] tracking-[0.09em] uppercase text-[#999] mb-1.5">
                  {t.maxPrice}
                </label>

                <div className="relative">

                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-[#bbb] pointer-events-none">
                    $
                  </span>

                  <input
                    type="number"
                    min="0"
                    placeholder="∞"
                    value={filters.maxPrice}
                    onChange={(e) =>
                      setFilters({
                        ...filters,
                        maxPrice: e.target.value,
                      })
                    }
                    className={`${inputClass} pl-[22px]`}
                  />

                </div>
              </div>

              {/* Search */}

              <div className="shrink-0">

                <button
                  type="submit"
                  disabled={loading}
                  className="
                    bg-[#1a1a2e]
                    text-[#e8c547]
                    border-none
                    rounded-lg
                    py-2.5
                    px-[22px]
                    text-[13px]
                    cursor-pointer
                    whitespace-nowrap
                    inline-flex
                    items-center
                    justify-center
                    gap-1.5
                    transition-all
                    hover:opacity-90
                    hover:-translate-y-px
                    disabled:opacity-50
                    disabled:cursor-not-allowed
                  "
                >
                  {loading ? (
                    <span
                      className="
                        w-3.5 h-3.5
                        rounded-full
                        border-2
                        border-[#e8c547]/30
                        border-t-[#e8c547]
                        animate-spin
                      "
                    />
                  ) : (
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 12 12"
                      fill="none"
                    >
                      <circle
                        cx="5"
                        cy="5"
                        r="3.5"
                        stroke="#e8c547"
                        strokeWidth="1.2"
                      />
                      <path
                        d="M7.5 7.5L10 10"
                        stroke="#e8c547"
                        strokeWidth="1.2"
                        strokeLinecap="round"
                      />
                    </svg>
                  )}

                  {loading
                    ? isAr
                      ? "جارٍ البحث..."
                      : "searching..."
                    : t.search}

                </button>

              </div>

            </div>

          </form>
        </div>

        {/* ───────────────── ERROR ───────────────── */}

        {error && !loading && (
          <div
            className="
              mb-5
              px-4 py-3
              bg-[#FCEBEB]
              border border-[#A32D2D]/15
              rounded-lg
              text-[12px]
              text-[#791F1F]
              flex items-center gap-2
            "
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 14 14"
              fill="none"
              className="shrink-0"
            >
              <circle
                cx="7"
                cy="7"
                r="6"
                stroke="#A32D2D"
                strokeWidth="1.2"
              />

              <path
                d="M7 4v3.5M7 9.5h.01"
                stroke="#A32D2D"
                strokeWidth="1.2"
                strokeLinecap="round"
              />
            </svg>

            <span>{error}</span>

            <button
              type="button"
              onClick={() => fetchListings(filters)}
              className="ms-auto text-[#791F1F] underline cursor-pointer bg-transparent border-none text-[11px]"
            >
              {isAr ? "إعادة المحاولة" : "Retry"}
            </button>
          </div>
        )}

        {/* ───────────────── RESULTS COUNT ───────────────── */}

        {!loading && listings.length > 0 && (
          <div className="text-xs text-[#999] mb-4">

            {listings.length}{" "}

            {isAr
              ? listings.length === 1
                ? "قائمة"
                : "قوائم"
              : listings.length === 1
                ? "listing"
                : "listings"}{" "}

            {t.found}

            {filters.location && (
              <>
                {" "}
                {t.in}{" "}

                <span className="text-[#111118]">
                  {filters.location}
                </span>
              </>
            )}

          </div>
        )}

        {/* ───────────────── LISTINGS ───────────────── */}

        {loading ? (

          // ───────────────── LOADING ─────────────────

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">

            {Array.from({ length: 6 }).map((_, i) => (

              <div
                key={i}
                className="
                  bg-white
                  rounded-[14px]
                  border border-black/7
                  overflow-hidden
                "
              >

                <div
                  className="
                    h-[200px]
                    bg-gradient-to-r
                    from-[#ebe9e3]
                    via-[#f3f1ea]
                    to-[#ebe9e3]
                    bg-[length:200%_100%]
                    animate-[shimmer_1.4s_infinite]
                  "
                />

                <div className="p-5 flex flex-col gap-2.5">

                  <div className="h-3.5 w-3/4 bg-[#ebe9e3] rounded-lg" />

                  <div className="h-[11px] w-1/2 bg-[#ebe9e3] rounded-lg" />

                  <div className="h-3 w-[35%] bg-[#ebe9e3] rounded-lg" />

                  <div className="h-[11px] w-[55%] bg-[#ebe9e3] rounded-lg" />

                </div>

              </div>

            ))}

          </div>

        ) : listings.length > 0 ? (

          // ───────────────── LISTINGS FOUND ─────────────────

          <div
            className="
              grid
              grid-cols-1
              sm:grid-cols-2
              lg:grid-cols-3
              gap-3.5
              animate-[fadeUp_0.45s_cubic-bezier(0.22,1,0.36,1)_0.14s_both]
            "
          >

            {listings.map((listing) => {

              const hostAvi = getAvatar(
                listing.host?.name
              );

              const hostInitial = getInitials(
                listing.host?.name
              );

              return (

                <Link
                  to={`/listings/${listing.id}`}
                  key={listing.id}
                  className="
                    bg-white
                    rounded-[14px]
                    border border-black/7
                    overflow-hidden
                    no-underline
                    block
                    transition-all
                    duration-[220ms]
                    hover:-translate-y-1
                    hover:shadow-[0_16px_40px_rgba(0,0,0,0.09)]
                    group
                  "
                >

                  {/* IMAGE */}

                  <div className="overflow-hidden h-[200px] bg-[#eee]">

                    <img
                      src={
                        listing.images?.[0] ||
                        "/placeholder.jpg"
                      }
                      alt={listing.title}
                      className="
                        w-full
                        h-[200px]
                        object-cover
                        block
                        transition-transform
                        duration-300
                        group-hover:scale-[1.04]
                      "
                      onError={(e) => {
                        console.log(
                          "⚠️ Image failed:",
                          listing.images?.[0]
                        );

                        e.currentTarget.src =
                          "/placeholder.jpg";
                      }}
                    />

                  </div>

                  {/* CONTENT */}

                  <div className="p-5">

                    <div
                      className="
                        font-['Fraunces',serif]
                        italic
                        font-light
                        text-[18px]
                        text-[#111118]
                        leading-snug
                        mb-1.5
                      "
                    >
                      {listing.title}
                    </div>

                    {/* Location */}

                    <div
                      className="
                        flex
                        items-center
                        gap-1.5
                        text-xs
                        text-[#888]
                        mb-2.5
                        overflow-hidden
                      "
                    >

                      <svg
                        width="11"
                        height="11"
                        viewBox="0 0 12 12"
                        fill="none"
                        className="shrink-0"
                      >
                        <path
                          d="M6 1C4.07 1 2.5 2.57 2.5 4.5c0 2.78 3.5 6.5 3.5 6.5s3.5-3.72 3.5-6.5C9.5 2.57 7.93 1 6 1zm0 5a1.5 1.5 0 110-3 1.5 1.5 0 010 3z"
                          fill="#ccc"
                        />
                      </svg>

                      <span className="overflow-hidden text-ellipsis whitespace-nowrap">
                        {listing.location}
                      </span>

                    </div>

                    {/* PRICE + HOST */}

                    <div className="flex items-center justify-between pt-3 border-t border-black/[0.06]">

                      <div className="inline-flex items-baseline gap-0.5">

                        <span className="text-base font-medium text-[#111118]">

                          {listing.price}{" "}

                          {isAr
                            ? "دينار"
                            : "LYD"}

                        </span>

                        <span className="text-[11px] text-[#999]">

                          &nbsp;/{" "}

                          {isAr
                            ? "ليلة"
                            : t.night}

                        </span>

                      </div>

                      <div className="flex items-center gap-1.5 min-w-0">

                        <div
                          className={`
                            w-[22px]
                            h-[22px]
                            rounded-full
                            flex
                            items-center
                            justify-center
                            text-[10px]
                            font-medium
                            shrink-0
                            ${hostAvi.bg}
                            ${hostAvi.color}
                          `}
                        >
                          {hostInitial}
                        </div>

                        <span
                          className="
                            text-[11px]
                            text-[#888]
                            overflow-hidden
                            text-ellipsis
                            whitespace-nowrap
                            max-w-[80px]
                          "
                        >
                          {listing.host?.name ||
                            (isAr
                              ? "مضيف"
                              : "Host")}
                        </span>

                      </div>

                    </div>

                  </div>

                </Link>

              );

            })}

          </div>

        ) : (

          // ───────────────── NO LISTINGS ─────────────────

          <div
            className="
              animate-[fadeUp_0.45s_cubic-bezier(0.22,1,0.36,1)_0.14s_both]
              text-center
              py-20
              px-6
              bg-white
              rounded-[14px]
              border border-black/7
            "
          >

            <div
              className="
                w-12
                h-12
                rounded-full
                bg-[#f0efe9]
                flex
                items-center
                justify-center
                mx-auto
                mb-5
              "
            >

              <svg
                width="22"
                height="22"
                viewBox="0 0 22 22"
                fill="none"
              >
                <circle
                  cx="10"
                  cy="10"
                  r="7"
                  stroke="#ccc"
                  strokeWidth="1.5"
                />

                <path
                  d="M15.5 15.5L19 19"
                  stroke="#ccc"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              </svg>

            </div>

            <div
              className="
                font-['Fraunces',serif]
                italic
                font-light
                text-[22px]
                text-[#111118]
                mb-2
              "
            >
              {error
                ? isAr
                  ? "تعذر تحميل القوائم"
                  : "Unable to load listings"
                : isAr
                  ? "لا توجد قوائم"
                  : "No listings found"}
            </div>

            <p className="text-[13px] text-[#999] mb-5">

              {error
                ? isAr
                  ? "تحقق من الاتصال بالخادم وحاول مرة أخرى."
                  : "Check your connection and try again."
                : isAr
                  ? "لا توجد قوائم متاحة حالياً."
                  : "There are no listings available at the moment."}

            </p>

            <div className="flex justify-center gap-2">

              {error && (
                <button
                  onClick={() =>
                    fetchListings(filters)
                  }
                  className="
                    bg-[#1a1a2e]
                    text-[#e8c547]
                    border-none
                    rounded-lg
                    py-2
                    px-[18px]
                    text-xs
                    cursor-pointer
                  "
                >
                  {isAr
                    ? "إعادة المحاولة"
                    : "Try again"}
                </button>
              )}

              <button
                onClick={clearFilters}
                className="
                  bg-transparent
                  border border-black/10
                  rounded-lg
                  py-2
                  px-[18px]
                  text-xs
                  font-[inherit]
                  text-[#555]
                  cursor-pointer
                  hover:border-black/20
                  transition-colors
                "
              >
                {t.clearFilters}
              </button>

            </div>

          </div>

        )}

      </main>

      {/* ───────────────── ANIMATIONS ───────────────── */}

      <style>{`

        @keyframes fadeUp {

          from {
            opacity: 0;
            transform: translateY(12px);
          }

          to {
            opacity: 1;
            transform: translateY(0);
          }

        }

        @keyframes shimmer {

          0% {
            background-position: 200% 0;
          }

          100% {
            background-position: -200% 0;
          }

        }

      `}</style>

    </div>
  );
}

