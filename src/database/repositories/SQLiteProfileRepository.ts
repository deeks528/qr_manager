import { ProfileMapper, ProfileRow } from '@database/mappers/ProfileMapper';
import { ProfileRepository, CreateProfileInput } from '@database/repositories/ProfileRepository';
import { SettingsRepository } from '@database/repositories/SettingsRepository';
import { SqlClient, SqlRow } from '@database/sqlite/SqlClient';
import { DuplicatePhoneError, DuplicateUPIError, ValidationError } from '@domain/errors/DomainErrors';
import { BackupV1 } from '@domain/services/ExportService';
import {
  MAX_PROFILES,
  MAX_QUICK_PROFILES,
  Profile,
  ProfileType,
  UPIProfile,
  WhatsAppProfile,
} from '@domain/models/Profile';
import { AvatarService } from '@domain/services/AvatarService';
import { ValidationService } from '@domain/services/ValidationService';
import { WidgetBridgeService } from '@shared/native/WidgetBridge';
import { ProfileSubtypeHandler } from './ProfileSubtypeHandler';

const PROFILE_SELECT = `
SELECT
  p.id, p.type, p.nickname, p.logoPath, p.avatarColor, p.displayOrder, p.quickAccessSlot, p.createdAt, p.updatedAt,
  u.upiId, u.minimumAmount, u.defaultDescription,
  w.mobileNumber,
  cp.text,
  o.imagePath, o.extractedText
FROM profiles p
LEFT JOIN upi_profiles u ON u.profileId = p.id
LEFT JOIN whatsapp_profiles w ON w.profileId = p.id
LEFT JOIN custom_profiles cp ON cp.profileId = p.id
LEFT JOIN other_profiles o ON o.profileId = p.id
`;

interface CountRow extends SqlRow { count: number; }
interface NextOrderRow extends SqlRow { nextOrder: number; }

export class SQLiteProfileRepository implements ProfileRepository {
  constructor(
    private readonly db: SqlClient,
    private readonly settingsRepository: SettingsRepository,
    private readonly createId: () => string = createDefaultProfileId,
    private readonly now: () => number = Date.now,
  ) { }

  async createProfile(input: CreateProfileInput): Promise<Profile> {
    const profileCount = await this.getProfileCount();
    if (profileCount >= MAX_PROFILES) {
      throw new ValidationError(`Maximum of ${MAX_PROFILES} profiles reached.`);
    }

    const settings = await this.settingsRepository.getSettings();
    const nickname = ValidationService.validateNickname(input.profile.nickname);
    const createdAt = this.now();

    const profile = {
      ...input.profile,
      id: this.createId(),
      nickname,
      avatarColor: AvatarService.createAvatarColor(nickname, settings.installationId),
      displayOrder: await this.getNextDisplayOrder(),
      createdAt,
      updatedAt: createdAt,
    } as Profile;

    await this.ensureUniqueIdentifier(profile);

    await this.db.transaction(async (client) => {
      if (profile.quickAccessSlot !== null) {
        await client.execute('UPDATE profiles SET quickAccessSlot = NULL WHERE quickAccessSlot = ?', [profile.quickAccessSlot]);
      }

      await client.execute(
        'INSERT INTO profiles (id, type, nickname, logoPath, avatarColor, displayOrder, quickAccessSlot, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [profile.id, profile.type, profile.nickname, profile.logoPath, profile.avatarColor, profile.displayOrder, profile.quickAccessSlot, profile.createdAt, profile.updatedAt],
      );

      await ProfileSubtypeHandler.insert(client, profile);
    });

    return profile;
  }

  async updateProfile(profile: Profile): Promise<Profile> {
    const existing = await this.getRequiredProfile(profile.id);
    if (existing.type !== profile.type) {
      throw new ValidationError('Profile type cannot be changed.');
    }

    await this.ensureUniqueIdentifier(profile, profile.id);

    const settings = await this.settingsRepository.getSettings();
    const nickname = ValidationService.validateNickname(profile.nickname);
    const avatarColor = nickname === existing.nickname ? existing.avatarColor : AvatarService.createAvatarColor(nickname, settings.installationId);

    const updated: Profile = {
      ...profile,
      nickname,
      avatarColor,
      displayOrder: existing.displayOrder,
      createdAt: existing.createdAt,
      updatedAt: this.now(),
    };

    await this.db.transaction(async (client) => {
      if (updated.quickAccessSlot !== null) {
        await client.execute('UPDATE profiles SET quickAccessSlot = NULL WHERE quickAccessSlot = ? AND id != ?', [updated.quickAccessSlot, updated.id]);
      }

      await client.execute(
        'UPDATE profiles SET nickname = ?, logoPath = ?, avatarColor = ?, quickAccessSlot = ?, updatedAt = ? WHERE id = ?',
        [updated.nickname, updated.logoPath, updated.avatarColor, updated.quickAccessSlot, updated.updatedAt, updated.id],
      );

      await ProfileSubtypeHandler.update(client, updated);
    });

    if (settings.defaultProfileId === updated.id) {
      WidgetBridgeService.updateDefaultProfileWidget(updated);
    }

    return updated;
  }

  async deleteProfile(profileId: string): Promise<void> {
    const existing = await this.getRequiredProfile(profileId);
    const settings = await this.settingsRepository.getSettings();

    await this.db.transaction(async (client) => {
      await ProfileSubtypeHandler.deleteAll(client, existing);
      await client.execute('DELETE FROM profiles WHERE id = ?', [profileId]);
      await this.compactDisplayOrder(client);

      if (settings.defaultProfileId === profileId) {
        const nextDefault = await this.getPromotedDefaultId(client, existing.displayOrder);
        await client.execute('UPDATE settings SET defaultProfileId = ? WHERE id = 1', [nextDefault]);
      }
    });

    if (settings.defaultProfileId === profileId) {
      const refreshedSettings = await this.settingsRepository.getSettings();
      const newDefault = refreshedSettings.defaultProfileId
        ? await this.getProfile(refreshedSettings.defaultProfileId)
        : null;
      WidgetBridgeService.updateDefaultProfileWidget(newDefault);
    }
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
    const result = await this.db.execute<ProfileRow>(`${PROFILE_SELECT} WHERE p.quickAccessSlot IS NOT NULL ORDER BY p.quickAccessSlot ASC`);
    return result.rows.map((row) => ProfileMapper.fromRow(row));
  }

  async setDefaultProfile(profileId: string | null): Promise<void> {
    const profile = profileId !== null ? await this.getRequiredProfile(profileId) : null;
    const settings = await this.settingsRepository.getSettings();
    await this.settingsRepository.updateSettings({ ...settings, defaultProfileId: profileId });
    WidgetBridgeService.updateDefaultProfileWidget(profile);
  }

  async assignQuickAccessSlot(profileId: string, slot: 0 | 1 | 2 | 3): Promise<void> {
    await this.getRequiredProfile(profileId);
    if (slot < 0 || slot >= MAX_QUICK_PROFILES) throw new ValidationError('Quick access slot must be between 0 and 3.');
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
    if (profileIds.length !== profiles.length) throw new ValidationError('Display order must include every profile.');
    const knownIds = new Set(profiles.map((p) => p.id));
    if (profileIds.some((id) => !knownIds.has(id))) throw new ValidationError('Display order contains an unknown profile.');

    await this.db.transaction(async (client) => {
      for (let i = 0; i < profileIds.length; i++) await client.execute('UPDATE profiles SET displayOrder = ? WHERE id = ?', [-(i + 1), profileIds[i]]);
      for (let i = 0; i < profileIds.length; i++) await client.execute('UPDATE profiles SET displayOrder = ? WHERE id = ?', [i, profileIds[i]]);
    });
  }

  private async getRequiredProfile(profileId: string): Promise<Profile> {
    const profile = await this.getProfile(profileId);
    if (!profile) throw new ValidationError('Profile not found.');
    return profile;
  }

  private async getProfileCount(): Promise<number> {
    const result = await this.db.execute<CountRow>('SELECT COUNT(*) as count FROM profiles');
    return result.rows[0]?.count ?? 0;
  }

  private async getNextDisplayOrder(): Promise<number> {
    const result = await this.db.execute<NextOrderRow>('SELECT COALESCE(MAX(displayOrder), -1) + 1 as nextOrder FROM profiles');
    return result.rows[0]?.nextOrder ?? 0;
  }

  private async getPromotedDefaultId(client: SqlClient, deletedDisplayOrder: number): Promise<string | null> {
    const nextResult = await client.execute<{ id: string }>('SELECT id FROM profiles WHERE displayOrder >= ? ORDER BY displayOrder ASC LIMIT 1', [deletedDisplayOrder]);
    if (nextResult.rows[0]) return nextResult.rows[0].id;
    const firstResult = await client.execute<{ id: string }>('SELECT id FROM profiles ORDER BY displayOrder ASC LIMIT 1');
    return firstResult.rows[0]?.id ?? null;
  }

  private async ensureUniqueIdentifier(profile: Profile, currentProfileId?: string): Promise<void> {
    if (profile.type === ProfileType.UPI) {
      const upiId = ValidationService.validateUPIId(profile.upiId);
      const result = await this.db.execute<{ profileId: string }>('SELECT profileId FROM upi_profiles WHERE upiId = ? AND profileId != ?', [upiId, currentProfileId ?? '']);
      if (result.rows.length > 0) throw new DuplicateUPIError();
    }
    if (profile.type === ProfileType.WhatsApp) {
      const mobileNumber = ValidationService.validateMobileNumber(profile.mobileNumber);
      const result = await this.db.execute<{ profileId: string }>('SELECT profileId FROM whatsapp_profiles WHERE mobileNumber = ? AND profileId != ?', [mobileNumber, currentProfileId ?? '']);
      if (result.rows.length > 0) throw new DuplicatePhoneError();
    }
  }

  private async compactDisplayOrder(client: SqlClient): Promise<void> {
    const result = await client.execute<{ id: string }>('SELECT id FROM profiles ORDER BY displayOrder ASC');
    for (let i = 0; i < result.rows.length; i++) await client.execute('UPDATE profiles SET displayOrder = ? WHERE id = ?', [i, result.rows[i].id]);
  }

  async restoreBackup(backup: BackupV1): Promise<void> {
    const validatedProfiles: Profile[] = [];
    const upiIds = new Set<string>();
    const mobileNumbers = new Set<string>();

    for (const p of backup.profiles) {
      const nickname = ValidationService.validateNickname(p.nickname);
      const base = {
        ...p,
        id: p.id || this.createId(),
        nickname,
      };

      if (p.type === ProfileType.UPI) {
        const upiId = ValidationService.validateUPIId(p.upiId);
        if (upiIds.has(upiId)) throw new ValidationError('Backup contains duplicate UPI IDs.');
        upiIds.add(upiId);

        validatedProfiles.push({
          ...base,
          type: ProfileType.UPI,
          upiId,
          minimumAmount: ValidationService.validateAmount(p.minimumAmount),
        } as UPIProfile);
      } else if (p.type === ProfileType.WhatsApp) {
        const mobileNumber = ValidationService.validateMobileNumber(p.mobileNumber);
        if (mobileNumbers.has(mobileNumber)) throw new ValidationError('Backup contains duplicate WhatsApp numbers.');
        mobileNumbers.add(mobileNumber);

        validatedProfiles.push({
          ...base,
          type: ProfileType.WhatsApp,
          mobileNumber,
        } as WhatsAppProfile);
      }
      // Add other types if present in backup...
    }

    if (validatedProfiles.length > MAX_PROFILES) {
      throw new ValidationError(`Backup contains more than ${MAX_PROFILES} profiles.`);
    }

    await this.db.transaction(async (client) => {
      await client.execute('DELETE FROM upi_profiles');
      await client.execute('DELETE FROM whatsapp_profiles');
      await client.execute('DELETE FROM custom_profiles');
      await client.execute('DELETE FROM other_profiles');
      await client.execute('DELETE FROM profiles');

      const settings = await this.settingsRepository.getSettings();

      for (let i = 0; i < validatedProfiles.length; i++) {
        const profile = validatedProfiles[i];
        const createdAt = this.now();
        const avatarColor = AvatarService.createAvatarColor(profile.nickname, settings.installationId);

        await client.execute(
          'INSERT INTO profiles (id, type, nickname, logoPath, avatarColor, displayOrder, quickAccessSlot, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [profile.id, profile.type, profile.nickname, profile.logoPath ?? null, avatarColor, i, profile.quickAccessSlot ?? null, createdAt, createdAt],
        );

        await ProfileSubtypeHandler.insert(client, profile);
      }

      let defaultId = backup.settings.defaultProfileId ?? null;
      const importedIds = new Set(validatedProfiles.map((p) => p.id));
      if (defaultId && !importedIds.has(defaultId)) defaultId = validatedProfiles[0]?.id ?? null;

      await client.execute('UPDATE settings SET defaultProfileId = ?, maxHeaderProfiles = ? WHERE id = 1', [defaultId, backup.settings.maxHeaderProfiles]);
    });

    await this.settingsRepository.getSettings();
  }
}

function createDefaultProfileId(): string {
  return `profile-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}
