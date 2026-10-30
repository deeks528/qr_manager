import assert from 'node:assert/strict';
import test from 'node:test';

import { ProfileType, UPIProfile, WhatsAppProfile } from '../../src/domain/models/Profile';
import { QRPayloadService } from '../../src/domain/services/QRPayloadService';

const baseProfile = {
  id: 'profile-1',
  nickname: 'Home Account',
  logoPath: null,
  avatarColor: '#2563EB',
  displayOrder: 0,
  quickAccessSlot: null,
  createdAt: 1,
  updatedAt: 1,
};

test('UPI payload omits amount when runtime amount is zero', () => {
  const profile: UPIProfile = {
    ...baseProfile,
    type: ProfileType.UPI,
    upiId: 'home@upi',
    minimumAmount: 10,
    defaultDescription: null,
  };

  const payload = QRPayloadService.createUPIPayload(profile, 0);

  assert.equal(payload.includes('am='), false);
  assert.equal(payload.startsWith('upi://pay?'), true);
});

test('UPI payload includes amount when amount is greater than zero', () => {
  const profile: UPIProfile = {
    ...baseProfile,
    type: ProfileType.UPI,
    upiId: 'home@upi',
    minimumAmount: null,
    defaultDescription: null,
  };

  const payload = QRPayloadService.createUPIPayload(profile, 25);

  assert.equal(payload.includes('am=25.00'), true);
});

test('WhatsApp payload contains normalized digits only', () => {
  const profile: WhatsAppProfile = {
    ...baseProfile,
    type: ProfileType.WhatsApp,
    mobileNumber: '+91 98765 43210',
  };

  assert.equal(QRPayloadService.createWhatsAppPayload(profile), 'https://wa.me/919876543210');
});

test('UPI payload falls back to stored minimum amount when runtime amount is blank', () => {
  const profile: UPIProfile = {
    ...baseProfile,
    type: ProfileType.UPI,
    upiId: 'home@upi',
    minimumAmount: 10,
    defaultDescription: null,
  };

  const payload = QRPayloadService.createUPIPayload(profile, null);

  assert.equal(payload.includes('am=10.00'), true);
});

test('UPI payload uses compact format and RFC 3986 percent encoding for spaces', () => {
  const profile: UPIProfile = {
    ...baseProfile,
    nickname: 'John Doe Enterprise',
    type: ProfileType.UPI,
    upiId: 'johndoe@bank',
    minimumAmount: null,
    defaultDescription: 'Monthly Grocery Bill',
  };

  const payload = QRPayloadService.createUPIPayload(profile);

  // Verifies RFC 3986 space encoding (%20, not +)
  assert.equal(payload.includes('pn=John%20Doe%20Enterprise'), true);
  assert.equal(payload.includes('tn=Monthly%20Grocery%20Bill'), true);
  assert.equal(payload.includes('+'), false);

  // Verifies core compact parameters for instant camera scanning and literal '@' preservation
  assert.equal(payload.includes('pa=johndoe@bank'), true);
  assert.equal(payload.includes('cu=INR'), true);

  // Verifies heavy metadata tags are omitted to maintain low QR density
  assert.equal(payload.includes('orgid='), false);
  assert.equal(payload.includes('mode='), false);
  assert.equal(payload.includes('ver='), false);
});

