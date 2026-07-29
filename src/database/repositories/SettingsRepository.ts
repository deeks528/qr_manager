import { Settings } from '@domain/models/Settings';

export interface SettingsRepository {
  getSettings(): Promise<Settings>;
  updateSettings(settings: Settings): Promise<Settings>;
  exportSettings(): Promise<Pick<Settings, 'defaultProfileId' | 'maxHeaderProfiles'>>;
  importSettings(settings: Pick<Settings, 'defaultProfileId' | 'maxHeaderProfiles'>): Promise<Settings>;
}
