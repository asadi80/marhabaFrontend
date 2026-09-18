import { lazy, Suspense } from "react";
import { Routes, Route } from "react-router-dom";
import { LanguageProvider } from "./hooks/useLanguage";
import LoadingScreen from "./components/LoadingScreen";
import PWAUpdatePrompt from "./components/PWAUpdatePrompt";

// Every route is lazy-loaded: each page becomes its own chunk, fetched only
// when the user navigates there, instead of all being bundled into the
// initial load. This is what actually keeps mapbox-gl / heic2any (pulled in
// by HostListings, UserDashboard, ListingById) out of the critical path —
// manualChunks alone only controls how files are grouped, not when they load.

const Home = lazy(() => import("./pages/Home"));
const HowToBookPage = lazy(() => import("./pages/how-to-book"));
const LoginPage = lazy(() => import("./pages/Login"));
const Signup = lazy(() => import("./pages/Signup"));
const VerifyEmailPendingContent = lazy(() => import("./pages/verify-email"));
const UserDashboard = lazy(() => import("./pages/User-dashboard"));
const ListingById = lazy(() => import("./pages/Listings/ListingById"));
const ForgotPasswordPage = lazy(() => import("./pages/forgot-password"));
const ResendVerificationPage = lazy(() => import("./pages/Resend-verification"));
const VerificationResult = lazy(() => import("./pages/VerificationResult"));
const HostDashboard = lazy(() => import("./pages/Host-dashboard"));
const HostSettings = lazy(() => import("./pages/Host-dashboard/HostSettings"));
const HostListings = lazy(() => import("./pages/Host-dashboard/HostListing"));
const HostBookings = lazy(() => import("./pages/Host-dashboard/HostBookings"));
const PaymentMethods = lazy(() => import("./pages/payment-methods"));
const ContactPage = lazy(() => import("./pages/contact"));
const StartHostingPage = lazy(() => import("./pages/start-hosting"));
const SafetyPage = lazy(() => import("./pages/travel-tips"));
const HostResourcesPage = lazy(() => import("./pages/host-resources"));
const PricingTipsPage = lazy(() => import("./pages/pricing-tips"));
const TermsPage = lazy(() => import("./pages/terms"));
const PrivacyPage = lazy(() => import("./pages/privacy"));
const SafetyInfoPage = lazy(() => import("./pages/safety-info"));

export default function App() {
  return (
    <LanguageProvider>
      <PWAUpdatePrompt />

      <Suspense fallback={<LoadingScreen />}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/how-to-book" element={<HowToBookPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/verify-email" element={<VerifyEmailPendingContent />} />
          <Route path="/listings/:id" element={<ListingById />} />

          <Route path="/resend-verification" element={<ResendVerificationPage />} />
          <Route path="/verification-result" element={<VerificationResult />} />
          <Route path="/user-dashboard" element={<UserDashboard />} />
          <Route path="/host-dashboard" element={<HostDashboard />} />
          <Route path="/host/settings" element={<HostSettings />} />
          <Route path="/host/listings" element={<HostListings />} />
          <Route path="/host/bookings" element={<HostBookings />} />
          <Route path="/payment-methods" element={<PaymentMethods />} />
          <Route path="/contact" element={<ContactPage />} />
          <Route path="/start-hosting" element={<StartHostingPage />} />
          <Route path="/travel-tips" element={<SafetyPage />} />
          <Route path="/host-resources" element={<HostResourcesPage />} />
          <Route path="/pricing-tips" element={<PricingTipsPage />} />
          <Route path="/terms" element={<TermsPage />} />
          <Route path="/privacy" element={<PrivacyPage />} />
          <Route path="/safety-info" element={<SafetyInfoPage />} />
        </Routes>
      </Suspense>
    </LanguageProvider>
  );
}