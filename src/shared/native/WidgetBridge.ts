import { Profile, ProfileType } from '@domain/models/Profile';
import { AvatarService } from '@domain/services/AvatarService';
import { QRPayloadService } from '@domain/services/QRPayloadService';

function getReactNative(): { Platform?: { OS: string }; NativeModules?: { WidgetBridge?: any } } | null {
  if (typeof process !== 'undefined' && process.versions?.node && !(global as any).__fbBatchedBridge) {
    return null;
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require('react-native');
  } catch {
    return null;
  }
}

export class WidgetBridgeService {
  /**
   * Updates the native Android Open Default Profile home-screen widget.
   * If profile is null or undefined, the widget transitions to the "Set Default Profile" state.
   */
  static updateDefaultProfileWidget(profile: Profile | null | undefined): void {
    const RN = getReactNative();
    if (!RN || RN.Platform?.OS !== 'android' || !RN.NativeModules?.WidgetBridge) {
      return;
    }

    const { WidgetBridge } = RN.NativeModules;

    try {
      if (profile) {
        const initials = AvatarService.createInitials(profile.nickname);
        let subtitle = `${profile.type} Account`;
        let qrPayload = '';
        let imagePath: string | null = null;

        if (profile.type === ProfileType.UPI) {
          subtitle = profile.upiId;
          qrPayload = QRPayloadService.createUPIPayload(profile, null);
        } else if (profile.type === ProfileType.WhatsApp) {
          subtitle = profile.mobileNumber;
          qrPayload = QRPayloadService.createWhatsAppPayload(profile);
        } else if (profile.type === ProfileType.Custom) {
          subtitle = 'Custom Account';
          qrPayload = QRPayloadService.createCustomPayload(profile);
        } else if (profile.type === ProfileType.Other) {
          subtitle = 'Other Account';
          imagePath = profile.imagePath;
        }

        WidgetBridge.updateDefaultProfileWidget(
          true,
          profile.nickname,
          initials,
          profile.avatarColor || '#2563EB',
          subtitle,
          qrPayload,
          imagePath,
        );
      } else {
        WidgetBridge.updateDefaultProfileWidget(false, null, null, null, null, null, null);
      }
    } catch (err) {
      console.warn('WidgetBridge.updateDefaultProfileWidget error:', err);
    }
  }

  /**
   * Re-renders all installed widget instances (Default Profile + Scan QR).
   */
  static reloadAllWidgets(): void {
    const RN = getReactNative();
    if (!RN || RN.Platform?.OS !== 'android' || !RN.NativeModules?.WidgetBridge) {
      return;
    }

    const { WidgetBridge } = RN.NativeModules;

    try {
      WidgetBridge.reloadAllWidgets();
    } catch (err) {
      console.warn('WidgetBridge.reloadAllWidgets error:', err);
    }
  }
}
