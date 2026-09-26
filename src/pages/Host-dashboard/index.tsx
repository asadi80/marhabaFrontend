import React, { useEffect, useMemo, useState, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";

import { useAuth } from "../../context/AuthContext";
import { useLanguage } from "../../hooks/useLanguage";
import LoadingScreen from "../../components/LoadingScreen";
import Navbar from "../../components/Navbar";
import { apiService } from "../../services/api";

/* ==========================================================================
   TYPES
========================================================================== */

interface BlockedDateRange {
  id?: string;
  startDate: string;
  endDate: string;
  reason?: string;
}

interface Listing {
  id: string;
  title?: string;
  name?: string;
  status?: string;
  price?: number | string;
  price_per_night?: number | string;
  created_at?: string;
  createdAt?: string;
  location?: string;
  blocked_dates?: BlockedDateRange[];
}

interface BookingUser {
  id: string;
  name?: string;
  email?: string;
  phone_number?: string;
}

interface BookingListing {
  id: string;
  title?: string;
  location?: string;
  blocked_dates?: BlockedDateRange[];
  price?: number | string;
}

interface Booking {
  id: string;

  listing_id?: string;
  user_id?: string;

  check_in?: string;
  check_out?: string;

  total_price?: number | string;
  total_amount?: number | string;
  totalAmount?: number | string;
  amount?: number | string;

  guests?: number;

  checked_in_at?: string | null;
  checked_out_at?: string | null;

  no_show?: boolean;

  status?: string;

  created_at?: string;
  createdAt?: string;
  updated_at?: string;

  listing?: BookingListing;
  user?: BookingUser;
}

interface HostSubscriptionPayment {
  id: string;
  host_id: string;
  amount: number | string;
  status: "pending" | "approved" | "rejected";
  receipt_images: string[];
  paid_at: string | null;
  period_start: string | null;
  period_end: string | null;
  reference: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

interface IDDocument {
  id: string;
  user_id?: string;
  document_type?: string;
  side?: string;
  file_url?: string | null;
  file_name?: string | null;
  file_type?: string | null;
  status?: string;
  rejection_reason?: string | null;
  reviewed_at?: string | null;
  created_at?: string;
  updated_at?: string;
}

interface VerificationStatus {
  id: {
    documents?: IDDocument[];
    uploaded: boolean;
    verified: boolean;
    verified_at: string | null;
    rejected?: boolean;
    rejection_reason?: string | null;
    status?: string;
  };

  payment: {
    uploaded: boolean;
    status: "pending" | "approved" | "rejected";
    amount: number | string | null;
    submitted_at: string | null;
    rejection_reason: string | null;
    rejected?: boolean;
    approved_at?: string | null;
    payment?: HostSubscriptionPayment | null;
  };

  overall_status?: string;
}

/* ==========================================================================
   CONSTANTS
========================================================================== */

const HOST_ROLE = "host";

/* ==========================================================================
   NAVIGATION
========================================================================== */

const NAV_LINKS = [
 
  {
    id: "listings",
    label: "My Listings",
    labelAr: "إعلاناتي",
    href: "/host/listings",
  },
  {
    id: "bookings",
    label: "Bookings",
    labelAr: "الحجوزات",
    href: "/host/bookings",
  },
  {
    id: "settings",
    label: "Settings",
    labelAr: "الإعدادات",
    href: "/host/settings",
  },
];

const QUICK_ACTIONS = [
  {
    href: "/host/listings",
    icon: "🏠",
    label: {
      en: "Manage Listings",
      ar: "إدارة الإعلانات",
    },
    desc: {
      en: "Add and edit your listings",
      ar: "إضافة وتعديل إعلاناتك",
    },
  },
  {
    href: "/host/listings/new",
    icon: "+",
    iconClass: "text-[#e8c547]",
    label: {
      en: "Create Listing",
      ar: "إضافة إعلان",
    },
    desc: {
      en: "Create a new listing",
      ar: "أنشئ إعلاناً جديداً",
    },
  },
  {
    href: "/host/bookings",
    icon: "📅",
    label: {
      en: "View Bookings",
      ar: "الحجوزات",
    },
    desc: {
      en: "Review your bookings",
      ar: "راجع حجوزاتك",
    },
  },
  {
    href: "/host/settings",
    icon: "⚙️",
    label: {
      en: "Settings",
      ar: "الإعدادات",
    },
    desc: {
      en: "ID and payment receipt",
      ar: "الهوية وإيصال الدفع",
    },
  },
] as const;

/* ==========================================================================
   HELPERS
========================================================================== */

const toRole = (role?: string) => String(role || "").toLowerCase();

const formatCurrency = (
  value: number | string | null | undefined,
  isArabic: boolean,
) => {
  const numValue = typeof value === "string" ? parseFloat(value) : value;

  if (value === null || value === undefined || Number.isNaN(numValue)) {
    return isArabic ? "غير محدد" : "Not specified";
  }

  return new Intl.NumberFormat(isArabic ? "ar-LY" : "en-LY", {
    style: "currency",
    currency: "LYD",
    maximumFractionDigits: 2,
  }).format(numValue as number);
};

const getInitials = (name?: string) =>
  name
    ?.trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("") || "H";

/* ==========================================================================
   HOST STATUS
========================================================================== */

const STATUS_LABELS: Record<string, [string, string]> = {
  pending: ["Pending Review", "قيد المراجعة"],
  verified: ["Active", "نشط"],
  active: ["Active", "نشط"],
  approved: ["Approved", "تمت الموافقة"],
  suspended: ["Suspended", "موقوف"],
  expired: ["Expired", "منتهي"],
  confirmed: ["Confirmed", "مؤكد"],
};

const getStatusLabel = (status: string, isArabic: boolean) => {
  const label = STATUS_LABELS[toRole(status)];

  return label
    ? label[isArabic ? 1 : 0]
    : status || (isArabic ? "غير معروف" : "Unknown");
};

const getStatusClasses = (status: string) => {
  const normalized = toRole(status);

  if (normalized === "pending") {
    return "bg-yellow-400/15 text-[#946f00] border border-yellow-400/40";
  }

  if (["verified", "active", "approved", "confirmed"].includes(normalized)) {
    return "bg-emerald-50 text-emerald-700 border border-emerald-200";
  }

  if (["suspended", "expired", "rejected"].includes(normalized)) {
    return "bg-red-50 text-red-700 border border-red-200";
  }

  return "bg-gray-100 text-gray-600 border border-gray-200";
};

/* ==========================================================================
   BOOKING STATUS
========================================================================== */

const BOOKING_STATUS_LABELS: Record<string, [string, string]> = {
  pending: ["Pending", "قيد الانتظار"],

  confirmed: ["Confirmed", "مؤكد"],

  checked_in: ["Checked In", "تم تسجيل الوصول"],

  checked_out: ["Checked Out", "تم تسجيل المغادرة"],

  approved: ["Approved", "تمت الموافقة"],

  completed: ["Completed", "مكتمل"],

  cancelled: ["Cancelled", "ملغى"],

  rejected: ["Rejected", "مرفوض"],

  no_show: ["No Show", "لم يحضر"],
};

const getBookingStatusLabel = (
  status: string | undefined,
  isArabic: boolean,
) => {
  const normalized = toRole(status);

  const label = BOOKING_STATUS_LABELS[normalized];

  if (label) {
    return label[isArabic ? 1 : 0];
  }

  return status || (isArabic ? "غير معروف" : "Unknown");
};

const getBookingStatusClasses = (status?: string) => {
  const normalized = toRole(status);

  if (
    [
      "confirmed",
      "approved",
      "completed",
      "checked_in",
      "checked_out",
    ].includes(normalized)
  ) {
    return "bg-emerald-50 text-emerald-700 border border-emerald-200";
  }

  if (["cancelled", "rejected", "no_show"].includes(normalized)) {
    return "bg-red-50 text-red-700 border border-red-200";
  }

  return "bg-yellow-400/15 text-[#946f00] border border-yellow-400/30";
};

/* ==========================================================================
   BOOKING HELPERS
========================================================================== */

/**
 * Your API returns:
 *
 * "total_price": "1000.01"
 *
 * So total_price must be checked first.
 */
const getBookingAmount = (booking: Booking) => {
  return Number(
    booking.total_price ??
      booking.total_amount ??
      booking.totalAmount ??
      booking.amount ??
      0,
  );
};

const getBookingDate = (booking: Booking) => {
  return booking.created_at || booking.createdAt || "";
};

const formatBookingDate = (date: string | undefined, isArabic: boolean) => {
  if (!date) {
    return isArabic ? "غير محدد" : "Not specified";
  }

  const parsedDate = new Date(date);

  if (Number.isNaN(parsedDate.getTime())) {
    return isArabic ? "غير محدد" : "Not specified";
  }

  return parsedDate.toLocaleDateString(isArabic ? "ar-LY" : "en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

const formatBookingDateRange = (booking: Booking, isArabic: boolean) => {
  const checkIn = formatBookingDate(booking.check_in, isArabic);

  const checkOut = formatBookingDate(booking.check_out, isArabic);

  return `${checkIn} → ${checkOut}`;
};

/**
 * Dates that count as real reservations.
 * Cancelled/rejected bookings do not count.
 */
const isValidBookingStatus = (status?: string) => {
  return !["cancelled", "rejected"].includes(toRole(status));
};

/**
 * Used for confirmed booking count
 * and earnings.
 */
const isConfirmedBookingStatus = (status?: string) => {
  return ["confirmed", "checked_in", "checked_out", "completed"].includes(
    toRole(status),
  );
};

/* ==========================================================================
   COMPONENT
========================================================================== */

const HostDashboard: React.FC = () => {
  const navigate = useNavigate();

  const {
    user,
    isAuthenticated,
    isLoading: authLoading,
    updateVerificationStatus,
  } = useAuth();

  const { lang, toggleLanguage } = useLanguage();

  const isArabic = lang === "ar";

  const fontClass = isArabic ? "font-arabic" : "font-sans";

  /* ------------------------------------------------------------------------
     STATE
  ------------------------------------------------------------------------ */

  const [loading, setLoading] = useState(true);

  const [listings, setListings] = useState<Listing[]>([]);

  const [bookings, setBookings] = useState<Booking[]>([]);

  const [error, setError] = useState("");

  const [dataLoaded, setDataLoaded] = useState(false);

  const [blockedDates, setBlockedDates] = useState<
    Record<string, BlockedDateRange[]>
  >({});

  const isAuthorizedHost =
    isAuthenticated && !!user && toRole(user.role) === HOST_ROLE;

  /* ==========================================================================
     AUTHORIZATION
  ========================================================================== */

  useEffect(() => {
    if (authLoading) return;

    if (!isAuthenticated || !user) {
      navigate("/login", {
        replace: true,
      });

      return;
    }

    if (toRole(user.role) !== HOST_ROLE) {
      navigate("/user-dashboard", {
        replace: true,
      });
    }
  }, [authLoading, isAuthenticated, user, navigate]);

  /* ==========================================================================
     LOAD DASHBOARD DATA
  ========================================================================== */

  useEffect(() => {
    if (authLoading || !isAuthorizedHost || dataLoaded) {
      return;
    }

    const loadDashboard = async () => {
      setLoading(true);
      setError("");

      console.log("========================================");
      console.log("🏠 HOST DASHBOARD LOADING");
      console.log("👤 User ID:", user?.id);
      console.log("👤 User:", user);
      console.log("🌐 API BASE:", import.meta.env.VITE_API_URL);
      console.log("========================================");

      try {
        const [listingsRes, bookingsRes, verificationRes] =
          await Promise.allSettled([
            // ============================================================
            // LISTINGS API
            // ============================================================
            apiService
              .getProtectedData<{
                listings?: Listing[];
              }>(`/api/v1/listings/host/${user.id}`)
              .then((res) => {
                console.log("========================================");
                console.log("🏠 LISTINGS API");
                console.log("➡️ URL:", `/api/v1/listings/host/${user.id}`);
                console.log("⬅️ RESPONSE:", res);
                console.log("⬅️ SUCCESS:", res?.success);
                console.log("⬅️ DATA:", res?.data);
                console.log("⬅️ LISTINGS:", res?.data?.listings);
                console.log("========================================");

                return res;
              }),

            // ============================================================
            // BOOKINGS API
            // ============================================================
            apiService
              .getProtectedData<
                | Booking[]
                | {
                    bookings?: Booking[];
                  }
              >("/api/v1/bookings/host")
              .then((res) => {
                console.log("========================================");
                console.log("📅 BOOKINGS API");
                console.log("➡️ URL:", "/api/v1/bookings/host");
                console.log("⬅️ RESPONSE:", res);
                console.log("⬅️ SUCCESS:", res?.success);
                console.log("⬅️ DATA:", res?.data);

                if (Array.isArray(res?.data)) {
                  console.log("📊 BOOKINGS COUNT:", res.data.length);

                  console.table(
                    res.data.map((booking: any) => ({
                      id: booking.id,
                      listing_id: booking.listing_id,
                      listing: booking.listing?.title,
                      guest: booking.user?.name,
                      email: booking.user?.email,
                      phone: booking.user?.phone_number,
                      check_in: booking.check_in,
                      check_out: booking.check_out,
                      guests: booking.guests,
                      total_price: booking.total_price,
                      status: booking.status,
                      checked_in_at: booking.checked_in_at,
                      checked_out_at: booking.checked_out_at,
                      no_show: booking.no_show,
                      created_at: booking.created_at,
                      updated_at: booking.updated_at,
                    })),
                  );
                } else {
                  console.log("📊 BOOKINGS:", res?.data?.bookings);

                  if (Array.isArray(res?.data?.bookings)) {
                    console.log("📊 BOOKINGS COUNT:", res.data.bookings.length);

                    console.table(
                      res.data.bookings.map((booking: any) => ({
                        id: booking.id,
                        listing_id: booking.listing_id,
                        listing: booking.listing?.title,
                        guest: booking.user?.name,
                        email: booking.user?.email,
                        phone: booking.user?.phone_number,
                        check_in: booking.check_in,
                        check_out: booking.check_out,
                        guests: booking.guests,
                        total_price: booking.total_price,
                        status: booking.status,
                        checked_in_at: booking.checked_in_at,
                        checked_out_at: booking.checked_out_at,
                        no_show: booking.no_show,
                        created_at: booking.created_at,
                        updated_at: booking.updated_at,
                      })),
                    );
                  }
                }

                console.log("========================================");

                return res;
              }),

            // ============================================================
            // VERIFICATION API
            // ============================================================
            apiService
              .getProtectedData<VerificationStatus>(
                "/api/v1/auth/host-verification-status",
              )
              .then((res) => {
                console.log("========================================");
                console.log("🔐 VERIFICATION API");
                console.log("➡️ URL:", "/api/v1/auth/host-verification-status");
                console.log("⬅️ RESPONSE:", res);
                console.log("⬅️ SUCCESS:", res?.success);
                console.log("⬅️ DATA:", res?.data);
                console.log("========================================");

                return res;
              }),
          ]);

        // ============================================================
        // LOG ALL PROMISE RESULTS
        // ============================================================

        console.log("========================================");
        console.log("📦 ALL DASHBOARD API RESULTS");
        console.log("========================================");

        console.log("🏠 Listings:", listingsRes.status, listingsRes);

        console.log("📅 Bookings:", bookingsRes.status, bookingsRes);

        console.log(
          "🔐 Verification:",
          verificationRes.status,
          verificationRes,
        );

        // ============================================================
        // LISTINGS
        // ============================================================
        if (listingsRes.status === "fulfilled" && listingsRes.value.success) {
          const responseData = listingsRes.value.data;

          const fetchedListings: Listing[] = Array.isArray(responseData)
            ? responseData
            : Array.isArray(responseData?.listings)
              ? responseData.listings
              : [];

          console.log("🏠 TOTAL LISTINGS:", fetchedListings.length);

          setListings(fetchedListings);
        } else {
          console.error("❌ LISTINGS API FAILED:", listingsRes);
        }

        // ============================================================
        // BOOKINGS
        // ============================================================

        if (bookingsRes.status === "fulfilled" && bookingsRes.value.success) {
          const responseData = bookingsRes.value.data;

          console.log("📅 RAW BOOKING DATA:", responseData);

          const fetchedBookings: Booking[] = Array.isArray(responseData)
            ? responseData
            : Array.isArray(responseData?.bookings)
              ? responseData.bookings
              : [];

          console.log("📅 FINAL BOOKINGS:", fetchedBookings);

          console.log("📊 BOOKING COUNT:", fetchedBookings.length);

          setBookings(fetchedBookings);

          // ==========================================================
          // BLOCKED DATES
          // ==========================================================

          const blockedMap: Record<string, BlockedDateRange[]> = {};

          fetchedBookings.forEach((booking) => {
            console.log("----------------------------------------");

            console.log("📅 PROCESSING BOOKING:", booking.id);

            const listing = booking.listing;

            console.log("🏠 BOOKING LISTING:", listing);

            if (!listing?.id) {
              console.warn("⚠️ Booking has no listing:", booking);
              return;
            }

            const dates = Array.isArray(listing.blocked_dates)
              ? listing.blocked_dates
              : [];

            console.log("🚫 BLOCKED DATES:", dates);

            const existing = blockedMap[listing.id] ?? [];

            dates.forEach((blockedDate) => {
              console.log("🚫 BLOCKED DATE:", blockedDate);

              if (
                !existing.some(
                  (existingDate) => existingDate.id === blockedDate.id,
                )
              ) {
                existing.push(blockedDate);
              }
            });

            blockedMap[listing.id] = existing;
          });

          console.log("🚫 FINAL BLOCKED DATES MAP:", blockedMap);

          setBlockedDates(blockedMap);
        } else {
          console.error("❌ BOOKINGS API FAILED:", bookingsRes);
        }

        // ============================================================
        // VERIFICATION
        // ============================================================

        if (
          verificationRes.status === "fulfilled" &&
          verificationRes.value.success &&
          verificationRes.value.data
        ) {
          console.log("🔐 UPDATING VERIFICATION:", verificationRes.value.data);

          updateVerificationStatus(verificationRes.value.data);
        } else {
          console.error("❌ VERIFICATION API FAILED:", verificationRes);
        }

        console.log("========================================");
        console.log("✅ HOST DASHBOARD LOADING COMPLETE");
        console.log("========================================");
      } catch (err: any) {
        console.error("❌ Dashboard loading error:", err);

        console.error("❌ Error message:", err?.message);

        console.error("❌ Error stack:", err?.stack);

        setError(
          isArabic
            ? "حدث خطأ أثناء تحميل لوحة التحكم"
            : "Failed to load dashboard",
        );
      } finally {
        setDataLoaded(true);
        setLoading(false);

        console.log("🏁 Dashboard loading finished");
      }
    };

    loadDashboard();
  }, [
    authLoading,
    isAuthorizedHost,
    dataLoaded,
    isArabic,
    updateVerificationStatus,
  ]);
  /* ==========================================================================
     FETCH BOOKINGS
  ========================================================================== */

  const fetchBookings = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await apiService.getProtectedData<
        | Booking[]
        | {
            bookings: Booking[];
          }
      >("/api/v1/bookings/host");

      console.log("HOST BOOKINGS:", response);

      if (response.success && response.data) {
        const fetchedBookings: Booking[] = Array.isArray(response.data)
          ? response.data
          : Array.isArray(response.data.bookings)
            ? response.data.bookings
            : [];

        setBookings(fetchedBookings);

        /* --------------------------------------------------------------
             BUILD BLOCKED DATE MAP
          -------------------------------------------------------------- */

        const blockedMap: Record<string, BlockedDateRange[]> = {};

        fetchedBookings.forEach((booking) => {
          const listing = booking.listing;

          if (!listing?.id) {
            return;
          }

          const dates = Array.isArray(listing.blocked_dates)
            ? listing.blocked_dates
            : [];

          const existing = blockedMap[listing.id] ?? [];

          dates.forEach((blockedDate) => {
            if (!existing.some((date) => date.id === blockedDate.id)) {
              existing.push(blockedDate);
            }
          });

          blockedMap[listing.id] = existing;
        });

        setBlockedDates(blockedMap);
      } else {
        setBookings([]);
        setBlockedDates({});

        setError(
          response.message ||
            (isArabic ? "لم يتم العثور على حجوزات" : "No bookings found"),
        );
      }
    } catch (err: any) {
      console.error("Fetch bookings error:", err);

      setError(
        err?.message ||
          (isArabic ? "فشل تحميل الحجوزات" : "Failed to fetch bookings"),
      );

      setBookings([]);
      setBlockedDates({});
    } finally {
      setLoading(false);
    }
  }, [isArabic]);

  /* ==========================================================================
     DERIVED DATA
  ========================================================================== */

  const stats = useMemo(() => {
    const confirmedBookings = bookings.filter((booking) =>
      isConfirmedBookingStatus(booking.status),
    ).length;

    const earnings = bookings.reduce((total, booking) => {
      if (isConfirmedBookingStatus(booking.status)) {
        return total + getBookingAmount(booking);
      }

      return total;
    }, 0);

    return {
      totalListings: listings.length,
      totalBookings: bookings.length,
      confirmedBookings,
      earnings,
    };
  }, [listings, bookings]);

  /* ==========================================================================
     RECENT BOOKINGS
  ========================================================================== */

  const recentBookings = useMemo(
    () =>
      [...bookings]
        .sort(
          (a, b) =>
            new Date(getBookingDate(b)).getTime() -
            new Date(getBookingDate(a)).getTime(),
        )
        .slice(0, 5),
    [bookings],
  );

  /* ==========================================================================
     USER STATUS
  ========================================================================== */

  const userStatus = toRole(user?.status);

  const isPending = userStatus === "pending";

  const isSuspended = userStatus === "suspended";

  const isExpired = userStatus === "expired";

  /* ==========================================================================
     GUARDS
  ========================================================================== */

  if (authLoading || loading) {
    return <LoadingScreen />;
  }

  if (!isAuthorizedHost) {
    return null;
  }

  /* ==========================================================================
     RENDER
  ========================================================================== */

  return (
    <div
      className={`min-h-screen bg-white text-gray-900 ${fontClass}`}
      dir={isArabic ? "rtl" : "ltr"}
    >
      <Navbar
        NAV_LINKS={NAV_LINKS}
        lang={lang}
        toggleLanguage={toggleLanguage}
      />

      {/* ================================================================
          HERO
      ================================================================= */}

      <section className="relative overflow-hidden bg-gradient-to-br from-[#1a1a2e] via-[#2d2d5e] to-[#1a1a2e] px-6 py-14">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_30%_50%,rgba(232,197,71,0.12)_0%,transparent_60%)]" />

        <div
          className="pointer-events-none absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage:
              "repeating-linear-gradient(45deg,#e8c547 0px,#e8c547 1px,transparent 1px,transparent 40px)",
          }}
        />

        <div className="relative mx-auto max-w-7xl">
          <div className="flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-yellow-400/30 bg-yellow-400/15 px-3.5 py-1.5 text-[11px] uppercase tracking-widest text-yellow-400">
                <span className="h-1.5 w-1.5 rounded-full bg-yellow-400" />

                {isArabic ? "لوحة المضيف" : "Host Dashboard"}
              </div>

              <div className="mb-2 flex flex-wrap items-center gap-3">
                <h1 className="text-[clamp(26px,3.5vw,40px)] font-light leading-[1.1] text-white">
                  {isArabic ? "مرحباً " : "Welcome, "}

                  <span className="font-bold text-[#e8c547]">{user!.name}</span>
                </h1>

                <span
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${getStatusClasses(
                    user!.status || "",
                  )}`}
                >
                  {getStatusLabel(user!.status || "", isArabic)}
                </span>
              </div>

              <p className="max-w-xl text-[15px] leading-relaxed text-white/50">
                {isArabic
                  ? "إدارة إعلاناتك وحجوزاتك من مكان واحد."
                  : "Manage your listings and bookings from one place."}
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link
                to="/host/settings"
                className="rounded-xl border border-white/20 bg-white/10 px-5 py-3 font-medium text-white transition hover:bg-white/15"
              >
                {isArabic ? "الإعدادات" : "Settings"}
              </Link>

              <Link
                to="/host/listings"
                className="rounded-xl bg-yellow-400 px-5 py-3 font-bold text-[#1a1a2e] transition hover:bg-yellow-300"
              >
                + {isArabic ? "إضافة إعلان" : "New Listing"}
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ================================================================
          MAIN
      ================================================================= */}

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* ==============================================================
            TABS
        =============================================================== */}

        <div className="mb-8 flex gap-2 overflow-x-auto border-b border-gray-100 pb-1">
          {NAV_LINKS.map((item) => (
            <Link
              key={item.id}
              to={item.href}
              className={`whitespace-nowrap rounded-t-xl px-4 py-3 text-sm font-medium transition ${
                item.id === "dashboard"
                  ? "bg-[#1a1a2e] text-yellow-400"
                  : "text-gray-500 hover:bg-gray-50 hover:text-gray-900"
              }`}
            >
              {isArabic ? item.labelAr : item.label}
            </Link>
          ))}
        </div>

        {/* ==============================================================
            ERROR
        =============================================================== */}

        {error && (
          <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-red-700">
            {error}
          </div>
        )}

        {/* ==============================================================
            PENDING
        =============================================================== */}

        {isPending && (
          <div className="mb-8 overflow-hidden rounded-2xl border border-yellow-400/30 bg-[#1a1a2e] p-5">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="mb-2 flex items-center gap-2">
                  <span className="text-xl">⏳</span>

                  <h2 className="font-bold text-white">
                    {isArabic
                      ? "حساب المضيف قيد المراجعة"
                      : "Your host account is under review"}
                  </h2>
                </div>

                <p className="text-sm leading-6 text-white/60">
                  {isArabic
                    ? "يمكنك استخدام لوحة التحكم وإضافة وإدارة الإعلانات أثناء مراجعة حسابك."
                    : "You can use your dashboard and add or manage listings while your account is being reviewed."}
                </p>
              </div>

              <Link
                to="/host/settings"
                className="shrink-0 rounded-xl bg-yellow-400 px-4 py-2.5 font-semibold text-[#1a1a2e] transition hover:bg-yellow-300"
              >
                {isArabic ? "إكمال التحقق" : "Complete Verification"}
              </Link>
            </div>
          </div>
        )}

        {/* ==============================================================
            SUSPENDED
        =============================================================== */}

        {isSuspended && (
          <div className="mb-8 rounded-2xl border border-red-200 bg-red-50 p-5">
            <h2 className="mb-2 font-bold text-red-900">
              {isArabic
                ? "حساب المضيف موقوف"
                : "Your host account is suspended"}
            </h2>

            {user!.statusReason && (
              <p className="text-sm text-red-800">{user!.statusReason}</p>
            )}
          </div>
        )}

        {/* ==============================================================
            EXPIRED
        =============================================================== */}

        {isExpired && (
          <div className="mb-8 rounded-2xl border border-yellow-400/40 bg-yellow-50 p-5">
            <h2 className="mb-2 font-bold text-[#7a5c00]">
              {isArabic
                ? "انتهت صلاحية اشتراك المضيف"
                : "Your host subscription has expired"}
            </h2>

            <p className="text-sm text-[#8a6a00]">
              {isArabic
                ? "راجع الإعدادات لمعرفة الخطوات المطلوبة."
                : "Please check Settings for the next steps."}
            </p>
          </div>
        )}

        {/* ==============================================================
            STATS
        =============================================================== */}

        <div className="mb-8 grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
          {/* LISTINGS */}

          <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
            <div className="mb-5 flex items-center justify-between">
              <span className="text-sm text-gray-500">
                {isArabic ? "إعلاناتي" : "My Listings"}
              </span>

              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#1a1a2e]">
                🏠
              </span>
            </div>

            <div className="text-3xl font-bold text-gray-900">
              {stats.totalListings}
            </div>

            <Link
              to="/host/listings"
              className="mt-3 inline-block text-sm font-semibold text-[#1a1a2e] hover:underline"
            >
              {isArabic ? "إدارة الإعلانات →" : "Manage listings →"}
            </Link>
          </div>

          {/* TOTAL BOOKINGS */}

          <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
            <div className="mb-5 flex items-center justify-between">
              <span className="text-sm text-gray-500">
                {isArabic ? "الحجوزات" : "Bookings"}
              </span>

              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#1a1a2e]">
                📅
              </span>
            </div>

            <div className="text-3xl font-bold text-gray-900">
              {stats.totalBookings}
            </div>

            <p className="mt-3 text-sm text-gray-500">
              {stats.confirmedBookings} {isArabic ? "مؤكدة" : "confirmed"}
            </p>
          </div>

          {/* CONFIRMED */}

          <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
            <div className="mb-5 flex items-center justify-between">
              <span className="text-sm text-gray-500">
                {isArabic ? "الحجوزات المؤكدة" : "Confirmed"}
              </span>

              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#1a1a2e] text-[#e8c547]">
                ✓
              </span>
            </div>

            <div className="text-3xl font-bold text-gray-900">
              {stats.confirmedBookings}
            </div>

            <p className="mt-3 text-sm text-gray-500">
              {isArabic ? "الحجوزات المؤكدة" : "Confirmed bookings"}
            </p>
          </div>

          {/* EARNINGS */}

          <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
            <div className="mb-5 flex items-center justify-between">
              <span className="text-sm text-gray-500">
                {isArabic ? "الأرباح" : "Earnings"}
              </span>

              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#1a1a2e]">
                💰
              </span>
            </div>

            <div className="text-2xl font-bold text-gray-900">
              {formatCurrency(stats.earnings, isArabic)}
            </div>

            <p className="mt-3 text-sm text-gray-500">
              {isArabic ? "من الحجوزات المؤكدة" : "From confirmed bookings"}
            </p>
          </div>
        </div>

        {/* ==============================================================
            BOOKINGS + QUICK ACTIONS
        =============================================================== */}

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
          {/* ============================================================
              RECENT BOOKINGS
          ============================================================= */}

          <div className="rounded-2xl border border-gray-100 bg-white shadow-sm lg:col-span-2">
            <div className="flex items-center justify-between border-b border-gray-100 p-6">
              <div>
                <h2 className="text-lg font-bold text-gray-900">
                  {isArabic ? "أحدث الحجوزات" : "Recent Bookings"}
                </h2>

                <p className="mt-1 text-sm text-gray-500">
                  {isArabic
                    ? "تفاصيل أحدث الحجوزات على إعلاناتك"
                    : "Details of the latest bookings for your listings"}
                </p>
              </div>

              <Link
                to="/host/bookings"
                className="text-sm font-semibold text-[#1a1a2e] hover:underline"
              >
                {isArabic ? "عرض الكل" : "View all"}
              </Link>
            </div>

            {/* NO BOOKINGS */}

            {recentBookings.length === 0 ? (
              <div className="p-10 text-center">
                <div className="mb-4 text-4xl">📅</div>

                <h3 className="font-semibold text-gray-900">
                  {isArabic ? "لا توجد حجوزات بعد" : "No bookings yet"}
                </h3>

                <p className="mt-2 text-sm text-gray-500">
                  {isArabic
                    ? "عندما يحجز أحد الضيوف إعلانك ستظهر الحجوزات هنا."
                    : "Bookings will appear here when guests book your listings."}
                </p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {recentBookings.map((booking) => {
                  const status = toRole(booking.status);

                  return (
                    <div
                      key={booking.id}
                      className="p-5 transition hover:bg-gray-50"
                    >
                      {/* ==================================================
                            TOP
                        =================================================== */}

                      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                        {/* LISTING */}

                        <div className="min-w-0">
                          <div className="flex items-center gap-3">
                            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#1a1a2e] text-lg">
                              🏠
                            </div>

                            <div className="min-w-0">
                              <p className="truncate text-sm font-bold text-gray-900">
                                {booking.listing?.title ||
                                  (isArabic ? "إعلان" : "Listing")}
                              </p>

                              <p className="mt-0.5 truncate text-xs text-gray-500">
                                {booking.listing?.location ||
                                  (isArabic
                                    ? "الموقع غير محدد"
                                    : "Location not specified")}
                              </p>
                            </div>
                          </div>

                          {/* BOOKING ID */}

                          <p className="mt-3 text-xs text-gray-400">
                            {isArabic ? "رقم الحجز" : "Booking ID"}:{" "}
                            <span className="font-mono">
                              #{booking.id.slice(0, 8)}
                            </span>
                          </p>
                        </div>

                        {/* PRICE + STATUS */}

                        <div className="flex shrink-0 flex-col items-start sm:items-end">
                          <p className="text-lg font-bold text-gray-900">
                            {formatCurrency(
                              getBookingAmount(booking),
                              isArabic,
                            )}
                          </p>

                          <span
                            className={`mt-1 rounded-full px-2.5 py-1 text-xs font-semibold ${getBookingStatusClasses(
                              booking.status,
                            )}`}
                          >
                            {getBookingStatusLabel(booking.status, isArabic)}
                          </span>
                        </div>
                      </div>

                      {/* ==================================================
                            BOOKING DETAILS
                        =================================================== */}

                      <div className="mt-5 grid grid-cols-1 gap-3 rounded-xl bg-gray-50 p-4 sm:grid-cols-2">
                        {/* DATES */}

                        <div className="flex items-start gap-3">
                          <span className="text-lg">📅</span>

                          <div>
                            <p className="text-[11px] font-medium uppercase tracking-wide text-gray-400">
                              {isArabic ? "تاريخ الإقامة" : "Stay dates"}
                            </p>

                            <p className="mt-1 text-sm font-semibold text-gray-900">
                              {formatBookingDateRange(booking, isArabic)}
                            </p>
                          </div>
                        </div>

                        {/* GUESTS */}

                        <div className="flex items-start gap-3">
                          <span className="text-lg">👥</span>

                          <div>
                            <p className="text-[11px] font-medium uppercase tracking-wide text-gray-400">
                              {isArabic ? "الضيوف" : "Guests"}
                            </p>

                            <p className="mt-1 text-sm font-semibold text-gray-900">
                              {booking.guests ?? 0}{" "}
                              {isArabic
                                ? "ضيوف"
                                : booking.guests === 1
                                  ? "guest"
                                  : "guests"}
                            </p>
                          </div>
                        </div>

                        {/* GUEST */}

                        <div className="flex items-start gap-3">
                          <span className="text-lg">👤</span>

                          <div className="min-w-0">
                            <p className="text-[11px] font-medium uppercase tracking-wide text-gray-400">
                              {isArabic ? "الضيف" : "Guest"}
                            </p>

                            <p className="mt-1 truncate text-sm font-semibold text-gray-900">
                              {booking.user?.name ||
                                (isArabic ? "غير محدد" : "Not specified")}
                            </p>
                          </div>
                        </div>

                        {/* PHONE */}

                        <div className="flex items-start gap-3">
                          <span className="text-lg">📞</span>

                          <div className="min-w-0">
                            <p className="text-[11px] font-medium uppercase tracking-wide text-gray-400">
                              {isArabic ? "الهاتف" : "Phone"}
                            </p>

                            <p className="mt-1 truncate text-sm font-semibold text-gray-900">
                              {booking.user?.phone_number ||
                                (isArabic ? "غير محدد" : "Not specified")}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* ==================================================
                            EMAIL
                        =================================================== */}

                      {booking.user?.email && (
                        <div className="mt-3 flex items-center gap-2 text-xs text-gray-500">
                          <span>✉️</span>

                          <span className="truncate">{booking.user.email}</span>
                        </div>
                      )}

                      {/* ==================================================
                            CHECK IN / CHECK OUT
                        =================================================== */}

                      {(booking.checked_in_at ||
                        booking.checked_out_at ||
                        booking.no_show) && (
                        <div className="mt-4 flex flex-wrap gap-2">
                          {booking.checked_in_at && (
                            <span className="rounded-lg bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700">
                              ✓ {isArabic ? "تم تسجيل الوصول" : "Checked in"}
                            </span>
                          )}

                          {booking.checked_out_at && (
                            <span className="rounded-lg bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700">
                              ✓ {isArabic ? "تم تسجيل المغادرة" : "Checked out"}
                            </span>
                          )}

                          {booking.no_show && (
                            <span className="rounded-lg bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700">
                              ⚠️ {isArabic ? "لم يحضر" : "No show"}
                            </span>
                          )}
                        </div>
                      )}

                      {/* ==================================================
                            CREATED DATE
                        =================================================== */}

                      <div className="mt-4 text-[11px] text-gray-400">
                        {isArabic ? "تم إنشاء الحجز" : "Booking created"}{" "}
                        {formatBookingDate(getBookingDate(booking), isArabic)}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* ============================================================
              QUICK ACTIONS
          ============================================================= */}

          <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
            <h2 className="mb-5 text-lg font-bold text-gray-900">
              {isArabic ? "إجراءات سريعة" : "Quick Actions"}
            </h2>

            <div className="space-y-3">
              {QUICK_ACTIONS.map((action) => (
                <Link
                  key={action.href}
                  to={action.href}
                  className="flex items-center gap-3 rounded-xl bg-gray-50 p-4 transition hover:bg-gray-100"
                >
                  <span
                    className={`flex h-10 w-10 items-center justify-center rounded-xl bg-[#1a1a2e] text-lg ${
                      "iconClass" in action ? action.iconClass : ""
                    }`}
                  >
                    {action.icon}
                  </span>

                  <div>
                    <p className="text-sm font-semibold text-gray-900">
                      {isArabic ? action.label.ar : action.label.en}
                    </p>

                    <p className="mt-1 text-xs text-gray-500">
                      {isArabic ? action.desc.ar : action.desc.en}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>

        {/* ================================================================
            PROFILE
        ================================================================= */}

        <div className="mt-8 rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-5 md:flex-row md:items-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#1a1a2e] text-xl font-bold text-[#e8c547]">
              {getInitials(user!.name)}
            </div>

            <div className="flex-1">
              <h2 className="text-lg font-bold text-gray-900">{user!.name}</h2>

              <p className="text-sm text-gray-500">{user!.email}</p>

              {user!.phone_number && (
                <p className="mt-1 text-sm text-gray-500">
                  {user!.phone_number}
                </p>
              )}
            </div>

            <div>
              <Link
                to="/host/settings"
                className="rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-900 hover:bg-gray-50"
              >
                {isArabic ? "تعديل الملف الشخصي" : "Edit Profile"}
              </Link>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default HostDashboard;
