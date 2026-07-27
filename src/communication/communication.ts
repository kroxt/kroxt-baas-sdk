import { HttpClient } from "../http/client";
import { EmailOptions, KroxtOptions, SMSOptions, WhatsAppOptions } from "../types";

export class CommunicationModule {
  private http: HttpClient;
  private options: KroxtOptions;

  constructor(http: HttpClient, options: KroxtOptions) {
    this.http = http;
    this.options = options;
  }

  /**
   * Dispatches an email transaction from the Kroxt BaaS service.
   * Supports raw HTML templates or dynamic templates with override credentials.
   */
  public async sendEmail(payload: EmailOptions): Promise<{ success: boolean; message: string }> {
    const emailPath = `/projects/${this.options.projectId}/email/send`;

    const response = await this.http.post<any>(emailPath, payload);
    return response.data || response;
  }

  /**
   * Dispatches a verification OTP code to the target email address.
   */
  public async sendOtp(payload: { email: string; purpose: string }): Promise<{ success: boolean; message: string }> {
    const otpPath = `/projects/${this.options.projectId}/otp/send`;

    const response = await this.http.post<any>(otpPath, payload);
    return response.data || response;
  }

  /**
   * Verifies a 6-digit OTP code.
   */
  public async verifyOtp(payload: { email: string; purpose: string; code: string }): Promise<{ success: boolean; message: string; data?: any }> {
    const verifyPath = `/projects/${this.options.projectId}/otp/verify`;

    const response = await this.http.post<any>(verifyPath, payload);
    return response.data || response;
  }

  /**
   * Dispatches an SMS transaction.
   * Future-proof implementation placeholder targeting SMS API.
   */
  public async sendSMS(payload: SMSOptions): Promise<{ success: boolean; message: string }> {
    const smsPath = `/projects/${this.options.projectId}/sms/send`;

    const response = await this.http.post<any>(smsPath, payload);
    return response.data || response;
  }

  /**
   * Dispatches a WhatsApp transaction message.
   * Future-proof implementation placeholder targeting WhatsApp API.
   */
  public async sendWhatsApp(payload: WhatsAppOptions): Promise<{ success: boolean; message: string }> {
    const waPath = `/projects/${this.options.projectId}/whatsapp/send`;

    const response = await this.http.post<any>(waPath, payload);
    return response.data || response;
  }
}
