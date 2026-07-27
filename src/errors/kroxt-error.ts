/**
 * Custom error class wrapping Axios and API endpoint failures.
 * Ensures internal client implementation details (like Axios properties) are never exposed.
 */
export class KroxtError extends Error {
  /** The HTTP status code (e.g., 400, 401, 403, 404, 500) */
  public readonly status: number;
  /** Internal error identifier code (e.g., 'UNAUTHORIZED', 'VALIDATION_FAILED') */
  public readonly code: string;
  /** Detailed sub-error metadata or fields that failed validation */
  public readonly details: any;

  constructor(message: string, status: number, code = "UNKNOWN_ERROR", details?: any) {
    super(message);
    this.name = "KroxtError";
    this.status = status;
    this.code = code;
    this.details = details;

    // Restore prototype chain
    Object.setPrototypeOf(this, new.target.prototype);
  }

  /**
   * Helper to parse any runtime object or Axios error into a normalized KroxtError.
   */
  public static fromError(err: any): KroxtError {
    if (err instanceof KroxtError) {
      return err;
    }

    if (err && err.isAxiosError) {
      const response = err.response;
      const status = response?.status || 500;
      const data = response?.data || {};

      const message = data.message || err.message || "An unexpected HTTP error occurred.";
      const code = data.code || (status === 401 ? "UNAUTHORIZED" : status === 403 ? "FORBIDDEN" : status === 404 ? "NOT_FOUND" : "API_ERROR");
      const details = data.data || data.details || null;

      return new KroxtError(message, status, code, details);
    }

    const msg = err instanceof Error ? err.message : String(err);
    return new KroxtError(msg, 500, "INTERNAL_CLIENT_ERROR");
  }
}
