import { MAX_NICKNAME_LENGTH } from '@domain/models/Profile';
import { ValidationError } from '@domain/errors/DomainErrors';

export class ValidationService {
  static validateNickname(nickname: string): string {
    const trimmed = nickname.trim();

    if (!trimmed) {
      throw new ValidationError('Nickname is required.');
    }

    if (trimmed.length > MAX_NICKNAME_LENGTH) {
      throw new ValidationError(`Nickname must be ${MAX_NICKNAME_LENGTH} characters or fewer.`);
    }

    return trimmed;
  }

  static validateUPIId(upiId: string): string {
    const normalized = upiId?.trim().toLowerCase();

    if (!normalized) {
      throw new ValidationError('UPI ID is required.');
    }

    if (!/^[a-z0-9.\-_]{2,256}@[a-z][a-z0-9.\-_]{1,64}$/i.test(normalized)) {
      throw new ValidationError('UPI ID is invalid.');
    }

    return normalized;
  }

  static validateMobileNumber(mobileNumber: string): string {
    const digits = mobileNumber?.replace(/\D/g, '');

    if (!digits) {
      throw new ValidationError('Mobile number is required.');
    }

    if (digits.length < 10 || digits.length > 15) {
      throw new ValidationError('Mobile number must contain 10 to 15 digits.');
    }

    return digits;
  }

  static validateAmount(amount: number | null | undefined): number | null {
    if (amount === null || amount === undefined) {
      return null;
    }

    if (!Number.isFinite(amount) || amount < 0) {
      throw new ValidationError('Amount must be zero or greater.');
    }

    return amount;
  }

  static validateCustomText(text: string): string {
    const trimmed = text?.trim();

    if (!trimmed) {
      throw new ValidationError('QR text is required.');
    }

    return trimmed;
  }
}
