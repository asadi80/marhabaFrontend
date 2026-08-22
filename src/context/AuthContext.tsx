// src/context/AuthContext.tsx
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';

// Define User type matching your backend
export interface User {
  id: string;
  name: string;
  email: string;
  role: 'user' | 'host' | 'admin' | 'super_admin';
  status?: string;
  phone_number?: string;
  email_verified?: boolean;
  created_at?: string;
  createdAt?: string;
  bookings?: any[]; 
  listings?: any[]; 
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
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const API_URL = 'https://api.mar-haba.ly';

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [tokens, setTokens] = useState<Tokens | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  // Load auth state from localStorage on mount
  useEffect(() => {
    const loadAuthState = () => {
      try {
        const storedUser = localStorage.getItem('user');
        const storedTokens = localStorage.getItem('tokens');

        if (storedUser && storedTokens) {
          const parsedUser = JSON.parse(storedUser);
          const parsedTokens = JSON.parse(storedTokens);
          setUser(parsedUser);
          setTokens(parsedTokens);
        }
      } catch (error) {
        console.error('Failed to load auth state:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadAuthState();
  }, []);

  // Save auth state to localStorage when it changes
  useEffect(() => {
    if (user && tokens) {
      localStorage.setItem('user', JSON.stringify(user));
      localStorage.setItem('tokens', JSON.stringify(tokens));
    } else {
      localStorage.removeItem('user');
      localStorage.removeItem('tokens');
    }
  }, [user, tokens]);

  const login = (userData: User, tokensData: Tokens) => {
    setUser(userData);
    setTokens(tokensData);
  };

  const logout = () => {
    setUser(null);
    setTokens(null);
    localStorage.removeItem('user');
    localStorage.removeItem('tokens');
    navigate('/login');
  };

  const updateUser = (userData: User) => {
    setUser(userData);
  };

  const getAccessToken = (): string | null => {
    return tokens?.accessToken || null;
  };

  const refreshTokens = async (): Promise<boolean> => {
    if (!tokens?.refreshToken) {
      logout();
      return false;
    }

    try {
      const response = await fetch(`${API_URL}/api/v1/auth/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ refresh_token: tokens.refreshToken }),
      });

      if (!response.ok) {
        throw new Error('Refresh failed');
      }

      const data = await response.json();
      const newTokens = data.data?.tokens;

      if (newTokens) {
        setTokens(newTokens);
        return true;
      }

      return false;
    } catch (error) {
      console.error('Token refresh failed:', error);
      logout();
      return false;
    }
  };

  const value = {
    user,
    tokens,
    isLoading,
    isAuthenticated: !!user && !!tokens,
    login,
    logout,
    updateUser,
    getAccessToken,
    refreshTokens,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};