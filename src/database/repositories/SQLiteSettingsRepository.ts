import { SettingsRepository } from '@database/repositories/SettingsRepository';
import { SettingsMapper, SettingsRow } from '@database/mappers/SettingsMapper';
import { STARTUP_CACHE_KEYS, StartupCache } from '@database/mmkv/StartupCache';
import { SqlClient } from '@database/sqlite/SqlClient';
import {
  CURRENT_SCHEMA_VERSION,
  DEFAULT_MAX_HEADER_PROFILES,
  Settings,
} from '@domain/models/Settings';
import { ValidationError } from '@domain/errors/DomainErrors';
import { WidgetBridgeService } from '@shared/native/WidgetBridge';

export class SQLiteSettingsRepository implements SettingsRepository {
  constructor(
    private readonly db: SqlClient,
    private readonly startupCache: StartupCache,
    private readonly createInstallationId: () => string = createDefaultInstallationId,
  ) {}

  async getSettings(): Promise<Settings> {
    const existing = await this.db.execute<SettingsRow>(
      'SELECT id, defaultProfileId, maxHeaderProfiles, installationId, schemaVersion FROM settings WHERE id = 1',
    );

    if (existing.rows[0]) {
      const settings = SettingsMapper.fromRow(existing.rows[0]);
      this.writeStartupCache(settings);
      return settings;
    }

    return this.db.transaction(async (client) => {
      const settings: Settings = {
        id: 1,
        defaultProfileId: null,
        maxHeaderProfiles: DEFAULT_MAX_HEADER_PROFILES,
        installationId: this.createInstallationId(),
        schemaVersion: CURRENT_SCHEMA_VERSION,
      };

      await client.execute(
        'INSERT INTO settings (id, defaultProfileId, maxHeaderProfiles, installationId, schemaVersion) VALUES (?, ?, ?, ?, ?)',
        [
          settings.id,
          settings.defaultProfileId,
          settings.maxHeaderProfiles,
          settings.installationId,
          settings.schemaVersion,
        ],
      );

      this.writeStartupCache(settings);
      return settings;
    });
  }

  async updateSettings(settings: Settings): Promise<Settings> {
    this.validateMaxHeaderProfiles(settings.maxHeaderProfiles);

    await this.db.transaction(async (client) => {
      await client.execute(
        'UPDATE settings SET defaultProfileId = ?, maxHeaderProfiles = ?, installationId = ?, schemaVersion = ? WHERE id = 1',
        [
          settings.defaultProfileId,
          settings.maxHeaderProfiles,
          settings.installationId,
          settings.schemaVersion,
        ],
      );
    });

    this.writeStartupCache(settings);
    return settings;
  }

  async exportSettings(): Promise<Pick<Settings, 'defaultProfileId' | 'maxHeaderProfiles'>> {
    const settings = await this.getSettings();
    return {
      defaultProfileId: settings.defaultProfileId,
      maxHeaderProfiles: settings.maxHeaderProfiles,
    };
  }

  async importSettings(settings: Pick<Settings, 'defaultProfileId' | 'maxHeaderProfiles'>): Promise<Settings> {
    this.validateMaxHeaderProfiles(settings.maxHeaderProfiles);
    const current = await this.getSettings();

    return this.updateSettings({
      ...current,
      defaultProfileId: settings.defaultProfileId,
      maxHeaderProfiles: settings.maxHeaderProfiles,
    });
  }

  private validateMaxHeaderProfiles(maxHeaderProfiles: number): asserts maxHeaderProfiles is 1 | 2 | 3 | 4 {
    if (![1, 2, 3, 4].includes(maxHeaderProfiles)) {
      throw new ValidationError('Maximum header profiles must be between 1 and 4.');
    }
  }

  private writeStartupCache(settings: Settings): void {
    if (settings.defaultProfileId) {
      this.startupCache.setString(STARTUP_CACHE_KEYS.defaultProfileId, settings.defaultProfileId);
    } else {
      this.startupCache.delete(STARTUP_CACHE_KEYS.defaultProfileId);
      WidgetBridgeService.updateDefaultProfileWidget(null);
    }

    this.startupCache.setNumber(STARTUP_CACHE_KEYS.maxHeaderProfiles, settings.maxHeaderProfiles);
  }
}

function createDefaultInstallationId(): string {
  return `install-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}
