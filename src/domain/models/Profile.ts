export enum ProfileType {
  UPI = 0,
  WhatsApp = 1,
  Other = 2,
}

export interface BaseProfile {
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

export interface UPIProfile extends BaseProfile {
  type: ProfileType.UPI;
  upiId: string;
  minimumAmount: number | null;
  defaultDescription: string | null;
}

export interface WhatsAppProfile extends BaseProfile {
  type: ProfileType.WhatsApp;
  mobileNumber: string;
}

export interface OtherProfile extends BaseProfile {
  type: ProfileType.Other;
  qrImagePath: string;
}

export type Profile = UPIProfile | WhatsAppProfile | OtherProfile;

export const MAX_PROFILES = 10;
export const MAX_QUICK_PROFILES = 4;
export const MAX_NICKNAME_LENGTH = 24;
