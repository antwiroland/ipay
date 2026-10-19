export type ProviderName = "paystack" | "mock";

export interface InitializeInput {
  reference: string;
  amount: number; // pesewas
  currency: "GHS";
  email: string;
  phone?: string;
  callbackUrl: string;
  metadata: Record<string, string>;
}

export interface InitializeResult {
  checkoutUrl: string;
  providerReference?: string | null;
}

export type VerifiedStatus = "success" | "failed" | "abandoned" | "pending";

export interface VerifyResult {
  status: VerifiedStatus;
  amount: number; // pesewas actually charged
  currency: string;
  reference: string;
  providerReference?: string | null;
  method?: string | null; // mobile_money | card | bank
  channelDetail?: string | null; // masked
  paidAt?: Date | null;
  gatewayResponse?: string | null;
}

export interface WebhookEvent {
  event: string;
  reference: string | null;
}

export interface PaymentProvider {
  name: ProviderName;
  isTest: boolean;
  initialize(input: InitializeInput): Promise<InitializeResult>;
  /** Server-to-server verification — the only source of truth for confirming a payment. */
  verify(reference: string): Promise<VerifyResult>;
  verifyWebhookSignature(rawBody: string, signature: string | null): boolean;
  parseWebhook(rawBody: string): WebhookEvent;
  refund(reference: string, amount: number): Promise<{ ok: boolean; providerReference?: string | null; error?: string }>;
}
