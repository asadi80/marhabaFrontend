
// src/services/api.ts

const API_URL = "https://api.mar-haba.ly";

// ============================================================
// TYPES
// ============================================================

export interface ApiResponse<T = any> {
  error?: string;
  success: boolean;
  message?: string;
  data?: T;
  code?: string;
}

export type AccountType = "traveler" | "host";

export type GoogleAuthRequest =
  | {
      intent: "signup";
      accountType: AccountType;
    }
  | {
      intent: "login";
    };

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: string;
  account_type: "traveler" | "host" | "admin" | "super_admin";
  status: string;
  created_at?: string;

  requiresIdUpload?: boolean;
  isHostApproved?: boolean;
  verificationStatus?: Record<string, any>;

  [key: string]: any;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface LoginResponseData {
  user: AuthUser;
  tokens: AuthTokens;

  requiresIdUpload?: boolean;
  isHostApproved?: boolean;
  verificationStatus?: Record<string, any>;
}

interface StoredTokens {
  accessToken: string;
  refreshToken: string;
}

// ============================================================
// API SERVICE
// ============================================================

class ApiService {
  private accessToken: string | null = null;

  constructor() {
    this.loadStoredAccessToken();
  }

  // ==========================================================
  // LOAD STORED ACCESS TOKEN
  // ==========================================================

  private loadStoredAccessToken(): void {
    try {
      const storedTokens = localStorage.getItem("tokens");

      if (!storedTokens) {
        this.accessToken = null;
        return;
      }

      const parsed: StoredTokens = JSON.parse(storedTokens);

      this.accessToken = parsed?.accessToken || null;
    } catch (error) {
      console.error("Failed to load stored tokens:", error);
      this.accessToken = null;
    }
  }

  // ==========================================================
  // SET ACCESS TOKEN
  // ==========================================================

  setAccessToken(token: string | null): void {
    this.accessToken = token;
  }

  // ==========================================================
  // GET ACCESS TOKEN
  // ==========================================================

  getAccessToken(): string | null {
    if (this.accessToken) {
      return this.accessToken;
    }

    try {
      const storedTokens = localStorage.getItem("tokens");

      if (!storedTokens) {
        return null;
      }

      const parsed: StoredTokens = JSON.parse(storedTokens);

      this.accessToken = parsed?.accessToken || null;

      return this.accessToken;
    } catch {
      return null;
    }
  }

  // ==========================================================
  // CLEAR ACCESS TOKEN
  // ==========================================================

  clearAccessToken(): void {
    this.accessToken = null;
  }

  // ==========================================================
  // GENERIC REQUEST
  // ==========================================================

  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
  ): Promise<ApiResponse<T>> {
    const url = `${API_URL}${endpoint}`;

    const token = this.getAccessToken();

    const isFormData =
      typeof FormData !== "undefined" &&
      options.body instanceof FormData;

    const headers: Record<string, string> = {};

    // Do not manually set Content-Type for FormData.
    if (!isFormData) {
      headers["Content-Type"] = "application/json";
    }

    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    // Merge custom headers.
    if (options.headers) {
      const customHeaders = options.headers as Record<string, string>;

      Object.keys(customHeaders).forEach((key) => {
        headers[key] = customHeaders[key];
      });
    }

    const config: RequestInit = {
      ...options,
      headers,
      credentials: "include",
    };

    console.log("API Request:", {
      url,
      method: options.method || "GET",
      hasToken: !!token,
      isFormData,
    });

    try {
      const response = await fetch(url, config);

      let data: any = {};

      try {
        data = await response.json();
      } catch {
        data = {};
      }

      console.log("API Response:", {
        url,
        status: response.status,
      });

      // ------------------------------------------------------
      // UNAUTHORIZED
      // ------------------------------------------------------

      if (response.status === 401) {
        const error = new Error(
          data?.message || "Unauthorized",
        );

        (error as any).code =
          data?.code || "UNAUTHORIZED";

        throw error;
      }

      // ------------------------------------------------------
      // OTHER HTTP ERRORS
      // ------------------------------------------------------

      if (!response.ok) {
        return {
          success: false,
          message:
            data?.message ||
            data?.error ||
            "Request failed",
          code: data?.code,
          data: data?.data,
        };
      }

      // ------------------------------------------------------
      // SUCCESS
      // ------------------------------------------------------

      return {
        success: true,
        data: data?.data ?? data,
        message: data?.message,
        code: data?.code,
      };
    } catch (error) {
      // Preserve HTTP 401 errors.
      if (
        error instanceof Error &&
        (error.message === "Unauthorized" ||
          (error as any).code === "UNAUTHORIZED")
      ) {
        throw error;
      }

      console.error("API request failed:", error);

      return {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "Network error",
      };
    }
  }

  // ==========================================================
  // AUTH — GOOGLE SIGNUP AND LOGIN
  // ==========================================================

  async loginWithGoogle(
    idToken: string,
    authRequest: GoogleAuthRequest,
  ): Promise<ApiResponse<LoginResponseData>> {
    if (!idToken) {
      return {
        success: false,
        message: "Google ID token is required.",
      };
    }

    // Validate signup account type.
    if (
      authRequest.intent === "signup" &&
      !["traveler", "host"].includes(authRequest.accountType)
    ) {
      return {
        success: false,
        message: "Invalid account type.",
      };
    }

    const body = {
      idToken,
      ...authRequest,
    };

    return this.request<LoginResponseData>(
      "/api/v1/auth/google",
      {
        method: "POST",
        body: JSON.stringify(body),
      },
    );
  }

  // ==========================================================
  // LOGOUT
  // ==========================================================

  async logout(): Promise<ApiResponse> {
    return this.request("/api/v1/auth/logout", {
      method: "POST",
    });
  }

  // ==========================================================
  // CURRENT USER
  // ==========================================================

  async getCurrentUser(): Promise<ApiResponse> {
    return this.request("/api/v1/auth/me");
  }

  // ==========================================================
  // REFRESH TOKEN
  // ==========================================================

  async refreshToken(
    refreshToken: string,
  ): Promise<ApiResponse> {
    return this.request("/api/v1/auth/refresh", {
      method: "POST",
      body: JSON.stringify({
        refresh_token: refreshToken,
      }),
    });
  }

  // ==========================================================
  // PROTECTED GET
  // ==========================================================

  async getProtectedData<T = any>(
    endpoint: string,
    params?: Record<string, any>,
  ): Promise<ApiResponse<T>> {
    let url = endpoint;

    if (params) {
      const queryString = new URLSearchParams();

      Object.keys(params).forEach((key) => {
        const value = params[key];

        if (value !== undefined && value !== null) {
          queryString.append(key, String(value));
        }
      });

      const qs = queryString.toString();

      if (qs) {
        url = `${endpoint}?${qs}`;
      }
    }

    return this.request<T>(url);
  }

  // ==========================================================
  // PROTECTED POST
  // ==========================================================

  async postProtectedData<T = any>(
    endpoint: string,
    data: any,
  ): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: "POST",
      body:
        data instanceof FormData
          ? data
          : JSON.stringify(data),
    });
  }

  // ==========================================================
  // PROTECTED PUT
  // ==========================================================

  async putProtectedData<T = any>(
    endpoint: string,
    data: any,
  ): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: "PUT",
      body:
        data instanceof FormData
          ? data
          : JSON.stringify(data),
    });
  }

  // ==========================================================
  // PROTECTED DELETE
  // ==========================================================

  async deleteProtectedData<T = any>(
    endpoint: string,
    _options?: { userId?: string },
  ): Promise<ApiResponse> {
    return this.request(endpoint, {
      method: "DELETE",
    });
  }

  // ==========================================================
  // PROTECTED PATCH
  // ==========================================================

  async patchProtectedData<T = any>(
    endpoint: string,
    data?: any,
  ): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: "PATCH",
      body:
        data === undefined
          ? undefined
          : data instanceof FormData
            ? data
            : JSON.stringify(data),
    });
  }
}

// ============================================================
// SINGLE API INSTANCE
// ============================================================

export const apiService = new ApiService();
