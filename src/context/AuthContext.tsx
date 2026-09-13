// src/context/AuthContext.tsx
import { apiService } from "../services/api";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";

import { useNavigate } from "react-router-dom";

// ─────────────────────────────────────────────────────────────────────────────
// Verification Status
// ─────────────────────────────────────────────────────────────────────────────

export interface VerificationStatus {
  id: {
    uploaded: boolean;
    verified: boolean;
    verified_at: string | null;
    rejected: boolean;
    rejection_reason: string | null;
  };

  payment: {
    uploaded: boolean;
    status: "pending" | "approved" | "rejected";
    amount: number | null;
    submitted_at: string | null;
    approved_at: string | null;
    rejected: boolean;
    rejection_reason: string | null;
  };

  overall_status: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// User
// ─────────────────────────────────────────────────────────────────────────────

export interface User {
  id: string;
  name: string;
  email: string;

  role: "user" | "host" | "admin" | "super_admin";

  status?: string;

  phone_number?: string;

  email_verified?: boolean;

  created_at?: string;
  createdAt?: string;

  bookings?: any[];
  listings?: any[];

  id_images?: string[];

  idVerificationUrl?: string;
  paymentReceiptUrl?: string;
  hostExpiryDate?: string;
  statusReason?: string;

  host_details?: {
    rating?: number;
    totalListings?: number;

    verified?: boolean;

    id_verified?: boolean;
    id_verified_at?: string | null;

    id_rejected?: boolean;
    id_rejection_reason?: string | null;

    payment_verified?: boolean;
    payment_verified_at?: string | null;

    payment_rejected?: boolean;
    payment_rejection_reason?: string | null;
  };

  // Some parts of the frontend use hostDetails
  hostDetails?: {
    rating?: number;
    totalListings?: number;

    verified?: boolean;

    id_verified?: boolean;
    id_verified_at?: string | null;

    id_rejected?: boolean;
    id_rejection_reason?: string | null;

    payment_verified?: boolean;
    payment_verified_at?: string | null;

    payment_rejected?: boolean;
    payment_rejection_reason?: string | null;
  };

  verificationStatus?: VerificationStatus | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Tokens
// ─────────────────────────────────────────────────────────────────────────────

interface Tokens {
  accessToken: string;
  refreshToken: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Context
// ─────────────────────────────────────────────────────────────────────────────

interface AuthContextType {
  user: User | null;
  tokens: Tokens | null;

  isLoading: boolean;

  isAuthenticated: boolean;

  login: (user: User, tokens: Tokens) => void;

  logout: () => void;

  updateUser: (user: User) => void;

  getAccessToken: () => string | null;

  refreshTokens: () => Promise<boolean>;

  // ⭐ NEW
  refreshUser: () => Promise<User | null>;

  updateVerificationStatus: (status: VerificationStatus) => void;
}

// ─────────────────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const API_URL = "https://api.mar-haba.ly";

// ─────────────────────────────────────────────────────────────────────────────
// Provider
// ─────────────────────────────────────────────────────────────────────────────

export const AuthProvider: React.FC<{
  children: ReactNode;
}> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);

  const [tokens, setTokens] = useState<Tokens | null>(null);

  const [isLoading, setIsLoading] = useState(true);

  const navigate = useNavigate();

  // ───────────────────────────────────────────────────────────────────────────
  // Get current user from backend
  // ───────────────────────────────────────────────────────────────────────────

  const fetchCurrentUser = async (
    accessToken: string,
  ): Promise<User | null> => {
    try {
      console.log("🔄 Fetching latest user from server...");

      const response = await fetch(`${API_URL}/api/v1/auth/me`, {
        method: "GET",

        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },

        credentials: "include",
      });

      console.log("📡 /auth/me status:", response.status);

      if (!response.ok) {
        console.error("❌ /auth/me failed:", response.status);

        return null;
      }

      const data = await response.json();

      console.log("👤 Latest user from server:", data);

      /*
       * Your backend might return:
       *
       * {
       *   success: true,
       *   data: { ...user }
       * }
       *
       * or:
       *
       * {
       *   success: true,
       *   user: { ...user }
       * }
       */

      const freshUser = data?.data?.user ?? data?.data ?? data?.user ?? null;

      if (!freshUser) {
        console.error("❌ /auth/me did not return a user");

        return null;
      }

      return freshUser as User;
    } catch (error) {
      console.error("❌ Failed to fetch current user:", error);

      return null;
    }
  };

  // ───────────────────────────────────────────────────────────────────────────
  // Refresh user manually
  // ───────────────────────────────────────────────────────────────────────────

  const refreshUser = async (): Promise<User | null> => {
    if (!tokens?.accessToken) {
      console.warn("⚠️ Cannot refresh user: no access token");

      return null;
    }

    const freshUser = await fetchCurrentUser(tokens.accessToken);

    if (freshUser) {
      console.log("✅ Updating AuthContext with fresh user:", freshUser.status);

      setUser(freshUser);

      localStorage.setItem("user", JSON.stringify(freshUser));

      return freshUser;
    }

    return null;
  };

  // ───────────────────────────────────────────────────────────────────────────
  // Load auth state
  // ───────────────────────────────────────────────────────────────────────────

  useEffect(() => {
    const loadAuthState = async () => {
      try {
        const storedUser = localStorage.getItem("user");

        const storedTokens = localStorage.getItem("tokens");

        if (!storedUser || !storedTokens) {
          console.log("ℹ️ No stored authentication");

          setIsLoading(false);

          return;
        }

        const parsedUser: User = JSON.parse(storedUser);

        const parsedTokens: Tokens = JSON.parse(storedTokens);

        /*
         * First load the cached user so the application
         * knows who is logged in.
         */

        setUser(parsedUser);
        setTokens(parsedTokens);
        apiService.setAccessToken(parsedTokens.accessToken);

        console.log("📦 Cached user status:", parsedUser.status);

        // ───────────────────────────────────────────
        // ⭐ IMPORTANT
        // Get the latest user from database
        // ───────────────────────────────────────────

        const freshUser = await fetchCurrentUser(parsedTokens.accessToken);

        if (freshUser) {
          console.log("✅ Fresh database status:", freshUser.status);

          setUser(freshUser);

          localStorage.setItem("user", JSON.stringify(freshUser));
        } else {
          console.warn(
            "⚠️ Could not refresh user from server. Using cached user.",
          );
        }
      } catch (error) {
        console.error("❌ Failed to load auth state:", error);
      } finally {
        setIsLoading(false);
      }
    };

    loadAuthState();
  }, []);

  // ───────────────────────────────────────────────────────────────────────────
  // Save auth state
  // ───────────────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (user && tokens) {
      localStorage.setItem("user", JSON.stringify(user));

      localStorage.setItem("tokens", JSON.stringify(tokens));
    }
  }, [user, tokens]);

  // ───────────────────────────────────────────────────────────────────────────
  // Login
  // ───────────────────────────────────────────────────────────────────────────

  const login = (userData: User, tokensData: Tokens) => {
    console.log("🔐 Login user:", userData);
    console.log("🔑 Access token received:", !!tokensData?.accessToken);

    setUser(userData);
    setTokens(tokensData);

    // Store complete auth state
    localStorage.setItem("user", JSON.stringify(userData));

    localStorage.setItem("tokens", JSON.stringify(tokensData));

    // IMPORTANT:
    // apiService uses authToken for protected API requests
    apiService.setAccessToken(tokensData.accessToken);

    console.log("✅ Auth token saved");
  };

  // ───────────────────────────────────────────────────────────────────────────
  // Logout
  // ───────────────────────────────────────────────────────────────────────────

  const logout = () => {
    setUser(null);
    setTokens(null);

    localStorage.removeItem("user");
    localStorage.removeItem("tokens");
    localStorage.removeItem("authToken");

    apiService.setAccessToken(null);

    navigate("/login");
  };
  // ───────────────────────────────────────────────────────────────────────────
  // Update user
  // ───────────────────────────────────────────────────────────────────────────

  const updateUser = (userData: User) => {
    setUser(userData);

    localStorage.setItem("user", JSON.stringify(userData));
  };

  // ───────────────────────────────────────────────────────────────────────────
  // Access token
  // ───────────────────────────────────────────────────────────────────────────

  const getAccessToken = (): string | null => {
    return tokens?.accessToken || null;
  };

  // ───────────────────────────────────────────────────────────────────────────
  // Refresh tokens
  // ───────────────────────────────────────────────────────────────────────────

  const refreshTokens = async (): Promise<boolean> => {
    if (!tokens?.refreshToken) {
      logout();

      return false;
    }

    try {
      const response = await fetch(`${API_URL}/api/v1/auth/refresh`, {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
        },

        body: JSON.stringify({
          refresh_token: tokens.refreshToken,
        }),
      });

      if (!response.ok) {
        throw new Error("Refresh failed");
      }

      const data = await response.json();

      const newTokens = data.data?.tokens;

      if (newTokens) {
        setTokens(newTokens);

        localStorage.setItem("tokens", JSON.stringify(newTokens));
        // IMPORTANT
        apiService.setAccessToken(newTokens.accessToken);

        return true;
      }

      return false;
    } catch (error) {
      console.error("❌ Token refresh failed:", error);

      logout();

      return false;
    }
  };

  // ───────────────────────────────────────────────────────────────────────────
  // Update verification status
  // ───────────────────────────────────────────────────────────────────────────

  const updateVerificationStatus = (status: VerificationStatus) => {
    setUser((currentUser) => {
      if (!currentUser) {
        return currentUser;
      }

      const updatedUser: User = {
        ...currentUser,

        verificationStatus: status,
      };

      localStorage.setItem("user", JSON.stringify(updatedUser));

      return updatedUser;
    });
  };

  // ───────────────────────────────────────────────────────────────────────────
  // Context value
  // ───────────────────────────────────────────────────────────────────────────

  const value: AuthContextType = {
    user,

    tokens,

    isLoading,

    isAuthenticated: !!user && !!tokens,

    login,

    logout,

    updateUser,

    getAccessToken,

    refreshTokens,

    // ⭐ NEW
    refreshUser,

    updateVerificationStatus,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// ─────────────────────────────────────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────────────────────────────────────

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);

  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }

  return context;
};
