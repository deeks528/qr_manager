import { AppLogger } from '@domain/services/AppLogger';
import { ParsedUPI } from '@domain/models/ParsedUPI';

export interface Linker {
  openURL(url: string): Promise<any>;
  canOpenURL(url: string): Promise<boolean>;
}

export interface PaymentOverrides {
  amount?: string;
  description?: string;
  isFromGallery?: boolean;
}

export class UPIPaymentService {
  /**
   * Build the final UPI URI by combining original QR parameters with user overrides.
   *
   * Rules:
   * 1. Preserve all original parameters (including unknown ones).
   * 2. If user provided a new or edited amount, update 'am'. If untouched, keep original 'am'.
   * 3. If user provided a new or edited description, update 'tn'. If untouched, keep original 'tn'.
   * 4. If 'cu' exists in original, preserve it. If missing and unsigned, add 'cu=INR'.
   * 5. If 'sign' exists, ensure it is preserved and positioned as the last parameter (NPCI specification).
   * 6. Remove trailing slash on base URI (upi://pay? instead of upi://pay/?).
   * 7. Sanitize literal 'null' parameter values.
   */
  static buildPaymentURI(parsed: ParsedUPI, overrides: PaymentOverrides = {}): string {
    const finalParams: Record<string, string> = { ...parsed.parameters };

    // Amount rule:
    // If user provided a non-empty amount, update 'am' and format to 2 decimal places per NPCI spec
    const trimmedAmount = overrides.amount?.trim();
    if (trimmedAmount !== undefined && trimmedAmount !== '') {
      const num = parseFloat(trimmedAmount);
      finalParams['am'] = !isNaN(num) && num > 0 ? num.toFixed(2) : trimmedAmount;
    }

    // Description rule:
    // If user provided a non-empty description, update 'tn'
    const trimmedDescription = overrides.description?.trim();
    if (trimmedDescription !== undefined && trimmedDescription !== '') {
      finalParams['tn'] = trimmedDescription;
    }

    // Extract signature if present, so we can ensure it is placed as the LAST parameter
    let signValue: string | undefined = finalParams['sign'];
    if (signValue !== undefined) {
      delete finalParams['sign'];
    }

    // Currency rule:
    // If 'cu' is missing, add 'cu=INR' for unsigned payloads (avoid modifying signed payloads)
    if (!finalParams['cu'] && !signValue) {
      finalParams['cu'] = 'INR';
    }

    // Deeplink mode rule:
    // mode=02 explicitly designates an offline static QR (physically printed on counter standee).
    // UPI apps (PhonePe, GPay) block/dismiss external ACTION_VIEW intents containing mode=02
    // to prevent remote counter QR spoofing. Remove mode=02 for unsigned intents so payment can proceed.
    if (!signValue && finalParams['mode'] === '02') {
      delete finalParams['mode'];
    }

    // Gallery medium rule (NPCI v1.7.2 qrMedium=01 for Pick from Gallery)
    if (overrides.isFromGallery && !finalParams['qrMedium'] && !signValue) {
      finalParams['qrMedium'] = '01';
    }

    // Clean any literal "null" values from params per NPCI Note 3
    for (const [key, val] of Object.entries(finalParams)) {
      if (typeof val === 'string' && val.trim().toLowerCase() === 'null') {
        delete finalParams[key];
      }
    }

    // Determine base URI: use standard 'upi://pay' without trailing slash
    let baseUri = 'upi://pay';
    const queryIndex = parsed.rawPayload.indexOf('?');
    if (queryIndex !== -1) {
      baseUri = parsed.rawPayload.substring(0, queryIndex).trim();
    }
    // Remove trailing slash if present (e.g., upi://pay/ -> upi://pay)
    if (baseUri.endsWith('/')) {
      baseUri = baseUri.slice(0, -1);
    }

    const queryParts = Object.entries(finalParams).map(([k, v]) => {
      // In UPI URIs, the VPA handle 'pa' MUST preserve literal '@' (not '%40').
      // UPI apps (PhonePe, GPay, Paytm) regex-match on raw intent strings and reject '%40'.
      // RFC 3986 Section 3.4 explicitly allows '@' unencoded in query strings.
      if (k === 'pa') {
        const encoded = encodeURIComponent(v).replace(/%40/g, '@');
        return `${encodeURIComponent(k)}=${encoded}`;
      }
      return `${encodeURIComponent(k)}=${encodeURIComponent(v)}`;
    });

    // NPCI specification requires 'sign' to be the last tag of the intent/QR
    if (signValue !== undefined) {
      queryParts.push(`sign=${encodeURIComponent(signValue)}`);
    }

    const queryString = queryParts.join('&');
    return `${baseUri}?${queryString}`;
  }

  /**
   * Open the final UPI deep link in an external UPI app.
   */
  static async openUPIPayment(uri: string, customLinker?: Linker): Promise<void> {
    AppLogger.debug('UPIPaymentService', 'Attempting to launch UPI payment URI', { uri });
    try {
      const linker: Linker = customLinker ?? (require('react-native').Linking as Linker);
      const canOpen = await linker.canOpenURL(uri);
      if (!canOpen) {
        try {
          await linker.openURL(uri);
          AppLogger.info('UPIPaymentService', 'Launched UPI payment via direct openURL fallback', { uri });
          return;
        } catch (openErr) {
          AppLogger.error('UPIPaymentService', 'No UPI application found on device', openErr, { uri });
          throw new Error('No UPI app found on device');
        }
      }

      await linker.openURL(uri);
      AppLogger.info('UPIPaymentService', 'Launched UPI payment successfully', { uri });
    } catch (error: any) {
      if (error.message?.includes('No UPI app')) {
        throw error;
      }
      AppLogger.error('UPIPaymentService', 'Failed to launch UPI payment', error, { uri });
      throw new Error(`Unable to open UPI payment: ${error.message || 'Unknown error'}`);
    }
  }
}
