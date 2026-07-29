import {
  OtherProfile,
  Profile,
  ProfileType,
  UPIProfile,
  WhatsAppProfile,
} from '@domain/models/Profile';
import { SqlRow } from '@database/sqlite/SqlClient';

export interface ProfileRow extends SqlRow {
  id: string;
  type: ProfileType;
  nickname: string;
  logoPath: string | null;
  avatarColor: string;
  displayOrder: number;
  quickAccessSlot: number | null;
  createdAt: number;
  updatedAt: number;
  upiId: string | null;
  minimumAmount: number | null;
  defaultDescription: string | null;
  mobileNumber: string | null;
  qrImagePath: string | null;
}

export class ProfileMapper {
  static fromRow(row: ProfileRow): Profile {
    const base = {
      id: row.id,
      nickname: row.nickname,
      logoPath: row.logoPath,
      avatarColor: row.avatarColor,
      displayOrder: row.displayOrder,
      quickAccessSlot: row.quickAccessSlot,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };

    if (row.type === ProfileType.UPI) {
      return {
        ...base,
        type: ProfileType.UPI,
        upiId: requireColumn(row.upiId, 'upiId'),
        minimumAmount: row.minimumAmount,
        defaultDescription: row.defaultDescription,
      } satisfies UPIProfile;
    }

    if (row.type === ProfileType.WhatsApp) {
      return {
        ...base,
        type: ProfileType.WhatsApp,
        mobileNumber: requireColumn(row.mobileNumber, 'mobileNumber'),
      } satisfies WhatsAppProfile;
    }

    return {
      ...base,
      type: ProfileType.Other,
      qrImagePath: requireColumn(row.qrImagePath, 'qrImagePath'),
    } satisfies OtherProfile;
  }
}

function requireColumn(value: string | null, column: string): string {
  if (!value) {
    throw new Error(`Missing ${column} for profile row.`);
  }

  return value;
}
