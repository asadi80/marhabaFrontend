import React, { useEffect, useState, useCallback, useMemo } from "react";
import { useNavigate, Link } from "react-router-dom";

import { useAuth } from "../../context/AuthContext";
import { useLanguage } from "../../hooks/useLanguage";
import LoadingScreen from "../../components/LoadingScreen";
import Navbar from "../../components/Navbar";
import { apiService } from "../../services/api";
import HostCalendar from "../../components/HostCalendar";

// ============================================================
// TOKEN GUARD (extra client-side check)
// ============================================================
// NOTE: this is a UX nicety, not real security — anyone can edit their own
// localStorage. It only lets us redirect to /login early (before firing off
// API calls) when the stored token is missing/expired. The actual security
// boundary is the server rejecting unauthorized/expired tokens on every
// request; this never replaces that.

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

// Decodes a JWT's payload (no signature verification — that's the server's job)
// just to read the `exp` claim.
const isJwtExpired = (token: string): boolean => {
  try {
    const payloadB64 = token.split(".")[1];
    const payload = JSON.parse(atob(payloadB64.replace(/-/g, "+").replace(/_/g, "/")));
    if (!payload?.exp) return false; // no exp claim — nothing to check locally
    return Date.now() >= payload.exp * 1000;
  } catch {
    return true; // malformed/unreadable token — treat as invalid
  }
};

const hasValidStoredToken = (): boolean => {
  const token = readStoredAccessToken();
  return !!token && !isJwtExpired(token);
};

const toRole = (role?: string) => String(role || "").toLowerCase();

// ============================================================
// TYPES
// ============================================================

type BookingStatus =
  | "pending"
  | "confirmed"
  | "checked_in"
  | "checked_out"
  | "cancelled"
  | "no_show";

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

  user?: {
    id: string;
    name: string;
    email: string;
    phone_number: string;
  };
}

interface BlockedDateRange {
  id?: string;
  startDate: string;
  endDate: string;
  reason?: string;
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

interface NavLink {
  id: string;
  label: string;
  href: string;
}

const STATUS_BADGE_CLASSES: Record<string, string> = {
  confirmed: "bg-[#DCFCE7] text-[#166534]",
  pending: "bg-[#FEF9C3] text-[#713f12]",
  cancelled: "bg-[#FEE2E2] text-[#991b1b]",
  checked_in: "bg-[#D1FAE5] text-[#065F46]",
  checked_out: "bg-[#EDE9FE] text-[#4C1D95]",
  no_show: "bg-[#FEF3C7] text-[#92400E]",
};

// ============================================================
// COMPONENT
// ============================================================

const HostBookings: React.FC = () => {
  const navigate = useNavigate();

  const { lang, toggleLanguage } = useLanguage();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();

  const isAr = lang === "ar";
  const isAuthorizedHost = isAuthenticated && !!user && toRole(user.role) === HOST_ROLE;

  // ============================================================
  // STATE
  // ============================================================

  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("all");

  const [actionLoading, setActionLoading] = useState<{ id: string; action: string } | null>(null);

  const [hostListings, setHostListings] = useState<HostListing[]>([]);
  const [blockedDates, setBlockedDates] = useState<Record<string, BlockedDateRange[]>>({});
  const [blockedUsers, setBlockedUsers] = useState<BlockedUser[]>([]);
  const [unblockLoading, setUnblockLoading] = useState<string | null>(null);

  // Add-blocked-date form state
  const [selectedListingId, setSelectedListingId] = useState<string>("");
  const [newStartDate, setNewStartDate] = useState("");
  const [newEndDate, setNewEndDate] = useState("");
  const [newReason, setNewReason] = useState("");
  const [blockedDateLoading, setBlockedDateLoading] = useState(false);
  const [blockedDateError, setBlockedDateError] = useState("");

  // ============================================================
  // TRANSLATIONS
  // ============================================================

  const t = {
    overview: isAr ? "نظرة عامة" : "Overview",
    myListings: isAr ? "إعلاناتي" : "My Listings",
    bookings: isAr ? "الحجوزات" : "Bookings",
    hostPanel: isAr ? "لوحة المضيف" : "Host Panel",

    bookingsTitle: isAr ? "الحجوزات" : "Bookings",
    management: isAr ? "إدارة" : "Management",

    total: isAr ? "الإجمالي" : "Total",
    confirmed: isAr ? "مؤكد" : "Confirmed",
    pending: isAr ? "قيد الانتظار" : "Pending",
    cancelled: isAr ? "ملغى" : "Cancelled",

    checkedIn: isAr ? "تم الوصول" : "Checked In",
    checkedOut: isAr ? "تمت المغادرة" : "Checked Out",

    allBookings: isAr ? "جميع الحجوزات" : "All Bookings",
    calendarView: isAr ? "عرض التقويم" : "Calendar View",

    confirm: isAr ? "تأكيد" : "Confirm",
    cancel: isAr ? "إلغاء" : "Cancel",

    guest: isAr ? "الضيف" : "Guest",
    guestName: isAr ? "اسم الضيف" : "Guest Name",
    email: isAr ? "البريد الإلكتروني" : "Email",
    phone: isAr ? "الهاتف" : "Phone",
    location: isAr ? "الموقع" : "Location",

    checkIn: isAr ? "تسجيل الوصول" : "Check In",
    checkOut: isAr ? "تسجيل المغادرة" : "Check Out",

    nights: isAr ? "ليالي" : "Nights",
    night: isAr ? "ليلة" : "Night",
    guests: isAr ? "ضيوف" : "Guests",

    totalPrice: isAr ? "السعر الإجمالي" : "Total Price",

    noBlockedDates: isAr ? "لا توجد تواريخ غير متاحة" : "No unavailable dates",

    viewListing: isAr ? "عرض الإعلان" : "View Listing",
    listing: isAr ? "الإعلان" : "Listing",

    noBookingsFound: isAr ? "لا توجد حجوزات" : "No bookings found",

    confirmBooking: isAr ? "تأكيد هذا الحجز؟" : "Confirm this booking?",
    bookingConfirmedSuccess: isAr ? "تم تأكيد الحجز" : "Booking confirmed.",

    confirmCancelBooking: isAr ? "إلغاء هذا الحجز؟" : "Cancel this booking?",
    bookingCancelledSuccess: isAr ? "تم إلغاء الحجز" : "Booking cancelled.",

    deleteBlockedDate: isAr ? "حذف" : "Delete",
    deleting: isAr ? "جارٍ الحذف..." : "Deleting...",
    confirmDeleteBlockedDate: isAr
      ? "هل تريد حذف هذا التاريخ غير المتاح؟"
      : "Delete this unavailable date?",
    blockedDateAdded: isAr ? "تمت إضافة التاريخ غير المتاح" : "Unavailable date added",
    blockedDateDeleted: isAr ? "تم حذف التاريخ غير المتاح" : "Unavailable date deleted",
    invalidDateRange: isAr
      ? "تاريخ النهاية يجب أن يكون بعد تاريخ البداية"
      : "End date must be after start date",
    selectListingRequired: isAr ? "الرجاء اختيار إعلان" : "Please select a listing",
    datesRequired: isAr ? "الرجاء اختيار تاريخي البداية والنهاية" : "Please select both start and end dates",
  };

  // ============================================================
  // HELPERS
  // ============================================================

  const formatCurrency = (amount: number) =>
    isAr ? `${Math.round(amount).toLocaleString()} دينار` : `${Math.round(amount).toLocaleString()} LYD`;

  const formatDate = (s: string) =>
    new Date(s).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" });

  const calcNights = (ci: string, co: string) => {
    const a = new Date(ci);
    const b = new Date(co);

    return Math.ceil(
      (Date.UTC(b.getUTCFullYear(), b.getUTCMonth(), b.getUTCDate()) -
        Date.UTC(a.getUTCFullYear(), a.getUTCMonth(), a.getUTCDate())) /
        86400000
    );
  };

  const statusLabel = (status: BookingStatus) =>
    ({
      confirmed: t.confirmed,
      pending: t.pending,
      cancelled: t.cancelled,
      checked_in: t.checkedIn,
      checked_out: t.checkedOut,
      no_show: isAr ? "غائب" : "No-Show",
    })[status] ?? status;

  const statusBadgeCls = (status: string) => STATUS_BADGE_CLASSES[status] ?? "bg-[#F3F4F6] text-[#374151]";

  const isActionSpinning = (bookingId: string, action: string) =>
    actionLoading?.id === bookingId && actionLoading?.action === action;

  const anyActionLoading = (bookingId: string) => actionLoading?.id === bookingId;

  // ============================================================
  // AUTH + ROLE GUARD
  // ============================================================
  // Combines the AuthContext's server-derived auth state with a local check
  // of the stored JWT's expiry, so an expired/missing token bounces the user
  // to /login immediately instead of waiting on the first failed API call.
  // Only accounts with role "host" may stay on this page.

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

    // Re-check periodically in case the token expires while this page is open.
    const intervalId = window.setInterval(() => {
      if (!hasValidStoredToken()) {
        navigate("/login", { replace: true });
      }
    }, 60_000);

    return () => window.clearInterval(intervalId);
  }, [authLoading, isAuthenticated, user, navigate]);

  // ============================================================
  // FETCH BOOKINGS
  // ============================================================

  const fetchBookings = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await apiService.getProtectedData<Booking[] | { bookings: Booking[] }>(
        "/api/v1/bookings/host"
      );
      console.log("data", response);
      

      if (response.success && response.data) {
        const fetchedBookings: Booking[] = Array.isArray(response.data)
          ? response.data
          : Array.isArray(response.data.bookings)
            ? response.data.bookings
            : [];

        setBookings(fetchedBookings);

        // Derive blocked dates per listing from the bookings payload
        // (every booking carries its listing's full blocked_dates list).
        const blockedMap: Record<string, BlockedDateRange[]> = {};

        fetchedBookings.forEach((booking) => {
          const listing = booking.listing;
          if (!listing?.id) return;

          const dates = Array.isArray(listing.blocked_dates) ? listing.blocked_dates : [];
          const existing = blockedMap[listing.id] ?? [];

          dates.forEach((blockedDate) => {
            if (!existing.some((d) => d.id === blockedDate.id)) {
              existing.push(blockedDate);
            }
          });

          blockedMap[listing.id] = existing;
        });

        setBlockedDates(blockedMap);
      } else {
        setBookings([]);
        setBlockedDates({});
        setError(response.message || "No bookings found");
      }
    } catch (err: any) {
      setError(err?.message || "Failed to fetch bookings");
      setBookings([]);
      setBlockedDates({});
    } finally {
      setLoading(false);
    }
  }, []);

  
  

  // ============================================================
  // FETCH BLOCKED USERS
  // ============================================================

  const fetchBlockedUsers = useCallback(async () => {
    try {
      const response = await apiService.getProtectedData<{ blockedUsers: BlockedUser[] }>(
        "/api/v1/host/blocked-users"
      );

      if (response.success && response.data) {
        setBlockedUsers(response.data.blockedUsers || []);
      }
    } catch {
      // Non-critical — blocked-users tab will just show empty.
    }
  }, []);

  // ============================================================
  // LOAD DATA (host-only)
  // ============================================================

  useEffect(() => {
    if (!isAuthorizedHost) return;

    fetchBookings();

    fetchBlockedUsers();
  }, [isAuthorizedHost, fetchBookings, fetchBlockedUsers]);

  // ============================================================
  // BOOKING STATUS ACTION HANDLER
  // ============================================================

  const handleAction = async (bookingId: string, action: string, confirmMsg: string, successMsg: string) => {
    if (!confirm(confirmMsg)) return;

    const STATUS_BY_ACTION: Record<string, BookingStatus> = {
      confirm: "confirmed",
      cancel: "cancelled",
      check_in: "checked_in",
      check_out: "checked_out",
      no_show: "no_show",
    };

    const status = STATUS_BY_ACTION[action];
    if (!status) throw new Error(`Unsupported booking status action: ${action}`);

    setActionLoading({ id: bookingId, action });

    try {
      const response = await apiService.putProtectedData(`/api/v1/bookings/${bookingId}/status`, { status });

      if (!response?.success) {
        throw new Error(response?.message || "Failed to update booking");
      }

      alert(successMsg);

      // The booking stays in the list; only its status transitions
      // (confirmed -> checked_in -> checked_out), so a simple refetch
      // keeps everything in sync.
      await fetchBookings();
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to update booking");
    } finally {
      setActionLoading(null);
    }
  };

  const handleConfirmBooking = (id: string) =>
    handleAction(id, "confirm", t.confirmBooking, t.bookingConfirmedSuccess);

  const handleCancelBooking = (id: string) =>
    handleAction(id, "cancel", t.confirmCancelBooking, t.bookingCancelledSuccess);

  const handleCheckIn = (id: string) =>
    handleAction(
      id,
      "check_in",
      isAr ? "هل تريد تسجيل وصول الضيف؟" : "Mark guest as checked in?",
      isAr ? "تم تسجيل الوصول وإرسال البريد الإلكتروني." : "Check-in recorded and email sent."
    );

  const handleCheckOut = (id: string) =>
    handleAction(
      id,
      "check_out",
      isAr ? "هل تريد تسجيل مغادرة الضيف؟" : "Mark guest as checked out?",
      isAr ? "تم تسجيل المغادرة وإرسال البريد الإلكتروني." : "Check-out recorded and email sent."
    );

  const handleNoShow = (id: string) =>
    handleAction(
      id,
      "no_show",
      isAr ? "هل تريد تسجيل الضيف كغائب؟ سيتم إلغاء الحجز." : "Mark guest as no-show? This will cancel the booking.",
      isAr ? "تم تسجيل الغياب." : "No-show recorded."
    );

  // ============================================================
  // BLOCK / UNBLOCK USER
  // ============================================================

  const handleBlockUser = async (booking: Booking) => {
    const userId = booking.user?.id || booking.user_id;

    if (!userId) {
      alert(isAr ? "تعذر العثور على المستخدم لهذا الحجز." : "Could not find the user for this booking.");
      return;
    }

    if (!confirm(isAr ? "هل تريد حظر هذا المستخدم من حجز عقاراتك؟" : "Block this user from booking your listings?")) {
      return;
    }

    setActionLoading({ id: booking.id, action: "block_user" });

    try {
      const reason =
        booking.status === "no_show" ? "no_show" : booking.status === "cancelled" ? "cancellation" : "manual";

      const response = await apiService.postProtectedData<{ success: boolean; message?: string }>(
        "/api/v1/host/blocked-user",
        { userId, bookingId: booking.id, reason }
      );

      if (!response?.success) {
        throw new Error(response?.message || (isAr ? "فشل حظر المستخدم" : "Failed to block user"));
      }

      alert(isAr ? "تم حظر المستخدم بنجاح." : "User blocked successfully.");
      await fetchBlockedUsers();
    } catch (error) {
      alert(error instanceof Error ? error.message : isAr ? "فشل حظر المستخدم" : "Failed to block user");
    } finally {
      setActionLoading(null);
    }
  };

  const handleUnblock = async (userId: string) => {
    if (!confirm(isAr ? "هل تريد إلغاء حظر هذا المستخدم؟" : "Unblock this user?")) return;

    setUnblockLoading(userId);

    try {
      const response = await apiService.deleteProtectedData<{ success: boolean; message?: string }>(
        `/api/v1/host/blocked-users/${userId}`
      );

      if (!response?.success) {
        throw new Error(response?.message || (isAr ? "فشل إلغاء حظر المستخدم" : "Failed to unblock user"));
      }

      alert(isAr ? "تم إلغاء حظر المستخدم بنجاح." : "User unblocked successfully.");
      await fetchBlockedUsers();
    } catch (err: any) {
      alert(err?.message || (isAr ? "فشل إلغاء حظر المستخدم" : "Failed to unblock user"));
    } finally {
      setUnblockLoading(null);
    }
  };

  // ============================================================
  // BLOCKED DATES (add / delete)
  // ============================================================

  const handleAddBlockedDate = async () => {
    setBlockedDateError("");

    if (!selectedListingId) {
      setBlockedDateError(t.selectListingRequired);
      return;
    }

    if (!newStartDate || !newEndDate) {
      setBlockedDateError(t.datesRequired);
      return;
    }

    if (newEndDate <= newStartDate) {
      setBlockedDateError(t.invalidDateRange);
      return;
    }

    setBlockedDateLoading(true);

    try {
      const response = await apiService.postProtectedData<{ success: boolean; message?: string }>(
        `/api/v1/listings/${selectedListingId}/blocked-dates`,
        { startDate: newStartDate, endDate: newEndDate, reason: newReason || undefined }
      );

      if (!response?.success) {
        throw new Error(response?.message || "Failed to add blocked date");
      }

      alert(t.blockedDateAdded);

      await fetchBookings();

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

  const handleDeleteBlockedDate = async (listingId: string, blockedDateId: string) => {
    if (!confirm(t.confirmDeleteBlockedDate)) return;

    setBlockedDateLoading(true);

    try {
      const response = await apiService.deleteProtectedData<{ success: boolean; message?: string }>(
        `/api/v1/listings/${listingId}/blocked-dates/${blockedDateId}`
      );

      if (!response?.success) {
        throw new Error(response?.message || "Failed to delete blocked date");
      }

      alert(t.blockedDateDeleted);

      setBlockedDates((prev) => ({
        ...prev,
        [listingId]: (prev[listingId] || []).filter((bd) => bd.id !== blockedDateId),
      }));

    } catch (err: any) {
      alert(err?.message || "Failed to delete blocked date");
    } finally {
      setBlockedDateLoading(false);
    }
  };

  // ============================================================
  // FILTER
  // ============================================================

  const getFiltered = () => {
    if (["all", "calendar", "blocked", "blockedUsers"].includes(filter)) return bookings;

    if (filter === "noshow") {
      return bookings.filter((booking) => !!booking.no_show || booking.status === "no_show");
    }

    return bookings.filter((booking) => booking.status === filter);
  };

  // ============================================================
  // STAT CARDS / FILTER TABS / NAV LINKS
  // ============================================================

  const STAT_CARDS = useMemo(
    () => [
      { label: t.total, val: bookings.length, borderTop: "border-t-white/20" },
      { label: t.confirmed, val: bookings.filter((b) => b.status === "confirmed").length, borderTop: "border-t-[#1D9E75]" },
      { label: t.pending, val: bookings.filter((b) => b.status === "pending").length, borderTop: "border-t-[#e8c547]" },
      { label: t.cancelled, val: bookings.filter((b) => b.status === "cancelled").length, borderTop: "border-t-[#e05a5a]" },
    ],
    [bookings, t]
  );

  const FILTER_TABS = [
    { id: "all", label: t.allBookings },
    { id: "confirmed", label: t.confirmed },
    { id: "pending", label: t.pending },
    { id: "cancelled", label: t.cancelled },
    { id: "noshow", label: `⚠️ ${isAr ? "الغائبون" : "No-Shows"}` },
    { id: "calendar", label: `📅 ${t.calendarView}` },
    { id: "blocked", label: `🚫 ${isAr ? "تواريخ غير متاحة" : "Unavailable Dates"}` },
    { id: "blockedUsers", label: `🔒 ${isAr ? "المستخدمون المحظورون" : "Blocked Users"}` },
  ];

  const NAV_LINKS: NavLink[] = [
    { id: "overview", label: t.overview, href: "/host-dashboard" },
    { id: "listings", label: t.myListings, href: "/host/listings" },
    { id: "bookings", label: t.bookings, href: "/host/bookings" },
  ];

  const bodyFontClass = isAr
    ? "font-['Cairo','Tajawal','Almarai','IBM_Plex_Sans_Arabic',sans-serif]"
    : "font-['DM_Mono',monospace]";

  const displayFontClass = isAr ? "font-['Cairo','Tajawal',sans-serif]" : "font-['Fraunces',serif]";

  // ============================================================
  // GUARDS
  // ============================================================

  if (authLoading || loading) return <LoadingScreen />;
  if (!isAuthorizedHost) return null;

  // ============================================================
  // RENDER
  // ============================================================

  return (
    <div className={`min-h-screen bg-[#f7f6f2] ${bodyFontClass}`} dir={isAr ? "rtl" : "ltr"}>
      <Navbar NAV_LINKS={NAV_LINKS} lang={lang} toggleLanguage={toggleLanguage} />

      {/* PAGE HEADER */}
      <div className="bg-[#1a1a2e] border-b border-[rgba(232,197,71,0.12)] px-6 pt-10 pb-8">
        <div className="max-w-[1100px] mx-auto">
          <div className="text-[10px] tracking-[0.12em] uppercase text-[rgba(232,197,71,0.6)] mb-2">
            {t.hostPanel}
          </div>

          <h1
            className={`${displayFontClass} font-light text-[clamp(28px,4vw,38px)] text-white mb-7 ${
              isAr ? "" : "italic"
            }`}
          >
            {t.bookingsTitle} <span className="font-medium text-[#e8c547]">{t.management}</span>
          </h1>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {STAT_CARDS.map(({ label, val, borderTop }) => (
              <div
                key={label}
                className={`bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.07)] border-t-[3px] ${borderTop} rounded-[10px] px-4 py-3.5`}
              >
                <div className={`${displayFontClass} font-light text-[28px] text-white leading-none ${isAr ? "" : "italic"}`}>
                  {val}
                </div>
                <div className="text-[10px] tracking-[0.08em] uppercase text-[rgba(255,255,255,0.35)] mt-1">
                  {label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <main className="max-w-[1100px] mx-auto px-4 sm:px-6 py-8">
        {/* FILTER TABS */}
        <div className="overflow-x-auto border-b border-black/[0.08] mb-6">
          <div className="flex min-w-max">
            {FILTER_TABS.map(({ id, label }) => (
              <button
                key={id}
                onClick={() => setFilter(id)}
                className={`px-4 py-2 border-none bg-transparent text-xs font-[inherit] cursor-pointer border-b-2 -mb-px transition-all whitespace-nowrap inline-flex items-center gap-1.5 ${
                  filter === id ? "text-[#1a1a2e] border-b-[#e8c547]" : "text-[#888] border-b-transparent hover:text-[#111118]"
                }`}
              >
                {label}

                {!["all", "calendar", "blocked", "blockedUsers"].includes(id) && (
                  <span
                    className={`text-[10px] px-[7px] py-px rounded-[20px] ${
                      filter === id ? "bg-[#1a1a2e] text-[#e8c547]" : "bg-black/[0.06] text-[#888]"
                    }`}
                  >
                    {id === "noshow"
                      ? bookings.filter((b) => !!b.no_show || b.status === "no_show").length
                      : bookings.filter((b) => b.status === id).length}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div className="bg-[#FEF2F2] border border-[#FCA5A5] text-[#991B1B] px-4 py-3 rounded-[10px] mb-4 text-[13px]">
            {error}
          </div>
        )}

        {/* CALENDAR VIEW */}
        {filter === "calendar" ? (
          <div className="bg-white rounded-2xl border border-black/[0.07] p-4 sm:p-6">
            <HostCalendar
              bookings={bookings}
              onConfirmBooking={handleConfirmBooking}
              onCancelBooking={handleCancelBooking}
              language={lang}
              hostListings={hostListings}
              blockedDates={blockedDates}
            />
          </div>
        ) : filter === "blocked" ? (
          <BlockedDatesPanel
            hostListings={hostListings}
            blockedDates={blockedDates}
            isAr={isAr}
            t={t}
            formatDate={formatDate}
            blockedDateLoading={blockedDateLoading}
            onDelete={handleDeleteBlockedDate}
          />
        ) : filter === "blockedUsers" ? (
          <BlockedUsersPanel
            blockedUsers={blockedUsers}
            unblockLoading={unblockLoading}
            isAr={isAr}
            onUnblock={handleUnblock}
          />
        ) : getFiltered().length === 0 ? (
          <EmptyState icon="📅" msg={t.noBookingsFound} />
        ) : (
          <div className="flex flex-col gap-3">
            {getFiltered().map((booking) => (
              <BookingCard
                key={booking.id}
                booking={booking}
                isAr={isAr}
                t={t}
                nights={calcNights(booking.check_in, booking.check_out)}
                isLoading={anyActionLoading(booking.id)}
                isActionSpinning={isActionSpinning}
                statusBadgeCls={statusBadgeCls}
                statusLabel={statusLabel}
                formatDate={formatDate}
                formatCurrency={formatCurrency}
                blockedUsers={blockedUsers}
                onConfirm={handleConfirmBooking}
                onCancel={handleCancelBooking}
                onCheckIn={handleCheckIn}
                onCheckOut={handleCheckOut}
                onNoShow={handleNoShow}
                onBlockUser={handleBlockUser}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

// ============================================================
// BLOCKED DATES PANEL
// ============================================================

interface BlockedDatesPanelProps {
  hostListings: HostListing[];
  blockedDates: Record<string, BlockedDateRange[]>;
  isAr: boolean;
  t: Record<string, string>;
  formatDate: (s: string) => string;
  blockedDateLoading: boolean;
  onDelete: (listingId: string, blockedDateId: string) => void;
}

function BlockedDatesPanel({
  hostListings,
  blockedDates,
  isAr,
  t,
  formatDate,
  blockedDateLoading,
  onDelete,
}: BlockedDatesPanelProps) {
  const listingIds = new Set<string>([...hostListings.map((l) => l.id), ...Object.keys(blockedDates)]);

  const listingsWithBlocked = Array.from(listingIds).map((id) => {
    const hostListing = hostListings.find((l) => l.id === id);
    return {
      id,
      title: hostListing?.title ?? "Listing",
      image: hostListing?.images?.[0],
      ranges: blockedDates[id] ?? [],
    };
  });

  if (listingsWithBlocked.length === 0) {
    return <EmptyState icon="🚫" msg={isAr ? "لا توجد تواريخ غير متاحة" : "No unavailable dates"} />;
  }

  return (
    <div className="flex flex-col gap-4">
      {listingsWithBlocked.map((listing) => {
        const unavailableDayCount = listing.ranges.reduce((total, range) => {
          if (!range?.startDate || !range?.endDate) return total;
          const diff = new Date(`${range.endDate}T00:00:00Z`).getTime() - new Date(`${range.startDate}T00:00:00Z`).getTime();
          return diff > 0 ? total + Math.ceil(diff / 86400000) : total;
        }, 0);

        return (
          <div key={listing.id} className="bg-white rounded-2xl border border-black/[0.07] px-5 py-5">
            <div className="flex items-center gap-3 mb-5">
              {listing.image && (
                <img src={listing.image} alt={listing.title} className="w-10 h-10 rounded-lg object-cover shrink-0" />
              )}

              <div>
                <h3 className="text-[14px] font-medium text-[#111118]">{listing.title}</h3>
                <p className="text-[11px] text-[#999] mt-0.5">
                  {listing.ranges.length > 0
                    ? `${unavailableDayCount} ${
                        unavailableDayCount === 1
                          ? isAr
                            ? "يوم غير متاح"
                            : "unavailable day"
                          : isAr
                            ? "أيام غير متاحة"
                            : "unavailable days"
                      }`
                    : t.noBlockedDates}
                </p>
              </div>
            </div>

            {listing.ranges.length > 0 ? (
              <div className="flex flex-col gap-2">
                {listing.ranges.map((range, index) => {
                  if (!range?.startDate || !range?.endDate) return null;
                  const blockedDateId = range.id;

                  return (
                    <div
                      key={blockedDateId || `${range.startDate}-${range.endDate}-${index}`}
                      className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#FEF2F2] border border-[#FECACA] rounded-xl px-4 py-3"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-9 h-9 rounded-lg bg-[#FEE2E2] flex items-center justify-center shrink-0">🚫</div>

                        <div className="min-w-0">
                          <div className="text-[12px] font-medium text-[#991b1b]">
                            {formatDate(range.startDate)}
                            <span className="mx-2 text-[#D99]">→</span>
                            {formatDate(range.endDate)}
                          </div>

                          <div className="text-[10px] text-[#B91C1C]/70 mt-0.5">
                            {isAr ? "تاريخ النهاية متاح" : "End date is available"}
                          </div>

                          {range.reason && (
                            <div className="mt-1">
                              <span className="text-[10px] text-[#888] bg-white/70 px-2.5 py-1 rounded-full inline-block">
                                {range.reason}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          if (!blockedDateId) {
                            alert(isAr ? "معرف التاريخ غير متوفر" : "Blocked date ID is missing");
                            return;
                          }
                          onDelete(listing.id, blockedDateId);
                        }}
                        disabled={blockedDateLoading || !blockedDateId}
                        className={[
                          "shrink-0 flex items-center justify-center gap-1.5",
                          "text-xs font-medium font-[inherit]",
                          "px-3.5 py-2 rounded-lg border transition-all",
                          blockedDateLoading || !blockedDateId
                            ? "bg-[#F3F4F6] text-[#9CA3AF] border-[#E5E7EB] cursor-not-allowed opacity-60"
                            : "bg-[#FEE2E2] text-[#991b1b] border-[#FCA5A5] cursor-pointer hover:bg-[#FECACA] hover:-translate-y-px",
                        ].join(" ")}
                      >
                        {blockedDateLoading ? (
                          <>
                            <Spinner cls="border-[#991b1b]" />
                            {t.deleting}
                          </>
                        ) : (
                          <>🗑️ {t.deleteBlockedDate}</>
                        )}
                      </button>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-[12px] text-[#ccc]">—</p>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ============================================================
// BLOCKED USERS PANEL
// ============================================================

interface BlockedUsersPanelProps {
  blockedUsers: BlockedUser[];
  unblockLoading: string | null;
  isAr: boolean;
  onUnblock: (userId: string) => void;
}

function BlockedUsersPanel({ blockedUsers, unblockLoading, isAr, onUnblock }: BlockedUsersPanelProps) {
  if (blockedUsers.length === 0) {
    return <EmptyState icon="🔓" msg={isAr ? "لا يوجد مستخدمون محظورون" : "No blocked users"} />;
  }

  return (
    <div className="flex flex-col gap-3">
      {blockedUsers.map((entry) => (
        <div
          key={entry.id}
          className="bg-white border border-black/[0.07] rounded-[14px] px-5 py-4 flex flex-col sm:flex-row sm:items-center gap-4 justify-between"
        >
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-[#FEE2E2] text-[#991b1b] flex items-center justify-center text-sm font-semibold shrink-0">
              {entry.user_name?.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase() ?? "?"}
            </div>

            <div>
              <p className="text-[14px] font-medium text-[#111118]">{entry.user_name}</p>
              <p className="text-[12px] text-[#999]">{entry.user_email}</p>

              <div className="flex flex-wrap gap-2 mt-1">
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#FEF3C7] text-[#92400E] font-medium">
                  {entry.reason === "no_show"
                    ? isAr
                      ? "⚠️ غياب"
                      : "⚠️ No-Show"
                    : entry.reason === "cancellation"
                      ? isAr
                        ? "❌ إلغاء"
                        : "❌ Cancellation"
                      : isAr
                        ? "🚫 يدوي"
                        : "🚫 Manual"}
                </span>

                <span className="text-[10px] text-[#bbb]">
                  {isAr ? "منذ" : "Since"}{" "}
                  {new Date(entry.created_at).toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                  })}
                </span>
              </div>
            </div>
          </div>

          <button
            onClick={() => onUnblock(entry.user_id)}
            disabled={unblockLoading === entry.user_id}
            className={[
              "shrink-0 flex items-center justify-center gap-1.5",
              "text-xs font-medium font-[inherit]",
              "px-4 py-2 rounded-lg border border-[#1D9E75]/30 transition-all",
              unblockLoading === entry.user_id
                ? "opacity-50 cursor-not-allowed bg-[#F3F4F6] text-[#9CA3AF]"
                : "bg-[#D1FAE5] text-[#065F46] cursor-pointer hover:opacity-85 hover:-translate-y-px",
            ].join(" ")}
          >
            {unblockLoading === entry.user_id ? (
              <>
                <Spinner cls="border-[#065F46]" />
                {isAr ? "جارٍ..." : "Unblocking..."}
              </>
            ) : isAr ? (
              "🔓 إلغاء الحظر"
            ) : (
              "🔓 Unblock"
            )}
          </button>
        </div>
      ))}
    </div>
  );
}

// ============================================================
// BOOKING CARD
// ============================================================

interface BookingCardProps {
  booking: Booking;
  isAr: boolean;
  t: Record<string, string>;
  nights: number;
  isLoading: boolean;
  isActionSpinning: (bookingId: string, action: string) => boolean;
  statusBadgeCls: (status: string) => string;
  statusLabel: (status: BookingStatus) => string;
  formatDate: (s: string) => string;
  formatCurrency: (n: number) => string;
  blockedUsers: BlockedUser[];
  onConfirm: (id: string) => void;
  onCancel: (id: string) => void;
  onCheckIn: (id: string) => void;
  onCheckOut: (id: string) => void;
  onNoShow: (id: string) => void;
  onBlockUser: (booking: Booking) => void;
}

function BookingCard({
  booking,
  isAr,
  t,
  nights,
  isLoading,
  isActionSpinning,
  statusBadgeCls,
  statusLabel,
  formatDate,
  formatCurrency,
  blockedUsers,
  onConfirm,
  onCancel,
  onCheckIn,
  onCheckOut,
  onNoShow,
  onBlockUser,
}: BookingCardProps) {
  // These flow off timestamps rather than only booking.status, so the card
  // never disappears just because the status field changed:
  //   confirmed -> checked_in -> checked_out
  const isCheckedIn = !!booking.checked_in_at || booking.status === "checked_in" || booking.status === "checked_out";
  const isCheckedOut = !!booking.checked_out_at || booking.status === "checked_out";
  const isNoShow = !!booking.no_show || booking.status === "no_show";

  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const checkInStr = (booking.check_in ?? "").slice(0, 10);
  const checkInDateReached = !!checkInStr && todayStr >= checkInStr;

  const canCheckIn = booking.status === "confirmed" && !isCheckedIn && !isCheckedOut && !isNoShow && checkInDateReached;
  const canCheckOut = isCheckedIn && !isCheckedOut && !isNoShow;
  const canMarkNoShow = !isCheckedIn && !isCheckedOut && !isNoShow && booking.status === "confirmed" && checkInDateReached;
  const canCancel = !isCheckedIn && !isCheckedOut && !isNoShow && ["pending", "confirmed"].includes(booking.status);

  const infoRows = [
    [t.guest, booking.user?.name || t.guestName],
    [t.email, booking.user?.email],
    [t.phone, booking.user?.phone_number],
    [t.location, booking.listing?.location],
  ] as const;

  const detailRows = [
    [t.checkIn, formatDate(booking.check_in)],
    [t.checkOut, formatDate(booking.check_out)],
    [t.nights, `${nights} ${nights !== 1 ? t.nights : t.night}`],
    [t.guests, `${booking.guests} ${booking.guests !== 1 ? t.guests : t.guest}`],
  ] as const;

  return (
    <div className="bg-white border border-black/[0.07] rounded-[14px] px-5 py-5 hover:shadow-[0_10px_32px_rgba(0,0,0,0.07)] hover:-translate-y-0.5 transition-all">
      <div className="flex flex-col lg:flex-row gap-6 justify-between">
        <div className="flex-1 min-w-0">
          {/* Status row */}
          <div className="flex flex-wrap items-center gap-2.5 mb-3">
            <h3 className="text-[15px] font-medium text-[#111118]">{booking.listing?.title || t.listing}</h3>

            <span
              className={`text-[10px] px-2.5 py-px rounded-[20px] font-medium tracking-[0.05em] uppercase ${statusBadgeCls(
                booking.status
              )}`}
            >
              {statusLabel(booking.status)}
            </span>

            {isCheckedIn && !isCheckedOut && (
              <span className="text-[10px] px-2.5 py-px rounded-[20px] font-medium bg-[#D1FAE5] text-[#065F46] tracking-[0.05em]">
                ✅ {isAr ? "وصل" : "Checked In"}
              </span>
            )}

            {isCheckedOut && (
              <span className="text-[10px] px-2.5 py-px rounded-[20px] font-medium bg-[#EDE9FE] text-[#4C1D95] tracking-[0.05em]">
                👋 {isAr ? "غادر" : "Checked Out"}
              </span>
            )}

            {isNoShow && (
              <span className="text-[10px] px-2.5 py-px rounded-[20px] font-medium bg-[#FEF3C7] text-[#92400E] tracking-[0.05em]">
                ⚠️ {isAr ? "غائب" : "No-Show"}
              </span>
            )}
          </div>

          {/* Guest information */}
          <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 mb-4">
            {infoRows.map(([label, val]) => (
              <div key={label}>
                <span className="text-[10px] uppercase tracking-[0.08em] text-[#bbb]">{label} </span>
                <span className="text-[12px] text-[#555]">{val || "—"}</span>
              </div>
            ))}
          </div>

          {/* Booking details */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 border-t border-black/[0.05] pt-3.5">
            {detailRows.map(([label, val]) => (
              <div key={label}>
                <div className="text-[10px] uppercase tracking-[0.08em] text-[#bbb] mb-0.5">{label}</div>
                <div className="text-[12px] font-medium text-[#333]">{val}</div>
              </div>
            ))}
          </div>

          {(isCheckedIn || isCheckedOut) && (
            <div className="flex flex-wrap gap-4 mt-3 pt-3 border-t border-black/[0.05]">
              {booking.checked_in_at && (
                <div>
                  <span className="text-[10px] uppercase tracking-[0.08em] text-[#bbb]">
                    {isAr ? "وقت الوصول" : "Arrived at"}{" "}
                  </span>
                  <span className="text-[11px] text-[#555]">{new Date(booking.checked_in_at).toLocaleString()}</span>
                </div>
              )}

              {booking.checked_out_at && (
                <div>
                  <span className="text-[10px] uppercase tracking-[0.08em] text-[#bbb]">
                    {isAr ? "وقت المغادرة" : "Left at"}{" "}
                  </span>
                  <span className="text-[11px] text-[#555]">{new Date(booking.checked_out_at).toLocaleString()}</span>
                </div>
              )}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2 mt-3">
            <span className="text-[10px] uppercase tracking-[0.08em] text-[#bbb]">{t.totalPrice}</span>
            <span className="text-base font-medium text-[#1a1a2e]">{formatCurrency(booking.total_price)}</span>
            <span className="text-[11px] text-[#bbb] sm:ml-auto">
              {isAr ? "تم الحجز في" : "Booked on"} {formatDate(booking.created_at)}
            </span>
          </div>
        </div>

        {/* ACTIONS */}
        <div className="flex flex-row lg:flex-col gap-2 lg:min-w-[148px] lg:flex-shrink-0 flex-wrap">
          {booking.status === "pending" && (
            <>
              <ActionBtn
                onClick={() => onConfirm(booking.id)}
                disabled={isLoading}
                spinning={isActionSpinning(booking.id, "confirm")}
                cls="bg-[#1a1a2e] text-[#e8c547]"
                label={`✓ ${t.confirm}`}
              />
              <ActionBtn
                onClick={() => onCancel(booking.id)}
                disabled={isLoading}
                spinning={isActionSpinning(booking.id, "cancel")}
                cls="bg-[#FEE2E2] text-[#991b1b]"
                label={`✗ ${t.cancel}`}
                spinCls="border-[#991b1b]"
              />
            </>
          )}

          {booking.status === "confirmed" && (
            <>
              <ActionBtn
                onClick={() => onCheckIn(booking.id)}
                disabled={isLoading || !canCheckIn}
                spinning={isActionSpinning(booking.id, "check_in")}
                cls={canCheckIn ? "bg-[#D1FAE5] text-[#065F46]" : "bg-[#F3F4F6] text-[#9CA3AF]"}
                label={
                  !checkInDateReached
                    ? isAr
                      ? "✅ الوصول (لم يحن بعد)"
                      : "✅ Check In (not yet)"
                    : isCheckedIn
                      ? isAr
                        ? "✅ تم الوصول"
                        : "✅ Checked In"
                      : isAr
                        ? "✅ تسجيل وصول"
                        : "✅ Check In"
                }
                spinCls="border-[#065F46]"
              />

              {!isCheckedIn && canMarkNoShow && (
                <ActionBtn
                  onClick={() => onNoShow(booking.id)}
                  disabled={isLoading}
                  spinning={isActionSpinning(booking.id, "no_show")}
                  cls="bg-[#FEF3C7] text-[#92400E]"
                  label={isAr ? "⚠️ غائب" : "⚠️ No-Show"}
                  spinCls="border-[#92400E]"
                />
              )}

              <ActionBtn
                onClick={() => onCancel(booking.id)}
                disabled={isLoading || !canCancel}
                spinning={isActionSpinning(booking.id, "cancel")}
                cls={canCancel ? "bg-[#FEE2E2] text-[#991b1b]" : "bg-[#F3F4F6] text-[#9CA3AF]"}
                label={t.cancel}
                spinCls="border-[#991b1b]"
              />
            </>
          )}

          {isCheckedIn && !isCheckedOut && !isNoShow && (
            <>
              <ActionBtn
                onClick={() => onCheckOut(booking.id)}
                disabled={isLoading || !canCheckOut}
                spinning={isActionSpinning(booking.id, "check_out")}
                cls="bg-[#EDE9FE] text-[#4C1D95]"
                label={isAr ? "👋 تسجيل مغادرة" : "👋 Check Out"}
                spinCls="border-[#4C1D95]"
              />

              <ActionBtn
                onClick={() => onBlockUser(booking)}
                disabled={isLoading || blockedUsers.some((b) => b.user_id === booking.user_id)}
                spinning={isActionSpinning(booking.id, "block_user")}
                cls="bg-[#1a1a2e]/[0.06] text-[#991b1b] border border-[#991b1b]/20"
                label={isAr ? "🚫 حظر المستخدم" : "🚫 Block User"}
                spinCls="border-[#991b1b]"
              />
            </>
          )}

          {isCheckedOut && (
            <div className="text-[11px] text-[#4C1D95] bg-[#EDE9FE] rounded-lg text-center py-2 px-3">
              👋 {isAr ? "تم تسجيل المغادرة" : "Guest checked out"}
            </div>
          )}

          {booking.status === "cancelled" && (
            <>
              <div className="text-[11px] text-[#991b1b] bg-[#FEE2E2] rounded-lg text-center py-2 px-4">{t.cancelled}</div>

              {!isNoShow && (
                <ActionBtn
                  onClick={() => onBlockUser(booking)}
                  disabled={isLoading}
                  spinning={isActionSpinning(booking.id, "block_user")}
                  cls="bg-[#1a1a2e]/[0.06] text-[#991b1b] border border-[#991b1b]/20"
                  label={isAr ? "🚫 حظر المستخدم" : "🚫 Block User"}
                  spinCls="border-[#991b1b]"
                />
              )}
            </>
          )}

          {isNoShow && (
            <div className="text-[11px] text-[#92400E] bg-[#FEF3C7] rounded-lg text-center py-2 px-4">
              ⚠️ {isAr ? "الضيف غائب" : "Guest was a no-show"}
            </div>
          )}

          <Link
            to={`/listings/${booking.listing_id}`}
            className="flex-1 lg:flex-none text-center bg-black/[0.04] text-[#555] no-underline text-xs font-[inherit] px-4 py-2 rounded-lg border border-black/[0.08] hover:bg-black/[0.08] transition-all"
          >
            {t.viewListing}
          </Link>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// ACTION BUTTON
// ============================================================

interface ActionBtnProps {
  onClick: () => void;
  disabled: boolean;
  spinning: boolean;
  cls: string;
  label: string;
  spinCls?: string;
}

function ActionBtn({ onClick, disabled, spinning, cls, label, spinCls = "border-[#e8c547]" }: ActionBtnProps) {
  return (
    <button
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      className={[
        "flex-1 lg:flex-none flex items-center justify-center gap-[5px]",
        "text-xs font-medium font-[inherit] px-4 py-2 rounded-lg border-none transition-all",
        disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer hover:opacity-85 hover:-translate-y-px",
        cls,
      ].join(" ")}
    >
      {spinning ? <Spinner cls={spinCls} /> : label}
    </button>
  );
}

// ============================================================
// EMPTY STATE
// ============================================================

function EmptyState({ icon, msg }: { icon: string; msg: string }) {
  return (
    <div className="bg-white rounded-2xl border border-black/[0.07] p-16 text-center">
      <div className="text-5xl mb-3">{icon}</div>
      <p className="text-[13px] text-[#999]">{msg}</p>
    </div>
  );
}

// ============================================================
// SPINNER
// ============================================================

function Spinner({ cls = "border-[#e8c547]" }: { cls?: string }) {
  return <span className={`inline-block w-3 h-3 rounded-full border-2 border-t-transparent animate-spin ${cls}`} />;
}

export default HostBookings;