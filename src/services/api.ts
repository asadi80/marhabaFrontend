// src/services/api.ts

const API_URL = "https://api.mar-haba.ly";

export interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
  code?: string;
}

class ApiService {
  private accessToken: string | null = null;

  setAccessToken(token: string | null) {
    this.accessToken = token;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
  ): Promise<ApiResponse<T>> {
    const url = `${API_URL}${endpoint}`;

    // Check if the request body is FormData
    const isFormData = options.body instanceof FormData;

    const headers: Record<string, string> = {};

    // IMPORTANT:
    // Do NOT manually set Content-Type for FormData.
    // The browser will automatically set:
    // multipart/form-data; boundary=....
    if (!isFormData) {
      headers["Content-Type"] = "application/json";
    }

    // Add Authorization header
    if (this.accessToken) {
      headers["Authorization"] = `Bearer ${this.accessToken}`;
    }

    // Merge custom headers
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

    try {
      const response = await fetch(url, config);

      // Try to parse JSON response
      let data: any;

      try {
        data = await response.json();
      } catch {
        data = {};
      }

      if (!response.ok) {
        // Handle token expiration
        if (response.status === 401) {
          throw new Error("UNAUTHORIZED");
        }

        return {
          success: false,
          message: data.message || "Request failed",
          code: data.code,
        };
      }

      return {
        success: true,
        data: data.data || data,
        message: data.message,
        code: data.code,
      };
    } catch (error) {
      if (error instanceof Error && error.message === "UNAUTHORIZED") {
        throw error;
      }

      return {
        success: false,
        message:
          error instanceof Error ? error.message : "Network error",
      };
    }
  }

  // ─────────────────────────────────────────────
  // AUTH
  // ─────────────────────────────────────────────

  async login(email: string, password: string) {
    return this.request("/api/v1/auth/login", {
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
  ): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint);
  }

  // ─────────────────────────────────────────────
  // PROTECTED POST
  // Supports JSON + FormData
  // ─────────────────────────────────────────────

  async postProtectedData<T = any>(
    endpoint: string,
    data: any,
  ): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: "POST",

      // If data is FormData, send it directly.
      // Otherwise convert it to JSON.
      body:
        data instanceof FormData
          ? data
          : JSON.stringify(data),
    });
  }

  // ─────────────────────────────────────────────
  // PROTECTED PUT
  // Supports JSON + FormData
  // ─────────────────────────────────────────────

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

  // ─────────────────────────────────────────────
  // PROTECTED DELETE
  // ─────────────────────────────────────────────

  async deleteProtectedData<T = any>(
    endpoint: string,
  ): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: "DELETE",
    });
  }
}

export const apiService = new ApiService();