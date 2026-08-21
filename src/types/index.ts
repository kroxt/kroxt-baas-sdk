/**
 * Storage adapter interface for platform-specific session persistence.
 */
export interface StorageAdapter {
  getItem(key: string): string | null | Promise<string | null>;
  setItem(key: string, value: string): void | Promise<void>;
  removeItem(key: string): void | Promise<void>;
}

/**
 * Kroxt SDK configuration options.
 */
export interface KroxtOptions {
  /** The project ID associated with the workspace */
  projectId: string;
  /** The public/secret api key for project operations */
  apiKey: string;
  /** Base API endpoint for the Kroxt BaaS server */
  baseUrl?: string;
  /** HTTP request timeout in milliseconds. Defaults to 30000 */
  timeout?: number;
  /** Number of automatic retries on network failures. Defaults to 3 */
  retries?: number;
  /** Automatically refresh authentication tokens when expired. Defaults to true */
  autoRefresh?: boolean;
  /** Enable debug logging for HTTP requests and socket events. Defaults to false */
  debug?: boolean;
  /** Custom storage adapter for token storage. Defaults to localStorage in browser, memory in Node */
  storage?: StorageAdapter;
}

/**
 * Interface representing a user record inside the workspace.
 */
export interface KroxtUser {
  id: string;
  email: string;
  name: string;
  displayName: string;
  avatar?: string;
  status: "active" | "disabled";
  emailVerified: boolean;
  roles: string[];
  metadata?: Record<string, any>;
  lastLogin?: string;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * Injected credentials response returned upon successful authentication.
 */
export interface AuthSession {
  user: KroxtUser;
  accessToken: string;
  refreshToken: string;
}

/**
 * Generic document interface stored in MongoDB collections.
 */
export interface Document<T = Record<string, any>> {
  _id: string;
  projectId: string;
  collectionId: string;
  ownerId?: string;
  data: T;
  createdBy?: string;
  updatedBy?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Sorting order directions.
 */
export type SortOrder = "asc" | "desc";

/**
 * Query filter operators.
 */
export type QueryOperator =
  | "equals"
  | "notEquals"
  | "greaterThan"
  | "lessThan"
  | "in"
  | "notIn"
  | "contains"
  | "startsWith"
  | "endsWith";

/**
 * Structured query condition.
 */
export interface QueryCondition {
  field: string;
  operator: QueryOperator;
  value: any;
}

/**
 * Pagination settings passed to queries.
 */
export interface PaginationOptions {
  page?: number;
  limit?: number;
}

/**
 * Paginated query results returned by the SDK.
 */
export interface PaginatedResult<T> {
  items: Document<T>[];
  total: number;
  page: number;
  pages: number;
  hasNext: boolean;
  hasPrevious: boolean;
}

/**
 * SMTP credentials override parameters for dynamic mail routing.
 */
export interface SMTPCredentials {
  host: string;
  port: number;
  username: string;
  password?: string;
  secure?: boolean;
}

/**
 * Email dispatch options structure.
 */
export interface EmailOptions {
  /** Recipient email address */
  to: string;
  /** Subject of the email (ignored if templated is custom but good practice) */
  subject?: string;
  /** HTML content body */
  html?: string;
  /** Template ID registered in workspace settings */
  template?: string;
  /** Dynamic key-value mappings to interpolate in template HTML */
  variables?: Record<string, any>;
  /** Request-specific SMTP configurations (overrides default mailer) */
  overrideCredentials?: {
    provider: "gmail" | "smtp" | "resend";
    fromName: string;
    fromEmail?: string;
    credentials?: SMTPCredentials;
  };
}

/**
 * SMS configuration structure.
 */
export interface SMSOptions {
  to: string;
  message: string;
}

/**
 * WhatsApp message configuration structure.
 */
export interface WhatsAppOptions {
  to: string;
  message: string;
  template?: string;
  variables?: Record<string, any>;
}

/**
 * Realtime gateway event listener callback function signature.
 */
export type RealtimeCallback<T = any> = (data: T) => void;

/**
 * Plugin definition interface for extending SDK behavior.
 */
export interface KroxtPlugin {
  install(client: any): void;
}

export * from "./payment";

