import React, { useEffect, useMemo, useRef, useState } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import {
  SafeAreaView,
  StyleSheet,
  Text,
  Animated,
  View,
  AccessibilityInfo,
  Easing,
  BackHandler,
  Linking,
} from 'react-native';
import { Splash } from '@app/components/Splash';

import { createAppDependencies, AppDependencies } from '@app/bootstrap/createAppDependencies';
import { createQueryClient } from '@app/providers/createQueryClient';
import { DependenciesProvider } from '@app/providers/DependenciesProvider';
import { HomeScreen } from '@features/home';
import { CreateProfileScreen, EditProfileScreen } from '@features/profile';
import { SettingsScreen } from '@features/settings';
import { ScanQRScreen } from '@features/scan';
import { PaymentDetailsScreen } from '@features/payment';
import { Profile } from '@domain/models/Profile';
import { ParsedUPI } from '@domain/models/ParsedUPI';
import { UPIParser } from '@domain/services/UPIParser';
import { AppLogger } from '@domain/services/AppLogger';
import { AppStartupManager } from '@app/bootstrap/AppStartupManager';
import { MMKVStartupCache } from '@database/native/MMKVStartupCache';

export function App(): React.JSX.Element {
  const queryClient = useMemo(() => createQueryClient(), []);
  const [dependencies, setDependencies] = useState<AppDependencies | null>(null);
  const [startupError, setStartupError] = useState<string | null>(null);
  const [cacheLoaded, setCacheLoaded] = useState(false);
  const [cachedDefaultProfileId, setCachedDefaultProfileId] = useState<string | null | undefined>(undefined);
  const [initialDefaultProfile, setInitialDefaultProfile] = useState<Profile | null | undefined>(undefined);
  const [initialDefaultPayload, setInitialDefaultPayload] = useState<string | null | undefined>(undefined);
  const [readyToRender, setReadyToRender] = useState(false);
  const [currentScreen, setCurrentScreen] = useState<
    'home' | 'createProfile' | 'editProfile' | 'settings' | 'scanQR' | 'paymentDetails'
  >('home');
  const [editingProfile, setEditingProfile] = useState<Profile | null>(null);
  const [scannedUPI, setScannedUPI] = useState<ParsedUPI | null>(null);
  const [isScannedFromGallery, setIsScannedFromGallery] = useState(false);
  const [currentScanId, setCurrentScanId] = useState<string | null>(null);
  const splashOpacity = useRef(new Animated.Value(1)).current;
  const homeOpacity = useRef(new Animated.Value(0)).current;
  const [showSplash, setShowSplash] = useState(true);
  const [reduceMotionEnabled, setReduceMotionEnabled] = useState<boolean | null>(null);
  const [selectProfileId, setSelectProfileId] = useState<Profile | null>(null);
  const handledInitialUrlRef = useRef(false);

  useEffect(() => {
    let isMounted = true;

    // We can show "Loading profiles..." early if MMKV is available
    // Initialize logger
    AppLogger.init();

    (async () => {
      const startupCache = new MMKVStartupCache();
      const result = await AppStartupManager.performStartup(startupCache, createAppDependencies);
      if (!isMounted) return;

      if (result.error) {
        AppLogger.error('App', 'Startup error occurred', result.error);
        setStartupError(result.error.message);
        return;
      }

      setCachedDefaultProfileId(result.cachedDefaultProfileId);
      setDependencies(result.dependencies);
      setInitialDefaultProfile(result.initialDefaultProfile);
      setInitialDefaultPayload(result.initialDefaultPayload);
      setReadyToRender(true);
    })();

    return () => {
      isMounted = false;
    };
  }, []);


  useEffect(() => {
    // Respect user preference for reduced motion
    AccessibilityInfo.isReduceMotionEnabled().then((enabled) => setReduceMotionEnabled(enabled));
  }, []);


  useEffect(() => {
    if (!readyToRender) return;

    const duration = 400; // medium
    const easing = Easing.inOut(Easing.ease);

    if (reduceMotionEnabled) {
      // Skip animations for users who prefer reduced motion
      splashOpacity.setValue(0);
      homeOpacity.setValue(1);
      setShowSplash(false);
      return;
    }

    Animated.parallel([
      Animated.timing(splashOpacity, { toValue: 0, duration, easing, useNativeDriver: true }),
      Animated.timing(homeOpacity, { toValue: 1, duration, easing, useNativeDriver: true }),
    ]).start(() => {
      setShowSplash(false);
    });
  }, [readyToRender, splashOpacity, homeOpacity, reduceMotionEnabled]);

  useEffect(() => {
    const onBackPress = () => {
      if (currentScreen === 'paymentDetails') {
        setCurrentScreen('scanQR');
        return true;
      }
      if (currentScreen === 'scanQR') {
        setScannedUPI(null);
        setCurrentScreen('home');
        return true;
      }
      if (
        currentScreen === 'createProfile' ||
        currentScreen === 'editProfile' ||
        currentScreen === 'settings'
      ) {
        setCurrentScreen('home');
        return true;
      }
      // On 'home', allow default behavior (exit app)
      return false;
    };

    const sub = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => sub.remove();
  }, [currentScreen]);

  // Handle widget deep link shortcuts
  useEffect(() => {
    const handleUrl = async (url: string | null) => {
      if (!url) return;
      console.log('Widget shortcut / deep link received:', url);

      const lower = url.toLowerCase();

      if (lower.includes('scan')) {
        setScannedUPI(null);
        setCurrentScreen('scanQR');
        return;
      }

      if (lower.includes('profile/default') || lower.includes('settings')) {
        if (lower.includes('settings')) {
          setCurrentScreen('settings');
          return;
        }
        if (initialDefaultProfile) {
          setSelectProfileId(initialDefaultProfile);
          setCurrentScreen('home');
        } else if (dependencies) {
          try {
            const s = await dependencies.settingsRepository.getSettings();
            if (s.defaultProfileId) {
              const p = await dependencies.profileRepository.getProfile(s.defaultProfileId);
              if (p) {
                setSelectProfileId(p);
                setCurrentScreen('home');
              } else {
                setCurrentScreen('settings');
              }
            } else {
              // No default profile set -> guide user to settings
              setCurrentScreen('settings');
            }
          } catch {
            setCurrentScreen('home');
          }
        }
      }
    };

    if (!handledInitialUrlRef.current) {
      handledInitialUrlRef.current = true;
      Linking.getInitialURL().then(handleUrl);
    }

    const subscription = Linking.addEventListener('url', (event) => {
      handleUrl(event.url);
    });

    return () => subscription.remove();
  }, [dependencies, initialDefaultProfile]);

  if (startupError) {
    return (
      <SafeAreaView style={styles.centered}>
        <Text style={styles.title}>Startup failed</Text>
        <Text style={styles.message}>{startupError}</Text>
      </SafeAreaView>
    );
  }
  return (
    <View style={{ flex: 1 }}>
      {/* Splash overlay */}
      {showSplash && (
        <Animated.View style={[StyleSheet.absoluteFill, { opacity: splashOpacity }]} pointerEvents={readyToRender ? 'none' : 'auto'}>
          <Splash subtitle={cacheLoaded ? 'Loading profiles...' : 'Starting up...'} />
        </Animated.View>
      )}

      {/* Main app (fades in) */}
      <Animated.View style={{ flex: 1, opacity: homeOpacity }} pointerEvents={showSplash ? 'none' : 'auto'}>
        {dependencies ? (
          <QueryClientProvider client={queryClient}>
            <DependenciesProvider dependencies={dependencies}>
              {currentScreen === 'home' && (
                <HomeScreen
                  onCreateProfile={() => setCurrentScreen('createProfile')}
                  onEditProfile={(profile) => {
                    setEditingProfile(profile);
                    setCurrentScreen('editProfile');
                  }}
                  onGoToSettings={() => setCurrentScreen('settings')}
                  onScanQR={() => setCurrentScreen('scanQR')}
                  initialDefaultProfile={initialDefaultProfile}
                  initialDefaultPayload={initialDefaultPayload}
                  selectProfileId={selectProfileId}
                />
              )}
              {currentScreen === 'scanQR' && (
                <ScanQRScreen
                  onBack={() => {
                    setScannedUPI(null);
                    setIsScannedFromGallery(false);
                    setCurrentScanId(null);
                    setCurrentScreen('home');
                  }}
                  onScanSuccess={(rawPayload, isFromGallery, scanId) => {
                    const parsed = UPIParser.parse(rawPayload);
                    setIsScannedFromGallery(Boolean(isFromGallery));
                    setCurrentScanId(scanId ?? null);
                    setScannedUPI(parsed);
                    setCurrentScreen('paymentDetails');
                  }}
                />
              )}
              {currentScreen === 'paymentDetails' && scannedUPI && (
                <PaymentDetailsScreen
                  parsedUPI={scannedUPI}
                  isFromGallery={isScannedFromGallery}
                  scanId={currentScanId ?? undefined}
                  onBack={() => {
                    setCurrentScanId(null);
                    setCurrentScreen('scanQR');
                  }}
                  onHome={() => {
                    setScannedUPI(null);
                    setIsScannedFromGallery(false);
                    setCurrentScanId(null);
                    setCurrentScreen('home');
                  }}
                  onGoToSettings={() => setCurrentScreen('settings')}
                />
              )}
              {currentScreen === 'createProfile' && (
                <CreateProfileScreen
                  onCancel={() => setCurrentScreen('home')}
                  onSaved={(profile) => {
                    setSelectProfileId(profile);
                    setCurrentScreen('home');
                  }}
                />
              )}
              {currentScreen === 'editProfile' && editingProfile && (
                <EditProfileScreen
                  profile={editingProfile}
                  onCancel={() => setCurrentScreen('home')}
                  onDelete={() => setCurrentScreen('home')}
                  onSaved={(profile) => {
                    setEditingProfile(profile);
                    setSelectProfileId(profile);
                    setCurrentScreen('home');
                  }}
                />
              )}
              {currentScreen === 'settings' && (
                <SettingsScreen onBack={() => setCurrentScreen('home')} />
              )}
            </DependenciesProvider>
          </QueryClientProvider>
        ) : (
          // Render an empty SafeArea to preserve layout while dependencies load
          <SafeAreaView style={styles.centered}>
            <Text style={styles.title}>QR Profile Manager</Text>
            <Text style={styles.message}>{cacheLoaded ? 'Loading profiles...' : 'Starting up...'}</Text>
          </SafeAreaView>
        )}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#F8FAFC',
  },
  title: {
    color: '#0F172A',
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
  },
  message: {
    marginTop: 8,
    color: '#475569',
    fontSize: 15,
    textAlign: 'center',
  },
});


export default App;