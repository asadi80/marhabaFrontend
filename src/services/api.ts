const API_URL = "https://api.mar-haba.ly";

export interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
  code?: string;
}

class ApiService {
  private accessToken: string | null = null;

  constructor() {
    // Restore token after page refresh
    this.accessToken = localStorage.getItem("authToken");
  }

  setAccessToken(token: string | null) {
    this.accessToken = token;

    if (token) {
      localStorage.setItem("authToken", token);
    } else {
      localStorage.removeItem("authToken");
    }
  }

  getAccessToken() {
    // Always prefer memory token, otherwise use localStorage
    return this.accessToken || localStorage.getItem("authToken");
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
  ): Promise<ApiResponse<T>> {
    const url = `${API_URL}${endpoint}`;

    /*
     * IMPORTANT:
     * Always get the latest token from localStorage.
     * This fixes the upload 401 after login/page refresh.
     */
    const token = this.getAccessToken();

    const isFormData = options.body instanceof FormData;

    const headers: Record<string, string> = {};

    // Do NOT set Content-Type for FormData.
    if (!isFormData) {
      headers["Content-Type"] = "application/json";
    }

    // Add JWT
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
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

    console.log("🌐 API Request:", {
      url,
      method: options.method || "GET",
      hasToken: !!token,
      tokenPreview: token
        ? `${token.substring(0, 15)}...`
        : null,
      isFormData,
    });

    try {
      let response = await fetch(url, config);

      let data: any;

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

      // ─────────────────────────────────────
      // UNAUTHORIZED
      // ─────────────────────────────────────

  if (response.status === 401) {
  console.error("❌ API returned 401:", {
    url,
    hasToken: !!token,
    message: data?.message,
    code: data?.code,
  });

  const error = new Error(
    data?.message || "Unauthorized"
  );

  // Keep the backend error code available
  (error as any).code = data?.code;

  throw error;
}

      // ─────────────────────────────────────
      // OTHER ERRORS
      // ─────────────────────────────────────

      if (!response.ok) {
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
      if (
        error instanceof Error &&
        error.message === "UNAUTHORIZED"
      ) {
        throw error;
      }

      return {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "Network error",
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
  params?: Record<string, any>
): Promise<ApiResponse<T>> {
  // Build URL with query parameters
  let url = endpoint;
  if (params) {
    const queryString = new URLSearchParams();
    Object.keys(params).forEach(key => {
      if (params[key] !== undefined && params[key] !== null) {
        queryString.append(key, String(params[key]));
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
      body:
        data instanceof FormData
          ? data
          : JSON.stringify(data),
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
endpoint: string, p0: { userId: string; },
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
    body:
      data instanceof FormData
        ? data
        : JSON.stringify(data),
  });
}


}

export const apiService = new ApiService();