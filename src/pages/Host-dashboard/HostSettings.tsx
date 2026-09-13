import React, { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useLanguage } from "../../hooks/useLanguage";
import LoadingScreen from "../../components/LoadingScreen";
import Navbar from "../../components/Navbar";
import { apiService } from "../../services/api";
import { compressImage } from "../../lib/compressImage";

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
  receipt_images: string[]; // Array of image URLs
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
    // NEW: Full payment object
    payment?: HostSubscriptionPayment | null;
  };
  overall_status?: string;
}

const ACCEPTED_FILE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
  "image/heic",
  "image/heif",
];

const MAX_FILE_SIZE = 10 * 1024 * 1024;

const NAV_LINKS = [
  {
    href: "/host-dashboard",
    label: "Dashboard",
    labelAr: "لوحة التحكم",
  },
  {
    href: "/host/listings",
    label: "My Listings",
    labelAr: "إعلاناتي",
  },
  {
    href: "/host/settings",
    label: "Settings",
    labelAr: "الإعدادات",
  },
];




const HostSettings: React.FC = () => {
  const navigate = useNavigate();

  const {
    user,
    isAuthenticated,
    isLoading: authLoading,
    updateVerificationStatus,
  } = useAuth();

  const { lang, toggleLanguage } = useLanguage();
  const isArabic = lang === "ar";

  const idInputRef = useRef<HTMLInputElement | null>(null);
  const paymentInputRef = useRef<HTMLInputElement | null>(null);

  const [verificationStatus, setVerificationStatus] =
    useState<VerificationStatus | null>(null);
  const [loadingVerification, setLoadingVerification] = useState(true);
  const [uploadingID, setUploadingID] = useState(false);
  const [uploadingPayment, setUploadingPayment] = useState(false);
  const [idUploadDone, setIdUploadDone] = useState(false);
  const [paymentUploadDone, setPaymentUploadDone] = useState(false);
  const [idError, setIdError] = useState("");
  const [paymentError, setPaymentError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  /*
   * ------------------------------------------------------------
   * AUTH PROTECTION
   * ------------------------------------------------------------
   */
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

  /*
   * ------------------------------------------------------------
   * FETCH VERIFICATION STATUS
   * ------------------------------------------------------------
   */
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

      const status = response.data;
      setVerificationStatus(status);
      setIdUploadDone(Boolean(status.id?.uploaded));
      setPaymentUploadDone(Boolean(status.payment?.uploaded));
      updateVerificationStatus?.(status);
    } catch (error: any) {
      console.error("❌ Failed to fetch verification status:", error);
      setVerificationStatus(null);

      if (error?.message === "UNAUTHORIZED") {
        navigate("/login", {
          replace: true,
        });
        return;
      }
    } finally {
      setLoadingVerification(false);
    }
  };

  useEffect(() => {
    if (authLoading || !isAuthenticated || !user) {
      return;
    }

    if (String(user.role || "").toLowerCase() !== "host") {
      return;
    }

    fetchVerificationStatus();
  }, [authLoading, isAuthenticated, user?.id, user?.role]);

  /*
   * ------------------------------------------------------------
   * ID STATUS
   * ------------------------------------------------------------
   */
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

  /*
   * ------------------------------------------------------------
   * PAYMENT STATUS
   * ------------------------------------------------------------
   */
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

  /*
   * ------------------------------------------------------------
   * FIND REJECTED ID DOCUMENT
   * ------------------------------------------------------------
   */
  const rejectedIDDocuments =
    verificationStatus?.id?.documents?.filter(
      (document) => String(document.status || "").toLowerCase() === "rejected",
    ) || [];

  const rejectedIDDocument =
    rejectedIDDocuments.length > 0
      ? rejectedIDDocuments[rejectedIDDocuments.length - 1]
      : null;

  const rejectedIDUrl = rejectedIDDocument?.file_url || null;
  const rejectedIDReason =
    rejectedIDDocument?.rejection_reason ||
    verificationStatus?.id?.rejection_reason ||
    null;

  /*
   * ------------------------------------------------------------
   * FIND CURRENT DOCUMENT
   * ------------------------------------------------------------
   */
  const currentIDDocument =
    verificationStatus?.id?.documents &&
    verificationStatus.id.documents.length > 0
      ? verificationStatus.id.documents[
          verificationStatus.id.documents.length - 1
        ]
      : null;

  /*
   * ------------------------------------------------------------
   * FILE VALIDATION
   * ------------------------------------------------------------
   */
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

  /*
   * ------------------------------------------------------------
   * ID UPLOAD
   * ------------------------------------------------------------
   */
  const handleIDUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIdError("");
    setSuccessMessage("");

    const validationError = validateFile(file);
    if (validationError) {
      setIdError(validationError);
      if (idInputRef.current) {
        idInputRef.current.value = "";
      }
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
      setIdUploadDone(true);
      await fetchVerificationStatus();
    } catch (error: any) {
      console.error("ID upload failed:", error);
      const message =
        error?.response?.data?.message ||
        error?.message ||
        (isArabic
          ? "فشل رفع وثيقة الهوية."
          : "Failed to upload identity document.");
      setIdError(message);
    } finally {
      setUploadingID(false);
      if (idInputRef.current) {
        idInputRef.current.value = "";
      }
    }
  };

  /*
   * ------------------------------------------------------------
   * PAYMENT UPLOAD
   * ------------------------------------------------------------
   */
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
      if (paymentInputRef.current) {
        paymentInputRef.current.value = "";
      }
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
      setPaymentUploadDone(true);
      await fetchVerificationStatus();
    } catch (error: any) {
      console.error("Payment upload failed:", error);
      const message =
        error?.response?.data?.message ||
        error?.message ||
        (isArabic
          ? "فشل رفع إيصال الدفع."
          : "Failed to upload payment receipt.");
      setPaymentError(message);
    } finally {
      setUploadingPayment(false);
      if (paymentInputRef.current) {
        paymentInputRef.current.value = "";
      }
    }
  };

  /*
   * ------------------------------------------------------------
   * OPEN FILE PICKERS
   * ------------------------------------------------------------
   */
  const openIDPicker = () => {
    if (!uploadingID) {
      idInputRef.current?.click();
    }
  };

  const openPaymentPicker = () => {
    if (!uploadingPayment) {
      paymentInputRef.current?.click();
    }
  };

  /*
   * ------------------------------------------------------------
   * FORMAT DATE
   * ------------------------------------------------------------
   */
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

  /*
   * ------------------------------------------------------------
   * FORMAT CURRENCY
   * ------------------------------------------------------------
   */
  const formatCurrency = (amount: number | null | undefined) => {
    if (amount === null || amount === undefined) {
      return isArabic ? "غير محدد" : "Not specified";
    }

    return new Intl.NumberFormat(isArabic ? "ar-LY" : "en-US", {
      style: "currency",
      currency: "LYD",
      maximumFractionDigits: 2,
    }).format(amount);
  };

  /*
   * ------------------------------------------------------------
   * CHECK IF URL IS AN IMAGE
   * ------------------------------------------------------------
   */
  const isImageFile = (url: string, fileType?: string | null) => {
    if (fileType?.startsWith("image/")) return true;
    return /\.(jpg|jpeg|png|webp|gif|bmp|heic|heif)$/i.test(url);
  };

  /*
   * ------------------------------------------------------------
   * RENDER DOCUMENT PREVIEW
   * ------------------------------------------------------------
   */
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

  /*
   * ------------------------------------------------------------
   * RENDER PAYMENT RECEIPT IMAGES
   * ------------------------------------------------------------
   */
  const renderPaymentReceipts = () => {
    const payment = verificationStatus?.payment?.payment;
    if (!payment || !payment.receipt_images || payment.receipt_images.length === 0) {
      return null;
    }

    const isRejected = payment.status === "rejected";

    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-gray-700">
            {isArabic ? "صور الإيصال" : "Receipt Images"}
          </span>
          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
            {payment.receipt_images.length}
          </span>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {payment.receipt_images.map((imageUrl, index) => (
            <div
              key={index}
              className={`overflow-hidden rounded-xl border ${
                isRejected ? "border-red-200 bg-red-50" : "border-gray-200 bg-white"
              } p-3 transition hover:shadow-md`}
            >
              {/* Image Preview */}
              <div className="overflow-hidden rounded-lg">
                <img
                  src={imageUrl}
                  alt={`Receipt ${index + 1}`}
                  className={`h-48 w-full object-cover transition hover:scale-105 ${
                    isRejected ? "opacity-75" : ""
                  }`}
                  onError={(e) => {
                    e.currentTarget.src =
                      "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Crect width='200' height='200' fill='%23f3f4f6'/%3E%3Ctext x='50%25' y='50%25' font-family='Arial' font-size='14' fill='%239ca3af' text-anchor='middle' dy='.3em'%3ENo Image%3C/text%3E%3C/svg%3E";
                  }}
                />
              </div>

              {/* Image Info */}
              <div className="mt-2 space-y-1">
                <p className="text-sm font-medium text-gray-800">
                  {isArabic ? `صورة ${index + 1}` : `Image ${index + 1}`}
                </p>
                <a
                  href={imageUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-[#1a1a2e] hover:underline"
                >
                  🔗{" "}
                  {isArabic ? "فتح الصورة" : "Open image"}
                </a>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  /*
   * ------------------------------------------------------------
   * LOADING
   * ------------------------------------------------------------
   */
  if (authLoading || loadingVerification) {
    return <LoadingScreen />;
  }

  if (!isAuthenticated || !user) {
    return null;
  }

  return (
    <div
      className={`min-h-screen bg-[#f8f9fb] text-gray-900 ${
        isArabic ? "font-[Arial]" : ""
      }`}
      dir={isArabic ? "rtl" : "ltr"}
    >
      {/* ========================================================
          NAVBAR
      ======================================================== */}
      <Navbar
        NAV_LINKS={NAV_LINKS}
        user={user}
        lang={lang}
        toggleLanguage={toggleLanguage}
      />

      {/* ========================================================
          MAIN
      ======================================================== */}
      <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Header */}
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

        {/* ========================================================
            SUCCESS MESSAGE
        ======================================================== */}
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

        {/* ========================================================
            ACCOUNT INFORMATION
        ======================================================== */}
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

        {/* ========================================================
            VERIFICATION DOCUMENTS
        ======================================================== */}
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
            {/* ====================================================
                SECTION 1: ALL ID DOCUMENTS
            ==================================================== */}
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
                    const isRejected =
                      doc.status?.toLowerCase() === "rejected";
                    const isPending =
                      doc.status?.toLowerCase() === "pending";
                    const isVerified =
                      doc.status?.toLowerCase() === "verified";
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

            {/* ====================================================
                SECTION 2: PAYMENT RECEIPT WITH MULTIPLE IMAGES
            ==================================================== */}
            <div>
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="font-bold text-gray-900">
                    {isArabic ? "إيصال الدفع" : "Payment Receipt"}
                  </h3>
                  <p className="mt-1 text-sm text-gray-500">
                    {isArabic
                      ? "إيصال الدفع الخاص بالاشتراك مع الصور."
                      : "Subscription payment receipt with images."}
                  </p>
                </div>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-bold ${paymentStatus.className}`}
                >
                  {paymentStatus.text}
                </span>
              </div>

              {/* ==================================================
                  PAYMENT DETAILS
              ================================================== */}
              {verificationStatus?.payment?.payment && (
                <div className="mb-4 rounded-2xl border border-gray-200 bg-white p-4">
                  {/* Payment Info Grid */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-xs text-gray-500">
                        {isArabic ? "المبلغ" : "Amount"}
                      </p>
                      <p className="font-bold text-gray-900">
                        {formatCurrency(verificationStatus.payment.amount)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">
                        {isArabic ? "الحالة" : "Status"}
                      </p>
                      <span
                        className={`inline-block rounded-full px-2 py-0.5 text-xs font-bold ${
                          verificationStatus.payment.status === "approved"
                            ? "bg-emerald-100 text-emerald-700"
                            : verificationStatus.payment.status === "rejected"
                            ? "bg-red-100 text-red-700"
                            : "bg-yellow-100 text-yellow-700"
                        }`}
                      >
                        {verificationStatus.payment.status}
                      </span>
                    </div>
                    {verificationStatus.payment.payment.paid_at && (
                      <div>
                        <p className="text-xs text-gray-500">
                          {isArabic ? "تاريخ الدفع" : "Paid At"}
                        </p>
                        <p className="text-sm text-gray-900">
                          {formatDate(verificationStatus.payment.payment.paid_at)}
                        </p>
                      </div>
                    )}
                    {verificationStatus.payment.payment.period_start && (
                      <div>
                        <p className="text-xs text-gray-500">
                          {isArabic ? "بداية الفترة" : "Period Start"}
                        </p>
                        <p className="text-sm text-gray-900">
                          {formatDate(verificationStatus.payment.payment.period_start)}
                        </p>
                      </div>
                    )}
                    {verificationStatus.payment.payment.period_end && (
                      <div>
                        <p className="text-xs text-gray-500">
                          {isArabic ? "نهاية الفترة" : "Period End"}
                        </p>
                        <p className="text-sm text-gray-900">
                          {formatDate(verificationStatus.payment.payment.period_end)}
                        </p>
                      </div>
                    )}
                    {verificationStatus.payment.payment.reference && (
                      <div className="col-span-2">
                        <p className="text-xs text-gray-500">
                          {isArabic ? "المرجع" : "Reference"}
                        </p>
                        <p className="text-sm font-mono text-gray-900">
                          {verificationStatus.payment.payment.reference}
                        </p>
                      </div>
                    )}
                    {verificationStatus.payment.payment.notes && (
                      <div className="col-span-2">
                        <p className="text-xs text-gray-500">
                          {isArabic ? "ملاحظات" : "Notes"}
                        </p>
                        <p className="text-sm text-gray-900">
                          {verificationStatus.payment.payment.notes}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ==================================================
                  PAYMENT RECEIPT IMAGES (MULTIPLE)
              ================================================== */}
              {renderPaymentReceipts()}

              {/* ==================================================
                  PAYMENT STATUS MESSAGE
              ================================================== */}
              {verificationStatus?.payment?.status === "approved" && (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                      ✓
                    </div>
                    <div>
                      <h4 className="font-bold text-emerald-800">
                        {isArabic
                          ? "تمت الموافقة على الدفع"
                          : "Payment approved"}
                      </h4>
                      {verificationStatus.payment.approved_at && (
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
              )}

              {verificationStatus?.payment?.status === "rejected" && (
                <div className="rounded-2xl border border-red-200 bg-red-50 p-5">
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-100 font-bold text-red-600">
                      !
                    </div>
                    <div>
                      <h4 className="font-bold text-red-800">
                        {isArabic ? "تم رفض الدفع" : "Payment rejected"}
                      </h4>
                      {verificationStatus.payment.rejection_reason && (
                        <p className="mt-2 text-sm leading-6 text-red-700">
                          {verificationStatus.payment.rejection_reason}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {verificationStatus?.payment?.uploaded &&
                verificationStatus.payment.status === "pending" && (
                  <div className="rounded-2xl border border-yellow-200 bg-yellow-50 p-5">
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
                )}

              {/* ==================================================
                  PAYMENT UPLOAD BUTTON
              ================================================== */}
              {verificationStatus?.payment?.status !== "approved" && (
                <div className="mt-4">
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
                          {verificationStatus?.payment?.status === "rejected"
                            ? isArabic
                              ? "📤 رفع إيصال جديد"
                              : "📤 Upload a new receipt"
                            : isArabic
                            ? "📤 رفع إيصال الدفع"
                            : "📤 Upload payment receipt"}
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
                </div>
              )}
            </div>
          </div>
        </section>

        {/* ========================================================
            HOST STATUS
        ======================================================== */}
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

            {/* Overall Status Summary */}
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