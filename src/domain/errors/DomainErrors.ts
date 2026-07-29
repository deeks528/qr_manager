export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class DuplicateUPIError extends Error {
  constructor() {
    super('UPI ID already exists.');
    this.name = 'DuplicateUPIError';
  }
}

export class DuplicatePhoneError extends Error {
  constructor() {
    super('WhatsApp number already exists.');
    this.name = 'DuplicatePhoneError';
  }
}

export class InvalidBackupError extends Error {
  constructor(message = 'Invalid backup.') {
    super(message);
    this.name = 'InvalidBackupError';
  }
}
