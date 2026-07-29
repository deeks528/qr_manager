import { Settings } from '@domain/models/Settings';
import { SqlRow } from '@database/sqlite/SqlClient';

export interface SettingsRow extends SqlRow {
  id: 1;
  defaultProfileId: string | null;
  maxHeaderProfiles: 1 | 2 | 3 | 4;
  installationId: string;
  schemaVersion: number;
}

export class SettingsMapper {
  static fromRow(row: SettingsRow): Settings {
    return {
      id: 1,
      defaultProfileId: row.defaultProfileId,
      maxHeaderProfiles: row.maxHeaderProfiles,
      installationId: row.installationId,
      schemaVersion: row.schemaVersion,
    };
  }
}
