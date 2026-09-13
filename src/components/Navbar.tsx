import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export type Lang = "en" | "ar";

export interface NavLink {
  id: string;
  label: string;
  labelAr?: string;
  href?: string;
  onClick?: () => void;
}

interface NavbarProps {
  NAV_LINKS?: NavLink[];
  user?: any;
  lang: Lang;
  toggleLanguage: () => void;
  onTabChange?: (tabId: string) => void;
  defaultActiveId?: string;
}

export default function Navbar({
  NAV_LINKS = [],
  lang,
  toggleLanguage,
  onTabChange,
  defaultActiveId,
}: NavbarProps) {
  const isAr = lang === "ar";

  const navigate = useNavigate();

  const {
    user: authUser,
    isAuthenticated,
    logout,
  } = useAuth();

  const [menuOpen, setMenuOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const fontClass = isAr ? "font-arabic" : "font-sans";

  /*
  |--------------------------------------------------------------------------
  | AUTH USER
  |--------------------------------------------------------------------------
  |
  | We intentionally use AuthContext instead of trusting the `user` prop.
  | This means the Navbar always knows the current authenticated user.
  |
  */

  const user = isAuthenticated ? authUser : null;

  const role = String(user?.role || "").toLowerCase();

  const isHost = role === "host";
  const isAdmin = role === "admin";
  const isSuperAdmin = role === "super_admin";

  /*
  |--------------------------------------------------------------------------
  | ROLE LABEL
  |--------------------------------------------------------------------------
  */

  const roleLabel = isHost
    ? isAr
      ? "مضيف"
      : "Host"
    : isAdmin || isSuperAdmin
    ? isAr
      ? "مدير"
      : "Admin"
    : isAr
    ? "مستخدم"
    : "User";

  /*
  |--------------------------------------------------------------------------
  | STATUS
  |--------------------------------------------------------------------------
  */

  const normalizedStatus = String(user?.status || "").toLowerCase();

  const getStatusLabel = () => {
    // If no status or empty status, return appropriate message
    if (!user?.status) {
      return isAr ? "غير معروف" : "Unknown";
    }

    switch (normalizedStatus) {
      case "pending":
        return isAr ? "قيد المراجعة" : "Pending";

      case "verified":
      case "active":
        return isAr ? "نشط" : "Active";

      case "approved":
        return isAr ? "تمت الموافقة" : "Approved";

      case "confirmed":
        return isAr ? "مؤكد" : "Confirmed";

      case "suspended":
        return isAr ? "موقوف" : "Suspended";

      case "expired":
        return isAr ? "منتهي" : "Expired";

      default:
        return isAr ? "غير معروف" : "Unknown";
    }
  };

  const getStatusClasses = () => {
    // If no status, return default
    if (!user?.status) {
      return "bg-white/10 text-white/60 border-white/20";
    }

    switch (normalizedStatus) {
      case "pending":
        return "bg-yellow-400/15 text-yellow-300 border-yellow-400/30";

      case "verified":
      case "active":
      case "approved":
      case "confirmed":
        return "bg-emerald-400/15 text-emerald-300 border-emerald-400/30";

      case "suspended":
      case "expired":
        return "bg-red-400/15 text-red-300 border-red-400/30";

      default:
        return "bg-white/10 text-white/60 border-white/20";
    }
  };

  /*
  |--------------------------------------------------------------------------
  | DASHBOARD
  |--------------------------------------------------------------------------
  */

  const handleDashboardClick = () => {
    setMenuOpen(false);

    if (!user) {
      navigate("/login");
      return;
    }

    switch (role) {
      case "host":
        navigate("/host-dashboard");
        break;

      case "admin":
      case "super_admin":
        navigate("/admin-dashboard");
        break;

      case "user":
      default:
        navigate("/user-dashboard");
        break;
    }
  };

  /*
  |--------------------------------------------------------------------------
  | LINK AUTHORIZATION
  |--------------------------------------------------------------------------
  */

  const canAccessLink = (link: NavLink) => {
    if (!link.href) {
      return true;
    }

    /*
     * Host routes
     */
    if (link.href.startsWith("/host")) {
      return isAuthenticated && isHost;
    }

    /*
     * Admin routes
     */
    if (link.href.startsWith("/admin")) {
      return isAuthenticated && (isAdmin || isSuperAdmin);
    }

    return true;
  };

  /*
  |--------------------------------------------------------------------------
  | FILTER NAVIGATION
  |--------------------------------------------------------------------------
  */

  const visibleLinks = NAV_LINKS.filter(canAccessLink);

  /*
  |--------------------------------------------------------------------------
  | LINK CLICK
  |--------------------------------------------------------------------------
  */

  const handleLinkClick = (link: NavLink) => {
    if (link.onClick) {
      link.onClick();
    }

    if (onTabChange && link.id) {
      onTabChange(link.id);
    }

    setMenuOpen(false);
  };

  /*
  |--------------------------------------------------------------------------
  | LOGOUT
  |--------------------------------------------------------------------------
  */

  const handleLogout = async () => {
    if (loggingOut) return;

    setLoggingOut(true);

    try {
      const storedTokens = localStorage.getItem("tokens");

      let accessToken: string | null = null;

      if (storedTokens) {
        try {
          const parsedTokens = JSON.parse(storedTokens);
          accessToken = parsedTokens?.accessToken || null;
        } catch {
          console.warn("Could not parse stored tokens");
        }
      }

      await fetch(
        "https://api.mar-haba.ly/api/v1/auth/logout",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(accessToken
              ? {
                  Authorization: `Bearer ${accessToken}`,
                }
              : {}),
          },
          credentials: "include",
        }
      );
    } catch (error) {
      console.error("Logout API error:", error);
    } finally {
      /*
       * AuthContext clears:
       * - user
       * - tokens
       * - localStorage
       */
      logout();

      setMenuOpen(false);
      setLoggingOut(false);
    }
  };

  /*
  |--------------------------------------------------------------------------
  | RENDER
  |--------------------------------------------------------------------------
  */

  return (
    <header
      dir={isAr ? "rtl" : "ltr"}
      className={`sticky top-0 z-50 border-b border-white/10 bg-[#1a1a2e] ${fontClass}`}
    >
      <div className="mx-auto flex h-16 max-w-screen-xl items-center justify-between gap-5 px-4 sm:px-6">
        {/* ================================================================
            LOGO
        ================================================================ */}

        <Link
          to="/"
          className="flex-shrink-0 font-arabic text-[26px] font-medium tracking-[1px] text-white no-underline"
        >
          مر
          <span className="font-bold text-[#e8c547]">
            حبا
          </span>
        </Link>

        {/* ================================================================
            DESKTOP NAVIGATION
        ================================================================ */}

        <nav className="hidden flex-1 items-center gap-1 md:flex">
          {visibleLinks.map((link) => {
            /*
             * Dashboard
             */
            if (link.id === "dashboard") {
              return (
                <button
                  key={link.id}
                  type="button"
                  onClick={handleDashboardClick}
                  className="
                    cursor-pointer
                    rounded-md
                    border-none
                    bg-transparent
                    px-3
                    py-1.5
                    text-[12px]
                    text-white/50
                    transition-all
                    hover:bg-[#e8c547]/10
                    hover:text-[#e8c547]
                  "
                >
                  {isAr
                    ? link.labelAr || link.label
                    : link.label}
                </button>
              );
            }

            /*
             * Normal links
             */
            if (link.href) {
              return (
                <Link
                  key={link.id}
                  to={link.href}
                  onClick={() => handleLinkClick(link)}
                  className={`
                    rounded-md
                    px-3
                    py-1.5
                    text-[12px]
                    no-underline
                    transition-all
                    ${
                      defaultActiveId === link.id
                        ? "bg-[#e8c547]/15 text-[#e8c547]"
                        : "text-white/50 hover:bg-[#e8c547]/10 hover:text-[#e8c547]"
                    }
                  `}
                >
                  {isAr
                    ? link.labelAr || link.label
                    : link.label}
                </Link>
              );
            }

            return (
              <button
                key={link.id}
                type="button"
                onClick={() => handleLinkClick(link)}
                className="
                  cursor-pointer
                  rounded-md
                  border-none
                  bg-transparent
                  px-3
                  py-1.5
                  text-[12px]
                  text-white/50
                  transition-all
                  hover:bg-[#e8c547]/10
                  hover:text-[#e8c547]
                "
              >
                {isAr
                  ? link.labelAr || link.label
                  : link.label}
              </button>
            );
          })}
        </nav>

        {/* ================================================================
            RIGHT SIDE
        ================================================================ */}

        <div className="flex items-center gap-3">
          {/* LANGUAGE */}

          <button
            type="button"
            onClick={toggleLanguage}
            className="
              cursor-pointer
              rounded-md
              border
              border-[#e8c547]/30
              bg-[#e8c547]/15
              px-2.5
              py-1
              text-[11px]
              text-[#e8c547]
            "
          >
            {isAr ? "🇬🇧" : "🇱🇾"}
          </button>

          {/* ============================================================
              AUTHENTICATED USER
          ============================================================= */}

          {user ? (
            <div className="hidden items-center gap-2 md:flex">
              {/* NAME */}

              <span
                className="
                  max-w-[140px]
                  truncate
                  rounded-full
                  border
                  border-[#e8c547]/25
                  bg-[#e8c547]/10
                  px-2.5
                  py-1
                  text-[10px]
                  text-[#e8c547]
                "
                title={user.name}
              >
                {user.name}
              </span>

              {/* ROLE */}

              <span
                className="
                  rounded-full
                  border
                  border-white/15
                  bg-white/5
                  px-2.5
                  py-1
                  text-[10px]
                  text-white/60
                "
              >
                {roleLabel}
              </span>

              {/* STATUS - Only show if status exists */}

              {user.status && (
                <span
                  className={`
                    rounded-full
                    border
                    px-2.5
                    py-1
                    text-[10px]
                    font-medium
                    ${getStatusClasses()}
                  `}
                >
                  {getStatusLabel()}
                </span>
              )}
            </div>
          ) : (
            /* ============================================================
               NOT AUTHENTICATED
            ============================================================= */

            <Link
              to="/login"
              className="
                hidden
                text-sm
                text-white/70
                no-underline
                transition
                hover:text-[#e8c547]
                sm:block
              "
            >
              {isAr ? "تسجيل الدخول" : "Sign in"}
            </Link>
          )}

          {/* ============================================================
              LOGOUT
          ============================================================= */}

          {user && (
            <button
              type="button"
              disabled={loggingOut}
              onClick={handleLogout}
              className={`
                rounded-md
                border
                border-[#e8c547]
                bg-transparent
                px-3
                py-1
                text-[11px]
                text-[#e8c547]
                transition-colors
                hover:border-red-400
                hover:text-red-400
                disabled:cursor-not-allowed
                disabled:opacity-50
              `}
            >
              {loggingOut
                ? isAr
                  ? "جارٍ الخروج..."
                  : "Logging out..."
                : isAr
                ? "خروج"
                : "Logout"}
            </button>
          )}

          {/* MOBILE BUTTON */}

          <button
            type="button"
            onClick={() => setMenuOpen((prev) => !prev)}
            className="
              cursor-pointer
              border-none
              bg-transparent
              text-2xl
              text-[#e8c547]
              md:hidden
            "
          >
            {menuOpen ? "✕" : "☰"}
          </button>
        </div>
      </div>

      {/* ================================================================
          MOBILE MENU
      ================================================================ */}

      {menuOpen && (
        <div
          className="
            flex
            flex-col
            border-t
            border-white/10
            bg-[#1a1a2e]
            md:hidden
          "
        >
          {visibleLinks.map((link) => {
            /*
             * Dashboard
             */

            if (link.id === "dashboard") {
              return (
                <button
                  key={link.id}
                  type="button"
                  onClick={handleDashboardClick}
                  className="
                    cursor-pointer
                    border-none
                    bg-transparent
                    px-5
                    py-3
                    text-left
                    text-sm
                    text-white/70
                    hover:text-[#e8c547]
                  "
                >
                  {isAr
                    ? link.labelAr || link.label
                    : link.label}
                </button>
              );
            }

            /*
             * Normal links
             */

            if (link.href) {
              return (
                <Link
                  key={link.id}
                  to={link.href}
                  onClick={() => handleLinkClick(link)}
                  className={`
                    px-5
                    py-3
                    text-sm
                    no-underline
                    ${
                      defaultActiveId === link.id
                        ? "text-[#e8c547] bg-[#e8c547]/10"
                        : "text-white/70 hover:text-[#e8c547]"
                    }
                  `}
                >
                  {isAr
                    ? link.labelAr || link.label
                    : link.label}
                </Link>
              );
            }

            return (
              <button
                key={link.id}
                type="button"
                onClick={() => handleLinkClick(link)}
                className="
                  cursor-pointer
                  border-none
                  bg-transparent
                  px-5
                  py-3
                  text-left
                  text-sm
                  text-white/70
                  hover:text-[#e8c547]
                "
              >
                {isAr
                  ? link.labelAr || link.label
                  : link.label}
              </button>
            );
          })}

          {/* MOBILE USER */}

          {user && (
            <div className="flex flex-col gap-2 border-t border-white/10 px-5 py-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-semibold text-white">
                  {user.name}
                </span>

                <span className="rounded-full bg-[#e8c547]/10 px-2 py-1 text-[10px] text-[#e8c547]">
                  {roleLabel}
                </span>

                {/* Only show status if it exists */}
                {user.status && (
                  <span
                    className={`
                      rounded-full
                      border
                      px-2
                      py-1
                      text-[10px]
                      ${getStatusClasses()}
                    `}
                  >
                    {getStatusLabel()}
                  </span>
                )}
              </div>

              <button
                type="button"
                disabled={loggingOut}
                onClick={handleLogout}
                className="
                  mt-2
                  w-fit
                  rounded-md
                  border
                  border-red-400/40
                  bg-red-400/10
                  px-3
                  py-1.5
                  text-xs
                  text-red-300
                "
              >
                {loggingOut
                  ? isAr
                    ? "جارٍ الخروج..."
                    : "Logging out..."
                  : isAr
                  ? "تسجيل الخروج"
                  : "Logout"}
              </button>
            </div>
          )}

          {/* MOBILE LOGIN */}

          {!user && (
            <Link
              to="/login"
              onClick={() => setMenuOpen(false)}
              className="
                border-t
                border-white/10
                px-5
                py-4
                text-sm
                text-[#e8c547]
                no-underline
              "
            >
              {isAr ? "تسجيل الدخول" : "Sign in"}
            </Link>
          )}
        </div>
      )}
    </header>
  );
}