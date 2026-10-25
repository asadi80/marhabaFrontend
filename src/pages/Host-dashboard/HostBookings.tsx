import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";

import { useAuth } from "../../context/AuthContext";
import { useLanguage } from "../../hooks/useLanguage";
import Navbar from "../../components/Navbar";
import { apiService } from "../../services/api";
import HostCalendar from "../../components/HostCalendar";

/* ==========================================================================
   TOKEN GUARD
   UX nicety only (redirects early when the stored token is missing/expired).
   The real security boundary is the server rejecting bad tokens.
========================================================================== */

const HOST_ROLE = "host";

const readStoredAccessToken = (): string | null => {
  try {
    const raw = localStorage.getItem("tokens");
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return typeof parsed?.accessToken === "string" ? parsed.accessToken : null;
  } catch {
    return null;
  }
};

const isJwtExpired = (token: string): boolean => {
  try {
    const payloadB64 = token.split(".")[1];
    const payload = JSON.parse(
      atob(payloadB64.replace(/-/g, "+").replace(/_/g, "/")),
    );
    if (!payload?.exp) return false;
    return Date.now() >= payload.exp * 1000;
  } catch {
    return true;
  }
};

const hasValidStoredToken = (): boolean => {
  const token = readStoredAccessToken();
  return !!token && !isJwtExpired(token);
};

const toRole = (role?: string) => String(role || "").toLowerCase();

/* ==========================================================================
   TYPES
========================================================================== */

type BookingStatus =
  | "pending"
  | "confirmed"
  | "checked_in"
  | "checked_out"
  | "cancelled"
  | "no_show";

interface BlockedDateRange {
  id?: string;
  startDate: string;
  endDate: string;
  reason?: string;
}

interface Booking {
  id: string;
  listing_id: string;
  user_id: string;
  check_in: string;
  check_out: string;
  check_in_display?: string;
  check_out_display?: string;
  guests: number;
  total_price: number;
  status: BookingStatus;
  no_show: boolean | null;
  checked_in_at: string | null;
  checked_out_at: string | null;
  created_at: string;
  listing?: {
    id: string;
    title: string;
    location: string;
    images?: string[];
    blocked_dates?: BlockedDateRange[];
  };
  user?: { id: string; name: string; email: string; phone_number: string };
}

interface HostListing {
  id: string;
  title: string;
  images: string[];
  blocked_dates: BlockedDateRange[];
}

interface BlockedUser {
  id: string;
  user_id: string;
  user_name: string;
  user_email: string;
  reason: string;
  created_at: string;
}

type TFn = (en: string, ar: string) => string;
type View = "bookings" | "calendar" | "dates" | "users";
type StatusFilter = "all" | "pending" | "confirmed" | "cancelled" | "noshow";

/* ==========================================================================
   CONSTANTS
========================================================================== */

const NAV_LINKS = [
  {
    id: "dashboard",
    label: "Home",
    labelAr: "الرئيسية",
    href: "/host-dashboard",
    icon: "🏡",
  },
  {
    id: "listings",
    label: "Listings",
    labelAr: "إعلاناتي",
    href: "/host/listings",
    icon: "🏠",
  },
  {
    id: "bookings",
    label: "Bookings",
    labelAr: "الحجوزات",
    href: "/host/bookings",
    icon: "📅",
  },
  {
    id: "settings",
    label: "Settings",
    labelAr: "الإعدادات",
    href: "/host/settings",
    icon: "⚙️",
  },
];

const STATUS_CLASSES: Record<string, string> = {
  confirmed: "bg-emerald-50 text-emerald-700",
  pending: "bg-amber-50 text-amber-700",
  cancelled: "bg-red-50 text-red-700",
  checked_in: "bg-teal-50 text-teal-700",
  checked_out: "bg-violet-50 text-violet-700",
  no_show: "bg-orange-50 text-orange-700",
};

const inputCls =
  "w-full rounded-xl border border-gray-200 bg-white px-3.5 py-3 text-base outline-none transition focus:border-[#e8c547] focus:ring-2 focus:ring-[#e8c547]/30";

/* ==========================================================================
   SMALL UI PIECES
========================================================================== */

const Skeleton: React.FC<{ className?: string }> = ({ className = "" }) => (
  <div className={`animate-pulse rounded-lg bg-gray-200/80 ${className}`} />
);

const Spinner: React.FC<{ light?: boolean }> = ({ light }) => (
  <span
    className={`inline-block h-4 w-4 animate-spin rounded-full border-2 border-t-transparent ${
      light ? "border-[#e8c547]" : "border-current"
    }`}
  />
);

const EmptyState: React.FC<{ icon: string; title: string; hint?: string }> = ({
  icon,
  title,
  hint,
}) => (
  <div className="rounded-2xl bg-white p-10 text-center shadow-sm">
    <div className="mb-2 text-4xl">{icon}</div>
    <p className="font-semibold text-gray-900">{title}</p>
    {hint && <p className="mt-1 text-sm text-gray-500">{hint}</p>}
  </div>
);

const Badge: React.FC<{ cls: string; children: React.ReactNode }> = ({
  cls,
  children,
}) => (
  <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${cls}`}>
    {children}
  </span>
);

const Info: React.FC<{
  label: string;
  wide?: boolean;
  children: React.ReactNode;
}> = ({ label, wide, children }) => (
  <div className={`min-w-0 ${wide ? "col-span-2" : ""}`}>
    <p className="text-[11px] font-medium uppercase tracking-wide text-gray-400">
      {label}
    </p>
    <div className="mt-0.5 break-words text-sm font-medium text-gray-800">
      {children}
    </div>
  </div>
);

interface ActionBtnProps {
  onClick: () => void;
  disabled?: boolean;
  spinning?: boolean;
  tone: "primary" | "danger" | "warn" | "soft" | "violet" | "green" | "muted";
  children: React.ReactNode;
}

const TONES: Record<ActionBtnProps["tone"], string> = {
  primary: "bg-[#1a1a2e] text-[#e8c547]",
  danger: "bg-red-50 text-red-700",
  warn: "bg-orange-50 text-orange-700",
  soft: "bg-gray-100 text-gray-700",
  violet: "bg-violet-50 text-violet-700",
  green: "bg-emerald-50 text-emerald-700",
  muted: "bg-gray-100 text-gray-400",
};

const ActionBtn: React.FC<ActionBtnProps> = ({
  onClick,
  disabled,
  spinning,
  tone,
  children,
}) => (
  <button
    onClick={onClick}
    disabled={disabled || spinning}
    className={`flex min-h-[44px] flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-xl px-4 text-sm font-semibold transition active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-60 ${TONES[tone]}`}
  >
    {spinning ? <Spinner light={tone === "primary"} /> : children}
  </button>
);

/* ==========================================================================
   MAIN COMPONENT
========================================================================== */

const HostBookings: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const { lang, toggleLanguage } = useLanguage();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();

  const isAr = lang === "ar";
  const t: TFn = (en, ar) => (isAr ? ar : en);
  const isAuthorizedHost =
    isAuthenticated && !!user && toRole(user.role) === HOST_ROLE;

  /* ------------------------------ State -------------------------------- */

  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [view, setView] = useState<View>("bookings");
  const [filter, setFilter] = useState<StatusFilter>("all");

  const [actionLoading, setActionLoading] = useState<{
    id: string;
    action: string;
  } | null>(null);

  const [fetchedListings, setFetchedListings] = useState<HostListing[]>([]);
  const [blockedDates, setBlockedDates] = useState<
    Record<string, BlockedDateRange[]>
  >({});
  const [blockedUsers, setBlockedUsers] = useState<BlockedUser[]>([]);
  const [unblockLoading, setUnblockLoading] = useState<string | null>(null);

  // Add-blocked-date form
  const [selectedListingId, setSelectedListingId] = useState("");
  const [newStartDate, setNewStartDate] = useState("");
  const [newEndDate, setNewEndDate] = useState("");
  const [newReason, setNewReason] = useState("");
  const [blockedDateLoading, setBlockedDateLoading] = useState(false);
  const [blockedDateError, setBlockedDateError] = useState("");
  const [deletingDateId, setDeletingDateId] = useState<string | null>(null);

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

  /* ----------------------------- Helpers ------------------------------- */

  const formatCurrency = (amount: number) =>
    isAr
      ? `${Math.round(Number(amount) || 0).toLocaleString()} دينار`
      : `${Math.round(Number(amount) || 0).toLocaleString()} LYD`;

  const formatDate = (s: string) =>
    new Date(s).toLocaleDateString(isAr ? "ar-LY" : "en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
      timeZone: "UTC",
    });

  const calcNights = (ci: string, co: string) => {
    const a = new Date(ci);
    const b = new Date(co);
    return Math.ceil(
      (Date.UTC(b.getUTCFullYear(), b.getUTCMonth(), b.getUTCDate()) -
        Date.UTC(a.getUTCFullYear(), a.getUTCMonth(), a.getUTCDate())) /
        86400000,
    );
  };

  const statusLabel = (status: BookingStatus) =>
    ({
      confirmed: t("Confirmed", "مؤكد"),
      pending: t("Pending", "قيد الانتظار"),
      cancelled: t("Cancelled", "ملغى"),
      checked_in: t("Checked In", "تم الوصول"),
      checked_out: t("Checked Out", "تمت المغادرة"),
      no_show: t("No-Show", "غائب"),
    })[status] ?? status;

  /* ------------------------ Auth + role guard -------------------------- */

  useEffect(() => {
    if (authLoading) return;

    if (!isAuthenticated || !user || !hasValidStoredToken()) {
      navigate("/login", { replace: true });
      return;
    }

    if (toRole(user.role) !== HOST_ROLE) {
      navigate("/user-dashboard", { replace: true });
      return;
    }

    const intervalId = window.setInterval(() => {
      if (!hasValidStoredToken()) navigate("/login", { replace: true });
    }, 60_000);

    return () => window.clearInterval(intervalId);
  }, [authLoading, isAuthenticated, user, navigate]);

  /* ------------------------- Fetch bookings ---------------------------- */

  // silent = refresh in the background without bringing the skeletons back
  const fetchBookings = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      setError("");

      try {
        const response = await apiService.getProtectedData<
          Booking[] | { bookings: Booking[] }
        >("/api/v1/bookings/host");

        if (response.success && response.data) {
          const fetched: Booking[] = Array.isArray(response.data)
            ? response.data
            : Array.isArray(response.data.bookings)
              ? response.data.bookings
              : [];

          setBookings(fetched);

          // Derive blocked dates per listing from the bookings payload
          // (every booking carries its listing's full blocked_dates list).
          const map: Record<string, BlockedDateRange[]> = {};
          fetched.forEach((booking) => {
            const listing = booking.listing;
            if (!listing?.id) return;
            const dates = Array.isArray(listing.blocked_dates)
              ? listing.blocked_dates
              : [];
            const existing = map[listing.id] ?? [];
            dates.forEach((d) => {
              if (!existing.some((x) => x.id === d.id)) existing.push(d);
            });
            map[listing.id] = existing;
          });
          setBlockedDates(map);
        } else {
          setBookings([]);
          setBlockedDates({});
          setError(
            response.message || t("No bookings found", "لا توجد حجوزات"),
          );
        }
      } catch (err: any) {
        setError(
          err?.message || t("Failed to fetch bookings", "فشل تحميل الحجوزات"),
        );
        setBookings([]);
        setBlockedDates({});
      } finally {
        setLoading(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isAr],
  );

  const fetchBlockedUsers = useCallback(async () => {
    try {
      const response = await apiService.getProtectedData<{
        blockedUsers: BlockedUser[];
      }>("/api/v1/host/blocked-users");
      if (response.success && response.data)
        setBlockedUsers(response.data.blockedUsers || []);
    } catch {
      /* non-critical */
    }
  }, []);

  // The host's own listings (so a listing with no bookings can still be blocked / shown)
  const fetchHostListings = useCallback(async () => {
    if (!user?.id) return;

    try {
      const response = await apiService.getProtectedData<any>(
        `/api/v1/listings/host/${user.id}`,
      );
      const d = response?.data;
      const list: any[] = Array.isArray(d)
        ? d
        : Array.isArray(d?.listings)
          ? d.listings
          : [];

      setFetchedListings(
        list.map((l) => ({
          id: l.id,
          title: l.title,
          images: l.images ?? [],
          blocked_dates: l.blocked_dates ?? [],
        })),
      );
    } catch {
      /* non-critical */
    }
  }, [user?.id]);

  useEffect(() => {
    if (!isAuthorizedHost) return;
    fetchBookings();
    fetchBlockedUsers();
    fetchHostListings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthorizedHost]);

  // Listings = the host's listings, plus any that only appear inside bookings
  const hostListings: HostListing[] = useMemo(() => {
    const map = new Map<string, HostListing>();

    fetchedListings.forEach((l) => map.set(l.id, l));

    bookings.forEach((b) => {
      if (!b.listing?.id || map.has(b.listing.id)) return;
      map.set(b.listing.id, {
        id: b.listing.id,
        title: b.listing.title,
        images: b.listing.images ?? [],
        blocked_dates: b.listing.blocked_dates ?? [],
      });
    });

    return Array.from(map.values());
  }, [fetchedListings, bookings]);

  /* --------------------------- Booking actions ------------------------- */

  const handleAction = async (
    bookingId: string,
    action: "confirm" | "cancel" | "check_in" | "check_out" | "no_show",
    confirmMsg: string,
    successMsg: string,
  ) => {
    if (!confirm(confirmMsg)) return;

    const STATUS_BY_ACTION: Record<string, BookingStatus> = {
      confirm: "confirmed",
      cancel: "cancelled",
      check_in: "checked_in",
      check_out: "checked_out",
      no_show: "no_show",
    };

    setActionLoading({ id: bookingId, action });

    try {
      const response = await apiService.putProtectedData(
        `/api/v1/bookings/${bookingId}/status`,
        {
          status: STATUS_BY_ACTION[action],
        },
      );
      if (!response?.success)
        throw new Error(response?.message || "Failed to update booking");

      notify(successMsg);

      // The booking stays in the list; only its status transitions
      // (confirmed -> checked_in -> checked_out), so a refetch keeps everything in sync.
      await fetchBookings(true);
    } catch (err) {
      notify(
        err instanceof Error ? err.message : "Failed to update booking",
        false,
      );
    } finally {
      setActionLoading(null);
    }
  };

  const onConfirm = (id: string) =>
    handleAction(
      id,
      "confirm",
      t("Confirm this booking?", "تأكيد هذا الحجز؟"),
      t("Booking confirmed.", "تم تأكيد الحجز"),
    );

  const onCancel = (id: string) =>
    handleAction(
      id,
      "cancel",
      t("Cancel this booking?", "إلغاء هذا الحجز؟"),
      t("Booking cancelled.", "تم إلغاء الحجز"),
    );

  const onCheckIn = (id: string) =>
    handleAction(
      id,
      "check_in",
      t("Mark guest as checked in?", "هل تريد تسجيل وصول الضيف؟"),
      t(
        "Check-in recorded and email sent.",
        "تم تسجيل الوصول وإرسال البريد الإلكتروني.",
      ),
    );

  const onCheckOut = (id: string) =>
    handleAction(
      id,
      "check_out",
      t("Mark guest as checked out?", "هل تريد تسجيل مغادرة الضيف؟"),
      t(
        "Check-out recorded and email sent.",
        "تم تسجيل المغادرة وإرسال البريد الإلكتروني.",
      ),
    );

  const onNoShow = (id: string) =>
    handleAction(
      id,
      "no_show",
      t(
        "Mark guest as no-show? This will cancel the booking.",
        "هل تريد تسجيل الضيف كغائب؟ سيتم إلغاء الحجز.",
      ),
      t("No-show recorded.", "تم تسجيل الغياب."),
    );

  /* --------------------------- Block / unblock ------------------------- */

  const onBlockUser = async (booking: Booking) => {
    const userId = booking.user?.id || booking.user_id;

    if (!userId) {
      notify(
        t(
          "Could not find the user for this booking.",
          "تعذر العثور على المستخدم لهذا الحجز.",
        ),
        false,
      );
      return;
    }

    if (
      !confirm(
        t(
          "Block this user from booking your listings?",
          "هل تريد حظر هذا المستخدم من حجز عقاراتك؟",
        ),
      )
    )
      return;

    setActionLoading({ id: booking.id, action: "block_user" });

    try {
      const reason =
        booking.status === "no_show"
          ? "no_show"
          : booking.status === "cancelled"
            ? "cancellation"
            : "manual";

      const response = await apiService.postProtectedData<{
        success: boolean;
        message?: string;
      }>("/api/v1/host/blocked-user", {
        userId,
        bookingId: booking.id,
        reason,
      });
      if (!response?.success)
        throw new Error(
          response?.message || t("Failed to block user", "فشل حظر المستخدم"),
        );

      notify(t("User blocked successfully.", "تم حظر المستخدم بنجاح."));
      await fetchBlockedUsers();
    } catch (err) {
      notify(
        err instanceof Error
          ? err.message
          : t("Failed to block user", "فشل حظر المستخدم"),
        false,
      );
    } finally {
      setActionLoading(null);
    }
  };

  const onUnblock = async (userId: string) => {
    if (!confirm(t("Unblock this user?", "هل تريد إلغاء حظر هذا المستخدم؟")))
      return;

    setUnblockLoading(userId);

    try {
      const response = await apiService.deleteProtectedData<{
        success: boolean;
        message?: string;
      }>(`/api/v1/host/blocked-users/${userId}`);
      if (!response?.success)
        throw new Error(
          response?.message ||
            t("Failed to unblock user", "فشل إلغاء حظر المستخدم"),
        );

      notify(t("User unblocked successfully.", "تم إلغاء حظر المستخدم بنجاح."));
      await fetchBlockedUsers();
    } catch (err: any) {
      notify(
        err?.message || t("Failed to unblock user", "فشل إلغاء حظر المستخدم"),
        false,
      );
    } finally {
      setUnblockLoading(null);
    }
  };

  /* ------------------------- Blocked dates (add/delete) ---------------- */

  const handleAddBlockedDate = async () => {
    setBlockedDateError("");

    if (!selectedListingId) {
      setBlockedDateError(t("Please select a listing", "الرجاء اختيار إعلان"));
      return;
    }
    if (!newStartDate || !newEndDate) {
      setBlockedDateError(
        t(
          "Please select both start and end dates",
          "الرجاء اختيار تاريخي البداية والنهاية",
        ),
      );
      return;
    }
    if (newEndDate <= newStartDate) {
      setBlockedDateError(
        t(
          "End date must be after start date",
          "تاريخ النهاية يجب أن يكون بعد تاريخ البداية",
        ),
      );
      return;
    }

    setBlockedDateLoading(true);

    try {
      const response = await apiService.patchProtectedData<{
        success: boolean;
        message?: string;
      }>(`/api/v1/listings/${selectedListingId}/blocked-dates`, {
        blocked_dates: [
          {
            startDate: newStartDate,
            endDate: newEndDate,
            reason: newReason.trim() || "Blocked by host",
          },
        ],
      });
      if (!response?.success)
        throw new Error(response?.message || "Failed to add blocked date");

      notify(t("Unavailable date added", "تمت إضافة التاريخ غير المتاح"));
      await fetchBookings(true);

      setNewStartDate("");
      setNewEndDate("");
      setNewReason("");
      setSelectedListingId("");
    } catch (err: any) {
      setBlockedDateError(err?.message || "Failed to add blocked date");
    } finally {
      setBlockedDateLoading(false);
    }
  };

  const handleDeleteBlockedDate = async (
    listingId: string,
    blockedDateId: string,
  ) => {
    if (
      !confirm(
        t(
          "Delete this unavailable date?",
          "هل تريد حذف هذا التاريخ غير المتاح؟",
        ),
      )
    )
      return;

    setDeletingDateId(blockedDateId);

    try {
      const response = await apiService.deleteProtectedData<{
        success: boolean;
        message?: string;
      }>(`/api/v1/listings/${listingId}/blocked-dates/${blockedDateId}`);
      if (!response?.success)
        throw new Error(response?.message || "Failed to delete blocked date");

      notify(t("Unavailable date deleted", "تم حذف التاريخ غير المتاح"));
      setBlockedDates((prev) => ({
        ...prev,
        [listingId]: (prev[listingId] || []).filter(
          (bd) => bd.id !== blockedDateId,
        ),
      }));
    } catch (err: any) {
      notify(err?.message || "Failed to delete blocked date", false);
    } finally {
      setDeletingDateId(null);
    }
  };

  /* ----------------------------- Derived ------------------------------- */

  const isNoShowBooking = (b: Booking) => !!b.no_show || b.status === "no_show";

  // Total / Confirmed / Pending / Cancelled / No-shows: shown once, on the filter chips
  const counts = useMemo(
    () => ({
      all: bookings.length,
      pending: bookings.filter((b) => b.status === "pending").length,
      confirmed: bookings.filter((b) => b.status === "confirmed").length,
      cancelled: bookings.filter((b) => b.status === "cancelled").length,
      noshow: bookings.filter(isNoShowBooking).length,
    }),
    [bookings],
  );

  const filtered = useMemo(() => {
    if (filter === "all") return bookings;
    if (filter === "noshow") return bookings.filter(isNoShowBooking);
    return bookings.filter((b) => b.status === filter);
  }, [bookings, filter]);

  const VIEWS: { id: View; label: string }[] = [
    { id: "bookings", label: t("Bookings", "الحجوزات") },
    { id: "calendar", label: t("Calendar", "التقويم") },
    { id: "dates", label: t("Unavailable", "غير متاح") },
    { id: "users", label: t("Blocked", "المحظورون") },
  ];

  const FILTERS: { id: StatusFilter; label: string }[] = [
    { id: "all", label: t("All Bookings", "جميع الحجوزات") },
    { id: "pending", label: t("Pending", "قيد الانتظار") },
    { id: "confirmed", label: t("Confirmed", "مؤكد") },
    { id: "cancelled", label: t("Cancelled", "ملغى") },
    { id: "noshow", label: t("No-Shows", "الغائبون") },
  ];

  /* ---------------------------- Guards --------------------------------- */

  // Only wait for auth. Booking data never blocks the page.
  if (authLoading || !isAuthorizedHost) return null;

  /* ---------------------------- Render --------------------------------- */

  return (
    <div
      className={`min-h-screen bg-gray-50 text-gray-900 ${isAr ? "font-arabic" : "font-sans"}`}
      dir={isAr ? "rtl" : "ltr"}
    >
      {/* Desktop navbar */}
      <div className="hidden md:block">
        <Navbar
          NAV_LINKS={NAV_LINKS}
          lang={lang}
          toggleLanguage={toggleLanguage}
        />
      </div>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-30 flex items-center justify-between bg-[#1a1a2e] px-4 pb-3 pt-[calc(env(safe-area-inset-top)+12px)] md:hidden">
        <div>
          <p className="text-[10px] uppercase tracking-widest text-[#e8c547]/60">
            {t("Host Panel", "لوحة المضيف")}
          </p>
          <h1 className="text-lg font-semibold text-white">
            {t("Bookings Management", "إدارة الحجوزات")}
          </h1>
        </div>
        <button
          onClick={toggleLanguage}
          className="rounded-full border border-white/20 px-3 py-1.5 text-xs font-medium text-white active:bg-white/10"
        >
          {isAr ? "EN" : "عربي"}
        </button>
      </header>

      {/* Toast */}
      {toast && (
        <div className="pointer-events-none fixed inset-x-0 top-[calc(env(safe-area-inset-top)+72px)] z-50 flex justify-center px-4">
          <div
            className={`rounded-full px-4 py-2.5 text-sm font-medium shadow-lg ${
              toast.ok ? "bg-[#1a1a2e] text-white" : "bg-red-600 text-white"
            }`}
          >
            {toast.msg}
          </div>
        </div>
      )}

      <main className="mx-auto max-w-4xl px-4 pb-28 pt-5 md:px-6 md:pb-12 md:pt-8">
        {/* Desktop header */}
        <div className="mb-5 hidden md:block">
          <p className="text-[11px] uppercase tracking-widest text-gray-400">
            {t("Host Panel", "لوحة المضيف")}
          </p>
          <h1 className="text-2xl font-bold">
            {t("Bookings", "الحجوزات")}{" "}
            <span className="text-[#b8962e]">{t("Management", "إدارة")}</span>
          </h1>
        </div>

        {/* View tabs */}
        <div className="-mx-4 mb-4 overflow-x-auto px-4 md:mx-0 md:px-0">
          <div className="inline-flex min-w-full gap-1 rounded-2xl bg-gray-200/70 p-1 md:min-w-0">
            {VIEWS.map((v) => (
              <button
                key={v.id}
                onClick={() => setView(v.id)}
                className={`flex-1 whitespace-nowrap rounded-xl px-4 py-2 text-sm font-semibold transition ${
                  view === v.id
                    ? "bg-white text-[#1a1a2e] shadow-sm"
                    : "text-gray-500"
                }`}
              >
                {v.id === "calendar"
                  ? "📅 "
                  : v.id === "dates"
                    ? "🚫 "
                    : v.id === "users"
                      ? "🔒 "
                      : ""}
                {v.label}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div className="mb-4 rounded-2xl bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* ============================ BOOKINGS ============================ */}
        {view === "bookings" && (
          <>
            {/* Filter chips double as the Total / Confirmed / Pending / Cancelled counters */}
            <div className="-mx-4 mb-4 overflow-x-auto px-4 md:mx-0 md:px-0">
              <div className="flex gap-2">
                {FILTERS.map((f) => (
                  <button
                    key={f.id}
                    onClick={() => setFilter(f.id)}
                    className={`flex items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 py-2 text-sm font-medium transition ${
                      filter === f.id
                        ? "bg-[#1a1a2e] text-white"
                        : "bg-white text-gray-600 shadow-sm"
                    }`}
                  >
                    {f.id === "noshow" ? "⚠️ " : ""}
                    {f.label}
                    {loading ? (
                      <span className="h-4 w-5 animate-pulse rounded-full bg-gray-200/80" />
                    ) : (
                      <span
                        className={`rounded-full px-1.5 text-xs ${
                          filter === f.id
                            ? "bg-white/20 text-[#e8c547]"
                            : "bg-gray-100 text-gray-500"
                        }`}
                      >
                        {counts[f.id]}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              {loading &&
                [1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="space-y-3 rounded-2xl bg-white p-4 shadow-sm"
                  >
                    <div className="flex justify-between gap-4">
                      <Skeleton className="h-5 w-1/2" />
                      <Skeleton className="h-5 w-20" />
                    </div>
                    <Skeleton className="h-4 w-2/3" />
                    <div className="grid grid-cols-2 gap-3">
                      <Skeleton className="h-9" />
                      <Skeleton className="h-9" />
                      <Skeleton className="h-9" />
                      <Skeleton className="h-9" />
                    </div>
                    <div className="flex gap-2 pt-1">
                      <Skeleton className="h-11 flex-1 rounded-xl" />
                      <Skeleton className="h-11 flex-1 rounded-xl" />
                    </div>
                  </div>
                ))}

              {!loading && filtered.length === 0 && (
                <EmptyState
                  icon="📅"
                  title={t("No bookings found", "لا توجد حجوزات")}
                />
              )}

              {!loading &&
                filtered.map((booking) => (
                  <BookingCard
                    key={booking.id}
                    booking={booking}
                    t={t}
                    nights={calcNights(booking.check_in, booking.check_out)}
                    actionLoading={actionLoading}
                    statusLabel={statusLabel}
                    formatDate={formatDate}
                    formatCurrency={formatCurrency}
                    isBlocked={blockedUsers.some(
                      (b) => b.user_id === booking.user_id,
                    )}
                    onConfirm={onConfirm}
                    onCancel={onCancel}
                    onCheckIn={onCheckIn}
                    onCheckOut={onCheckOut}
                    onNoShow={onNoShow}
                    onBlockUser={onBlockUser}
                  />
                ))}
            </div>
          </>
        )}

        {/* ============================ CALENDAR ============================ */}
        {view === "calendar" &&
          (loading ? (
            <Skeleton className="h-96 w-full rounded-2xl" />
          ) : (
            <div className="rounded-2xl bg-white p-3 shadow-sm sm:p-6">
              <HostCalendar
                bookings={bookings}
                onConfirmBooking={onConfirm}
                onCancelBooking={onCancel}
                language={lang}
                hostListings={hostListings}
                blockedDates={blockedDates}
              />
            </div>
          ))}

        {/* ======================== UNAVAILABLE DATES ======================== */}
        {view === "dates" && (
          <div className="space-y-4">
            {/* Add blocked dates */}
            <section className="rounded-2xl bg-white p-4 shadow-sm">
              <h2 className="text-base font-bold">
                {t("Block dates", "حجب تواريخ")}
              </h2>

              <div className="mt-3 space-y-3">
                <select
                  value={selectedListingId}
                  onChange={(e) => setSelectedListingId(e.target.value)}
                  className={inputCls}
                >
                  <option value="">
                    {t("Select a listing", "اختر إعلاناً")}
                  </option>
                  {hostListings.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.title}
                    </option>
                  ))}
                </select>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-500">
                      {t("Start", "البداية")}
                    </label>
                    <input
                      type="date"
                      value={newStartDate}
                      onChange={(e) => setNewStartDate(e.target.value)}
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-500">
                      {t("End", "النهاية")}
                    </label>
                    <input
                      type="date"
                      value={newEndDate}
                      onChange={(e) => setNewEndDate(e.target.value)}
                      className={inputCls}
                    />
                  </div>
                </div>

                <input
                  type="text"
                  value={newReason}
                  onChange={(e) => setNewReason(e.target.value)}
                  placeholder={t("Reason (optional)", "السبب (اختياري)")}
                  className={inputCls}
                />

                {blockedDateError && (
                  <div className="rounded-xl bg-red-50 px-3.5 py-3 text-sm font-medium text-red-700">
                    {blockedDateError}
                  </div>
                )}

                <button
                  type="button"
                  onClick={handleAddBlockedDate}
                  disabled={blockedDateLoading}
                  className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-[#1a1a2e] text-sm font-semibold text-[#e8c547] active:scale-[0.98] disabled:opacity-60"
                >
                  {blockedDateLoading ? (
                    <Spinner light />
                  ) : (
                    `🚫 ${t("Block these dates", "حجب هذه التواريخ")}`
                  )}
                </button>
              </div>
            </section>

            {loading ? (
              <Skeleton className="h-40 w-full rounded-2xl" />
            ) : (
              <BlockedDatesPanel
                hostListings={hostListings}
                blockedDates={blockedDates}
                t={t}
                isAr={isAr}
                formatDate={formatDate}
                deletingId={deletingDateId}
                onDelete={handleDeleteBlockedDate}
              />
            )}
          </div>
        )}

        {/* =========================== BLOCKED USERS =========================== */}
        {view === "users" && (
          <BlockedUsersPanel
            blockedUsers={blockedUsers}
            unblockLoading={unblockLoading}
            t={t}
            onUnblock={onUnblock}
          />
        )}
      </main>

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
                  <span
                    className={`text-xl ${active ? "" : "opacity-60 grayscale"}`}
                  >
                    {item.icon}
                  </span>
                  {isAr ? item.labelAr : item.label}
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

/* ==========================================================================
   BOOKING CARD  (every detail is shown; nothing is shown twice)
========================================================================== */

interface BookingCardProps {
  booking: Booking;
  t: TFn;
  nights: number;
  actionLoading: { id: string; action: string } | null;
  statusLabel: (s: BookingStatus) => string;
  formatDate: (s: string) => string;
  formatCurrency: (n: number) => string;
  isBlocked: boolean;
  onConfirm: (id: string) => void;
  onCancel: (id: string) => void;
  onCheckIn: (id: string) => void;
  onCheckOut: (id: string) => void;
  onNoShow: (id: string) => void;
  onBlockUser: (booking: Booking) => void;
}

const BookingCard: React.FC<BookingCardProps> = ({
  booking,
  t,
  nights,
  actionLoading,
  statusLabel,
  formatDate,
  formatCurrency,
  isBlocked,
  onConfirm,
  onCancel,
  onCheckIn,
  onCheckOut,
  onNoShow,
  onBlockUser,
}) => {
  const busy = actionLoading?.id === booking.id;
  const spinning = (action: string) => busy && actionLoading?.action === action;

  // Flow off timestamps too, so the card never loses its actions just because the status string changed:
  //   confirmed -> checked_in -> checked_out
  const isCheckedIn =
    !!booking.checked_in_at ||
    booking.status === "checked_in" ||
    booking.status === "checked_out";
  const isCheckedOut =
    !!booking.checked_out_at || booking.status === "checked_out";
  const isNoShow = !!booking.no_show || booking.status === "no_show";

  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
    now.getDate(),
  ).padStart(2, "0")}`;
  const checkInStr = (booking.check_in ?? "").slice(0, 10);
  const checkInDateReached = !!checkInStr && todayStr >= checkInStr;

  const untouched = !isCheckedIn && !isCheckedOut && !isNoShow;
  const canCheckIn =
    booking.status === "confirmed" && untouched && checkInDateReached;
  const canCheckOut = isCheckedIn && !isCheckedOut && !isNoShow;
  const canMarkNoShow =
    untouched && booking.status === "confirmed" && checkInDateReached;
  const canCancel =
    untouched && ["pending", "confirmed"].includes(booking.status);

  // Extra badges only when they add something the main status badge does not already say
  const showCheckedInBadge =
    isCheckedIn && !isCheckedOut && booking.status !== "checked_in";
  const showCheckedOutBadge = isCheckedOut && booking.status !== "checked_out";
  const showNoShowBadge = isNoShow && booking.status !== "no_show";

  const guests = booking.guests ?? 1;
  const hasActions =
    booking.status === "pending" ||
    booking.status === "confirmed" ||
    canCheckOut ||
    (booking.status === "cancelled" && !isNoShow);

  return (
    <div className="overflow-hidden rounded-2xl bg-white shadow-sm">
      <div className="p-4">
        {/* Title + price */}
        <div className="flex items-start justify-between gap-3">
          <h3 className="min-w-0 truncate text-[15px] font-semibold">
            {booking.listing?.title || t("Listing", "الإعلان")}
          </h3>
          <div className="shrink-0 text-end">
            <p className="text-[15px] font-bold">
              {formatCurrency(booking.total_price)}
            </p>
            <p className="text-[10px] uppercase tracking-wide text-gray-400">
              {t("Total Price", "السعر الإجمالي")}
            </p>
          </div>
        </div>

        {/* Status (one place only) */}
        <div className="mt-2 flex flex-wrap gap-1.5">
          <Badge
            cls={STATUS_CLASSES[booking.status] ?? "bg-gray-100 text-gray-600"}
          >
            {statusLabel(booking.status)}
          </Badge>
          {showCheckedInBadge && (
            <Badge cls={STATUS_CLASSES.checked_in}>
              ✅ {t("Checked In", "وصل")}
            </Badge>
          )}
          {showCheckedOutBadge && (
            <Badge cls={STATUS_CLASSES.checked_out}>
              👋 {t("Checked Out", "غادر")}
            </Badge>
          )}
          {showNoShowBadge && (
            <Badge cls={STATUS_CLASSES.no_show}>
              ⚠️ {t("No-Show", "غائب")}
            </Badge>
          )}
        </div>

        {/* Stay details */}
        <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 rounded-xl bg-gray-50 p-3">
          <Info label={t("Check In", "تسجيل الوصول")}>
            {formatDate(booking.check_in)}
          </Info>
          <Info label={t("Check Out", "تسجيل المغادرة")}>
            {formatDate(booking.check_out)}
          </Info>
          <Info label={t("Nights", "ليالي")}>
            {nights} {nights !== 1 ? t("nights", "ليالي") : t("night", "ليلة")}
          </Info>
          <Info label={t("Guests", "ضيوف")}>
            {guests} {guests !== 1 ? t("guests", "ضيوف") : t("guest", "ضيف")}
          </Info>
        </div>

        {/* Guest details */}
        <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3">
          <Info label={t("Guest", "الضيف")}>
            {booking.user?.name || t("Guest Name", "اسم الضيف")}
          </Info>
          <Info label={t("Phone", "الهاتف")}>
            {booking.user?.phone_number ? (
              <a
                href={`tel:${booking.user.phone_number}`}
                dir="ltr"
                className="text-[#1a1a2e] underline"
              >
                {booking.user.phone_number}
              </a>
            ) : (
              "—"
            )}
          </Info>
          <Info label={t("Email", "البريد الإلكتروني")} wide>
            {booking.user?.email ? (
              <a
                href={`mailto:${booking.user.email}`}
                className="text-[#1a1a2e] underline"
              >
                {booking.user.email}
              </a>
            ) : (
              "—"
            )}
          </Info>
          <Info label={t("Location", "الموقع")} wide>
            {booking.listing?.location || "—"}
          </Info>
        </div>

        {/* Timestamps */}
        {(booking.checked_in_at || booking.checked_out_at) && (
          <div className="mt-3 grid grid-cols-1 gap-3 border-t border-gray-100 pt-3 sm:grid-cols-2">
            {booking.checked_in_at && (
              <Info label={t("Arrived at", "وقت الوصول")}>
                {new Date(booking.checked_in_at).toLocaleString()}
              </Info>
            )}
            {booking.checked_out_at && (
              <Info label={t("Left at", "وقت المغادرة")}>
                {new Date(booking.checked_out_at).toLocaleString()}
              </Info>
            )}
          </div>
        )}

        <p className="mt-3 text-xs text-gray-400">
          {t("Booked on", "تم الحجز في")} {formatDate(booking.created_at)}
        </p>
      </div>

      {/* Actions */}
      <div className="space-y-2 border-t border-gray-100 bg-gray-50/60 p-3">
        {hasActions && (
          <div className="flex flex-wrap gap-2">
            {booking.status === "pending" && (
              <>
                <ActionBtn
                  tone="primary"
                  onClick={() => onConfirm(booking.id)}
                  disabled={busy}
                  spinning={spinning("confirm")}
                >
                  ✓ {t("Confirm", "تأكيد")}
                </ActionBtn>
                <ActionBtn
                  tone="danger"
                  onClick={() => onCancel(booking.id)}
                  disabled={busy}
                  spinning={spinning("cancel")}
                >
                  ✗ {t("Cancel", "إلغاء")}
                </ActionBtn>
              </>
            )}

            {booking.status === "confirmed" && (
              <>
                <ActionBtn
                  tone={canCheckIn ? "green" : "muted"}
                  onClick={() => onCheckIn(booking.id)}
                  disabled={busy || !canCheckIn}
                  spinning={spinning("check_in")}
                >
                  {!checkInDateReached
                    ? t("✅ Check In (not yet)", "✅ الوصول (لم يحن بعد)")
                    : isCheckedIn
                      ? t("✅ Checked In", "✅ تم الوصول")
                      : t("✅ Check In", "✅ تسجيل وصول")}
                </ActionBtn>

                {!isCheckedIn && canMarkNoShow && (
                  <ActionBtn
                    tone="warn"
                    onClick={() => onNoShow(booking.id)}
                    disabled={busy}
                    spinning={spinning("no_show")}
                  >
                    ⚠️ {t("No-Show", "غائب")}
                  </ActionBtn>
                )}

                <ActionBtn
                  tone={canCancel ? "danger" : "muted"}
                  onClick={() => onCancel(booking.id)}
                  disabled={busy || !canCancel}
                  spinning={spinning("cancel")}
                >
                  {t("Cancel", "إلغاء")}
                </ActionBtn>
              </>
            )}

            {canCheckOut && (
              <>
                <ActionBtn
                  tone="violet"
                  onClick={() => onCheckOut(booking.id)}
                  disabled={busy}
                  spinning={spinning("check_out")}
                >
                  👋 {t("Check Out", "تسجيل مغادرة")}
                </ActionBtn>

                <ActionBtn
                  tone="danger"
                  onClick={() => onBlockUser(booking)}
                  disabled={busy || isBlocked}
                  spinning={spinning("block_user")}
                >
                  🚫{" "}
                  {isBlocked
                    ? t("Already blocked", "محظور")
                    : t("Block User", "حظر المستخدم")}
                </ActionBtn>
              </>
            )}

            {booking.status === "cancelled" && !isNoShow && (
              <ActionBtn
                tone="danger"
                onClick={() => onBlockUser(booking)}
                disabled={busy || isBlocked}
                spinning={spinning("block_user")}
              >
                🚫{" "}
                {isBlocked
                  ? t("Already blocked", "محظور")
                  : t("Block User", "حظر المستخدم")}
              </ActionBtn>
            )}
          </div>
        )}

        <Link
          to={`/listings/${booking.listing_id}`}
          className="flex min-h-[44px] w-full items-center justify-center rounded-xl bg-white text-sm font-semibold text-gray-700 ring-1 ring-gray-200 active:scale-[0.98]"
        >
          {t("View Listing", "عرض الإعلان")} →
        </Link>
      </div>
    </div>
  );
};

/* ==========================================================================
   UNAVAILABLE DATES PANEL
========================================================================== */

interface BlockedDatesPanelProps {
  hostListings: HostListing[];
  blockedDates: Record<string, BlockedDateRange[]>;
  t: TFn;
  isAr: boolean;
  formatDate: (s: string) => string;
  deletingId: string | null;
  onDelete: (listingId: string, blockedDateId: string) => void;
}

const BlockedDatesPanel: React.FC<BlockedDatesPanelProps> = ({
  hostListings,
  blockedDates,
  t,
  isAr,
  formatDate,
  deletingId,
  onDelete,
}) => {
  const ids = new Set<string>([
    ...hostListings.map((l) => l.id),
    ...Object.keys(blockedDates),
  ]);

  const all = Array.from(ids).map((id) => {
    const l = hostListings.find((x) => x.id === id);
    return {
      id,
      title: l?.title ?? t("Listing", "الإعلان"),
      image: l?.images?.[0],
      ranges: (blockedDates[id] ?? []).filter(
        (r) => r?.startDate && r?.endDate,
      ),
    };
  });

  const withDates = all.filter((l) => l.ranges.length > 0);
  const withoutDates = all.filter((l) => l.ranges.length === 0);

  if (all.length === 0) {
    return (
      <EmptyState
        icon="🚫"
        title={t("No unavailable dates", "لا توجد تواريخ غير متاحة")}
      />
    );
  }

  const dayCount = (ranges: BlockedDateRange[]) =>
    ranges.reduce((total, r) => {
      const diff =
        new Date(`${r.endDate}T00:00:00Z`).getTime() -
        new Date(`${r.startDate}T00:00:00Z`).getTime();
      return diff > 0 ? total + Math.ceil(diff / 86400000) : total;
    }, 0);

  return (
    <div className="space-y-4">
      {withDates.length > 0 && (
        <p className="px-1 text-xs text-gray-500">
          ℹ️{" "}
          {t(
            "The end date of each range is available to book.",
            "تاريخ نهاية كل فترة متاح للحجز.",
          )}
        </p>
      )}

      {withDates.map((listing) => {
        const days = dayCount(listing.ranges);

        return (
          <section
            key={listing.id}
            className="rounded-2xl bg-white p-4 shadow-sm"
          >
            <div className="mb-3 flex items-center gap-3">
              {listing.image && (
                <img
                  src={listing.image}
                  alt=""
                  className="h-10 w-10 shrink-0 rounded-lg object-cover"
                />
              )}

              <div className="min-w-0">
                <h3 className="truncate text-sm font-semibold">
                  {listing.title}
                </h3>
                <p className="text-xs text-gray-500">
                  {days}{" "}
                  {days === 1
                    ? t("unavailable day", "يوم غير متاح")
                    : t("unavailable days", "أيام غير متاحة")}
                </p>
              </div>
            </div>

            <div className="space-y-2">
              {listing.ranges.map((range, i) => (
                <div
                  key={range.id || `${range.startDate}-${range.endDate}-${i}`}
                  className="flex items-center justify-between gap-3 rounded-xl bg-red-50 px-3 py-2.5"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-red-100">
                      🚫
                    </span>

                    <div className="min-w-0">
                      <p className="text-sm font-medium text-red-800">
                        {formatDate(range.startDate)}{" "}
                        <span className="text-red-300">{isAr ? "←" : "→"}</span>{" "}
                        {formatDate(range.endDate)}
                      </p>
                      {range.reason && (
                        <span className="mt-1 inline-block rounded-full bg-white/80 px-2.5 py-0.5 text-xs text-gray-600">
                          {range.reason}
                        </span>
                      )}
                    </div>
                  </div>

                  <button
                    type="button"
                    disabled={!range.id || deletingId === range.id}
                    onClick={() => range.id && onDelete(listing.id, range.id)}
                    aria-label={t("Delete", "حذف")}
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-red-700 active:scale-95 disabled:opacity-50"
                  >
                    {deletingId === range.id ? <Spinner /> : "🗑️"}
                  </button>
                </div>
              ))}
            </div>
          </section>
        );
      })}

      {/* Listings with nothing blocked: one line instead of repeating the same message per listing */}
      {withoutDates.length > 0 && (
        <section className="rounded-2xl bg-white p-4 shadow-sm">
          <p className="text-sm font-semibold text-gray-700">
            {t("No unavailable dates", "لا توجد تواريخ غير متاحة")}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {withoutDates.map((l) => (
              <span
                key={l.id}
                className="rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-600"
              >
                {l.title}
              </span>
            ))}
          </div>
        </section>
      )}
    </div>
  );
};

/* ==========================================================================
   BLOCKED USERS PANEL
========================================================================== */

interface BlockedUsersPanelProps {
  blockedUsers: BlockedUser[];
  unblockLoading: string | null;
  t: TFn;
  onUnblock: (userId: string) => void;
}

const BlockedUsersPanel: React.FC<BlockedUsersPanelProps> = ({
  blockedUsers,
  unblockLoading,
  t,
  onUnblock,
}) => {
  if (blockedUsers.length === 0) {
    return (
      <EmptyState
        icon="🔓"
        title={t("No blocked users", "لا يوجد مستخدمون محظورون")}
      />
    );
  }

  const reasonLabel = (reason: string) =>
    reason === "no_show"
      ? t("⚠️ No-Show", "⚠️ غياب")
      : reason === "cancellation"
        ? t("❌ Cancellation", "❌ إلغاء")
        : t("🚫 Manual", "🚫 يدوي");

  return (
    <div className="space-y-3">
      {blockedUsers.map((entry) => (
        <div
          key={entry.id}
          className="flex items-center gap-3 rounded-2xl bg-white p-4 shadow-sm"
        >
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-red-50 text-sm font-semibold text-red-700">
            {entry.user_name
              ?.split(" ")
              .map((n) => n[0])
              .join("")
              .slice(0, 2)
              .toUpperCase() ?? "?"}
          </div>

          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold">{entry.user_name}</p>
            <p className="truncate text-xs text-gray-500">{entry.user_email}</p>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <Badge cls="bg-amber-50 text-amber-700">
                {reasonLabel(entry.reason)}
              </Badge>
              <span className="text-xs text-gray-400">
                {t("Since", "منذ")}{" "}
                {new Date(entry.created_at).toLocaleDateString("en-US", {
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                })}
              </span>
            </div>
          </div>

          <button
            onClick={() => onUnblock(entry.user_id)}
            disabled={unblockLoading === entry.user_id}
            className="flex min-h-[40px] shrink-0 items-center gap-2 rounded-xl bg-emerald-50 px-3.5 text-sm font-semibold text-emerald-700 active:scale-95 disabled:opacity-50"
          >
            {unblockLoading === entry.user_id ? (
              <Spinner />
            ) : (
              `🔓 ${t("Unblock", "إلغاء الحظر")}`
            )}
          </button>
        </div>
      ))}
    </div>
  );
};

export default HostBookings;
