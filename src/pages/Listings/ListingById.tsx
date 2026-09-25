// src/pages/ListingDetail/index.tsx
import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useLanguage } from "../../hooks/useLanguage";
import LoadingScreen from "../../components/LoadingScreen";
import Navbar from "../../components/Navbar";
import { apiService } from "../../services/api";
import HostDateManager from "../../components/HostDateManager";

// ─── Constants ────────────────────────────────────────────────────────────────

const API_BASE =
  import.meta.env.VITE_API_URL || "https://api.mar-haba.ly/api/v1";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Listing {
  id: string;
  title: string;
  description: string;
  price: number;
  location: string;
  latitude: string;
  longitude: string;
  images: string[];
  category: string;
  amenities: string[];
  host_id: string;
  rules: string[];

  cancellation_policy: {
    type: string;
    rules: string[];
    description: string;
    descriptionEn?: string;
    descriptionAr?: string;
    rulePairs?: { en: string; ar: string }[];
  };

  status: string;
  is_active: boolean;
  view_count: number;
  created_at: string;
  updated_at: string;

  blocked_dates?: {
    startDate: string;
    endDate: string;
    reason?: string;
    id: string;
  }[];

  blockedDates?: {
    startDate: string;
    endDate: string;
    reason?: string;
    id: string;
  }[];

  bookings?: {
    check_in: string;
    check_out: string;
    status: string;
  }[];

  host: {
    id: string;
    name: string;
    email: string;
    phone_number: string;
    hostDetails?: {
      totalListings: number;
      joinedDate?: string;
    };
  };
}

interface BookingData {
  checkIn: string;
  checkOut: string;
  guests: number;
}

// ─── Static config ────────────────────────────────────────────────────────────

const CATEGORIES = [
  { id: "beachfront", icon: "🏖️", labelEn: "Beachfront", labelAr: "شاطئ" },
  { id: "mountain", icon: "🏔️", labelEn: "Mountain", labelAr: "جبال" },
  { id: "city", icon: "🏙️", labelEn: "City", labelAr: "مدينة" },
  { id: "countryside", icon: "🏡", labelEn: "Countryside", labelAr: "ريفي" },
  { id: "pool", icon: "🏊", labelEn: "Pool", labelAr: "مسبح" },
  { id: "islands", icon: "🌴", labelEn: "Islands", labelAr: "جزيرة" },
  { id: "camping", icon: "🏕️", labelEn: "Camping", labelAr: "تخييم" },
  { id: "cabins", icon: "🛖", labelEn: "Cabins", labelAr: "كوخ" },
];

const POLICY_META: Record<
  string,
  { icon: string; labelEn: string; labelAr: string; color: string; bg: string }
> = {
  flexible: {
    icon: "🟢",
    labelEn: "Flexible",
    labelAr: "مرن",
    color: "#1D9E75",
    bg: "#EAF3DE",
  },
  moderate: {
    icon: "🟡",
    labelEn: "Moderate",
    labelAr: "معتدل",
    color: "#D97706",
    bg: "#FEF3C7",
  },
  strict: {
    icon: "🔴",
    labelEn: "Strict",
    labelAr: "صارم",
    color: "#e05a5a",
    bg: "#FCEBEB",
  },
  custom: {
    icon: "✏️",
    labelEn: "Custom",
    labelAr: "مخصص",
    color: "#555",
    bg: "#f7f6f2",
  },
};

const AVATAR_PAL = [
  { bg: "#EEEDFE", color: "#3C3489" },
  { bg: "#E6F1FB", color: "#0C447C" },
  { bg: "#EAF3DE", color: "#27500A" },
  { bg: "#FAEEDA", color: "#633806" },
  { bg: "#E1F5EE", color: "#085041" },
  { bg: "#FBEAF0", color: "#72243E" },
];

const translations = {
  en: {
    dashboard: "Dashboard",
    browse: "Browse",
    backToListings: "Back to listings",
    about: "About",
    amenities: "Amenities",
    houseRules: "House Rules",
    hostedBy: "Hosted by",
    hostSince: "Host since",
    locationMap: "Location Map",
    night: "night",
    nights: "nights",
    selectDates: "Select dates",
    checkIn: "Check-in",
    checkOut: "Check-out",
    guests: "Guests",
    total: "Total",
    bookNow: "Book now",
    listingNotFound: "Listing not found",
    listingUnavailable: "This listing is currently unavailable for booking.",
    youOwnThisProperty: "You own this property",
    cannotBookOwnListing: "You cannot book your own listing.",
    listingActive: "Listing Active",
    listingInactive: "Listing Inactive",
    listingActiveDesc: "Guests can book this listing",
    listingInactiveDesc: "New bookings are paused",
    viewAllBookings: "View all bookings",
    adminViewOnly: "Admin View",
    adminCannotBookOrBlock:
      "Admins can view listings but cannot make bookings or block dates.",
    goToAdminPanel: "Go to Admin Panel",
    bookingCreatedSuccess: "Booking created successfully!",
    pleaseSelectDates: "Please select check-in and check-out dates.",
    views: "views",
    // Guest login prompt
    loginToBook: "Log in to book",
    loginToBookDesc:
      "You need an account to select dates and complete a booking.",
    logIn: "Log in",
    createAccount: "Create account",
  },
  ar: {
    dashboard: "لوحة التحكم",
    browse: "استعراض",
    backToListings: "العودة إلى القوائم",
    about: "الوصف",
    amenities: "وسائل الراحة",
    houseRules: "قواعد المنزل",
    hostedBy: "المضيف",
    hostSince: "مضيف منذ",
    locationMap: "خريطة الموقع",
    night: "ليلة",
    nights: "ليالي",
    selectDates: "اختر التواريخ",
    checkIn: "تسجيل الوصول",
    checkOut: "تسجيل المغادرة",
    guests: "الضيوف",
    total: "المجموع",
    bookNow: "احجز الآن",
    listingNotFound: "القائمة غير موجودة",
    listingUnavailable: "هذه القائمة غير متاحة للحجز حالياً.",
    youOwnThisProperty: "أنت تملك هذا العقار",
    cannotBookOwnListing: "لا يمكنك حجز قائمتك الخاصة.",
    listingActive: "القائمة نشطة",
    listingInactive: "القائمة غير نشطة",
    listingActiveDesc: "يمكن للضيوف حجز هذه القائمة",
    listingInactiveDesc: "تم إيقاف الحجوزات الجديدة",
    viewAllBookings: "عرض جميع الحجوزات",
    adminViewOnly: "عرض المشرف",
    adminCannotBookOrBlock:
      "يمكن للمشرفين عرض القوائم ولكن لا يمكنهم الحجز أو حجز التواريخ.",
    goToAdminPanel: "انتقل إلى لوحة المشرف",
    bookingCreatedSuccess: "تم إنشاء الحجز بنجاح!",
    pleaseSelectDates: "يرجى تحديد تاريخي تسجيل الوصول والمغادرة.",
    views: "مشاهدة",
    // Guest login prompt
    loginToBook: "سجّل الدخول للحجز",
    loginToBookDesc: "تحتاج إلى حساب لتحديد التواريخ وإتمام الحجز.",
    logIn: "تسجيل الدخول",
    createAccount: "إنشاء حساب",
  },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fromDateString = (dateString: string): Date | null => {
  if (!dateString) return null;
  const [year, month, day] = dateString.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
};

const displayDate = (dateString: string): string => {
  if (!dateString) return "";
  const [year, month, day] = dateString.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
};

const createLocalDate = fromDateString;

const getAvatar = (name?: string) =>
  AVATAR_PAL[(name?.charCodeAt(0) ?? 0) % AVATAR_PAL.length];

const getInitials = (name?: string) =>
  name
    ?.split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() || "H";

// ─── Booking Calendar ────────────────────────────────────────────────────────

function BookingCalendar({
  unavailableDates,
  onDateSelect,
  checkIn,
  checkOut,
  isHost = false,
  isAr = false,
}: {
  unavailableDates: string[];
  onDateSelect: (dates: { checkIn: string; checkOut: string }) => void;
  checkIn: string;
  checkOut: string;
  isHost?: boolean;
  isAr?: boolean;
}) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const parseDate = (dateString: string) => {
    const [year, month, day] = dateString.split("-").map(Number);
    return new Date(year, month - 1, day);
  };

  const formatKey = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const initialDate = checkIn
    ? parseDate(checkIn)
    : new Date(today.getFullYear(), today.getMonth(), 1);

  const [currentMonth, setCurrentMonth] = useState(
    new Date(initialDate.getFullYear(), initialDate.getMonth(), 1),
  );

  const [selectingCheckOut, setSelectingCheckOut] = useState(
    Boolean(checkIn && !checkOut),
  );

  useEffect(() => {
    if (checkIn && !checkOut) {
      setSelectingCheckOut(true);
    } else if (!checkIn && !checkOut) {
      setSelectingCheckOut(false);
    }
  }, [checkIn, checkOut]);

  const monthNames = isAr
    ? [
        "يناير",
        "فبراير",
        "مارس",
        "أبريل",
        "مايو",
        "يونيو",
        "يوليو",
        "أغسطس",
        "سبتمبر",
        "أكتوبر",
        "نوفمبر",
        "ديسمبر",
      ]
    : [
        "January",
        "February",
        "March",
        "April",
        "May",
        "June",
        "July",
        "August",
        "September",
        "October",
        "November",
        "December",
      ];

  const weekDays = isAr
    ? ["أحد", "اثنين", "ثلاثاء", "أربعاء", "خميس", "جمعة", "سبت"]
    : ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const calendarDays: (Date | null)[] = [];

  for (let i = 0; i < firstDay; i++) {
    calendarDays.push(null);
  }

  for (let day = 1; day <= daysInMonth; day++) {
    calendarDays.push(new Date(year, month, day));
  }

  const unavailableSet = new Set(unavailableDates);

  const isPast = (date: Date) => {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d < today;
  };

  const isUnavailable = (date: Date) => unavailableSet.has(formatKey(date));

  const isAvailable = (date: Date) => !isPast(date) && !isUnavailable(date);

  const isBeforeCheckIn = (date: Date) => {
    if (!checkIn) return false;
    return formatKey(date) < checkIn;
  };

  const isSelected = (date: Date) => {
    const key = formatKey(date);
    return key === checkIn || key === checkOut;
  };

  const isInRange = (date: Date) => {
    if (!checkIn || !checkOut) return false;
    const key = formatKey(date);
    return key > checkIn && key < checkOut;
  };

  const isToday = (date: Date) => formatKey(date) === formatKey(today);

  const changeMonth = (amount: number) => {
    setCurrentMonth(
      new Date(currentMonth.getFullYear(), currentMonth.getMonth() + amount, 1),
    );
  };

  const canGoPrevious = () => {
    const previousMonth = new Date(year, month - 1, 1);
    const currentMonthStart = new Date(
      today.getFullYear(),
      today.getMonth(),
      1,
    );
    return previousMonth >= currentMonthStart;
  };

  const handleDateClick = (date: Date) => {
    if (isHost) return;

    const key = formatKey(date);

    if (isPast(date)) return;

    if (!selectingCheckOut && isUnavailable(date)) return;

    if (!checkIn) {
      onDateSelect({ checkIn: key, checkOut: "" });
      setSelectingCheckOut(true);
      return;
    }

    if (selectingCheckOut) {
      if (key === checkIn) {
        onDateSelect({ checkIn: "", checkOut: "" });
        setSelectingCheckOut(false);
        return;
      }

      if (key < checkIn) {
        if (isUnavailable(date)) return;
        onDateSelect({ checkIn: key, checkOut: "" });
        setSelectingCheckOut(true);
        return;
      }

      const start = parseDate(checkIn);
      const end = date;
      const cursor = new Date(start);
      cursor.setDate(cursor.getDate() + 1);

      while (cursor < end) {
        if (isUnavailable(cursor)) return;
        cursor.setDate(cursor.getDate() + 1);
      }

      onDateSelect({ checkIn, checkOut: key });
      setSelectingCheckOut(false);
      return;
    }

    if (isUnavailable(date)) return;
    onDateSelect({ checkIn: key, checkOut: "" });
    setSelectingCheckOut(true);
  };

  const formatDisplayDate = (dateString: string) => {
    if (!dateString) return "";
    const date = parseDate(dateString);
    return date.toLocaleDateString(isAr ? "ar-LY" : "en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  return (
    <div
      className="bg-white rounded-xl border border-black/8 overflow-hidden"
      dir={isAr ? "rtl" : "ltr"}
    >
      {/* Header */}
      <div className="px-4 pt-4 pb-3 border-b border-black/7">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => changeMonth(-1)}
            disabled={!canGoPrevious()}
            className="w-8 h-8 rounded-full flex items-center justify-center border border-black/8 bg-white text-[#555] hover:bg-[#f7f6f2] disabled:opacity-30 disabled:cursor-not-allowed transition"
            aria-label={isAr ? "الشهر السابق" : "Previous month"}
          >
            {isAr ? "›" : "‹"}
          </button>

          <div className="text-[14px] font-semibold text-[#111118]">
            {monthNames[month]} {year}
          </div>

          <button
            type="button"
            onClick={() => changeMonth(1)}
            className="w-8 h-8 rounded-full flex items-center justify-center border border-black/8 bg-white text-[#555] hover:bg-[#f7f6f2] transition"
            aria-label={isAr ? "الشهر التالي" : "Next month"}
          >
            {isAr ? "‹" : "›"}
          </button>
        </div>

        {!isHost && (
          <div className="mt-3 text-center">
            {!checkIn && !checkOut ? (
              <span className="text-[11px] text-[#888]">
                {isAr
                  ? "اختر تاريخ تسجيل الوصول"
                  : "Select your check-in date"}
              </span>
            ) : checkIn && !checkOut ? (
              <span className="text-[11px] text-[#185FA5] font-medium">
                {isAr
                  ? "الآن اختر تاريخ تسجيل المغادرة"
                  : "Now select your check-out date"}
              </span>
            ) : (
              <span className="text-[11px] text-[#1D9E75] font-medium">
                {formatDisplayDate(checkIn)} → {formatDisplayDate(checkOut)}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Week days */}
      <div className="grid grid-cols-7 px-3 pt-3">
        {weekDays.map((day) => (
          <div
            key={day}
            className="text-center text-[9px] uppercase tracking-[0.05em] text-[#999] font-medium py-1"
          >
            {day}
          </div>
        ))}
      </div>

      {/* Grid */}
      <div className="grid grid-cols-7 gap-y-1 px-3 pb-4 pt-1">
        {calendarDays.map((date, index) => {
          if (!date) {
            return <div key={`empty-${index}`} className="h-10" />;
          }

          const key = formatKey(date);
          const past = isPast(date);
          const unavailable = isUnavailable(date);
          const available = isAvailable(date);
          const beforeCheckIn = isBeforeCheckIn(date);
          const selected = isSelected(date);
          const inRange = isInRange(date);
          const todayDate = isToday(date);

          const disabled =
            isHost ||
            past ||
            (unavailable && !selectingCheckOut) ||
            (selectingCheckOut && beforeCheckIn);

          return (
            <div
              key={key}
              className="h-10 flex items-center justify-center relative"
            >
              {inRange && (
                <div className="absolute inset-y-1 left-0 right-0 bg-[#FEF3C7]" />
              )}

              <button
                type="button"
                disabled={disabled}
                onClick={() => handleDateClick(date)}
                title={
                  unavailable
                    ? isAr
                      ? "غير متاح"
                      : "Unavailable"
                    : past
                      ? isAr
                        ? "غير متاح"
                        : "Unavailable"
                      : available
                        ? isAr
                          ? "متاح"
                          : "Available"
                        : ""
                }
                className={`
                  relative z-10 w-8 h-8 rounded-full text-[11px]
                  flex items-center justify-center
                  transition-all duration-150
                  ${past ? "text-[#ccc] cursor-not-allowed" : ""}
                  ${
                    unavailable
                      ? "text-[#c4c4c4] bg-[#f1f1ee] cursor-not-allowed"
                      : ""
                  }
                  ${
                    beforeCheckIn && selectingCheckOut
                      ? "text-[#ccc] cursor-not-allowed"
                      : ""
                  }
                  ${
                    selected
                      ? "bg-[#e8c547] text-[#1a1a2e] font-semibold shadow-sm"
                      : ""
                  }
                  ${
                    !selected && !disabled && !inRange
                      ? "text-[#333] hover:bg-[#f7f6f2] cursor-pointer"
                      : ""
                  }
                  ${
                    !selected && inRange
                      ? "text-[#633806] hover:bg-[#FAEEDA] cursor-pointer"
                      : ""
                  }
                  ${
                    todayDate && !selected
                      ? "ring-1 ring-[#e8c547] ring-inset font-semibold"
                      : ""
                  }
                `}
              >
                {date.getDate()}
              </button>

              {unavailable && (
                <span className="absolute bottom-[2px] w-1 h-1 rounded-full bg-[#d66]" />
              )}

              {available && !selected && !past && !unavailable && (
                <span className="absolute bottom-[2px] w-1 h-1 rounded-full bg-[#1D9E75]" />
              )}
            </div>
          );
        })}
      </div>

      {/* Legend */}
      {!isHost && (
        <div className="border-t border-black/7 px-3 py-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-[10px] text-[#888]">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-[#EAF3DE] border border-[#1D9E75]/20 flex items-center justify-center">
              <span className="w-1.5 h-1.5 rounded-full bg-[#1D9E75]" />
            </span>
            <span>{isAr ? "متاح" : "Available"}</span>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-[#f1f1ee] border border-black/5 flex items-center justify-center">
              <span className="w-1.5 h-1.5 rounded-full bg-[#d66]" />
            </span>
            <span>{isAr ? "محجوز" : "Unavailable"}</span>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-[#e8c547]" />
            <span>{isAr ? "محدد" : "Selected"}</span>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full ring-1 ring-[#e8c547]" />
            <span>{isAr ? "اليوم" : "Today"}</span>
          </div>
        </div>
      )}

      {isHost && (
        <div className="border-t border-black/7 px-4 py-3 text-center">
          <span className="text-[10px] text-[#888]">
            {isAr
              ? "📅 إدارة الحجوزات والتواريخ المحجوزة أدناه"
              : "📅 Manage bookings and blocked dates below"}
          </span>
        </div>
      )}
    </div>
  );
}

// ─── Cancellation Policy Card ─────────────────────────────────────────────────

function CancellationPolicyCard({
  policy,
  isAr,
}: {
  policy: Listing["cancellation_policy"];
  isAr: boolean;
}) {
  if (!policy) return null;

  const meta = POLICY_META[policy.type] ?? POLICY_META.custom;
  const label = isAr ? meta.labelAr : meta.labelEn;
  const description = isAr ? policy.descriptionAr : policy.description;
  const rules = policy.rulePairs
    ? policy.rulePairs.map((p) => (isAr ? p.ar : p.en)).filter(Boolean)
    : policy.rules || [];

  return (
    <div className="bg-white rounded-2xl border border-black/7 px-5 pb-5">
      <div className="border-t-[3px] border-[#e8c547] pt-5 mb-4">
        <div className="text-[10px] tracking-[0.1em] uppercase text-[#999] mb-1.5">
          {isAr ? "سياسة الإلغاء" : "Cancellation Policy"}
        </div>
      </div>

      <div
        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-[12px] font-semibold mb-3"
        style={{ background: meta.bg, color: meta.color }}
      >
        <span>{meta.icon}</span>
        <span>{label}</span>
      </div>

      {description && (
        <p className="text-[13px] text-[#666] leading-[1.7] mb-3 italic">
          {description}
        </p>
      )}

      {rules.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {rules.map((rule, i) => (
            <li
              key={i}
              className="flex items-start gap-2.5 text-[13px] text-[#555]"
            >
              <span
                className="w-[18px] h-[18px] rounded-full flex items-center justify-center shrink-0 mt-0.5"
                style={{ background: meta.bg }}
              >
                <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                  <path
                    d="M1 4l2 2 4-4"
                    stroke={meta.color}
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </span>
              {rule}
            </li>
          ))}
        </ul>
      ) : (
        !description && (
          <p className="text-[13px] text-[#999] italic">
            {isAr
              ? "تواصل مع المضيف للاستفسار عن شروط الإلغاء."
              : "Contact the host for cancellation terms."}
          </p>
        )
      )}
    </div>
  );
}

function CancellationPolicyMini({
  policy,
  isAr,
}: {
  policy: Listing["cancellation_policy"];
  isAr: boolean;
}) {
  if (!policy) return null;

  const meta = POLICY_META[policy.type] ?? POLICY_META.custom;
  const label = isAr ? meta.labelAr : meta.labelEn;
  const firstRule = policy.rulePairs
    ? isAr
      ? policy.rulePairs[0]?.ar
      : policy.rulePairs[0]?.en
    : policy.rules?.[0];

  return (
    <div
      className="rounded-lg px-3 py-2.5 text-[11px] leading-[1.6]"
      style={{ background: meta.bg, color: meta.color }}
    >
      <span className="font-semibold">
        {meta.icon} {label} {isAr ? "سياسة الإلغاء" : "cancellation"}
      </span>
      {firstRule && (
        <span className="block mt-0.5 opacity-80">{firstRule}</span>
      )}
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function ListingDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const { lang, toggleLanguage } = useLanguage();
  const isAr = lang === "ar";
  const t = translations[isAr ? "ar" : "en"];

  const [listing, setListing] = useState<Listing | null>(null);
  const [unavailableDates, setUnavailableDates] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isHost, setIsHost] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [booking, setBooking] = useState<BookingData>({
    checkIn: "",
    checkOut: "",
    guests: 1,
  });
  const [bookingError, setBookingError] = useState("");
  const [bookingSuccess, setBookingSuccess] = useState("");
  const [totalPrice, setTotalPrice] = useState(0);
  const [activeImage, setActiveImage] = useState(0);
  const [listingView, setListingView] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isTogglingActive, setIsTogglingActive] = useState(false);

  // ─── Fetch listing (public endpoint) ───────────────────────────────────────

  const fetchListing = async () => {
    if (!id) return;

    setLoading(true);
    setError(null);

    try {
      // Public endpoint — works for both guests and logged-in users.
      // If the user is logged in, sending the Authorization header lets
      // the backend return personalised fields (e.g. bookings if this is
      // their own listing).
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      const token = localStorage.getItem("tokens");
      if (token) {
        try {
          const parsed = JSON.parse(token);
          if (parsed?.accessToken) {
            headers.Authorization = `Bearer ${parsed.accessToken}`;
          }
        } catch {
          /* ignore malformed storage */
        }
      }

      const res = await fetch(`${API_BASE}/listings/${id}`, { headers });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      const response = await res.json();

      const listingData = response?.data?.data ?? response?.data ?? response;

      if (!listingData || !listingData.id) {
        setError(isAr ? "تعذر تحميل القائمة" : "Failed to load listing");
        return;
      }

      setListing(listingData);

      // ── Build unavailable dates ────────────────────────────────────────────
      const unavailable = new Set<string>();

      // Bookings block check-in through the night before check-out.
      if (Array.isArray(listingData.bookings)) {
        listingData.bookings.forEach((b: any) => {
          if (!b.check_in || !b.check_out) return;
          if (
            b.status === "cancelled" ||
            b.status === "canceled" ||
            b.status === "rejected"
          ) {
            return;
          }

          const start = fromDateString(b.check_in.slice(0, 10));
          const end = fromDateString(b.check_out.slice(0, 10));
          if (!start || !end) return;

          const cursor = new Date(start);
          while (cursor < end) {
            unavailable.add(
              `${cursor.getUTCFullYear()}-${String(
                cursor.getUTCMonth() + 1,
              ).padStart(2, "0")}-${String(cursor.getUTCDate()).padStart(
                2,
                "0",
              )}`,
            );
            cursor.setUTCDate(cursor.getUTCDate() + 1);
          }
        });
      }

      // Host blocked date ranges.
      const blockedRanges = Array.isArray(listingData.blocked_dates)
        ? listingData.blocked_dates
        : Array.isArray(listingData.blockedDates)
          ? listingData.blockedDates
          : [];

      blockedRanges.forEach((blocked: any) => {
        if (!blocked.startDate || !blocked.endDate) return;

        const start = fromDateString(blocked.startDate);
        const end = fromDateString(blocked.endDate);
        if (!start || !end) return;

        const cursor = new Date(start);
        while (cursor < end) {
          unavailable.add(
            `${cursor.getUTCFullYear()}-${String(
              cursor.getUTCMonth() + 1,
            ).padStart(2, "0")}-${String(cursor.getUTCDate()).padStart(
              2,
              "0",
            )}`,
          );
          cursor.setUTCDate(cursor.getUTCDate() + 1);
        }
      });

      setUnavailableDates(Array.from(unavailable));
    } catch (err) {
      console.error("Error fetching listing:", err);
      setError(isAr ? "حدث خطأ أثناء تحميل القائمة" : "Error loading listing");
    } finally {
      setLoading(false);
    }
  };

  // ─── Fetch view count (only when logged in) ────────────────────────────────

  const fetchListingView = async () => {
    if (!id || !isAuthenticated) return;
    try {
      const response = await apiService.postProtectedData(
        `/api/v1/listings/${id}/view`,
        {},
      );
      if (response.success && response.data) {
        setListingView(response.data.views || response.data.view_count);
      }
    } catch (err) {
      // Non-fatal — the page works without the view counter.
      console.error("Error updating view count:", err);
    }
  };

  // ─── Effects ───────────────────────────────────────────────────────────────

  useEffect(() => {
    if (id) fetchListing();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    if (id) fetchListingView();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, isAuthenticated]);

  useEffect(() => {
    if (user && listing) {
      setIsHost(user.id === listing.host?.id);
      setIsAdmin(user.role === "admin" || user.role === "super_admin");
    } else {
      setIsHost(false);
      setIsAdmin(false);
    }
  }, [user, listing]);

  useEffect(() => {
    if (!listing || !booking.checkIn || !booking.checkOut) {
      setTotalPrice(0);
      return;
    }
    const nights = Math.ceil(
      (createLocalDate(booking.checkOut)!.getTime() -
        createLocalDate(booking.checkIn)!.getTime()) /
        86400000,
    );
    setTotalPrice(nights > 0 ? listing.price * nights : 0);
  }, [booking.checkIn, booking.checkOut, listing]);

  // ─── Handlers ──────────────────────────────────────────────────────────────

  const handleBooking = async (e: React.FormEvent) => {
    e.preventDefault();

    setBookingError("");
    setBookingSuccess("");

    if (!id) {
      setBookingError(
        isAr ? "معرف القائمة غير موجود." : "Listing ID is missing.",
      );
      return;
    }

    if (!isAuthenticated) {
      navigate("/login", { state: { from: `/listings/${id}` } });
      return;
    }

    if (!booking.checkIn || !booking.checkOut) {
      setBookingError(t.pleaseSelectDates);
      return;
    }

    if (booking.checkOut <= booking.checkIn) {
      setBookingError(
        isAr
          ? "يجب أن يكون تاريخ المغادرة بعد تاريخ الوصول."
          : "Check-out date must be after check-in date.",
      );
      return;
    }

    if (booking.guests < 1) {
      setBookingError(
        isAr
          ? "يجب أن يكون عدد الضيوف شخصاً واحداً على الأقل."
          : "Guests must be at least 1.",
      );
      return;
    }

    setIsSubmitting(true);

    const payload = {
      listing_id: id,
      check_in: booking.checkIn,
      check_out: booking.checkOut,
      guests: booking.guests,
    };

    try {
      const response = await apiService.postProtectedData(
        "/api/v1/bookings/create",
        payload,
      );

      if (response?.success) {
        setBookingSuccess(t.bookingCreatedSuccess);

        try {
          await fetchListing();
        } catch (refreshError) {
          console.error("Failed to refresh listing:", refreshError);
        }

        setTimeout(() => {
          navigate("/user-dashboard");
        }, 2000);

        return;
      }

      const errorMessage =
        response?.message ||
        response?.error ||
        response?.data?.message ||
        response?.data?.error ||
        (isAr ? "فشل إنشاء الحجز." : "Failed to create booking.");

      setBookingError(errorMessage);
    } catch (err: any) {
      let message =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        err?.message ||
        (isAr
          ? "حدث خطأ أثناء إنشاء الحجز."
          : "An error occurred while creating the booking.");

      if (Array.isArray(err?.response?.data?.errors)) {
        message = err.response.data.errors
          .map((error: any) => error.msg || error.message)
          .filter(Boolean)
          .join(", ");
      }

      setBookingError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleActive = async () => {
    setIsTogglingActive(true);
    try {
      const response = await apiService.putProtectedData(
        `/api/v1/listings/${id}`,
        { is_active: !listing?.is_active },
      );
      if (response.success && response.data) {
        setListing((prev) => ({
          ...prev!,
          is_active: response.data.is_active,
        }));
      }
    } catch (err) {
      console.error("Error toggling listing:", err);
    } finally {
      setIsTogglingActive(false);
    }
  };

  const formatCurrency = (amount: number) => {
    const roundedAmount = Math.round(Number(amount) || 0);
    return isAr
      ? `${roundedAmount.toLocaleString("ar-LY")} دينار`
      : `${roundedAmount.toLocaleString("en-US")} LYD`;
  };

  // ─── Render guards ─────────────────────────────────────────────────────────

  if (authLoading || loading) {
    return <LoadingScreen />;
  }

  const userInitials = user ? getInitials(user.name) : "?";

  if (error || !listing) {
    return (
      <div className="min-h-screen bg-[#f7f6f2]">
        <Navbar
          NAV_LINKS={[
            { id: "dashboard", label: t.dashboard, href: "/dashboard" },
            { id: "browse", label: t.browse, href: "/listings" },
          ]}
          user={user}
          lang={lang}
          toggleLanguage={toggleLanguage}
         
        />
        <div className="max-w-[1100px] mx-auto p-6">
          <div className="bg-white rounded-2xl p-8 text-center border border-black/7">
            <div className="text-5xl mb-4">🏠</div>
            <h2 className="font-light text-2xl text-[#111118] mb-2">
              {error || t.listingNotFound}
            </h2>
            <Link
              to="/listings"
              className="inline-block mt-4 bg-[#1a1a2e] text-[#e8c547] px-6 py-2.5 rounded-lg text-sm"
            >
              {t.backToListings} →
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const categoryInfo = listing.category
    ? CATEGORIES.find((c) => c.id === listing.category)
    : null;
  const hostAvi = getAvatar(listing.host?.name);
  const hostInitial = getInitials(listing.host?.name);
  const nights =
    booking.checkIn && booking.checkOut
      ? Math.ceil(
          (createLocalDate(booking.checkOut)!.getTime() -
            createLocalDate(booking.checkIn)!.getTime()) /
            86400000,
        )
      : 0;

  const displayFontClass = isAr
    ? "font-['Cairo','Tajawal',sans-serif]"
    : "font-['Fraunces',serif]";
  const bodyFontClass = isAr
    ? "font-['Cairo','Tajawal',sans-serif]"
    : "font-['DM_Mono',monospace]";

  const canBook =
    isAuthenticated && !isHost && !isAdmin && listing.is_active;

  return (
    <div
      className={`min-h-screen bg-[#f7f6f2] ${isAr ? "rtl" : "ltr"} ${bodyFontClass}`}
    >
      <Navbar
        NAV_LINKS={[
          { id: "dashboard", label: t.dashboard, href: "/dashboard" },
          { id: "browse", label: t.browse, href: "/listings" },
        ]}
        user={user}
        lang={lang}
        toggleLanguage={toggleLanguage}
        
      />

      <main className="max-w-[1100px] mx-auto px-4 md:px-6 py-7">
        {/* Back + Title */}
        <div className="mb-5">
          <Link
            to="/listings"
            className="text-[12px] text-[#888] no-underline inline-flex items-center gap-1 mb-2.5"
          >
            ← {t.backToListings}
          </Link>

          {categoryInfo && (
            <div className="inline-flex items-center gap-1.5 bg-[#f7f6f2] px-3.5 py-1.5 rounded-3xl text-[13px] text-[#555] mb-4 border border-black/7">
              <span className="text-[18px]">{categoryInfo.icon}</span>
              <span>{isAr ? categoryInfo.labelAr : categoryInfo.labelEn}</span>
            </div>
          )}

          <h1
            className={`font-light text-[clamp(24px,4vw,36px)] text-[#111118] leading-[1.1] mb-2 ${displayFontClass}`}
          >
            {listing.title}
          </h1>

          <div className="flex flex-wrap items-center gap-3 text-[12px] text-[#888]">
            <div className="flex items-center gap-1.5">
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path
                  d="M6 1C4.07 1 2.5 2.57 2.5 4.5c0 2.78 3.5 6.5 3.5 6.5s3.5-3.72 3.5-6.5C9.5 2.57 7.93 1 6 1zm0 5a1.5 1.5 0 110-3 1.5 1.5 0 010 3z"
                  fill="#bbb"
                />
              </svg>
              {listing.location}
            </div>
            <div className="flex items-center gap-1 text-[#666]">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="opacity-70"
              >
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
              <span>
                {listingView || listing.view_count || 0} {t.views}
              </span>
            </div>
          </div>
        </div>

        {/* Image Gallery */}
        <div className="mb-6">
          <div className="h-[380px] rounded-2xl overflow-hidden bg-[#e0dfd9] mb-2.5">
            {listing.images?.[activeImage] && (
              <img
                src={listing.images[activeImage]}
                alt={listing.title}
                className="w-full h-full object-cover block transition-opacity duration-200"
              />
            )}
          </div>
          {listing.images?.length > 1 && (
            <div className="flex gap-2 overflow-x-auto pb-1">
              {listing.images.map((img, i) => (
                <img
                  key={i}
                  src={img}
                  alt={`view ${i + 1}`}
                  onClick={() => setActiveImage(i)}
                  className={`w-[70px] h-[70px] rounded-lg object-cover cursor-pointer transition-all border-2 ${
                    i === activeImage
                      ? "opacity-100 border-[#e8c547]"
                      : "opacity-60 border-transparent"
                  }`}
                />
              ))}
            </div>
          )}
        </div>

        {/* Detail Layout */}
        <div className="grid grid-cols-1 md:grid-cols-[1fr_360px] gap-5 items-start">
          {/* ── LEFT column ── */}
          <div className="flex flex-col gap-5">
            {/* Description */}
            <div className="bg-white rounded-2xl border border-black/7 px-5 pb-5">
              <div className="border-t-[3px] border-[#378ADD] pt-5 mb-4">
                <div className="text-[10px] tracking-[0.1em] uppercase text-[#999] mb-1.5">
                  {t.about}
                </div>
              </div>
              <p className="text-[13px] text-[#555] leading-[1.75]">
                {listing.description}
              </p>
            </div>

            {/* Amenities */}
            {listing.amenities?.length > 0 && (
              <div className="bg-white rounded-2xl border border-black/7 px-5 pb-5 pt-5">
                <div className="text-[10px] tracking-[0.1em] uppercase text-[#999] mb-4">
                  {t.amenities}
                </div>
                <div className="flex flex-wrap gap-2">
                  {listing.amenities.map((a, i) => (
                    <span
                      key={i}
                      className="bg-[#f7f6f2] px-3 py-[5px] rounded-2xl text-[12px] text-[#555]"
                    >
                      {a}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* House Rules */}
            {listing.rules?.length > 0 && (
              <div className="bg-white rounded-2xl border border-black/7 px-5 pb-5">
                <div className="border-t-[3px] border-[#e8c547] pt-5 mb-4">
                  <div className="text-[10px] tracking-[0.1em] uppercase text-[#999] mb-1.5">
                    {t.houseRules}
                  </div>
                </div>
                <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-3">
                  {listing.rules.map((rule, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-2.5 text-[13px] text-[#555] px-2 py-1.5 bg-[#fafaf8] rounded-lg"
                    >
                      <span className="w-5 h-5 rounded-full bg-[#FAEEDA] inline-flex items-center justify-center text-[10px] text-[#633806] flex-shrink-0">
                        ✓
                      </span>
                      {rule}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Cancellation Policy */}
            <CancellationPolicyCard
              policy={listing.cancellation_policy}
              isAr={isAr}
            />

            {/* Host */}
            <div className="bg-white rounded-2xl border border-black/7 px-5 pb-5 pt-5">
              <div className="text-[10px] tracking-[0.1em] uppercase text-[#999] mb-4">
                {t.hostedBy}
              </div>
              <div className="flex items-center gap-3.5">
                <div
                  className="w-11 h-11 rounded-full flex items-center justify-center text-[16px] font-medium flex-shrink-0"
                  style={{ background: hostAvi.bg, color: hostAvi.color }}
                >
                  {hostInitial}
                </div>
                <div>
                  <div className="text-[14px] font-medium text-[#111118]">
                    {listing.host?.name}
                  </div>
                  <div className="text-[11px] text-[#999] mt-0.5">
                    {t.hostSince}{" "}
                    {listing.host?.hostDetails?.joinedDate
                      ? new Date(
                          listing.host.hostDetails.joinedDate,
                        ).getFullYear()
                      : "2024"}
                  </div>
                </div>
              </div>
            </div>

            {/* Location */}
            {listing.latitude && listing.longitude && (
              <section className="bg-white rounded-2xl border border-black/5 overflow-hidden">
                <div className="p-5">
                  <div className="text-[10px] tracking-[0.1em] uppercase text-[#999] mb-2">
                    {isAr ? "الموقع" : "Location"}
                  </div>

                  <h3 className="text-lg font-semibold text-[#111118]">
                    {isAr ? "موقع العقار" : "Property location"}
                  </h3>

                  <p className="text-sm text-[#666] mt-1">{listing.location}</p>
                </div>

                <a
                  href={`https://www.google.com/maps?q=${encodeURIComponent(
                    `${listing.latitude},${listing.longitude}`,
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="relative block"
                  aria-label={
                    isAr
                      ? "فتح الموقع في خرائط Google"
                      : "Open location in Google Maps"
                  }
                >
                  <iframe
                    title={
                      isAr
                        ? "موقع العقار على الخريطة"
                        : "Property location on map"
                    }
                    src={`https://www.google.com/maps?q=${encodeURIComponent(
                      `${listing.latitude},${listing.longitude}`,
                    )}&z=15&output=embed`}
                    width="100%"
                    height="350"
                    style={{
                      border: 0,
                      display: "block",
                      pointerEvents: "none",
                    }}
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                    tabIndex={-1}
                  />

                  <span className="absolute bottom-4 left-4 bg-white/95 backdrop-blur-sm px-4 py-2 rounded-lg shadow-md text-xs font-medium text-[#1a1a2e] flex items-center gap-2">
                    <span>🗺️</span>
                    {isAr ? "فتح في خرائط Google" : "Open in Google Maps"}
                  </span>
                </a>

                <div className="p-5">
                  <div className="flex items-start gap-3 mb-4">
                    <div className="w-9 h-9 rounded-full bg-[#f7f6f2] flex items-center justify-center shrink-0">
                      <span className="text-lg">📍</span>
                    </div>

                    <div>
                      <div className="text-xs font-medium text-[#999] uppercase tracking-wide">
                        {isAr ? "العنوان" : "Address"}
                      </div>

                      <p className="text-sm text-[#111118] mt-1">
                        {listing.location}
                      </p>
                    </div>
                  </div>

                  <div className="text-[10px] text-[#999] mb-4">
                    {listing.latitude}, {listing.longitude}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <a
                      href={`https://www.google.com/maps?q=${encodeURIComponent(
                        `${listing.latitude},${listing.longitude}`,
                      )}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-[#1a1a2e] text-[#e8c547] text-xs font-medium hover:opacity-90 transition"
                    >
                      <span>🗺️</span>
                      {isAr ? "فتح في خرائط Google" : "Open in Google Maps"}
                    </a>

                    <a
                      href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
                        `${listing.latitude},${listing.longitude}`,
                      )}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-[#e8c547] text-[#1a1a2e] text-xs font-semibold hover:opacity-90 transition"
                    >
                      <span>🧭</span>
                      {isAr ? "احصل على الاتجاهات" : "Get directions"}
                    </a>
                  </div>
                </div>
              </section>
            )}
          </div>

          {/* ── RIGHT column ── */}
          <div>
            {!isAuthenticated ? (
              /* Guest: login prompt, no calendar */
              <div className="bg-white rounded-2xl border border-black/7 border-t-[3px] border-t-[#e8c547] px-6 py-6 text-center">
                <div className="text-4xl mb-3">🔒</div>
                <div
                  className={`font-light text-[18px] text-[#111118] mb-2 ${displayFontClass}`}
                >
                  {t.loginToBook}
                </div>
                <p className="text-[12px] text-[#666] leading-[1.6] mb-4">
                  {t.loginToBookDesc}
                </p>
                <Link
                  to="/login"
                  state={{ from: `/listings/${id}` }}
                  className="block w-full bg-[#e8c547] text-[#1a1a2e] px-4 py-3 rounded-[10px] text-[13px] font-semibold no-underline hover:opacity-90 transition"
                >
                  {t.logIn} →
                </Link>
                <Link
                  to="/signup"
                  state={{ from: `/listings/${id}` }}
                  className="block w-full mt-2 border border-black/10 text-[#111118] px-4 py-3 rounded-[10px] text-[13px] font-medium no-underline hover:bg-[#f7f6f2] transition"
                >
                  {t.createAccount}
                </Link>

                {listing.cancellation_policy && (
                  <div className="mt-4 text-start">
                    <CancellationPolicyMini
                      policy={listing.cancellation_policy}
                      isAr={isAr}
                    />
                  </div>
                )}
              </div>
            ) : canBook ? (
              /* Guest booking panel */
              <div className="bg-white rounded-2xl border border-black/7 border-t-[3px] border-t-[#e8c547] px-5 pb-5">
                <div className="flex items-baseline gap-1 mb-5 pt-4">
                  <span
                    className={`font-light text-[34px] text-[#111118] leading-none ${displayFontClass}`}
                  >
                    {formatCurrency(listing.price)}
                  </span>
                  <span className="text-[12px] text-[#999]">/ {t.night}</span>
                </div>

                {!listing.is_active && (
                  <div className="bg-[#FEF3C7] border border-[#D97706]/20 rounded-lg px-3 py-2.5 text-[12px] text-[#92400E] mb-4">
                    {t.listingUnavailable}
                  </div>
                )}

                <form
                  onSubmit={handleBooking}
                  className="flex flex-col gap-3.5"
                >
                  <div>
                    <label className="block text-[10px] tracking-[0.1em] uppercase text-[#888] mb-1.5">
                      {t.selectDates}
                    </label>
                    <BookingCalendar
                      unavailableDates={unavailableDates}
                      onDateSelect={(dates) => {
                        setBooking((prev) => ({ ...prev, ...dates }));
                        if (dates.checkIn && dates.checkOut) {
                          setBookingError("");
                        }
                      }}
                      checkIn={booking.checkIn}
                      checkOut={booking.checkOut}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    {[
                      [t.checkIn, booking.checkIn],
                      [t.checkOut, booking.checkOut],
                    ].map(([label, val]) => (
                      <div
                        key={label}
                        className="bg-[#f7f6f2] border border-black/7 rounded-lg px-3 py-2.5"
                      >
                        <div className="text-[10px] tracking-[0.08em] uppercase text-[#999] mb-[3px]">
                          {label}
                        </div>
                        <div
                          className={`text-[12px] ${val ? "text-[#111118]" : "text-[#bbb]"}`}
                        >
                          {val ? displayDate(val) : "—"}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div>
                    <label className="block text-[10px] tracking-[0.1em] uppercase text-[#888] mb-1.5">
                      {t.guests}
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="10"
                      required
                      value={booking.guests}
                      onChange={(e) =>
                        setBooking({
                          ...booking,
                          guests: parseInt(e.target.value) || 1,
                        })
                      }
                      className="w-full px-3.5 py-2.5 border border-black/12 rounded-lg text-[13px] font-[inherit] text-[#111118] bg-[#fafaf8] outline-none"
                    />
                  </div>

                  {nights > 0 && (
                    <div className="bg-[#f7f6f2] rounded-lg px-3 py-3 border border-black/7">
                      <div className="flex justify-between text-[12px] text-[#666] mb-2">
                        <span>
                          {formatCurrency(listing.price)} × {nights}{" "}
                          {nights === 1 ? t.night : t.nights}
                        </span>
                        <span>{formatCurrency(totalPrice)}</span>
                      </div>
                      <div className="flex justify-between text-[13px] font-medium text-[#111118] pt-2 border-t border-black/7">
                        <span>{t.total}</span>
                        <span className="text-[#1D9E75]">
                          {formatCurrency(totalPrice)}
                        </span>
                      </div>
                    </div>
                  )}

                  {listing.cancellation_policy && (
                    <CancellationPolicyMini
                      policy={listing.cancellation_policy}
                      isAr={isAr}
                    />
                  )}

                  {bookingError && (
                    <div className="bg-[#FCEBEB] border border-[#A32D2D]/15 rounded-lg px-3 py-2.5 text-[12px] text-[#791F1F]">
                      {bookingError}
                    </div>
                  )}
                  {bookingSuccess && (
                    <div className="bg-[#EAF3DE] border border-[#27500A]/15 rounded-lg px-3 py-2.5 text-[12px] text-[#27500A]">
                      {bookingSuccess}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={
                      !booking.checkIn ||
                      !booking.checkOut ||
                      isSubmitting ||
                      !listing.is_active
                    }
                    className="bg-[#e8c547] text-[#1a1a2e] px-3 py-3 rounded-[10px] text-[13px] font-semibold border-none cursor-pointer font-[inherit] transition-opacity hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSubmitting
                      ? isAr
                        ? "جاري المعالجة..."
                        : "Processing..."
                      : `${t.bookNow} →`}
                  </button>
                </form>
              </div>
            ) : isHost ? (
              /* Host management panel */
              <div className="bg-white rounded-2xl border border-black/7 border-t-[3px] border-t-[#7F77DD] px-5 pb-5">
                <div className="pt-4 text-center mb-5">
                  <div className="w-12 h-12 rounded-full bg-[#EEEDFE] flex items-center justify-center mx-auto mb-3 text-[22px]">
                    🏠
                  </div>
                  <div
                    className={`font-light text-[18px] text-[#111118] mb-1.5 ${displayFontClass}`}
                  >
                    {t.youOwnThisProperty}
                  </div>
                  <p className="text-[12px] text-[#999] leading-[1.6]">
                    {t.cannotBookOwnListing}
                  </p>
                </div>

                <div className="mb-4 px-1">
                  <div className="flex items-center justify-between bg-[#f7f6f2] rounded-xl px-4 py-3 border border-black/7">
                    <div>
                      <div className="text-[12px] font-medium text-[#111118]">
                        {listing.is_active
                          ? t.listingActive
                          : t.listingInactive}
                      </div>
                      <div className="text-[11px] text-[#999] mt-0.5">
                        {listing.is_active
                          ? t.listingActiveDesc
                          : t.listingInactiveDesc}
                      </div>
                    </div>
                    <button
                      onClick={handleToggleActive}
                      disabled={isTogglingActive}
                      className={`relative w-11 h-6 rounded-full transition-colors duration-200 border-none cursor-pointer flex-shrink-0 disabled:opacity-50 ${
                        listing.is_active ? "bg-[#1D9E75]" : "bg-[#ddd]"
                      }`}
                    >
                      <span
                        className={`absolute top-[3px] w-[18px] h-[18px] rounded-full bg-white shadow-sm transition-all duration-200 ${
                          listing.is_active ? "left-[22px]" : "left-[3px]"
                        }`}
                      />
                    </button>
                  </div>
                </div>

                <div className="border-t border-black/7 pt-4">
                  <BookingCalendar
                    unavailableDates={unavailableDates}
                    onDateSelect={() => {}}
                    checkIn=""
                    checkOut=""
                    isHost={true}
                  />
                  <HostDateManager
                    listingId={listing.id}
                    blockedDates={
                      listing.blocked_dates || listing.blockedDates || []
                    }
                    bookings={listing.bookings || []}
                    onDatesUpdated={fetchListing}
                  />
                </div>

                <div className="mt-5 pt-4 border-t border-black/7 text-center">
                  <Link
                    to="/host/bookings"
                    className="text-[12px] text-[#185FA5] no-underline"
                  >
                    {t.viewAllBookings} →
                  </Link>
                </div>
              </div>
            ) : (
              /* Admin view */
              <div className="bg-white rounded-2xl border border-black/7 border-t-[3px] border-t-[#999] px-6 py-6 text-center">
                <div className="text-5xl mb-3">👑</div>
                <div
                  className={`font-light text-[18px] text-[#111118] mb-2 ${displayFontClass}`}
                >
                  {t.adminViewOnly}
                </div>
                <p className="text-[12px] text-[#666] leading-[1.6]">
                  {t.adminCannotBookOrBlock}
                </p>
                <Link
                  to="/admin"
                  className="inline-block mt-4 text-[12px] text-[#185FA5] no-underline"
                >
                  {t.goToAdminPanel} →
                </Link>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}