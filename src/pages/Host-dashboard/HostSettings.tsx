import React, { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useLanguage } from "../../hooks/useLanguage";
import LoadingScreen from "../../components/LoadingScreen";
import Navbar from "../../components/Navbar";
import { apiService } from "../../services/api";
import { compressImage } from "../../lib/compressImage";

// ============================================================
// MOAMALAT TYPES
// ============================================================
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

// ============================================================
// APP TYPES
// ============================================================
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

// ============================================================
// CONSTANTS
// ============================================================
const ACCEPTED_FILE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
  "image/heic",
  "image/heif",
];

const MAX_FILE_SIZE = 10 * 1024 * 1024;

// const MOAMALAT_SCRIPT_URL =
//   import.meta.env.MODE === "production"
//     ? "https://npg.moamalat.net:6006/js/lightbox.js"
//     : "https://tnpg.moamalat.net:6006/js/lightbox.js";

const MOAMALAT_SCRIPT_URL = "https://tnpg.moamalat.net:6006/js/lightbox.js";

const SUBSCRIPTION_AMOUNT_LYD = 500;

// ============================================================
// MOAMALAT RESPONSE CODE → USER-FRIENDLY MESSAGE
// ============================================================
const getMoamalatMessage = (
  code: string | null | undefined,
  isArabic: boolean,
) => {
  if (!code) return null;

  const messages: Record<string, { ar: string; en: string }> = {
    "05": {
      ar: "تم رفض العملية من قبل البنك.",
      en: "Transaction declined by the bank.",
    },
    "13": { ar: "المبلغ غير صالح.", en: "Invalid amount." },
    "14": { ar: "رقم البطاقة غير صحيح.", en: "Invalid card number." },
    "16": {
      ar: "رصيد غير كافٍ في حسابك.",
      en: "Insufficient funds in your account.",
    },
    "17": {
      ar: "تم إلغاء العملية.",
      en: "Transaction cancelled by the customer.",
    },
    "51": { ar: "رصيد غير كافٍ.", en: "Insufficient funds." },
    "54": { ar: "البطاقة منتهية الصلاحية.", en: "Card has expired." },
    "55": { ar: "الرقم السري غير صحيح.", en: "Incorrect PIN." },
    "57": {
      ar: "العملية غير مسموح بها لهذه البطاقة.",
      en: "Transaction not permitted for this card.",
    },
    "58": {
      ar: "العملية غير مسموح بها في هذا المتجر.",
      en: "Transaction not allowed at this terminal.",
    },
    "59": { ar: "يُشتبه في أنها عملية احتيال.", en: "Suspected fraud." },
    "61": {
      ar: "تم تجاوز الحد المسموح به.",
      en: "Activity amount limit exceeded.",
    },
    "62": { ar: "بطاقة مقيّدة.", en: "Restricted card." },
    "65": {
      ar: "تم تجاوز عدد العمليات المسموح بها.",
      en: "Activity count limit exceeded.",
    },
    "75": {
      ar: "تم تجاوز عدد محاولات إدخال الرقم السري.",
      en: "Too many PIN attempts.",
    },
    "82": {
      ar: "فشل التحقق من بيانات البطاقة.",
      en: "Card authentication failed.",
    },
    "91": {
      ar: "البنك المُصدر غير متاح حالياً. حاول لاحقاً.",
      en: "Issuer bank unavailable. Try again later.",
    },
    "96": {
      ar: "خطأ في النظام. حاول لاحقاً.",
      en: "System malfunction. Please try again later.",
    },
  };

  const entry = messages[code];
  if (!entry) return null;

  return isArabic ? entry.ar : entry.en;
};

// ============================================================
// COMPONENT
// ============================================================
const HostSettings: React.FC = () => {
  const navigate = useNavigate();

  const {
    user,
    isAuthenticated,
    isLoading: authLoading,
    updateVerificationStatus,
  } = useAuth();

  const { lang, toggleLanguage } = useLanguage();

  const idInputRef = useRef<HTMLInputElement | null>(null);
  const paymentInputRef = useRef<HTMLInputElement | null>(null);

  // ------------------------------------------------------------
  // STATE
  // ------------------------------------------------------------
  const [verificationStatus, setVerificationStatus] =
    useState<VerificationStatus | null>(null);
  const [loadingVerification, setLoadingVerification] = useState(true);
  const [uploadingID, setUploadingID] = useState(false);
  const [uploadingPayment, setUploadingPayment] = useState(false);
  const [idError, setIdError] = useState("");
  const [paymentError, setPaymentError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const [moamalatReady, setMoamalatReady] = useState(false);
  const [moamalatLoading, setMoamalatLoading] = useState(false);
  const [moamalatError, setMoamalatError] = useState("");

  const isArabic = lang === "ar";

  const NAV_LINKS = [
    {
      id: "listings",
      label: isArabic ? "إعلاناتي" : "My Listings",
      href: "/host/listings",
    },
    {
      id: "bookings",
      label: isArabic ? "الحجوزات" : "Bookings",
      href: "/host/bookings",
    },
    {
      id: "settings",
      label: isArabic ? "الإعدادات" : "Settings",
      href: "/host/settings",
    },
  ];

  // ============================================================
  // AUTH PROTECTION
  // ============================================================
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

  // ============================================================
  // FETCH VERIFICATION STATUS
  // ============================================================
  const fetchVerificationStatus = async () => {
    try {
      setLoadingVerification(true);
      setIdError("");
      setPaymentError("");

      const response = await apiService.getProtectedData<VerificationStatus>(
        "/api/v1/auth/host-verification-status",
      );

      console.log("✅ Verification API:", response);

      if (!response.success || !response.data) {
        throw new Error(
          response.message || "Failed to load verification status",
        );
      }

      setVerificationStatus(response.data);
      updateVerificationStatus?.(response.data);
    } catch (error: any) {
      console.error("❌ Failed to fetch verification status:", error);
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
  }, [authLoading, isAuthenticated, user?.id, user?.role]);

  // ============================================================
  // LOAD MOAMALAT SDK
  // ============================================================
  useEffect(() => {
    if (window.Lightbox) {
      setMoamalatReady(true);
      return;
    }

    const existingScript = document.querySelector(
      `script[src="${MOAMALAT_SCRIPT_URL}"]`,
    ) as HTMLScriptElement | null;

    if (existingScript) {
      if (window.Lightbox) {
        setMoamalatReady(true);
      } else {
        const handleLoad = () => setMoamalatReady(true);
        existingScript.addEventListener("load", handleLoad);
        return () => existingScript.removeEventListener("load", handleLoad);
      }
      return;
    }

    const script = document.createElement("script");
    script.src = MOAMALAT_SCRIPT_URL;
    script.async = true;
    script.onload = () => {
      console.log("✅ Moamalat Lightbox loaded");
      setMoamalatReady(true);
    };
    script.onerror = () => {
      console.error("❌ Failed to load Moamalat Lightbox");
      setMoamalatError(
        isArabic ? "فشل تحميل بوابة الدفع." : "Failed to load payment gateway.",
      );
    };
    document.body.appendChild(script);
  }, []);

  // ============================================================
  // PAYMENT CLASSIFICATION HELPERS
  // ============================================================
  const isMoamalatPayment = (p: HostSubscriptionPayment) => {
    if (p.reference && /^SUB-/i.test(p.reference)) return true;
    if (p.notes && /moamalat/i.test(p.notes)) return true;
    return false;
  };

  const getPaymentTypeLabel = (p: HostSubscriptionPayment) => {
    if (isMoamalatPayment(p)) {
      return isArabic ? "معاملات (بطاقة)" : "Moamalat (Card)";
    }
    return isArabic ? "تحويل مصرفي" : "Bank Transfer";
  };

  const getStatusBadge = (status: string) => {
    if (status === "approved") {
      return {
        text: isArabic ? "تمت الموافقة" : "Approved",
        className: "bg-emerald-100 text-emerald-700",
      };
    }
    if (status === "rejected") {
      return {
        text: isArabic ? "مرفوض" : "Rejected",
        className: "bg-red-100 text-red-700",
      };
    }
    return {
      text: isArabic ? "قيد المراجعة" : "Under Review",
      className: "bg-yellow-400/20 text-[#7a5c00]",
    };
  };

  const allPayments = verificationStatus?.all_payments || [];
  const moamalatPayments = allPayments.filter(isMoamalatPayment);
  const bankTransferPayments = allPayments.filter((p) => !isMoamalatPayment(p));

  // ============================================================
  // STATUS HELPERS
  // ============================================================
  const getIDStatus = () => {
    if (!verificationStatus?.id) {
      return {
        text: isArabic ? "لم يتم الرفع" : "Not Uploaded",
        className: "bg-gray-100 text-gray-600",
      };
    }

    if (verificationStatus.id.verified) {
      return {
        text: isArabic ? "تم التحقق" : "Verified",
        className: "bg-emerald-100 text-emerald-700",
      };
    }

    if (verificationStatus.id.rejected) {
      return {
        text: isArabic ? "مرفوض" : "Rejected",
        className: "bg-red-100 text-red-700",
      };
    }

    if (verificationStatus.id.uploaded) {
      return {
        text: isArabic ? "قيد المراجعة" : "Under Review",
        className: "bg-yellow-400/20 text-[#7a5c00]",
      };
    }

    return {
      text: isArabic ? "لم يتم الرفع" : "Not Uploaded",
      className: "bg-gray-100 text-gray-600",
    };
  };

  const getPaymentStatus = () => {
    if (!verificationStatus?.payment?.uploaded) {
      return {
        text: isArabic ? "لم يتم الرفع" : "Not Uploaded",
        className: "bg-gray-100 text-gray-600",
      };
    }

    if (verificationStatus.payment.status === "approved") {
      return {
        text: isArabic ? "تمت الموافقة" : "Approved",
        className: "bg-emerald-100 text-emerald-700",
      };
    }

    if (verificationStatus.payment.status === "rejected") {
      return {
        text: isArabic ? "مرفوض" : "Rejected",
        className: "bg-red-100 text-red-700",
      };
    }

    return {
      text: isArabic ? "قيد المراجعة" : "Under Review",
      className: "bg-yellow-400/20 text-[#7a5c00]",
    };
  };

  const idStatus = getIDStatus();
  const paymentStatus = getPaymentStatus();

  // ============================================================
  // FILE VALIDATION
  // ============================================================
  const validateFile = (file: File) => {
    if (!ACCEPTED_FILE_TYPES.includes(file.type)) {
      return isArabic
        ? "نوع الملف غير مدعوم. يرجى رفع JPG أو PNG أو WEBP أو PDF."
        : "Unsupported file type. Please upload JPG, PNG, WEBP, or PDF.";
    }

    if (file.size > MAX_FILE_SIZE) {
      return isArabic
        ? "حجم الملف يجب ألا يتجاوز 10 ميجابايت."
        : "File size must not exceed 10 MB.";
    }

    return null;
  };

  // ============================================================
  // ID UPLOAD
  // ============================================================
  const handleIDUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIdError("");
    setSuccessMessage("");

    const validationError = validateFile(file);
    if (validationError) {
      setIdError(validationError);
      if (idInputRef.current) idInputRef.current.value = "";
      return;
    }

    if (!user?.id) {
      setIdError(
        isArabic
          ? "لم يتم العثور على معرف المستخدم."
          : "User ID was not found.",
      );
      return;
    }

    try {
      setUploadingID(true);
      let fileToUpload: File = file;

      if (
        file.type.startsWith("image/") &&
        file.type !== "image/heic" &&
        file.type !== "image/heif"
      ) {
        try {
          fileToUpload = await compressImage(file);
        } catch (compressionError) {
          console.warn(
            "Image compression failed. Uploading original:",
            compressionError,
          );
          fileToUpload = file;
        }
      }

      const formData = new FormData();
      formData.append("image", fileToUpload);
      formData.append("user_id", user.id);

      const response = await apiService.postProtectedData(
        "/api/v1/uploads/ids",
        formData,
      );

      if (!response.success) {
        throw new Error(
          response.message || "Failed to upload identity document.",
        );
      }

      setSuccessMessage(
        isArabic
          ? "تم رفع وثيقة الهوية بنجاح."
          : "Identity document uploaded successfully.",
      );

      await fetchVerificationStatus();
    } catch (error: any) {
      console.error("ID upload failed:", error);
      setIdError(
        error?.response?.data?.message ||
          error?.message ||
          (isArabic
            ? "فشل رفع وثيقة الهوية."
            : "Failed to upload identity document."),
      );
    } finally {
      setUploadingID(false);
      if (idInputRef.current) idInputRef.current.value = "";
    }
  };

  // ============================================================
  // PAYMENT UPLOAD
  // ============================================================
  const handlePaymentUpload = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setPaymentError("");
    setSuccessMessage("");

    const validationError = validateFile(file);
    if (validationError) {
      setPaymentError(validationError);
      if (paymentInputRef.current) paymentInputRef.current.value = "";
      return;
    }

    if (!user?.id) {
      setPaymentError(
        isArabic
          ? "لم يتم العثور على معرف المستخدم."
          : "User ID was not found.",
      );
      return;
    }

    try {
      setUploadingPayment(true);
      let fileToUpload: File = file;

      if (
        file.type.startsWith("image/") &&
        file.type !== "image/heic" &&
        file.type !== "image/heif"
      ) {
        try {
          fileToUpload = await compressImage(file);
        } catch (compressionError) {
          console.warn("Payment image compression failed:", compressionError);
          fileToUpload = file;
        }
      }

      const formData = new FormData();
      formData.append("image", fileToUpload);
      formData.append("user_id", user.id);

      const response = await apiService.postProtectedData(
        "/api/v1/uploads/payments",
        formData,
      );

      if (!response.success) {
        throw new Error(
          response.message || "Failed to upload payment receipt.",
        );
      }

      setSuccessMessage(
        isArabic
          ? "تم رفع إيصال الدفع بنجاح."
          : "Payment receipt uploaded successfully.",
      );

      await fetchVerificationStatus();
    } catch (error: any) {
      console.error("Payment upload failed:", error);
      setPaymentError(
        error?.response?.data?.message ||
          error?.message ||
          (isArabic
            ? "فشل رفع إيصال الدفع."
            : "Failed to upload payment receipt."),
      );
    } finally {
      setUploadingPayment(false);
      if (paymentInputRef.current) paymentInputRef.current.value = "";
    }
  };

  // ============================================================
  // MOAMALAT PAYMENT
  // ============================================================
  const handleMoamalatPayment = async () => {
    setMoamalatError("");
    setPaymentError("");
    setSuccessMessage("");

    if (!user?.id) {
      setMoamalatError(
        isArabic
          ? "لم يتم العثور على معرف المستخدم."
          : "User ID was not found.",
      );
      return;
    }

    if (!moamalatReady || !window.Lightbox) {
      setMoamalatError(
        isArabic
          ? "بوابة الدفع غير جاهزة بعد. يرجى المحاولة مرة أخرى."
          : "Payment gateway is not ready yet. Please try again.",
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
        throw new Error(
          configResponse.message ||
            (isArabic ? "فشل بدء عملية الدفع." : "Failed to initiate payment."),
        );
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
          console.log("✅ Moamalat payment completed:", data);

          // Moamalat sometimes returns the code directly in the callback
          const inlineCode = data?.ResponseCode || data?.Response?.Code || null;
          const inlineMessage =
            data?.ResponseMessage || data?.Response?.Message || null;

          if (inlineCode && inlineCode !== "00") {
            const friendly = getMoamalatMessage(inlineCode, isArabic);
            setMoamalatError(
              friendly ||
                inlineMessage ||
                (isArabic ? "تم رفض العملية." : "Transaction was declined."),
            );
            setMoamalatLoading(false);
            return;
          }

          await handleMoamalatCallback(data, "completed");
        },

        cancelCallback: (data: any) => {
          console.log("⚠️ Moamalat payment cancelled:", data);
          setMoamalatError(
            isArabic ? "تم إلغاء عملية الدفع." : "Payment was cancelled.",
          );
          setMoamalatLoading(false);
        },

        errorCallback: (error: any) => {
          console.error("❌ Moamalat payment error:", error);
          setMoamalatError(
            isArabic
              ? "حدث خطأ أثناء عملية الدفع."
              : "An error occurred during payment.",
          );
          setMoamalatLoading(false);
        },
      };

      window.Lightbox.Checkout.showLightbox();
    } catch (error: any) {
      console.error("Moamalat initiation failed:", error);
      setMoamalatError(
        error?.response?.data?.message ||
          error?.message ||
          (isArabic ? "فشل بدء عملية الدفع." : "Failed to initiate payment."),
      );
      setMoamalatLoading(false);
    }
  };

  const handleMoamalatCallback = async (
    data: any,
    outcome: "completed" | "cancelled" | "failed",
  ) => {
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
        // Show the specific decline reason if we have one
        const fallback =
          verifyResponse.message ||
          (isArabic ? "فشل التحقق من الدفع." : "Payment verification failed.");

        setMoamalatError(friendlyMessage || fallback);
        return;
      }

      setSuccessMessage(
        isArabic
          ? "تمت عملية الدفع بنجاح! سيتم تحديث اشتراكك قريباً."
          : "Payment successful! Your subscription will be updated shortly.",
      );

      await fetchVerificationStatus();
    } catch (error: any) {
      console.error("Moamalat verification failed:", error);

      const code =
        error?.response?.data?.responseCode ||
        error?.response?.data?.data?.responseCode ||
        null;

      const friendlyMessage = getMoamalatMessage(code, isArabic);

      setMoamalatError(
        friendlyMessage ||
          error?.response?.data?.message ||
          error?.message ||
          (isArabic ? "فشل التحقق من الدفع." : "Payment verification failed."),
      );
    } finally {
      setMoamalatLoading(false);
    }
  };

  // ============================================================
  // FILE PICKERS
  // ============================================================
  const openIDPicker = () => {
    if (!uploadingID) idInputRef.current?.click();
  };

  const openPaymentPicker = () => {
    if (!uploadingPayment) paymentInputRef.current?.click();
  };

  // ============================================================
  // FORMATTERS
  // ============================================================
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
    if (amount === null || amount === undefined) {
      return isArabic ? "غير محدد" : "Not specified";
    }

    const num = typeof amount === "string" ? parseFloat(amount) : amount;

    if (Number.isNaN(num)) {
      return isArabic ? "غير محدد" : "Not specified";
    }

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

  // ============================================================
  // RENDER: DOCUMENT PREVIEW
  // ============================================================
  const renderDocumentPreview = (
    fileUrl: string | null | undefined,
    fileName: string | null | undefined,
    fileType: string | null | undefined,
    isRejected: boolean = false,
    customClass: string = "",
  ) => {
    if (!fileUrl) return null;

    return (
      <div className={`overflow-hidden rounded-xl bg-white p-3 ${customClass}`}>
        {isImageFile(fileUrl, fileType) ? (
          <div className="flex justify-center">
            <img
              src={fileUrl}
              alt={fileName || "Document"}
              className={`max-h-[400px] w-auto max-w-full rounded-lg border object-contain shadow-sm ${
                isRejected ? "border-red-300 opacity-80" : "border-gray-200"
              }`}
              onError={(e) => {
                e.currentTarget.style.display = "none";
              }}
            />
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="mb-3 text-5xl">📄</div>
            <p className="font-semibold text-gray-800">
              {fileName || "Document"}
            </p>
            <p className="text-sm text-gray-500">{fileType || "File"}</p>
            <a
              href={fileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 rounded-xl bg-[#1a1a2e] px-5 py-2 text-sm font-bold text-yellow-400 transition hover:bg-[#29294a]"
            >
              {isArabic ? "فتح الوثيقة" : "Open Document"}
            </a>
          </div>
        )}
      </div>
    );
  };

  // ============================================================
  // RENDER: MOAMALAT PAYMENT CARD
  // ============================================================
  const renderMoamalatPayment = () => {
    const isApproved = verificationStatus?.payment?.status === "approved";

    return (
      <div className="rounded-2xl border border-blue-200 bg-gradient-to-br from-blue-50 to-indigo-50 p-5">
        <div className="mb-4 flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-700">
            💳
          </div>
          <div className="flex-1">
            <h4 className="font-bold text-[#1a1a2e]">
              {isApproved
                ? isArabic
                  ? "تجديد الاشتراك عبر معاملات"
                  : "Renew Subscription via Moamalat"
                : isArabic
                  ? "الدفع الإلكتروني عبر معاملات"
                  : "Pay Online via Moamalat"}
            </h4>
            <p className="mt-1 text-sm text-gray-600">
              {isApproved
                ? isArabic
                  ? "اشتراكك نشط حالياً. يمكنك التجديد مسبقاً لتمديد الفترة."
                  : "Your subscription is active. You can renew early to extend your period."
                : isArabic
                  ? "ادفع رسوم الاشتراك مباشرة باستخدام بطاقتك المصرفية."
                  : "Pay your subscription fee directly using your bank card."}
            </p>
          </div>
        </div>

        <div className="mb-4 flex items-center justify-between rounded-xl border border-blue-200 bg-white px-4 py-3">
          <span className="text-sm font-medium text-gray-600">
            {isArabic ? "المبلغ المطلوب" : "Amount Due"}
          </span>
          <span className="text-lg font-bold text-[#1a1a2e]">
            {formatCurrency(SUBSCRIPTION_AMOUNT_LYD)}
          </span>
        </div>

        {isApproved && (
          <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            <div className="flex items-start gap-2">
              <span className="text-base">✓</span>
              <span>
                {isArabic
                  ? "تمت الموافقة على اشتراكك الحالي. الدفع الآن سيمدد الاشتراك لسنة إضافية."
                  : "Your current subscription is approved. Paying now will extend it for another year."}
              </span>
            </div>
          </div>
        )}

        <button
          type="button"
          onClick={handleMoamalatPayment}
          disabled={moamalatLoading || !moamalatReady}
          className={`flex w-full items-center justify-center gap-2 rounded-xl px-6 py-3 font-bold text-white transition ${
            moamalatLoading || !moamalatReady
              ? "cursor-not-allowed bg-gray-400"
              : isApproved
                ? "bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 hover:shadow-lg"
                : "bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 hover:shadow-lg"
          }`}
        >
          {moamalatLoading ? (
            <>
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
              <span>{isArabic ? "جاري المعالجة..." : "Processing..."}</span>
            </>
          ) : !moamalatReady ? (
            <>
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
              <span>{isArabic ? "جاري التحميل..." : "Loading..."}</span>
            </>
          ) : (
            <>
              <span>💳</span>
              <span>
                {isApproved
                  ? isArabic
                    ? "تجديد الاشتراك عبر معاملات"
                    : "Renew with Moamalat"
                  : isArabic
                    ? "الدفع الآن عبر معاملات"
                    : "Pay Now with Moamalat"}
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
    );
  };

  // ============================================================
  // RENDER: PAYMENT STATUS MESSAGE (latest overall)
  // ============================================================
  const renderPaymentStatusMessage = () => {
    const status = verificationStatus?.payment?.status;

    if (status === "approved") {
      return (
        <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
              ✓
            </div>
            <div>
              <h4 className="font-bold text-emerald-800">
                {isArabic ? "تمت الموافقة على الدفع" : "Payment approved"}
              </h4>
              {verificationStatus?.payment?.approved_at && (
                <p className="mt-1 text-sm text-emerald-700">
                  {isArabic
                    ? `تمت الموافقة في ${formatDate(
                        verificationStatus.payment.approved_at,
                      )}`
                    : `Approved on ${formatDate(
                        verificationStatus.payment.approved_at,
                      )}`}
                </p>
              )}
            </div>
          </div>
        </div>
      );
    }

    if (status === "rejected") {
      return (
        <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-5">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-100 font-bold text-red-600">
              !
            </div>
            <div>
              <h4 className="font-bold text-red-800">
                {isArabic ? "تم رفض الدفع" : "Payment rejected"}
              </h4>
              {verificationStatus?.payment?.rejection_reason && (
                <p className="mt-2 text-sm leading-6 text-red-700">
                  {verificationStatus.payment.rejection_reason}
                </p>
              )}
            </div>
          </div>
        </div>
      );
    }

    if (verificationStatus?.payment?.uploaded && status === "pending") {
      return (
        <div className="mt-4 rounded-2xl border border-yellow-200 bg-yellow-50 p-5">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-yellow-100 text-yellow-700">
              ⏳
            </div>
            <div>
              <h4 className="font-bold text-yellow-800">
                {isArabic ? "قيد المراجعة" : "Under Review"}
              </h4>
              {verificationStatus.payment.submitted_at && (
                <p className="mt-1 text-sm text-yellow-700">
                  {isArabic
                    ? `تم الإرسال في ${formatDate(
                        verificationStatus.payment.submitted_at,
                      )}`
                    : `Submitted on ${formatDate(
                        verificationStatus.payment.submitted_at,
                      )}`}
                </p>
              )}
            </div>
          </div>
        </div>
      );
    }

    return null;
  };

  // ============================================================
  // LOADING / AUTH GUARD
  // ============================================================
  if (authLoading || loadingVerification) {
    return <LoadingScreen />;
  }

  if (!isAuthenticated || !user) {
    return null;
  }

  // ============================================================
  // RENDER
  // ============================================================
  return (
    <div
      className={`min-h-screen bg-[#f8f9fb] text-gray-900 ${
        isArabic ? "font-[Arial]" : ""
      }`}
      dir={isArabic ? "rtl" : "ltr"}
    >
      <Navbar
        NAV_LINKS={NAV_LINKS}
        user={user}
        lang={lang}
        toggleLanguage={toggleLanguage}
        defaultActiveId="settings"
      />

      <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        {/* =====================================================
            HEADER
        ===================================================== */}
        <div className="mb-8">
          <div className="mb-2 flex items-center gap-3">
            <Link
              to="/host/dashboard"
              className="text-sm font-medium text-gray-500 transition hover:text-[#1a1a2e]"
            >
              {isArabic ? "لوحة التحكم" : "Dashboard"}
            </Link>
            <span className="text-gray-300">/</span>
            <span className="text-sm font-medium text-gray-900">
              {isArabic ? "الإعدادات" : "Settings"}
            </span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-[#1a1a2e]">
            {isArabic ? "إعدادات المضيف" : "Host Settings"}
          </h1>
          <p className="mt-2 text-gray-500">
            {isArabic
              ? "إدارة معلومات حسابك ووثائق التحقق."
              : "Manage your account information and verification documents."}
          </p>
        </div>

        {/* =====================================================
            SUCCESS MESSAGE
        ===================================================== */}
        {successMessage && (
          <div className="mb-6 rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm font-medium text-emerald-700">
            <div className="flex items-center gap-3">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-100">
                ✓
              </span>
              <span>{successMessage}</span>
            </div>
          </div>
        )}

        {/* =====================================================
            1. ACCOUNT INFORMATION
        ===================================================== */}
        <section className="mb-8 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-100 px-6 py-5">
            <h2 className="text-lg font-bold text-[#1a1a2e]">
              {isArabic ? "معلومات الحساب" : "Account Information"}
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              {isArabic
                ? "المعلومات الأساسية لحسابك."
                : "Your basic account information."}
            </p>
          </div>

          <div className="grid gap-5 p-6 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-semibold text-gray-700">
                {isArabic ? "الاسم" : "Name"}
              </label>
              <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-gray-700">
                {user.name || "-"}
              </div>
            </div>
            <div>
              <label className="mb-2 block text-sm font-semibold text-gray-700">
                {isArabic ? "البريد الإلكتروني" : "Email"}
              </label>
              <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-gray-700">
                {user.email || "-"}
              </div>
            </div>
            <div>
              <label className="mb-2 block text-sm font-semibold text-gray-700">
                {isArabic ? "رقم الهاتف" : "Phone Number"}
              </label>
              <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-gray-700">
                {user.phone_number || "-"}
              </div>
            </div>
            <div>
              <label className="mb-2 block text-sm font-semibold text-gray-700">
                {isArabic ? "نوع الحساب" : "Account Type"}
              </label>
              <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 capitalize text-gray-700">
                {user.role || "host"}
              </div>
            </div>
          </div>
        </section>

        {/* =====================================================
            2. VERIFICATION DOCUMENTS
        ===================================================== */}
        <section className="mb-8 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-100 px-6 py-5">
            <h2 className="text-lg font-bold text-[#1a1a2e]">
              {isArabic ? "وثائق التحقق" : "Verification Documents"}
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              {isArabic
                ? "جميع وثائق التحقق وحالتها."
                : "All verification documents and their status."}
            </p>
          </div>

          <div className="space-y-8 p-6">
            {/* ---------------------------------------------
                2.1 IDENTITY DOCUMENTS
            --------------------------------------------- */}
            <div>
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="font-bold text-gray-900">
                    {isArabic ? "وثائق الهوية" : "Identity Documents"}
                  </h3>
                  <p className="mt-1 text-sm text-gray-500">
                    {isArabic
                      ? "جميع وثائق الهوية المرفوعة."
                      : "All uploaded identity documents."}
                  </p>
                </div>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-bold ${idStatus.className}`}
                >
                  {idStatus.text}
                </span>
              </div>

              {verificationStatus?.id?.documents &&
              verificationStatus.id.documents.length > 0 ? (
                <div className="space-y-4">
                  {verificationStatus.id.documents.map((doc, index) => {
                    const isRejected = doc.status?.toLowerCase() === "rejected";
                    const isPending = doc.status?.toLowerCase() === "pending";
                    const isVerified = doc.status?.toLowerCase() === "verified";
                    const isLatest =
                      index === verificationStatus.id.documents!.length - 1;

                    let statusColor = "bg-gray-100 text-gray-600";
                    let statusText = doc.status || "Unknown";

                    if (isRejected) {
                      statusColor = "bg-red-100 text-red-700";
                    } else if (isPending) {
                      statusColor = "bg-yellow-400/20 text-[#7a5c00]";
                    } else if (isVerified) {
                      statusColor = "bg-emerald-100 text-emerald-700";
                    }

                    return (
                      <div
                        key={doc.id}
                        className={`overflow-hidden rounded-xl border p-4 transition ${
                          isRejected
                            ? "border-red-200 bg-red-50"
                            : isLatest
                              ? "border-blue-200 bg-blue-50"
                              : "border-gray-200 bg-gray-50"
                        }`}
                      >
                        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-3">
                            <span className="text-sm font-semibold text-gray-700">
                              #{index + 1}
                            </span>
                            {doc.side && (
                              <span className="rounded-full bg-gray-200 px-3 py-1 text-xs font-medium text-gray-700">
                                {doc.side}
                              </span>
                            )}
                            {isLatest && !isRejected && (
                              <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-bold text-blue-700">
                                {isArabic ? "الأحدث" : "Latest"}
                              </span>
                            )}
                          </div>
                          <span
                            className={`rounded-full px-3 py-1 text-xs font-bold ${statusColor}`}
                          >
                            {statusText}
                          </span>
                        </div>

                        {renderDocumentPreview(
                          doc.file_url,
                          doc.file_name,
                          doc.file_type,
                          isRejected,
                        )}

                        <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                          <div>
                            <p className="text-xs text-gray-500">
                              {isArabic ? "اسم الملف" : "File Name"}
                            </p>
                            <p className="font-medium text-gray-800">
                              {doc.file_name || "-"}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500">
                              {isArabic ? "نوع الملف" : "File Type"}
                            </p>
                            <p className="font-medium text-gray-800">
                              {doc.file_type || "-"}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500">
                              {isArabic ? "تاريخ الرفع" : "Upload Date"}
                            </p>
                            <p className="font-medium text-gray-800">
                              {formatDate(doc.created_at)}
                            </p>
                          </div>
                          {doc.reviewed_at && (
                            <div>
                              <p className="text-xs text-gray-500">
                                {isArabic ? "تاريخ المراجعة" : "Review Date"}
                              </p>
                              <p className="font-medium text-gray-800">
                                {formatDate(doc.reviewed_at)}
                              </p>
                            </div>
                          )}
                        </div>

                        {doc.rejection_reason && (
                          <div className="mt-3 rounded-lg border border-red-200 bg-red-100/50 p-3">
                            <p className="text-xs font-semibold text-red-800">
                              {isArabic ? "سبب الرفض" : "Rejection Reason"}
                            </p>
                            <p className="text-sm text-red-700">
                              {doc.rejection_reason}
                            </p>
                          </div>
                        )}

                        {doc.file_url && (
                          <div className="mt-3">
                            <a
                              href={doc.file_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-2 text-sm font-medium text-[#1a1a2e] hover:underline"
                            >
                              🔗{" "}
                              {isArabic
                                ? "فتح الوثيقة في علامة تبويب جديدة"
                                : "Open document in new tab"}
                            </a>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="rounded-xl border border-gray-200 bg-gray-50 p-8 text-center">
                  <p className="text-gray-500">
                    {isArabic
                      ? "لم يتم رفع أي وثيقة هوية بعد."
                      : "No identity documents uploaded yet."}
                  </p>
                </div>
              )}

              <div className="mt-4">
                <input
                  ref={idInputRef}
                  type="file"
                  accept=".jpg,.jpeg,.png,.webp,.pdf,.heic,.heif,image/jpeg,image/png,image/webp,application/pdf,image/heic,image/heif"
                  onChange={handleIDUpload}
                  className="hidden"
                />

                <button
                  type="button"
                  onClick={openIDPicker}
                  disabled={uploadingID}
                  className={`w-full rounded-xl border-2 border-dashed p-6 text-center transition ${
                    uploadingID
                      ? "cursor-not-allowed border-gray-200 bg-gray-50"
                      : verificationStatus?.id?.rejected
                        ? "border-red-300 bg-red-50/50 hover:border-red-400 hover:bg-red-50"
                        : "border-gray-300 bg-gray-50 hover:border-[#1a1a2e] hover:bg-gray-100"
                  }`}
                >
                  {uploadingID ? (
                    <>
                      <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-[#1a1a2e]" />
                      <p className="font-semibold text-gray-700">
                        {isArabic ? "جاري الرفع..." : "Uploading..."}
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="font-semibold text-gray-800">
                        {verificationStatus?.id?.rejected
                          ? isArabic
                            ? "📤 رفع وثيقة جديدة"
                            : "📤 Upload a new document"
                          : isArabic
                            ? "📤 رفع وثيقة هوية"
                            : "📤 Upload identity document"}
                      </p>
                      <p className="mt-1 text-xs text-gray-500">
                        {isArabic
                          ? "JPG, PNG, WEBP, PDF — حتى 10 ميجابايت"
                          : "JPG, PNG, WEBP, PDF — up to 10 MB"}
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
            </div>

            {/* Divider */}
            <div className="h-px bg-gray-100" />

            {/* ---------------------------------------------
                2.2 SUBSCRIPTION PAYMENT
            --------------------------------------------- */}
            <div>
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="font-bold text-gray-900">
                    {isArabic ? "دفع الاشتراك" : "Subscription Payment"}
                  </h3>
                  <p className="mt-1 text-sm text-gray-500">
                    {isArabic
                      ? "ادفع عبر معاملات مباشرة أو ارفع إيصال التحويل."
                      : "Pay via Moamalat online or upload a bank transfer receipt."}
                  </p>
                </div>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-bold ${paymentStatus.className}`}
                >
                  {paymentStatus.text}
                </span>
              </div>

              {/* ============================================
                  A. PAY ONLINE VIA MOAMALAT
              ============================================ */}
              <div className="mb-6">
                <div className="mb-3 flex items-center gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wide text-blue-700">
                    {isArabic ? "أ) الدفع الإلكتروني" : "A) Online Payment"}
                  </span>
                </div>

                {renderMoamalatPayment()}

                {/* Existing Moamalat payments list */}
                {moamalatPayments.length > 0 && (
                  <div className="mt-4 space-y-3">
                    <p className="text-sm font-semibold text-gray-700">
                      {isArabic
                        ? "مدفوعات معاملات السابقة"
                        : "Previous Moamalat Payments"}
                    </p>

                    {moamalatPayments.map((p) => {
                      const badge = getStatusBadge(p.status);
                      return (
                        <div
                          key={p.id}
                          className="rounded-xl border border-blue-100 bg-blue-50/40 p-4"
                        >
                          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                            <span className="text-sm font-semibold text-[#1a1a2e]">
                              💳 {getPaymentTypeLabel(p)}
                            </span>
                            <span
                              className={`rounded-full px-3 py-1 text-xs font-bold ${badge.className}`}
                            >
                              {badge.text}
                            </span>
                          </div>

                          <div className="grid grid-cols-2 gap-2 text-sm">
                            <div>
                              <p className="text-xs text-gray-500">
                                {isArabic ? "المبلغ" : "Amount"}
                              </p>
                              <p className="font-medium text-gray-900">
                                {formatCurrency(p.amount)}
                              </p>
                            </div>
                            <div>
                              <p className="text-xs text-gray-500">
                                {isArabic ? "التاريخ" : "Date"}
                              </p>
                              <p className="font-medium text-gray-900">
                                {formatDate(p.created_at)}
                              </p>
                            </div>
                            {p.reference && (
                              <div className="col-span-2">
                                <p className="text-xs text-gray-500">
                                  {isArabic ? "المرجع" : "Reference"}
                                </p>
                                <p className="truncate font-mono text-xs text-gray-700">
                                  {p.reference}
                                </p>
                              </div>
                            )}
                            {p.notes && (
                              <div className="col-span-2">
                                <p className="text-xs text-gray-500">
                                  {isArabic ? "ملاحظات" : "Notes"}
                                </p>
                                <p className="text-xs text-gray-700">
                                  {p.notes}
                                </p>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Divider between online payment and bank transfer */}
              <div className="my-6 flex items-center gap-3">
                <div className="h-px flex-1 bg-gray-300" />
                <span className="text-xs font-semibold text-gray-500">
                  {isArabic ? "أو" : "OR"}
                </span>
                <div className="h-px flex-1 bg-gray-300" />
              </div>

              {/* ============================================
                  B. UPLOAD BANK TRANSFER RECEIPT
              ============================================ */}
              <div>
                <div className="mb-3 flex items-center gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wide text-gray-700">
                    {isArabic ? "ب) التحويل المصرفي" : "B) Bank Transfer"}
                  </span>
                </div>

                {verificationStatus?.payment?.status !== "approved" && (
                  <>
                    <input
                      ref={paymentInputRef}
                      type="file"
                      accept=".jpg,.jpeg,.png,.webp,.pdf,.heic,.heif,image/jpeg,image/png,image/webp,application/pdf,image/heic,image/heif"
                      onChange={handlePaymentUpload}
                      className="hidden"
                    />

                    <button
                      type="button"
                      onClick={openPaymentPicker}
                      disabled={uploadingPayment}
                      className="w-full rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 p-6 text-center transition hover:border-[#1a1a2e] hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {uploadingPayment ? (
                        <>
                          <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-[#1a1a2e]" />
                          <p className="font-semibold text-gray-700">
                            {isArabic ? "جاري الرفع..." : "Uploading..."}
                          </p>
                        </>
                      ) : (
                        <>
                          <p className="font-semibold text-gray-800">
                            📤{" "}
                            {isArabic
                              ? "رفع إيصال التحويل المصرفي"
                              : "Upload bank transfer receipt"}
                          </p>
                          <p className="mt-1 text-xs text-gray-500">
                            {isArabic
                              ? "JPG, PNG, WEBP, PDF — حتى 10 ميجابايت"
                              : "JPG, PNG, WEBP, PDF — up to 10 MB"}
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

                {/* Bank transfer receipts list */}
                {bankTransferPayments.length > 0 && (
                  <div className="mt-4 space-y-3">
                    <p className="text-sm font-semibold text-gray-700">
                      {isArabic
                        ? "إيصالات التحويل المرفوعة"
                        : "Uploaded Bank Receipts"}
                    </p>

                    {bankTransferPayments.map((p) => {
                      const badge = getStatusBadge(p.status);
                      return (
                        <div
                          key={p.id}
                          className={`rounded-xl border p-4 ${
                            p.status === "rejected"
                              ? "border-red-200 bg-red-50"
                              : p.status === "approved"
                                ? "border-emerald-200 bg-emerald-50"
                                : "border-gray-200 bg-white"
                          }`}
                        >
                          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                            <span className="text-sm font-semibold text-[#1a1a2e]">
                              🏦 {getPaymentTypeLabel(p)}
                            </span>
                            <span
                              className={`rounded-full px-3 py-1 text-xs font-bold ${badge.className}`}
                            >
                              {badge.text}
                            </span>
                          </div>

                          <div className="grid grid-cols-2 gap-2 text-sm">
                            <div>
                              <p className="text-xs text-gray-500">
                                {isArabic ? "المبلغ" : "Amount"}
                              </p>
                              <p className="font-medium text-gray-900">
                                {formatCurrency(p.amount)}
                              </p>
                            </div>
                            <div>
                              <p className="text-xs text-gray-500">
                                {isArabic ? "التاريخ" : "Date"}
                              </p>
                              <p className="font-medium text-gray-900">
                                {formatDate(p.created_at)}
                              </p>
                            </div>
                            {p.notes && (
                              <div className="col-span-2">
                                <p className="text-xs text-gray-500">
                                  {isArabic ? "ملاحظات" : "Notes"}
                                </p>
                                <p className="text-xs text-gray-700">
                                  {p.notes}
                                </p>
                              </div>
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
                                  className="group overflow-hidden rounded-lg border border-gray-200"
                                >
                                  <img
                                    src={url}
                                    alt={`Receipt ${idx + 1}`}
                                    className="h-24 w-full object-cover transition group-hover:scale-105"
                                    onError={(e) => {
                                      e.currentTarget.src =
                                        "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Crect width='200' height='200' fill='%23f3f4f6'/%3E%3Ctext x='50%25' y='50%25' font-family='Arial' font-size='14' fill='%239ca3af' text-anchor='middle' dy='.3em'%3ENo Image%3C/text%3E%3C/svg%3E";
                                    }}
                                  />
                                </a>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Latest payment status message */}
              {renderPaymentStatusMessage()}
            </div>
          </div>
        </section>

        {/* =====================================================
            3. ACCOUNT STATUS
        ===================================================== */}
        <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-100 px-6 py-5">
            <h2 className="text-lg font-bold text-[#1a1a2e]">
              {isArabic ? "حالة الحساب" : "Account Status"}
            </h2>
          </div>

          <div className="p-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-sm text-gray-500">
                  {isArabic ? "حالة المضيف الحالية" : "Current host status"}
                </p>
                <p className="mt-1 text-lg font-bold capitalize text-gray-900">
                  {user.status || "pending"}
                </p>
              </div>
              {user.hostExpiryDate && (
                <div className="text-left">
                  <p className="text-sm text-gray-500">
                    {isArabic ? "تاريخ انتهاء الاستضافة" : "Host Expiry Date"}
                  </p>
                  <p className="mt-1 font-semibold text-gray-900">
                    {formatDate(user.hostExpiryDate)}
                  </p>
                </div>
              )}
            </div>

            <div className="mt-4 rounded-xl border border-gray-200 bg-gray-50 p-4">
              <p className="text-sm font-semibold text-gray-700">
                {isArabic ? "ملخص التحقق" : "Verification Summary"}
              </p>
              <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
                <div className="flex items-center justify-between rounded-lg bg-white px-3 py-2">
                  <span className="text-sm text-gray-600">
                    {isArabic ? "وثائق الهوية" : "ID Documents"}
                  </span>
                  <span className="text-sm font-semibold">
                    {verificationStatus?.id?.documents?.length || 0}
                  </span>
                </div>
                <div className="flex items-center justify-between rounded-lg bg-white px-3 py-2">
                  <span className="text-sm text-gray-600">
                    {isArabic ? "حالة الدفع" : "Payment Status"}
                  </span>
                  <span
                    className={`text-sm font-semibold capitalize ${
                      verificationStatus?.payment?.status === "approved"
                        ? "text-emerald-600"
                        : verificationStatus?.payment?.status === "rejected"
                          ? "text-red-600"
                          : "text-yellow-600"
                    }`}
                  >
                    {verificationStatus?.payment?.status || "pending"}
                  </span>
                </div>
                <div className="flex items-center justify-between rounded-lg bg-white px-3 py-2">
                  <span className="text-sm text-gray-600">
                    {isArabic ? "الحالة العامة" : "Overall Status"}
                  </span>
                  <span className="text-sm font-semibold capitalize">
                    {verificationStatus?.overall_status || "pending"}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
};

export default HostSettings;
