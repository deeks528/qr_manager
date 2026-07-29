import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

import { Profile, ProfileType } from '@domain/models/Profile';
import { QRPayloadService } from '@domain/services/QRPayloadService';

interface QRPreviewProps {
  profile: Profile;
  runtimeAmount?: number | null;
  initialPayload?: string | null | undefined;
}

export function QRPreview({ profile, runtimeAmount, initialPayload }: QRPreviewProps): React.JSX.Element {
  if (profile.type === ProfileType.Other) {
    return (
      <View style={styles.qrFrame}>
        <Image
          accessibilityLabel={`${profile.nickname} imported QR`}
          resizeMode="contain"
          source={{ uri: profile.qrImagePath }}
          style={styles.importedQr}
        />
      </View>
    );
  }

  const payload =
    initialPayload != null
      ? initialPayload
      : profile.type === ProfileType.UPI
        ? QRPayloadService.createUPIPayload(profile, runtimeAmount)
        : QRPayloadService.createWhatsAppPayload(profile);

  console.log(payload, profile.type, profile, initialPayload);

  return (
    <View accessibilityLabel={`${profile.nickname} QR code`} style={styles.qrFrame}>
      <QRCode backgroundColor="#FFFFFF" color="#020617" size={204} value={payload} />
    </View>
  );
}

export function QRPreviewFallback(): React.JSX.Element {
  return (
    <View style={styles.qrFrame}>
      <Text style={styles.fallbackText}>QR unavailable</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  qrFrame: {
    width: 220,
    height: 220,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#FFFFFF',
    padding: 8,
  },
  importedQr: {
    width: 204,
    height: 204,
  },
  fallbackText: {
    color: '#64748B',
    fontSize: 14,
    fontWeight: '600',
  },
});
