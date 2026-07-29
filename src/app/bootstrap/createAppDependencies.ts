import { ProfileRepository } from '@database/repositories/ProfileRepository';
import { SettingsRepository } from '@database/repositories/SettingsRepository';
import { SQLiteProfileRepository } from '@database/repositories/SQLiteProfileRepository';
import { SQLiteSettingsRepository } from '@database/repositories/SQLiteSettingsRepository';
import { schemaSql } from '@database/schema/schema';
import { initializeSchema } from '@database/sqlite/initializeSchema';
import { MMKVStartupCache } from '@database/native/MMKVStartupCache';
import { ReactNativeSQLiteClient } from '@database/native/ReactNativeSQLiteClient';

export interface AppDependencies {
  settingsRepository: SettingsRepository;
  profileRepository: ProfileRepository;
}

export async function createAppDependencies(): Promise<AppDependencies> {
    console.log('Opening SQLite...');
  const db = await ReactNativeSQLiteClient.open();
  await initializeSchema(db, schemaSql);

  const startupCache = new MMKVStartupCache();
  const settingsRepository = new SQLiteSettingsRepository(db, startupCache);
  await settingsRepository.getSettings();
console.log('createAppDependencies completed');
  return {
    settingsRepository,
    profileRepository: new SQLiteProfileRepository(db, settingsRepository),
  };
}
