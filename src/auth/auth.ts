import { HttpClient } from "../http/client";
import { AuthSession, KroxtOptions, KroxtUser, StorageAdapter } from "../types";
import { getStorageAdapter } from "./storage";

export class AuthModule {
  private http: HttpClient;
  private storage: StorageAdapter;
  private options: KroxtOptions;

  constructor(http: HttpClient, options: KroxtOptions) {
    this.http = http;
    this.options = options;
    this.storage = getStorageAdapter(options.storage);
  }

  /**
   * Registers a new project end-user.
   * Dispatches verification OTP code to their email automatically if configured.
   */
  public async register(payload: {
    email: string;
    password?: string;
    name?: string;
    displayName?: string;
    avatar?: string;
    metadata?: Record<string, any>;
  }): Promise<AuthSession> {
    const signupPath = `/projects/${this.options.projectId}/auth/signup`;
    
    // Support aliases 'name' / 'displayName'
    const body = {
      email: payload.email,
      password: payload.password,
      name: payload.name || payload.displayName,
      displayName: payload.displayName || payload.name,
      avatar: payload.avatar,
      metadata: payload.metadata,
    };

    const response = await this.http.post<any>(signupPath, body);
    const data = response.data || response;

    const session: AuthSession = {
      user: data.user,
      accessToken: data.accessToken,
      refreshToken: data.refreshToken,
    };

    // Auto-save tokens on registration
    await this.storage.setItem("kroxt_access_token", session.accessToken);
    if (session.refreshToken) {
      await this.storage.setItem("kroxt_refresh_token", session.refreshToken);
    }
    await this.storage.setItem("kroxt_user_profile", JSON.stringify(session.user));

    return session;
  }

  /**
   * Logs in a project user using their email and password.
   */
  public async login(payload: {
    email: string;
    password?: string;
  }): Promise<AuthSession> {
    const loginPath = `/projects/${this.options.projectId}/auth/login`;

    const response = await this.http.post<any>(loginPath, payload);
    const data = response.data || response;

    const session: AuthSession = {
      user: data.user,
      accessToken: data.accessToken,
      refreshToken: data.refreshToken,
    };

    // Save session credentials
    await this.storage.setItem("kroxt_access_token", session.accessToken);
    if (session.refreshToken) {
      await this.storage.setItem("kroxt_refresh_token", session.refreshToken);
    }
    await this.storage.setItem("kroxt_user_profile", JSON.stringify(session.user));

    return session;
  }

  /**
   * Retrieves the current logged-in user profile context from the server.
   */
  public async me(): Promise<KroxtUser | null> {
    const mePath = `/projects/${this.options.projectId}/auth/me`;

    try {
      const response = await this.http.get<any>(mePath);
      const user: KroxtUser = response.data || response;
      await this.storage.setItem("kroxt_user_profile", JSON.stringify(user));
      return user;
    } catch (err) {
      // If unauthorized, session is expired/invalid
      return null;
    }
  }

  /**
   * Retrieves the cached user profile from the storage adapter.
   */
  public async getCachedUser(): Promise<KroxtUser | null> {
    const raw = await this.storage.getItem("kroxt_user_profile");
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  /**
   * Logs out the user, invalidating the session on the backend and clearing local tokens.
   */
  public async logout(): Promise<void> {
    const logoutPath = `/projects/${this.options.projectId}/auth/logout`;

    try {
      await this.http.post(logoutPath, {});
    } catch (err) {
      // Bypassed: clear local credentials regardless of server error
    } finally {
      await this.storage.removeItem("kroxt_access_token");
      await this.storage.removeItem("kroxt_refresh_token");
      await this.storage.removeItem("kroxt_user_profile");
    }
  }

  /**
   * Manually triggers rotation of session tokens.
   */
  public async refresh(): Promise<string> {
    const refreshToken = await this.storage.getItem("kroxt_refresh_token");
    if (!refreshToken) {
      throw new Error("No refresh token available in storage.");
    }

    const refreshPath = `/projects/${this.options.projectId}/auth/refresh`;
    const response = await this.http.post<any>(refreshPath, { refreshToken });
    const data = response.data || response;

    const newAccessToken = data.accessToken;
    await this.storage.setItem("kroxt_access_token", newAccessToken);
    
    return newAccessToken;
  }
}
