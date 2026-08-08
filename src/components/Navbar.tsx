import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

// ─── Type Definitions ──────────────────────────────────────────────────────
export type Lang = "en" | "ar";

export interface NavLink {
  id: string;
  label: string;
  href: string;
}

export interface AppUser {
  id: string;
  name: string;
  email: string;
  role: "user" | "host" | "admin" | "super_admin";
  status?: string;
  phone_number?: string;
  email_verified?: boolean;
  createdAt?: string;
}

interface NavbarProps {
  NAV_LINKS: NavLink[];
  user: AppUser | null;
  lang: Lang;
  toggleLanguage: () => void;
   onTabChange?: (tabId: string) => void;
  ini?: string; // Made optional since it's not used
}

export default function Navbar({
  NAV_LINKS,
  user,
  lang,
  toggleLanguage,
   onTabChange,
}: NavbarProps) {
  const isAr = lang === "ar";
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  // Sharp, geometric font per language
  const fontClass = isAr ? "font-arabic" : "font-sans";

  const roleLabel =
    user?.role === "host"
      ? isAr
        ? "مضيف"
        : "Host"
      : user?.role === "admin" || user?.role === "super_admin"
      ? isAr
        ? "مدير"
        : "Admin"
      : isAr
      ? "مستخدم"
      : "Guest";

  const handleLogout = async () => {
    try {
      const token = localStorage.getItem("token");
      await fetch("https://marhababackend.onrender.com/api/v1/auth/logout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token && { Authorization: `Bearer ${token}` }),
        },
        credentials: "include",
      });
    } catch (error) {
      console.error("Logout error:", error);
    } finally {
      localStorage.removeItem("token");
      navigate("/login");
    }
  };

  return (
    <header
      dir={isAr ? "rtl" : "ltr"}
      className={`sticky top-0 z-50 bg-[#1a1a2e] border-b border-white/10 ${fontClass}`}
    >
      <div className="max-w-screen-xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-5">
        {/* Logo */}
        <Link
          to="/"
          className={`font-medium text-[26px] text-white tracking-[1px] flex-shrink-0 no-underline ${
            isAr ? "font-arabic" : "font-arabic"
          }`}
        >
          مر<span className="font-bold text-[#e8c547]">حبا</span>
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex flex-1 items-center gap-1">
          {NAV_LINKS?.map((link) => (
            <Link
              key={link.id}
              to={link.href}
              className={`
                px-3 py-1.5 rounded-md
                text-[12px]
                text-white/50
                no-underline
                transition-all
                hover:text-[#e8c547]
                hover:bg-[#e8c547]/10
                ${fontClass}
              `}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        {/* Right Side */}
        <div className="flex items-center gap-3">
          {/* Language */}
          <button
            onClick={toggleLanguage}
            className={`
              bg-[#e8c547]/15
              border border-[#e8c547]/30
              rounded-md
              px-2.5 py-1
              text-[11px]
              cursor-pointer
              text-[#e8c547]
              ${fontClass}
            `}
          >
            {isAr ? "🇬🇧" : "🇱🇾"}
          </button>

          {/* User */}
          {user ? (
            <div className="hidden md:flex items-center gap-2">
              <span
                className={`
                  text-[10px]
                  text-[#e8c547]
                  bg-[#e8c547]/10
                  border border-[#e8c547]/25
                  px-2 py-1
                  rounded-full
                  ${fontClass}
                `}
              >
                {user.name}
              </span>

              <span
                className={`
                  text-[10px]
                  text-[#e8c547]
                  bg-[#e8c547]/10
                  border border-[#e8c547]/25
                  px-2 py-1
                  rounded-full
                  ${fontClass}
                `}
              >
                {roleLabel}
              </span>
            </div>
          ) : (
            <Link
              to="/login"
              className={`
                hidden sm:block
                no-underline
                text-sm
                text-white/70
                hover:text-[#e8c547]
                ${fontClass}
              `}
            >
              {isAr ? "تسجيل الدخول" : "Sign in"}
            </Link>
          )}

          {/* Logout */}
          {user && (
            <button
              onClick={handleLogout}
              className={`
                border border-[#e8c547]
                rounded-md
                px-3 py-1
                text-[11px]
                cursor-pointer
                bg-transparent
                text-[#e8c547]
                hover:border-red-400
                hover:text-red-400
                transition-colors
                ${fontClass}
              `}
            >
              {isAr ? "خروج" : "Logout"}
            </button>
          )}

          {/* Mobile Menu */}
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className={`
              md:hidden
              text-[#e8c547]
              text-2xl
              bg-transparent
              border-none
              cursor-pointer
              ${fontClass}
            `}
          >
            {menuOpen ? "✕" : "☰"}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      {menuOpen && (
        <div
          className={`
            md:hidden
            bg-[#1a1a2e]
            border-t
            border-white/10
            flex flex-col
            ${fontClass}
          `}
        >
          {NAV_LINKS?.map((link) => (
            <Link
              key={link.id}
              to={link.href}
              onClick={() => setMenuOpen(false)}
              className={`
                px-5 py-3
                text-sm
                no-underline
                text-white/70
                hover:text-[#e8c547]
                ${fontClass}
              `}
            >
              {link.label}
            </Link>
          ))}

          {user && (
            <div
              className={`
                px-5 py-3
                border-t
                border-white/10
                flex gap-2
                ${fontClass}
              `}
            >
              <span className="text-[10px] text-[#e8c547]">{user.name}</span>
              <span className="text-[10px] text-[#e8c547]">{roleLabel}</span>
            </div>
          )}
        </div>
      )}
    </header>
  );
}