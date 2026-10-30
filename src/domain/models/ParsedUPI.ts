export interface ParsedUPI {
  upiId?: string;
  payeeName?: string;
  amount?: string;
  minimumAmount?: string; // mam
  transactionNote?: string;
  currency?: string;
  merchantCategory?: string; // mc
  transactionReference?: string; // tr
  transactionId?: string; // tid
  url?: string;
  applicationId?: string; // aid
  version?: string; // ver
  mode?: string; // mode
  orgId?: string; // orgid
  signature?: string; // sign
  merchantId?: string; // mid
  storeId?: string; // msid
  terminalId?: string; // mtid
  qrMedium?: string; // qrMedium
  invoiceNo?: string; // invoiceNo
  invoiceDate?: string; // invoiceDate
  invoiceName?: string; // invoiceName
  gstIn?: string; // gstIn
  gstBreakup?: string; // gstBrkUp
  rawPayload: string;

  // Preserve all original query parameters
  parameters: Record<string, string>;
}
