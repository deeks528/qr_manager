export type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';

export interface LogEntry {
  id: string;
  timestamp: string; // ISO 8601 string
  level: LogLevel;
  tag: string;
  message: string;
  details?: Record<string, any> | string;
  errorStack?: string;
}

export type ScanStatus =
  | 'SCANNED'
  | 'PARSED'
  | 'PARSE_FAILED'
  | 'TRANSFORMED'
  | 'PAYMENT_LAUNCHED'
  | 'PAYMENT_SUCCESS'
  | 'PAYMENT_FAILED';

export interface ScanLogEntry {
  id: string;
  timestamp: string; // ISO 8601 string
  source: 'camera' | 'gallery';
  scannedIntent: string; // The exact raw string scanned from QR code
  parsedUPIId?: string;
  parsedPayeeName?: string;
  parsedAmount?: string;
  transformedIntent?: string; // The final UPI URI generated for payment
  overrides?: {
    amount?: string;
    description?: string;
  };
  status: ScanStatus;
  errorMessage?: string;
}
