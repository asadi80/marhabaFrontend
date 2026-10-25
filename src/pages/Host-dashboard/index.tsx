import React, { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";

import { useAuth } from "../../context/AuthContext";
import { useLanguage } from "../../hooks/useLanguage";
import Navbar from "../../components/Navbar";
import { apiService } from "../../services/api";

/* ==========================================================================
   TYPES
========================================================================== */

interface Listing {
  id: string;
  title?: string;
}

interface Booking {
  id: string;
  check_in?: string;
  check_out?: string;
  total_price?: number | string;
  total_amount?: number | string;
  totalAmount?: number | string;
  amount?: number | string;
  guests?: number;
  status?: string;
  created_at?: string;
  createdAt?: string;
  listing?: { id: string; title?: string; location?: string };
  user?: { name?: string; email?: string; phone_number?: string };
}

/* ==========================================================================
   CONSTANTS
========================================================================== */

const HOST_ROLE = "host";

// Adjust the first href if your dashboard route is different.
const NAV_LINKS = [
  { id: "dashboard", label: "Home", labelAr: "الرئيسية", href: "/host-dashboard", icon: "🏡" },
  { id: "listings", label: "Listings", labelAr: "إعلاناتي", href: "/host/listings", icon: "🏠" },
  { id: "bookings", label: "Bookings", labelAr: "الحجوزات", href: "/host/bookings", icon: "📅" },
  { id: "settings", label: "Settings", labelAr: "الإعدادات", href: "/host/settings", icon: "⚙️" },
];

/* ==========================================================================
   HELPERS
========================================================================== */

const toRole = (value?: string) => String(value || "").toLowerCase();

const formatCurrency = (value: number, isArabic: boolean) =>
  new Intl.NumberFormat(isArabic ? "ar-LY" : "en-LY", {
    style: "currency",
    currency: "LYD",
    maximumFractionDigits: 2,
  }).format(value);

const getAmount = (b: Booking) =>
  Number(b.total_price ?? b.total_amount ?? b.totalAmount ?? b.amount ?? 0) || 0;

const getCreated = (b: Booking) => b.created_at || b.createdAt || "";

const formatDate = (date: string | undefined, isArabic: boolean) => {
  if (!date) return "—";
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(isArabic ? "ar-LY" : "en-US", {
    month: "short",
    day: "numeric",
  });
};

const isConfirmed = (status?: string) =>
  ["confirmed", "checked_in", "checked_out", "completed"].includes(toRole(status));

const BOOKING_STATUS: Record<string, [string, string]> = {
  pending: ["Pending", "قيد الانتظار"],
  confirmed: ["Confirmed", "مؤكد"],
  checked_in: ["Checked in", "وصل"],
  checked_out: ["Checked out", "غادر"],
  approved: ["Approved", "تمت الموافقة"],
  completed: ["Completed", "مكتمل"],
  cancelled: ["Cancelled", "ملغى"],
  rejected: ["Rejected", "مرفوض"],
  no_show: ["No show", "لم يحضر"],
};

const statusLabel = (status: string | undefined, isArabic: boolean) => {
  const label = BOOKING_STATUS[toRole(status)];
  return label ? label[isArabic ? 1 : 0] : status || (isArabic ? "غير معروف" : "Unknown");
};

const statusClasses = (status?: string) => {
  const s = toRole(status);
  if (["confirmed", "approved", "completed", "checked_in", "checked_out"].includes(s))
    return "bg-emerald-50 text-emerald-700";
  if (["cancelled", "rejected", "no_show"].includes(s)) return "bg-red-50 text-red-700";
  return "bg-amber-50 text-amber-700";
};

const Skeleton: React.FC<{ className?: string }> = ({ className = "" }) => (
  <div className={`animate-pulse rounded-lg bg-gray-200/80 ${className}`} />
);

/* ==========================================================================
   COMPONENT
========================================================================== */

const HostDashboard: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isAuthenticated, isLoading: authLoading, updateVerificationStatus } = useAuth();
  const { lang, toggleLanguage } = useLanguage();

  const isArabic = lang === "ar";
  const t = (en: string, ar: string) => (isArabic ? ar : en);

  const [loading, setLoading] = useState(true);
  const [listings, setListings] = useState<Listing[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [error, setError] = useState("");
  const [dataLoaded, setDataLoaded] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

  const isAuthorizedHost = isAuthenticated && !!user && toRole(user.role) === HOST_ROLE;

  /* ---------------------------- Authorization --------------------------- */

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated || !user) {
      navigate("/login", { replace: true });
      return;
    }
    if (toRole(user.role) !== HOST_ROLE) navigate("/user-dashboard", { replace: true });
  }, [authLoading, isAuthenticated, user, navigate]);

  /* ---------------------------- Load data ------------------------------- */

  useEffect(() => {
    if (authLoading || !isAuthorizedHost || dataLoaded || !user) return;

    const load = async () => {
      setLoading(true);
      setError("");

      try {
        const [listingsRes, bookingsRes, verificationRes] = await Promise.allSettled([
          apiService.getProtectedData<any>(`/api/v1/listings/host/${user.id}`),
          apiService.getProtectedData<any>("/api/v1/bookings/host"),
          apiService.getProtectedData<any>("/api/v1/auth/host-verification-status"),
        ]);

        if (listingsRes.status === "fulfilled" && listingsRes.value.success) {
          const d = listingsRes.value.data;
          setListings(Array.isArray(d) ? d : Array.isArray(d?.listings) ? d.listings : []);
        }

        if (bookingsRes.status === "fulfilled" && bookingsRes.value.success) {
          const d = bookingsRes.value.data;
          setBookings(Array.isArray(d) ? d : Array.isArray(d?.bookings) ? d.bookings : []);
        } else {
          setError(t("Could not load bookings", "تعذر تحميل الحجوزات"));
        }

        if (
          verificationRes.status === "fulfilled" &&
          verificationRes.value.success &&
          verificationRes.value.data
        ) {
          updateVerificationStatus(verificationRes.value.data);
        }
      } catch {
        setError(t("Something went wrong. Pull to refresh.", "حدث خطأ. حاول مرة أخرى."));
      } finally {
        setDataLoaded(true);
        setLoading(false);
      }
    };

    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, isAuthorizedHost, dataLoaded, updateVerificationStatus]);

  /* ---------------------------- Derived data ---------------------------- */

  const stats = useMemo(() => {
    const confirmed = bookings.filter((b) => isConfirmed(b.status));
    return {
      listings: listings.length,
      bookings: bookings.length,
      confirmed: confirmed.length,
      earnings: confirmed.reduce((sum, b) => sum + getAmount(b), 0),
    };
  }, [listings, bookings]);

  const recent = useMemo(
    () =>
      [...bookings]
        .sort((a, b) => new Date(getCreated(b)).getTime() - new Date(getCreated(a)).getTime())
        .slice(0, 5),
    [bookings],
  );

  const userStatus = toRole(user?.status);
  const firstName = (user?.name || "").trim().split(/\s+/)[0] || t("Host", "مضيف");

  /* ---------------------------- Guards ---------------------------------- */

  // Only wait for auth. Dashboard data never blocks the page.
  if (authLoading || !isAuthorizedHost) return null;

  /* ---------------------------- Render ---------------------------------- */

  return (
    <div
      className={`min-h-screen bg-gray-50 text-gray-900 ${isArabic ? "font-arabic" : "font-sans"}`}
      dir={isArabic ? "rtl" : "ltr"}
    >
      {/* Desktop navbar */}
      <div className="hidden md:block">
        <Navbar NAV_LINKS={NAV_LINKS} lang={lang} toggleLanguage={toggleLanguage} />
      </div>

      {/* Mobile top bar */}
      <header
        className="sticky top-0 z-30 flex items-center justify-between bg-[#1a1a2e] px-4 pb-3 pt-[calc(env(safe-area-inset-top)+12px)] md:hidden"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#e8c547] text-sm font-bold text-[#1a1a2e]">
            {firstName.charAt(0).toUpperCase()}
          </div>
          <div className="leading-tight">
            <p className="text-xs text-white/60">{t("Welcome back", "أهلاً بعودتك")}</p>
            <p className="text-base font-semibold text-white">{firstName}</p>
          </div>
        </div>

        <button
          onClick={toggleLanguage}
          className="rounded-full border border-white/20 px-3 py-1.5 text-xs font-medium text-white active:bg-white/10"
        >
          {isArabic ? "EN" : "عربي"}
        </button>
      </header>

      <main className="mx-auto max-w-5xl px-4 pb-28 pt-5 md:px-6 md:pb-12 md:pt-8">
        {/* Desktop greeting */}
        <div className="mb-6 hidden items-center justify-between md:flex">
          <div>
            <h1 className="text-2xl font-bold">
              {t("Welcome back,", "أهلاً بعودتك،")} {firstName}
            </h1>
            <p className="text-sm text-gray-500">
              {t("Here is how your place is doing.", "هذا ملخص نشاطك اليوم.")}
            </p>
          </div>
          <Link
            to="/host/listings"
            className="rounded-xl bg-[#1a1a2e] px-5 py-3 text-sm font-semibold text-[#e8c547] transition hover:opacity-90"
          >
            + {t("New listing", "إعلان جديد")}
          </Link>
        </div>

        {/* Account notice (one slim banner) */}
        {["pending", "suspended", "expired"].includes(userStatus) && (
          <Link
            to="/host/settings"
            className={`mb-5 flex items-center justify-between gap-3 rounded-2xl p-4 text-sm ${
              userStatus === "pending"
                ? "bg-amber-50 text-amber-900"
                : "bg-red-50 text-red-800"
            }`}
          >
            <span className="flex items-center gap-3">
              <span className="text-xl">{userStatus === "pending" ? "⏳" : "⚠️"}</span>
              <span>
                {userStatus === "pending" &&
                  t("Your account is under review. Finish verification.", "حسابك قيد المراجعة. أكمل التحقق.")}
                {userStatus === "suspended" &&
                  (user?.statusReason || t("Your account is suspended.", "حسابك موقوف."))}
                {userStatus === "expired" &&
                  t("Your subscription expired. See settings.", "انتهى اشتراكك. راجع الإعدادات.")}
              </span>
            </span>
            <span className="text-lg">{isArabic ? "‹" : "›"}</span>
          </Link>
        )}

        {error && (
          <div className="mb-5 rounded-2xl bg-red-50 p-4 text-sm text-red-700">{error}</div>
        )}

        {/* Earnings */}
        <section className="mb-4 rounded-3xl bg-gradient-to-br from-[#1a1a2e] to-[#2d2d5e] p-5 text-white shadow-sm">
          <p className="text-sm text-white/60">{t("Earnings", "الأرباح")}</p>
          <div className="mt-1 text-3xl font-bold text-[#e8c547]">
            {loading ? (
              <Skeleton className="mt-2 h-9 w-40 !bg-white/15" />
            ) : (
              formatCurrency(stats.earnings, isArabic)
            )}
          </div>
          <p className="mt-1 text-xs text-white/50">
            {t("From confirmed bookings", "من الحجوزات المؤكدة")}
          </p>
        </section>

        {/* Small stats */}
        <section className="mb-6 grid grid-cols-2 gap-3">
          <Link
            to="/host/listings"
            className="rounded-2xl bg-white p-4 shadow-sm active:scale-[0.98]"
          >
            <p className="text-xs text-gray-500">{t("Listings", "الإعلانات")}</p>
            <div className="mt-1 text-2xl font-bold">
              {loading ? <Skeleton className="h-8 w-10" /> : stats.listings}
            </div>
          </Link>

          <Link
            to="/host/bookings"
            className="rounded-2xl bg-white p-4 shadow-sm active:scale-[0.98]"
          >
            <p className="text-xs text-gray-500">{t("Bookings", "الحجوزات")}</p>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-2xl font-bold">
                {loading ? <Skeleton className="h-8 w-10" /> : stats.bookings}
              </span>
              {!loading && (
                <span className="text-xs text-emerald-600">
                  {stats.confirmed} {t("confirmed", "مؤكدة")}
                </span>
              )}
            </div>
          </Link>
        </section>

        {/* Recent bookings */}
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-bold">{t("Recent bookings", "أحدث الحجوزات")}</h2>
            <Link to="/host/bookings" className="text-sm font-semibold text-[#1a1a2e]">
              {t("See all", "عرض الكل")}
            </Link>
          </div>

          <div className="space-y-3">
            {loading &&
              [1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-3 rounded-2xl bg-white p-4 shadow-sm">
                  <Skeleton className="h-11 w-11 shrink-0 rounded-xl" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-3/5" />
                    <Skeleton className="h-3 w-2/5" />
                  </div>
                  <Skeleton className="h-5 w-16" />
                </div>
              ))}

            {!loading && recent.length === 0 && (
              <div className="rounded-2xl bg-white p-8 text-center shadow-sm">
                <div className="mb-2 text-4xl">📅</div>
                <p className="font-semibold">{t("No bookings yet", "لا توجد حجوزات بعد")}</p>
                <p className="mt-1 text-sm text-gray-500">
                  {t("New bookings will show up here.", "ستظهر الحجوزات الجديدة هنا.")}
                </p>
                <Link
                  to="/host/listings"
                  className="mt-4 inline-block rounded-xl bg-[#1a1a2e] px-5 py-2.5 text-sm font-semibold text-[#e8c547]"
                >
                  {t("Add a listing", "أضف إعلاناً")}
                </Link>
              </div>
            )}

            {!loading &&
              recent.map((b) => {
                const open = openId === b.id;
                return (
                  <div key={b.id} className="overflow-hidden rounded-2xl bg-white shadow-sm">
                    <button
                      onClick={() => setOpenId(open ? null : b.id)}
                      className="flex w-full items-center gap-3 p-4 text-start active:bg-gray-50"
                    >
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#1a1a2e]/5 text-lg">
                        🏠
                      </div>

                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold">
                          {b.listing?.title || t("Listing", "إعلان")}
                        </p>
                        <p className="mt-0.5 truncate text-xs text-gray-500">
                          {formatDate(b.check_in, isArabic)} – {formatDate(b.check_out, isArabic)}
                          {b.user?.name ? ` · ${b.user.name}` : ""}
                        </p>
                      </div>

                      <div className="shrink-0 text-end">
                        <p className="text-sm font-bold">{formatCurrency(getAmount(b), isArabic)}</p>
                        <span
                          className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold ${statusClasses(
                            b.status,
                          )}`}
                        >
                          {statusLabel(b.status, isArabic)}
                        </span>
                      </div>
                    </button>

                    {open && (
                      <div className="space-y-2 border-t border-gray-100 bg-gray-50 px-4 py-3 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-500">{t("Guests", "الضيوف")}</span>
                          <span className="font-medium">{b.guests ?? 1}</span>
                        </div>
                        {b.user?.phone_number && (
                          <div className="flex justify-between">
                            <span className="text-gray-500">{t("Phone", "الهاتف")}</span>
                            <a
                              href={`tel:${b.user.phone_number}`}
                              dir="ltr"
                              className="font-medium text-[#1a1a2e] underline"
                            >
                              {b.user.phone_number}
                            </a>
                          </div>
                        )}
                        {b.user?.email && (
                          <div className="flex justify-between gap-4">
                            <span className="text-gray-500">{t("Email", "البريد")}</span>
                            <span className="truncate font-medium">{b.user.email}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
          </div>
        </section>
      </main>

      {/* Mobile floating add button */}
      <Link
        to="/host/listings"
        aria-label={t("New listing", "إعلان جديد")}
        className="fixed bottom-[calc(env(safe-area-inset-bottom)+76px)] end-4 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-[#e8c547] text-3xl font-light text-[#1a1a2e] shadow-lg active:scale-95 md:hidden"
      >
        +
      </Link>

      {/* Mobile bottom tab bar */}
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-gray-200 bg-white pb-[env(safe-area-inset-bottom)] md:hidden">
        <ul className="mx-auto flex max-w-md">
          {NAV_LINKS.map((item) => {
            const active = location.pathname === item.href;
            return (
              <li key={item.id} className="flex-1">
                <Link
                  to={item.href}
                  className={`flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-medium ${
                    active ? "text-[#1a1a2e]" : "text-gray-400"
                  }`}
                >
                  <span className={`text-xl ${active ? "" : "opacity-60 grayscale"}`}>{item.icon}</span>
                  {isArabic ? item.labelAr : item.label}
                  <span
                    className={`h-1 w-1 rounded-full ${active ? "bg-[#e8c547]" : "bg-transparent"}`}
                  />
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
};

export default HostDashboard;