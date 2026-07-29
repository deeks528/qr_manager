import { Profile, ProfileType, UPIProfile, WhatsAppProfile } from '@domain/models/Profile';
import { Settings } from '@domain/models/Settings';

export interface BackupV1 {
  version: 1;
  exportedAt: number;
  settings: Pick<Settings, 'defaultProfileId' | 'maxHeaderProfiles'>;
  profiles: Array<UPIProfile | WhatsAppProfile>;
}

export class ExportService {
  static createBackup(settings: Settings, profiles: Profile[], exportedAt = Date.now()): BackupV1 {
    return {
      version: 1,
      exportedAt,
      settings: {
        defaultProfileId: settings.defaultProfileId,
        maxHeaderProfiles: settings.maxHeaderProfiles,
      },
      profiles: profiles.filter(
        (profile): profile is UPIProfile | WhatsAppProfile =>
          profile.type === ProfileType.UPI || profile.type === ProfileType.WhatsApp,
      ),
    };
  }
}
