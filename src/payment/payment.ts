import { HttpClient } from "../http/client";
import {
  CancelSubscriptionOptions,
  CreatePlanOptions,
  InitializeTransactionOptions,
  InitializeTransactionResponse,
  KroxtOptions,
  ListTransactionsQuery,
  VerifyTransactionResponse,
} from "../types";

export class PaymentModule {
  private http: HttpClient;
  private options: KroxtOptions;

  constructor(http: HttpClient, options: KroxtOptions) {
    this.http = http;
    this.options = options;
  }

  /**
   * Initializes a payment transaction via the project's configured payment gateway (e.g., Paystack).
   * Returns authorization URL to redirect client to payment checkout.
   */
  public async initializeTransaction(
    options: InitializeTransactionOptions
  ): Promise<InitializeTransactionResponse> {
    const path = `/projects/${this.options.projectId}/payments/transactions/initialize`;
    const response = await this.http.post<any>(path, options);
    return response.data || response;
  }

  /**
   * Verifies payment transaction completion by reference.
   */
  public async verifyTransaction(reference: string): Promise<VerifyTransactionResponse> {
    const path = `/projects/${this.options.projectId}/payments/transactions/verify/${encodeURIComponent(
      reference
    )}`;
    const response = await this.http.get<any>(path);
    return response.data || response;
  }

  /**
   * Lists past transactions initialized under the current workspace project.
   */
  public async listTransactions(query?: ListTransactionsQuery): Promise<{
    transactions: any[];
    total: number;
    page: number;
    pages: number;
  }> {
    let path = `/projects/${this.options.projectId}/payments/transactions`;
    if (query) {
      const params = new URLSearchParams();
      if (query.status) params.append("status", query.status);
      if (query.email) params.append("email", query.email);
      if (query.page) params.append("page", String(query.page));
      if (query.limit) params.append("limit", String(query.limit));
      const queryString = params.toString();
      if (queryString) path += `?${queryString}`;
    }
    const response = await this.http.get<any>(path);
    return response.data || response;
  }

  /**
   * Creates a subscription plan for billing workspace users (synced with Paystack Plan API).
   */
  public async createPlan(options: CreatePlanOptions): Promise<any> {
    const path = `/projects/${this.options.projectId}/payments/plans`;
    const response = await this.http.post<any>(path, options);
    return response.data || response;
  }

  /**
   * Retrieves all subscription plans available under this project workspace.
   */
  public async listPlans(): Promise<any[]> {
    const path = `/projects/${this.options.projectId}/payments/plans`;
    const response = await this.http.get<any>(path);
    return response.data || response;
  }

  /**
   * Cancels/disables an active user subscription.
   */
  public async cancelSubscription(options: CancelSubscriptionOptions): Promise<any> {
    const path = `/projects/${this.options.projectId}/payments/subscriptions/cancel`;
    const response = await this.http.post<any>(path, options);
    return response.data || response;
  }

  /**
   * Lists customer subscriptions under this project workspace.
   */
  public async listSubscriptions(): Promise<any[]> {
    const path = `/projects/${this.options.projectId}/payments/subscriptions`;
    const response = await this.http.get<any>(path);
    return response.data || response;
  }
}
