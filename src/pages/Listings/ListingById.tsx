// src/pages/ListingDetail/index.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useLanguage } from "../../hooks/useLanguage";
import Navbar from "../../components/Navbar";
import { apiService } from "../../services/api";
import HostDateManager from "../../components/HostDateManager";
import ListingQRCode from "../../components/ListingQRCode";
import { log } from "console";

/* ==========================================================================
   CONSTANTS
========================================================================== */

const API_BASE =
  import.meta.env.VITE_API_URL || "https://api.mar-haba.ly/api/v1";

/* ==========================================================================
   TYPES
========================================================================== */

interface BlockedRange {
  startDate: string;
  endDate: string;
  reason?: string;
  id: string;
}

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

  blocked_dates?: BlockedRange[];
  blockedDates?: BlockedRange[];

  bookings?: { check_in: string; check_out: string; status: string }[];

  host: {
    id: string;
    name: string;
    email: string;
    phone_number: string;
    hostDetails?: { totalListings: number; joinedDate?: string };
  };
}

interface BookingData {
  checkIn: string;
  checkOut: string;
  guests: number;
}

/* ==========================================================================
   STATIC CONFIG
========================================================================== */

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
    browse: "Listings",
    backToListings: "Back to listings",
    about: "About",
    amenities: "Amenities",
    houseRules: "House Rules",
    hostedBy: "Hosted by",
    hostSince: "Host since",
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
    loginToBook: "Log in to book",
    loginToBookDesc:
      "You need an account to select dates and complete a booking.",
    logIn: "Log in",
    createAccount: "Create account",
  },
  ar: {
    browse: "القوائم",
    backToListings: "العودة إلى القوائم",
    about: "الوصف",
    amenities: "وسائل الراحة",
    houseRules: "قواعد المنزل",
    hostedBy: "المضيف",
    hostSince: "مضيف منذ",
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
    loginToBook: "سجّل الدخول للحجز",
    loginToBookDesc: "تحتاج إلى حساب لتحديد التواريخ وإتمام الحجز.",
    logIn: "تسجيل الدخول",
    createAccount: "إنشاء حساب",
  },
};

/* ==========================================================================
   HELPERS
========================================================================== */

const fromDateString = (dateString: string): Date | null => {
  if (!dateString) return null;
  const [year, month, day] = dateString.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
};

const displayDate = (dateString: string, isAr = false): string => {
  if (!dateString) return "";
  const [year, month, day] = dateString.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString(
    isAr ? "ar-LY" : "en-US",
    {
      month: "short",
      day: "numeric",
      timeZone: "UTC",
    },
  );
};

const createLocalDate = fromDateString;

const toKey = (d: Date) =>
  `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;

const getAvatar = (name?: string) =>
  AVATAR_PAL[(name?.charCodeAt(0) ?? 0) % AVATAR_PAL.length];

const getInitials = (name?: string) =>
  name
    ?.split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() || "H";

const Skeleton = ({ className = "" }: { className?: string }) => (
  <div className={`animate-pulse rounded-lg bg-gray-200/80 ${className}`} />
);

const Spinner = () => (
  <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
);

const SectionCard = ({
  title,
  id,
  accent,
  children,
}: {
  title: string;
  id?: string;
  accent?: string;
  children: React.ReactNode;
}) => (
  <section
    id={id}
    className="scroll-mt-20 overflow-hidden rounded-2xl bg-white shadow-sm"
  >
    {accent && <div className="h-[3px]" style={{ background: accent }} />}
    <div className="p-4">
      <h2 className="mb-3 text-base font-bold text-gray-900">{title}</h2>
      {children}
    </div>
  </section>
);

/* ==========================================================================
   BOOKING CALENDAR
========================================================================== */

function BookingCalendar({
  unavailableDates,
  pendingDates = [],
  onDateSelect,
  checkIn,
  checkOut,
  isHost = false,
  isAr = false,
}: {
  unavailableDates: string[];
  pendingDates?: string[];
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
    if (checkIn && !checkOut) setSelectingCheckOut(true);
    else if (!checkIn && !checkOut) setSelectingCheckOut(false);
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
  for (let i = 0; i < firstDay; i++) calendarDays.push(null);
  for (let day = 1; day <= daysInMonth; day++)
    calendarDays.push(new Date(year, month, day));

  const unavailableSet = new Set(unavailableDates);
  const pendingSet = new Set(pendingDates);

  const isPast = (date: Date) => {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d < today;
  };

  const isUnavailable = (date: Date) => unavailableSet.has(formatKey(date));
  const isAvailable = (date: Date) => !isPast(date) && !isUnavailable(date);
  const isBeforeCheckIn = (date: Date) =>
    checkIn ? formatKey(date) < checkIn : false;
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

  const changeMonth = (amount: number) =>
    setCurrentMonth(
      new Date(currentMonth.getFullYear(), currentMonth.getMonth() + amount, 1),
    );

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

  return (
    <div
      className="overflow-hidden rounded-xl border border-gray-200 bg-white"
      dir={isAr ? "rtl" : "ltr"}
    >
      {/* Header */}
      <div className="border-b border-gray-100 px-4 pb-3 pt-4">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => changeMonth(-1)}
            disabled={!canGoPrevious()}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 bg-white text-lg text-gray-600 transition active:scale-95 disabled:cursor-not-allowed disabled:opacity-30"
            aria-label={isAr ? "الشهر السابق" : "Previous month"}
          >
            {isAr ? "›" : "‹"}
          </button>

          <div className="text-[15px] font-semibold text-gray-900">
            {monthNames[month]} {year}
          </div>

          <button
            type="button"
            onClick={() => changeMonth(1)}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 bg-white text-lg text-gray-600 transition active:scale-95"
            aria-label={isAr ? "الشهر التالي" : "Next month"}
          >
            {isAr ? "‹" : "›"}
          </button>
        </div>

        {/* Hint only. The chosen dates are shown once, in the Check-in / Check-out boxes below. */}
        {!isHost && (
          <div className="mt-3 text-center text-xs">
            {!checkIn && !checkOut ? (
              <span className="text-gray-500">
                {isAr ? "اختر تاريخ تسجيل الوصول" : "Select your check-in date"}
              </span>
            ) : checkIn && !checkOut ? (
              <span className="font-medium text-blue-700">
                {isAr
                  ? "الآن اختر تاريخ تسجيل المغادرة"
                  : "Now select your check-out date"}
              </span>
            ) : (
              <span className="font-medium text-emerald-700">
                {isAr
                  ? "اضغط على تاريخ لتغيير اختيارك"
                  : "Tap a date to change your selection"}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Week days */}
      <div className="grid grid-cols-7 px-2 pt-3">
        {weekDays.map((day) => (
          <div
            key={day}
            className="py-1 text-center text-[10px] font-medium uppercase tracking-wide text-gray-400"
          >
            {day}
          </div>
        ))}
      </div>

      {/* Grid */}
      <div className="grid grid-cols-7 gap-y-1 px-2 pb-4 pt-1">
        {calendarDays.map((date, index) => {
          if (!date) return <div key={`empty-${index}`} className="h-11" />;

          const key = formatKey(date);
          const past = isPast(date);
          const unavailable = isUnavailable(date);
          const available = isAvailable(date);
          const pending = pendingSet.has(key);
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
              className="relative flex h-11 items-center justify-center"
            >
              {inRange && (
                <div className="absolute inset-y-1 left-0 right-0 bg-[#FEF3C7]" />
              )}

              <button
                type="button"
                disabled={disabled}
                onClick={() => handleDateClick(date)}
                title={
                  unavailable || past
                    ? isAr
                      ? "حجز قيد الانتظار"
                      : "Pending booking"
                    : unavailable || past
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
                 relative z-10 flex h-10 w-10 items-center justify-center rounded-full text-[13px]
transition-all duration-150

${past ? "cursor-not-allowed text-[#ccc]" : ""}

${unavailable
  ? "cursor-not-allowed bg-[#f1f1ee] text-[#c4c4c4] after:absolute after:bottom-[2px] after:left-1/2 after:-translate-x-1/2 after:z-20 after:h-1.5 after:w-1.5 after:rounded-full after:bg-orange-500 after:content-['']"
  : ""}

${
  pending && !selected
    ? "cursor-not-allowed bg-orange-100 font-semibold text-orange-800"
    : ""
}

${beforeCheckIn && selectingCheckOut ? "cursor-not-allowed text-[#ccc]" : ""}

${selected ? "bg-[#e8c547] font-semibold text-[#1a1a2e] shadow-sm" : ""}

${
  !selected && !disabled && !inRange
    ? "cursor-pointer text-[#333] active:bg-gray-100"
    : ""
}

${!selected && inRange ? "cursor-pointer text-[#633806]" : ""}

${
  todayDate && !selected ? "font-semibold ring-1 ring-inset ring-[#e8c547]" : ""
}
                `}
              >
                {date.getDate()}
              </button>

              {pending ? (
                <span className="absolute bottom-[2px] h-1.5 w-1.5 rounded-full bg-orange-500" />
              ) : unavailable ? (
                <span className="absolute bottom-[2px] h-1 w-1 rounded-full bg-[#d66]" />
              ) : null}
              {available && !selected && !past && !unavailable && (
                <span className="absolute bottom-[2px] h-1 w-1 rounded-full bg-[#1D9E75]" />
              )}
            </div>
          );
        })}
      </div>

      {/* Legend */}
      {!isHost && (
        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 border-t border-gray-100 px-3 py-3 text-[11px] text-gray-500">
          <div className="flex items-center gap-1.5">
            <span className="flex h-3 w-3 items-center justify-center rounded-full border border-[#1D9E75]/20 bg-[#EAF3DE]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#1D9E75]" />
            </span>
            <span>{isAr ? "متاح" : "Available"}</span>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="flex h-3 w-3 items-center justify-center rounded-full border border-black/5 bg-[#f1f1ee]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#d66]" />
            </span>
            <span>{isAr ? "محجوز" : "Unavailable"}</span>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-full bg-orange-100 ring-1 ring-orange-300" />
            <span>{isAr ? "حجز قيد الانتظار" : "Pending booking"}</span>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-full bg-[#e8c547]" />
            <span>{isAr ? "محدد" : "Selected"}</span>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-full ring-1 ring-[#e8c547]" />
            <span>{isAr ? "اليوم" : "Today"}</span>
          </div>
        </div>
      )}

      {isHost && (
        <div className="border-t border-gray-100 px-4 py-3 text-center text-xs text-gray-500">
          {isAr
            ? "📅 إدارة الحجوزات والتواريخ المحجوزة أدناه"
            : "📅 Manage bookings and blocked dates below"}
        </div>
      )}
    </div>
  );
}

/* ==========================================================================
   CANCELLATION POLICY
========================================================================== */

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
  const description = isAr
    ? policy.descriptionAr || policy.description
    : policy.description;
  const rules = policy.rulePairs
    ? policy.rulePairs.map((p) => (isAr ? p.ar : p.en)).filter(Boolean)
    : policy.rules || [];

  return (
    <SectionCard
      id="cancellation-policy"
      title={isAr ? "سياسة الإلغاء" : "Cancellation Policy"}
      accent="#e8c547"
    >
      <div
        className="mb-3 inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold"
        style={{ background: meta.bg, color: meta.color }}
      >
        <span>{meta.icon}</span>
        <span>{label}</span>
      </div>

      {description && (
        <p className="mb-3 text-sm italic leading-relaxed text-gray-600">
          {description}
        </p>
      )}

      {rules.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {rules.map((rule, i) => (
            <li
              key={i}
              className="flex items-start gap-2.5 text-sm text-gray-600"
            >
              <span
                className="mt-0.5 flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full"
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
          <p className="text-sm italic text-gray-400">
            {isAr
              ? "تواصل مع المضيف للاستفسار عن شروط الإلغاء."
              : "Contact the host for cancellation terms."}
          </p>
        )
      )}
    </SectionCard>
  );
}

// One-line pointer to the full policy (the full text is shown once, in the card on the page)
function CancellationPolicyLink({
  policy,
  isAr,
  onClick,
}: {
  policy: Listing["cancellation_policy"];
  isAr: boolean;
  onClick: () => void;
}) {
  if (!policy) return null;

  const meta = POLICY_META[policy.type] ?? POLICY_META.custom;
  const label = isAr ? meta.labelAr : meta.labelEn;

  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center justify-between rounded-xl px-3.5 py-3 text-start text-xs font-semibold"
      style={{ background: meta.bg, color: meta.color }}
    >
      <span>
        {meta.icon} {label} {isAr ? "سياسة الإلغاء" : "cancellation"}
      </span>
      <span className="underline">{isAr ? "عرض السياسة" : "View policy"}</span>
    </button>
  );
}

/* ==========================================================================
   MAIN COMPONENT
========================================================================== */

export default function ListingDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const { lang, toggleLanguage } = useLanguage();
  const isAr = lang === "ar";
  const t = translations[isAr ? "ar" : "en"];

  const [listing, setListing] = useState<Listing | null>(null);
  const [unavailableDates, setUnavailableDates] = useState<string[]>([]);
  const [pendingDates, setPendingDates] = useState<string[]>([]);
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
  const [sheetOpen, setSheetOpen] = useState(false);

  const galleryRef = useRef<HTMLDivElement | null>(null);

  /* --------------------- Fetch listing (public endpoint) -------------------- */

  // silent = refresh without bringing the skeletons back
  const fetchListing = async (silent = false) => {
    if (!id) return;

    if (!silent) setLoading(true);
    setError(null);

    try {
      // Public endpoint: works for guests and logged-in users. When logged in, the
      // Authorization header lets the backend return personalised fields.
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      const token = localStorage.getItem("tokens");
      if (token) {
        try {
          const parsed = JSON.parse(token);
          if (parsed?.accessToken)
            headers.Authorization = `Bearer ${parsed.accessToken}`;
        } catch {
          /* ignore malformed storage */
        }
      }

      const res = await fetch(`${API_BASE}/listings/${id}`, { headers });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const response = await res.json();
      const listingData = response?.data?.data ?? response?.data ?? response;
      console.log("listing", listingData);

      if (!listingData || !listingData.id) {
        setError(isAr ? "تعذر تحميل القائمة" : "Failed to load listing");
        return;
      }

      setListing(listingData);

      // Unavailable dates: bookings block check-in through the night before check-out
      const unavailable = new Set<string>();
      const pending = new Set<string>();

      if (Array.isArray(listingData.bookings)) {
        listingData.bookings.forEach((b: any) => {
          if (!b.check_in || !b.check_out) return;

          const status = String(b.status || "").toLowerCase();

          // Cancelled/rejected bookings should not block dates
          if (["cancelled", "canceled", "rejected"].includes(status)) {
            return;
          }

          const start = fromDateString(b.check_in.slice(0, 10));
          const end = fromDateString(b.check_out.slice(0, 10));

          if (!start || !end || start >= end) return;

          const cursor = new Date(start);

          // Check-out date is not blocked
          while (cursor < end) {
            const key = toKey(cursor);

            unavailable.add(key);

            if (status === "pending") {
              pending.add(key);
            }

            cursor.setUTCDate(cursor.getUTCDate() + 1);
          }
        });
      }

      // Host-blocked date ranges
      const blockedRanges = Array.isArray(listingData.blocked_dates)
        ? listingData.blocked_dates
        : Array.isArray(listingData.blockedDates)
          ? listingData.blockedDates
          : [];

      blockedRanges.forEach((blocked: any) => {
        if (!blocked.startDate || !blocked.endDate) return;

        const start = fromDateString(blocked.startDate);
        const end = fromDateString(blocked.endDate);

        if (!start || !end || start >= end) return;

        const cursor = new Date(start);

        while (cursor < end) {
          unavailable.add(toKey(cursor));
          cursor.setUTCDate(cursor.getUTCDate() + 1);
        }
      });

      setUnavailableDates(Array.from(unavailable));
      setPendingDates(Array.from(pending));
    } catch (err) {
      console.error("Error fetching listing:", err);
      setError(isAr ? "حدث خطأ أثناء تحميل القائمة" : "Error loading listing");
    } finally {
      setLoading(false);
    }
  };

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
      // Non-fatal: the page works without the view counter
      console.error("Error updating view count:", err);
    }
  };

  /* -------------------------------- Effects -------------------------------- */

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

  const nights = useMemo(() => {
    if (!booking.checkIn || !booking.checkOut) return 0;
    const n = Math.ceil(
      (createLocalDate(booking.checkOut)!.getTime() -
        createLocalDate(booking.checkIn)!.getTime()) /
        86400000,
    );
    return n > 0 ? n : 0;
  }, [booking.checkIn, booking.checkOut]);

  useEffect(() => {
    setTotalPrice(listing && nights > 0 ? listing.price * nights : 0);
  }, [nights, listing]);

  // Lock page scroll while the booking sheet is open (mobile)
  useEffect(() => {
    if (!sheetOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [sheetOpen]);

  /* ------------------------------- Handlers -------------------------------- */

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
          await fetchListing(true);
        } catch (refreshError) {
          console.error("Failed to refresh listing:", refreshError);
        }

        setTimeout(() => navigate("/user-dashboard"), 2000);
        return;
      }

      setBookingError(
        response?.message ||
          response?.error ||
          response?.data?.message ||
          response?.data?.error ||
          (isAr ? "فشل إنشاء الحجز." : "Failed to create booking."),
      );
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
        {
          is_active: !listing?.is_active,
        },
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

  const goToPolicy = () => {
    setSheetOpen(false);
    window.setTimeout(() => {
      document
        .getElementById("cancellation-policy")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 50);
  };

  const onGalleryScroll = () => {
    const el = galleryRef.current;
    if (!el || !el.clientWidth) return;
    setActiveImage(Math.round(Math.abs(el.scrollLeft) / el.clientWidth));
  };

  /* ------------------------------ Page chrome ------------------------------ */

  const fontClass = isAr ? "font-arabic" : "font-sans";

  // Hosts get the same bottom tab bar as the other host pages (Home / Listings / Bookings / Settings).
  // Based on the account role (not the listing) so the bar shows immediately, even while loading.
  const isHostRole = String(user?.role || "").toLowerCase() === "host";

  const navLinks = isHostRole
    ? [
        { id: "browse", label: t.browse, href: "/listings" },
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
      ]
    : [{ id: "browse", label: t.browse, href: "/listings" }];

  // Leave room at the bottom for the tab bar (and the booking bar above it)
  const mainPad = isHostRole ? "pb-44" : "pb-28";

  const navbar = (
    <Navbar
      NAV_LINKS={navLinks}
      user={user}
      lang={lang}
      toggleLanguage={toggleLanguage}
      defaultActiveId={isHostRole ? "listings" : undefined}
    />
  );

  /* ------------------------------ Error state ------------------------------ */

  if (!loading && (error || !listing)) {
    return (
      <div
        className={`min-h-screen bg-gray-50 ${fontClass}`}
        dir={isAr ? "rtl" : "ltr"}
      >
        {navbar}
        <div className={`mx-auto max-w-md p-6 ${isHostRole ? "pb-28" : ""}`}>
          <div className="rounded-2xl bg-white p-8 text-center shadow-sm">
            <div className="mb-4 text-5xl">🏠</div>
            <h2 className="mb-2 text-xl font-bold text-gray-900">
              {error || t.listingNotFound}
            </h2>
            <Link
              to="/listings"
              className="mt-4 inline-block rounded-xl bg-[#1a1a2e] px-6 py-3 text-sm font-semibold text-[#e8c547] no-underline"
            >
              {t.backToListings} →
            </Link>
          </div>
        </div>
      </div>
    );
  }

  /* ------------------------------ Loading state ---------------------------- */
  // The page shell shows immediately; each block fills in when the data arrives.

  if (loading || !listing) {
    return (
      <div
        className={`min-h-screen bg-gray-50 ${fontClass}`}
        dir={isAr ? "rtl" : "ltr"}
      >
        {navbar}

        <main
          className={`mx-auto max-w-[1100px] px-4 ${mainPad} pt-4 md:px-6 md:py-7`}
        >
          <Link
            to="/listings"
            className="mb-3 inline-flex items-center gap-1 text-sm text-gray-500 no-underline"
          >
            ← {t.backToListings}
          </Link>

          <Skeleton className="-mx-4 h-64 rounded-none md:mx-0 md:h-[380px] md:rounded-2xl" />

          <div className="mt-4 space-y-3">
            <Skeleton className="h-6 w-24 rounded-full" />
            <Skeleton className="h-9 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </div>

          <div className="mt-5 grid grid-cols-1 items-start gap-5 md:grid-cols-[1fr_360px]">
            <div className="space-y-4">
              <Skeleton className="h-40 w-full rounded-2xl" />
              <Skeleton className="h-24 w-full rounded-2xl" />
              <Skeleton className="h-32 w-full rounded-2xl" />
            </div>
            <Skeleton className="hidden h-96 w-full rounded-2xl md:block" />
          </div>
        </main>
      </div>
    );
  }

  /* ------------------------------ Derived data ----------------------------- */

  const categoryInfo = listing.category
    ? CATEGORIES.find((c) => c.id === listing.category)
    : null;
  const hostAvi = getAvatar(listing.host?.name);
  const hostInitial = getInitials(listing.host?.name);
  const images = (listing.images ?? []).filter(Boolean);
  const isGuestBooker = isAuthenticated && !isHost && !isAdmin;
  const hasMap = !!(listing.latitude && listing.longitude);
  const mapQuery = encodeURIComponent(
    `${listing.latitude},${listing.longitude}`,
  );

  /* ----------------------------- Right-hand panel -------------------------- */

  const panel = authLoading ? (
    <div className="space-y-3 rounded-2xl bg-white p-5 shadow-sm">
      <Skeleton className="h-9 w-1/2" />
      <Skeleton className="h-64 w-full" />
      <Skeleton className="h-12 w-full" />
    </div>
  ) : !isAuthenticated ? (
    /* Guest: login prompt, no calendar */
    <div className="overflow-hidden rounded-2xl bg-white text-center shadow-sm">
      <div className="h-[3px] bg-[#e8c547]" />
      <div className="px-6 py-6">
        <div className="mb-3 text-4xl">🔒</div>
        <div className="mb-2 text-lg font-bold text-gray-900">
          {t.loginToBook}
        </div>
        <p className="mb-4 text-sm leading-relaxed text-gray-600">
          {t.loginToBookDesc}
        </p>
        <Link
          to="/login"
          state={{ from: `/listings/${id}` }}
          className="flex min-h-[48px] w-full items-center justify-center rounded-xl bg-[#e8c547] text-sm font-semibold text-[#1a1a2e] no-underline active:scale-[0.98]"
        >
          {t.logIn} →
        </Link>
        <Link
          to="/signup"
          state={{ from: `/listings/${id}` }}
          className="mt-2 flex min-h-[48px] w-full items-center justify-center rounded-xl border border-gray-200 text-sm font-medium text-gray-900 no-underline active:scale-[0.98]"
        >
          {t.createAccount}
        </Link>
      </div>
    </div>
  ) : isGuestBooker ? (
    /* Guest booking panel */
    <div className="overflow-hidden rounded-2xl bg-white shadow-sm">
      <div className="h-[3px] bg-[#e8c547]" />
      <div className="px-4 pb-5 pt-4">
        <div className="mb-4 flex items-baseline gap-1">
          <span className="text-3xl font-bold leading-none text-gray-900">
            {formatCurrency(listing.price)}
          </span>
          <span className="text-sm text-gray-500">/ {t.night}</span>
        </div>

        {!listing.is_active && (
          <div className="mb-4 rounded-xl bg-amber-50 px-3.5 py-3 text-sm text-amber-800">
            {t.listingUnavailable}
          </div>
        )}

        <form onSubmit={handleBooking} className="flex flex-col gap-4">
          <div>
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-gray-500">
              {t.selectDates}
            </label>
            <BookingCalendar
              unavailableDates={unavailableDates}
              pendingDates={pendingDates}
              onDateSelect={(dates) => {
                setBooking((prev) => ({ ...prev, ...dates }));
                if (dates.checkIn && dates.checkOut) setBookingError("");
              }}
              checkIn={booking.checkIn}
              checkOut={booking.checkOut}
              isAr={isAr}
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            {[
              [t.checkIn, booking.checkIn],
              [t.checkOut, booking.checkOut],
            ].map(([label, val]) => (
              <div key={label} className="rounded-xl bg-gray-50 px-3 py-2.5">
                <div className="mb-0.5 text-[10px] font-medium uppercase tracking-wide text-gray-400">
                  {label}
                </div>
                <div
                  className={`text-sm font-medium ${val ? "text-gray-900" : "text-gray-300"}`}
                >
                  {val ? displayDate(val, isAr) : "—"}
                </div>
              </div>
            ))}
          </div>

          {/* Guests stepper */}
          <div className="flex items-center justify-between rounded-xl bg-gray-50 px-3.5 py-2.5">
            <span className="text-sm font-medium text-gray-700">
              {t.guests}
            </span>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() =>
                  setBooking((b) => ({
                    ...b,
                    guests: Math.max(1, b.guests - 1),
                  }))
                }
                disabled={booking.guests <= 1}
                aria-label="-"
                className="flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 bg-white text-xl text-gray-700 active:scale-95 disabled:opacity-40"
              >
                −
              </button>
              <span className="w-6 text-center text-base font-semibold">
                {booking.guests}
              </span>
              <button
                type="button"
                onClick={() =>
                  setBooking((b) => ({
                    ...b,
                    guests: Math.min(10, b.guests + 1),
                  }))
                }
                disabled={booking.guests >= 10}
                aria-label="+"
                className="flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 bg-white text-xl text-gray-700 active:scale-95 disabled:opacity-40"
              >
                +
              </button>
            </div>
          </div>

          {/* Price breakdown (the nightly rate × nights, then one total) */}
          {nights > 0 && (
            <div className="rounded-xl bg-gray-50 px-3.5 py-3">
              <div className="mb-2 text-sm text-gray-600">
                {formatCurrency(listing.price)} × {nights}{" "}
                {nights === 1 ? t.night : t.nights}
              </div>
              <div className="flex items-center justify-between border-t border-gray-200 pt-2 text-sm font-semibold text-gray-900">
                <span>{t.total}</span>
                <span className="text-base text-emerald-700">
                  {formatCurrency(totalPrice)}
                </span>
              </div>
            </div>
          )}

          <CancellationPolicyLink
            policy={listing.cancellation_policy}
            isAr={isAr}
            onClick={goToPolicy}
          />

          {bookingError && (
            <div className="rounded-xl bg-red-50 px-3.5 py-3 text-sm text-red-800">
              {bookingError}
            </div>
          )}
          {bookingSuccess && (
            <div className="rounded-xl bg-emerald-50 px-3.5 py-3 text-sm text-emerald-800">
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
            className="flex min-h-[52px] items-center justify-center gap-2 rounded-xl bg-[#e8c547] text-base font-bold text-[#1a1a2e] transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSubmitting ? (
              <>
                <Spinner />
                {isAr ? "جاري المعالجة..." : "Processing..."}
              </>
            ) : (
              `${t.bookNow} →`
            )}
          </button>
        </form>
      </div>
    </div>
  ) : isHost ? (
    /* Host management panel */
    <div className="overflow-hidden rounded-2xl bg-white shadow-sm">
      <div className="h-[3px] bg-[#7F77DD]" />
      <div className="px-4 pb-5 pt-4">
        <div className="mb-5 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[#EEEDFE] text-[22px]">
            🏠
          </div>
          <div className="mb-1 text-lg font-bold text-gray-900">
            {t.youOwnThisProperty}
          </div>
          <p className="text-sm leading-relaxed text-gray-500">
            {t.cannotBookOwnListing}
          </p>
        </div>

        <div className="mb-4 flex items-center justify-between rounded-xl bg-gray-50 px-4 py-3">
          <div className="min-w-0">
            <div className="text-sm font-semibold text-gray-900">
              {listing.is_active ? t.listingActive : t.listingInactive}
            </div>
            <div className="mt-0.5 text-xs text-gray-500">
              {listing.is_active ? t.listingActiveDesc : t.listingInactiveDesc}
            </div>
          </div>

          <button
            type="button"
            role="switch"
            aria-checked={listing.is_active}
            onClick={handleToggleActive}
            disabled={isTogglingActive}
            className={`relative h-7 w-12 shrink-0 rounded-full transition-colors disabled:opacity-50 ${
              listing.is_active ? "bg-emerald-500" : "bg-gray-300"
            }`}
          >
            <span
              className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all ${
                listing.is_active ? "start-[22px]" : "start-0.5"
              }`}
            />
          </button>
        </div>

        <div className="border-t border-gray-100 pt-4">
          <BookingCalendar
            unavailableDates={unavailableDates}
            pendingDates={pendingDates}
            onDateSelect={() => {}}
            checkIn=""
            checkOut=""
            isHost={true}
            isAr={isAr}
          />
          <HostDateManager
            listingId={listing.id}
            blockedDates={listing.blocked_dates || listing.blockedDates || []}
            bookings={listing.bookings || []}
            onDatesUpdated={() => fetchListing(true)}
          />
        </div>

        <div className="mt-5 border-t border-gray-100 pt-4 text-center">
          <Link
            to="/host/bookings"
            className="text-sm font-medium text-blue-700 no-underline"
          >
            {t.viewAllBookings} →
          </Link>
        </div>
      </div>
    </div>
  ) : (
    /* Admin view */
    <div className="overflow-hidden rounded-2xl bg-white text-center shadow-sm">
      <div className="h-[3px] bg-gray-400" />
      <div className="px-6 py-6">
        <div className="mb-3 text-5xl">👑</div>
        <div className="mb-2 text-lg font-bold text-gray-900">
          {t.adminViewOnly}
        </div>
        <p className="text-sm leading-relaxed text-gray-600">
          {t.adminCannotBookOrBlock}
        </p>
        <Link
          to="/admin"
          className="mt-4 inline-block text-sm font-medium text-blue-700 no-underline"
        >
          {t.goToAdminPanel} →
        </Link>
      </div>
    </div>
  );

  /* The panel opens as a bottom sheet on phones for guests, bookers and hosts */
  const usesSheet =
    !authLoading && (!isAuthenticated || isGuestBooker || isHost);
  const showAdminInline =
    !authLoading && isAuthenticated && !isHost && !isGuestBooker;

  /* ---------------------------------- Render ------------------------------- */

  return (
    <div
      className={`min-h-screen bg-gray-50 text-gray-900 ${fontClass}`}
      dir={isAr ? "rtl" : "ltr"}
    >
      {navbar}

      <main
        className={`mx-auto max-w-[1100px] px-4 ${mainPad} pt-4 md:px-6 md:pb-12 md:pt-7`}
      >
        {/* Back */}
        <Link
          to="/listings"
          className="mb-3 inline-flex items-center gap-1 text-sm text-gray-500 no-underline"
        >
          ← {t.backToListings}
        </Link>

        {/* ================= Gallery ================= */}
        <div className="mb-5">
          {images.length === 0 ? (
            <div className="-mx-4 flex h-64 items-center justify-center bg-gray-200 text-5xl md:mx-0 md:h-[380px] md:rounded-2xl">
              🏠
            </div>
          ) : (
            <>
              {/* Mobile: swipeable carousel */}
              <div className="relative -mx-4 md:hidden">
                <div
                  ref={galleryRef}
                  onScroll={onGalleryScroll}
                  className="flex snap-x snap-mandatory overflow-x-auto scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                >
                  {images.map((img, i) => (
                    <img
                      key={i}
                      src={img}
                      alt={`${listing.title} ${i + 1}`}
                      className="h-64 w-full shrink-0 snap-center object-cover"
                    />
                  ))}
                </div>

                {images.length > 1 && (
                  <span className="absolute bottom-3 end-3 rounded-full bg-black/60 px-2.5 py-1 text-xs font-medium text-white">
                    {Math.min(activeImage + 1, images.length)} / {images.length}
                  </span>
                )}
              </div>

              {/* Desktop: large image + thumbnails */}
              <div className="hidden md:block">
                <div className="mb-2.5 h-[380px] overflow-hidden rounded-2xl bg-gray-200">
                  <img
                    src={images[Math.min(activeImage, images.length - 1)]}
                    alt={listing.title}
                    className="block h-full w-full object-cover transition-opacity duration-200"
                  />
                </div>

                {images.length > 1 && (
                  <div className="flex gap-2 overflow-x-auto pb-1">
                    {images.map((img, i) => (
                      <img
                        key={i}
                        src={img}
                        alt={`view ${i + 1}`}
                        onClick={() => setActiveImage(i)}
                        className={`h-[70px] w-[70px] cursor-pointer rounded-lg border-2 object-cover transition-all ${
                          i === activeImage
                            ? "border-[#e8c547] opacity-100"
                            : "border-transparent opacity-60"
                        }`}
                      />
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* ================= Title block ================= */}
        <div className="mb-5">
          {categoryInfo && (
            <div className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-white px-3.5 py-1.5 text-sm text-gray-600 shadow-sm">
              <span className="text-lg">{categoryInfo.icon}</span>
              <span>{isAr ? categoryInfo.labelAr : categoryInfo.labelEn}</span>
            </div>
          )}

          <h1 className="mb-2 text-[clamp(24px,5vw,36px)] font-bold leading-tight text-gray-900">
            {listing.title}
          </h1>

          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-col gap-1.5 text-sm text-gray-500">
              <div className="flex items-center gap-1.5">
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 12 12"
                  fill="none"
                  className="shrink-0"
                >
                  <path
                    d="M6 1C4.07 1 2.5 2.57 2.5 4.5c0 2.78 3.5 6.5 3.5 6.5s3.5-3.72 3.5-6.5C9.5 2.57 7.93 1 6 1zm0 5a1.5 1.5 0 110-3 1.5 1.5 0 010 3z"
                    fill="#bbb"
                  />
                </svg>
                {listing.location}
              </div>

              <div className="flex items-center gap-1.5">
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

            {/* QR code: scans to this exact listing URL */}
            <div className="flex flex-col items-center">
              <ListingQRCode
                url={`${window.location.origin}/listings/${listing.id}`}
                size={96}
                filename={`listing-${listing.id}-qr.png`}
                isAr={isAr}
              />
              <span className="mt-1 text-[10px] text-gray-400">
                {isAr ? "امسح للمشاركة" : "Scan to share"}
              </span>
            </div>
          </div>
        </div>

        {/* ================= Details ================= */}
        <div className="grid grid-cols-1 items-start gap-5 md:grid-cols-[1fr_360px]">
          {/* ---------- Left column ---------- */}
          <div className="flex flex-col gap-4">
            <SectionCard title={t.about} accent="#378ADD">
              <p className="text-sm leading-[1.75] text-gray-600">
                {listing.description}
              </p>
            </SectionCard>

            {listing.amenities?.length > 0 && (
              <SectionCard title={t.amenities}>
                <div className="flex flex-wrap gap-2">
                  {listing.amenities.map((a, i) => (
                    <span
                      key={i}
                      className="rounded-full bg-gray-100 px-3 py-1.5 text-sm text-gray-600"
                    >
                      {a}
                    </span>
                  ))}
                </div>
              </SectionCard>
            )}

            {listing.rules?.length > 0 && (
              <SectionCard title={t.houseRules} accent="#e8c547">
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {listing.rules.map((rule, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-2.5 rounded-xl bg-gray-50 px-3 py-2.5 text-sm text-gray-600"
                    >
                      <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#FAEEDA] text-[10px] text-[#633806]">
                        ✓
                      </span>
                      {rule}
                    </div>
                  ))}
                </div>
              </SectionCard>
            )}

            <CancellationPolicyCard
              policy={listing.cancellation_policy}
              isAr={isAr}
            />

            <SectionCard title={t.hostedBy}>
              <div className="flex items-center gap-3.5">
                <div
                  className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-base font-semibold"
                  style={{ background: hostAvi.bg, color: hostAvi.color }}
                >
                  {hostInitial}
                </div>
                <div>
                  <div className="text-[15px] font-semibold text-gray-900">
                    {listing.host?.name}
                  </div>
                  <div className="mt-0.5 text-xs text-gray-500">
                    {t.hostSince}{" "}
                    {listing.host?.hostDetails?.joinedDate
                      ? new Date(
                          listing.host.hostDetails.joinedDate,
                        ).getFullYear()
                      : "2024"}
                  </div>
                </div>
              </div>
            </SectionCard>

            {/* Location: the address is shown once, under the title; this section is the map */}
            {hasMap && (
              <section className="overflow-hidden rounded-2xl bg-white shadow-sm">
                <div className="p-4 pb-3">
                  <h2 className="text-base font-bold text-gray-900">
                    {isAr ? "الموقع" : "Location"}
                  </h2>
                  <p
                    className="mt-0.5 text-xs text-gray-400"
                    dir="ltr"
                    style={{ textAlign: isAr ? "right" : "left" }}
                  >
                    {/* 📍 {listing.latitude}, {listing.longitude} */}
                    📍 {listing.location}
                  </p>
                </div>

                <a
                  href={`https://www.google.com/maps?q=${mapQuery}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block"
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
                    src={`https://www.google.com/maps?q=${mapQuery}&z=15&output=embed`}
                    className="block h-[260px] w-full md:h-[350px]"
                    style={{ border: 0, pointerEvents: "none" }}
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                    tabIndex={-1}
                  />
                </a>

                <div className="flex flex-wrap gap-2 p-4">
                  <a
                    href={`https://www.google.com/maps?q=${mapQuery}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-xl bg-[#1a1a2e] px-4 text-sm font-semibold text-[#e8c547] no-underline active:scale-[0.97]"
                  >
                    🗺️ {isAr ? "فتح في خرائط Google" : "Open in Google Maps"}
                  </a>

                  <a
                    href={`https://www.google.com/maps/dir/?api=1&destination=${mapQuery}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-xl bg-[#e8c547] px-4 text-sm font-semibold text-[#1a1a2e] no-underline active:scale-[0.97]"
                  >
                    🧭 {isAr ? "احصل على الاتجاهات" : "Get directions"}
                  </a>
                </div>
              </section>
            )}

            {/* Admins have no sheet on phones, so their card sits at the end of the page */}
            {showAdminInline && <div className="md:hidden">{panel}</div>}
          </div>

          {/* ---------- Right column (desktop) ---------- */}
          <div className="hidden md:sticky md:top-20 md:block">{panel}</div>
        </div>
      </main>

      {/* ================= Mobile sticky bar ================= */}
      {usesSheet && !sheetOpen && (
        <div
          className={`fixed inset-x-0 z-30 border-t border-gray-200 bg-white px-4 pt-3 md:hidden ${
            isHostRole
              ? "bottom-[calc(env(safe-area-inset-bottom)+62px)] pb-3"
              : "bottom-0 z-40 pb-[calc(env(safe-area-inset-bottom)+12px)]"
          }`}
        >
          <div className="mx-auto flex max-w-md items-center justify-between gap-3">
            {isHost ? (
              <>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">
                    {t.youOwnThisProperty}
                  </p>
                  <p className="text-xs text-gray-500">
                    {listing.is_active ? t.listingActive : t.listingInactive}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSheetOpen(true)}
                  className="min-h-[48px] shrink-0 rounded-xl bg-[#1a1a2e] px-5 text-sm font-semibold text-[#e8c547] active:scale-[0.97]"
                >
                  🏠 {isAr ? "إدارة" : "Manage"}
                </button>
              </>
            ) : (
              <>
                <div className="min-w-0">
                  {nights > 0 ? (
                    <>
                      <p className="text-base font-bold text-emerald-700">
                        {formatCurrency(totalPrice)}
                      </p>
                      <p className="text-xs text-gray-500">
                        {displayDate(booking.checkIn, isAr)} –{" "}
                        {displayDate(booking.checkOut, isAr)} · {nights}{" "}
                        {nights === 1 ? t.night : t.nights}
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="text-base font-bold">
                        {formatCurrency(listing.price)}
                      </p>
                      <p className="text-xs text-gray-500">/ {t.night}</p>
                    </>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => setSheetOpen(true)}
                  className="min-h-[48px] shrink-0 rounded-xl bg-[#e8c547] px-6 text-sm font-bold text-[#1a1a2e] active:scale-[0.97]"
                >
                  {!isAuthenticated
                    ? `${t.logIn} →`
                    : nights > 0
                      ? `${t.bookNow} →`
                      : t.selectDates}
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* ================= Mobile bottom sheet ================= */}
      {usesSheet && sheetOpen && (
        <div
          className="fixed inset-0 z-[60] flex flex-col justify-end md:hidden"
          dir={isAr ? "rtl" : "ltr"}
        >
          <button
            type="button"
            aria-label={isAr ? "إغلاق" : "Close"}
            onClick={() => setSheetOpen(false)}
            className="absolute inset-0 cursor-default border-none bg-black/50"
          />

          <div className="relative max-h-[92vh] overflow-y-auto rounded-t-3xl bg-gray-50 pb-[env(safe-area-inset-bottom)]">
            <div className="sticky top-0 z-10 flex items-center justify-between bg-gray-50 px-4 pb-2 pt-3">
              <div className="mx-auto h-1.5 w-10 rounded-full bg-gray-300" />
              <button
                type="button"
                onClick={() => setSheetOpen(false)}
                aria-label={isAr ? "إغلاق" : "Close"}
                className="absolute end-3 top-2 flex h-9 w-9 items-center justify-center rounded-full bg-white text-lg text-gray-600 shadow-sm"
              >
                ✕
              </button>
            </div>

            <div className="px-3 pb-5 pt-1">{panel}</div>
          </div>
        </div>
      )}
    </div>
  );
}
