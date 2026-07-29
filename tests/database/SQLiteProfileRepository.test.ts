import assert from 'node:assert/strict';
import test from 'node:test';

import { SettingsRepository } from '@database/repositories/SettingsRepository';
import { SQLiteProfileRepository } from '@database/repositories/SQLiteProfileRepository';
import { SqlClient, SqlResult, SqlRow, SqlValue } from '@database/sqlite/SqlClient';
import { DuplicateUPIError } from '@domain/errors/DomainErrors';
import { Profile, ProfileType } from '@domain/models/Profile';
import { Settings } from '@domain/models/Settings';

interface BaseRecord {
  id: string;
  type: ProfileType;
  nickname: string;
  logoPath: string | null;
  avatarColor: string;
  displayOrder: number;
  quickAccessSlot: number | null;
  createdAt: number;
  updatedAt: number;
}

class ProfileSqlClient implements SqlClient {
  readonly profiles = new Map<string, BaseRecord>();
  readonly upiProfiles = new Map<string, { upiId: string; minimumAmount: number | null; defaultDescription: string | null }>();
  readonly whatsappProfiles = new Map<string, { mobileNumber: string }>();
  readonly otherProfiles = new Map<string, { qrImagePath: string }>();
  defaultProfileId: string | null = null;

  async execute<T extends SqlRow = SqlRow>(sql: string, params: SqlValue[] = []): Promise<SqlResult<T>> {
    const normalized = sql.replace(/\s+/g, ' ').trim();

    if (normalized.startsWith('SELECT COUNT')) {
      return rows<T>([{ count: this.profiles.size }]);
    }

    if (normalized.startsWith('SELECT COALESCE')) {
      const displayOrders = Array.from(this.profiles.values()).map((profile) => profile.displayOrder);
      const nextOrder = displayOrders.length === 0 ? 0 : Math.max(...displayOrders) + 1;
      return rows<T>([{ nextOrder }]);
    }

    if (normalized.startsWith('SELECT profileId FROM upi_profiles')) {
      const [upiId, currentProfileId] = params;
      return rows<T>(
        Array.from(this.upiProfiles.entries())
          .filter(([profileId, profile]) => profile.upiId === upiId && profileId !== currentProfileId)
          .map(([profileId]) => ({ profileId })),
      );
    }

    if (normalized.startsWith('SELECT profileId FROM whatsapp_profiles')) {
      const [mobileNumber, currentProfileId] = params;
      return rows<T>(
        Array.from(this.whatsappProfiles.entries())
          .filter(([profileId, profile]) => profile.mobileNumber === mobileNumber && profileId !== currentProfileId)
          .map(([profileId]) => ({ profileId })),
      );
    }

    if (normalized.startsWith('INSERT INTO profiles')) {
      this.profiles.set(params[0] as string, {
        id: params[0] as string,
        type: params[1] as ProfileType,
        nickname: params[2] as string,
        logoPath: params[3] as string | null,
        avatarColor: params[4] as string,
        displayOrder: params[5] as number,
        quickAccessSlot: params[6] as number | null,
        createdAt: params[7] as number,
        updatedAt: params[8] as number,
      });
      return empty<T>(1);
    }

    if (normalized.startsWith('INSERT INTO upi_profiles')) {
      this.upiProfiles.set(params[0] as string, {
        upiId: params[1] as string,
        minimumAmount: params[2] as number | null,
        defaultDescription: params[3] as string | null,
      });
      return empty<T>(1);
    }

    if (normalized.startsWith('INSERT INTO whatsapp_profiles')) {
      this.whatsappProfiles.set(params[0] as string, { mobileNumber: params[1] as string });
      return empty<T>(1);
    }

    if (normalized.startsWith('INSERT INTO other_profiles')) {
      this.otherProfiles.set(params[0] as string, { qrImagePath: params[1] as string });
      return empty<T>(1);
    }

    if (normalized === 'UPDATE profiles SET quickAccessSlot = NULL WHERE quickAccessSlot = ?') {
      for (const profile of this.profiles.values()) {
        if (profile.quickAccessSlot === params[0]) {
          profile.quickAccessSlot = null;
        }
      }
      return empty<T>(1);
    }

    if (normalized === 'UPDATE profiles SET quickAccessSlot = NULL WHERE quickAccessSlot = ? AND id != ?') {
      for (const profile of this.profiles.values()) {
        if (profile.quickAccessSlot === params[0] && profile.id !== params[1]) {
          profile.quickAccessSlot = null;
        }
      }
      return empty<T>(1);
    }

    if (normalized === 'UPDATE profiles SET quickAccessSlot = ? WHERE id = ?') {
      const profile = this.requireProfile(params[1] as string);
      profile.quickAccessSlot = params[0] as number | null;
      return empty<T>(1);
    }

    if (normalized === 'UPDATE profiles SET quickAccessSlot = NULL WHERE id = ?') {
      this.requireProfile(params[0] as string).quickAccessSlot = null;
      return empty<T>(1);
    }

    if (normalized === 'DELETE FROM upi_profiles') {
      this.upiProfiles.clear();
      return empty<T>(1);
    }

    if (normalized === 'DELETE FROM whatsapp_profiles') {
      this.whatsappProfiles.clear();
      return empty<T>(1);
    }

    if (normalized === 'DELETE FROM other_profiles') {
      this.otherProfiles.clear();
      return empty<T>(1);
    }

    if (normalized === 'DELETE FROM profiles') {
      this.profiles.clear();
      return empty<T>(1);
    }

    if (normalized.startsWith('DELETE FROM upi_profiles')) {
      this.upiProfiles.delete(params[0] as string);
      return empty<T>(1);
    }

    if (normalized.startsWith('DELETE FROM whatsapp_profiles')) {
      this.whatsappProfiles.delete(params[0] as string);
      return empty<T>(1);
    }

    if (normalized.startsWith('DELETE FROM other_profiles')) {
      this.otherProfiles.delete(params[0] as string);
      return empty<T>(1);
    }

    if (normalized.startsWith('DELETE FROM profiles')) {
      this.profiles.delete(params[0] as string);
      return empty<T>(1);
    }


    if (normalized === 'SELECT id FROM profiles WHERE displayOrder >= ? ORDER BY displayOrder ASC LIMIT 1') {
      return rows<T>(
        this.orderedProfiles()
          .filter((profile) => profile.displayOrder >= (params[0] as number))
          .slice(0, 1)
          .map((profile) => ({ id: profile.id })),
      );
    }
    if (normalized === 'SELECT id FROM profiles ORDER BY displayOrder ASC LIMIT 1') {
      return rows<T>(this.orderedProfiles().slice(0, 1).map((profile) => ({ id: profile.id })));
    }

    if (normalized === 'SELECT id FROM profiles ORDER BY displayOrder ASC') {
      return rows<T>(this.orderedProfiles().map((profile) => ({ id: profile.id })));
    }

    if (normalized === 'UPDATE profiles SET displayOrder = ? WHERE id = ?') {
      this.requireProfile(params[1] as string).displayOrder = params[0] as number;
      return empty<T>(1);
    }

    if (normalized.startsWith('UPDATE settings SET defaultProfileId = ?')) {
      this.defaultProfileId = params[0] as string | null;
      return empty<T>(1);
    }

    if (normalized.includes('FROM profiles p')) {
      let result = this.orderedProfiles();

      if (normalized.includes('WHERE p.id = ?')) {
        result = result.filter((profile) => profile.id === params[0]);
      }

      if (normalized.includes('WHERE p.quickAccessSlot IS NOT NULL')) {
        result = result
          .filter((profile) => profile.quickAccessSlot !== null)
          .sort((left, right) => (left.quickAccessSlot ?? 0) - (right.quickAccessSlot ?? 0));
      }

      return rows<T>(result.map((profile) => this.toJoinedRow(profile)));
    }

    throw new Error(`Unexpected SQL: ${normalized}`);
  }

  async transaction<T>(work: (client: SqlClient) => Promise<T>): Promise<T> {
    return work(this);
  }

  private requireProfile(profileId: string): BaseRecord {
    const profile = this.profiles.get(profileId);
    assert.ok(profile, `Missing profile ${profileId}`);
    return profile;
  }

  private orderedProfiles(): BaseRecord[] {
    return Array.from(this.profiles.values()).sort((left, right) => left.displayOrder - right.displayOrder);
  }

  private toJoinedRow(profile: BaseRecord): SqlRow {
    const upi = this.upiProfiles.get(profile.id);
    const whatsapp = this.whatsappProfiles.get(profile.id);
    const other = this.otherProfiles.get(profile.id);

    return {
      ...profile,
      upiId: upi?.upiId ?? null,
      minimumAmount: upi?.minimumAmount ?? null,
      defaultDescription: upi?.defaultDescription ?? null,
      mobileNumber: whatsapp?.mobileNumber ?? null,
      qrImagePath: other?.qrImagePath ?? null,
    };
  }
}

class ProfileSettingsRepository implements SettingsRepository {
  constructor(private readonly db: ProfileSqlClient) {}

  async getSettings(): Promise<Settings> {
    return {
      id: 1,
      defaultProfileId: this.db.defaultProfileId,
      maxHeaderProfiles: 4,
      installationId: 'install-test',
      schemaVersion: 1,
    };
  }

  async updateSettings(settings: Settings): Promise<Settings> {
    this.db.defaultProfileId = settings.defaultProfileId;
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
    const current = await this.getSettings();
    return this.updateSettings({ ...current, ...settings });
  }
}

test('profile repository creates profiles with contiguous display order', async () => {
  const db = new ProfileSqlClient();
  const repository = createRepository(db, ['upi-1', 'wa-1']);

  const upi = await repository.createProfile({
    profile: {
      type: ProfileType.UPI,
      nickname: 'Home',
      logoPath: null,
      quickAccessSlot: null,
      upiId: 'home@upi',
      minimumAmount: null,
      defaultDescription: null,
    },
  });
  const whatsapp = await repository.createProfile({
    profile: {
      type: ProfileType.WhatsApp,
      nickname: 'Office',
      logoPath: null,
      quickAccessSlot: null,
      mobileNumber: '+91 98765 43210',
    },
  });

  assert.equal(upi.displayOrder, 0);
  assert.equal(whatsapp.displayOrder, 1);
  assert.equal(db.whatsappProfiles.get('wa-1')?.mobileNumber, '919876543210');
});

test('profile repository rejects duplicate UPI IDs', async () => {
  const db = new ProfileSqlClient();
  const repository = createRepository(db, ['upi-1', 'upi-2']);

  await repository.createProfile({
    profile: {
      type: ProfileType.UPI,
      nickname: 'Home',
      logoPath: null,
      quickAccessSlot: null,
      upiId: 'home@upi',
      minimumAmount: null,
      defaultDescription: null,
    },
  });

  await assert.rejects(
    () =>
      repository.createProfile({
        profile: {
          type: ProfileType.UPI,
          nickname: 'Duplicate',
          logoPath: null,
          quickAccessSlot: null,
          upiId: 'home@upi',
          minimumAmount: null,
          defaultDescription: null,
        },
      }),
    DuplicateUPIError,
  );
});

test('profile repository assigns quick slots exclusively', async () => {
  const db = new ProfileSqlClient();
  const repository = createRepository(db, ['profile-1', 'profile-2']);

  await createUPI(repository, 'First');
  await createUPI(repository, 'Second');

  await repository.assignQuickAccessSlot('profile-1', 0);
  await repository.assignQuickAccessSlot('profile-2', 0);

  assert.equal(db.profiles.get('profile-1')?.quickAccessSlot, null);
  assert.equal(db.profiles.get('profile-2')?.quickAccessSlot, 0);
});

test('profile repository promotes next profile when deleting default and compacts order', async () => {
  const db = new ProfileSqlClient();
  const repository = createRepository(db, ['profile-1', 'profile-2', 'profile-3']);

  await createUPI(repository, 'First');
  await createUPI(repository, 'Second');
  await createUPI(repository, 'Third');
  await repository.setDefaultProfile('profile-2');

  await repository.deleteProfile('profile-2');
  const remaining = await repository.getAllProfiles();

  assert.equal(db.defaultProfileId, 'profile-3');
  assert.deepEqual(
    remaining.map((profile) => [profile.id, profile.displayOrder]),
    [
      ['profile-1', 0],
      ['profile-3', 1],
    ],
  );
});

test('profile repository restores backup successfully', async () => {
  const db = new ProfileSqlClient();
  const repository = createRepository(db, ['profile-1']);

  // Pre-populate DB
  await createUPI(repository, 'Existing');

  const backup = {
    version: 1 as const,
    exportedAt: Date.now(),
    settings: {
      defaultProfileId: 'backup-upi-1',
      maxHeaderProfiles: 2 as const,
    },
    profiles: [
      {
        id: 'backup-upi-1',
        type: ProfileType.UPI as const,
        nickname: 'Imported UPI',
        logoPath: null,
        quickAccessSlot: 0 as const,
        upiId: 'imported@upi',
        minimumAmount: null,
        defaultDescription: null,
        avatarColor: '#2563EB',
        displayOrder: 0,
        createdAt: 12345,
        updatedAt: 12345,
      },
      {
        id: 'backup-wa-1',
        type: ProfileType.WhatsApp as const,
        nickname: 'Imported WhatsApp',
        logoPath: null,
        quickAccessSlot: null,
        mobileNumber: '919876543210',
        avatarColor: '#059669',
        displayOrder: 1,
        createdAt: 12345,
        updatedAt: 12345,
      },
    ],
  };

  await repository.restoreBackup(backup);

  const restoredProfiles = await repository.getAllProfiles();
  assert.equal(restoredProfiles.length, 2);
  assert.equal(restoredProfiles[0].nickname, 'Imported UPI');
  assert.equal(restoredProfiles[1].nickname, 'Imported WhatsApp');
  assert.equal(db.defaultProfileId, 'backup-upi-1');
  
  // Existing profile must be deleted
  assert.equal(restoredProfiles.some((p) => p.nickname === 'Existing'), false);
});

test('profile repository reject duplicate UPI IDs in backup restore', async () => {
  const db = new ProfileSqlClient();
  const repository = createRepository(db, []);

  const backup = {
    version: 1 as const,
    exportedAt: Date.now(),
    settings: {
      defaultProfileId: null,
      maxHeaderProfiles: 4 as const,
    },
    profiles: [
      {
        id: 'upi-1',
        type: ProfileType.UPI as const,
        nickname: 'UPI 1',
        logoPath: null,
        quickAccessSlot: null,
        upiId: 'dup@upi',
        minimumAmount: null,
        defaultDescription: null,
        avatarColor: '#2563EB',
        displayOrder: 0,
        createdAt: 12345,
        updatedAt: 12345,
      },
      {
        id: 'upi-2',
        type: ProfileType.UPI as const,
        nickname: 'UPI 2',
        logoPath: null,
        quickAccessSlot: null,
        upiId: 'dup@upi',
        minimumAmount: null,
        defaultDescription: null,
        avatarColor: '#2563EB',
        displayOrder: 1,
        createdAt: 12345,
        updatedAt: 12345,
      },
    ],
  };

  await assert.rejects(
    () => repository.restoreBackup(backup),
    /Backup contains duplicate UPI IDs/,
  );
});


function createRepository(db: ProfileSqlClient, ids: string[]): SQLiteProfileRepository {
  let now = 100;
  return new SQLiteProfileRepository(
    db,
    new ProfileSettingsRepository(db),
    () => ids.shift() ?? `profile-${ids.length}`,
    () => {
      now += 1;
      return now;
    },
  );
}

async function createUPI(repository: SQLiteProfileRepository, nickname: string): Promise<Profile> {
  return repository.createProfile({
    profile: {
      type: ProfileType.UPI,
      nickname,
      logoPath: null,
      quickAccessSlot: null,
      upiId: `${nickname.toLowerCase()}@upi`,
      minimumAmount: null,
      defaultDescription: null,
    },
  });
}

function rows<T extends SqlRow>(values: SqlRow[]): SqlResult<T> {
  return {
    rows: values as T[],
    rowsAffected: values.length,
  };
}

function empty<T extends SqlRow>(rowsAffected: number): SqlResult<T> {
  return {
    rows: [],
    rowsAffected,
  };
}



