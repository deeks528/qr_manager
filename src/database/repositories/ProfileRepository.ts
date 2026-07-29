import { BackupV1 } from '@domain/services/ExportService';
import {
  OtherProfile,
  Profile,
  ProfileType,
  UPIProfile,
  WhatsAppProfile,
} from '@domain/models/Profile';

export type CreateProfileData =
  | Omit<UPIProfile, 'id' | 'avatarColor' | 'displayOrder' | 'createdAt' | 'updatedAt'>
  | Omit<WhatsAppProfile, 'id' | 'avatarColor' | 'displayOrder' | 'createdAt' | 'updatedAt'>
  | Omit<OtherProfile, 'id' | 'avatarColor' | 'displayOrder' | 'createdAt' | 'updatedAt'>;

export interface CreateProfileInput {
  profile: CreateProfileData;
}

export interface ProfileRepository {
  createProfile(input: CreateProfileInput): Promise<Profile>;
  updateProfile(profile: Profile): Promise<Profile>;
  deleteProfile(profileId: string): Promise<void>;
  getProfile(profileId: string): Promise<Profile | null>;
  getAllProfiles(): Promise<Profile[]>;
  getQuickProfiles(): Promise<Profile[]>;
  setDefaultProfile(profileId: string | null): Promise<void>;
  assignQuickAccessSlot(profileId: string, slot: 0 | 1 | 2 | 3): Promise<void>;
  removeQuickAccessSlot(profileId: string): Promise<void>;
  updateDisplayOrder(profileIds: string[]): Promise<void>;
  restoreBackup(backup: BackupV1): Promise<void>;
}
