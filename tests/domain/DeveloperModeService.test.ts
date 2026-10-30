import test from 'node:test';
import assert from 'node:assert/strict';
import { DeveloperModeService } from '@domain/services/DeveloperModeService';

test('DeveloperMode: taps 1, 2, and 3 do not display remaining steps toast', () => {
  let count = 0;
  let lastTime = 0;
  const baseTime = 100000;

  // Tap 1
  const t1 = DeveloperModeService.handleTap(count, lastTime, false, baseTime);
  assert.equal(t1.nextCount, 1);
  assert.equal(t1.result.activated, false);
  assert.equal(t1.result.message, undefined);
  count = t1.nextCount;
  lastTime = t1.lastTapTime;

  // Tap 2
  const t2 = DeveloperModeService.handleTap(count, lastTime, false, baseTime + 300);
  assert.equal(t2.nextCount, 2);
  assert.equal(t2.result.activated, false);
  assert.equal(t2.result.message, undefined);
  count = t2.nextCount;
  lastTime = t2.lastTapTime;

  // Tap 3
  const t3 = DeveloperModeService.handleTap(count, lastTime, false, baseTime + 600);
  assert.equal(t3.nextCount, 3);
  assert.equal(t3.result.activated, false);
  assert.equal(t3.result.message, undefined);
});

test('DeveloperMode: taps 4, 5, and 6 display leftover attempts toast', () => {
  let count = 3;
  let lastTime = 100000;

  // Tap 4 (after 3 taps) -> 3 steps away
  const t4 = DeveloperModeService.handleTap(count, lastTime, false, lastTime + 300);
  assert.equal(t4.nextCount, 4);
  assert.equal(t4.result.activated, false);
  assert.equal(t4.result.remainingSteps, 3);
  assert.equal(t4.result.message, 'You are now 3 steps away from being a developer.');
  count = t4.nextCount;
  lastTime = t4.lastTapTime;

  // Tap 5 -> 2 steps away
  const t5 = DeveloperModeService.handleTap(count, lastTime, false, lastTime + 300);
  assert.equal(t5.nextCount, 5);
  assert.equal(t5.result.activated, false);
  assert.equal(t5.result.remainingSteps, 2);
  assert.equal(t5.result.message, 'You are now 2 steps away from being a developer.');
  count = t5.nextCount;
  lastTime = t5.lastTapTime;

  // Tap 6 -> 1 step away
  const t6 = DeveloperModeService.handleTap(count, lastTime, false, lastTime + 300);
  assert.equal(t6.nextCount, 6);
  assert.equal(t6.result.activated, false);
  assert.equal(t6.result.remainingSteps, 1);
  assert.equal(t6.result.message, 'You are now 1 step away from being a developer.');
});

test('DeveloperMode: 7th tap activates Developer Mode', () => {
  const count = 6;
  const lastTime = 100000;

  const t7 = DeveloperModeService.handleTap(count, lastTime, false, lastTime + 300);
  assert.equal(t7.nextCount, 0); // resets count upon activation
  assert.equal(t7.result.activated, true);
  assert.equal(t7.result.isAlreadyActive, false);
  assert.equal(t7.result.message, 'You are now in Developer Mode!');
});

test('DeveloperMode: tapping when already active warns that it is already active', () => {
  const t = DeveloperModeService.handleTap(0, 0, true, Date.now());
  assert.equal(t.result.activated, false);
  assert.equal(t.result.isAlreadyActive, true);
  assert.equal(t.result.message, 'Developer Mode is already active');
});

test('DeveloperMode: slow taps reset counter back to 1', () => {
  const t1 = DeveloperModeService.handleTap(0, 0, false, 100000);
  assert.equal(t1.nextCount, 1);

  // Next tap after timeout (> 2500ms)
  const t2 = DeveloperModeService.handleTap(t1.nextCount, t1.lastTapTime, false, 100000 + 4000);
  assert.equal(t2.nextCount, 1); // resets back to 1
  assert.equal(t2.result.activated, false);
});
