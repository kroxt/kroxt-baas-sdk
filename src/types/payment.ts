export interface InitializeTransactionOptions {
  amount: number;
  email: string;
  currency?: string;
  reference?: string;
  callbackUrl?: string;
  planCode?: string;
  metadata?: Record<string, any>;
  userId?: string;
}

export interface InitializeTransactionResponse {
  transaction: any;
  authorizationUrl: string;
  accessCode: string;
  reference: string;
}

export interface VerifyTransactionResponse {
  transaction: any;
  verification: {
    status: boolean;
    message: string;
    reference: string;
    amount: number;
    currency: string;
    gatewayStatus: string;
    paidAt?: string;
    customer: {
      email: string;
      customerCode?: string;
    };
    metadata?: any;
    planCode?: string;
  };
}

export interface CreatePlanOptions {
  name: string;
  amount: number;
  interval: "hourly" | "daily" | "weekly" | "monthly" | "quarterly" | "biannually" | "annually";
  currency?: string;
  description?: string;
}

export interface CancelSubscriptionOptions {
  subscriptionCode: string;
  emailToken: string;
}

export interface ListTransactionsQuery {
  status?: string;
  email?: string;
  page?: number;
  limit?: number;
}
