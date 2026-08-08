import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";

// ─── Type Definitions ──────────────────────────────────────────────────────
export type Lang = "en" | "ar";

export interface Content {
  heroBadge: string;
  heroTitle1: string;
  heroTitle2: string;
  heroTitle3: string;
  heroSubtitle: string;
  createAccount: string;
  signIn: string;
  dashboard: string;
  verifiedHosts: string;
  securePayments: string;
  support247: string;
  whoAreYou: string;
  choosePath: string;
  traveler: string;
  travelerTagline: string;
  travelerDesc: string;
  travelerPerk1: string;
  travelerPerk2: string;
  travelerPerk3: string;
  travelerPerk4: string;
  host: string;
  hostTagline: string;
  hostDesc: string;
  hostPerk1: string;
  hostPerk2: string;
  hostPerk3: string;
  hostPerk4: string;
  getStartedAs: string;
  ready: string;
  ctaTitle: string;
  ctaDesc: string;
  footerDesc: string;
  travelersHeading: string;
  howToBook: string;
  paymentMethods: string;
  travelTips: string;
  hostsHeading: string;
  startHosting: string;
  hostResources: string;
  pricingTips: string;
  supportHeading: string;
  helpCenter: string;
  safetyInfo: string;
  contactUs: string;
  rights: string;
  privacy: string;
  terms: string;
  happyTravelers: string;
  activeHosts: string;
  bookingsMade: string;
  listingMade: string;
}

const STORAGE_KEY = "marhaba-lang";

const translations: Record<Lang, Content> = {
  en: {
    heroBadge: "Trusted stays across Libya",
    heroTitle1: "Find your",
    heroTitle2: "perfect",
    heroTitle3: "getaway",
    heroSubtitle:
      "Book unique homes, apartments, and experiences hosted by real people, wherever you're headed next.",
    createAccount: "Create account",
    signIn: "Sign in",
    dashboard: "Dashboard",
    verifiedHosts: "Verified hosts",
    securePayments: "Secure payments",
    support247: "24/7 support",
    whoAreYou: "Who are you?",
    choosePath: "Choose your path",
    traveler: "Traveler",
    travelerTagline: "Explore places to stay",
    travelerDesc:
      "Discover handpicked homes and unique stays wherever your travels take you.",
    travelerPerk1: "Browse thousands of verified listings",
    travelerPerk2: "Book instantly with secure payments",
    travelerPerk3: "24/7 customer support",
    travelerPerk4: "Save your favorite places",
    host: "Host",
    hostTagline: "Share your space",
    hostDesc:
      "Turn your extra space into extra income by welcoming travelers from around the world.",
    hostPerk1: "List your property for free",
    hostPerk2: "Set your own price and availability",
    hostPerk3: "Get paid securely and on time",
    hostPerk4: "Manage bookings from one dashboard",
    getStartedAs: "Get started as a",
    ready: "Ready when you are",
    ctaTitle: "Start your journey today",
    ctaDesc:
      "Join thousands of travelers and hosts already using Marhaba to find and share great stays.",
    footerDesc:
      "Marhaba connects travelers with unique places to stay across Libya and beyond.",
    travelersHeading: "Travelers",
    howToBook: "How to book",
    paymentMethods: "Payment methods",
    travelTips: "Travel tips",
    hostsHeading: "Hosts",
    startHosting: "Start hosting",
    hostResources: "Host resources",
    pricingTips: "Pricing tips",
    supportHeading: "Support",
    helpCenter: "Help center",
    safetyInfo: "Safety information",
    contactUs: "Contact us",
    rights: "All rights reserved.",
    privacy: "Privacy",
    terms: "Terms",
    happyTravelers: "Happy travelers",
    activeHosts: "Active hosts",
    bookingsMade: "Bookings made",
    listingMade: "Listings",
  },
  ar: {
    heroBadge: "إقامات موثوقة في جميع أنحاء ليبيا",
    heroTitle1: "اعثر على",
    heroTitle2: "إقامتك",
    heroTitle3: "المثالية",
    heroSubtitle:
      "احجز منازل وشقق وتجارب فريدة يستضيفها أشخاص حقيقيون، أينما تسافر.",
    createAccount: "إنشاء حساب",
    signIn: "تسجيل الدخول",
    dashboard: "لوحة التحكم",
    verifiedHosts: "مضيفون موثوقون",
    securePayments: "مدفوعات آمنة",
    support247: "دعم على مدار الساعة",
    whoAreYou: "من أنت؟",
    choosePath: "اختر مسارك",
    traveler: "مسافر",
    travelerTagline: "استكشف أماكن الإقامة",
    travelerDesc: "اكتشف منازل مختارة بعناية وإقامات فريدة أينما سافرت.",
    travelerPerk1: "تصفح آلاف القوائم الموثوقة",
    travelerPerk2: "احجز فورًا بمدفوعات آمنة",
    travelerPerk3: "دعم عملاء على مدار الساعة",
    travelerPerk4: "احفظ أماكنك المفضلة",
    host: "مضيف",
    hostTagline: "شارك مساحتك",
    hostDesc: "حوّل مساحتك الإضافية إلى دخل إضافي عبر استضافة مسافرين من حول العالم.",
    hostPerk1: "أدرج عقارك مجانًا",
    hostPerk2: "حدد سعرك وتوفرك الخاص",
    hostPerk3: "احصل على أموالك بأمان وفي الوقت المحدد",
    hostPerk4: "أدر حجوزاتك من لوحة تحكم واحدة",
    getStartedAs: "ابدأ الآن كـ",
    ready: "جاهز عندما تكون جاهزًا",
    ctaTitle: "ابدأ رحلتك اليوم",
    ctaDesc: "انضم إلى آلاف المسافرين والمضيفين الذين يستخدمون مرحبا بالفعل.",
    footerDesc: "مرحبا يربط المسافرين بأماكن إقامة فريدة في ليبيا وخارجها.",
    travelersHeading: "المسافرون",
    howToBook: "كيفية الحجز",
    paymentMethods: "طرق الدفع",
    travelTips: "نصائح السفر",
    hostsHeading: "المضيفون",
    startHosting: "ابدأ الاستضافة",
    hostResources: "موارد المضيف",
    pricingTips: "نصائح التسعير",
    supportHeading: "الدعم",
    helpCenter: "مركز المساعدة",
    safetyInfo: "معلومات السلامة",
    contactUs: "اتصل بنا",
    rights: "جميع الحقوق محفوظة.",
    privacy: "الخصوصية",
    terms: "الشروط",
    happyTravelers: "مسافر سعيد",
    activeHosts: "مضيف نشط",
    bookingsMade: "حجز تم",
    listingMade: "قائمة",
  },
};

interface LanguageContextValue {
  lang: Lang;
  t: Content;
  toggleLanguage: () => void;
  setLang: (lang: Lang) => void;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Lang>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved === "ar" || saved === "en" ? saved : "en";
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, lang);
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
  }, [lang]);

  const toggleLanguage = useCallback(() => {
    setLang((prev) => (prev === "en" ? "ar" : "en"));
  }, []);

  const value: LanguageContextValue = {
    lang,
    t: translations[lang],
    toggleLanguage,
    setLang,
  };

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage(): LanguageContextValue {
  const ctx = useContext(LanguageContext);
  if (!ctx) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return ctx;
}