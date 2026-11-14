
import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useLanguage } from "../../hooks/useLanguage";
import { useAuth, User } from "../../context/AuthContext";
import { apiService } from "../../services/api";

// ============================================================
// GOOGLE IDENTITY SERVICES TYPES
// ============================================================

interface GoogleCredentialResponse {
  credential: string;
}

interface GoogleButtonOptions {
  theme?: string;
  size?: string;
  text?: string;
  shape?: string;
  width?: number;
  logo_alignment?: string;
}

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string;
            callback: (response: GoogleCredentialResponse) => void;
          }) => void;
          renderButton: (
            parent: HTMLElement,
            options: GoogleButtonOptions,
          ) => void;
        };
      };
    };
  }
}

// ============================================================
// MAIN COMPONENT
// ============================================================

export default function Signup() {
  const navigate = useNavigate();
  const { lang, toggleLanguage } = useLanguage();
  const { login } = useAuth();

  const isAr = lang === "ar";
  const fontClass = isAr ? "font-arabic" : "font-sans";

  const googleButtonRef = useRef<HTMLDivElement>(null);
  const accountTypeRef = useRef<"traveler" | "host">("traveler");

  const [accountType, setAccountType] = useState<
    "traveler" | "host"
  >("traveler");

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Keep the selected account type available to Google's callback.
  useEffect(() => {
    accountTypeRef.current = accountType;
  }, [accountType]);

  // ============================================================
  // TRANSLATIONS
  // ============================================================

  const copy = {
    logo: isAr ? "مرحبا" : "marhaba",

    heroTitle: isAr ? (
      <>
        مساحتك،
        <br />
        قواعدك.
      </>
    ) : (
      <>
        Your space,
        <br />
        your rules.
      </>
    ),

    heroSub: isAr
      ? "انضم إلى آلاف المستخدمين والمضيفين الذين يبنون علاقات حقيقية عبر منصتنا."
      : "Join thousands of users and hosts building meaningful connections through our platform.",

    stats: [
      {
        stat: "12,400+",
        label: isAr ? "إعلان نشط" : "active listings",
        color: "#378ADD",
      },
      {
        stat: "98%",
        label: isAr ? "معدل الرضا" : "satisfaction rate",
        color: "#e8c547",
      },
      {
        stat: "40+",
        label: isAr ? "مدينة مغطاة" : "cities covered",
        color: "#1D9E75",
      },
    ],

    createAccount: isAr ? "إنشاء حساب" : "Create account",

    alreadyHave: isAr
      ? "لديك حساب بالفعل؟"
      : "Already have an account?",

    signIn: isAr ? "تسجيل الدخول" : "Sign in",

    joinAs: isAr ? "أريد الانضمام كـ" : "I want to join as",

    traveler: isAr ? "مسافر" : "Traveler",

    travelerDesc: isAr
      ? "تصفح وحجز الإقامات"
      : "Browse & book stays",

    host: isAr ? "مضيف" : "Host",

    hostDesc: isAr
      ? "أدرج وأدر العقارات"
      : "List & manage properties",

    googleSignup: isAr
      ? "المتابعة باستخدام Google"
      : "Continue with Google",

    googleInfo: isAr
      ? "استخدم حساب Google لإنشاء حسابك بأمان."
      : "Use your Google account to securely create your account.",

    terms: isAr
      ? "بإنشاء حساب فإنك توافق على"
      : "By signing up you agree to our",

    termsLink: isAr ? "الشروط" : "Terms",

    and: isAr ? "و" : "and",

    privacyLink: isAr
      ? "سياسة الخصوصية"
      : "Privacy Policy",

    loading: isAr
      ? "جارٍ تسجيل الدخول..."
      : "Signing you in...",

    langToggle: isAr ? "🇬🇧" : "🇱🇾",

    googleError: isAr
      ? "تعذر تحميل تسجيل الدخول باستخدام Google. حاول مرة أخرى."
      : "Unable to load Google Sign-In. Please try again.",

    authError: isAr
      ? "حدث خطأ أثناء إنشاء الحساب. حاول مرة أخرى."
      : "Something went wrong during signup. Please try again.",
  };

  // ============================================================
  // GOOGLE AUTHENTICATION
  // ============================================================

  useEffect(() => {
    let cancelled = false;

    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

    if (!clientId) {
      setError(
        "Google Client ID is missing. Check VITE_GOOGLE_CLIENT_ID.",
      );
      return;
    }

    const initializeGoogle = () => {
      if (cancelled || !window.google || !googleButtonRef.current) {
        return;
      }

      // Initialize Google Identity Services.
      window.google.accounts.id.initialize({
        client_id: clientId,

        callback: async (response) => {
          if (!response.credential) {
            setError(copy.authError);
            return;
          }

          setLoading(true);
          setError("");

          try {
            // Login and signup use the same backend endpoint.
            // A new account is created automatically if needed.
            const result = await apiService.loginWithGoogle(
              response.credential,
              accountTypeRef.current,
            );

            if (!result.success || !result.data?.user || !result.data?.tokens) {
              throw new Error(
                result.message || copy.authError,
              );
            }

            const { user, tokens } = result.data;

            // Preserve any additional verification information.
            const completeUser = {
              ...user,
              verificationStatus:
                result.data.verificationStatus ??
                user.verificationStatus,
              requiresIdUpload:
                result.data.requiresIdUpload ??
                user.requiresIdUpload,
              isHostApproved:
                result.data.isHostApproved ??
                user.isHostApproved,
            };

            // Update the application's authentication state.
            login(completeUser as User, tokens);

            // Let the application route the authenticated user.
            navigate("/", { replace: true });
          } catch (err) {
            console.error("Google signup error:", err);

            const message =
              err instanceof Error
                ? err.message
                : copy.authError;

            setError(message);
            setLoading(false);
          }
        },
      });

      // Render Google's official button.
      googleButtonRef.current.innerHTML = "";

      window.google.accounts.id.renderButton(
        googleButtonRef.current,
        {
          theme: "outline",
          size: "large",
          text: "signup_with",
          shape: "rectangular",
          width: 400,
          logo_alignment: "center",
        },
      );
    };

    // Load Google Identity Services.
    const existingScript = document.getElementById(
      "google-identity-services",
    ) as HTMLScriptElement | null;

    if (window.google) {
      initializeGoogle();
    } else if (existingScript) {
      existingScript.addEventListener(
        "load",
        initializeGoogle,
        { once: true },
      );

      existingScript.addEventListener(
        "error",
        () => {
          if (!cancelled) setError(copy.googleError);
        },
        { once: true },
      );
    } else {
      const script = document.createElement("script");

      script.id = "google-identity-services";
      script.src = "https://accounts.google.com/gsi/client";
      script.async = true;
      script.defer = true;

      script.onload = initializeGoogle;

      script.onerror = () => {
        if (!cancelled) {
          setError(copy.googleError);
        }
      };

      document.head.appendChild(script);
    }

    return () => {
      cancelled = true;
    };
  }, []);

  // ============================================================
  // SELECT ACCOUNT TYPE
  // ============================================================

  const handleAccountTypeChange = (
    type: "traveler" | "host",
  ) => {
    setAccountType(type);
    accountTypeRef.current = type;
    setError("");
  };

  // ============================================================
  // UI
  // ============================================================

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@300;400;500;600;700;800&family=Tajawal:wght@300;400;500;700;800&family=DM+Mono:wght@400;500&family=Fraunces:ital,wght@0,300;0,400;0,500;1,300;1,400;1,500&display=swap');

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
          animation: fadeUp 0.4s ease both;
        }

        .google-signup-button {
          display: flex;
          justify-content: center;
          width: 100%;
          min-height: 44px;
        }

        .google-signup-button > div {
          width: 100%;
          display: flex;
          justify-content: center;
        }
      `}</style>

      <div
        dir={isAr ? "rtl" : "ltr"}
        className={`min-h-screen flex bg-[#f7f6f2] ${fontClass}`}
      >
        {/* =====================================================
            LEFT PANEL
        ===================================================== */}

        <aside className="hidden lg:flex flex-col justify-between w-[380px] shrink-0 bg-[#1a1a2e] px-12 py-10 border-r border-[#e8c547]/10 relative overflow-hidden">

          <div
            className="absolute inset-0 pointer-events-none opacity-[0.035]"
            style={{
              backgroundImage:
                "repeating-linear-gradient(45deg,#e8c547 0px,#e8c547 1px,transparent 1px,transparent 36px)",
            }}
          />

          <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_20%_50%,rgba(232,197,71,0.12)_0%,transparent_60%)]" />

          <div className="relative space-y-8">

            {/* Logo */}

            <Link
              to="/"
              className="font-arabic font-medium text-[26px] text-white/90 tracking-wide no-underline"
            >
              مر<span className="font-bold text-[#e8c547]">حبا</span>
            </Link>

            {/* Dot grid */}

            <div className="grid grid-cols-6 gap-2.5 w-fit opacity-[0.08]">
              {Array.from({ length: 24 }).map((_, i) => (
                <span
                  key={i}
                  className="block w-1.5 h-1.5 rounded-full bg-[#e8c547]"
                />
              ))}
            </div>

            {/* Hero */}

            <div>
              <h2
                className={`text-[36px] text-white font-light leading-[1.15] mb-5 ${
                  isAr ? "font-arabic" : "font-serif-italic"
                }`}
              >
                {copy.heroTitle}
              </h2>

              <p className="text-[13px] text-white/40 leading-relaxed">
                {copy.heroSub}
              </p>
            </div>
          </div>

          {/* Stats */}

          <div className="flex flex-col gap-5 relative">
            {copy.stats.map(({ stat, label, color }) => (
              <div
                key={label}
                style={{ borderTop: `3px solid ${color}` }}
                className="pt-3"
              >
                <div
                  className={`text-[28px] text-white font-light leading-none ${
                    isAr ? "font-arabic" : "font-serif-italic"
                  }`}
                >
                  {stat}
                </div>

                <div className="text-[10px] tracking-widest uppercase text-white/30 mt-1.5">
                  {label}
                </div>
              </div>
            ))}
          </div>
        </aside>

        {/* =====================================================
            RIGHT PANEL
        ===================================================== */}

        <main className="flex-1 flex items-center justify-center px-6 py-8 overflow-y-auto">

          <div className="w-full max-w-[460px] animate-fadeUp">

            {/* Top bar */}

            <div className="flex items-center justify-between mb-8">

              <Link
                to="/"
                className="font-arabic font-medium text-[26px] text-[#1a1a2e] tracking-wide no-underline"
              >
                مر<span className="font-bold text-yellow-400">حبا</span>
              </Link>

              <button
                type="button"
                onClick={toggleLanguage}
                className="
                  bg-[#1a1a2e]/[0.07]
                  border border-[#1a1a2e]/[0.12]
                  rounded-2xl px-3.5 py-1
                  text-[12px] font-medium text-[#1a1a2e]
                  cursor-pointer transition-colors duration-150
                  hover:bg-[#1a1a2e]/[0.12]
                  ms-auto
                "
              >
                {copy.langToggle}
              </button>
            </div>

            {/* Heading */}

            <div className="mb-7">
              <h1
                className={`text-[30px] text-[#111118] font-light leading-tight mb-1.5 ${
                  isAr ? "font-arabic" : "font-serif-italic"
                }`}
              >
                {copy.createAccount}
              </h1>

              <p className="text-[12px] text-[#999]">
                {copy.alreadyHave}{" "}

                <Link
                  to="/login"
                  className="text-[#185FA5] no-underline font-medium"
                >
                  {copy.signIn}
                </Link>
              </p>
            </div>

            {/* =================================================
                ACCOUNT TYPE
            ================================================= */}

            <div className="mb-7">

              <p className="text-[10px] tracking-widest uppercase text-[#999] mb-2">
                {copy.joinAs}
              </p>

              <div className="grid grid-cols-2 gap-2">

                {[
                  {
                    value: "traveler" as const,
                    label: copy.traveler,
                    desc: copy.travelerDesc,
                  },
                  {
                    value: "host" as const,
                    label: copy.host,
                    desc: copy.hostDesc,
                  },
                ].map(({ value, label, desc }) => {
                  const active = accountType === value;

                  return (
                    <button
                      key={value}
                      type="button"
                      disabled={loading}
                      onClick={() => handleAccountTypeChange(value)}
                      className={`
                        rounded-xl px-4 py-3
                        cursor-pointer transition-all duration-150
                        disabled:opacity-50 disabled:cursor-not-allowed
                        ${isAr ? "text-right" : "text-left"}
                        ${
                          active
                            ? "bg-[#1a1a2e] border-2 border-[#1a1a2e]"
                            : "bg-white border-2 border-[#e5e3dc] hover:border-black/20"
                        }
                      `}
                    >
                      <div
                        className={`text-[13px] font-semibold mb-0.5 ${
                          active
                            ? "text-[#e8c547]"
                            : "text-[#111118]"
                        }`}
                      >
                        {label}
                      </div>

                      <div
                        className={`text-[11px] ${
                          active
                            ? "text-[#e8c547]/65"
                            : "text-[#aaa]"
                        }`}
                      >
                        {desc}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* =================================================
                GOOGLE SIGNUP
            ================================================= */}

            <div className="space-y-4">

              <p className="text-[12px] text-[#999] text-center">
                {copy.googleInfo}
              </p>

              {/* Google button */}

              <div
                className={`
                  google-signup-button
                  ${loading ? "pointer-events-none opacity-50" : ""}
                `}
                ref={googleButtonRef}
              />

              {/* Loading */}

              {loading && (
                <div className="flex items-center justify-center gap-2 text-[#185FA5] text-[12px]">
                  <span className="inline-block w-3.5 h-3.5 rounded-full border-2 border-[#185FA5]/30 border-t-[#185FA5] animate-spin" />

                  {copy.loading}
                </div>
              )}

              {/* Error */}

              {error && (
                <div className="px-3.5 py-2.5 bg-[#FCEBEB] border border-[#a32d2d]/15 rounded-lg text-[12px] text-[#791F1F]">
                  {error}
                </div>
              )}
            </div>

            {/* =================================================
                LEGAL
            ================================================= */}

            <p className="text-[11px] text-[#bbb] text-center mt-7 leading-relaxed">
              {copy.terms}{" "}

              <Link
                to="/terms"
                className="text-[#185FA5] cursor-pointer no-underline hover:underline"
              >
                {copy.termsLink}
              </Link>{" "}

              {copy.and}{" "}

              <Link
                to="/privacy"
                className="text-[#185FA5] cursor-pointer no-underline hover:underline"
              >
                {copy.privacyLink}
              </Link>
            </p>

          </div>
        </main>
      </div>
    </>
  );
}
