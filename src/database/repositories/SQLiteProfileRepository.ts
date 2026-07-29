import { ProfileMapper, ProfileRow } from '@database/mappers/ProfileMapper';
import { ProfileRepository, CreateProfileInput } from '@database/repositories/ProfileRepository';
import { SettingsRepository } from '@database/repositories/SettingsRepository';
import { SqlClient, SqlRow } from '@database/sqlite/SqlClient';
import { DuplicatePhoneError, DuplicateUPIError, ValidationError } from '@domain/errors/DomainErrors';
import { BackupV1 } from '@domain/services/ExportService';
import {
  MAX_PROFILES,
  MAX_QUICK_PROFILES,
  OtherProfile,
  Profile,
  ProfileType,
  UPIProfile,
  WhatsAppProfile,
} from '@domain/models/Profile';
import { AvatarService } from '@domain/services/AvatarService';
import { ValidationService } from '@domain/services/ValidationService';

const PROFILE_SELECT = `
SELECT
  p.id,
  p.type,
  p.nickname,
  p.logoPath,
  p.avatarColor,
  p.displayOrder,
  p.quickAccessSlot,
  p.createdAt,
  p.updatedAt,
  u.upiId,
  u.minimumAmount,
  u.defaultDescription,
  w.mobileNumber,
  o.qrImagePath
FROM profiles p
LEFT JOIN upi_profiles u ON u.profileId = p.id
LEFT JOIN whatsapp_profiles w ON w.profileId = p.id
LEFT JOIN other_profiles o ON o.profileId = p.id
`;

interface CountRow extends SqlRow {
  count: number;
}

interface NextOrderRow extends SqlRow {
  nextOrder: number;
}

export class SQLiteProfileRepository implements ProfileRepository {
  constructor(
    private readonly db: SqlClient,
    private readonly settingsRepository: SettingsRepository,
    private readonly createId: () => string = createDefaultProfileId,
    private readonly now: () => number = Date.now,
  ) {}

  async createProfile(input: CreateProfileInput): Promise<Profile> {
    const profileCount = await this.getProfileCount();
    if (profileCount >= MAX_PROFILES) {
      throw new ValidationError(`Maximum of ${MAX_PROFILES} profiles reached.`);
    }

    const validatedInput = normalizeProfileFields(input.profile);
    await this.ensureUniqueIdentifier(validatedInput);

    const settings = await this.settingsRepository.getSettings();
    const nickname = ValidationService.validateNickname(input.profile.nickname);
    const createdAt = this.now();
    const profile = {
      ...validatedInput,
      id: this.createId(),
      nickname,
      avatarColor: AvatarService.createAvatarColor(nickname, settings.installationId),
      displayOrder: await this.getNextDisplayOrder(),
      createdAt,
      updatedAt: createdAt,
    } as Profile;

    await this.db.transaction(async (client) => {
      if (profile.quickAccessSlot !== null) {
        await client.execute('UPDATE profiles SET quickAccessSlot = NULL WHERE quickAccessSlot = ?', [
          profile.quickAccessSlot,
        ]);
      }

      await client.execute(
        'INSERT INTO profiles (id, type, nickname, logoPath, avatarColor, displayOrder, quickAccessSlot, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [
          profile.id,
          profile.type,
          profile.nickname,
          profile.logoPath,
          profile.avatarColor,
          profile.displayOrder,
          profile.quickAccessSlot,
          profile.createdAt,
          profile.updatedAt,
        ],
      );

      await this.insertSubtype(client, profile);
    });

    return profile;
  }

  async updateProfile(profile: Profile): Promise<Profile> {
    const existing = await this.getRequiredProfile(profile.id);
    if (existing.type !== profile.type) {
      throw new ValidationError('Profile type cannot be changed.');
    }

    const validatedProfile = normalizeProfileFields(profile);
    await this.ensureUniqueIdentifier(validatedProfile, profile.id);

    const settings = await this.settingsRepository.getSettings();
    const nickname = ValidationService.validateNickname(profile.nickname);
    const avatarColor =
      nickname === existing.nickname
        ? existing.avatarColor
        : AvatarService.createAvatarColor(nickname, settings.installationId);
    const updated: Profile = {
      ...validatedProfile,
      nickname,
      avatarColor,
      displayOrder: existing.displayOrder,
      createdAt: existing.createdAt,
      updatedAt: this.now(),
    };

    await this.db.transaction(async (client) => {
      if (updated.quickAccessSlot !== null) {
        await client.execute('UPDATE profiles SET quickAccessSlot = NULL WHERE quickAccessSlot = ? AND id != ?', [
          updated.quickAccessSlot,
          updated.id,
        ]);
      }

      await client.execute(
        'UPDATE profiles SET nickname = ?, logoPath = ?, avatarColor = ?, quickAccessSlot = ?, updatedAt = ? WHERE id = ?',
        [updated.nickname, updated.logoPath, updated.avatarColor, updated.quickAccessSlot, updated.updatedAt, updated.id],
      );

      await this.updateSubtype(client, updated);
    });

    return updated;
  }

  async deleteProfile(profileId: string): Promise<void> {
    const existing = await this.getRequiredProfile(profileId);
    const settings = await this.settingsRepository.getSettings();

    await this.db.transaction(async (client) => {
      await client.execute('DELETE FROM upi_profiles WHERE profileId = ?', [profileId]);
      await client.execute('DELETE FROM whatsapp_profiles WHERE profileId = ?', [profileId]);
      await client.execute('DELETE FROM other_profiles WHERE profileId = ?', [profileId]);
      await client.execute('DELETE FROM profiles WHERE id = ?', [profileId]);
      await this.compactDisplayOrder(client);

      if (settings.defaultProfileId === profileId) {
        const nextDefault = await this.getPromotedDefaultId(client, existing.displayOrder);
        await client.execute('UPDATE settings SET defaultProfileId = ? WHERE id = 1', [nextDefault]);
      }
    });

    if (settings.defaultProfileId === profileId) {
      await this.settingsRepository.getSettings();
    }

    void existing;
  }

  async getProfile(profileId: string): Promise<Profile | null> {
    const result = await this.db.execute<ProfileRow>(`${PROFILE_SELECT} WHERE p.id = ?`, [profileId]);
    return result.rows[0] ? ProfileMapper.fromRow(result.rows[0]) : null;
  }

  async getAllProfiles(): Promise<Profile[]> {
    const result = await this.db.execute<ProfileRow>(`${PROFILE_SELECT} ORDER BY p.displayOrder ASC`);
    return result.rows.map((row) => ProfileMapper.fromRow(row));
  }

  async getQuickProfiles(): Promise<Profile[]> {
    const result = await this.db.execute<ProfileRow>(
      `${PROFILE_SELECT} WHERE p.quickAccessSlot IS NOT NULL ORDER BY p.quickAccessSlot ASC`,
    );
    return result.rows.map((row) => ProfileMapper.fromRow(row));
  }

  async setDefaultProfile(profileId: string | null): Promise<void> {
    if (profileId !== null) {
      await this.getRequiredProfile(profileId);
    }

    const settings = await this.settingsRepository.getSettings();
    await this.settingsRepository.updateSettings({
      ...settings,
      defaultProfileId: profileId,
    });
  }

  async assignQuickAccessSlot(profileId: string, slot: 0 | 1 | 2 | 3): Promise<void> {
    await this.getRequiredProfile(profileId);

    if (slot < 0 || slot >= MAX_QUICK_PROFILES) {
      throw new ValidationError('Quick access slot must be between 0 and 3.');
    }

    await this.db.transaction(async (client) => {
      await client.execute('UPDATE profiles SET quickAccessSlot = NULL WHERE quickAccessSlot = ?', [slot]);
      await client.execute('UPDATE profiles SET quickAccessSlot = ? WHERE id = ?', [slot, profileId]);
    });
  }

  async removeQuickAccessSlot(profileId: string): Promise<void> {
    await this.getRequiredProfile(profileId);
    await this.db.execute('UPDATE profiles SET quickAccessSlot = NULL WHERE id = ?', [profileId]);
  }

  async updateDisplayOrder(profileIds: string[]): Promise<void> {
    const profiles = await this.getAllProfiles();
    if (profileIds.length !== profiles.length) {
      throw new ValidationError('Display order must include every profile.');
    }

    const knownIds = new Set(profiles.map((profile) => profile.id));
    if (profileIds.some((profileId) => !knownIds.has(profileId))) {
      throw new ValidationError('Display order contains an unknown profile.');
    }

    await this.db.transaction(async (client) => {
      for (let index = 0; index < profileIds.length; index += 1) {
        await client.execute('UPDATE profiles SET displayOrder = ? WHERE id = ?', [-(index + 1), profileIds[index]]);
      }

      for (let index = 0; index < profileIds.length; index += 1) {
        await client.execute('UPDATE profiles SET displayOrder = ? WHERE id = ?', [index, profileIds[index]]);
      }
    });
  }

  private async getRequiredProfile(profileId: string): Promise<Profile> {
    const profile = await this.getProfile(profileId);
    if (!profile) {
      throw new ValidationError('Profile not found.');
    }

    return profile;
  }

  private async getProfileCount(): Promise<number> {
    const result = await this.db.execute<CountRow>('SELECT COUNT(*) as count FROM profiles');
    return result.rows[0]?.count ?? 0;
  }

  private async getNextDisplayOrder(): Promise<number> {
    const result = await this.db.execute<NextOrderRow>(
      'SELECT COALESCE(MAX(displayOrder), -1) + 1 as nextOrder FROM profiles',
    );
    return result.rows[0]?.nextOrder ?? 0;
  }

  private async getPromotedDefaultId(client: SqlClient, deletedDisplayOrder: number): Promise<string | null> {
    const nextResult = await client.execute<{ id: string }>(
      'SELECT id FROM profiles WHERE displayOrder >= ? ORDER BY displayOrder ASC LIMIT 1',
      [deletedDisplayOrder],
    );

    if (nextResult.rows[0]) {
      return nextResult.rows[0].id;
    }

    const firstResult = await client.execute<{ id: string }>(
      'SELECT id FROM profiles ORDER BY displayOrder ASC LIMIT 1',
    );
    return firstResult.rows[0]?.id ?? null;
  }

  private async ensureUniqueIdentifier(profile: CreateProfileInput['profile'] | Profile, currentProfileId?: string): Promise<void> {
    if (profile.type === ProfileType.UPI) {
      const upiId = ValidationService.validateUPIId(profile.upiId);
      const result = await this.db.execute<{ profileId: string }>(
        'SELECT profileId FROM upi_profiles WHERE upiId = ? AND profileId != ?',
        [upiId, currentProfileId ?? ''],
      );

      if (result.rows.length > 0) {
        throw new DuplicateUPIError();
      }
    }

    if (profile.type === ProfileType.WhatsApp) {
      const mobileNumber = ValidationService.validateMobileNumber(profile.mobileNumber);
      const result = await this.db.execute<{ profileId: string }>(
        'SELECT profileId FROM whatsapp_profiles WHERE mobileNumber = ? AND profileId != ?',
        [mobileNumber, currentProfileId ?? ''],
      );

      if (result.rows.length > 0) {
        throw new DuplicatePhoneError();
      }
    }
  }

  private async insertSubtype(client: SqlClient, profile: Profile): Promise<void> {
    if (profile.type === ProfileType.UPI) {
      await client.execute(
        'INSERT INTO upi_profiles (profileId, upiId, minimumAmount, defaultDescription) VALUES (?, ?, ?, ?)',
        [
          profile.id,
          ValidationService.validateUPIId(profile.upiId),
          ValidationService.validateAmount(profile.minimumAmount),
          profile.defaultDescription,
        ],
      );
      return;
    }

    if (profile.type === ProfileType.WhatsApp) {
      await client.execute('INSERT INTO whatsapp_profiles (profileId, mobileNumber) VALUES (?, ?)', [
        profile.id,
        ValidationService.validateMobileNumber(profile.mobileNumber),
      ]);
      return;
    }

    await client.execute('INSERT INTO other_profiles (profileId, qrImagePath) VALUES (?, ?)', [
      profile.id,
      requireImportedQr(profile),
    ]);
  }

  private async updateSubtype(client: SqlClient, profile: Profile): Promise<void> {
    if (profile.type === ProfileType.UPI) {
      await client.execute(
        'UPDATE upi_profiles SET upiId = ?, minimumAmount = ?, defaultDescription = ? WHERE profileId = ?',
        [
          ValidationService.validateUPIId(profile.upiId),
          ValidationService.validateAmount(profile.minimumAmount),
          profile.defaultDescription,
          profile.id,
        ],
      );
      return;
    }

    if (profile.type === ProfileType.WhatsApp) {
      await client.execute('UPDATE whatsapp_profiles SET mobileNumber = ? WHERE profileId = ?', [
        ValidationService.validateMobileNumber(profile.mobileNumber),
        profile.id,
      ]);
      return;
    }

    await client.execute('UPDATE other_profiles SET qrImagePath = ? WHERE profileId = ?', [
      requireImportedQr(profile),
      profile.id,
    ]);
  }

  private async compactDisplayOrder(client: SqlClient): Promise<void> {
    const result = await client.execute<{ id: string }>('SELECT id FROM profiles ORDER BY displayOrder ASC');

    for (let index = 0; index < result.rows.length; index += 1) {
      await client.execute('UPDATE profiles SET displayOrder = ? WHERE id = ?', [index, result.rows[index].id]);
    }
  }

  async restoreBackup(backup: BackupV1): Promise<void> {
    const upiIds = new Set<string>();
    const mobileNumbers = new Set<string>();
    const validatedProfiles: Array<UPIProfile | WhatsAppProfile> = [];

    for (const p of backup.profiles) {
      const nickname = ValidationService.validateNickname(p.nickname);

      if (p.type === ProfileType.UPI) {
        const upiId = ValidationService.validateUPIId(p.upiId);
        if (upiIds.has(upiId)) {
          throw new ValidationError('Backup contains duplicate UPI IDs.');
        }
        upiIds.add(upiId);
        const minimumAmount = ValidationService.validateAmount(p.minimumAmount);

        validatedProfiles.push({
          ...p,
          id: p.id || this.createId(),
          nickname,
          upiId,
          minimumAmount,
        } as UPIProfile);
      } else if (p.type === ProfileType.WhatsApp) {
        const mobileNumber = ValidationService.validateMobileNumber(p.mobileNumber);
        if (mobileNumbers.has(mobileNumber)) {
          throw new ValidationError('Backup contains duplicate WhatsApp numbers.');
        }
        mobileNumbers.add(mobileNumber);

        validatedProfiles.push({
          ...p,
          id: p.id || this.createId(),
          nickname,
          mobileNumber,
        } as WhatsAppProfile);
      }
    }

    if (validatedProfiles.length > MAX_PROFILES) {
      throw new ValidationError(`Backup contains more than the maximum allowed profiles (${MAX_PROFILES}).`);
    }

    await this.db.transaction(async (client) => {
      // Clear current profiles and subtype tables
      await client.execute('DELETE FROM upi_profiles');
      await client.execute('DELETE FROM whatsapp_profiles');
      await client.execute('DELETE FROM other_profiles');
      await client.execute('DELETE FROM profiles');

      // Insert validated profiles
      for (let index = 0; index < validatedProfiles.length; index += 1) {
        const profile = validatedProfiles[index];
        const displayOrder = index;
        const createdAt = this.now();
        const settings = await this.settingsRepository.getSettings();
        const avatarColor = AvatarService.createAvatarColor(profile.nickname, settings.installationId);

        await client.execute(
          'INSERT INTO profiles (id, type, nickname, logoPath, avatarColor, displayOrder, quickAccessSlot, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [
            profile.id,
            profile.type,
            profile.nickname,
            profile.logoPath ?? null,
            avatarColor,
            displayOrder,
            profile.quickAccessSlot ?? null,
            createdAt,
            createdAt,
          ],
        );

        if (profile.type === ProfileType.UPI) {
          await client.execute(
            'INSERT INTO upi_profiles (profileId, upiId, minimumAmount, defaultDescription) VALUES (?, ?, ?, ?)',
            [
              profile.id,
              profile.upiId,
              profile.minimumAmount,
              profile.defaultDescription ?? null,
            ],
          );
        } else if (profile.type === ProfileType.WhatsApp) {
          await client.execute(
            'INSERT INTO whatsapp_profiles (profileId, mobileNumber) VALUES (?, ?)',
            [
              profile.id,
              profile.mobileNumber,
            ],
          );
        }
      }

      // Restore settings
      const currentSettings = await this.settingsRepository.getSettings();
      let defaultProfileId = backup.settings.defaultProfileId ?? null;

      // Ensure the default profile exists in the imported set
      const importedIds = new Set(validatedProfiles.map((p) => p.id));
      if (defaultProfileId && !importedIds.has(defaultProfileId)) {
        defaultProfileId = validatedProfiles[0]?.id ?? null;
      }

      await client.execute(
        'UPDATE settings SET defaultProfileId = ?, maxHeaderProfiles = ? WHERE id = 1',
        [defaultProfileId, backup.settings.maxHeaderProfiles],
      );
    });

    // Synchronize settings cache
    await this.settingsRepository.getSettings();
  }
}

function normalizeProfileFields<T extends CreateProfileInput['profile'] | Profile>(profile: T): T {
  if (profile.type === ProfileType.UPI) {
    return {
      ...profile,
      upiId: ValidationService.validateUPIId(profile.upiId),
      minimumAmount: ValidationService.validateAmount(profile.minimumAmount),
    };
  }

  if (profile.type === ProfileType.WhatsApp) {
    return {
      ...profile,
      mobileNumber: ValidationService.validateMobileNumber(profile.mobileNumber),
    };
  }

  return {
    ...profile,
    qrImagePath: requireImportedQr(profile),
  };
}

function requireImportedQr(profile: Pick<OtherProfile, 'qrImagePath'>): string {
  if (!profile.qrImagePath.trim()) {
    throw new ValidationError('Imported QR image is required.');
  }

  return profile.qrImagePath;
}

function createDefaultProfileId(): string {
  return `profile-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}





