import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  BackHandler,
  Easing,
  PermissionsAndroid,
  Platform,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Camera, CameraType } from 'react-native-camera-kit';
import ImagePicker from 'react-native-image-crop-picker';
import RNQRGenerator from 'rn-qr-generator';
import Ionicons from 'react-native-vector-icons/Ionicons';

import { UPIParser } from '@domain/services/UPIParser';

interface ScanQRScreenProps {
  onBack: () => void;
  onScanSuccess: (rawPayload: string) => void;
}

export function ScanQRScreen({ onBack, onScanSuccess }: ScanQRScreenProps): React.JSX.Element {
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
  const [torchOn, setTorchOn] = useState(false);
  const [isScanning, setIsScanning] = useState(true);
  const isProcessingRef = useRef(false);

  // Hardware back button returns to home
  useEffect(() => {
    const onBackPress = () => {
      onBack();
      return true;
    };
    const sub = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => sub.remove();
  }, [onBack]);

  // Animated scan line
  const scanLineAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    requestCameraPermission();
  }, []);

  useEffect(() => {
    if (isScanning) {
      const animation = Animated.loop(
        Animated.sequence([
          Animated.timing(scanLineAnim, {
            toValue: 210,
            duration: 2000,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(scanLineAnim, {
            toValue: 0,
            duration: 2000,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ]),
      );
      animation.start();
      return () => animation.stop();
    }
    return undefined;
  }, [isScanning, scanLineAnim]);

  const requestCameraPermission = async () => {
    if (Platform.OS === 'android') {
      try {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.CAMERA,
          {
            title: 'Camera Permission',
            message: 'QR Profile Manager needs access to your camera to scan QR codes.',
            buttonNeutral: 'Ask Me Later',
            buttonNegative: 'Cancel',
            buttonPositive: 'OK',
          },
        );
        setHasCameraPermission(granted === PermissionsAndroid.RESULTS.GRANTED);
      } catch (err) {
        console.warn('Error requesting camera permission', err);
        setHasCameraPermission(false);
      }
    } else {
      setHasCameraPermission(true);
    }
  };

  const handleBarcodeScanned = (rawCode: string) => {
    if (!rawCode || isProcessingRef.current || !isScanning) {
      return;
    }

    isProcessingRef.current = true;
    setIsScanning(false);

    try {
      // Validate UPI QR
      UPIParser.parse(rawCode);
      onScanSuccess(rawCode);
    } catch (error: any) {
      Alert.alert(
        'Invalid QR Code',
        error.message || 'This QR code is not a supported UPI payment QR',
        [
          {
            text: 'OK',
            onPress: () => {
              isProcessingRef.current = false;
              setIsScanning(true);
            },
          },
        ],
      );
    }
  };

  const handlePickFromGallery = async () => {
    try {
      const image = await ImagePicker.openPicker({
        mediaType: 'photo',
        cropping: false,
      });

      if (!image.path) {
        return;
      }

      isProcessingRef.current = true;
      setIsScanning(false);

      const response = await RNQRGenerator.detect({
        uri: image.path,
      });

      if (response.values && response.values.length > 0) {
        const detectedCode = response.values[0];
        try {
          UPIParser.parse(detectedCode);
          onScanSuccess(detectedCode);
        } catch (error: any) {
          Alert.alert(
            'Invalid QR Code',
            error.message || 'This QR code is not a supported UPI payment QR',
            [
              {
                text: 'OK',
                onPress: () => {
                  isProcessingRef.current = false;
                  setIsScanning(true);
                },
              },
            ],
          );
        }
      } else {
        Alert.alert(
          'No QR Code Found',
          'Could not detect any QR code in the selected image.',
          [
            {
              text: 'OK',
              onPress: () => {
                isProcessingRef.current = false;
                setIsScanning(true);
              },
            },
          ],
        );
      }
    } catch (error: any) {
      if (!error.message?.includes('User cancelled')) {
        console.warn('Error picking image from gallery:', error);
      }
      isProcessingRef.current = false;
      setIsScanning(true);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* ══ Header ══ */}
      <View style={styles.header}>
        <Pressable
          accessibilityLabel="Back to home"
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          onPress={onBack}
          style={styles.backButton}
        >
          <Ionicons name="chevron-back" size={26} color="#FFFFFF" />
        </Pressable>

        <Text style={styles.headerTitle}>Scan QR Code</Text>

        <Pressable
          accessibilityLabel="Toggle torch"
          onPress={() => setTorchOn(!torchOn)}
          style={styles.torchHeaderButton}
        >
          <Ionicons
            name={torchOn ? 'flash' : 'flash-outline'}
            size={22}
            color={torchOn ? '#FBBF24' : '#FFFFFF'}
          />
        </Pressable>
      </View>

      {/* ══ Camera & Scanner Frame ══ */}
      <View style={styles.cameraContainer}>
        {hasCameraPermission === false ? (
          <View style={styles.permissionContainer}>
            <Ionicons name="camera-outline" size={48} color="#94A3B8" />
            <Text style={styles.permissionText}>
              Camera permission is required to scan QR codes.
            </Text>
            <Pressable
              onPress={requestCameraPermission}
              style={styles.grantButton}
            >
              <Text style={styles.grantButtonText}>Grant Permission</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.cameraWrapper}>
            <Camera
              cameraType={CameraType.Back}
              scanBarcode={isScanning}
              onReadCode={(event: any) =>
                handleBarcodeScanned(event.nativeEvent.codeStringValue)
              }
              torchMode={torchOn ? 'on' : 'off'}
              style={StyleSheet.absoluteFill}
            />

            {/* Dark overlay with transparent center window */}
            <View style={styles.overlay}>
              <View style={styles.scanFrame}>
                {/* Corner markers */}
                <View style={[styles.corner, styles.cornerTL]} />
                <View style={[styles.corner, styles.cornerTR]} />
                <View style={[styles.corner, styles.cornerBL]} />
                <View style={[styles.corner, styles.cornerBR]} />

                {/* Animated laser line */}
                {isScanning && (
                  <Animated.View
                    style={[
                      styles.scanLine,
                      {
                        transform: [{ translateY: scanLineAnim }],
                      },
                    ]}
                  />
                )}
              </View>
            </View>
          </View>
        )}
      </View>

      <Text style={styles.instructionText}>
        Align the QR code within the frame
      </Text>

      {/* ══ Bottom Controls ══ */}
      <View style={styles.bottomControls}>
        <Pressable
          accessibilityLabel="Scan from gallery"
          onPress={handlePickFromGallery}
          style={styles.controlButton}
        >
          <View style={styles.iconCircle}>
            <Ionicons name="images-outline" size={24} color="#FFFFFF" />
          </View>
          <Text style={styles.controlLabel}>Gallery</Text>
        </Pressable>

        <Pressable
          accessibilityLabel="Toggle flash"
          onPress={() => setTorchOn(!torchOn)}
          style={styles.controlButton}
        >
          <View style={[styles.iconCircle, torchOn && styles.iconCircleActive]}>
            <Ionicons
              name={torchOn ? 'flashlight' : 'flashlight-outline'}
              size={24}
              color={torchOn ? '#2563EB' : '#FFFFFF'}
            />
          </View>
          <Text style={styles.controlLabel}>
            {torchOn ? 'Torch On' : 'Torch'}
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0D1119',
  },
  header: {
    height: 60,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  torchHeaderButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cameraContainer: {
    height: 390,
    marginHorizontal: 20,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: '#1E293B',
    marginTop: 10,
  },
  cameraWrapper: {
    flex: 1,
    position: 'relative',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scanFrame: {
    width: 220,
    height: 220,
    borderWidth: 2,
    borderColor: 'rgba(37, 114, 255, 0.4)',
    borderRadius: 20,
    position: 'relative',
    overflow: 'hidden',
  },
  corner: {
    position: 'absolute',
    width: 24,
    height: 24,
    borderColor: '#2572FF',
  },
  cornerTL: {
    top: 0,
    left: 0,
    borderTopWidth: 4,
    borderLeftWidth: 4,
    borderTopLeftRadius: 18,
  },
  cornerTR: {
    top: 0,
    right: 0,
    borderTopWidth: 4,
    borderRightWidth: 4,
    borderTopRightRadius: 18,
  },
  cornerBL: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
    borderBottomLeftRadius: 18,
  },
  cornerBR: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 4,
    borderRightWidth: 4,
    borderBottomRightRadius: 18,
  },
  scanLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: '#3280FF',
    shadowColor: '#3280FF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 8,
  },
  instructionText: {
    color: '#94A3B8',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 20,
  },
  bottomControls: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingHorizontal: 40,
    marginTop: 36,
  },
  controlButton: {
    alignItems: 'center',
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  iconCircleActive: {
    backgroundColor: '#EFF6FF',
    borderColor: '#2563EB',
  },
  controlLabel: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '500',
    marginTop: 8,
  },
  permissionContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  permissionText: {
    color: '#94A3B8',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 12,
  },
  grantButton: {
    marginTop: 18,
    backgroundColor: '#2563EB',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  grantButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
});
