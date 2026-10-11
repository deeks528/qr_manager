import { ParsedUPI } from '@domain/models/ParsedUPI';

export interface Linker {
  openURL(url: string): Promise<any>;
  canOpenURL(url: string): Promise<boolean>;
}

export interface PaymentOverrides {
  amount?: string;
  description?: string;
}

export class UPIPaymentService {
  /**
   * Build the final UPI URI by combining original QR parameters with user overrides.
   *
   * Rules:
   * 1. Preserve all original parameters (including unknown ones).
   * 2. If user provided a new or edited amount, update 'am'. If untouched, keep original 'am'.
   * 3. If user provided a new or edited description, update 'tn'. If untouched, keep original 'tn'.
   * 4. If 'cu' exists in original, preserve it. If missing, add 'cu=INR'.
   * 5. Encode values properly.
   */
  static buildPaymentURI(parsed: ParsedUPI, overrides: PaymentOverrides = {}): string {
    const finalParams: Record<string, string> = { ...parsed.parameters };

    // Amount rule:
    // If user provided a non-empty amount, update 'am'
    const trimmedAmount = overrides.amount?.trim();
    if (trimmedAmount !== undefined && trimmedAmount !== '') {
      finalParams['am'] = trimmedAmount;
    }

    // Description rule:
    // If user provided a non-empty description, update 'tn'
    const trimmedDescription = overrides.description?.trim();
    if (trimmedDescription !== undefined && trimmedDescription !== '') {
      finalParams['tn'] = trimmedDescription;
    }

    // Currency rule:
    // If 'cu' is missing, add 'cu=INR'. If already exists, preserve it.
    if (!finalParams['cu']) {
      finalParams['cu'] = 'INR';
    }

    // Determine base URI: use the original prefix up to '?' or default to 'upi://pay/'
    let baseUri = 'upi://pay';
    const queryIndex = parsed.rawPayload.indexOf('?');
    if (queryIndex !== -1) {
      baseUri = parsed.rawPayload.substring(0, queryIndex);
    }
    // Ensure base ends with / or nothing
    if (!baseUri.endsWith('/') && !baseUri.endsWith('pay')) {
      baseUri = `${baseUri}/`;
    }

    const queryString = Object.entries(finalParams)
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
      .join('&');

    console.log(baseUri, queryString);

    return `${baseUri}?${queryString}`;
  }

  /**
   * Open the final UPI deep link in an external UPI app.
   */
  static async openUPIPayment(uri: string, customLinker?: Linker): Promise<void> {
    try {
      const linker: Linker = customLinker ?? (require('react-native').Linking as Linker);
      const canOpen = await linker.canOpenURL(uri);
      if (!canOpen) {
        try {
          await linker.openURL(uri);
          return;
        } catch {
          throw new Error('No UPI app found on device');
        }
      }

      await linker.openURL(uri);
    } catch (error: any) {
      if (error.message?.includes('No UPI app')) {
        throw error;
      }
      throw new Error(`Unable to open UPI payment: ${error.message || 'Unknown error'}`);
    }
  }
}
