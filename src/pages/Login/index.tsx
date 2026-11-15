import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useLanguage } from "../../hooks/useLanguage";
import { useAuth, User } from "../../context/AuthContext";
import { apiService } from "../../services/api";

// Google Identity Services types are accessed through window as any.

export default function LoginPage() {
  const navigate = useNavigate();
  const { lang, toggleLanguage } = useLanguage();
  const { login } = useAuth();

  const googleButtonRef = useRef<HTMLDivElement>(null);

  const isAr = lang === "ar";
  const fontClass = isAr ? "font-arabic" : "font-sans";

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleReady, setGoogleReady] = useState(false);

  const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;

  // --------------------------------------------------
  // Redirect user according to role
  // --------------------------------------------------

  const redirectByRole = useCallback(
    (user: User) => {
      if (user.role !== "user") {
        setError(
          isAr
            ? "هذا الحساب لا يمكنه تسجيل الدخول من هذه الصفحة."
            : "This account cannot sign in through this page.",
        );
        return;
      }

      if (user.account_type === "host") {
        navigate("/host-dashboard", { replace: true });
        return;
      }

      if (user.account_type === "traveler") {
        navigate("/user-dashboard", { replace: true });
        return;
      }

      setError(isAr ? "نوع الحساب غير صالح." : "Invalid account type.");
    },
    [isAr, navigate],
  );

  // --------------------------------------------------
  // Handle Google authentication response
  // --------------------------------------------------

  const handleGoogleResponse = useCallback(
    async (googleResponse: { credential?: string }) => {
      if (!googleResponse.credential) {
        setError(
          isAr
            ? "لم نتمكن من الحصول على بيانات حساب Google"
            : "Unable to retrieve your Google account credentials.",
        );
        return;
      }

      setLoading(true);
      setError("");

      try {
        // Login intent: do not assume the account is a Traveler.
        const response = await apiService.loginWithGoogle(
          googleResponse.credential,
          {
            intent: "login",
          },
        );

        if (!response.success || !response.data) {
          throw new Error(
            response.message ||
              (isAr ? "فشل تسجيل الدخول" : "Google sign-in failed"),
          );
        }

        const userData = response.data.user;
        const tokens = response.data.tokens;

        if (!userData || !tokens?.accessToken || !tokens?.refreshToken) {
          throw new Error(
            isAr
              ? "بيانات تسجيل الدخول غير مكتملة"
              : "Incomplete authentication response.",
          );
        }

        // Public login is only for Traveler and Host accounts.
        const isTraveler =
          userData.account_type === "traveler" && userData.role === "user";

        const isHost =
          userData.account_type === "host" && userData.role === "user";

        if (!isTraveler && !isHost) {
          throw new Error(
            isAr
              ? "هذا الحساب لا يمكنه تسجيل الدخول من هذه الصفحة."
              : "This account cannot sign in through this page.",
          );
        }

        const completeUser: User = {
          ...userData,

          ...(isHost
            ? {
                verificationStatus: response.data.verificationStatus,
                requiresIdUpload: response.data.requiresIdUpload,
                isHostApproved: response.data.isHostApproved,
              }
            : {}),
        };

        // Save authentication only after validation.
        login(completeUser, tokens);

        redirectByRole(completeUser);
      } catch (err: unknown) {
        console.error("Google login error:", err);

        setError(
          err instanceof Error
            ? err.message
            : isAr
              ? "فشل تسجيل الدخول"
              : "Google sign-in failed",
        );
      } finally {
        setLoading(false);
      }
    },
    [isAr, login, redirectByRole],
  );

  // --------------------------------------------------
  // Load Google Identity Services
  // --------------------------------------------------

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) {
      setError(
        isAr
          ? "إعداد تسجيل الدخول عبر Google غير مكتمل"
          : "Google sign-in is not configured.",
      );
      return;
    }

    let cancelled = false;

    const initializeGoogle = () => {
      if (cancelled) return;

      const google = (window as any).google;

      if (!google?.accounts?.id || !googleButtonRef.current) {
        return;
      }

      google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: handleGoogleResponse,
        auto_select: false,
        cancel_on_tap_outside: true,
      });

      googleButtonRef.current.innerHTML = "";

      google.accounts.id.renderButton(googleButtonRef.current, {
        type: "standard",
        theme: "outline",
        size: "large",
        text: "continue_with",
        shape: "pill",
        width: 320,
        locale: isAr ? "ar" : "en",
      });

      setGoogleReady(true);
    };

    const existingScript = document.querySelector(
      'script[src="https://accounts.google.com/gsi/client"]',
    ) as HTMLScriptElement | null;

    if ((window as any).google?.accounts?.id) {
      initializeGoogle();
    } else if (existingScript) {
      existingScript.addEventListener("load", initializeGoogle);
    } else {
      const script = document.createElement("script");

      script.src = "https://accounts.google.com/gsi/client";
      script.async = true;
      script.defer = true;

      script.onload = initializeGoogle;
      script.onerror = () => {
        if (!cancelled) {
          setError(
            isAr ? "تعذر تحميل خدمة Google" : "Could not load Google sign-in.",
          );
        }
      };

      document.head.appendChild(script);
    }

    return () => {
      cancelled = true;
      existingScript?.removeEventListener("load", initializeGoogle);
    };
  }, [GOOGLE_CLIENT_ID, handleGoogleResponse, isAr]);

  // --------------------------------------------------
  // Translations
  // --------------------------------------------------

  const copy = {
    heroTitle: isAr ? (
      <>
        يسعدنا
        <br />
        عودتك.
      </>
    ) : (
      <>
        Good to see
        <br />
        you again.
      </>
    ),

    heroSub: isAr
      ? "سجّل دخولك لإدارة حجوزاتك وقوائمك وإعدادات حسابك."
      : "Sign in to manage your bookings, listings, and account settings.",

    stats: [
      {
        val: "10,000+",
        label: isAr ? "مسافر نشط" : "active travelers",
        color: "#378ADD",
      },
      {
        val: "5,000+",
        label: isAr ? "مضيف موثوق" : "trusted hosts",
        color: "#e8c547",
      },
      {
        val: "98%",
        label: isAr ? "معدل الرضا" : "satisfaction rate",
        color: "#1D9E75",
      },
    ],

    welcome: isAr ? "أهلاً بعودتك." : "Welcome back.",

    description: isAr
      ? "تابع إلى مرحبا باستخدام حساب Google الخاص بك."
      : "Continue to Marhaba using your Google account.",

    googleLoading: isAr
      ? "جارٍ تجهيز تسجيل الدخول..."
      : "Preparing Google sign-in...",

    security: isAr
      ? "محمي بتشفير معياري"
      : "Protected by industry-standard encryption",

    langToggle: isAr ? "🇬🇧" : "🇱🇾",
    alreadyHave: isAr ? "لديك حساب بالفعل؟" : "You do not have an account?",
    signUp: isAr ? "تسجيل الدخول" : "Sign up",
  };

  // --------------------------------------------------
  // UI
  // --------------------------------------------------

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@300;400;500;600;700;800&family=Tajawal:wght@300;400;500;700;800&family=DM+Mono:wght@400;500&family=Fraunces:ital,wght@0,300;0,400;1,300;1,400&display=swap');

        @keyframes fadeUp {
          from {
            opacity: 0;
            transform: translateY(14px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .animate-fadeUp {
          animation: fadeUp 0.45s cubic-bezier(0.22,1,0.36,1) both;
        }

        .fu1 { animation-delay: 0.08s; }
        .fu2 { animation-delay: 0.16s; }
        .fu3 { animation-delay: 0.24s; }
      `}</style>

      <div
        dir={isAr ? "rtl" : "ltr"}
        className={`min-h-screen flex bg-[#f7f6f2] ${fontClass}`}
      >
        {/* Left panel */}

        <aside className="hidden lg:flex flex-col justify-between w-[380px] shrink-0 bg-[#1a1a2e] px-12 py-10 border-r border-[#e8c547]/10 relative overflow-hidden">
          <div className="absolute -bottom-16 -end-16 w-56 h-56 rounded-full border border-[#e8c547]/[0.08] pointer-events-none" />
          <div className="absolute -bottom-5 -end-5 w-36 h-36 rounded-full border border-[#e8c547]/[0.06] pointer-events-none" />

          <div className="relative space-y-10">
            <Link
              to="/"
              className="font-arabic font-medium text-[26px] text-white/90 tracking-wide no-underline"
            >
              مر<span className="font-bold text-[#e8c547]">حبا</span>
            </Link>

            <div>
              <h2
                className={`text-[38px] text-white font-light leading-[1.15] mb-4 ${
                  isAr ? "font-arabic" : "font-serif-italic"
                }`}
              >
                {copy.heroTitle}
              </h2>

              <p className="text-[13px] text-white/35 leading-relaxed">
                {copy.heroSub}
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-5 relative">
            {copy.stats.map(({ val, label, color }) => (
              <div
                key={label}
                style={{ borderTop: `3px solid ${color}` }}
                className="pt-3"
              >
                <div
                  className={`text-[26px] text-white font-light leading-none ${
                    isAr ? "font-arabic" : "font-serif-italic"
                  }`}
                >
                  {val}
                </div>

                <div className="text-[10px] tracking-widest uppercase text-white/30 mt-1">
                  {label}
                </div>
              </div>
            ))}
          </div>
        </aside>

        {/* Right panel */}

        <main className="flex-1 flex items-center justify-center px-6 py-12 overflow-y-auto">
          <div className="w-full max-w-[360px]">
            {/* Top bar */}

            <div className="flex items-center justify-between mb-8">
              <Link
                to="/"
                className="font-arabic font-medium text-[26px] text-[#1a1a2e] tracking-wide no-underline"
              >
                مر<span className="font-bold text-yellow-400">حبا</span>
              </Link>

              <button
                onClick={toggleLanguage}
                className="
                  bg-[#1a1a2e]/[0.07] border border-[#1a1a2e]/[0.12]
                  rounded-2xl px-3.5 py-1 text-[12px] font-medium text-[#1a1a2e]
                  cursor-pointer transition-colors duration-150 hover:bg-[#1a1a2e]/[0.12]
                  ms-auto
                "
              >
                {copy.langToggle}
              </button>
            </div>

            {/* Heading */}

            <div className="animate-fadeUp fu1 mb-8">
              <h1
                className={`text-[32px] text-[#111118] font-light leading-tight mb-2 ${
                  isAr ? "font-arabic" : "font-serif-italic"
                }`}
              >
                {copy.welcome}
              </h1>
              <p className="text-[12px] text-[#999]">
                {copy.alreadyHave}{" "}
                <Link
                  to="/signup"
                  className="text-[#185FA5] no-underline font-medium"
                >
                  {copy.signUp}
                </Link>
              </p>

              <p className="text-[12px] text-[#999] leading-relaxed">
                {copy.description}
              </p>
            </div>

            {/* Error */}

            {error && (
              <div className="animate-fadeUp flex items-center gap-2 px-3.5 py-2.5 bg-[#FCEBEB] border border-[#a32d2d]/15 rounded-lg text-[12px] text-[#791F1F] mb-5">
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 14 14"
                  fill="none"
                  className="shrink-0"
                >
                  <circle
                    cx="7"
                    cy="7"
                    r="6"
                    stroke="#A32D2D"
                    strokeWidth="1.2"
                  />
                  <path
                    d="M7 4v3.5M7 9.5h.01"
                    stroke="#A32D2D"
                    strokeWidth="1.2"
                    strokeLinecap="round"
                  />
                </svg>

                {error}
              </div>
            )}

            {/* Google sign-in */}

            <div className="animate-fadeUp fu2">
              <div className="min-h-[48px] flex flex-col justify-center items-center">
                <div
                  ref={googleButtonRef}
                  className={`flex justify-center w-full ${
                    loading ? "pointer-events-none opacity-40" : ""
                  }`}
                />

                {loading && (
                  <div className="flex items-center gap-3 text-[13px] text-[#777] mt-3">
                    <span className="inline-block w-4 h-4 rounded-full border-2 border-[#185FA5]/20 border-t-[#185FA5] animate-spin" />
                    {isAr ? "جارٍ تسجيل الدخول..." : "Signing in..."}
                  </div>
                )}
              </div>

              {!googleReady && !loading && !error && (
                <p className="text-center text-[11px] text-[#999] mt-3">
                  {copy.googleLoading}
                </p>
              )}
            </div>

            {/* Security badge */}

            <div className="animate-fadeUp fu3 mt-7 text-center">
              <span className="inline-flex items-center gap-1.5 bg-[#1D9E75]/10 border border-[#1D9E75]/20 rounded-2xl px-3 py-1 text-[11px] text-[#0F6E56]">
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                  <path
                    d="M5 1L1.5 2.5v3C1.5 7.4 3 8.8 5 9.5c2-0.7 3.5-2.1 3.5-4V2.5L5 1z"
                    stroke="#0F6E56"
                    strokeWidth="1"
                    strokeLinejoin="round"
                  />
                </svg>

                {copy.security}
              </span>
            </div>

            <p className="text-center text-[10px] text-[#aaa] mt-6">
              {isAr
                ? "بتسجيل الدخول، أنت توافق على شروط وأحكام مرحبا."
                : "By continuing, you agree to Marhaba's terms and conditions."}
            </p>
          </div>
        </main>
      </div>
    </>
  );
}
