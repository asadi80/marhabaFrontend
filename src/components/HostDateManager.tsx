
import { useEffect, useMemo, useState } from "react";
import { useLanguage } from "../hooks/useLanguage";
import { apiService } from "../services/api";

type BlockedRange = {
  id: string;
  startDate: string;
  endDate: string;
  reason?: string;
};

type Booking = {
  check_in?: string;
  check_out?: string;
  checkIn?: string;
  checkOut?: string;
  status: string;
};

type HostCalendarProps = {
  bookings?: Booking[];
  existingBlockedRanges?: BlockedRange[];
  onRangeSelect: (range: {
    startDate: string;
    endDate: string;
  }) => void;
  language?: "en" | "ar";
};

const getLocalDateString = (date: Date) => {
  return `${date.getFullYear()}-${String(
    date.getMonth() + 1
  ).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};

const parseLocalDate = (value: string) => {
  const date = new Date(`${value.slice(0, 10)}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
};

const addDays = (date: Date, amount: number) => {
  const result = new Date(date);
  result.setDate(result.getDate() + amount);
  return result;
};

/* ============================================================
   HOST CALENDAR
   ============================================================ */

function HostCalendar({
  bookings = [],
  existingBlockedRanges = [],
  onRangeSelect,
  language = "en",
}: HostCalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedStartDate, setSelectedStartDate] =
    useState<Date | null>(null);
  const [selectedEndDate, setSelectedEndDate] =
    useState<Date | null>(null);
  const [hoverDate, setHoverDate] = useState<Date | null>(null);

  const isRTL = language === "ar";

  const translations = {
    en: {
      monthNames: [
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
      ],
      weekDays: ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"],
      clear: "Clear",
      available: "Available",
      selected: "Selected",
      range: "Range",
      blocked: "Blocked by you",
      pending: "Pending",
      confirmed: "Confirmed",
      past: "Past",
    },

    ar: {
      monthNames: [
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
      ],
      weekDays: [
        "أحد",
        "إثنين",
        "ثلاثاء",
        "أربعاء",
        "خميس",
        "جمعة",
        "سبت",
      ],
      clear: "مسح",
      available: "متاح",
      selected: "محدد",
      range: "نطاق",
      blocked: "محظور بواسطتك",
      pending: "قيد الانتظار",
      confirmed: "مؤكد",
      past: "ماضي",
    },
  };

  const t = translations[language];

  /* ============================================================
     BOOKED DATES
     
     Booking:
       check_in  = blocked
       check_out = available for a new check-in

     Example:
       Sep 14 -> Sep 15

       Sep 14 ❌
       Sep 15 ✅
     ============================================================ */

  const bookedDatesMap = useMemo(() => {
    const map = new Map<string, string>();

    bookings.forEach((booking) => {
      const checkInValue = booking.check_in || booking.checkIn;
      const checkOutValue = booking.check_out || booking.checkOut;

      if (!checkInValue || !checkOutValue) return;

      // Cancelled bookings should NOT block dates.
      if (
        booking.status === "cancelled" ||
        booking.status === "canceled" ||
        booking.status === "rejected"
      ) {
        return;
      }

      const start = parseLocalDate(checkInValue);
      const end = parseLocalDate(checkOutValue);

      if (!start || !end) return;

      let current = new Date(start);

      // Check-out date is intentionally NOT included.
      while (current < end) {
        const key = getLocalDateString(current);

        if (!map.has(key)) {
          map.set(key, booking.status);
        }

        current = addDays(current, 1);
      }
    });

    return map;
  }, [bookings]);

  /* ============================================================
     HOST BLOCKED DATES
     ============================================================ */

  const blockedDatesSet = useMemo(() => {
    const set = new Set<string>();

    existingBlockedRanges.forEach((range) => {
      if (!range.startDate || !range.endDate) return;

      const start = parseLocalDate(range.startDate);
      const end = parseLocalDate(range.endDate);

      if (!start || !end) return;

      let current = new Date(start);

      // Host blocks include the end date.
      while (current < end) {
        set.add(getLocalDateString(current));
        current = addDays(current, 1);
      }
    });

    return set;
  }, [existingBlockedRanges]);

  const isBlocked = (date: Date) => {
    return blockedDatesSet.has(getLocalDateString(date));
  };

  const getBookingStatus = (date: Date) => {
    return bookedDatesMap.get(getLocalDateString(date));
  };

  const isBooked = (date: Date) => {
    return bookedDatesMap.has(getLocalDateString(date));
  };

  const isPast = (date: Date) => {
    const today = new Date();

    today.setHours(0, 0, 0, 0);

    return date < today;
  };

  const isAvailable = (date: Date) => {
    return (
      !isBlocked(date) &&
      !isBooked(date) &&
      !isPast(date)
    );
  };

  /* ============================================================
     RANGE SELECTION
     ============================================================ */

  const isInRange = (date: Date) => {
    if (!selectedStartDate || selectedEndDate || !hoverDate) {
      return false;
    }

    return date > selectedStartDate && date <= hoverDate;
  };

  const isSelected = (date: Date) => {
    if (!selectedStartDate) return false;

    if (selectedEndDate) {
      return (
        date >= selectedStartDate &&
        date <= selectedEndDate
      );
    }

    return (
      date.getTime() === selectedStartDate.getTime()
    );
  };

  const isStart = (date: Date) => {
    return (
      !!selectedStartDate &&
      date.getTime() === selectedStartDate.getTime()
    );
  };

  const isEnd = (date: Date) => {
    return (
      !!selectedEndDate &&
      date.getTime() === selectedEndDate.getTime()
    );
  };

  /* ============================================================
     CHECK WHETHER A RANGE CONTAINS A BOOKING/BLOCK
     ============================================================ */

  const rangeHasUnavailableDate = (
    start: Date,
    end: Date
  ) => {
    let current = new Date(start);

    // End date is allowed as the end of the block.
    while (current <= end) {
      if (!isAvailable(current)) {
        return true;
      }

      current = addDays(current, 1);
    }

    return false;
  };

  const handleDateClick = (date: Date) => {
    if (!isAvailable(date)) return;

    // Start a new range.
    if (!selectedStartDate || selectedEndDate) {
      setSelectedStartDate(date);
      setSelectedEndDate(null);
      setHoverDate(null);
      return;
    }

    // Second click.
    if (date <= selectedStartDate) {
      setSelectedStartDate(date);
      setSelectedEndDate(null);
      setHoverDate(null);
      return;
    }

    // Make sure the entire selected range is available.
    if (rangeHasUnavailableDate(selectedStartDate, date)) {
      return;
    }

    setSelectedEndDate(date);

    onRangeSelect({
      startDate: getLocalDateString(selectedStartDate),
      endDate: getLocalDateString(date),
    });
  };

  /* ============================================================
     MONTH DAYS
     ============================================================ */

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();

    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    const days: {
      date: Date;
      isCurrentMonth: boolean;
    }[] = [];

    // Previous month days.
    for (
      let i = firstDay.getDay() - 1;
      i >= 0;
      i--
    ) {
      days.push({
        date: new Date(year, month, -i),
        isCurrentMonth: false,
      });
    }

    // Current month.
    for (
      let i = 1;
      i <= lastDay.getDate();
      i++
    ) {
      days.push({
        date: new Date(year, month, i),
        isCurrentMonth: true,
      });
    }

    // Fill to 42 cells.
    const remaining = 42 - days.length;

    for (let i = 1; i <= remaining; i++) {
      days.push({
        date: new Date(year, month + 1, i),
        isCurrentMonth: false,
      });
    }

    return days;
  };

  const clearSelection = () => {
    setSelectedStartDate(null);
    setSelectedEndDate(null);
    setHoverDate(null);
  };

  const days = getDaysInMonth(currentMonth);

  /* ============================================================
     CLASSES
     ============================================================ */

  const getDayClasses = (
    date: Date,
    isCurrentMonth: boolean
  ) => {
    const status = getBookingStatus(date);
    const blocked = isBlocked(date);
    const past = isPast(date);

    const start = isStart(date);
    const end = isEnd(date);
    const inRange = isInRange(date);
    const selected = isSelected(date);

    const base =
      "relative aspect-square border-0 text-[13px] " +
      "flex items-center justify-center " +
      "transition-all duration-100 " +
      "cursor-pointer";

    if (!isCurrentMonth) {
      return `${base} opacity-30 cursor-default`;
    }

    if (start && selectedEndDate) {
      return `${base} !bg-[#1a1a2e] !text-[#e8c547] font-bold ${
        isRTL
          ? "rounded-r-full"
          : "rounded-l-full"
      }`;
    }

    if (end) {
      return `${base} !bg-[#1a1a2e] !text-[#e8c547] font-bold ${
        isRTL
          ? "rounded-l-full"
          : "rounded-r-full"
      }`;
    }

    if (start) {
      return `${base} !bg-[#1a1a2e] !text-[#e8c547] font-bold rounded-full`;
    }

    if (inRange) {
      return `${base} bg-[#e8c547]/15 text-[#222] rounded-none`;
    }

    if (blocked) {
      return `${base} bg-[#ebebeb] text-[#999] cursor-not-allowed line-through rounded-full`;
    }

    if (status === "confirmed") {
      return `${base} bg-[#FCEBEB] text-[#791F1F] cursor-not-allowed line-through rounded-full`;
    }

    if (status === "pending") {
      return `${base} bg-[#FAEEDA] text-[#633806] cursor-not-allowed line-through rounded-full`;
    }

    if (past) {
      return `${base} text-[#ccc] cursor-not-allowed`;
    }

    if (selected) {
      return `${base} bg-[#1a1a2e] text-[#e8c547] rounded-full`;
    }

    return `${base} hover:bg-[#f0f0f0] text-[#222] rounded-full`;
  };

  return (
    <div
      className={`bg-white rounded-2xl border-[1.5px] border-[#e5e5e5] p-5 select-none ${
        isRTL ? "text-right" : ""
      }`}
      dir={isRTL ? "rtl" : "ltr"}
      style={
        isRTL
          ? {
              fontFamily:
                "'Cairo', 'Tajawal', sans-serif",
            }
          : {}
      }
    >
      {/* Month header */}
      <div className="flex justify-between items-center mb-5">
        <button
          type="button"
          className="w-8 h-8 rounded-full border-[1.5px] border-[#e5e5e5] bg-white cursor-pointer flex items-center justify-center text-sm text-[#222] hover:border-[#222] transition-colors"
          onClick={() => {
            const d = new Date(currentMonth);
            d.setMonth(d.getMonth() - 1);
            setCurrentMonth(d);
          }}
        >
          {isRTL ? "→" : "←"}
        </button>

        <span className="text-[15px] font-bold text-[#222]">
          {t.monthNames[currentMonth.getMonth()]}{" "}
          {currentMonth.getFullYear()}
        </span>

        <button
          type="button"
          className="w-8 h-8 rounded-full border-[1.5px] border-[#e5e5e5] bg-white cursor-pointer flex items-center justify-center text-sm text-[#222] hover:border-[#222] transition-colors"
          onClick={() => {
            const d = new Date(currentMonth);
            d.setMonth(d.getMonth() + 1);
            setCurrentMonth(d);
          }}
        >
          {isRTL ? "←" : "→"}
        </button>
      </div>

      {/* Week days */}
      <div className="grid grid-cols-7 mb-2">
        {t.weekDays.map((day) => (
          <div
            key={day}
            className="text-center text-[11px] font-bold tracking-[0.05em] text-[#717171] py-1"
          >
            {day}
          </div>
        ))}
      </div>

      {/* Calendar */}
      <div className="grid grid-cols-7 gap-0.5">
        {days.map(
          ({ date, isCurrentMonth }, index) => {
            const status = getBookingStatus(date);
            const blocked = isBlocked(date);
            const past = isPast(date);
            const available = isAvailable(date);

            return (
              <button
                key={`${getLocalDateString(date)}-${index}`}
                type="button"
                className={getDayClasses(
                  date,
                  isCurrentMonth
                )}
                onClick={() => {
                  if (isCurrentMonth) {
                    handleDateClick(date);
                  }
                }}
                onMouseEnter={() => {
                  if (
                    available &&
                    selectedStartDate &&
                    !selectedEndDate &&
                    date > selectedStartDate
                  ) {
                    setHoverDate(date);
                  }
                }}
                onMouseLeave={() =>
                  setHoverDate(null)
                }
                disabled={
                  !available && isCurrentMonth
                }
              >
                {date.getDate()}

                {/* Pending indicator */}
                {status === "pending" && (
                  <span className="absolute top-[3px] right-[3px] w-[5px] h-[5px] rounded-full bg-[#e8c547]" />
                )}

                {/* Confirmed indicator */}
                {status === "confirmed" && (
                  <span className="absolute top-[3px] right-[3px] w-[5px] h-[5px] rounded-full bg-[#A32D2D]" />
                )}

                {/* Checked-in indicator */}
                {status === "checked_in" && (
                  <span className="absolute top-[3px] right-[3px] w-[5px] h-[5px] rounded-full bg-[#A32D2D]" />
                )}

                {/* Blocked indicator */}
                {blocked && (
                  <span className="absolute bottom-[3px] w-[5px] h-[5px] rounded-full bg-[#999]" />
                )}

                {/* Available indicator */}
                {available &&
                  !isSelected(date) &&
                  !past && (
                    <span className="absolute bottom-[3px] w-[5px] h-[5px] rounded-full bg-[#1D9E75]" />
                  )}
              </button>
            );
          }
        )}
      </div>

      {/* Selected range */}
      {(selectedStartDate || selectedEndDate) && (
        <div className="mt-3.5 px-3.5 py-3 bg-[#f7f7f7] rounded-[10px] flex justify-between items-center gap-3">
          <span className="text-[13px] text-[#222] font-medium">
            {selectedStartDate?.toLocaleDateString(
              language === "ar" ? "ar-EG" : "en-US"
            )}

            {selectedEndDate &&
              ` → ${selectedEndDate.toLocaleDateString(
                language === "ar"
                  ? "ar-EG"
                  : "en-US"
              )}`}
          </span>

          <button
            type="button"
            className="text-[12px] text-[#717171] bg-transparent border-none cursor-pointer font-medium underline"
            onClick={clearSelection}
          >
            {t.clear}
          </button>
        </div>
      )}

      {/* Legend */}
      <div className="mt-4 pt-4 border-t border-[#f0f0f0] flex flex-wrap gap-x-4 gap-y-2">
        {[
          {
            bg: "bg-white border border-[#ddd]",
            label: t.available,
          },
          {
            bg: "bg-[#1a1a2e]",
            label: t.selected,
          },
          {
            bg: "bg-[#e8c547]/15",
            label: t.range,
          },
          {
            bg: "bg-[#ebebeb]",
            label: t.blocked,
          },
          {
            bg: "bg-[#FAEEDA]",
            label: t.pending,
          },
          {
            bg: "bg-[#FCEBEB]",
            label: t.confirmed,
          },
          {
            bg: "bg-[#f0f0f0]",
            label: t.past,
          },
        ].map(({ bg, label }) => (
          <div
            key={label}
            className="flex items-center gap-1.5 text-[11px] text-[#717171]"
          >
            <span
              className={`w-3 h-3 rounded-full flex-shrink-0 ${bg}`}
            />

            {label}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ============================================================
   HOST DATE MANAGER
   ============================================================ */

type HostDateManagerProps = {
  listingId: string;
  blockedDates?: BlockedRange[];
  bookings?: Booking[];
  onDatesUpdated?: () => void;
};

export default function HostDateManager({
  listingId,
  blockedDates = [],
  bookings = [],
  onDatesUpdated,
}: HostDateManagerProps) {
  const { lang } = useLanguage();

  const language: "en" | "ar" =
    lang === "ar" ? "ar" : "en";

  const isRTL = language === "ar";

  const [showBlockForm, setShowBlockForm] =
    useState(false);

  const [selectedRange, setSelectedRange] =
    useState<{
      startDate: string;
      endDate: string;
    } | null>(null);

  const [reason, setReason] = useState("");

  const [loading, setLoading] = useState(false);

  const [error, setError] = useState("");

  const [success, setSuccess] = useState("");

  const translations = {
    en: {
      manageBlockedDates: "Manage Blocked Dates",
      pending: "Pending",
      confirmed: "Confirmed",
      blocked: "Blocked",
      blockDates: "Block Dates",
      cancel: "Cancel",
      selectDateRange:
        "Select date range to block",
      reasonOptional: "Reason (optional)",
      reasonPlaceholder:
        "e.g. Maintenance, Personal use…",
      blockSelected: "Block Selected Dates",
      blocking: "Blocking…",
      currentlyBlocked: "Currently blocked",
      remove: "Remove",
      pleaseSelectRange:
        "Please select a date range on the calendar",
      endDateAfterStart:
        "End date must be after start date",
      cannotBlockPast:
        "Cannot block past dates",
      datesBlocked:
        "Dates blocked successfully!",
      removeConfirmation:
        "Remove this blocked date range?",
      blockedRemoved:
        "Blocked dates removed!",
      overlapBooking:
        "You cannot block dates that contain an active booking.",
      activeBooking:
        "This range overlaps an active booking.",
    },

    ar: {
      manageBlockedDates: "إدارة التواريخ المحظورة",
      pending: "قيد الانتظار",
      confirmed: "مؤكد",
      blocked: "محظور",
      blockDates: "حظر التواريخ",
      cancel: "إلغاء",
      selectDateRange:
        "حدد نطاق التاريخ للحظر",
      reasonOptional: "السبب (اختياري)",
      reasonPlaceholder:
        "مثال: صيانة، استخدام شخصي...",
      blockSelected:
        "حظر التواريخ المحددة",
      blocking: "جاري الحظر...",
      currentlyBlocked:
        "المحظور حالياً",
      remove: "إزالة",
      pleaseSelectRange:
        "الرجاء تحديد نطاق تاريخ على التقويم",
      endDateAfterStart:
        "يجب أن يكون تاريخ الانتهاء بعد تاريخ البدء",
      cannotBlockPast:
        "لا يمكن حظر التواريخ الماضية",
      datesBlocked:
        "تم حظر التواريخ بنجاح!",
      removeConfirmation:
        "هل تريد إزالة نطاق التاريخ المحظور؟",
      blockedRemoved:
        "تم إزالة التواريخ المحظورة!",
      overlapBooking:
        "لا يمكنك حظر تواريخ تحتوي على حجز نشط.",
      activeBooking:
        "النطاق المحدد يتداخل مع حجز نشط.",
    },
  };

  const t = translations[language];

  /* ============================================================
     CHECK RANGE AGAINST BOOKINGS
     ============================================================ */

  const rangeOverlapsBooking = (
    startDate: string,
    endDate: string
  ) => {
    const start = parseLocalDate(startDate);
    const end = parseLocalDate(endDate);

    if (!start || !end) return false;

    return bookings.some((booking) => {
      const checkInValue =
        booking.check_in || booking.checkIn;

      const checkOutValue =
        booking.check_out || booking.checkOut;

      if (!checkInValue || !checkOutValue) {
        return false;
      }

      if (
        booking.status === "cancelled" ||
        booking.status === "canceled" ||
        booking.status === "rejected"
      ) {
        return false;
      }

      const bookingStart =
        parseLocalDate(checkInValue);

      const bookingEnd =
        parseLocalDate(checkOutValue);

      if (!bookingStart || !bookingEnd) {
        return false;
      }

      /*
        Booking:
          Sep 14 -> Sep 15

        Host block:
          Sep 13 -> Sep 14

        This is allowed because Sep 14 is
        the booking checkout date.

        Host block:
          Sep 13 -> Sep 15

        This overlaps the booking and is rejected.
      */

      return (
        start < bookingEnd &&
        end > bookingStart
      );
    });
  };

  /* ============================================================
     BLOCK DATES
     ============================================================ */

  const handleBlockSubmit = async () => {
    setError("");
    setSuccess("");

    if (!selectedRange) {
      setError(t.pleaseSelectRange);
      return;
    }

    const start = parseLocalDate(
      selectedRange.startDate
    );

    const end = parseLocalDate(
      selectedRange.endDate
    );

    if (!start || !end) {
      setError(t.pleaseSelectRange);
      return;
    }

    if (start >= end) {
      setError(t.endDateAfterStart);
      return;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (start < today) {
      setError(t.cannotBlockPast);
      return;
    }

    /*
      IMPORTANT:

      Don't allow the host to block dates that
      already contain an active booking.
    */
    if (
      rangeOverlapsBooking(
        selectedRange.startDate,
        selectedRange.endDate
      )
    ) {
      setError(t.overlapBooking);
      return;
    }

    setLoading(true);

    try {
      const newBlock: BlockedRange = {
        id: crypto.randomUUID(),
        startDate: selectedRange.startDate,
        endDate: selectedRange.endDate,
        reason:
          reason.trim() ||
          (language === "ar"
            ? "محظور بواسطة المضيف"
            : "Blocked by host"),
      };

      /*
        IMPORTANT:

        Your backend Listing model uses blocked_dates.

        We send the complete array because blocked_dates
        is stored on the Listing.
      */

      const updatedBlockedDates = [
        ...blockedDates,
        newBlock,
      ];

      const response =
        await apiService.patchProtectedData(
          `/api/v1/listings/${listingId}/blocked-dates`,
          {
            blocked_dates: updatedBlockedDates,
          }
        );

      if (!response?.success) {
        throw new Error(
          response?.message ||
            (language === "ar"
              ? "تعذر حظر التواريخ."
              : "Failed to block dates.")
        );
      }

      setSuccess(t.datesBlocked);

      setSelectedRange(null);
      setReason("");
      setShowBlockForm(false);

      await onDatesUpdated?.();

      setTimeout(() => {
        setSuccess("");
      }, 3000);
    } catch (err: any) {
      console.error(
        "❌ Failed to block dates:",
        err
      );

      setError(
        err?.message ||
          (language === "ar"
            ? "حدث خطأ أثناء حظر التواريخ."
            : "Failed to block dates.")
      );
    } finally {
      setLoading(false);
    }
  };

  /* ============================================================
     REMOVE BLOCK
     ============================================================ */

  const handleRemoveBlock = async (
    blockId: string
  ) => {
    const confirmed = window.confirm(
      t.removeConfirmation
    );

    if (!confirmed) return;

    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const updatedBlockedDates =
        blockedDates.filter(
          (block) => block.id !== blockId
        );

      const response =
        await apiService.putProtectedData(
          `/api/v1/listings/${listingId}`,
          {
            blocked_dates: updatedBlockedDates,
          }
        );

      if (!response?.success) {
        throw new Error(
          response?.message ||
            (language === "ar"
              ? "تعذر إزالة الحظر."
              : "Failed to remove blocked dates.")
        );
      }

      setSuccess(t.blockedRemoved);

      await onDatesUpdated?.();

      setTimeout(() => {
        setSuccess("");
      }, 3000);
    } catch (err: any) {
      console.error(
        "❌ Failed to remove blocked dates:",
        err
      );

      setError(
        err?.message ||
          (language === "ar"
            ? "حدث خطأ أثناء إزالة الحظر."
            : "Failed to remove blocked dates.")
      );
    } finally {
      setLoading(false);
    }
  };

  const fmtDate = (value: string) => {
    const date = parseLocalDate(value);

    if (!date) return value;

    return date.toLocaleDateString(
      language === "ar"
        ? "ar-EG"
        : "en-US",
      {
        year: "numeric",
        month: "short",
        day: "numeric",
      }
    );
  };

  return (
    <div
      className={`mt-5 ${
        isRTL
          ? "font-['Cairo','Tajawal',sans-serif]"
          : ""
      }`}
      dir={isRTL ? "rtl" : "ltr"}
      style={
        isRTL
          ? {
              fontFamily:
                "'Cairo', 'Tajawal', sans-serif",
            }
          : {}
      }
    >
      {/* Header */}
      <div className="flex flex-col justify-center mb-4">
        <div>
          <div className="text-[15px] font-bold text-[#222] mb-1">
            {t.manageBlockedDates}
          </div>

          <div className="text-[12px] text-[#717171] flex items-center gap-3 flex-wrap">
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#e8c547]" />
              {t.pending}
            </span>

            <span className="inline-flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#A32D2D]" />
              {t.confirmed}
            </span>

            <span className="inline-flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#ebebeb] border border-[#ddd]" />
              {t.blocked}
            </span>
          </div>
        </div>

        <button
          type="button"
          className={`self-start rounded-3xl px-[18px] py-2 text-[13px] font-semibold cursor-pointer whitespace-nowrap transition-opacity mt-3 hover:opacity-85 border-0 ${
            showBlockForm
              ? "bg-[#f7f7f7] text-[#717171]"
              : "bg-[#1a1a2e] text-[#e8c547]"
          }`}
          onClick={() => {
            setShowBlockForm((value) => !value);
            setSelectedRange(null);
            setReason("");
            setError("");
          }}
        >
          {showBlockForm
            ? t.cancel
            : `+ ${t.blockDates}`}
        </button>
      </div>

      {/* Block form */}
      {showBlockForm && (
        <div className="bg-[#f7f7f7] rounded-2xl p-5 mb-4 border-[1.5px] border-[#f0f0f0]">
          <label className="block text-[11px] font-bold tracking-[0.07em] uppercase text-[#717171] mb-2">
            {t.selectDateRange}
          </label>

          <HostCalendar
            bookings={bookings}
            existingBlockedRanges={
              blockedDates
            }
            onRangeSelect={setSelectedRange}
            language={language}
          />

          {/* Selected range */}
          {selectedRange && (
            <div className="mt-3.5 px-4 py-3 bg-white border-[1.5px] border-[#e8c547] rounded-[10px] text-[13px] font-semibold text-[#222]">
              📅 {fmtDate(selectedRange.startDate)}{" "}
              → {fmtDate(selectedRange.endDate)}
            </div>
          )}

          {/* Reason */}
          <div className="mt-3.5">
            <label className="block text-[11px] font-bold tracking-[0.07em] uppercase text-[#717171] mb-2">
              {t.reasonOptional}
            </label>

            <input
              type="text"
              value={reason}
              onChange={(e) =>
                setReason(e.target.value)
              }
              placeholder={t.reasonPlaceholder}
              className="w-full px-3.5 py-2.5 bg-white border-[1.5px] border-[#e5e5e5] rounded-[10px] text-[14px] text-[#222] outline-none transition-colors focus:border-[#e8c547]"
            />
          </div>

          {/* Error */}
          {error && (
            <div className="bg-[#FCEBEB] border-[1.5px] border-[#A32D2D]/20 rounded-[10px] px-3.5 py-2.5 text-[13px] text-[#791F1F] mt-2.5">
              {error}
            </div>
          )}

          {/* Success */}
          {success && (
            <div className="bg-[#EAF3DE] border-[1.5px] border-[#27500A]/15 rounded-[10px] px-3.5 py-2.5 text-[13px] text-[#27500A] mt-2.5">
              {success}
            </div>
          )}

          {/* Buttons */}
          <div className="flex justify-end gap-2.5 mt-4">
            <button
              type="button"
              className="bg-white text-[#717171] border-[1.5px] border-[#e5e5e5] rounded-[10px] px-5 py-2.5 text-[13px] font-semibold cursor-pointer hover:border-[#aaa] transition-colors"
              onClick={() => {
                setShowBlockForm(false);
                setSelectedRange(null);
                setReason("");
                setError("");
              }}
            >
              {t.cancel}
            </button>

            <button
              type="button"
              className="bg-[#1a1a2e] text-[#e8c547] border-0 rounded-[10px] px-5 py-2.5 text-[13px] font-semibold cursor-pointer transition-opacity hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
              disabled={
                loading || !selectedRange
              }
              onClick={handleBlockSubmit}
            >
              {loading
                ? t.blocking
                : t.blockSelected}
            </button>
          </div>
        </div>
      )}

      {/* Messages outside form */}
      {success && !showBlockForm && (
        <div className="bg-[#EAF3DE] border-[1.5px] border-[#27500A]/15 rounded-[10px] px-3.5 py-2.5 text-[13px] text-[#27500A] mt-2.5">
          {success}
        </div>
      )}

      {error && !showBlockForm && (
        <div className="bg-[#FCEBEB] border-[1.5px] border-[#A32D2D]/20 rounded-[10px] px-3.5 py-2.5 text-[13px] text-[#791F1F] mt-2.5">
          {error}
        </div>
      )}

      {/* Existing blocked ranges */}
      {blockedDates.length > 0 && (
        <div className="flex flex-col gap-2 mt-4">
          <div className="text-[12px] font-bold tracking-[0.06em] uppercase text-[#999] mb-2.5">
            {t.currentlyBlocked}
          </div>

          {blockedDates.map((block) => (
            <div
              key={block.id}
              className="bg-[#FCEBEB] border-[1.5px] border-[#A32D2D]/12 rounded-xl px-4 py-3 flex justify-between items-start gap-2.5"
            >
              <div>
                <div className="text-[13px] text-[#791F1F] font-semibold">
                  {fmtDate(block.startDate)}{" "}
                  → {fmtDate(block.endDate)}
                </div>

                {block.reason && (
                  <div className="text-[12px] text-[#A32D2D] mt-0.5 opacity-75">
                    {block.reason}
                  </div>
                )}
              </div>

              <button
                type="button"
                className="bg-transparent border-none text-[#A32D2D] text-[12px] cursor-pointer font-semibold underline flex-shrink-0 disabled:opacity-50"
                disabled={loading}
                onClick={() =>
                  handleRemoveBlock(block.id)
                }
              >
                {t.remove}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

