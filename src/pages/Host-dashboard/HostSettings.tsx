import React, { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";

import { useAuth } from "../../context/AuthContext";
import { useLanguage } from "../../hooks/useLanguage";
import Navbar from "../../components/Navbar";
import { apiService } from "../../services/api";
import { compressImage } from "../../lib/compressImage";

/* ==========================================================================
   MOAMALAT TYPES
========================================================================== */

declare global {
  interface Window {
    Lightbox?: {
      Checkout: {
        configure: MoamalatLightboxConfig;
        showLightbox: () => void;
        closeLightbox: () => void;
      };
    };
  }
}

interface MoamalatLightboxConfig {
  MID: string;
  TID: string;
  AmountTrxn: string;
  MerchantReference: string;
  TrxDateTime: string;
  SecureHash: string;
  completeCallback?: (data: any) => void;
  cancelCallback?: (data: any) => void;
  errorCallback?: (error: any) => void;
}

/* ==========================================================================
   APP TYPES
========================================================================== */

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

interface HostSubscriptionPayment {
  id: string;
  host_id: string;
  amount: number;
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

interface VerificationStatus {
  id: {
    documents?: IDDocument[];
    uploaded: boolean;
    verified: boolean;
    verified_at: string | null;
    rejected?: boolean;
    rejection_reason?: string | null;
  };
  payment: {
    uploaded: boolean;
    status: "pending" | "approved" | "rejected";
    amount: number | null;
    submitted_at: string | null;
    rejection_reason: string | null;
    rejected?: boolean;
    approved_at?: string | null;
    payment?: HostSubscriptionPayment | null;
  };
  all_payments?: HostSubscriptionPayment[];
  overall_status?: string;
}

type TFn = (en: string, ar: string) => string;
type UploadKind = "id" | "payment";

/* ==========================================================================
   CONSTANTS
========================================================================== */

const ACCEPTED_FILE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
  "image/heic",
  "image/heif",
];

const MAX_FILE_SIZE = 10 * 1024 * 1024;

const FILE_ACCEPT =
  ".jpg,.jpeg,.png,.webp,.pdf,.heic,.heif,image/jpeg,image/png,image/webp,application/pdf,image/heic,image/heif";

// const MOAMALAT_SCRIPT_URL =
//   import.meta.env.MODE === "production"
//     ? "https://npg.moamalat.net:6006/js/lightbox.js"
//     : "https://tnpg.moamalat.net:6006/js/lightbox.js";

const MOAMALAT_SCRIPT_URL = "https://tnpg.moamalat.net:6006/js/lightbox.js";

const SUBSCRIPTION_AMOUNT_LYD = 500;

const NAV_LINKS = [
  { id: "dashboard", label: "Home", labelAr: "الرئيسية", href: "/host-dashboard", icon: "🏡" },
  { id: "listings", label: "Listings", labelAr: "إعلاناتي", href: "/host/listings", icon: "🏠" },
  { id: "bookings", label: "Bookings", labelAr: "الحجوزات", href: "/host/bookings", icon: "📅" },
  { id: "settings", label: "Settings", labelAr: "الإعدادات", href: "/host/settings", icon: "⚙️" },
];

const UPLOAD_ENDPOINTS: Record<UploadKind, string> = {
  id: "/api/v1/uploads/ids",
  payment: "/api/v1/uploads/payments",
};

const NO_IMAGE_SVG =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Crect width='200' height='200' fill='%23f3f4f6'/%3E%3Ctext x='50%25' y='50%25' font-family='Arial' font-size='14' fill='%239ca3af' text-anchor='middle' dy='.3em'%3ENo Image%3C/text%3E%3C/svg%3E";

/* ==========================================================================
   MOAMALAT RESPONSE CODE → FRIENDLY MESSAGE
========================================================================== */

const getMoamalatMessage = (code: string | null | undefined, isArabic: boolean) => {
  if (!code) return null;

  const messages: Record<string, { ar: string; en: string }> = {
    "05": { ar: "تم رفض العملية من قبل البنك.", en: "Transaction declined by the bank." },
    "13": { ar: "المبلغ غير صالح.", en: "Invalid amount." },
    "14": { ar: "رقم البطاقة غير صحيح.", en: "Invalid card number." },
    "16": { ar: "رصيد غير كافٍ في حسابك.", en: "Insufficient funds in your account." },
    "17": { ar: "تم إلغاء العملية.", en: "Transaction cancelled by the customer." },
    "51": { ar: "رصيد غير كافٍ.", en: "Insufficient funds." },
    "54": { ar: "البطاقة منتهية الصلاحية.", en: "Card has expired." },
    "55": { ar: "الرقم السري غير صحيح.", en: "Incorrect PIN." },
    "57": { ar: "العملية غير مسموح بها لهذه البطاقة.", en: "Transaction not permitted for this card." },
    "58": { ar: "العملية غير مسموح بها في هذا المتجر.", en: "Transaction not allowed at this terminal." },
    "59": { ar: "يُشتبه في أنها عملية احتيال.", en: "Suspected fraud." },
    "61": { ar: "تم تجاوز الحد المسموح به.", en: "Activity amount limit exceeded." },
    "62": { ar: "بطاقة مقيّدة.", en: "Restricted card." },
    "65": { ar: "تم تجاوز عدد العمليات المسموح بها.", en: "Activity count limit exceeded." },
    "75": { ar: "تم تجاوز عدد محاولات إدخال الرقم السري.", en: "Too many PIN attempts." },
    "82": { ar: "فشل التحقق من بيانات البطاقة.", en: "Card authentication failed." },
    "91": { ar: "البنك المُصدر غير متاح حالياً. حاول لاحقاً.", en: "Issuer bank unavailable. Try again later." },
    "96": { ar: "خطأ في النظام. حاول لاحقاً.", en: "System malfunction. Please try again later." },
  };

  const entry = messages[code];
  if (!entry) return null;

  return isArabic ? entry.ar : entry.en;
};

/* ==========================================================================
   SMALL UI PIECES
========================================================================== */

const Skeleton: React.FC<{ className?: string }> = ({ className = "" }) => (
  <div className={`animate-pulse rounded-lg bg-gray-200/80 ${className}`} />
);

const Spinner: React.FC<{ light?: boolean }> = ({ light }) => (
  <span
    className={`inline-block h-4 w-4 animate-spin rounded-full border-2 border-t-transparent ${
      light ? "border-white" : "border-current"
    }`}
  />
);

const PILL_TONES = {
  green: "bg-emerald-50 text-emerald-700",
  red: "bg-red-50 text-red-700",
  yellow: "bg-amber-50 text-amber-700",
  gray: "bg-gray-100 text-gray-600",
  blue: "bg-blue-50 text-blue-700",
};

type Tone = keyof typeof PILL_TONES;

const Pill: React.FC<{ tone: Tone; children: React.ReactNode }> = ({ tone, children }) => (
  <span className={`shrink-0 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${PILL_TONES[tone]}`}>
    {children}
  </span>
);

const Notice: React.FC<{ tone: "green" | "red" | "yellow"; icon: string; children: React.ReactNode }> = ({
  tone,
  icon,
  children,
}) => {
  const cls = {
    green: "bg-emerald-50 text-emerald-800",
    red: "bg-red-50 text-red-800",
    yellow: "bg-amber-50 text-amber-900",
  }[tone];

  return (
    <div className={`flex items-start gap-3 rounded-xl p-3.5 text-sm ${cls}`}>
      <span className="text-lg leading-none">{icon}</span>
      <div className="min-w-0 flex-1 leading-relaxed">{children}</div>
    </div>
  );
};

const Card: React.FC<{ title: string; subtitle?: string; right?: React.ReactNode; children: React.ReactNode }> = ({
  title,
  subtitle,
  right,
  children,
}) => (
  <section className="overflow-hidden rounded-2xl bg-white shadow-sm">
    <div className="flex items-start justify-between gap-3 border-b border-gray-100 px-4 py-4">
      <div>
        <h2 className="text-base font-bold">{title}</h2>
        {subtitle && <p className="mt-0.5 text-sm text-gray-500">{subtitle}</p>}
      </div>
      {right}
    </div>
    <div className="p-4">{children}</div>
  </section>
);

const Field: React.FC<{ label: string; children: React.ReactNode; capitalize?: boolean }> = ({
  label,
  children,
  capitalize,
}) => (
  <div>
    <p className="mb-1 text-xs font-medium text-gray-500">{label}</p>
    <div
      className={`break-words rounded-xl bg-gray-50 px-3.5 py-2.5 text-sm text-gray-800 ${
        capitalize ? "capitalize" : ""
      }`}
    >
      {children}
    </div>
  </div>
);

const Detail: React.FC<{ label: string; children: React.ReactNode; wide?: boolean }> = ({ label, children, wide }) => (
  <div className={wide ? "col-span-2" : ""}>
    <p className="text-xs text-gray-500">{label}</p>
    <p className="break-words text-sm font-medium text-gray-900">{children}</p>
  </div>
);

const statusTone = (status?: string): Tone => {
  const s = String(status || "").toLowerCase();
  if (s === "approved" || s === "verified") return "green";
  if (s === "rejected") return "red";
  if (s === "pending") return "yellow";
  return "gray";
};

/* ==========================================================================
   COMPONENT
========================================================================== */

const HostSettings: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const { user, isAuthenticated, isLoading: authLoading, updateVerificationStatus } = useAuth();
  const { lang, toggleLanguage } = useLanguage();

  const isArabic = lang === "ar";
  const t: TFn = (en, ar) => (isArabic ? ar : en);

  const idInputRef = useRef<HTMLInputElement | null>(null);
  const paymentInputRef = useRef<HTMLInputElement | null>(null);

  /* ------------------------------ State -------------------------------- */

  const [verificationStatus, setVerificationStatus] = useState<VerificationStatus | null>(null);
  const [loadingVerification, setLoadingVerification] = useState(true);

  const [uploading, setUploading] = useState<UploadKind | null>(null);
  const [idError, setIdError] = useState("");
  const [paymentError, setPaymentError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const [moamalatReady, setMoamalatReady] = useState(false);
  const [moamalatLoading, setMoamalatLoading] = useState(false);
  const [moamalatError, setMoamalatError] = useState("");

  // Tracks whether the current Moamalat attempt has completed, so a
  // cancelCallback fired when the Lightbox closes is ignored.
  const paymentCompletedRef = useRef(false);

  /* ------------------------ Auth protection ---------------------------- */

  useEffect(() => {
    if (authLoading) return;

    if (!isAuthenticated || !user) {
      navigate("/login", { replace: true });
      return;
    }

    if (String(user.role).toLowerCase() !== "host") {
      navigate("/user-dashboard", { replace: true });
    }
  }, [authLoading, isAuthenticated, user, navigate]);

  /* ---------------------- Fetch verification status -------------------- */

  // silent = refresh without bringing the skeletons back
  const fetchVerificationStatus = async (silent = false) => {
    try {
      if (!silent) setLoadingVerification(true);

      const response = await apiService.getProtectedData<VerificationStatus>("/api/v1/auth/host-verification-status");

      if (!response.success || !response.data) {
        throw new Error(response.message || "Failed to load verification status");
      }

      setVerificationStatus(response.data);
      updateVerificationStatus?.(response.data);
    } catch (error: any) {
      console.error("Failed to fetch verification status:", error);
      setVerificationStatus(null);

      if (error?.message === "UNAUTHORIZED") {
        navigate("/login", { replace: true });
      }
    } finally {
      setLoadingVerification(false);
    }
  };

  useEffect(() => {
    if (authLoading || !isAuthenticated || !user) return;
    if (String(user.role || "").toLowerCase() !== "host") return;

    fetchVerificationStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, isAuthenticated, user?.id, user?.role]);

  /* ------------------------ Load Moamalat SDK -------------------------- */

  useEffect(() => {
    if (window.Lightbox) {
      setMoamalatReady(true);
      return;
    }

    const existing = document.querySelector(`script[src="${MOAMALAT_SCRIPT_URL}"]`) as HTMLScriptElement | null;

    if (existing) {
      const handleLoad = () => setMoamalatReady(true);
      existing.addEventListener("load", handleLoad);
      return () => existing.removeEventListener("load", handleLoad);
    }

    const script = document.createElement("script");
    script.src = MOAMALAT_SCRIPT_URL;
    script.async = true;
    script.onload = () => setMoamalatReady(true);
    script.onerror = () => {
      setMoamalatError(isArabic ? "فشل تحميل بوابة الدفع." : "Failed to load payment gateway.");
    };
    document.body.appendChild(script);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ------------------------------ Helpers ------------------------------ */

  const formatDate = (date: string | null | undefined) => {
    if (!date) return "";
    try {
      return new Date(date).toLocaleDateString(isArabic ? "ar-LY" : "en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
    } catch {
      return date;
    }
  };

  const formatCurrency = (amount: number | string | null | undefined) => {
    if (amount === null || amount === undefined) return t("Not specified", "غير محدد");
    const num = typeof amount === "string" ? parseFloat(amount) : amount;
    if (Number.isNaN(num)) return t("Not specified", "غير محدد");

    return new Intl.NumberFormat(isArabic ? "ar-LY" : "en-US", {
      style: "currency",
      currency: "LYD",
      maximumFractionDigits: 2,
    }).format(num);
  };

  const isImageFile = (url: string, fileType?: string | null) => {
    if (fileType?.startsWith("image/")) return true;
    return /\.(jpg|jpeg|png|webp|gif|bmp|heic|heif)$/i.test(url);
  };

  const statusText = (status?: string) => {
    const s = String(status || "").toLowerCase();
    if (s === "approved") return t("Approved", "تمت الموافقة");
    if (s === "verified") return t("Verified", "تم التحقق");
    if (s === "rejected") return t("Rejected", "مرفوض");
    if (s === "pending") return t("Under review", "قيد المراجعة");
    return status || t("Unknown", "غير معروف");
  };

  const isMoamalatPayment = (p: HostSubscriptionPayment) => {
    if (p.reference && /^SUB-/i.test(p.reference)) return true;
    if (p.notes && /moamalat/i.test(p.notes)) return true;
    return false;
  };

  const getPaymentTypeLabel = (p: HostSubscriptionPayment) =>
    isMoamalatPayment(p) ? t("Moamalat (Card)", "معاملات (بطاقة)") : t("Bank Transfer", "تحويل مصرفي");

  const validateFile = (file: File) => {
    if (!ACCEPTED_FILE_TYPES.includes(file.type)) {
      return t(
        "Unsupported file type. Please upload JPG, PNG, WEBP, or PDF.",
        "نوع الملف غير مدعوم. يرجى رفع JPG أو PNG أو WEBP أو PDF.",
      );
    }
    if (file.size > MAX_FILE_SIZE) {
      return t("File size must not exceed 10 MB.", "حجم الملف يجب ألا يتجاوز 10 ميجابايت.");
    }
    return null;
  };

  /* ---------------------------- File uploads --------------------------- */

  // One handler for both identity documents and bank receipts
  const handleUpload = (kind: UploadKind) => async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const setError = kind === "id" ? setIdError : setPaymentError;
    const inputRef = kind === "id" ? idInputRef : paymentInputRef;

    setError("");
    setSuccessMessage("");

    const validationError = validateFile(file);
    if (validationError) {
      setError(validationError);
      if (inputRef.current) inputRef.current.value = "";
      return;
    }

    if (!user?.id) {
      setError(t("User ID was not found.", "لم يتم العثور على معرف المستخدم."));
      return;
    }

    try {
      setUploading(kind);

      let fileToUpload: File = file;

      if (file.type.startsWith("image/") && file.type !== "image/heic" && file.type !== "image/heif") {
        try {
          fileToUpload = await compressImage(file);
        } catch (compressionError) {
          console.warn("Image compression failed. Uploading original:", compressionError);
          fileToUpload = file;
        }
      }

      const formData = new FormData();
      formData.append("image", fileToUpload);
      formData.append("user_id", user.id);

      const response = await apiService.postProtectedData(UPLOAD_ENDPOINTS[kind], formData);

      if (!response.success) {
        throw new Error(
          response.message ||
            (kind === "id" ? "Failed to upload identity document." : "Failed to upload payment receipt."),
        );
      }

      setSuccessMessage(
        kind === "id"
          ? t("Identity document uploaded successfully.", "تم رفع وثيقة الهوية بنجاح.")
          : t("Payment receipt uploaded successfully.", "تم رفع إيصال الدفع بنجاح."),
      );

      await fetchVerificationStatus(true);
    } catch (error: any) {
      console.error(`${kind} upload failed:`, error);
      setError(
        error?.response?.data?.message ||
          error?.message ||
          (kind === "id"
            ? t("Failed to upload identity document.", "فشل رفع وثيقة الهوية.")
            : t("Failed to upload payment receipt.", "فشل رفع إيصال الدفع.")),
      );
    } finally {
      setUploading(null);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  /* --------------------------- Moamalat payment ------------------------ */

  const handleMoamalatCallback = async (data: any, outcome: "completed" | "cancelled" | "failed") => {
    try {
      const verifyResponse = await apiService.postProtectedData<{
        status: string;
        amount: number;
        reference: string;
        responseCode?: string | null;
        responseMessage?: string | null;
      }>("/api/v1/payments/moamalat/verify", {
        ...data,
        user_id: user?.id,
        outcome,
      });

      // Even if verifyResponse.success is false, we may have a code
      const code =
        (verifyResponse as any)?.responseCode ||
        (verifyResponse as any)?.data?.responseCode ||
        data?.ResponseCode ||
        null;

      const friendlyMessage = getMoamalatMessage(code, isArabic);

      if (!verifyResponse.success) {
        // Verification failed, so this is not a completed payment
        paymentCompletedRef.current = false;

        setMoamalatError(
          friendlyMessage || verifyResponse.message || t("Payment verification failed.", "فشل التحقق من الدفع."),
        );
        return;
      }

      setSuccessMessage(
        t(
          "Payment successful! Your subscription will be updated shortly.",
          "تمت عملية الدفع بنجاح! سيتم تحديث اشتراكك قريباً.",
        ),
      );

      await fetchVerificationStatus(true);
    } catch (error: any) {
      console.error("Moamalat verification failed:", error);

      paymentCompletedRef.current = false;

      const code = error?.response?.data?.responseCode || error?.response?.data?.data?.responseCode || null;

      setMoamalatError(
        getMoamalatMessage(code, isArabic) ||
          error?.response?.data?.message ||
          error?.message ||
          t("Payment verification failed.", "فشل التحقق من الدفع."),
      );
    } finally {
      setMoamalatLoading(false);
    }
  };

  const handleMoamalatPayment = async () => {
    setMoamalatError("");
    setPaymentError("");
    setSuccessMessage("");

    // Reset for this new attempt
    paymentCompletedRef.current = false;

    if (!user?.id) {
      setMoamalatError(t("User ID was not found.", "لم يتم العثور على معرف المستخدم."));
      return;
    }

    if (!moamalatReady || !window.Lightbox) {
      setMoamalatError(
        t("Payment gateway is not ready yet. Please try again.", "بوابة الدفع غير جاهزة بعد. يرجى المحاولة مرة أخرى."),
      );
      return;
    }

    try {
      setMoamalatLoading(true);

      const configResponse = await apiService.postProtectedData<{
        merchantCode: string;
        terminalId: string;
        amountTrxn: string;
        merchantReference: string;
        trxDateTime: string;
        secureHash: string;
      }>("/api/v1/payments/moamalat/initiate", {
        user_id: user.id,
        amount: SUBSCRIPTION_AMOUNT_LYD,
      });

      if (!configResponse.success || !configResponse.data) {
        throw new Error(configResponse.message || t("Failed to initiate payment.", "فشل بدء عملية الدفع."));
      }

      const config = configResponse.data;

      window.Lightbox.Checkout.configure = {
        MID: config.merchantCode,
        TID: config.terminalId,
        AmountTrxn: config.amountTrxn,
        MerchantReference: config.merchantReference,
        TrxDateTime: config.trxDateTime,
        SecureHash: config.secureHash,

        completeCallback: async (data: any) => {
          const inlineCode = data?.ResponseCode || data?.Response?.Code || null;
          const inlineMessage = data?.ResponseMessage || data?.Response?.Message || null;

          if (inlineCode && inlineCode !== "00") {
            setMoamalatError(
              getMoamalatMessage(inlineCode, isArabic) ||
                inlineMessage ||
                t("Transaction was declined.", "تم رفض العملية."),
            );
            setMoamalatLoading(false);
            return;
          }

          paymentCompletedRef.current = true; // mark success
          setMoamalatError(""); // clear any stale error
          await handleMoamalatCallback(data, "completed");
        },

        // The Lightbox can fire cancel when it closes after a successful payment,
        // so we ignore it once the payment has completed. The short delay also
        // covers the case where cancel fires just before complete.
        cancelCallback: () => {
          setTimeout(() => {
            if (paymentCompletedRef.current) return;

            setMoamalatError(t("Payment was cancelled.", "تم إلغاء عملية الدفع."));
            setMoamalatLoading(false);
          }, 800);
        },

        errorCallback: (error: any) => {
          console.error("Moamalat payment error:", error);

          if (paymentCompletedRef.current) return;

          setMoamalatError(t("An error occurred during payment.", "حدث خطأ أثناء عملية الدفع."));
          setMoamalatLoading(false);
        },
      };

      window.Lightbox.Checkout.showLightbox();
    } catch (error: any) {
      console.error("Moamalat initiation failed:", error);
      setMoamalatError(
        error?.response?.data?.message || error?.message || t("Failed to initiate payment.", "فشل بدء عملية الدفع."),
      );
      setMoamalatLoading(false);
    }
  };

  /* ---------------------------- Guards --------------------------------- */

  // Only wait for auth. Verification data never blocks the page.
  if (authLoading || !isAuthenticated || !user) return null;

  /* ------------------------- Derived display data ---------------------- */

  const idInfo = verificationStatus?.id;
  const idDocs = idInfo?.documents ?? [];

  const idPill =
    idInfo?.verified
      ? { tone: "green" as Tone, text: t("Verified", "تم التحقق") }
      : idInfo?.rejected
        ? { tone: "red" as Tone, text: t("Rejected", "مرفوض") }
        : idInfo?.uploaded
          ? { tone: "yellow" as Tone, text: t("Under Review", "قيد المراجعة") }
          : { tone: "gray" as Tone, text: t("Not Uploaded", "لم يتم الرفع") };

  const payInfo = verificationStatus?.payment;
  const payStatus = payInfo?.status;
  const payUploaded = !!payInfo?.uploaded;
  const isApproved = payStatus === "approved";

  const payPill = !payUploaded
    ? { tone: "gray" as Tone, text: t("Not Uploaded", "لم يتم الرفع") }
    : payStatus === "approved"
      ? { tone: "green" as Tone, text: t("Approved", "تمت الموافقة") }
      : payStatus === "rejected"
        ? { tone: "red" as Tone, text: t("Rejected", "مرفوض") }
        : { tone: "yellow" as Tone, text: t("Under Review", "قيد المراجعة") };

  const allPayments = verificationStatus?.all_payments || [];
  const moamalatPayments = allPayments.filter(isMoamalatPayment);
  const bankTransferPayments = allPayments.filter((p) => !isMoamalatPayment(p));

  const userStatus = String(user.status || "pending").toLowerCase();
  const userStatusTone: Tone = ["verified", "active", "approved"].includes(userStatus)
    ? "green"
    : ["suspended", "expired", "rejected"].includes(userStatus)
      ? "red"
      : "yellow";

  const initials =
    (user.name || "H")
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((p: string) => p.charAt(0).toUpperCase())
      .join("") || "H";

  const renderDocumentPreview = (doc: IDDocument, isRejected: boolean) => {
    if (!doc.file_url) return null;

    return (
      <div className="overflow-hidden rounded-xl bg-white p-2">
        {isImageFile(doc.file_url, doc.file_type) ? (
          <div className="flex justify-center">
            <img
              src={doc.file_url}
              alt={doc.file_name || "Document"}
              className={`max-h-72 w-auto max-w-full rounded-lg border object-contain ${
                isRejected ? "border-red-300 opacity-80" : "border-gray-200"
              }`}
              onError={(e) => {
                e.currentTarget.style.display = "none";
              }}
            />
          </div>
        ) : (
          <div className="flex flex-col items-center py-6 text-center">
            <div className="mb-2 text-4xl">📄</div>
            <p className="font-semibold text-gray-800">{doc.file_name || "Document"}</p>
            <p className="text-sm text-gray-500">{doc.file_type || "File"}</p>
            <a
              href={doc.file_url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 rounded-xl bg-[#1a1a2e] px-5 py-2.5 text-sm font-bold text-[#e8c547]"
            >
              {t("Open Document", "فتح الوثيقة")}
            </a>
          </div>
        )}
      </div>
    );
  };

  /* ---------------------------- Render --------------------------------- */

  return (
    <div
      className={`min-h-screen bg-gray-50 text-gray-900 ${isArabic ? "font-arabic" : "font-sans"}`}
      dir={isArabic ? "rtl" : "ltr"}
    >
      {/* Desktop navbar */}
      <div className="hidden md:block">
        <Navbar
          NAV_LINKS={NAV_LINKS}
          user={user}
          lang={lang}
          toggleLanguage={toggleLanguage}
          defaultActiveId="settings"
        />
      </div>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-30 flex items-center justify-between bg-[#1a1a2e] px-4 pb-3 pt-[calc(env(safe-area-inset-top)+12px)] md:hidden">
        <h1 className="text-lg font-semibold text-white">{t("Host Settings", "إعدادات المضيف")}</h1>
        <button
          onClick={toggleLanguage}
          className="rounded-full border border-white/20 px-3 py-1.5 text-xs font-medium text-white active:bg-white/10"
        >
          {isArabic ? "EN" : "عربي"}
        </button>
      </header>

      <main className="mx-auto max-w-3xl space-y-4 px-4 pb-28 pt-5 md:px-6 md:pb-12 md:pt-8">
        {/* Desktop header */}
        <div className="hidden md:block">
          <div className="mb-2 flex items-center gap-3 text-sm">
            <Link to="/host/dashboard" className="font-medium text-gray-500 hover:text-[#1a1a2e]">
              {t("Dashboard", "لوحة التحكم")}
            </Link>
            <span className="text-gray-300">/</span>
            <span className="font-medium text-gray-900">{t("Settings", "الإعدادات")}</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-[#1a1a2e]">{t("Host Settings", "إعدادات المضيف")}</h1>
          <p className="mt-2 text-gray-500">
            {t(
              "Manage your account information and verification documents.",
              "إدارة معلومات حسابك ووثائق التحقق.",
            )}
          </p>
        </div>

        {/* Mobile intro */}
        <p className="text-sm text-gray-500 md:hidden">
          {t("Manage your account information and verification documents.", "إدارة معلومات حسابك ووثائق التحقق.")}
        </p>

        {successMessage && (
          <div className="flex items-center gap-3 rounded-2xl bg-emerald-50 px-4 py-3.5 text-sm font-medium text-emerald-700">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-100">✓</span>
            <span>{successMessage}</span>
          </div>
        )}

        {/* ========================= 1. ACCOUNT INFORMATION ========================= */}
        <Card
          title={t("Account Information", "معلومات الحساب")}
          subtitle={t("Your basic account information.", "المعلومات الأساسية لحسابك.")}
        >
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-[#1a1a2e] text-lg font-bold text-[#e8c547]">
              {initials}
            </div>
            <div className="min-w-0">
              <p className="truncate text-lg font-bold">{user.name || "-"}</p>
              <Pill tone={userStatusTone}>{statusText(userStatus)}</Pill>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={t("Name", "الاسم")}>{user.name || "-"}</Field>
            <Field label={t("Email", "البريد الإلكتروني")}>{user.email || "-"}</Field>
            <Field label={t("Phone Number", "رقم الهاتف")}>
              <span dir="ltr">{user.phone_number || "-"}</span>
            </Field>
            <Field label={t("Account Type", "نوع الحساب")} capitalize>
              {user.role || "host"}
            </Field>
          </div>
        </Card>

        {/* ========================= 2. IDENTITY DOCUMENTS ========================= */}
        <Card
          title={t("Identity Documents", "وثائق الهوية")}
          subtitle={t("All uploaded identity documents.", "جميع وثائق الهوية المرفوعة.")}
          right={
            loadingVerification ? <Skeleton className="h-6 w-20 rounded-full" /> : <Pill tone={idPill.tone}>{idPill.text}</Pill>
          }
        >
          <div className="space-y-4">
            {loadingVerification && (
              <>
                <Skeleton className="h-40 w-full rounded-xl" />
                <Skeleton className="h-12 w-full rounded-xl" />
              </>
            )}

            {!loadingVerification && idDocs.length > 0 && (
              <div className="space-y-4">
                {idDocs.map((doc, index) => {
                  const s = doc.status?.toLowerCase();
                  const isRejected = s === "rejected";
                  const isLatest = index === idDocs.length - 1;

                  return (
                    <div
                      key={doc.id}
                      className={`overflow-hidden rounded-xl border p-3 ${
                        isRejected
                          ? "border-red-200 bg-red-50"
                          : isLatest
                            ? "border-blue-200 bg-blue-50"
                            : "border-gray-200 bg-gray-50"
                      }`}
                    >
                      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-semibold text-gray-700">#{index + 1}</span>
                          {doc.side && (
                            <span className="rounded-full bg-gray-200 px-2.5 py-1 text-xs font-medium text-gray-700">
                              {doc.side}
                            </span>
                          )}
                          {isLatest && !isRejected && <Pill tone="blue">{t("Latest", "الأحدث")}</Pill>}
                        </div>

                        <Pill tone={statusTone(doc.status)}>{doc.status ? statusText(doc.status) : t("Unknown", "غير معروف")}</Pill>
                      </div>

                      {renderDocumentPreview(doc, isRejected)}

                      <div className="mt-3 grid grid-cols-2 gap-3">
                        <Detail label={t("File Name", "اسم الملف")}>{doc.file_name || "-"}</Detail>
                        <Detail label={t("File Type", "نوع الملف")}>{doc.file_type || "-"}</Detail>
                        <Detail label={t("Upload Date", "تاريخ الرفع")}>{formatDate(doc.created_at) || "-"}</Detail>
                        {doc.reviewed_at && <Detail label={t("Review Date", "تاريخ المراجعة")}>{formatDate(doc.reviewed_at)}</Detail>}
                      </div>

                      {doc.rejection_reason && (
                        <div className="mt-3 rounded-lg border border-red-200 bg-red-100/50 p-3">
                          <p className="text-xs font-semibold text-red-800">{t("Rejection Reason", "سبب الرفض")}</p>
                          <p className="text-sm text-red-700">{doc.rejection_reason}</p>
                        </div>
                      )}

                      {doc.file_url && (
                        <a
                          href={doc.file_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-3 inline-flex items-center gap-2 text-sm font-medium text-[#1a1a2e] underline"
                        >
                          🔗 {t("Open document in new tab", "فتح الوثيقة في علامة تبويب جديدة")}
                        </a>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {!loadingVerification && idDocs.length === 0 && (
              <div className="rounded-xl bg-gray-50 p-8 text-center text-sm text-gray-500">
                {t("No identity documents uploaded yet.", "لم يتم رفع أي وثيقة هوية بعد.")}
              </div>
            )}

            {!loadingVerification && (
              <div>
                <input ref={idInputRef} type="file" accept={FILE_ACCEPT} onChange={handleUpload("id")} className="hidden" />

                <button
                  type="button"
                  onClick={() => uploading === null && idInputRef.current?.click()}
                  disabled={uploading === "id"}
                  className={`w-full rounded-xl border-2 border-dashed p-5 text-center transition active:scale-[0.99] disabled:cursor-not-allowed ${
                    uploading === "id"
                      ? "border-gray-200 bg-gray-50"
                      : idInfo?.rejected
                        ? "border-red-300 bg-red-50/50"
                        : "border-gray-300 bg-gray-50"
                  }`}
                >
                  {uploading === "id" ? (
                    <>
                      <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-[#1a1a2e]" />
                      <p className="font-semibold text-gray-700">{t("Uploading...", "جاري الرفع...")}</p>
                    </>
                  ) : (
                    <>
                      <p className="font-semibold text-gray-800">
                        📤{" "}
                        {idInfo?.rejected
                          ? t("Upload a new document", "رفع وثيقة جديدة")
                          : t("Upload identity document", "رفع وثيقة هوية")}
                      </p>
                      <p className="mt-1 text-xs text-gray-500">
                        {t("JPG, PNG, WEBP, PDF — up to 10 MB", "JPG, PNG, WEBP, PDF — حتى 10 ميجابايت")}
                      </p>
                    </>
                  )}
                </button>

                {idError && (
                  <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                    {idError}
                  </div>
                )}
              </div>
            )}
          </div>
        </Card>

        {/* ========================= 3. SUBSCRIPTION PAYMENT ========================= */}
        <Card
          title={t("Subscription Payment", "دفع الاشتراك")}
          subtitle={t(
            "Pay via Moamalat online or upload a bank transfer receipt.",
            "ادفع عبر معاملات مباشرة أو ارفع إيصال التحويل.",
          )}
          right={
            loadingVerification ? <Skeleton className="h-6 w-20 rounded-full" /> : <Pill tone={payPill.tone}>{payPill.text}</Pill>
          }
        >
          {loadingVerification ? (
            <div className="space-y-3">
              <Skeleton className="h-40 w-full rounded-xl" />
              <Skeleton className="h-12 w-full rounded-xl" />
            </div>
          ) : (
            <div className="space-y-6">
              {/* ---------- A. Online payment ---------- */}
              <div>
                <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-blue-700">
                  {t("A) Online Payment", "أ) الدفع الإلكتروني")}
                </p>

                <div className="rounded-2xl border border-blue-200 bg-gradient-to-br from-blue-50 to-indigo-50 p-4">
                  <div className="mb-4 flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-700">
                      💳
                    </div>
                    <div className="flex-1">
                      <h4 className="font-bold text-[#1a1a2e]">
                        {isApproved
                          ? t("Renew Subscription via Moamalat", "تجديد الاشتراك عبر معاملات")
                          : t("Pay Online via Moamalat", "الدفع الإلكتروني عبر معاملات")}
                      </h4>
                      <p className="mt-1 text-sm text-gray-600">
                        {isApproved
                          ? t(
                              "Your subscription is active. You can renew early to extend your period.",
                              "اشتراكك نشط حالياً. يمكنك التجديد مسبقاً لتمديد الفترة.",
                            )
                          : t(
                              "Pay your subscription fee directly using your bank card.",
                              "ادفع رسوم الاشتراك مباشرة باستخدام بطاقتك المصرفية.",
                            )}
                      </p>
                    </div>
                  </div>

                  <div className="mb-4 flex items-center justify-between rounded-xl border border-blue-200 bg-white px-4 py-3">
                    <span className="text-sm font-medium text-gray-600">{t("Amount Due", "المبلغ المطلوب")}</span>
                    <span className="text-lg font-bold text-[#1a1a2e]">{formatCurrency(SUBSCRIPTION_AMOUNT_LYD)}</span>
                  </div>

                  {isApproved && (
                    <div className="mb-4 flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                      <span>✓</span>
                      <span>
                        {t(
                          "Your current subscription is approved. Paying now will extend it for another period.",
                          "تمت الموافقة على اشتراكك الحالي. الدفع الآن سيمدد الاشتراك لفترة إضافية.",
                        )}
                      </span>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={handleMoamalatPayment}
                    disabled={moamalatLoading || !moamalatReady}
                    className={`flex min-h-[52px] w-full items-center justify-center gap-2 rounded-xl px-6 py-3 font-bold text-white transition active:scale-[0.98] ${
                      moamalatLoading || !moamalatReady
                        ? "cursor-not-allowed bg-gray-400"
                        : isApproved
                          ? "bg-gradient-to-r from-emerald-600 to-teal-600"
                          : "bg-gradient-to-r from-blue-600 to-indigo-600"
                    }`}
                  >
                    {moamalatLoading ? (
                      <>
                        <Spinner light />
                        <span>{t("Processing...", "جاري المعالجة...")}</span>
                      </>
                    ) : !moamalatReady ? (
                      <>
                        <Spinner light />
                        <span>{t("Loading...", "جاري التحميل...")}</span>
                      </>
                    ) : (
                      <>
                        <span>💳</span>
                        <span>
                          {isApproved
                            ? t("Renew with Moamalat", "تجديد الاشتراك عبر معاملات")
                            : t("Pay Now with Moamalat", "الدفع الآن عبر معاملات")}
                        </span>
                      </>
                    )}
                  </button>

                  {moamalatError && (
                    <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                      {moamalatError}
                    </div>
                  )}
                </div>

                {moamalatPayments.length > 0 && (
                  <div className="mt-4 space-y-3">
                    <p className="text-sm font-semibold text-gray-700">
                      {t("Previous Moamalat Payments", "مدفوعات معاملات السابقة")}
                    </p>

                    {moamalatPayments.map((p) => (
                      <div key={p.id} className="rounded-xl border border-blue-100 bg-blue-50/40 p-3">
                        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                          <span className="text-sm font-semibold text-[#1a1a2e]">💳 {getPaymentTypeLabel(p)}</span>
                          <Pill tone={statusTone(p.status)}>{statusText(p.status)}</Pill>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <Detail label={t("Amount", "المبلغ")}>{formatCurrency(p.amount)}</Detail>
                          <Detail label={t("Date", "التاريخ")}>{formatDate(p.created_at)}</Detail>
                          {p.reference && (
                            <Detail label={t("Reference", "المرجع")} wide>
                              <span className="font-mono text-xs" dir="ltr">
                                {p.reference}
                              </span>
                            </Detail>
                          )}
                          {p.notes && (
                            <Detail label={t("Notes", "ملاحظات")} wide>
                              {p.notes}
                            </Detail>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* ---------- Divider ---------- */}
              <div className="flex items-center gap-3">
                <div className="h-px flex-1 bg-gray-300" />
                <span className="text-xs font-semibold text-gray-500">{t("OR", "أو")}</span>
                <div className="h-px flex-1 bg-gray-300" />
              </div>

              {/* ---------- B. Bank transfer ---------- */}
              <div>
                <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-700">
                  {t("B) Bank Transfer", "ب) التحويل المصرفي")}
                </p>

                {payStatus !== "approved" && (
                  <>
                    <input
                      ref={paymentInputRef}
                      type="file"
                      accept={FILE_ACCEPT}
                      onChange={handleUpload("payment")}
                      className="hidden"
                    />

                    <button
                      type="button"
                      onClick={() => uploading === null && paymentInputRef.current?.click()}
                      disabled={uploading === "payment"}
                      className="w-full rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 p-5 text-center transition active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {uploading === "payment" ? (
                        <>
                          <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-[#1a1a2e]" />
                          <p className="font-semibold text-gray-700">{t("Uploading...", "جاري الرفع...")}</p>
                        </>
                      ) : (
                        <>
                          <p className="font-semibold text-gray-800">
                            📤 {t("Upload bank transfer receipt", "رفع إيصال التحويل المصرفي")}
                          </p>
                          <p className="mt-1 text-xs text-gray-500">
                            {t("JPG, PNG, WEBP, PDF — up to 10 MB", "JPG, PNG, WEBP, PDF — حتى 10 ميجابايت")}
                          </p>
                        </>
                      )}
                    </button>

                    {paymentError && (
                      <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                        {paymentError}
                      </div>
                    )}
                  </>
                )}

                {bankTransferPayments.length > 0 && (
                  <div className="mt-4 space-y-3">
                    <p className="text-sm font-semibold text-gray-700">{t("Uploaded Bank Receipts", "إيصالات التحويل المرفوعة")}</p>

                    {bankTransferPayments.map((p) => (
                      <div
                        key={p.id}
                        className={`rounded-xl border p-3 ${
                          p.status === "rejected"
                            ? "border-red-200 bg-red-50"
                            : p.status === "approved"
                              ? "border-emerald-200 bg-emerald-50"
                              : "border-gray-200 bg-white"
                        }`}
                      >
                        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                          <span className="text-sm font-semibold text-[#1a1a2e]">🏦 {getPaymentTypeLabel(p)}</span>
                          <Pill tone={statusTone(p.status)}>{statusText(p.status)}</Pill>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <Detail label={t("Amount", "المبلغ")}>{formatCurrency(p.amount)}</Detail>
                          <Detail label={t("Date", "التاريخ")}>{formatDate(p.created_at)}</Detail>
                          {p.notes && (
                            <Detail label={t("Notes", "ملاحظات")} wide>
                              {p.notes}
                            </Detail>
                          )}
                        </div>

                        {p.receipt_images && p.receipt_images.length > 0 && (
                          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
                            {p.receipt_images.map((url, idx) => (
                              <a
                                key={idx}
                                href={url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="overflow-hidden rounded-lg border border-gray-200"
                              >
                                <img
                                  src={url}
                                  alt={`Receipt ${idx + 1}`}
                                  className="h-24 w-full object-cover"
                                  onError={(e) => {
                                    e.currentTarget.src = NO_IMAGE_SVG;
                                  }}
                                />
                              </a>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* ---------- Latest payment status ---------- */}
              {payStatus === "approved" && (
                <div className="flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                    ✓
                  </div>
                  <div>
                    <h4 className="font-bold text-emerald-800">{t("Payment approved", "تمت الموافقة على الدفع")}</h4>
                    {payInfo?.approved_at && (
                      <p className="mt-1 text-sm text-emerald-700">
                        {t("Approved on", "تمت الموافقة في")} {formatDate(payInfo.approved_at)}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {payStatus === "rejected" && (
                <div className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-100 font-bold text-red-600">
                    !
                  </div>
                  <div>
                    <h4 className="font-bold text-red-800">{t("Payment rejected", "تم رفض الدفع")}</h4>
                    {payInfo?.rejection_reason && (
                      <p className="mt-2 text-sm leading-6 text-red-700">{payInfo.rejection_reason}</p>
                    )}
                  </div>
                </div>
              )}

              {payUploaded && payStatus === "pending" && (
                <div className="flex items-start gap-3 rounded-2xl border border-yellow-200 bg-yellow-50 p-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-yellow-100 text-yellow-700">
                    ⏳
                  </div>
                  <div>
                    <h4 className="font-bold text-yellow-800">{t("Under Review", "قيد المراجعة")}</h4>
                    {payInfo?.submitted_at && (
                      <p className="mt-1 text-sm text-yellow-700">
                        {t("Submitted on", "تم الإرسال في")} {formatDate(payInfo.submitted_at)}
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </Card>

        {/* ========================= 4. ACCOUNT STATUS ========================= */}
        <Card title={t("Account Status", "حالة الحساب")}>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-sm text-gray-500">{t("Current host status", "حالة المضيف الحالية")}</p>
              <p className="mt-1 text-lg font-bold capitalize">{user.status || "pending"}</p>
            </div>

            {user.host_expiry_date && (
              <div className="text-end">
                <p className="text-sm text-gray-500">{t("Host Expiry Date", "تاريخ انتهاء الاستضافة")}</p>
                <p className="mt-1 font-semibold">{formatDate(user.host_expiry_date)}</p>
              </div>
            )}
          </div>

          <div className="mt-4 rounded-xl border border-gray-200 bg-gray-50 p-3">
            <p className="text-sm font-semibold text-gray-700">{t("Verification Summary", "ملخص التحقق")}</p>

            <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
              <div className="flex items-center justify-between rounded-lg bg-white px-3 py-2.5">
                <span className="text-sm text-gray-600">{t("ID Documents", "وثائق الهوية")}</span>
                {loadingVerification ? (
                  <Skeleton className="h-4 w-6" />
                ) : (
                  <span className="text-sm font-semibold">{idDocs.length}</span>
                )}
              </div>

              <div className="flex items-center justify-between rounded-lg bg-white px-3 py-2.5">
                <span className="text-sm text-gray-600">{t("Payment Status", "حالة الدفع")}</span>
                {loadingVerification ? (
                  <Skeleton className="h-4 w-16" />
                ) : (
                  <span
                    className={`text-sm font-semibold capitalize ${
                      payStatus === "approved"
                        ? "text-emerald-600"
                        : payStatus === "rejected"
                          ? "text-red-600"
                          : "text-yellow-600"
                    }`}
                  >
                    {payStatus || "pending"}
                  </span>
                )}
              </div>

              <div className="flex items-center justify-between rounded-lg bg-white px-3 py-2.5">
                <span className="text-sm text-gray-600">{t("Overall Status", "الحالة العامة")}</span>
                {loadingVerification ? (
                  <Skeleton className="h-4 w-16" />
                ) : (
                  <span className="text-sm font-semibold capitalize">
                    {verificationStatus?.overall_status || "pending"}
                  </span>
                )}
              </div>
            </div>
          </div>
        </Card>
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
                  <span className={`text-xl ${active ? "" : "opacity-60 grayscale"}`}>{item.icon}</span>
                  {isArabic ? item.labelAr : item.label}
                  <span className={`h-1 w-1 rounded-full ${active ? "bg-[#e8c547]" : "bg-transparent"}`} />
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
};

export default HostSettings;