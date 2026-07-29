import assert from 'node:assert/strict';
import test from 'node:test';

import { AppStartupManager } from '@app/bootstrap/AppStartupManager';
import { STARTUP_CACHE_KEYS, StartupCache } from '@database/mmkv/StartupCache';
import { ProfileType } from '@domain/models/Profile';
import { AppDependencies } from '@app/bootstrap/createAppDependencies';
import { ProfileRepository } from '@database/repositories/ProfileRepository';
import { SettingsRepository } from '@database/repositories/SettingsRepository';

class MockStartupCache implements StartupCache {
  private stringData = new Map<string, string>();
  private numberData = new Map<string, number>();

  getString(key: string): string | null {
    return this.stringData.get(key) ?? null;
  }

  getNumber(key: string): number | null {
    return this.numberData.get(key) ?? null;
  }

  setString(key: string, value: string): void {
    this.stringData.set(key, value);
  }

  setNumber(key: string, value: number): void {
    this.numberData.set(key, value);
  }

  delete(key: string): void {
    this.stringData.delete(key);
    this.numberData.delete(key);
  }
}

class MockProfileRepository implements Partial<ProfileRepository> {
  private profile: any = null;

  setMockProfile(profile: any) {
    this.profile = profile;
  }

  async getProfile(id: string): Promise<any> {
    if (this.profile && this.profile.id === id) {
      return this.profile;
    }
    return null;
  }
}

test('AppStartupManager - successful cold boot without cache', async () => {
  const cache = new MockStartupCache();
  const repo = new MockProfileRepository();
  const createDependencies = async () => ({ profileRepository: repo as any, settingsRepository: {} as any } as AppDependencies);

  const result = await AppStartupManager.performStartup(cache, createDependencies);

  assert.equal(result.cachedDefaultProfileId, null);
  assert.equal(result.initialDefaultProfile, null);
  assert.equal(result.initialDefaultPayload, null);
  assert.equal(result.error, null);
  assert.ok(result.dependencies);
});

test('AppStartupManager - eager fetch profile and payload when cache hit', async () => {
  const cache = new MockStartupCache();
  cache.setString(STARTUP_CACHE_KEYS.defaultProfileId, 'profile-123');

  const repo = new MockProfileRepository();
  repo.setMockProfile({
    id: 'profile-123',
    type: ProfileType.UPI,
    nickname: 'My UPI',
    upiId: 'test@upi',
    minimumAmount: 10,
    defaultDescription: 'Test',
  });

  const createDependencies = async () => ({ profileRepository: repo as any, settingsRepository: {} as any } as AppDependencies);

  const result = await AppStartupManager.performStartup(cache, createDependencies);

  assert.equal(result.cachedDefaultProfileId, 'profile-123');
  assert.ok(result.initialDefaultProfile);
  assert.equal(result.initialDefaultProfile?.nickname, 'My UPI');
  assert.ok(result.initialDefaultPayload);
  assert.ok(result.initialDefaultPayload?.includes('pa=test%40upi'));
  assert.ok(result.initialDefaultPayload?.includes('am=10.00'));
  assert.equal(result.error, null);
});

test('AppStartupManager - gracefully handles missing profile in DB despite cache hit', async () => {
  const cache = new MockStartupCache();
  cache.setString(STARTUP_CACHE_KEYS.defaultProfileId, 'profile-123');

  const repo = new MockProfileRepository(); // Returns null for any ID

  const createDependencies = async () => ({ profileRepository: repo as any, settingsRepository: {} as any } as AppDependencies);

  const result = await AppStartupManager.performStartup(cache, createDependencies);

  assert.equal(result.cachedDefaultProfileId, 'profile-123');
  assert.equal(result.initialDefaultProfile, null);
  assert.equal(result.initialDefaultPayload, null);
  assert.equal(result.error, null);
});
