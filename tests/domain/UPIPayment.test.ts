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
  assert.equal(finalParsed.amount, '500.00');
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

  assert.equal(finalParsed.amount, '250.00');
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
  assert.equal(finalParsed.amount, '50.00');
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

test('NPCI: Rejects schemes other than upi://pay', () => {
  assert.equal(UPIParser.isUPI('upi://mandate?pa=test@upi'), false);
  assert.equal(UPIParser.isUPI('upi://collect?pa=test@upi'), false);
  assert.equal(UPIParser.isUPI('upiGlobal://pay?pa=test@upi'), false);
  assert.throws(
    () => UPIParser.parse('upi://mandate?pa=test@upi'),
    /This QR code is not a supported UPI payment QR/,
  );
});

test('NPCI: Sanitizes literal null strings', () => {
  const raw = 'upi://pay?pa=test@upi&pn=Test&mam=null&url=NULL&am=50.00';
  const parsed = UPIParser.parse(raw);

  assert.equal(parsed.minimumAmount, undefined);
  assert.equal(parsed.url, undefined);
  assert.equal(parsed.amount, '50.00');

  const finalUri = UPIPaymentService.buildPaymentURI(parsed, {});
  assert.equal(finalUri.includes('mam='), false);
  assert.equal(finalUri.includes('null'), false);
});

test('NPCI: Signed payload preserves sign as the last parameter', () => {
  const raw = 'upi://pay?ver=01&mode=02&orgid=159992&pa=merchant@upi&pn=Merchant&mc=5411&sign=MEYCIQDaaEAL06Vsn9aNIarP7dai8';
  const parsed = UPIParser.parse(raw);

  assert.equal(parsed.signature, 'MEYCIQDaaEAL06Vsn9aNIarP7dai8');

  const finalUri = UPIPaymentService.buildPaymentURI(parsed, {});
  // Ensure sign is the last parameter
  assert.equal(finalUri.endsWith('&sign=MEYCIQDaaEAL06Vsn9aNIarP7dai8'), true);
  // Ensure trailing slash is omitted
  assert.equal(finalUri.startsWith('upi://pay?'), true);
  assert.equal(finalUri.startsWith('upi://pay/?'), false);
});

test('NPCI: Gallery scan sets qrMedium=01 when not signed', () => {
  const raw = 'upi://pay?pa=test@upi&pn=Test';
  const parsed = UPIParser.parse(raw);

  const finalUri = UPIPaymentService.buildPaymentURI(parsed, { isFromGallery: true });
  assert.equal(finalUri.includes('qrMedium=01'), true);
});

test('NPCI: Preserves literal @ in pa without percent-encoding to %40', () => {
  const raw = 'upi://pay?pa=Q687585626@ybl&pn=PhonePeMerchant&mc=0000&mode=02&purpose=00';
  const parsed = UPIParser.parse(raw);

  const finalUri = UPIPaymentService.buildPaymentURI(parsed, { amount: '20' });
  assert.equal(finalUri.includes('pa=Q687585626@ybl'), true);
  assert.equal(finalUri.includes('%40'), false);
});

test('NPCI: Strips mode=02 on unsigned intent to prevent counter QR spoof block', () => {
  const raw = 'upi://pay?pa=Q687585626@ybl&pn=PhonePeMerchant&mc=0000&mode=02&purpose=00';
  const parsed = UPIParser.parse(raw);

  const finalUri = UPIPaymentService.buildPaymentURI(parsed, { amount: '20' });
  assert.equal(finalUri.includes('mode='), false);
  assert.equal(finalUri.includes('am=20.00'), true);
});

test('NPCI: Preserves mode=02 when payload is digitally signed', () => {
  const raw = 'upi://pay?pa=merchant@upi&pn=Merchant&mode=02&sign=SIGNATURE123';
  const parsed = UPIParser.parse(raw);

  const finalUri = UPIPaymentService.buildPaymentURI(parsed, {});
  assert.equal(finalUri.includes('mode=02'), true);
  assert.equal(finalUri.endsWith('&sign=SIGNATURE123'), true);
});

