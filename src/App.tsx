import { Routes, Route } from "react-router-dom";
import { LanguageProvider } from "./hooks/useLanguage";

import Home from "./pages/Home";
import HowToBookPage from "./pages/how-to-book";
import LoginPage from "./pages/Login";
import Signup from "./pages/Signup";
import VerifyEmailPendingContent from "./pages/verify-email";
import UserDashboard from "./pages/User-dashboard";
import Listings from "./pages/Listings";
import ForgotPasswordPage from "./pages/forgot-password";
import ResendVerificationPage from "./pages/Resend-verification";
import VerificationResult from "./pages/VerificationResult";
import HostDashboard from "./pages/Host-dashboard";

export default function App() {
  return (
    <LanguageProvider>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/how-to-book" element={<HowToBookPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/verify-email" element={<VerifyEmailPendingContent />} />
        <Route path="/listings" element={<Listings />} />

        <Route
          path="/resend-verification"
          element={<ResendVerificationPage />}
        />
        <Route path="/verification-result" element={<VerificationResult />} />
        <Route path="/user-dashboard" element={<UserDashboard />} />
        <Route path="/host-dashboard" element={<HostDashboard />} />

      </Routes>
    </LanguageProvider>
  );
}
