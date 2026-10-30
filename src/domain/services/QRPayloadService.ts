import { CustomProfile, UPIProfile, WhatsAppProfile } from '@domain/models/Profile';
import { ValidationService } from '@domain/services/ValidationService';

export class QRPayloadService {
  static createUPIPayload(profile: UPIProfile, runtimeAmount?: number | null): string {
    const pairs: [string, string][] = [
      ['pa', ValidationService.validateUPIId(profile.upiId)],
      ['pn', profile.nickname],
      ['cu', 'INR'],
    ];

    const amount = ValidationService.validateAmount(runtimeAmount ?? profile.minimumAmount);
    if (amount !== null && amount > 0) {
      pairs.push(['am', amount.toFixed(2)]);
    }

    if (profile.defaultDescription) {
      pairs.push(['tn', profile.defaultDescription]);
    }

    // RFC 3986 percent-encoding ensures spaces are %20 rather than '+'.
    // Preserves literal '@' in 'pa' for compatibility with UPI application VPA regexes.
    const queryString = pairs
      .map(([k, v]) => {
        if (k === 'pa') {
          return `${encodeURIComponent(k)}=${encodeURIComponent(v).replace(/%40/g, '@')}`;
        }
        return `${encodeURIComponent(k)}=${encodeURIComponent(v)}`;
      })
      .join('&');

    return `upi://pay?${queryString}`;
  }

  static createWhatsAppPayload(profile: WhatsAppProfile): string {
    return `https://wa.me/${ValidationService.validateMobileNumber(profile.mobileNumber)}`;
  }

  static createCustomPayload(profile: CustomProfile): string {
    return profile.text?.trim() || '';
  }
}
