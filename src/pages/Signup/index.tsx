
import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useLanguage } from "../../hooks/useLanguage";
import { useAuth } from "../../context/AuthContext";
import apiService from "../../services/api";

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string;
            callback: (response: { credential: string }) => void;
            auto_select?: boolean;
          }) => void;
          renderButton: (
            element: HTMLElement,
            options: Record<string, unknown>
          ) => void;
        };
      };
    };
  }
}

export default function Signup() {
  const navigate = useNavigate();
  const { lang, toggleLanguage } = useLanguage();
  const { login } = useAuth();

  const isAr = lang === "ar";
  const fontClass = isAr ? "font-arabic" : "font-sans";

  const googleButtonRef = useRef<HTMLDivElement>(null);

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleReady, setGoogleReady] = useState(false);

  const copy = {
    title: isAr ? "انضم إلى مرحبا" : "Join Marhaba",
    subtitle: isAr
      ? "أنشئ حسابك بسهولة وأمان باستخدام حساب Google"
      : "Create your account securely using your Google account.",
    alreadyHave: isAr ? "لديك حساب بالفعل؟" : "Already have an account?",
    signIn: isAr ? "تسجيل الدخول" : "Sign in",
    google: isAr ? "المتابعة باستخدام Google" : "Continue with Google",
    loading: isAr ? "جارٍ إنشاء حسابك..." : "Creating your account...",
    googleHint: isAr
      ? "استخدم حساب Google للمتابعة"
      : "Use your Google account to continue.",
    terms: isAr
      ? "بالمتابعة فإنك توافق على"
      : "By continuing, you agree to our",
    termsLink: isAr ? "الشروط" : "Terms",
    and: isAr ? "و" : "and",
    privacyLink: isAr ? "سياسة الخصوصية" : "Privacy Policy",
    langToggle: isAr ? "🇬🇧" : "🇱🇾",
    googleError: isAr
      ? "تعذر تسجيل الدخول باستخدام Google. حاول مرة أخرى."
      : "Google sign-in failed. Please try again.",
  };

  useEffect(() => {
    let cancelled = false;

    const initializeGoogle = () => {
      if (cancelled || !window.google || !googleButtonRef.current) {
        return;
      }

      const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

      if (!clientId) {
        setError("Google Client ID is not configured.");
        return;
      }

      window.google.accounts.id.initialize({
        client_id: clientId,
        auto_select: false,
        callback: async (response) => {
          if (!response.credential || cancelled) {
            setError(copy.googleError);
            return;
          }

          setLoading(true);
          setError("");

          try {
            const result = await apiService.loginWithGoogle(
              response.credential
            );

            if (!result?.success || !result.data?.user || !result.data?.tokens) {
              throw new Error(
                result?.message || copy.googleError
              );
            }

            login(result.data.user, result.data.tokens);

            const role = result.data.user.role;

            if (role === "admin" || role === "super_admin") {
              navigate("/admin", { replace: true });
            } else if (role === "host") {
              navigate("/host-dashboard", { replace: true });
            } else {
              navigate("/user-dashboard", { replace: true });
            }
          } catch (err) {
            console.error("Google signup error:", err);
            setError(
              err instanceof Error ? err.message : copy.googleError
            );
            setLoading(false);
          }
        },
      });

      googleButtonRef.current.innerHTML = "";

      window.google.accounts.id.renderButton(
        googleButtonRef.current,
        {
          theme: "filled_black",
          size: "large",
          shape: "pill",
          text: "continue_with",
          width: 320,
          locale: isAr ? "ar" : "en",
        }
      );

      setGoogleReady(true);
    };

    const existingScript = document.querySelector(
      'script[src="https://accounts.google.com/gsi/client"]'
    ) as HTMLScriptElement | null;

    if (window.google) {
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
          setError(copy.googleError);
        }
      };
      document.head.appendChild(script);
    }

    return () => {
      cancelled = true;
      existingScript?.removeEventListener("load", initializeGoogle);
    };
  }, [isAr, login, navigate]);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@300;400;500;600;700;800&family=Tajawal:wght@300;400;500;700;800&family=Fraunces:ital,wght@0,300;0,400;0,500;1,300;1,400;1,500&display=swap');

        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(14px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .animate-fadeUp {
          animation: fadeUp 0.4s ease both;
        }
      `}</style>

      <div
        dir={isAr ? "rtl" : "ltr"}
        className={`min-h-screen flex bg-[#f7f6f2] ${fontClass}`}
      >
        {/* Left panel */}
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
            <Link
              to="/"
              className="font-arabic font-medium text-[26px] text-white/90 tracking-wide no-underline"
            >
              مر<span className="font-bold text-[#e8c547]">حبا</span>
            </Link>

            <div className="grid grid-cols-6 gap-2.5 w-fit opacity-[0.08]">
              {Array.from({ length: 24 }).map((_, i) => (
                <span
                  key={i}
                  className="block w-1.5 h-1.5 rounded-full bg-[#e8c547]"
                />
              ))}
            </div>

            <div>
              <h2
                className={`text-[36px] text-white font-light leading-[1.15] mb-5 ${
                  isAr ? "font-arabic" : "font-serif-italic"
                }`}
              >
                {isAr ? (
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
                )}
              </h2>

              <p className="text-[13px] text-white/40 leading-relaxed">
                {isAr
                  ? "اكتشف أماكن جديدة واحجز إقامتك القادمة بسهولة وأمان."
                  : "Discover new places and book your next stay with confidence."}
              </p>
            </div>
          </div>

          <div className="relative space-y-5">
            {[
              ["12,400+", isAr ? "إعلان نشط" : "active listings", "#378ADD"],
              ["98%", isAr ? "معدل الرضا" : "satisfaction rate", "#e8c547"],
              ["40+", isAr ? "مدينة مغطاة" : "cities covered", "#1D9E75"],
            ].map(([stat, label, color]) => (
              <div
                key={stat}
                style={{ borderTop: `3px solid ${color}` }}
                className="pt-3"
              >
                <div className="text-[28px] text-white font-light leading-none">
                  {stat}
                </div>
                <div className="text-[10px] tracking-widest uppercase text-white/30 mt-1.5">
                  {label}
                </div>
              </div>
            ))}
          </div>
        </aside>

        {/* Right panel */}
        <main className="flex-1 flex items-center justify-center px-6 py-8">
          <div className="w-full max-w-[460px] animate-fadeUp">
            {/* Top bar */}
            <div className="flex items-center justify-between mb-12">
              <Link
                to="/"
                className="font-arabic font-medium text-[26px] text-[#1a1a2e] tracking-wide no-underline"
              >
                مر<span className="font-bold text-yellow-400">حبا</span>
              </Link>

              <button
                onClick={toggleLanguage}
                className="bg-[#1a1a2e]/[0.07] border border-[#1a1a2e]/[0.12] rounded-2xl px-3.5 py-1 text-[12px] font-medium text-[#1a1a2e] cursor-pointer hover:bg-[#1a1a2e]/[0.12] ms-auto"
              >
                {copy.langToggle}
              </button>
            </div>

            {/* Heading */}
            <div className="mb-9">
              <h1
                className={`text-[30px] text-[#111118] font-light leading-tight mb-2 ${
                  isAr ? "font-arabic" : "font-serif-italic"
                }`}
              >
                {copy.title}
              </h1>

              <p className="text-[13px] text-[#999]">
                {copy.subtitle}
              </p>

              <p className="text-[12px] text-[#999] mt-4">
                {copy.alreadyHave}{" "}
                <Link
                  to="/login"
                  className="text-[#185FA5] no-underline font-medium"
                >
                  {copy.signIn}
                </Link>
              </p>
            </div>

            {/* Google signup */}
            <div className="bg-white border border-black/5 rounded-2xl p-6 shadow-sm">
              <div className="text-center mb-6">
                <div className="text-[14px] font-semibold text-[#1a1a2e] mb-2">
                  {copy.google}
                </div>
                <p className="text-[12px] text-[#999]">
                  {copy.googleHint}
                </p>
              </div>

              <div className="flex justify-center min-h-[44px]">
                <div
                  ref={googleButtonRef}
                  className={loading ? "pointer-events-none opacity-50" : ""}
                />
              </div>

              {!googleReady && (
                <p className="text-center text-[11px] text-[#aaa] mt-3">
                  {isAr
                    ? "جارٍ تحميل تسجيل الدخول..."
                    : "Loading Google sign-in..."}
                </p>
              )}

              {loading && (
                <p className="text-center text-[12px] text-[#777] mt-4">
                  {copy.loading}
                </p>
              )}

              {error && (
                <div className="mt-4 px-3.5 py-2.5 bg-[#FCEBEB] border border-[#a32d2d]/15 rounded-lg text-[12px] text-[#791F1F]">
                  {error}
                </div>
              )}
            </div>

            {/* Legal */}
            <p className="text-[11px] text-[#bbb] text-center mt-7 leading-relaxed">
              {copy.terms}{" "}
              <Link
                to="/terms"
                className="text-[#185FA5] no-underline hover:underline"
              >
                {copy.termsLink}
              </Link>{" "}
              {copy.and}{" "}
              <Link
                to="/privacy"
                className="text-[#185FA5] no-underline hover:underline"
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
