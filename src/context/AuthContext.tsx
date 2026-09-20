// src/context/AuthContext.tsx
import { apiService } from "../services/api";

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

// ─────────────────────────────────────────────────────────────────────────────
// Types (kept the same as yours)
// ─────────────────────────────────────────────────────────────────────────────

export interface VerificationStatus { /* ...unchanged... */ }
export interface User {
  created_at: any;
  name(name: any): unknown;
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

const AuthContext = createContext<AuthContextType | undefined>(undefined);
const API_URL = "https://api.mar-haba.ly";

// ─────────────────────────────────────────────────────────────────────────────
// JWT helpers — derive minimal identity from token (no user info storage)
// ─────────────────────────────────────────────────────────────────────────────

function decodeJwt(token: string): any | null {
  try {
    const payload = token.split(".")[1];
    if (!payload) return null;
    // base64url → base64
    const b64 = payload.replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(decodeURIComponent(escape(atob(b64))));
  } catch {
    return null;
  }
}

function userFromToken(accessToken: string): User | null {
  const claims = decodeJwt(accessToken);
  if (!claims) return null;

  const id = claims.sub || claims.userId || claims.user_id || claims.id;
  const role = claims.role || claims.user_role;

  if (!id) return null;

  // Minimal placeholder — real data comes from /auth/me
  return {
    id: String(id),
    role: role ?? "user",
    name: "",
    email: "",
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Provider
// ─────────────────────────────────────────────────────────────────────────────

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [tokens, setTokens] = useState<Tokens | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  // ─────────────────────────────────────────────
  // Fetch full user from server
  // ─────────────────────────────────────────────
  const fetchCurrentUser = useCallback(async (accessToken: string): Promise<User | null> => {
    try {
      const res = await fetch(`${API_URL}/api/v1/auth/me`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        credentials: "include",
      });

      if (!res.ok) return null;

      const data = await res.json();
      return (data?.data?.user ?? data?.data ?? data?.user ?? null) as User | null;
    } catch {
      return null;
    }
  }, []);

  // ─────────────────────────────────────────────
  // refreshUser — public API
  // ─────────────────────────────────────────────
  const refreshUser = useCallback(async (): Promise<User | null> => {
    if (!tokens?.accessToken) return null;
    const fresh = await fetchCurrentUser(tokens.accessToken);
    if (fresh) setUser(fresh);
    return fresh;
  }, [tokens?.accessToken, fetchCurrentUser]);

  // ─────────────────────────────────────────────
  // Load auth state on mount
  // ─────────────────────────────────────────────
  useEffect(() => {
    const loadAuthState = async () => {
      try {
        const storedTokens = localStorage.getItem("tokens");
        if (!storedTokens) {
          setIsLoading(false);
          return;
        }

        const parsedTokens: Tokens = JSON.parse(storedTokens);

        // 1. Seed user from token (id + role only)
        const seedUser = userFromToken(parsedTokens.accessToken);
        if (seedUser) setUser(seedUser);

        setTokens(parsedTokens);
        apiService.setAccessToken(parsedTokens.accessToken);

        // 2. Hydrate full user from server (in-memory only)
        const fresh = await fetchCurrentUser(parsedTokens.accessToken);
        if (fresh) setUser(fresh);
      } catch (err) {
        console.error("❌ Failed to load auth state:", err);
      } finally {
        setIsLoading(false);
      }
    };

    loadAuthState();
  }, [fetchCurrentUser]);

  // ─────────────────────────────────────────────
  // Persist ONLY tokens (never user)
  // ─────────────────────────────────────────────
  useEffect(() => {
    if (tokens) {
      localStorage.setItem("tokens", JSON.stringify(tokens));
    }
  }, [tokens]);

  // ─────────────────────────────────────────────
  // Login
  // ─────────────────────────────────────────────
  const login = useCallback((userData: User, tokensData: Tokens) => {
    setUser(userData);           // in memory only
    setTokens(tokensData);       // persisted
    apiService.setAccessToken(tokensData.accessToken);
  }, []);

  // ─────────────────────────────────────────────
  // Logout
  // ─────────────────────────────────────────────
  const logout = useCallback(() => {
    setUser(null);
    setTokens(null);
    localStorage.removeItem("tokens");
    localStorage.removeItem("user");     // clean up legacy
    localStorage.removeItem("authToken");
    apiService.setAccessToken(null);
    navigate("/login");
  }, [navigate]);

  // ─────────────────────────────────────────────
  // updateUser (in-memory only)
  // ─────────────────────────────────────────────
  const updateUser = useCallback((userData: User) => {
    setUser(userData);
  }, []);

  // ─────────────────────────────────────────────
  // updateVerificationStatus (in-memory only)
  // ─────────────────────────────────────────────
  const updateVerificationStatus = useCallback((status: VerificationStatus) => {
    setUser((cur) => (cur ? { ...cur, verificationStatus: status } : cur));
  }, []);

  // ─────────────────────────────────────────────
  // getAccessToken
  // ─────────────────────────────────────────────
  const getAccessToken = useCallback(() => tokens?.accessToken ?? null, [tokens?.accessToken]);

  // ─────────────────────────────────────────────
  // refreshTokens
  // ─────────────────────────────────────────────
  const refreshTokens = useCallback(async (): Promise<boolean> => {
    if (!tokens?.refreshToken) {
      logout();
      return false;
    }
    try {
      const res = await fetch(`${API_URL}/api/v1/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: tokens.refreshToken }),
      });
      if (!res.ok) throw new Error("Refresh failed");

      const data = await res.json();
      const newTokens: Tokens | undefined = data.data?.tokens;
      if (!newTokens) return false;

      setTokens(newTokens);
      apiService.setAccessToken(newTokens.accessToken);

      // Re-sync user after token refresh
      const fresh = await fetchCurrentUser(newTokens.accessToken);
      if (fresh) setUser(fresh);

      return true;
    } catch (err) {
      console.error("❌ Token refresh failed:", err);
      logout();
      return false;
    }
  }, [tokens?.refreshToken, logout, fetchCurrentUser]);

  // ─────────────────────────────────────────────
  // Context value
  // ─────────────────────────────────────────────
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
    [user, tokens, isLoading, login, logout, updateUser, getAccessToken, refreshTokens, refreshUser, updateVerificationStatus]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextType => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
};