import React, { useMemo } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

import { Profile, ProfileType } from '@domain/models/Profile';
import { QRPayloadService } from '@domain/services/QRPayloadService';

interface QRPreviewProps {
  profile: Profile;
  runtimeAmount?: number | null;
  initialPayload?: string | null | undefined;
  size?: number;
}

export function QRPreview({ profile, runtimeAmount, initialPayload, size = 204 }: QRPreviewProps): React.JSX.Element {
  if (profile.type === ProfileType.Other) {
    if (!profile.imagePath) {
      return <QRPreviewFallback size={size} />;
    }
    return (
      <View style={[styles.qrContainer, { width: size, height: size }]}>
        <Image
          accessibilityLabel={`${profile.nickname} imported QR`}
          resizeMode="contain"
          source={{ uri: profile.imagePath }}
          style={{ width: size, height: size, borderRadius: 4 }}
        />
      </View>
    );
  }

  const payload = useMemo(() => {
    try {
      if (initialPayload != null) return initialPayload;

      switch (profile.type) {
        case ProfileType.UPI:
          return QRPayloadService.createUPIPayload(profile, runtimeAmount);
        case ProfileType.WhatsApp:
          return QRPayloadService.createWhatsAppPayload(profile);
        case ProfileType.Custom:
          return QRPayloadService.createCustomPayload(profile);
        default:
          return '';
      }
    } catch (error) {
      console.error('QR Payload Error:', error);
      return '';
    }
  }, [profile, runtimeAmount, initialPayload]);

  if (!payload) {
    return <QRPreviewFallback size={size} />;
  }

  return (
    <View accessibilityLabel={`${profile.nickname} QR code`} style={[styles.qrContainer, { width: size, height: size }]}>
      <QRCode backgroundColor="#FFFFFF" color="#0F172A" quietZone={6} size={size} value={payload} />
    </View>
  );
}

export function QRPreviewFallback({ size = 204 }: { size?: number }): React.JSX.Element {
  return (
    <View style={[styles.qrContainer, styles.fallbackContainer, { width: size, height: size }]}>
      <Text style={styles.fallbackText}>QR unavailable</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  qrContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 4,
    overflow: 'hidden',
  },
  fallbackContainer: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
  },
  fallbackText: {
    color: '#64748B',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
});
