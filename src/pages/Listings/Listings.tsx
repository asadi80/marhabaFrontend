import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";

import { useLanguage } from "../../hooks/useLanguage";
import Navbar from "../../components/Navbar";

interface AvatarPalette {
  bg: string;
  color: string;
}

const AVATAR_PAL: AvatarPalette[] = [
  { bg: "bg-[#EEEDFE]", color: "text-[#3C3489]" },
  { bg: "bg-[#E6F1FB]", color: "text-[#0C447C]" },
  { bg: "bg-[#EAF3DE]", color: "text-[#27500A]" },
  { bg: "bg-[#FAEEDA]", color: "text-[#633806]" },
  { bg: "bg-[#E1F5EE]", color: "text-[#085041]" },
  { bg: "bg-[#FBEAF0]", color: "text-[#72243E]" },
];

const avi = (name?: string): AvatarPalette =>
  AVATAR_PAL[(name?.charCodeAt(0) ?? 0) % AVATAR_PAL.length];

interface Host {
  id?: string;
  name?: string;
}

interface Listing {
  id: string;
  title: string;
  location: string;
  price: number | string;
  images?: string[];
  is_active?: boolean;
  status?: string;
  host?: Host;
}

interface Filters {
  location: string;
  minPrice: string;
  maxPrice: string;
}

interface User {
  id?: string;
  name?: string;
  email?: string;
  role?: string;
}

interface ListingsResponse {
  listings: Listing[];
}

export default function ListingsPage() {
  const { lang, t, toggleLanguage } = useLanguage();
  const isAr = lang === "ar";

  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const [filters, setFilters] = useState<Filters>({
    location: "",
    minPrice: "",
    maxPrice: "",
  });

  const [user] = useState<User | null>(null);

  useEffect(() => {
    fetchListings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchListings = async (): Promise<void> => {
    setLoading(true);

    try {
      const params = new URLSearchParams();

      if (filters.location.trim()) {
        params.append("location", filters.location.trim());
      }

      if (filters.minPrice) {
        params.append("minPrice", filters.minPrice);
      }

      if (filters.maxPrice) {
        params.append("maxPrice", filters.maxPrice);
      }

      /*
       * Your Marhaba API:
       * https://api.mar-haba.ly/api/v1/listings
       *
       * If VITE_API_URL is already defined as:
       * https://api.mar-haba.ly/api/v1
       * this will use that.
       */
      const API_BASE =
        import.meta.env.VITE_API_URL ||
        "https://api.mar-haba.ly/api/v1";

      const query = params.toString();

      const res = await fetch(
        `${API_BASE}/listings${query ? `?${query}` : ""}`,
        {
          method: "GET",
          headers: {
            Accept: "application/json",
          },
          credentials: "include",
        }
      );

      if (!res.ok) {
        throw new Error(
          `Failed to fetch listings: ${res.status} ${res.statusText}`
        );
      }

      const data = await res.json();

      /*
       * Supports the response formats your backend has used:
       *
       * { listings: [...] }
       * { data: [...] }
       * { data: { listings: [...] } }
       */
      let receivedListings: Listing[] = [];

      if (Array.isArray(data?.listings)) {
        receivedListings = data.listings;
      } else if (Array.isArray(data?.data)) {
        receivedListings = data.data;
      } else if (Array.isArray(data?.data?.listings)) {
        receivedListings = data.data.listings;
      }

      /*
       * Only show active listings.
       */
      setListings(
        receivedListings.filter(
          (listing) =>
            listing.is_active !== false &&
            (!listing.status || listing.status === "active")
        )
      );
    } catch (error) {
      console.error("Error fetching listings:", error);
      setListings([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: FormEvent<HTMLFormElement>): void => {
    e.preventDefault();
    fetchListings();
  };

  const clearFilters = (): void => {
    const emptyFilters: Filters = {
      location: "",
      minPrice: "",
      maxPrice: "",
    };

    setFilters(emptyFilters);

    /*
     * Fetch without waiting for React state update.
     */
    fetchListingsWithFilters(emptyFilters);
  };

  const fetchListingsWithFilters = async (
    currentFilters: Filters
  ): Promise<void> => {
    setLoading(true);

    try {
      const params = new URLSearchParams();

      if (currentFilters.location.trim()) {
        params.append("location", currentFilters.location.trim());
      }

      if (currentFilters.minPrice) {
        params.append("minPrice", currentFilters.minPrice);
      }

      if (currentFilters.maxPrice) {
        params.append("maxPrice", currentFilters.maxPrice);
      }

      const API_BASE =
        import.meta.env.VITE_API_URL ||
        "https://api.mar-haba.ly/api/v1";

      const query = params.toString();

      const res = await fetch(
        `${API_BASE}/listings${query ? `?${query}` : ""}`,
        {
          method: "GET",
          headers: {
            Accept: "application/json",
          },
          credentials: "include",
        }
      );

      if (!res.ok) {
        throw new Error(
          `Failed to fetch listings: ${res.status} ${res.statusText}`
        );
      }

      const data = await res.json();

      let receivedListings: Listing[] = [];

      if (Array.isArray(data?.listings)) {
        receivedListings = data.listings;
      } else if (Array.isArray(data?.data)) {
        receivedListings = data.data;
      } else if (Array.isArray(data?.data?.listings)) {
        receivedListings = data.data.listings;
      }

      setListings(
        receivedListings.filter(
          (listing) =>
            listing.is_active !== false &&
            (!listing.status || listing.status === "active")
        )
      );
    } catch (error) {
      console.error("Error fetching listings:", error);
      setListings([]);
    } finally {
      setLoading(false);
    }
  };

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
    hover:border-black/18
    focus:border-[#185FA5]
    focus:shadow-[0_0_0_3px_rgba(24,95,165,0.08)]
    focus:bg-white
    ${
      isAr
        ? "font-['Cairo','Tajawal',sans-serif]"
        : "font-['DM_Mono',monospace]"
    }
  `;

  const userInitials: string =
    user?.name
      ?.split(" ")
      .map((n) => n[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() ?? "H";

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
      <Navbar
        NAV_LINKS={[
       
         
        ]}
        user={user}
        lang={lang}
        toggleLanguage={toggleLanguage}
        defaultActiveId="browse"
      />

      <main className="max-w-[1100px] mx-auto px-4 md:px-6 py-7">
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
        </div>

        {/* FILTER BAR */}
        <div className="bg-white rounded-[14px] border border-black/7 border-t-[3px] border-t-[#e8c547] px-6 py-5 mb-6">
          <form onSubmit={handleSearch}>
            <div className="flex flex-wrap gap-2.5 items-end">
              {/* LOCATION */}
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

              {/* MIN PRICE */}
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
                    placeholder="0"
                    min="0"
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

              {/* MAX PRICE */}
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
                    placeholder="∞"
                    min="0"
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

              {/* SEARCH */}
              <div className="shrink-0">
                <button
                  type="submit"
                  className={`
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
                    gap-1.5
                    transition-all
                    hover:opacity-88
                    hover:-translate-y-px
                    ${
                      isAr
                        ? "font-['Cairo','Tajawal',sans-serif]"
                        : "font-['DM_Mono',monospace]"
                    }
                  `}
                >
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

                  {t.search}
                </button>
              </div>
            </div>
          </form>
        </div>

        {/* RESULTS COUNT */}
        {!loading && listings.length > 0 && (
          <div className="text-xs text-[#999] mb-4">
            {listings.length}{" "}
            {listings.length === 1 ? t.listing : t.listing} {t.found}

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

        {/* LISTINGS */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {[...Array(6)].map((_, i) => (
              <div
                key={i}
                className="bg-white rounded-[14px] border border-black/7 overflow-hidden"
              >
                <div className="h-[200px] bg-gradient-to-r from-[#ebe9e3] via-[#f3f1ea] to-[#ebe9e3] bg-[length:200%_100%] animate-[shimmer_1.4s_infinite]" />

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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {listings.map((listing) => {
              const hostAvi = avi(listing.host?.name);

              const hostInitial =
                listing.host?.name?.charAt(0)?.toUpperCase() || "H";

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
                  <div className="overflow-hidden h-[200px]">
                    <img
                      src={listing.images?.[0] || "/placeholder-listing.jpg"}
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
                    />
                  </div>

                  <div className="p-5">
                    <div className="font-['Fraunces',serif] italic font-light text-[18px] text-[#111118] leading-snug mb-1.5">
                      {listing.title}
                    </div>

                    <div className="flex items-center gap-1.5 text-xs text-[#888] mb-2.5 overflow-hidden">
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

                    <div className="flex items-center justify-between pt-3 border-t border-black/[0.06]">
                      <div className="inline-flex items-baseline gap-0.5">
                        <span className="text-base font-medium text-[#111118]">
                          {listing.price} {isAr ? "دينار" : "LYD"}
                        </span>

                        <span className="text-[11px] text-[#999]">
                          &nbsp;/ {t.night}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5">
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

                        <span className="text-[11px] text-[#888] overflow-hidden text-ellipsis whitespace-nowrap max-w-[80px]">
                          {listing.host?.name || "Host"}
                        </span>
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-20 px-6 bg-white rounded-[14px] border border-black/7">
            <div className="w-12 h-12 rounded-full bg-[#f0efe9] flex items-center justify-center mx-auto mb-5">
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

            <div className="font-['Fraunces',serif] italic font-light text-[22px] text-[#111118] mb-2">
              {t.noListingsFound}
            </div>

            <p className="text-[13px] text-[#999] mb-5">
              {t.tryAdjustingFilters}
            </p>

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
        )}
      </main>

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