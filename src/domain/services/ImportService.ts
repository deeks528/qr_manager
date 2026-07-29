import { ProfileRepository } from '@database/repositories/ProfileRepository';
import { InvalidBackupError } from '@domain/errors/DomainErrors';
import { BackupV1 } from '@domain/services/ExportService';

export class ImportService {
  static parseBackup(rawBackup: string): BackupV1 {
    const parsed: unknown = JSON.parse(rawBackup);

    if (!this.isBackupV1(parsed)) {
      throw new InvalidBackupError();
    }

    return parsed;
  }

  static async restore(backup: BackupV1, profileRepository: ProfileRepository): Promise<void> {
    await profileRepository.restoreBackup(backup);
  }

  private static isBackupV1(value: unknown): value is BackupV1 {
    if (!value || typeof value !== 'object') {
      return false;
    }

    const candidate = value as Partial<BackupV1>;
    return candidate.version === 1 && Array.isArray(candidate.profiles) && Boolean(candidate.settings);
  }
}
