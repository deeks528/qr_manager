import assert from 'node:assert/strict';
import test from 'node:test';

import { STARTUP_CACHE_KEYS, StartupCache } from '@database/mmkv/StartupCache';
import { SQLiteSettingsRepository } from '@database/repositories/SQLiteSettingsRepository';
import { SqlClient, SqlResult, SqlRow, SqlValue } from '@database/sqlite/SqlClient';
import { ValidationError } from '@domain/errors/DomainErrors';
import { Settings } from '@domain/models/Settings';

class MemoryStartupCache implements StartupCache {
  readonly values = new Map<string, string | number>();

  getString(key: string): string | null {
    const value = this.values.get(key);
    return typeof value === 'string' ? value : null;
  }

  getNumber(key: string): number | null {
    const value = this.values.get(key);
    return typeof value === 'number' ? value : null;
  }

  setString(key: string, value: string): void {
    this.values.set(key, value);
  }

  setNumber(key: string, value: number): void {
    this.values.set(key, value);
  }

  delete(key: string): void {
    this.values.delete(key);
  }
}

class SettingsSqlClient implements SqlClient {
  row: Settings | null = null;
  transactionCount = 0;

  async execute<T extends SqlRow = SqlRow>(sql: string, params: SqlValue[] = []): Promise<SqlResult<T>> {
    if (sql.startsWith('SELECT')) {
      return {
        rows: this.row ? ([this.row] as unknown as T[]) : [],
        rowsAffected: 0,
      };
    }

    if (sql.startsWith('INSERT')) {
      this.row = {
        id: 1,
        defaultProfileId: params[1] as string | null,
        maxHeaderProfiles: params[2] as 1 | 2 | 3 | 4,
        installationId: params[3] as string,
        schemaVersion: params[4] as number,
      };
      return { rows: [], rowsAffected: 1 };
    }

    if (sql.startsWith('UPDATE')) {
      assert.ok(this.row);
      this.row = {
        id: 1,
        defaultProfileId: params[0] as string | null,
        maxHeaderProfiles: params[1] as 1 | 2 | 3 | 4,
        installationId: params[2] as string,
        schemaVersion: params[3] as number,
      };
      return { rows: [], rowsAffected: 1 };
    }

    throw new Error(`Unexpected SQL: ${sql}`);
  }

  async transaction<T>(work: (client: SqlClient) => Promise<T>): Promise<T> {
    this.transactionCount += 1;
    return work(this);
  }
}

test('settings repository creates defaults on first launch and writes startup cache', async () => {
  const db = new SettingsSqlClient();
  const cache = new MemoryStartupCache();
  const repository = new SQLiteSettingsRepository(db, cache, () => 'install-test');

  const settings = await repository.getSettings();

  assert.equal(settings.defaultProfileId, null);
  assert.equal(settings.maxHeaderProfiles, 4);
  assert.equal(settings.installationId, 'install-test');
  assert.equal(settings.schemaVersion, 1);
  assert.equal(cache.getNumber(STARTUP_CACHE_KEYS.maxHeaderProfiles), 4);
  assert.equal(cache.getString(STARTUP_CACHE_KEYS.defaultProfileId), null);
  assert.equal(db.transactionCount, 1);
});

test('settings repository updates settings and synchronizes cache', async () => {
  const db = new SettingsSqlClient();
  const cache = new MemoryStartupCache();
  const repository = new SQLiteSettingsRepository(db, cache, () => 'install-test');

  const settings = await repository.getSettings();
  const updated = await repository.updateSettings({
    ...settings,
    defaultProfileId: 'profile-1',
    maxHeaderProfiles: 2,
  });

  assert.equal(updated.defaultProfileId, 'profile-1');
  assert.equal(cache.getString(STARTUP_CACHE_KEYS.defaultProfileId), 'profile-1');
  assert.equal(cache.getNumber(STARTUP_CACHE_KEYS.maxHeaderProfiles), 2);
  assert.equal(db.row?.maxHeaderProfiles, 2);
});

test('settings import preserves installation id and schema version', async () => {
  const db = new SettingsSqlClient();
  const cache = new MemoryStartupCache();
  const repository = new SQLiteSettingsRepository(db, cache, () => 'install-test');

  const imported = await repository.importSettings({
    defaultProfileId: 'profile-2',
    maxHeaderProfiles: 3,
  });

  assert.equal(imported.installationId, 'install-test');
  assert.equal(imported.schemaVersion, 1);
  assert.equal(imported.defaultProfileId, 'profile-2');
  assert.equal(imported.maxHeaderProfiles, 3);
});

test('settings repository rejects header profile counts outside MVP limits', async () => {
  const db = new SettingsSqlClient();
  const cache = new MemoryStartupCache();
  const repository = new SQLiteSettingsRepository(db, cache, () => 'install-test');
  const settings = await repository.getSettings();

  await assert.rejects(
    () => repository.updateSettings({ ...settings, maxHeaderProfiles: 5 as 1 | 2 | 3 | 4 }),
    ValidationError,
  );
});
