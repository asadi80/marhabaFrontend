import { Suspense } from "react";
import { useSearchParams, Link } from "react-router-dom";

function VerifyEmailPendingContent() {
  const [searchParams] = useSearchParams();
  const email = searchParams.get("email");

  return (
    <div className="min-h-screen bg-[#f5f4f0] flex items-center justify-center px-4 py-12">
      <div className="max-w-md w-full">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          {/* English Section */}
          <div className="text-center mb-8">
            <div className="w-20 h-20 bg-[#1a1a2e] rounded-full flex items-center justify-center mx-auto mb-6">
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

            <h1 className="text-2xl font-bold text-[#1a1a2e] mb-3 font-sans">
              Please Verify Your Email
            </h1>

            <p className="text-gray-500 mb-2 font-sans">
              We've sent a verification link to:
            </p>

            <p className="text-[#e8c547] font-bold mb-6 break-all bg-[#1a1a2e]/5 px-3 py-1.5 rounded-lg inline-block font-sans">
              {email || "your email address"}
            </p>

            <div className="bg-[#1a1a2e]/5 border border-[#1a1a2e]/15 rounded-lg p-4 mb-6">
              <p className="text-sm text-[#1a1a2e] font-sans">
                📧 Check your inbox and click the verification link to activate your account.
                <br />
                <span className="text-xs text-gray-500">
                  (Check your spam folder if you don't see it)
                </span>
              </p>
            </div>
          </div>

          {/* Divider */}
          <div className="border-t-2 border-[#e8c547]/30 my-6"></div>

          {/* Arabic Section */}
          <div className="text-center" style={{ direction: "rtl" }}>
            <div className="w-20 h-20 bg-[#1a1a2e] rounded-full flex items-center justify-center mx-auto mb-6">
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

            <h1 className="text-2xl font-bold text-[#1a1a2e] mb-3 font-arabic">
              يرجى تأكيد بريدك الإلكتروني
            </h1>

            <p className="text-gray-500 mb-2 font-arabic">
              لقد أرسلنا رابط التحقق إلى:
            </p>

            <p className="text-[#e8c547] font-bold mb-6 break-all bg-[#1a1a2e]/5 px-3 py-1.5 rounded-lg inline-block font-arabic">
              {email || "بريدك الإلكتروني"}
            </p>

            <div className="bg-[#1a1a2e]/5 border border-[#1a1a2e]/15 rounded-lg p-4 mb-6">
              <p className="text-sm text-[#1a1a2e] font-arabic">
                📧 تحقق من صندوق الوارد واضغط على رابط التحقق لتفعيل حسابك.
                <br />
                <span className="text-xs text-gray-500">
                  (تحقق من مجلد البريد العشوائي إذا لم تجده)
                </span>
              </p>
            </div>
          </div>

          <Link
            to="/login"
            className="block w-full bg-[#1a1a2e] text-[#e8c547] py-3 rounded-xl font-bold hover:opacity-90 transition duration-200 text-center mt-6 font-sans"
          >
            Go to Login / تسجيل الدخول
          </Link>

          <div className="mt-4 text-center">
            <Link
              to="/resend-verification"
              className="text-sm text-[#e8c547] hover:text-[#1a1a2e] transition-colors font-sans"
            >
              Didn't receive the email? Click here to resend / لم تستلم البريد الإلكتروني؟ اضغط هنا لإعادة الإرسال
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function VerifyEmailPendingPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-[#f5f4f0]">
          <div className="text-center">
            <div className="w-16 h-16 border-4 border-[#e8c547] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-[#1a1a2e] font-sans">Loading...</p>
          </div>
        </div>
      }
    >
      <VerifyEmailPendingContent />
    </Suspense>
  );
}