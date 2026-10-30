import { ParsedUPI } from '@domain/models/ParsedUPI';

export class UPIParser {
  /**
   * Check if the given payload looks like a UPI payment URI.
   */
  static isUPI(payload: string): boolean {
    if (!payload || typeof payload !== 'string') {
      return false;
    }
    const trimmed = payload.trim();
    return /^upi:\/\/pay(\/|\?|$)/i.test(trimmed);
  }

  /**
   * Parse a raw UPI QR payload into a structured ParsedUPI object.
   * All query parameters (known and unknown) are preserved.
   */
  static parse(rawPayload: string): ParsedUPI {
    if (!rawPayload || typeof rawPayload !== 'string') {
      throw new Error('Invalid QR code');
    }

    const trimmed = rawPayload.trim();

    if (!this.isUPI(trimmed)) {
      throw new Error('This QR code is not a supported UPI payment QR');
    }

    const parameters: Record<string, string> = {};

    // Extract query string part after '?'
    const queryIndex = trimmed.indexOf('?');
    if (queryIndex !== -1 && queryIndex < trimmed.length - 1) {
      const queryString = trimmed.substring(queryIndex + 1);
      const pairs = queryString.split('&');

      for (const pair of pairs) {
        if (!pair) continue;
        const eqIndex = pair.indexOf('=');
        let key = '';
        let value = '';

        if (eqIndex === -1) {
          key = pair;
          value = '';
        } else {
          key = pair.substring(0, eqIndex);
          value = pair.substring(eqIndex + 1);
        }

        try {
          const decodedKey = decodeURIComponent(key.replace(/\+/g, ' '));
          const decodedValue = decodeURIComponent(value.replace(/\+/g, ' '));
          // Sanitize literal 'null' strings per NPCI Note 3
          if (decodedValue.trim().toLowerCase() !== 'null') {
            parameters[decodedKey] = decodedValue;
          }
        } catch {
          if (value.trim().toLowerCase() !== 'null') {
            parameters[key] = value;
          }
        }
      }
    }

    const upiId = parameters['pa']?.trim();
    if (!upiId) {
      throw new Error('Missing UPI ID in QR code');
    }

    const getParam = (key: string): string | undefined => {
      const val = parameters[key]?.trim();
      if (!val || val.toLowerCase() === 'null') return undefined;
      return val;
    };

    return {
      upiId,
      payeeName: getParam('pn'),
      amount: getParam('am'),
      minimumAmount: getParam('mam'),
      transactionNote: getParam('tn'),
      currency: getParam('cu'),
      merchantCategory: getParam('mc'),
      transactionReference: getParam('tr'),
      transactionId: getParam('tid'),
      url: getParam('url'),
      applicationId: getParam('aid'),
      version: getParam('ver'),
      mode: getParam('mode'),
      orgId: getParam('orgid'),
      signature: getParam('sign'),
      merchantId: getParam('mid'),
      storeId: getParam('msid'),
      terminalId: getParam('mtid'),
      qrMedium: getParam('qrMedium'),
      invoiceNo: getParam('invoiceNo'),
      invoiceDate: getParam('invoiceDate'),
      invoiceName: getParam('invoiceName'),
      gstIn: getParam('gstIn'),
      gstBreakup: getParam('gstBrkUp'),
      rawPayload: trimmed,
      parameters,
    };
  }
}
