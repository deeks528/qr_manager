import assert from 'node:assert/strict';
import test from 'node:test';

import { UPIParser } from '../../src/domain/services/UPIParser';
import { UPIPaymentService } from '../../src/domain/services/UPIPaymentService';

test('UPIParser: validates UPI scheme correctly', () => {
  assert.equal(UPIParser.isUPI('upi://pay?pa=test@upi'), true);
  assert.equal(UPIParser.isUPI('upi://pay/?pa=test@upi'), true);
  assert.equal(UPIParser.isUPI('UPI://PAY?pa=test@upi'), true);
  assert.equal(UPIParser.isUPI('https://example.com'), false);
  assert.equal(UPIParser.isUPI('not a url'), false);
});

test('UPIParser: throws on non-UPI QR or missing UPI ID', () => {
  assert.throws(
    () => UPIParser.parse('https://example.com'),
    /This QR code is not a supported UPI payment QR/,
  );
  assert.throws(
    () => UPIParser.parse('upi://pay/?pn=JohnDoe'),
    /Missing UPI ID in QR code/,
  );
});

test('Case A: upi://pay/?pa=test@upi&pn=Test -> add am, tn if supplied, add cu=INR', () => {
  const raw = 'upi://pay/?pa=test@upi&pn=Test';
  const parsed = UPIParser.parse(raw);

  assert.equal(parsed.upiId, 'test@upi');
  assert.equal(parsed.payeeName, 'Test');
  assert.equal(parsed.amount, undefined);
  assert.equal(parsed.currency, undefined);

  const finalUri = UPIPaymentService.buildPaymentURI(parsed, {
    amount: '500',
    description: 'Groceries',
  });

  const finalParsed = UPIParser.parse(finalUri);
  assert.equal(finalParsed.upiId, 'test@upi');
  assert.equal(finalParsed.payeeName, 'Test');
  assert.equal(finalParsed.amount, '500');
  assert.equal(finalParsed.transactionNote, 'Groceries');
  assert.equal(finalParsed.currency, 'INR');
});

test('Case B: upi://pay/?pa=test@upi&pn=Test&am=100 -> preserve am=100 when untouched', () => {
  const raw = 'upi://pay/?pa=test@upi&pn=Test&am=100';
  const parsed = UPIParser.parse(raw);

  assert.equal(parsed.amount, '100');

  // User does not change amount
  const finalUri = UPIPaymentService.buildPaymentURI(parsed, {});
  const finalParsed = UPIParser.parse(finalUri);

  assert.equal(finalParsed.amount, '100');
  assert.equal(finalParsed.currency, 'INR'); // cu was missing, so INR added
});

test('Case C: upi://pay/?pa=test@upi&pn=Test&tn=Rent -> preserve tn=Rent when untouched', () => {
  const raw = 'upi://pay/?pa=test@upi&pn=Test&tn=Rent';
  const parsed = UPIParser.parse(raw);

  assert.equal(parsed.transactionNote, 'Rent');

  const finalUri = UPIPaymentService.buildPaymentURI(parsed, {});
  const finalParsed = UPIParser.parse(finalUri);

  assert.equal(finalParsed.transactionNote, 'Rent');
});

test('Case D: upi://pay/?pa=test@upi&pn=Test&cu=INR -> preserve cu=INR', () => {
  const raw = 'upi://pay/?pa=test@upi&pn=Test&cu=INR';
  const parsed = UPIParser.parse(raw);

  assert.equal(parsed.currency, 'INR');

  const finalUri = UPIPaymentService.buildPaymentURI(parsed, {});
  const finalParsed = UPIParser.parse(finalUri);

  assert.equal(finalParsed.currency, 'INR');
});

test('Case E: upi://pay/?pa=test@upi&pn=Test&am=100&tn=Rent&cu=INR&mc=5411 -> preserve every parameter', () => {
  const raw = 'upi://pay/?pa=test@upi&pn=Test&am=100&tn=Rent&cu=INR&mc=5411';
  const parsed = UPIParser.parse(raw);

  const finalUri = UPIPaymentService.buildPaymentURI(parsed, {});
  const finalParsed = UPIParser.parse(finalUri);

  assert.equal(finalParsed.upiId, 'test@upi');
  assert.equal(finalParsed.payeeName, 'Test');
  assert.equal(finalParsed.amount, '100');
  assert.equal(finalParsed.transactionNote, 'Rent');
  assert.equal(finalParsed.currency, 'INR');
  assert.equal(finalParsed.merchantCategory, '5411');
});

test('Case F: User edits existing amount -> update only am', () => {
  const raw = 'upi://pay/?pa=test@upi&pn=Test&am=100&tn=Rent&cu=INR';
  const parsed = UPIParser.parse(raw);

  const finalUri = UPIPaymentService.buildPaymentURI(parsed, { amount: '250' });
  const finalParsed = UPIParser.parse(finalUri);

  assert.equal(finalParsed.amount, '250');
  assert.equal(finalParsed.transactionNote, 'Rent');
  assert.equal(finalParsed.currency, 'INR');
});

test('Case G: User edits existing description -> update only tn', () => {
  const raw = 'upi://pay/?pa=test@upi&pn=Test&am=100&tn=Rent&cu=INR';
  const parsed = UPIParser.parse(raw);

  const finalUri = UPIPaymentService.buildPaymentURI(parsed, { description: 'Electricity' });
  const finalParsed = UPIParser.parse(finalUri);

  assert.equal(finalParsed.amount, '100');
  assert.equal(finalParsed.transactionNote, 'Electricity');
  assert.equal(finalParsed.currency, 'INR');
});

test('Case H: Unknown parameters -> preserve them', () => {
  const raw = 'upi://pay/?pa=merchant@upi&pn=Store&aid=uGICAgMD2y8zhCg&customField=xyz999';
  const parsed = UPIParser.parse(raw);

  assert.equal(parsed.applicationId, 'uGICAgMD2y8zhCg');
  assert.equal(parsed.parameters['customField'], 'xyz999');

  const finalUri = UPIPaymentService.buildPaymentURI(parsed, { amount: '50', description: 'Snacks' });
  const finalParsed = UPIParser.parse(finalUri);

  assert.equal(finalParsed.applicationId, 'uGICAgMD2y8zhCg');
  assert.equal(finalParsed.parameters['customField'], 'xyz999');
  assert.equal(finalParsed.amount, '50');
  assert.equal(finalParsed.transactionNote, 'Snacks');
  assert.equal(finalParsed.currency, 'INR');
});

test('openUPIPayment: calls linker.openURL successfully', async () => {
  let openedUrl = '';
  const mockLinker = {
    canOpenURL: async () => true,
    openURL: async (url: string) => {
      openedUrl = url;
    },
  };

  await UPIPaymentService.openUPIPayment('upi://pay?pa=test@upi', mockLinker);
  assert.equal(openedUrl, 'upi://pay?pa=test@upi');
});

test('openUPIPayment: throws friendly error if no UPI app installed', async () => {
  const mockLinker = {
    canOpenURL: async () => false,
    openURL: async () => {
      throw new Error('No activity found to handle intent');
    },
  };

  await assert.rejects(
    async () => UPIPaymentService.openUPIPayment('upi://pay?pa=test@upi', mockLinker),
    /No UPI app found on device/,
  );
});
