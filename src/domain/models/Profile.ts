export enum ProfileType {
  UPI,
  WhatsApp,
  Custom,
  Other,
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

export interface CustomProfile extends BaseProfile {
  type: ProfileType.Custom;
  text: string;
}

export interface OtherProfile extends BaseProfile {
  type: ProfileType.Other;
  imagePath: string;
  extractedText: string | null;
}

export type Profile = UPIProfile | WhatsAppProfile | CustomProfile | OtherProfile;

export const MAX_PROFILES = 10;
export const MAX_QUICK_PROFILES = 4;
export const MAX_NICKNAME_LENGTH = 24;
