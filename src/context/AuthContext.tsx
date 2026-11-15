
// src/context/AuthContext.tsx

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  ReactNode,
} from "react";

import { useNavigate } from "react-router-dom";
import { apiService } from "../services/api";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type AccountType = "traveler" | "host";

export interface VerificationStatus {
  [key: string]: any;
}

export interface User {
  id: string;
  role: string;
  account_type?: AccountType;
  name: string;
  email: string;
  created_at?: any;

  verificationStatus?: VerificationStatus | null;
  requiresIdUpload?: boolean;
  isHostApproved?: boolean;

  [key: string]: any;
}

interface Tokens {
  accessToken: string;
  refreshToken: string;
}

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
  refreshUser: () => Promise<User | null>;

  updateVerificationStatus: (status: VerificationStatus) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(
  undefined
);

const API_URL = "https://api.mar-haba.ly";

// ─────────────────────────────────────────────────────────────────────────────
// JWT helpers
// ─────────────────────────────────────────────────────────────────────────────

function decodeJwt(token: string): any | null {
  try {
    const payload = token.split(".")[1];

    if (!payload) return null;

    const b64 = payload
      .replace(/-/g, "+")
      .replace(/_/g, "/");

    const padded =
      b64 + "=".repeat((4 - (b64.length % 4)) % 4);

    return JSON.parse(
      decodeURIComponent(
        Array.from(atob(padded))
          .map((char) =>
            "%" +
            char.charCodeAt(0).toString(16).padStart(2, "0")
          )
          .join("")
      )
    );
  } catch {
    return null;
  }
}

// Reconstruct a minimal user from JWT claims.
// The full user is fetched from /auth/me afterward.
function userFromToken(accessToken: string): User | null {
  const claims = decodeJwt(accessToken);

  if (!claims) return null;

  const id =
    claims.sub ||
    claims.userId ||
    claims.user_id ||
    claims.id;

  const role =
    claims.role ||
    claims.user_role;

  const accountType =
    claims.account_type ||
    claims.accountType;

  if (!id) return null;

  return {
    id: String(id),
    role: role ?? "user",

    account_type:
      accountType === "host" ? "host" : "traveler",

    name: claims.name ?? "",
    email: claims.email ?? "",
  };
}

// Normalize different possible API response structures.
function normalizeUser(data: any): User | null {
  const user =
    data?.data?.user ??
    data?.data ??
    data?.user ??
    data;

  if (!user || typeof user !== "object" || !user.id) {
    return null;
  }

  const accountType =
    user.account_type ??
    user.accountType;

  return {
    ...user,

    id: String(user.id),

    role: user.role ?? "user",

    account_type:
      accountType === "host" ? "host" : "traveler",

    name: user.name ?? "",
    email: user.email ?? "",
  } as User;
}

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
  // Fetch current user
  // ───────────────────────────────────────────────────────────────────────────

  const fetchCurrentUser = useCallback(
    async (accessToken: string): Promise<User | null> => {
      try {
        const res = await fetch(
          `${API_URL}/api/v1/auth/me`,
          {
            method: "GET",
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/json",
            },
            credentials: "include",
          }
        );

        if (!res.ok) {
          return null;
        }

        const data = await res.json();

        const freshUser = normalizeUser(data);

        if (!freshUser) {
          console.error(
            "Invalid user response from /auth/me:",
            data
          );
          return null;
        }

        return freshUser;
      } catch (error) {
        console.error(
          "❌ Failed to fetch current user:",
          error
        );

        return null;
      }
    },
    []
  );

  // ───────────────────────────────────────────────────────────────────────────
  // Logout
  // ───────────────────────────────────────────────────────────────────────────

  const logout = useCallback(() => {
    // Revoke the backend session.
    void apiService.logout().catch((error) => {
      console.error("Logout request failed:", error);
    });

    setUser(null);
    setTokens(null);

    localStorage.removeItem("tokens");
    localStorage.removeItem("user");
    localStorage.removeItem("authToken");

    apiService.setAccessToken(null);

    navigate("/login", { replace: true });
  }, [navigate]);

  // ───────────────────────────────────────────────────────────────────────────
  // Refresh tokens
  // ───────────────────────────────────────────────────────────────────────────

  const refreshTokens = useCallback(
    async (): Promise<boolean> => {
      const storedTokens = localStorage.getItem("tokens");

      let currentTokens: Tokens | null = null;

      try {
        if (storedTokens) {
          currentTokens = JSON.parse(storedTokens);
        }
      } catch {
        currentTokens = null;
      }

      const refreshToken =
        tokens?.refreshToken ??
        currentTokens?.refreshToken;

      if (!refreshToken) {
        console.warn("⚠️ No refresh token available");
        return false;
      }

      try {
        console.log("🔄 Attempting token refresh...");

        const res = await fetch(
          `${API_URL}/api/v1/auth/refresh`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            credentials: "include",
            body: JSON.stringify({
              refresh_token: refreshToken,
            }),
          }
        );

        if (!res.ok) {
          const errorText = await res.text().catch(() => "");

          console.error(
            "❌ Token refresh failed:",
            res.status,
            errorText
          );

          return false;
        }

        const data = await res.json();

        const newTokens: Tokens | undefined =
          data?.data?.tokens ??
          data?.tokens;

        if (
          !newTokens?.accessToken ||
          !newTokens?.refreshToken
        ) {
          console.error(
            "❌ Refresh response did not contain valid tokens:",
            data
          );

          return false;
        }

        // Persist tokens.
        localStorage.setItem(
          "tokens",
          JSON.stringify(newTokens)
        );

        setTokens(newTokens);

        apiService.setAccessToken(
          newTokens.accessToken
        );

        console.log("✅ Token refresh successful");

        // Fetch the complete user, including account_type.
        const freshUser = await fetchCurrentUser(
          newTokens.accessToken
        );

        if (freshUser) {
          setUser(freshUser);
        }

        return true;
      } catch (error) {
        console.error(
          "❌ Token refresh request failed:",
          error
        );

        return false;
      }
    },
    [tokens?.refreshToken, fetchCurrentUser]
  );

  // ───────────────────────────────────────────────────────────────────────────
  // Refresh user
  // ───────────────────────────────────────────────────────────────────────────

  const refreshUser = useCallback(
    async (): Promise<User | null> => {
      const currentAccessToken = tokens?.accessToken;

      if (!currentAccessToken) {
        return null;
      }

      const fresh = await fetchCurrentUser(
        currentAccessToken
      );

      if (fresh) {
        setUser(fresh);
      }

      return fresh;
    },
    [tokens?.accessToken, fetchCurrentUser]
  );

  // ───────────────────────────────────────────────────────────────────────────
  // Load authentication state
  // ───────────────────────────────────────────────────────────────────────────

  useEffect(() => {
    let cancelled = false;

    const loadAuthState = async () => {
      try {
        const storedTokens =
          localStorage.getItem("tokens");

        if (!storedTokens) {
          return;
        }

        let parsedTokens: Tokens;

        try {
          parsedTokens = JSON.parse(storedTokens);
        } catch {
          console.error(
            "❌ Invalid tokens in localStorage"
          );

          localStorage.removeItem("tokens");
          return;
        }

        if (
          !parsedTokens?.accessToken ||
          !parsedTokens?.refreshToken
        ) {
          console.error(
            "❌ Stored tokens are incomplete"
          );

          localStorage.removeItem("tokens");
          return;
        }

        // Restore tokens.
        if (!cancelled) {
          setTokens(parsedTokens);
        }

        apiService.setAccessToken(
          parsedTokens.accessToken
        );

        // Restore minimal user from JWT while /auth/me loads.
        const seedUser = userFromToken(
          parsedTokens.accessToken
        );

        if (seedUser && !cancelled) {
          setUser(seedUser);
        }

        // First attempt: existing access token.
        console.log(
          "🔐 Checking existing access token..."
        );

        const freshUser = await fetchCurrentUser(
          parsedTokens.accessToken
        );

        if (freshUser) {
          if (!cancelled) {
            setUser(freshUser);
          }

          console.log(
            "✅ Existing access token is valid"
          );

          return;
        }

        // Access token failed: attempt refresh.
        console.log(
          "⚠️ Access token rejected. Attempting refresh..."
        );

        const refreshResponse = await fetch(
          `${API_URL}/api/v1/auth/refresh`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            credentials: "include",
            body: JSON.stringify({
              refresh_token: parsedTokens.refreshToken,
            }),
          }
        );

        if (!refreshResponse.ok) {
          const errorText =
            await refreshResponse.text().catch(() => "");

          console.error(
            "❌ Refresh failed:",
            refreshResponse.status,
            errorText
          );

          localStorage.removeItem("tokens");
          apiService.setAccessToken(null);

          if (!cancelled) {
            setTokens(null);
            setUser(null);
          }

          return;
        }

        const refreshData = await refreshResponse.json();

        const newTokens: Tokens | undefined =
          refreshData?.data?.tokens ??
          refreshData?.tokens;

        if (
          !newTokens?.accessToken ||
          !newTokens?.refreshToken
        ) {
          console.error(
            "❌ Invalid refresh response:",
            refreshData
          );

          localStorage.removeItem("tokens");
          apiService.setAccessToken(null);

          if (!cancelled) {
            setTokens(null);
            setUser(null);
          }

          return;
        }

        // Save refreshed tokens.
        localStorage.setItem(
          "tokens",
          JSON.stringify(newTokens)
        );

        apiService.setAccessToken(
          newTokens.accessToken
        );

        if (!cancelled) {
          setTokens(newTokens);
        }

        console.log(
          "✅ Access token refreshed successfully"
        );

        // Fetch complete user using the new access token.
        const refreshedUser = await fetchCurrentUser(
          newTokens.accessToken
        );

        if (refreshedUser && !cancelled) {
          setUser(refreshedUser);

          console.log(
            "✅ User restored after token refresh"
          );
        } else if (!refreshedUser) {
          console.error(
            "❌ New access token was issued but /auth/me failed"
          );

          localStorage.removeItem("tokens");
          apiService.setAccessToken(null);

          if (!cancelled) {
            setTokens(null);
            setUser(null);
          }
        }
      } catch (error) {
        console.error(
          "❌ Failed to load auth state:",
          error
        );
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    loadAuthState();

    return () => {
      cancelled = true;
    };
  }, [fetchCurrentUser]);

  // ───────────────────────────────────────────────────────────────────────────
  // Persist tokens
  // ───────────────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (tokens) {
      localStorage.setItem(
        "tokens",
        JSON.stringify(tokens)
      );
    }
  }, [tokens]);

  // ───────────────────────────────────────────────────────────────────────────
  // Login
  // ───────────────────────────────────────────────────────────────────────────

  const login = useCallback(
    (userData: User, tokensData: Tokens) => {
      // Normalize user so account_type is preserved.
      const normalizedUser = normalizeUser(userData);

      if (!normalizedUser) {
        console.error("Invalid user passed to login");
        return;
      }

      setUser(normalizedUser);
      setTokens(tokensData);

      localStorage.setItem(
        "tokens",
        JSON.stringify(tokensData)
      );

      apiService.setAccessToken(
        tokensData.accessToken
      );
    },
    []
  );

  // ───────────────────────────────────────────────────────────────────────────
  // Update user
  // ───────────────────────────────────────────────────────────────────────────

  const updateUser = useCallback(
    (userData: User) => {
      const normalizedUser = normalizeUser(userData);

      if (normalizedUser) {
        setUser(normalizedUser);
      }
    },
    []
  );

  // ───────────────────────────────────────────────────────────────────────────
  // Update verification status
  // ───────────────────────────────────────────────────────────────────────────

  const updateVerificationStatus = useCallback(
    (status: VerificationStatus) => {
      setUser((current) =>
        current
          ? {
              ...current,
              verificationStatus: status,
            }
          : current
      );
    },
    []
  );

  // ───────────────────────────────────────────────────────────────────────────
  // Get access token
  // ───────────────────────────────────────────────────────────────────────────

  const getAccessToken = useCallback(
    () => tokens?.accessToken ?? null,
    [tokens?.accessToken]
  );

  // ───────────────────────────────────────────────────────────────────────────
  // Context value
  // ───────────────────────────────────────────────────────────────────────────

  const value = useMemo<AuthContextType>(
    () => ({
      user,
      tokens,
      isLoading,

      isAuthenticated: !!user && !!tokens,

      login,
      logout,
      updateUser,

      getAccessToken,

      refreshTokens,
      refreshUser,

      updateVerificationStatus,
    }),
    [
      user,
      tokens,
      isLoading,
      login,
      logout,
      updateUser,
      getAccessToken,
      refreshTokens,
      refreshUser,
      updateVerificationStatus,
    ]
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────────────────────────────────────

export const useAuth = (): AuthContextType => {
  const ctx = useContext(AuthContext);

  if (!ctx) {
    throw new Error(
      "useAuth must be used within an AuthProvider"
    );
  }

  return ctx;
};
