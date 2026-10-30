import assert from 'node:assert/strict';
import test from 'node:test';

import { AppLogger } from '../../src/domain/services/AppLogger';

test('AppLogger: logs info, warn, debug and error events', async () => {
  await AppLogger.clearAllLogs();

  AppLogger.debug('TestTag', 'Test debug message', { step: 1 });
  AppLogger.info('TestTag', 'Test info message', { foo: 'bar' });
  AppLogger.warn('TestTag', 'Test warn message');
  AppLogger.error('TestTag', 'Test error message', new Error('Sample Error'));

  const logs = await AppLogger.getAppLogs();
  assert.equal(logs.length, 4);

  // Newest first
  assert.equal(logs[0].level, 'ERROR');
  assert.equal(logs[0].message.includes('Sample Error'), true);
  assert.ok(logs[0].errorStack);
  assert.equal(logs[1].level, 'WARN');
  assert.equal(logs[2].level, 'INFO');
  assert.deepEqual(logs[2].details, { foo: 'bar' });
  assert.equal(logs[3].level, 'DEBUG');
  assert.deepEqual(logs[3].details, { step: 1 });

  // Metadata checks
  assert.ok(logs[0].timestamp);
  assert.ok(!isNaN(Date.parse(logs[0].timestamp)));
  assert.equal(logs[0].tag, 'TestTag');
});

test('AppLogger: writes to persistent local log file in application storage', async () => {
  await AppLogger.clearAllLogs();
  await AppLogger.init();

  const logFilePath = AppLogger.getLogFilePath();
  assert.ok(logFilePath);
  assert.ok(logFilePath.endsWith('app.log'));

  AppLogger.info('AuthService', 'User signed in', { userId: 'u123' });
  AppLogger.error('PaymentService', 'Transaction failed', new Error('Timeout error'));

  // Allow async file write to flush
  await new Promise((r) => setTimeout(r, 50));

  const content = await AppLogger.readLogFile();
  assert.ok(content.length > 0);
  assert.ok(content.includes('[INFO] [AuthService] User signed in'));
  assert.ok(content.includes('userId'));
  assert.ok(content.includes('[ERROR] [PaymentService] Transaction failed'));
  assert.ok(content.includes('Timeout error'));
});

test('AppLogger: logs persist across application restarts', async () => {
  await AppLogger.clearAllLogs();
  await AppLogger.init();

  AppLogger.info('Lifecycle', 'App launched first session');
  AppLogger.warn('Network', 'Slow connection detected');

  // Allow async file write to flush
  await new Promise((r) => setTimeout(r, 50));

  // Verify in-memory count
  let logsBeforeRestart = await AppLogger.getAppLogs();
  assert.equal(logsBeforeRestart.length, 2);

  // Simulate app restart / process kill
  AppLogger.resetForTesting();
  let inMemoryAfterKill = await AppLogger.getAppLogs();
  assert.equal(inMemoryAfterKill.length, 0);

  // Re-initialize app (simulating cold boot)
  await AppLogger.init();

  let logsAfterRestart = await AppLogger.getAppLogs();
  assert.equal(logsAfterRestart.length, 2);
  assert.equal(logsAfterRestart[0].message, 'Slow connection detected');
  assert.equal(logsAfterRestart[1].message, 'App launched first session');
});

test('AppLogger: records scan intent and updates transformed intent', async () => {
  await AppLogger.clearAllLogs();

  const scanId = await AppLogger.logScan({
    source: 'camera',
    scannedIntent: 'upi://pay?pa=merchant@upi&pn=Store&am=100.00',
    parsedUPIId: 'merchant@upi',
    parsedPayeeName: 'Store',
    parsedAmount: '100.00',
    status: 'PARSED',
  });

  assert.ok(scanId);

  let scans = await AppLogger.getScanLogs();
  assert.equal(scans.length, 1);
  assert.equal(scans[0].scannedIntent, 'upi://pay?pa=merchant@upi&pn=Store&am=100.00');
  assert.equal(scans[0].status, 'PARSED');

  // Update with transformed intent
  const transformed = 'upi://pay?pa=merchant@upi&pn=Store&am=150.00&tn=Tips&cu=INR';
  await AppLogger.updateScan(scanId, {
    transformedIntent: transformed,
    overrides: { amount: '150.00', description: 'Tips' },
    status: 'TRANSFORMED',
  });

  scans = await AppLogger.getScanLogs();
  assert.equal(scans[0].transformedIntent, transformed);
  assert.equal(scans[0].status, 'TRANSFORMED');
  assert.equal(scans[0].overrides?.amount, '150.00');

  // Update to payment launched
  await AppLogger.updateScan(scanId, {
    status: 'PAYMENT_LAUNCHED',
  });

  scans = await AppLogger.getScanLogs();
  assert.equal(scans[0].status, 'PAYMENT_LAUNCHED');
});

test('AppLogger: exportLogs returns JSON report containing scans and app logs', async () => {
  const jsonReport = await AppLogger.exportLogs();
  assert.ok(jsonReport);
  const parsed = JSON.parse(jsonReport);

  assert.equal(typeof parsed.exportedAt, 'string');
  assert.equal(Array.isArray(parsed.scanHistory), true);
  assert.equal(Array.isArray(parsed.recentLogs), true);
});
