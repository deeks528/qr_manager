export interface StartupCache {
  getString(key: string): string | null;
  getNumber(key: string): number | null;
  setString(key: string, value: string): void;
  setNumber(key: string, value: number): void;
  delete(key: string): void;
}

export const STARTUP_CACHE_KEYS = {
  defaultProfileId: 'defaultProfileId',
  maxHeaderProfiles: 'maxHeaderProfiles',
} as const;
