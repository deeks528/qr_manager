export interface Settings {
  id: 1;
  defaultProfileId: string | null;
  maxHeaderProfiles: 1 | 2 | 3 | 4;
  installationId: string;
  schemaVersion: number;
}

export const DEFAULT_MAX_HEADER_PROFILES = 4;
export const CURRENT_SCHEMA_VERSION = 1;
