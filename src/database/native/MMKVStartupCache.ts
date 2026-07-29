import { MMKV } from 'react-native-mmkv';

import { StartupCache } from '@database/mmkv/StartupCache';

export class MMKVStartupCache implements StartupCache {
  constructor(private readonly storage = new MMKV({ id: 'startup-cache' })) {}

  getString(key: string): string | null {
    return this.storage.getString(key) ?? null;
  }

  getNumber(key: string): number | null {
    return this.storage.getNumber(key) ?? null;
  }

  setString(key: string, value: string): void {
    this.storage.set(key, value);
  }

  setNumber(key: string, value: number): void {
    this.storage.set(key, value);
  }

  delete(key: string): void {
    this.storage.delete(key);
  }
}
