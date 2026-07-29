import { UPIProfile, WhatsAppProfile } from '@domain/models/Profile';
import { ValidationService } from '@domain/services/ValidationService';

export class QRPayloadService {
  static createUPIPayload(profile: UPIProfile, runtimeAmount?: number | null): string {
    const params = new URLSearchParams();
    params.set('pa', ValidationService.validateUPIId(profile.upiId));
    params.set('pn', profile.nickname);

    const amount = ValidationService.validateAmount(runtimeAmount ?? profile.minimumAmount);
    if (amount !== null && amount > 0) {
      params.set('am', amount.toFixed(2));
    }

    if (profile.defaultDescription) {
      params.set('tn', profile.defaultDescription);
    }

    return `upi://pay?${params.toString()}`;
  }

  static createWhatsAppPayload(profile: WhatsAppProfile): string {
    return `https://wa.me/${ValidationService.validateMobileNumber(profile.mobileNumber)}`;
  }
}
