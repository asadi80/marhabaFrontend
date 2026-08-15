// resend-verification.tsx - Update to handle URL params

import { useState, useEffect, type FormEvent, type ChangeEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useLanguage } from "../../hooks/useLanguage";

const API_URL = "https://api.mar-haba.ly";

interface ResendVerificationResponse {
  success?: boolean;
  message?: string;
  code?: string;
  data?: {
    tokenExpiry?: string;
    email?: string;
  };
}

export default function ResendVerificationPage() {
  const [searchParams] = useSearchParams();
  const [email, setEmail] = useState<string>("");
  const [message, setMessage] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [isSuccess, setIsSuccess] = useState<boolean>(false);

  const { lang } = useLanguage();
  const isAr = lang === "ar";

  // Auto-fill email from URL params
  useEffect(() => {
    const emailParam = searchParams.get("email");
    if (emailParam) {
      setEmail(emailParam);
    }
  }, [searchParams]);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!email.trim()) {
      setError(isAr ? "البريد الإلكتروني مطلوب" : "Email is required");
      return;
    }

    setLoading(true);
    setMessage("");
    setError("");
    setIsSuccess(false);

    try {
      const response = await fetch(
        `${API_URL}/api/v1/auth/resend-verification`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ email: email.trim() }),
        }
      );

      const data: ResendVerificationResponse = await response.json();

      if (response.ok) {
        setIsSuccess(true);
        setMessage(
          isAr
            ? "✓ تم إرسال بريد التحقق! يرجى التحقق من صندوق الوارد الخاص بك."
            : "✓ Verification email sent! Please check your inbox."
        );
        // Don't clear email so user can see what was sent to
      } else {
        if (data.code === "EMAIL_ALREADY_VERIFIED") {
          setError(
            isAr
              ? "هذا البريد الإلكتروني تم التحقق منه بالفعل. يمكنك تسجيل الدخول مباشرة."
              : "This email is already verified. You can login directly."
          );
        } else {
          setError(
            data.message ||
              (isAr
                ? "فشل إرسال بريد التحقق"
                : "Failed to send verification email")
          );
        }
      }
    } catch (err) {
      console.error("Resend verification error:", err);
      setError(
        isAr
          ? "حدث خطأ. يرجى المحاولة مرة أخرى."
          : "An error occurred. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleEmailChange = (e: ChangeEvent<HTMLInputElement>) => {
    setEmail(e.target.value);
    // Clear messages when user types
    if (message || error) {
      setMessage("");
      setError("");
      setIsSuccess(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f5f4f0] flex items-center justify-center px-4 py-12">
      <div className="max-w-md w-full">
        <div className="bg-white rounded-2xl shadow-xl p-8">

          {/* Header - English */}
          <div className="text-center mb-8">
            <div className="w-20 h-20 bg-[#1a1a2e] rounded-full flex items-center justify-center mx-auto mb-4">
              <svg
                className="w-10 h-10 text-[#e8c547]"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                />
              </svg>
            </div>

            <h2 className="text-2xl font-bold text-[#1a1a2e]">
              Resend Verification Email
            </h2>

            <p className="text-gray-500 mt-2">
              Enter your email to receive a new verification link
            </p>
          </div>

          {/* Divider */}
          <div className="border-t-2 border-[#e8c547]/30 my-6" />

          {/* Header - Arabic */}
          <div
            className="text-center mb-8"
            style={{ direction: "rtl" }}
          >
            <div className="w-20 h-20 bg-[#1a1a2e] rounded-full flex items-center justify-center mx-auto mb-4">
              <svg
                className="w-10 h-10 text-[#e8c547]"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                />
              </svg>
            </div>

            <h2 className="text-2xl font-bold text-[#1a1a2e]">
              إعادة إرسال بريد التحقق
            </h2>

            <p className="text-gray-500 mt-2">
              أدخل بريدك الإلكتروني لاستلام رابط تحقق جديد
            </p>
          </div>

          {/* Success Message */}
          {message && isSuccess && (
            <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg">
              <p className="text-sm text-green-700 font-medium">
                {message}
              </p>
              <p className="text-xs text-green-600 mt-1">
                {isAr
                  ? "لم تستلم البريد؟ تحقق من مجلد البريد المزعج (Spam)."
                  : "Didn't receive the email? Check your spam folder."}
              </p>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-[#1a1a2e] mb-2">
                Email Address / البريد الإلكتروني
              </label>

              <input
                type="email"
                required
                value={email}
                onChange={handleEmailChange}
                className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-[#e8c547] focus:border-transparent outline-none transition ${
                  error ? 'border-red-300' : 'border-gray-200'
                }`}
                placeholder="you@example.com"
                autoComplete="email"
                autoFocus
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#1a1a2e] text-[#e8c547] py-3 rounded-xl font-bold hover:opacity-90 transition duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading
                ? isAr
                  ? "جاري الإرسال..."
                  : "Sending..."
                : isAr
                  ? "إعادة إرسال بريد التحقق"
                  : "Resend Verification Email"}
            </button>
          </form>

          {/* Links */}
          <div className="mt-6 space-y-3 text-center">
            <Link
              to="/login"
              className="block text-sm text-[#e8c547] hover:text-[#1a1a2e] transition-colors"
            >
              {isAr ? "العودة إلى تسجيل الدخول" : "Back to Login"}
            </Link>

            <Link
              to="/"
              className="block text-sm text-gray-400 hover:text-gray-600 transition-colors"
            >
              {isAr ? "العودة إلى الصفحة الرئيسية" : "Back to Home"}
            </Link>
          </div>

          {/* Info text */}
          <div className="mt-6 p-3 bg-gray-50 rounded-lg text-xs text-gray-500 text-center">
            {isAr
              ? "سيتم إرسال رابط تحقق جديد إلى بريدك الإلكتروني. الرابط صالح لمدة 24 ساعة."
              : "A new verification link will be sent to your email. The link is valid for 24 hours."}
          </div>

        </div>
      </div>
    </div>
  );
}