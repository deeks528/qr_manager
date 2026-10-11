export interface ParsedUPI {
  upiId?: string;
  payeeName?: string;
  amount?: string;
  transactionNote?: string;
  currency?: string;
  merchantCategory?: string;
  transactionReference?: string;
  transactionId?: string;
  url?: string;
  applicationId?: string;
  rawPayload: string;

  // Preserve all original query parameters
  parameters: Record<string, string>;
}
