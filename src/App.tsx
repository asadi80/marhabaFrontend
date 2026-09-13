import { Routes, Route } from "react-router-dom";
import { LanguageProvider } from "./hooks/useLanguage";

import Home from "./pages/Home";
import HowToBookPage from "./pages/how-to-book";
import LoginPage from "./pages/Login";
import Signup from "./pages/Signup";
import VerifyEmailPendingContent from "./pages/verify-email";
import UserDashboard from "./pages/User-dashboard";
import ListingById from "./pages/Listings/ListingById";
import ForgotPasswordPage from "./pages/forgot-password";
import ResendVerificationPage from "./pages/Resend-verification";
import VerificationResult from "./pages/VerificationResult";
import HostDashboard from "./pages/Host-dashboard";
import HostSettings from "./pages/Host-dashboard/HostSettings";
import HostListings from "./pages/Host-dashboard/HostListing";
import HostBookings from "./pages/Host-dashboard/HostBookings";
import PaymentMethods from "./pages/payment-methods";
import ContactPage from "./pages/contact";
import StartHostingPage from "./pages/start-hosting";
import SafetyPage from "./pages/travel-tips";
import HostResourcesPage from "./pages/host-resources";
import PricingTipsPage from "./pages/pricing-tips";
import TermsPage from "./pages/terms";
import PrivacyPage from "./pages/privacy";
import SafetyInfoPage from "./pages/safety-info";
import PWAUpdatePrompt from "./components/PWAUpdatePrompt";

export default function App() {
  return (
    <LanguageProvider>
      <PWAUpdatePrompt />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/how-to-book" element={<HowToBookPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/verify-email" element={<VerifyEmailPendingContent />} />
        <Route path="/listings/:id" element={<ListingById />} />

        <Route
          path="/resend-verification"
          element={<ResendVerificationPage />}
        />
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
    </LanguageProvider>
  );
}
