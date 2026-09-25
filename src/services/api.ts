//src/services/api.ts
const API_URL = "https://api.mar-haba.ly";

export interface ApiResponse<T = any> {
  error?: string;
  success: boolean;
  message?: string;
  data?: T;
  code?: string;
}

interface LoginResponseData {
  user: {
    id: string;
    role: string;
    name: string;
    email: string;
    created_at?: any;
    [key: string]: any;
  };

  tokens: {
    accessToken: string;
    refreshToken: string;
  };

  verificationStatus?: {
    [key: string]: any;
  };
}

interface StoredTokens {
  accessToken: string;
  refreshToken: string;
}

class ApiService {
  private accessToken: string | null = null;

  constructor() {
    // Single source of truth: localStorage["tokens"]
    this.loadStoredAccessToken();
  }

  // ─────────────────────────────────────────────
  // Load access token from tokens storage
  // ─────────────────────────────────────────────

  private loadStoredAccessToken() {
    try {
      const storedTokens = localStorage.getItem("tokens");

      if (!storedTokens) {
        this.accessToken = null;
        return;
      }

      const parsed: StoredTokens = JSON.parse(storedTokens);

      this.accessToken = parsed?.accessToken || null;
    } catch (error) {
      console.error("❌ Failed to load stored tokens:", error);

      this.accessToken = null;
    }
  }

  // ─────────────────────────────────────────────
  // Set access token
  // ─────────────────────────────────────────────

  setAccessToken(token: string | null) {
    this.accessToken = token;
  }

  // ─────────────────────────────────────────────
  // Get latest access token
  // ─────────────────────────────────────────────

  getAccessToken(): string | null {
    // Prefer the in-memory token.
    if (this.accessToken) {
      return this.accessToken;
    }

    // Fallback to tokens in localStorage.
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

  // ─────────────────────────────────────────────
  // Clear authentication
  // ─────────────────────────────────────────────

  clearAccessToken() {
    this.accessToken = null;
  }

  // ─────────────────────────────────────────────
  // Generic request
  // ─────────────────────────────────────────────

  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
  ): Promise<ApiResponse<T>> {
    const url = `${API_URL}${endpoint}`;

    /*
     * Always use the latest access token.
     */
    const token = this.getAccessToken();

    const isFormData = options.body instanceof FormData;

    const headers: Record<string, string> = {};

    /*
     * IMPORTANT:
     *
     * Do NOT manually set Content-Type for FormData.
     * Browser must set multipart/form-data + boundary.
     */
    if (!isFormData) {
      headers["Content-Type"] = "application/json";
    }

    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    /*
     * Merge custom headers.
     */
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

    console.log("🌐 API Request:", {
      url,
      method: options.method || "GET",
      hasToken: !!token,
      tokenPreview: token ? `${token.substring(0, 15)}...` : null,
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

      console.log("🌐 API Response:", {
        url,
        status: response.status,
        data,
      });

      // ─────────────────────────────────────────
      // UNAUTHORIZED
      // ─────────────────────────────────────────

      if (response.status === 401) {
        console.error("❌ API returned 401:", {
          url,
          hasToken: !!token,
          message: data?.message,
          code: data?.code,
        });

        const error = new Error(data?.message || "Unauthorized");

        (error as any).code = data?.code || "UNAUTHORIZED";

        throw error;
      }

      // ─────────────────────────────────────────
      // OTHER HTTP ERRORS
      // ─────────────────────────────────────────

      if (!response.ok) {
        return {
          success: false,
          message: data?.message || data?.error || "Request failed",
          code: data?.code,
          data: data?.data,
        };
      }

      // ─────────────────────────────────────────
      // SUCCESS
      // ─────────────────────────────────────────

      return {
        success: true,
        data: data?.data ?? data,
        message: data?.message,
        code: data?.code,
      };
    } catch (error) {
      /*
       * Preserve HTTP 401 errors so callers can handle them.
       */
      if (
        error instanceof Error &&
        (error.message === "Unauthorized" ||
          (error as any).code === "UNAUTHORIZED")
      ) {
        throw error;
      }

      console.error("❌ API request failed:", error);

      return {
        success: false,
        message: error instanceof Error ? error.message : "Network error",
      };
    }
  }

  // ─────────────────────────────────────────────
  // AUTH
  // ─────────────────────────────────────────────

  async login(
    email: string,
    password: string,
  ): Promise<ApiResponse<LoginResponseData>> {
    return this.request<LoginResponseData>("/api/v1/auth/login", {
      method: "POST",
      body: JSON.stringify({
        email,
        password,
      }),
    });
  }

  async register(userData: any) {
    return this.request("/api/v1/auth/register", {
      method: "POST",
      body: JSON.stringify(userData),
    });
  }

  async logout() {
    return this.request("/api/v1/auth/logout", {
      method: "POST",
    });
  }

  async getCurrentUser() {
    return this.request("/api/v1/auth/me");
  }

  async refreshToken(refreshToken: string) {
    return this.request("/api/v1/auth/refresh", {
      method: "POST",
      body: JSON.stringify({
        refresh_token: refreshToken,
      }),
    });
  }

  async resendVerification(email: string) {
    return this.request("/api/v1/auth/resend-verification", {
      method: "POST",
      body: JSON.stringify({
        email,
      }),
    });
  }

  // ─────────────────────────────────────────────
  // PROTECTED GET
  // ─────────────────────────────────────────────

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

  // ─────────────────────────────────────────────
  // PROTECTED POST
  // ─────────────────────────────────────────────

  async postProtectedData<T = any>(
    endpoint: string,
    data: any,
  ): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: "POST",
      body: data instanceof FormData ? data : JSON.stringify(data),
    });
  }

  // ─────────────────────────────────────────────
  // PROTECTED PUT
  // ─────────────────────────────────────────────

  async putProtectedData<T = any>(
    endpoint: string,
    data: any,
  ): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: "PUT",
      body: data instanceof FormData ? data : JSON.stringify(data),
    });
  }

  // ─────────────────────────────────────────────
  // PROTECTED DELETE
  // ─────────────────────────────────────────────

  async deleteProtectedData<T = any>(
    endpoint: string,
    _options?: { userId?: string },
  ): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: "DELETE",
    });
  }

  // ─────────────────────────────────────────────
  // PROTECTED PATCH
  // ─────────────────────────────────────────────

  async patchProtectedData<T = any>(
    endpoint: string,
    data: any,
  ): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: "PATCH",
      body: data instanceof FormData ? data : JSON.stringify(data),
    });
  }
}

export const apiService = new ApiService();
