import { sha256 } from '@shared/utils/sha256';

const AVATAR_COLORS = [
  '#2563EB',
  '#059669',
  '#DC2626',
  '#7C3AED',
  '#C2410C',
  '#0F766E',
  '#BE123C',
  '#4338CA',
];

export interface AvatarModel {
  initials: string;
  color: string;
}

export class AvatarService {
  static createInitials(nickname: string): string {
    const words = nickname.trim().split(/\s+/).filter(Boolean);
    return words
      .slice(0, 2)
      .map((word) => word.charAt(0).toUpperCase())
      .join('');
  }

  static createAvatarColor(nickname: string, installationId: string): string {
    const seed = `${nickname}${installationId}`;
    const hash = sha256(seed);
    const numericHash = parseInt(hash.slice(0, 8), 16);
    const colorIndex = numericHash % AVATAR_COLORS.length;
    return AVATAR_COLORS[colorIndex];
  }

  static createAvatar(nickname: string, installationId: string): AvatarModel {
    return {
      initials: this.createInitials(nickname),
      color: this.createAvatarColor(nickname, installationId),
    };
  }
}

