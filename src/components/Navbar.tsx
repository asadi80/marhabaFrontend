import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export type Lang = "en" | "ar";

export interface NavLink {
  id: string;
  label: string;
  labelAr?: string;
  href?: string;
  /** Emoji shown in the mobile bottom tab bar. Links without an icon use the ☰ menu instead. */
  icon?: string;
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

/* ==========================================================================
   CONSTANTS
========================================================================== */

const LOGOUT_URL = "https://api.mar-haba.ly/api/v1/auth/logout";

// Where the "dashboard" shortcut goes when a link has no href of its own.
// Make sure these match your router.
const DASHBOARD_PATHS: Record<string, string> = {
  host: "/host-dashboard",
  admin: "/admin-dashboard",
  super_admin: "/admin-dashboard",
  user: "/user-dashboard",
};

const getInitials = (name?: string) =>
  name
    ?.trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p.charAt(0).toUpperCase())
    .join("") || "?";

/* ==========================================================================
   COMPONENT
========================================================================== */

export default function Navbar({
  NAV_LINKS = [],
  lang,
  toggleLanguage,
  onTabChange,
  defaultActiveId,
}: NavbarProps) {
  const isAr = lang === "ar";
  const t = (en: string, ar: string) => (isAr ? ar : en);

  const navigate = useNavigate();
  const location = useLocation();

  const { user: authUser, isAuthenticated, logout } = useAuth();

  const [menuOpen, setMenuOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const fontClass = isAr ? "font-arabic" : "font-sans";

  // Close the mobile menu whenever the page changes
  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  /* ------------------------------ Auth user ---------------------------- */
  // Always read from AuthContext instead of trusting the `user` prop.

  const user = isAuthenticated ? authUser : null;
  const role = String(user?.role || "").toLowerCase();

  const isHost = role === "host";
  const isAdmin = role === "admin";
  const isSuperAdmin = role === "super_admin";

  const roleLabel = isHost
    ? t("Host", "مضيف")
    : isAdmin || isSuperAdmin
      ? t("Admin", "مدير")
      : t("User", "مستخدم");

  /* -------------------------------- Status ----------------------------- */

  const normalizedStatus = String(user?.status || "").toLowerCase();

  const getStatusLabel = () => {
    if (!user?.status) return t("Unknown", "غير معروف");

    switch (normalizedStatus) {
      case "pending":
        return t("Pending", "قيد المراجعة");
      case "verified":
      case "active":
        return t("Active", "نشط");
      case "approved":
        return t("Approved", "تمت الموافقة");
      case "confirmed":
        return t("Confirmed", "مؤكد");
      case "suspended":
        return t("Suspended", "موقوف");
      case "expired":
        return t("Expired", "منتهي");
      default:
        return t("Unknown", "غير معروف");
    }
  };

  // Dark-background version (desktop bar)
  const getStatusClassesDark = () => {
    if (!user?.status) return "bg-white/10 text-white/60 border-white/20";

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

  // Light-background version (mobile account sheet)
  const getStatusClassesLight = () => {
    switch (normalizedStatus) {
      case "pending":
        return "bg-amber-50 text-amber-700";
      case "verified":
      case "active":
      case "approved":
      case "confirmed":
        return "bg-emerald-50 text-emerald-700";
      case "suspended":
      case "expired":
        return "bg-red-50 text-red-700";
      default:
        return "bg-gray-100 text-gray-600";
    }
  };

  /* ------------------------------ Navigation --------------------------- */

  const canAccessLink = (link: NavLink) => {
    if (!link.href) return true;

    if (link.href.startsWith("/host")) return isAuthenticated && isHost;
    if (link.href.startsWith("/admin")) return isAuthenticated && (isAdmin || isSuperAdmin);

    return true;
  };

  const visibleLinks = NAV_LINKS.filter(canAccessLink);

  // If any link has an icon we show an app-style bottom tab bar on mobile
  const tabLinks = visibleLinks.filter((l) => l.icon);
  const hasTabBar = tabLinks.length > 0;

  // Only add a separate "Dashboard" row when the links don't already include one
  const hasDashboardLink = visibleLinks.some((l) => l.id === "dashboard");

  const isActive = (link: NavLink) => {
    if (defaultActiveId && defaultActiveId === link.id) return true;
    if (!link.href) return false;
    return location.pathname === link.href || location.pathname.startsWith(`${link.href}/`);
  };

  const label = (link: NavLink) => (isAr ? link.labelAr || link.label : link.label);

  const goToDashboard = () => {
    setMenuOpen(false);

    if (!user) {
      navigate("/login");
      return;
    }

    navigate(DASHBOARD_PATHS[role] || DASHBOARD_PATHS.user);
  };

  const handleLinkClick = (link: NavLink) => {
    link.onClick?.();
    if (onTabChange && link.id) onTabChange(link.id);
    setMenuOpen(false);
  };

  /* -------------------------------- Logout ----------------------------- */

  const handleLogout = async () => {
    if (loggingOut) return;

    setLoggingOut(true);

    try {
      let accessToken: string | null = null;

      const storedTokens = localStorage.getItem("tokens");
      if (storedTokens) {
        try {
          accessToken = JSON.parse(storedTokens)?.accessToken || null;
        } catch {
          console.warn("Could not parse stored tokens");
        }
      }

      await fetch(LOGOUT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        credentials: "include",
      });
    } catch (error) {
      console.error("Logout API error:", error);
    } finally {
      // AuthContext clears user, tokens and localStorage
      logout();
      setMenuOpen(false);
      setLoggingOut(false);
    }
  };

  const logoutText = loggingOut ? t("Logging out...", "جارٍ الخروج...") : t("Logout", "تسجيل الخروج");

  /* -------------------------------- Pieces ----------------------------- */

  const desktopLinkCls = (active: boolean) =>
    `rounded-lg px-3.5 py-2 text-[13px] font-medium no-underline transition ${
      active ? "bg-[#e8c547]/15 text-[#e8c547]" : "text-white/55 hover:bg-[#e8c547]/10 hover:text-[#e8c547]"
    }`;

  const renderDesktopLink = (link: NavLink) => {
    // A "dashboard" link without an href uses the role-based dashboard path
    if (link.id === "dashboard" && !link.href) {
      return (
        <button key={link.id} type="button" onClick={goToDashboard} className={`${desktopLinkCls(false)} border-none bg-transparent`}>
          {label(link)}
        </button>
      );
    }

    if (link.href) {
      return (
        <Link key={link.id} to={link.href} onClick={() => handleLinkClick(link)} className={desktopLinkCls(isActive(link))}>
          {label(link)}
        </Link>
      );
    }

    return (
      <button key={link.id} type="button" onClick={() => handleLinkClick(link)} className={`${desktopLinkCls(isActive(link))} border-none bg-transparent`}>
        {label(link)}
      </button>
    );
  };

  const renderMobileRow = (link: NavLink) => {
    const rowCls = (active: boolean) =>
      `flex w-full items-center gap-3 px-5 py-3.5 text-start text-[15px] no-underline ${
        active ? "bg-[#e8c547]/15 font-semibold text-[#1a1a2e]" : "text-gray-700 active:bg-gray-50"
      }`;

    const content = (
      <>
        {link.icon && <span className="text-lg">{link.icon}</span>}
        {label(link)}
      </>
    );

    if (link.id === "dashboard" && !link.href) {
      return (
        <button key={link.id} type="button" onClick={goToDashboard} className={`${rowCls(false)} border-none bg-transparent`}>
          {content}
        </button>
      );
    }

    if (link.href) {
      return (
        <Link key={link.id} to={link.href} onClick={() => handleLinkClick(link)} className={rowCls(isActive(link))}>
          {content}
        </Link>
      );
    }

    return (
      <button key={link.id} type="button" onClick={() => handleLinkClick(link)} className={`${rowCls(isActive(link))} border-none bg-transparent`}>
        {content}
      </button>
    );
  };

  /* -------------------------------- Render ----------------------------- */

  return (
    <>
      <header
        dir={isAr ? "rtl" : "ltr"}
        className={`sticky top-0 z-50 border-b border-white/10 bg-[#1a1a2e] pt-[env(safe-area-inset-top)] ${fontClass}`}
      >
        <div className="mx-auto flex h-14 max-w-screen-xl items-center justify-between gap-4 px-4 sm:px-6 md:h-16">
          {/* Logo */}
          <Link
            to="/"
            className="flex-shrink-0 font-arabic text-[24px] font-medium tracking-[1px] text-white no-underline md:text-[26px]"
          >
            مر<span className="font-bold text-[#e8c547]">حبا</span>
          </Link>

          {/* Desktop links */}
          <nav className="hidden flex-1 items-center gap-1 md:flex">{visibleLinks.map(renderDesktopLink)}</nav>

          {/* Right side */}
          <div className="flex items-center gap-2 md:gap-3">
            {/* Language */}
            <button
              type="button"
              onClick={toggleLanguage}
              aria-label={t("Switch to Arabic", "التبديل إلى الإنجليزية")}
              className="flex h-9 min-w-[40px] cursor-pointer items-center justify-center rounded-full border border-[#e8c547]/30 bg-[#e8c547]/15 px-2.5 text-sm text-[#e8c547] active:scale-95"
            >
              {isAr ? "🇬🇧" : "🇱🇾"}
            </button>

            {/* Desktop: user chip + logout, or sign in */}
            {user ? (
              <div className="hidden items-center gap-3 md:flex">
                <div className="flex items-center gap-2.5 rounded-full border border-white/10 bg-white/5 py-1 pe-3 ps-1">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#e8c547] text-xs font-bold text-[#1a1a2e]">
                    {getInitials(user.name)}
                  </span>

                  <div className="min-w-0 leading-tight">
                    <p className="max-w-[140px] truncate text-[12px] font-medium text-white" title={user.name}>
                      {user.name}
                    </p>

                    <div className="mt-0.5 flex items-center gap-1.5">
                      <span className="text-[10px] text-white/55">{roleLabel}</span>
                      {user.status && (
                        <span className={`rounded-full border px-1.5 py-px text-[9px] font-medium ${getStatusClassesDark()}`}>
                          {getStatusLabel()}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  disabled={loggingOut}
                  onClick={handleLogout}
                  className="cursor-pointer rounded-lg border border-[#e8c547]/60 bg-transparent px-3.5 py-1.5 text-[12px] font-medium text-[#e8c547] transition hover:border-red-400 hover:text-red-400 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {loggingOut ? t("Logging out...", "جارٍ الخروج...") : t("Logout", "خروج")}
                </button>
              </div>
            ) : (
              <Link
                to="/login"
                className="hidden rounded-lg border border-[#e8c547]/60 px-3.5 py-1.5 text-[12px] font-medium text-[#e8c547] no-underline transition hover:bg-[#e8c547]/10 sm:block"
              >
                {t("Sign in", "تسجيل الدخول")}
              </Link>
            )}

            {/* Mobile: account avatar (when bottom tabs exist) or ☰ */}
            <button
              type="button"
              onClick={() => setMenuOpen((o) => !o)}
              aria-expanded={menuOpen}
              aria-label={t("Menu", "القائمة")}
              className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border-none bg-transparent text-2xl text-[#e8c547] active:scale-95 md:hidden"
            >
              {hasTabBar && user ? (
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#e8c547] text-xs font-bold text-[#1a1a2e]">
                  {getInitials(user.name)}
                </span>
              ) : menuOpen ? (
                "✕"
              ) : (
                "☰"
              )}
            </button>
          </div>
        </div>

        {/* Mobile menu / account sheet */}
        {menuOpen && (
          <>
            <button
              type="button"
              aria-label={t("Close menu", "إغلاق القائمة")}
              onClick={() => setMenuOpen(false)}
              className="fixed inset-0 top-14 z-40 cursor-default border-none bg-black/40 md:hidden"
            />

            <div className="absolute inset-x-0 top-full z-50 max-h-[75vh] overflow-y-auto rounded-b-2xl bg-white text-gray-900 shadow-xl md:hidden">
              {/* Account */}
              {user && (
                <div className="flex items-center gap-3 border-b border-gray-100 px-5 py-4">
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#1a1a2e] text-base font-bold text-[#e8c547]">
                    {getInitials(user.name)}
                  </span>

                  <div className="min-w-0">
                    <p className="truncate font-semibold">{user.name}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] text-gray-600">{roleLabel}</span>
                      {user.status && (
                        <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${getStatusClassesLight()}`}>
                          {getStatusLabel()}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Links (only when there is no bottom tab bar) */}
              {!hasTabBar && <div className="py-1">{visibleLinks.map(renderMobileRow)}</div>}

              {/* Dashboard shortcut (only if the links don't already have one) */}
              {user && !hasDashboardLink && (
                <button
                  type="button"
                  onClick={goToDashboard}
                  className="flex w-full items-center gap-3 border-none bg-transparent px-5 py-3.5 text-start text-[15px] text-gray-700 active:bg-gray-50"
                >
                  <span className="text-lg">🏡</span>
                  {t("Dashboard", "لوحة التحكم")}
                </button>
              )}

              {/* Logout / Sign in */}
              <div className="border-t border-gray-100 p-4">
                {user ? (
                  <button
                    type="button"
                    disabled={loggingOut}
                    onClick={handleLogout}
                    className="flex min-h-[48px] w-full items-center justify-center rounded-xl bg-red-50 text-sm font-semibold text-red-700 active:scale-[0.98] disabled:opacity-50"
                  >
                    {logoutText}
                  </button>
                ) : (
                  <Link
                    to="/login"
                    onClick={() => setMenuOpen(false)}
                    className="flex min-h-[48px] w-full items-center justify-center rounded-xl bg-[#1a1a2e] text-sm font-semibold text-[#e8c547] no-underline"
                  >
                    {t("Sign in", "تسجيل الدخول")}
                  </Link>
                )}
              </div>
            </div>
          </>
        )}
      </header>

      {/* Mobile bottom tab bar */}
      {hasTabBar && (
        <nav
          dir={isAr ? "rtl" : "ltr"}
          className={`fixed inset-x-0 bottom-0 z-40 border-t border-gray-200 bg-white pb-[env(safe-area-inset-bottom)] md:hidden ${fontClass}`}
        >
          <ul className="mx-auto flex max-w-md">
            {tabLinks.map((link) => {
              const active = isActive(link);
              return (
                <li key={link.id} className="flex-1">
                  {link.href ? (
                    <Link
                      to={link.href}
                      onClick={() => handleLinkClick(link)}
                      className={`flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-medium no-underline ${
                        active ? "text-[#1a1a2e]" : "text-gray-400"
                      }`}
                    >
                      <span className={`text-xl ${active ? "" : "opacity-60 grayscale"}`}>{link.icon}</span>
                      {label(link)}
                      <span className={`h-1 w-1 rounded-full ${active ? "bg-[#e8c547]" : "bg-transparent"}`} />
                    </Link>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleLinkClick(link)}
                      className={`flex w-full cursor-pointer flex-col items-center gap-0.5 border-none bg-transparent py-2.5 text-[11px] font-medium ${
                        active ? "text-[#1a1a2e]" : "text-gray-400"
                      }`}
                    >
                      <span className={`text-xl ${active ? "" : "opacity-60 grayscale"}`}>{link.icon}</span>
                      {label(link)}
                      <span className={`h-1 w-1 rounded-full ${active ? "bg-[#e8c547]" : "bg-transparent"}`} />
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </nav>
      )}
    </>
  );
}