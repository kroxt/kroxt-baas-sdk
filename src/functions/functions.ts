import { HttpClient } from "../http/client";
import { KroxtOptions } from "../types";

export class FunctionsModule {
  private http: HttpClient;
  private options: KroxtOptions;

  constructor(http: HttpClient, options: KroxtOptions) {
    this.http = http;
    this.options = options;
  }

  /**
   * Invokes a Kroxt Serverless Function by its unique slug identifier.
   */
  public async invoke<TResponse = any, TPayload = any>(
    slug: string,
    payload?: TPayload
  ): Promise<TResponse> {
    const invokeUrl = `/api/functions/${this.options.projectId}/${slug}`;

    const response = await this.http.post<any>(invokeUrl, payload);
    // Standard response format: { success: true, data: ... }
    // If the serverless handler returns flat JSON, return response directly
    if (response && response.success !== undefined && response.data !== undefined) {
      return response.data;
    }
    return response;
  }
}
