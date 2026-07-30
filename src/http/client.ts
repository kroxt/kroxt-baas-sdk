import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse, AxiosError } from "axios";
import { KroxtOptions, StorageAdapter } from "../types";
import { KroxtError } from "../errors/kroxt-error";
import { getStorageAdapter } from "../auth/storage";

export class HttpClient {
  private instance: AxiosInstance;
  private storage: StorageAdapter;
  private options: KroxtOptions;

  // Interceptor callback hooks
  private requestHooks: ((config: any) => void | Promise<void>)[] = [];
  private responseHooks: ((response: any) => void | Promise<void>)[] = [];
  private errorHooks: ((error: KroxtError) => void | Promise<void>)[] = [];
  // Token refresh hooks — only fire when a silent auto-refresh succeeds
  private tokenRefreshHooks: ((newToken: string) => void | Promise<void>)[] = [];

  // Token refreshing state lock to prevent concurrent refresh requests
  private isRefreshing = false;
  private refreshSubscribers: ((token: string) => void)[] = [];

  constructor(options: KroxtOptions) {
    this.options = options;
    this.storage = getStorageAdapter(options.storage);

    const defaultBaseUrl = "https://kroxt-baas.onrender.com";

    this.instance = axios.create({
      baseURL: options.baseUrl || defaultBaseUrl,
      timeout: options.timeout || 30000,
      headers: {
        "Content-Type": "application/json",
        "x-api-key": options.apiKey,
      },
    });

    this.setupInterceptors();
  }

  /**
   * Sets up request and response interceptors, including automatic JWT token refreshing
   */
  private setupInterceptors(): void {
    // 1. Request Interceptor: Inject bearer auth token + run user-defined request hooks
    this.instance.interceptors.request.use(
      async (config) => {
        const token = await this.storage.getItem("kroxt_access_token");
        if (token && config.headers) {
          config.headers.Authorization = `Bearer ${token}`;
        }

        // Run user request hooks
        for (const hook of this.requestHooks) {
          try {
            await hook(config);
          } catch (e) {
            if (this.options.debug) {
              console.error("[Kroxt SDK] Error running request hook:", e);
            }
          }
        }

        if (this.options.debug) {
          console.log(`[Kroxt SDK] Request: ${config.method?.toUpperCase()} ${config.url}`, config.data || "");
        }

        return config;
      },
      (error) => Promise.reject(error)
    );

    // 2. Response Interceptor: Run user response hooks + handle automatic refresh on 401
    this.instance.interceptors.response.use(
      async (response) => {
        // Run user response hooks
        for (const hook of this.responseHooks) {
          try {
            await hook(response);
          } catch (e) {
            if (this.options.debug) {
              console.error("[Kroxt SDK] Error running response hook:", e);
            }
          }
        }

        if (this.options.debug) {
          console.log(`[Kroxt SDK] Response: ${response.status} ${response.config.url}`, response.data || "");
        }

        return response;
      },
      async (error: AxiosError) => {
        const originalRequest = error.config as AxiosRequestConfig & { _retry?: boolean };
        
        // Check if error is 401 Unauthorized and auto-refresh is active
        if (
          error.response?.status === 401 &&
          this.options.autoRefresh !== false &&
          originalRequest &&
          !originalRequest._retry
        ) {
          originalRequest._retry = true;

          const refreshToken = await this.storage.getItem("kroxt_refresh_token");
          if (refreshToken) {
            if (this.options.debug) {
              console.log("[Kroxt SDK] Access token expired (401). Initiating token refresh...");
            }

            if (!this.isRefreshing) {
              this.isRefreshing = true;

              try {
                // Call refresh endpoint on a fresh request to avoid circular interception
                const refreshUrl = `/projects/${this.options.projectId}/auth/refresh`;
                const res = await axios.post(
                  (this.options.baseUrl || "https://kroxt-baas.onrender.com") + refreshUrl,
                  { refreshToken },
                  { headers: { "x-api-key": this.options.apiKey } }
                );

                const newAccessToken = res.data?.data?.accessToken || res.data?.accessToken;
                if (newAccessToken) {
                  await this.storage.setItem("kroxt_access_token", newAccessToken);
                  
                  if (this.options.debug) {
                    console.log("[Kroxt SDK] Token refreshed successfully.");
                  }

                  this.onTokenRefreshed(newAccessToken);
                  this.isRefreshing = false;

                  // Notify external token refresh hooks (e.g. to reconnect the socket)
                  for (const hook of this.tokenRefreshHooks) {
                    try {
                      await hook(newAccessToken);
                    } catch (e) {
                      if (this.options.debug) {
                        console.error("[Kroxt SDK] Error running tokenRefresh hook:", e);
                      }
                    }
                  }
                  
                  // Retry the original request
                  if (originalRequest.headers) {
                    originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
                  }
                  return this.instance(originalRequest);
                }
              } catch (refreshErr) {
                this.isRefreshing = false;
                this.refreshSubscribers = [];
                
                // Clear session if refresh failed (invalid or expired refresh token)
                await this.storage.removeItem("kroxt_access_token");
                await this.storage.removeItem("kroxt_refresh_token");
                await this.storage.removeItem("kroxt_user_profile");

                if (this.options.debug) {
                  console.error("[Kroxt SDK] Token refresh failed. Cleared active session credentials.", refreshErr);
                }
              }
            } else {
              // Wait for the active refresh promise to resolve
              return new Promise((resolve) => {
                this.subscribeTokenRefresh((newToken) => {
                  if (originalRequest.headers) {
                    originalRequest.headers.Authorization = `Bearer ${newToken}`;
                  }
                  resolve(this.instance(originalRequest));
                });
              });
            }
          }
        }

        // Normalize the error to KroxtError and dispatch to custom hooks
        const kroxtErr = KroxtError.fromError(error);
        for (const hook of this.errorHooks) {
          try {
            await hook(kroxtErr);
          } catch (e) {
            if (this.options.debug) {
              console.error("[Kroxt SDK] Error running error hook:", e);
            }
          }
        }

        return Promise.reject(kroxtErr);
      }
    );
  }

  private subscribeTokenRefresh(cb: (token: string) => void): void {
    this.refreshSubscribers.push(cb);
  }

  private onTokenRefreshed(token: string): void {
    this.refreshSubscribers.map((cb) => cb(token));
    this.refreshSubscribers = [];
  }

  /**
   * Registers a user-defined request interceptor hook.
   */
  public onRequest(hook: (config: AxiosRequestConfig) => void | Promise<void>): void {
    this.requestHooks.push(hook);
  }

  /**
   * Registers a user-defined response interceptor hook.
   */
  public onResponse(hook: (response: AxiosResponse) => void | Promise<void>): void {
    this.responseHooks.push(hook);
  }

  /**
   * Registers a user-defined error interceptor hook.
   */
  public onError(hook: (error: KroxtError) => void | Promise<void>): void {
    this.errorHooks.push(hook);
  }

  /**
   * Registers a hook that fires only when a silent token auto-refresh succeeds.
   * Use this to reconnect the WebSocket with the updated token instead of
   * the generic onResponse hook which fires on every HTTP response.
   */
  public onTokenRefresh(hook: (newToken: string) => void | Promise<void>): void {
    this.tokenRefreshHooks.push(hook);
  }

  /**
   * Performs an HTTP request with automatic retry logic for transient network or 5xx issues.
   */
  public async request<T = any>(config: AxiosRequestConfig): Promise<T> {
    const maxRetries = this.options.retries !== undefined ? this.options.retries : 3;
    let attempt = 0;

    const executeAttempt = async (): Promise<T> => {
      try {
        const response = await this.instance.request<T>(config);
        return response.data;
      } catch (err: any) {
        const kroxtErr = KroxtError.fromError(err);
        attempt++;

        // Retry parameters evaluation:
        // 1. Only retry if we have retries remaining
        // 2. Do NOT retry client/validation errors (4xx) except for timeout/network drops
        // 3. Retry on HTTP status >= 500 (internal server errors) or timeout/network failures (status === 0 or status === 500)
        const isTransientError = kroxtErr.status >= 500 || kroxtErr.status === 0 || kroxtErr.code === "ECONNABORTED";

        if (attempt <= maxRetries && isTransientError) {
          const delay = Math.pow(2, attempt) * 1000; // Exponential backoff (2s, 4s, 8s...)
          if (this.options.debug) {
            console.warn(`[Kroxt SDK] Request failed (${kroxtErr.message}). Retrying in ${delay}ms (Attempt ${attempt}/${maxRetries})...`);
          }
          await new Promise((resolve) => setTimeout(resolve, delay));
          return executeAttempt();
        }

        throw kroxtErr;
      }
    };

    return executeAttempt();
  }

  public async get<T = any>(url: string, config?: AxiosRequestConfig): Promise<T> {
    return this.request<T>({ ...config, method: "GET", url });
  }

  public async post<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    return this.request<T>({ ...config, method: "POST", url, data });
  }

  public async put<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    return this.request<T>({ ...config, method: "PUT", url, data });
  }

  public async patch<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    return this.request<T>({ ...config, method: "PATCH", url, data });
  }

  public async delete<T = any>(url: string, config?: AxiosRequestConfig): Promise<T> {
    return this.request<T>({ ...config, method: "DELETE", url });
  }
}
