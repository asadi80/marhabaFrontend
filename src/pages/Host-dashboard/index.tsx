import React, { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { useAuth } from "../../context/AuthContext";
import { useLanguage } from "../../hooks/useLanguage";
import LoadingScreen from "../../components/LoadingScreen";
import Navbar from "../../components/Navbar";
import { apiService } from "../../services/api";
// import { uploadToCloudinary } from "../../lib/uploadToCloudinary";
// import { compressImage } from "../../lib/compressImage";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface HostDetails {
  rating?: number;
}

interface HostUser {
  id: string;
  name: string;
  email: string;
  role: "user" | "host" | "admin" | "super_admin";
  status?: string;
  phone_number?: string;
  email_verified?: boolean;
  created_at?: string;
  createdAt?: string;
  statusReason?: string;
  idVerificationUrl?: string;
  paymentReceiptUrl?: string;
  hostExpiryDate?: string;
  hostDetails?: HostDetails;
}

interface Listing {
  id: string;
  title?: string;
  location?: string;
  price?: number;
  is_active?: boolean;
}

interface Booking {
  id: string;
  listing_id?: string;
  listing?: Listing;
  check_in?: string;
  check_out?: string;
  guests?: number;
  total_price?: number | string;
  status?: string;
  created_at?: string;
  createdAt?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Avatar
// ─────────────────────────────────────────────────────────────────────────────

const AVATAR_PAL = [
  { bg: "#EEEDFE", color: "#3C3489" },
  { bg: "#E6F1FB", color: "#0C447C" },
  { bg: "#EAF3DE", color: "#27500A" },
  { bg: "#FAEEDA", color: "#633806" },
  { bg: "#E1F5EE", color: "#085041" },
  { bg: "#FBEAF0", color: "#72243E" },
];

const avi = (name?: string) =>
  AVATAR_PAL[(name?.charCodeAt(0) ?? 0) % AVATAR_PAL.length];

const initials = (name?: string) =>
  name
    ?.split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() ?? "H";

// Shared config for the two upload widgets (ID doc + payment receipt)
const ACCEPTED_FILE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
  "image/heic",
  "image/heif",
];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

const isHeicFile = (file: File) =>
  ["image/heic", "image/heif", "application/octet-stream", ""].includes(
    file.type,
  ) || /\.(heic|heif)$/i.test(file.name);

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export default function HostDashboard() {
  const navigate = useNavigate();
  const { user: authUser, isAuthenticated, isLoading: authLoading } = useAuth();
  const { lang, toggleLanguage } = useLanguage();
  const isAr = lang === "ar";
  const user = authUser as HostUser | null;

  // ─────────────────────────────────────────────────────────────────────────
  // State
  // ─────────────────────────────────────────────────────────────────────────

  const [stats, setStats] = useState({
    totalListings: 0,
    totalBookings: 0,
    confirmedBookings: 0,
    totalEarnings: 0,
    rating: 0,
  });
  const [loading, setLoading] = useState(true);

  // ID upload
  const [idFile, setIdFile] = useState<File | null>(null);
  const [idPreview, setIdPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadDone, setUploadDone] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Payment receipt upload
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null);
  const [receiptUploading, setReceiptUploading] = useState(false);
  const [receiptUploaded, setReceiptUploaded] = useState(false);
  const [receiptError, setReceiptError] = useState("");
  const [receiptDragOver, setReceiptDragOver] = useState(false);
  const receiptInputRef = useRef<HTMLInputElement | null>(null);

  // ─────────────────────────────────────────────────────────────────────────
  // Authentication
  // ─────────────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated || !user) {
      navigate("/login", { replace: true });
      return;
    }
    if (user.role !== "host") {
      navigate("/user-dashboard", { replace: true });
    }
  }, [authLoading, isAuthenticated, user, navigate]);

  // ─────────────────────────────────────────────────────────────────────────
  // Fetch host dashboard data
  // ─────────────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (authLoading || !isAuthenticated || !user) return;
    if (user.role !== "host") return;

    const loadDashboard = async () => {
      try {
        const [listingsResponse, bookingsResponse] = await Promise.all([
          apiService.getProtectedData<{ listings?: Listing[] }>(
            "/api/host/listings",
          ),
          apiService.getProtectedData<{ bookings?: Booking[] }>(
            "/api/bookings",
          ),
        ]);

        let listings: Listing[] = [];
        if (listingsResponse.success && listingsResponse.data) {
          const data = listingsResponse.data;
          listings = Array.isArray(data) ? data : data.listings || [];
        }

        let bookings: Booking[] = [];
        if (bookingsResponse.success && bookingsResponse.data) {
          const data = bookingsResponse.data;
          bookings = Array.isArray(data) ? data : data.bookings || [];
        }

        const confirmed = bookings.filter(
          (booking) => booking.status === "confirmed",
        );
        const totalEarnings = confirmed.reduce(
          (sum, booking) =>
            sum + (parseFloat(String(booking.total_price ?? 0)) || 0),
          0,
        );

        setStats({
          totalListings: listings.length,
          totalBookings: bookings.length,
          confirmedBookings: confirmed.length,
          totalEarnings,
          rating: user.hostDetails?.rating || 0,
        });

        if (user.idVerificationUrl) setUploadDone(true);
        if (user.paymentReceiptUrl) setReceiptUploaded(true);
      } catch (error) {
        console.error("Failed to load host dashboard:", error);
      } finally {
        setLoading(false);
      }
    };

    loadDashboard();
  }, [authLoading, isAuthenticated, user]);

  // ─────────────────────────────────────────────────────────────────────────
  // Logout
  // ─────────────────────────────────────────────────────────────────────────

  const handleLogout = async () => {
    try {
      await apiService.postProtectedData("/api/auth/logout", {});
    } catch (error) {
      console.error("Logout error:", error);
    } finally {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      localStorage.removeItem("tokens");
      navigate("/login", { replace: true });
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // ID file
  // ─────────────────────────────────────────────────────────────────────────

  const handleFileChange = async (file?: File) => {
    if (!file) return;

    if (!ACCEPTED_FILE_TYPES.includes(file.type) && !isHeicFile(file)) {
      setUploadError(
        isAr
          ? "صيغة غير مدعومة. استخدم JPG أو PNG أو HEIC أو PDF."
          : "Unsupported format. Use JPG, PNG, HEIC or PDF.",
      );
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      setUploadError(
        isAr ? "الملف أكبر من 10 ميغابايت." : "File exceeds 10 MB.",
      );
      return;
    }

    try {
      setUploadError("");
      const converted = await compressImage(file);
      setIdFile(converted);
      setIdPreview(
        converted.type.startsWith("image/")
          ? URL.createObjectURL(converted)
          : null,
      );
    } catch (error) {
      console.error("File compression error:", error);
      setUploadError(isAr ? "فشل تجهيز الملف." : "Failed to process file.");
    }
  };

  const handleUploadID = async () => {
    if (!idFile) return;

    setUploading(true);
    setUploadError("");

    try {
      const fileToUpload = await compressImage(idFile);
      const { url: imageUrl, public_id } = await uploadToCloudinary(
        fileToUpload,
        "marhaba-hostId",
      );

      const saveResponse = await apiService.postProtectedData(
        "/api/host/upload-id",
        {
          idVerificationUrl: imageUrl,
          publicId: public_id,
        },
      );

      if (!saveResponse.success) {
        throw new Error(
          saveResponse.message || "Failed to save ID verification",
        );
      }

      setUploadDone(true);
      setIdFile(null);
      setIdPreview(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (error) {
      console.error("ID upload error:", error);
      setUploadError(
        isAr
          ? `فشل الرفع: ${error instanceof Error ? error.message : "خطأ غير معروف"}`
          : `Upload failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    } finally {
      setUploading(false);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Payment receipt file
  // ─────────────────────────────────────────────────────────────────────────

  const handleReceiptFileChange = async (file?: File) => {
    if (!file) return;

    if (!ACCEPTED_FILE_TYPES.includes(file.type) && !isHeicFile(file)) {
      setReceiptError(
        isAr
          ? "صيغة غير مدعومة. استخدم JPG أو PNG أو HEIC أو PDF."
          : "Unsupported format. Use JPG, PNG, HEIC or PDF.",
      );
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      setReceiptError(
        isAr ? "الملف أكبر من 10 ميغابايت." : "File exceeds 10 MB.",
      );
      return;
    }

    try {
      setReceiptError("");
      const converted = await compressImage(file);
      setReceiptFile(converted);
      setReceiptPreview(
        converted.type.startsWith("image/")
          ? URL.createObjectURL(converted)
          : null,
      );
    } catch (error) {
      console.error("Receipt compression error:", error);
      setReceiptError(
        isAr ? "فشل تجهيز إيصال الدفع." : "Failed to process payment receipt.",
      );
    }
  };

  const handleUploadReceipt = async () => {
    if (!receiptFile) return;

    setReceiptUploading(true);
    setReceiptError("");

    try {
      const fileToUpload = await compressImage(receiptFile);
      const { url: receiptUrl, public_id } = await uploadToCloudinary(
        fileToUpload,
        "marhaba-payment-receipts",
      );

      const saveResponse = await apiService.postProtectedData(
        "/api/host/upload-payment-receipt",
        {
          paymentReceiptUrl: receiptUrl,
          publicId: public_id,
        },
      );

      if (!saveResponse.success) {
        throw new Error(
          saveResponse.message || "Failed to save payment receipt",
        );
      }

      setReceiptUploaded(true);
      setReceiptFile(null);
      setReceiptPreview(null);
      if (receiptInputRef.current) receiptInputRef.current.value = "";
    } catch (error) {
      console.error("Payment receipt upload error:", error);
      setReceiptError(
        isAr
          ? `فشل الرفع: ${error instanceof Error ? error.message : "خطأ غير معروف"}`
          : `Upload failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    } finally {
      setReceiptUploading(false);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Loading / guard states
  // ─────────────────────────────────────────────────────────────────────────

  if (authLoading || loading) return <LoadingScreen />;
  if (!isAuthenticated || !user) return null;
  if (user.role !== "host") return null;

  // ─────────────────────────────────────────────────────────────────────────
  // Helpers
  // ─────────────────────────────────────────────────────────────────────────

  const userInitials = initials(user.name);
  const { bg: aviBg, color: aviColor } = avi(user.name);

  const displayFont = isAr
    ? { fontFamily: "'Cairo','Tajawal',sans-serif" }
    : { fontFamily: "'Fraunces',serif", fontStyle: "italic" as const };

  const formatCurrency = (n: number) =>
    isAr
      ? `${Math.round(n).toLocaleString()} دينار`
      : `${Math.round(n).toLocaleString()} LYD`;

  const NAV_LINKS = [
    {
      id: "listings",
      label: isAr ? "قوائمي" : "My Listings",
      href: "/host/listings",
    },
    {
      id: "bookings",
      label: isAr ? "الحجوزات" : "Bookings",
      href: "/host/bookings",
    },
  ];

  // ─────────────────────────────────────────────────────────────────────────
  // Pending / expired
  // ─────────────────────────────────────────────────────────────────────────

  if (user.status === "pending") {
    const isExpired = user.statusReason === "expired";
    const alreadyUploaded = uploadDone || !!user.idVerificationUrl;

    return (
      <div
        className="min-h-screen bg-[#f4f4f5]"
        dir={isAr ? "rtl" : "ltr"}
        style={isAr ? { fontFamily: "'Cairo','Tajawal',sans-serif" } : {}}
      >
        <Navbar
          NAV_LINKS={NAV_LINKS}
          user={user}
          lang={lang}
          toggleLanguage={toggleLanguage}
          onTabChange={() => {}}
        />

        <main className="max-w-[540px] mx-auto px-6 py-14">
          <div className="bg-white rounded-3xl overflow-hidden shadow-[0_8px_40px_rgba(0,0,0,0.08)]">
            {/* Header */}
            <div className="bg-gradient-to-br from-[#1a1a2e] to-[#2d2d5e] px-8 pt-10 pb-8 relative overflow-hidden">
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_80%_20%,rgba(232,197,71,0.15)_0%,transparent_60%)]" />
              <div
                className="absolute inset-0 opacity-[0.04]"
                style={{
                  backgroundImage:
                    "repeating-linear-gradient(45deg,#e8c547 0px,#e8c547 1px,transparent 1px,transparent 40px)",
                }}
              />

              <div className="relative flex flex-col items-center text-center">
                <div
                  className="w-16 h-16 rounded-full flex items-center justify-center text-[22px] font-semibold mb-4 border-2 border-[#e8c547]/40"
                  style={{ background: aviBg, color: aviColor }}
                >
                  {userInitials}
                </div>

                <span
                  className={`text-[11px] font-bold px-3.5 py-1 rounded-full tracking-widest uppercase mb-3 ${
                    isExpired
                      ? "bg-red-500/20 text-red-300 border border-red-500/30"
                      : "bg-[#e8c547]/15 text-[#e8c547] border border-[#e8c547]/30"
                  }`}
                >
                  {isExpired
                    ? isAr
                      ? "انتهت الصلاحية"
                      : "Expired"
                    : isAr
                      ? "قيد المراجعة"
                      : "Pending Approval"}
                </span>

                <h2
                  className="font-light text-[24px] text-white mb-2"
                  style={displayFont}
                >
                  {isExpired
                    ? isAr
                      ? "انتهت صلاحية اشتراكك"
                      : "Subscription Expired"
                    : isAr
                      ? "مرحباً بك في لوحة المضيف"
                      : "Welcome, Host"}
                </h2>

                <p className="text-[13px] text-white/50 leading-relaxed max-w-[340px]">
                  {alreadyUploaded
                    ? isAr
                      ? "تم استلام وثيقة الهوية. سيراجع الفريق حسابك ويُخطرك عند التفعيل."
                      : "Your ID has been received. Our team will review and notify you once approved."
                    : isAr
                      ? "لإتمام تسجيلك كمضيف، يرجى رفع صورة من وثيقة هويتك الرسمية."
                      : "To complete your host registration, please upload a copy of your official ID."}
                </p>
              </div>
            </div>

            {/* Body */}
            <div className="px-8 py-8">
              {alreadyUploaded ? (
                <div className="bg-[#EAF3DE] rounded-2xl p-6 text-center border border-[#27500A]/10">
                  <div className="text-4xl mb-3">✅</div>
                  <div className="text-[15px] font-semibold text-[#27500A] mb-1">
                    {isAr ? "تم رفع الهوية بنجاح" : "ID uploaded successfully"}
                  </div>
                  <div className="text-[12px] text-[#27500A]/60">
                    {isAr
                      ? "في انتظار موافقة الإدارة"
                      : "Awaiting admin approval"}
                  </div>
                </div>
              ) : (
                <>
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    onDragOver={(e) => {
                      e.preventDefault();
                      setDragOver(true);
                    }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setDragOver(false);
                      handleFileChange(e.dataTransfer.files[0]);
                    }}
                    className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all ${
                      dragOver
                        ? "border-[#e8c547] bg-[#e8c547]/5 scale-[1.01]"
                        : "border-gray-200 hover:border-[#e8c547] hover:bg-[#fdf8e7]"
                    }`}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp,application/pdf,image/heic,image/heif"
                      className="hidden"
                      onChange={(e) => handleFileChange(e.target.files?.[0])}
                    />

                    {idPreview ? (
                      <div>
                        <img
                          src={idPreview}
                          alt="ID preview"
                          className="max-h-36 max-w-full rounded-xl object-contain mb-3 mx-auto"
                        />
                        <div className="text-[12px] text-gray-500">
                          {idFile?.name}
                        </div>
                      </div>
                    ) : idFile ? (
                      <div>
                        <div className="text-[40px] mb-2">📄</div>
                        <div className="text-[12px] text-gray-500">
                          {idFile.name}
                        </div>
                      </div>
                    ) : (
                      <div>
                        <div className="w-14 h-14 rounded-2xl bg-[#1a1a2e] flex items-center justify-center text-2xl mx-auto mb-4">
                          🪪
                        </div>
                        <div className="text-[14px] font-semibold text-gray-700 mb-1">
                          {isAr
                            ? "اسحب الملف هنا أو انقر للاختيار"
                            : "Drag & drop or click to choose"}
                        </div>
                        <div className="text-[11px] text-gray-400">
                          {isAr
                            ? "JPG · PNG · PDF — بحد أقصى 10 ميغابايت"
                            : "JPG · PNG · PDF — max 10 MB"}
                        </div>
                      </div>
                    )}
                  </div>

                  {uploadError && (
                    <div className="mt-3 text-[12px] text-red-700 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                      {uploadError}
                    </div>
                  )}

                  <button
                    onClick={handleUploadID}
                    disabled={!idFile || uploading}
                    className="w-full mt-4 bg-[#1a1a2e] text-[#e8c547] border-none rounded-2xl py-3.5 px-6 text-[14px] font-semibold cursor-pointer transition-all hover:opacity-90 hover:-translate-y-px disabled:opacity-40 disabled:cursor-not-allowed disabled:translate-y-0"
                  >
                    {uploading ? (
                      <span className="flex items-center justify-center gap-2">
                        <span className="w-4 h-4 border-2 border-[#e8c547]/30 border-t-[#e8c547] rounded-full animate-spin" />
                        {isAr ? "جارٍ الرفع..." : "Uploading..."}
                      </span>
                    ) : isAr ? (
                      "رفع الهوية"
                    ) : (
                      "Submit ID for Verification"
                    )}
                  </button>

                  <p className="text-[11px] text-gray-400 text-center mt-3 leading-relaxed">
                    {isAr
                      ? "تُستخدم هذه الوثيقة للتحقق من هويتك فقط ولن تُشارك مع أطراف أخرى."
                      : "Used only for identity verification. Never shared with third parties."}
                  </p>
                </>
              )}

              {/* Payment receipt */}
              <div className="mt-8 pt-8 border-t border-gray-100">
                <div className="mb-4">
                  <div className="text-[14px] font-semibold text-gray-700">
                    {isAr ? "إيصال الدفع" : "Payment Receipt"}
                  </div>
                  <div className="text-[11px] text-gray-400 mt-1">
                    {isAr
                      ? "يرجى رفع صورة أو ملف إيصال الدفع الخاص بالاشتراك."
                      : "Please upload your subscription payment receipt."}
                  </div>
                </div>

                {receiptUploaded ? (
                  <div className="bg-[#EAF3DE] rounded-2xl p-6 text-center border border-[#27500A]/10">
                    <div className="text-4xl mb-3">✅</div>
                    <div className="text-[15px] font-semibold text-[#27500A] mb-1">
                      {isAr
                        ? "تم رفع إيصال الدفع بنجاح"
                        : "Payment receipt uploaded"}
                    </div>
                    <div className="text-[12px] text-[#27500A]/60">
                      {isAr
                        ? "تم استلام إيصال الدفع وسيتم مراجعته."
                        : "Your payment receipt has been received and will be reviewed."}
                    </div>
                  </div>
                ) : (
                  <>
                    <div
                      onClick={() => receiptInputRef.current?.click()}
                      onDragOver={(e) => {
                        e.preventDefault();
                        setReceiptDragOver(true);
                      }}
                      onDragLeave={() => setReceiptDragOver(false)}
                      onDrop={(e) => {
                        e.preventDefault();
                        setReceiptDragOver(false);
                        handleReceiptFileChange(e.dataTransfer.files[0]);
                      }}
                      className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all ${
                        receiptDragOver
                          ? "border-[#e8c547] bg-[#e8c547]/5 scale-[1.01]"
                          : "border-gray-200 hover:border-[#e8c547] hover:bg-[#fdf8e7]"
                      }`}
                    >
                      <input
                        ref={receiptInputRef}
                        type="file"
                        accept="image/jpeg,image/png,image/webp,application/pdf,image/heic,image/heif"
                        className="hidden"
                        onChange={(e) =>
                          handleReceiptFileChange(e.target.files?.[0])
                        }
                      />

                      {receiptPreview ? (
                        <div>
                          <img
                            src={receiptPreview}
                            alt="Payment receipt preview"
                            className="max-h-48 max-w-full rounded-xl object-contain mb-3 mx-auto"
                          />
                          <div className="text-[12px] text-gray-500">
                            {receiptFile?.name}
                          </div>
                        </div>
                      ) : receiptFile ? (
                        <div>
                          <div className="text-[40px] mb-2">🧾</div>
                          <div className="text-[12px] text-gray-500">
                            {receiptFile.name}
                          </div>
                        </div>
                      ) : (
                        <div>
                          <div className="w-14 h-14 rounded-2xl bg-[#1a1a2e] flex items-center justify-center text-2xl mx-auto mb-4">
                            🧾
                          </div>
                          <div className="text-[14px] font-semibold text-gray-700 mb-1">
                            {isAr
                              ? "اسحب إيصال الدفع هنا أو انقر للاختيار"
                              : "Drag & drop or click to choose receipt"}
                          </div>
                          <div className="text-[11px] text-gray-400">
                            {isAr
                              ? "JPG · PNG · PDF — بحد أقصى 10 ميغابايت"
                              : "JPG · PNG · PDF — max 10 MB"}
                          </div>
                        </div>
                      )}
                    </div>

                    {receiptError && (
                      <div className="mt-3 text-[12px] text-red-700 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                        {receiptError}
                      </div>
                    )}

                    <button
                      onClick={handleUploadReceipt}
                      disabled={!receiptFile || receiptUploading}
                      className="w-full mt-4 bg-[#1a1a2e] text-[#e8c547] border-none rounded-2xl py-3.5 px-6 text-[14px] font-semibold cursor-pointer transition-all hover:opacity-90 hover:-translate-y-px disabled:opacity-40 disabled:cursor-not-allowed disabled:translate-y-0"
                    >
                      {receiptUploading ? (
                        <span className="flex items-center justify-center gap-2">
                          <span className="w-4 h-4 border-2 border-[#e8c547]/30 border-t-[#e8c547] rounded-full animate-spin" />
                          {isAr
                            ? "جارٍ رفع الإيصال..."
                            : "Uploading receipt..."}
                        </span>
                      ) : isAr ? (
                        "رفع إيصال الدفع"
                      ) : (
                        "Submit Payment Receipt"
                      )}
                    </button>

                    <p className="text-[11px] text-gray-400 text-center mt-3 leading-relaxed">
                      {isAr
                        ? "سيتم استخدام الإيصال للتحقق من عملية الدفع."
                        : "The receipt will be used to verify your payment."}
                    </p>
                  </>
                )}
              </div>

              {/* Progress */}
              <div className="mt-8 pt-6 border-t border-gray-100">
                <div className="flex items-start">
                  {[
                    {
                      step: 1,
                      label: isAr ? "إنشاء الحساب" : "Create Account",
                      done: true,
                    },
                    {
                      step: 2,
                      label: isAr ? "رفع الهوية" : "Upload ID",
                      done: alreadyUploaded,
                    },
                    {
                      step: 3,
                      label: isAr ? "رفع أيصال الدفغ" : "Upload Payment",
                      done: alreadyUploaded,
                    },
                    {
                      step: 4,
                      label: isAr ? "موافقة الإدارة" : "Admin Approval",
                      done: false,
                    },
                    {
                      step: 5,
                      label: isAr ? "إضافة عقارات" : "Add Listings",
                      done: false,
                    },
                  ].map((s, i, arr) => (
                    <div
                      key={s.step}
                      className="flex-1 flex flex-col items-center relative"
                    >
                      {i < arr.length - 1 && (
                        <div
                          className={`absolute top-[14px] left-[calc(50%+14px)] right-[-calc(50%-14px)] h-0.5 ${
                            s.done ? "bg-[#1D9E75]" : "bg-gray-200"
                          }`}
                        />
                      )}
                      <div
                        className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold mb-2 relative z-10 transition-all ${
                          s.done
                            ? "bg-[#1D9E75] text-white"
                            : "bg-gray-100 text-gray-400"
                        }`}
                      >
                        {s.done ? "✓" : s.step}
                      </div>
                      <div
                        className={`text-[10px] text-center leading-tight ${
                          s.done
                            ? "text-[#27500A] font-medium"
                            : "text-gray-400"
                        }`}
                      >
                        {s.label}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Main dashboard
  // ─────────────────────────────────────────────────────────────────────────

  const avgPerBooking = stats.totalEarnings / (stats.confirmedBookings || 1);
  const pendingCount = stats.totalBookings - stats.confirmedBookings;
  const confirmationRate =
    stats.totalBookings > 0
      ? Math.round((stats.confirmedBookings / stats.totalBookings) * 100)
      : 0;

  return (
    <div
      className="min-h-screen bg-[#f4f4f5]"
      dir={isAr ? "rtl" : "ltr"}
      style={isAr ? { fontFamily: "'Cairo','Tajawal',sans-serif" } : {}}
    >
      <Navbar
        NAV_LINKS={NAV_LINKS}
        user={user}
        lang={lang}
        toggleLanguage={toggleLanguage}
        onTabChange={() => {}}
      />

      {/* PAGE HEADER */}
      <div className="bg-gradient-to-br from-[#1a1a2e] to-[#2d2d5e] relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_80%_50%,rgba(232,197,71,0.12)_0%,transparent_60%)] pointer-events-none" />
        <div
          className="absolute inset-0 opacity-[0.04] pointer-events-none"
          style={{
            backgroundImage:
              "repeating-linear-gradient(45deg,#e8c547 0px,#e8c547 1px,transparent 1px,transparent 40px)",
          }}
        />

        <div className="max-w-[1100px] mx-auto px-6 py-10 relative">
          <div className="flex items-center justify-between gap-6 flex-wrap">
            <div className="flex items-center gap-4">
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center text-[18px] font-semibold shrink-0 border border-white/10"
                style={{ background: aviBg, color: aviColor }}
              >
                {userInitials}
              </div>

              <div>
                <div className="text-[10px] tracking-[0.12em] uppercase text-[#e8c547]/60 mb-1">
                  {isAr ? "لوحة المضيف" : "Host Panel"}
                </div>

                <h1
                  className="font-light text-[clamp(22px,3vw,30px)] text-white leading-tight"
                  style={displayFont}
                >
                  {isAr
                    ? `مرحباً، ${user.name?.split(" ")[0]}`
                    : `Welcome back, ${user.name?.split(" ")[0]}`}
                </h1>

                <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                  <span className="text-[11px] text-white/40">
                    {isAr ? "تاريخ انتهاء الاشتراك:" : "Subscription expires:"}{" "}
                    <span className="text-white/60">
                      {user.hostExpiryDate
                        ? new Date(user.hostExpiryDate).toLocaleDateString()
                        : isAr
                          ? "غير متاح"
                          : "N/A"}
                    </span>
                  </span>

                  <span className="inline-flex items-center gap-1.5 bg-[#1D9E75]/20 border border-[#1D9E75]/30 text-[#1D9E75] text-[10px] font-semibold px-2.5 py-1 rounded-full">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#1D9E75]" />
                    {isAr ? "نشط" : "Active"}
                  </span>
                </div>
              </div>
            </div>

            <Link
              to="/host/listings"
              className="inline-flex items-center gap-2 bg-[#e8c547] text-[#1a1a2e] px-5 py-2.5 rounded-xl text-[13px] font-bold no-underline hover:bg-yellow-300 hover:-translate-y-px transition-all shrink-0"
            >
              + {isAr ? "إضافة قائمة" : "New Listing"}
            </Link>
          </div>
        </div>
      </div>

      <main className="max-w-[1100px] mx-auto px-4 md:px-6 py-8">
        {/* STAT CARDS */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          {[
            {
              label: isAr ? "القوائم النشطة" : "Active Listings",
              value: stats.totalListings,
              sub: isAr ? "عقار مدرج" : "listed properties",
              accent: "#378ADD",
              icon: "🏠",
            },
            {
              label: isAr ? "إجمالي الحجوزات" : "Total Bookings",
              value: stats.totalBookings,
              sub: `${stats.confirmedBookings} ${isAr ? "مؤكد" : "confirmed"}`,
              accent: "#7F77DD",
              icon: "📅",
            },
            {
              label: isAr ? "الأرباح المؤكدة" : "Confirmed Earnings",
              value: formatCurrency(stats.totalEarnings),
              sub: isAr ? "من الحجوزات المؤكدة" : "from confirmed bookings",
              accent: "#1D9E75",
              icon: "💰",
            },
            {
              label: isAr ? "تقييم المضيف" : "Host Rating",
              value: stats.rating ? stats.rating.toFixed(1) : "—",
              sub: isAr ? "متوسط التقييم" : "average score",
              accent: "#e8c547",
              icon: "⭐",
            },
          ].map(({ label, value, sub, accent, icon }) => (
            <div
              key={label}
              className="bg-white rounded-2xl border border-black/7 p-5 relative overflow-hidden group hover:-translate-y-0.5 hover:shadow-[0_12px_32px_rgba(0,0,0,0.08)] transition-all duration-200"
              style={{ borderTop: `3px solid ${accent}` }}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="text-[11px] tracking-[0.08em] uppercase text-gray-400 font-semibold leading-tight">
                  {label}
                </div>
                <span className="text-xl opacity-60">{icon}</span>
              </div>

              <div
                className="font-light text-[32px] leading-none text-[#111118] mb-1"
                style={displayFont}
              >
                {value}
              </div>

              <div className="text-[11px] text-gray-400">{sub}</div>
            </div>
          ))}
        </div>

        {/* MIDDLE */}
        <div className="grid grid-cols-1 md:grid-cols-[1fr_340px] gap-4 mb-4">
          {/* Booking summary */}
          <div className="bg-white rounded-2xl border border-black/7 p-6">
            <div className="flex items-center justify-between mb-5">
              <h2
                className="font-light text-[20px] text-[#111118]"
                style={displayFont}
              >
                {isAr ? "ملخص الحجوزات" : "Booking Summary"}
              </h2>
              <Link
                to="/host/bookings"
                className="text-[12px] text-[#185FA5] no-underline font-medium hover:underline"
              >
                {isAr ? "عرض الكل" : "View all"} →
              </Link>
            </div>

            <div className="grid grid-cols-3 gap-3">
              {[
                {
                  label: isAr ? "مؤكدة" : "Confirmed",
                  value: stats.confirmedBookings,
                  sub: isAr ? "جاهز للضيوف" : "Ready for guests",
                  bg: "#EAF3DE",
                  color: "#27500A",
                  border: "#1D9E75",
                },
                {
                  label: isAr ? "معلقة" : "Pending",
                  value: pendingCount,
                  sub: isAr ? "تنتظر الإجراء" : "Awaiting action",
                  bg: "#FAEEDA",
                  color: "#633806",
                  border: "#BA7517",
                },
                {
                  label: isAr ? "متوسط الحجز" : "Avg / Booking",
                  value: formatCurrency(avgPerBooking),
                  sub: isAr ? "من المؤكدة" : "From confirmed",
                  bg: "#E6F1FB",
                  color: "#0C447C",
                  border: "#378ADD",
                },
              ].map(({ label, value, sub, bg, color, border }) => (
                <div
                  key={label}
                  className="rounded-2xl p-4"
                  style={{ background: bg, borderTop: `3px solid ${border}` }}
                >
                  <div
                    className="font-light text-[28px] leading-none mb-1"
                    style={{ ...displayFont, color }}
                  >
                    {value}
                  </div>
                  <div
                    className="text-[11px] font-semibold uppercase tracking-wide mb-0.5"
                    style={{ color, opacity: 0.85 }}
                  >
                    {label}
                  </div>
                  <div className="text-[11px]" style={{ color, opacity: 0.55 }}>
                    {sub}
                  </div>
                </div>
              ))}
            </div>

            {/* Confirmation */}
            <div className="mt-5 pt-5 border-t border-gray-100">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] text-gray-400 uppercase tracking-widest font-semibold">
                  {isAr ? "نسبة التأكيد" : "Confirmation rate"}
                </span>
                <span className="text-[13px] font-semibold text-[#1D9E75]">
                  {stats.totalBookings > 0 ? `${confirmationRate}%` : "—"}
                </span>
              </div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#1D9E75] rounded-full transition-all duration-700"
                  style={{
                    width:
                      stats.totalBookings > 0 ? `${confirmationRate}%` : "0%",
                  }}
                />
              </div>
            </div>
          </div>

          {/* Quick actions */}
          <div className="flex flex-col gap-3">
            {[
              {
                href: "/host/listings",
                label: isAr ? "إدارة القوائم" : "Manage Listings",
                desc: isAr
                  ? "أضف أو عدّل أو أوقف عقاراتك"
                  : "Add, edit or pause your properties",
                accent: "#7F77DD",
                icon: "🏠",
              },
              {
                href: "/host/bookings",
                label: isAr ? "الحجوزات" : "View Bookings",
                desc: isAr
                  ? "تأكيد أو رفض طلبات الضيوف"
                  : "Confirm or decline guest requests",
                accent: "#1D9E75",
                icon: "📋",
              },
              {
                href: "/host-resources",
                label: isAr ? "موارد المضيف" : "Host Resources",
                desc: isAr
                  ? "أدلة ونصائح لتحسين أدائك"
                  : "Guides and tips to improve your hosting",
                accent: "#e8c547",
                icon: "📚",
              },
            ].map(({ href, label, desc, accent, icon }) => (
              <Link
                key={href}
                to={href}
                className="bg-white rounded-2xl border border-black/7 p-5 no-underline flex items-center gap-4 hover:-translate-y-0.5 hover:shadow-[0_8px_24px_rgba(0,0,0,0.07)] transition-all duration-200 group"
                style={{ borderLeft: `3px solid ${accent}` }}
              >
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0"
                  style={{ background: `${accent}18` }}
                >
                  {icon}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="text-[14px] font-semibold text-[#111118] mb-0.5">
                    {label}
                  </div>
                  <div className="text-[12px] text-gray-400 leading-snug">
                    {desc}
                  </div>
                </div>

                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 16 16"
                  fill="none"
                  className="shrink-0 opacity-30 group-hover:opacity-60 transition-opacity"
                >
                  <path
                    d={isAr ? "M10 3L5 8l5 5" : "M6 3l5 5-5 5"}
                    stroke="#111"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </Link>
            ))}
          </div>
        </div>

        {/* PROFILE */}
        <div className="bg-white rounded-2xl border border-black/7 p-5 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center text-[14px] font-semibold shrink-0"
              style={{ background: aviBg, color: aviColor }}
            >
              {userInitials}
            </div>
            <div>
              <div className="text-[14px] font-semibold text-[#111118]">
                {user.name}
              </div>
              <div className="text-[11px] text-gray-400">{user.email}</div>
            </div>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <Link
              to="/host/listings"
              className="text-[12px] text-[#185FA5] no-underline bg-[#E6F1FB] px-3.5 py-1.5 rounded-lg font-medium hover:opacity-85 transition-opacity"
            >
              {isAr ? "القوائم" : "Listings"}
            </Link>
            <button
              onClick={handleLogout}
              className="text-[12px] text-gray-500 bg-gray-100 border-none px-3.5 py-1.5 rounded-lg cursor-pointer font-[inherit] hover:bg-gray-200 transition-colors"
            >
              {isAr ? "تسجيل الخروج" : "Sign out"}
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
