import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View,
  ScrollView,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';

import { useSettings } from '@features/settings';
import {
  useDefaultProfile,
  useProfiles,
  useQuickProfiles,
  useSetDefaultProfile,
} from '@features/home/hooks/useHomeProfiles';
import { Profile, ProfileType } from '@domain/models/Profile';
import { AvatarService } from '@domain/services/AvatarService';
import { QRPreview } from '@features/home/components/QRPreview';
import { UPIPaymentService } from '@domain/services/UPIPaymentService';
import { UPIParser } from '@domain/services/UPIParser';
import { QRPayloadService } from '@domain/index';
import { AppLogger } from '@domain/services/AppLogger';

interface HomeScreenProps {
  onCreateProfile: () => void;
  onEditProfile: (profile: Profile) => void;
  onGoToSettings: () => void;
  onScanQR: () => void;
  initialDefaultProfile?: Profile | null;
  initialDefaultPayload?: string | null;
  selectProfileId?: Profile | null;
}

export function HomeScreen({
  onCreateProfile,
  onEditProfile,
  onGoToSettings,
  onScanQR,
  initialDefaultProfile,
  initialDefaultPayload,
  selectProfileId,
}: HomeScreenProps): React.JSX.Element {
  const settingsQuery = useSettings();
  const defaultProfileQuery = useDefaultProfile(
    settingsQuery.data?.defaultProfileId ?? null,
    initialDefaultProfile,
  );
  const quickProfilesQuery = useQuickProfiles();
  const profilesQuery = useProfiles();
  const setDefaultProfile = useSetDefaultProfile();
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(
    selectProfileId?.id ?? null,
  );
  const [runtimeAmountText, setRuntimeAmountText] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);
  const runtimeAmount = parseRuntimeAmount(runtimeAmountText);
  const profiles = profilesQuery.data ?? [];
  const settings = settingsQuery.data;

  const fallbackProfileId =
    defaultProfileQuery.data?.id ??
    settingsQuery.data?.defaultProfileId ??
    profiles[0]?.id ??
    null;

  const selectedProfile = useMemo(() => {
    // 1. Try to find the explicitly selected ID in the profiles list
    const fromList = profiles.find((p) => p.id === selectedProfileId);
    if (fromList) return fromList;

    // 2. If not in list (might be stale), use the profile object passed from props
    if (selectProfileId && selectedProfileId === selectProfileId.id) {
      return selectProfileId;
    }

    // 3. Fallback to default or first available profile
    return defaultProfileQuery.data ?? profiles[0] ?? null;
  }, [profiles, selectedProfileId, selectProfileId, defaultProfileQuery.data]);

  const [useInitialPayload, setUseInitialPayload] = useState(true);

  useEffect(() => {
    setUseInitialPayload(false);
  }, [selectedProfile?.id]);

  useEffect(() => {
    // Sync internal state with the prop from App.tsx (important after creation/edit)
    if (selectProfileId?.id) {
      setSelectedProfileId(selectProfileId.id);
    }
  }, [selectProfileId?.id]);

  useEffect(() => {
    // Handle automatic selection of fallback if current is invalid
    if (!selectedProfileId && fallbackProfileId) {
      setSelectedProfileId(fallbackProfileId);
      return;
    }

    // Only reset if we are NOT using the recently selected prop
    const isRecentlySelected = selectedProfileId === selectProfileId?.id;
    const existsInList = profiles.some((p) => p.id === selectedProfileId);

    if (selectedProfileId && profiles.length > 0 && !existsInList && !isRecentlySelected) {
      setSelectedProfileId(fallbackProfileId);
    }
  }, [fallbackProfileId, profiles, selectedProfileId, selectProfileId?.id]);

  useEffect(() => {
    setRuntimeAmountText('');
    setActionError(null);
  }, [selectedProfile?.id]);

  const handleSelectProfile = (profileId: string): void => {
    setSelectedProfileId(profileId);
  };

  const handleSetDefault = (): void => {
    if (!selectedProfile) {
      return;
    }

    setActionError(null);
    setDefaultProfile.mutate(selectedProfile.id, {
      onError: (error) => setActionError(error.message),
    });
  };

  const isDefaultSelected = Boolean(
    selectedProfile && settingsQuery.data?.defaultProfileId === selectedProfile.id,
  );
  const isActionPending = setDefaultProfile.isPending;
  const maxHeaderProfiles = settings?.maxHeaderProfiles ?? 4;
  const headerProfiles = profiles.slice(0, maxHeaderProfiles);

  const handlePay = async () => {
    if (ProfileType.UPI !== selectedProfile.type)
      return;

    const parsedUPI = QRPayloadService.createUPIPayload(selectedProfile, runtimeAmount);

    try {
      console.log('Final generated UPI URI:', parsedUPI);
      AppLogger.info('HomeScreen', 'Initiating quick payment from profile', {
        nickname: selectedProfile.nickname,
        upiId: selectedProfile.upiId,
        uri: parsedUPI,
      });
      await UPIPaymentService.openUPIPayment(parsedUPI);
    } catch (error: any) {
      AppLogger.error('HomeScreen', 'Quick payment failed', error, { uri: parsedUPI });
      Alert.alert(
        'Payment Failed',
        error.message || 'Could not launch UPI application.',
      );
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* ══ Header ══ */}
      <View style={styles.header}>
        {quickProfilesQuery.isLoading ? (
          <HeaderSkeleton />
        ) : (
          <>
            <View style={styles.headerTopRow}>
              <Text style={styles.appTitle}>QR Manager</Text>
              <Pressable
                accessibilityLabel="Open settings"
                accessibilityHint="Opens the application settings"
                onPress={onGoToSettings}
                style={styles.settingsButton}
              >
                <Ionicons name="settings-outline" size={20} color="#0F172A" />
              </Pressable>
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.headerProfiles}
            >
              {headerProfiles.map((profile) => (
                <HeaderAvatarChip
                  key={profile.id}
                  onPress={() => handleSelectProfile(profile.id)}
                  profile={profile}
                  selected={profile.id === selectedProfile?.id}
                />
              ))}
              <Pressable
                accessibilityLabel="Create profile"
                accessibilityHint="Opens the create profile screen"
                onPress={onCreateProfile}
                style={styles.addButton}
              >
                <Ionicons name="add" size={18} color="#64748B" />
              </Pressable>
            </ScrollView>
          </>
        )}
      </View>

      {/* ══ Main Content Container ══ */}
      <View style={styles.mainContainer}>
        {/* ══ QR Preview Card ══ */}
        <View style={styles.previewSection}>
          {settingsQuery.isLoading || defaultProfileQuery.isLoading ? (
            <View style={styles.card}>
              <PreviewSkeleton />
            </View>
          ) : selectedProfile ? (
            <View style={styles.card}>
              {/* Card Top: Profile Name & Action Icons */}
              <View style={styles.cardHeaderRow}>
                <View style={styles.cardHeaderInfo}>
                  <Text style={styles.profileName}>{selectedProfile.nickname}</Text>
                  <Text style={styles.profileMeta}>{getProfileMeta(selectedProfile)}</Text>
                </View>
                <View style={styles.cardHeaderActions}>
                  <Pressable
                    accessibilityLabel="Set as default profile"
                    accessibilityHint="Makes this profile open first on startup"
                    disabled={isActionPending}
                    onPress={handleSetDefault}
                    style={styles.cardActionIcon}
                  >
                    <Ionicons
                      name={isDefaultSelected ? 'star' : 'star-outline'}
                      size={20}
                      color={isDefaultSelected ? '#0D6B50' : '#64748B'}
                    />
                  </Pressable>
                  <Pressable
                    accessibilityLabel="Edit profile"
                    accessibilityHint="Opens this profile for editing"
                    disabled={isActionPending}
                    onPress={() => onEditProfile(selectedProfile)}
                    style={styles.cardActionIcon}
                  >
                    <Ionicons name="ellipsis-vertical" size={19} color="#64748B" />
                  </Pressable>
                </View>
              </View>

              <View style={styles.qrContainer}>
                <QRPreview
                  initialPayload={
                    useInitialPayload && selectedProfile.id === defaultProfileQuery.data?.id
                      ? initialDefaultPayload
                      : undefined
                  }
                  profile={selectedProfile}
                  runtimeAmount={runtimeAmount}
                  size={190}
                />
              </View>

              {selectedProfile.type === ProfileType.UPI && (
                <View style={styles.amountRow}>
                  <TextInput
                    accessibilityLabel="Runtime amount"
                    accessibilityHint="Temporarily regenerates the UPI QR amount"
                    keyboardType="decimal-pad"
                    onChangeText={setRuntimeAmountText}
                    placeholder="₹ Amount (optional)"
                    placeholderTextColor="#94A3B8"
                    style={styles.amountInput}
                    value={runtimeAmountText}
                  />

                  {Boolean(runtimeAmountText) && (
                    <Pressable
                      accessibilityLabel="Clear amount"
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      onPress={() => setRuntimeAmountText('')}
                      style={styles.clearAmountButton}
                    >
                      <Ionicons name="close-circle" size={17} color="#94A3B8" />
                    </Pressable>
                  )}

                  <Pressable
                    accessibilityLabel="Pay now"
                    accessibilityHint="Opens UPI payment app with this amount"
                    onPress={handlePay}
                    style={styles.payNowButton}
                  >
                    <Text style={styles.payNowButtonText}>Pay</Text>
                  </Pressable>
                </View>
              )}

              {actionError && <Text style={styles.actionError}>{actionError}</Text>}
            </View>
          ) : (
            <View style={styles.card}>
              <View style={styles.emptyState}>
                <Text style={styles.emptyTitle}>No Profiles Yet</Text>
                <Text style={styles.emptyBody}>Create your first QR profile.</Text>
                <Pressable
                  accessibilityLabel="Create first profile"
                  accessibilityHint="Opens the create profile screen"
                  onPress={onCreateProfile}
                  style={styles.emptyButton}
                >
                  <Text style={styles.emptyButtonText}>Create Profile</Text>
                </Pressable>
              </View>
            </View>
          )}
        </View>

        {/* ══ All Profiles List Section ══ */}
        <View style={styles.listSection}>
          <View style={styles.listSectionHeader}>
            <Text style={styles.sectionTitle}>All profiles</Text>
            <Pressable
              accessibilityLabel="Create profile"
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              onPress={onCreateProfile}
            >
              <Ionicons name="add" size={20} color="#64748B" />
            </Pressable>
          </View>

          <View style={styles.listCard}>
            {profilesQuery.isLoading ? (
              <ListSkeleton />
            ) : profiles.length === 0 ? (
              <View style={styles.emptyListPadding}>
                <Text style={styles.emptyListText}>No profiles found</Text>
              </View>
            ) : (
              <ScrollView
                showsVerticalScrollIndicator={true}
                style={styles.listScrollView}
                contentContainerStyle={styles.listScrollContent}
              >
                {profiles.map((profile, index) => {
                  const isSelected = profile.id === selectedProfile?.id;
                  const isLast = index === profiles.length - 1;

                  return (
                    <Pressable
                      accessibilityLabel={`${profile.nickname} profile`}
                      accessibilityHint="Shows this profile in the preview"
                      key={profile.id}
                      onPress={() => handleSelectProfile(profile.id)}
                      onLongPress={() => onEditProfile(profile)}
                      delayLongPress={500}
                      style={[
                        styles.profileRow,
                        isSelected && styles.selectedProfileRow,
                        !isLast && styles.profileRowBorder,
                      ]}
                    >
                      <View style={styles.listAvatar}>
                        <Text style={styles.listAvatarText}>
                          {AvatarService.createInitials(profile.nickname)}
                        </Text>
                      </View>

                      <View style={styles.profileText}>
                        <Text style={styles.rowName}>{profile.nickname}</Text>
                      </View>

                      <View style={styles.rowRight}>
                        <Text style={styles.rowMeta}>{profile.type}</Text>
                      </View>
                    </Pressable>
                  );
                })}
              </ScrollView>
            )}
          </View>
        </View>
      </View>

      {/* ══ Floating Scan QR Bottom Bar ══ */}
      <View style={styles.bottomDock}>
        <Pressable
          accessibilityLabel="Scan QR"
          accessibilityHint="Opens the camera to scan a UPI QR code"
          onPress={onScanQR}
          style={styles.floatingScanButton}
        >
          <Ionicons name="scan-outline" size={20} color="#FFFFFF" />
          <Text style={styles.floatingScanText}>Scan QR</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

interface HeaderAvatarChipProps {
  profile: Profile;
  selected?: boolean;
  onPress: () => void;
}

function HeaderAvatarChip({
  profile,
  selected = false,
  onPress,
}: HeaderAvatarChipProps): React.JSX.Element {
  return (
    <Pressable
      accessibilityLabel={`${profile.nickname} quick profile`}
      accessibilityHint="Shows this profile in the preview"
      onPress={onPress}
      style={[
        styles.headerPill,
        selected ? styles.selectedHeaderPill : styles.unselectedHeaderPill,
      ]}
    >
      <Text
        style={[
          styles.headerPillText,
          selected ? styles.selectedHeaderPillText : styles.unselectedHeaderPillText,
        ]}
      >
        {profile.nickname}
      </Text>
    </Pressable>
  );
}

function HeaderSkeleton(): React.JSX.Element {
  return (
    <View style={styles.headerProfiles}>
      <View style={styles.skeletonCircle} />
      <View style={styles.skeletonCircle} />
      <View style={styles.skeletonCircle} />
      <View style={styles.skeletonCircleSmall} />
    </View>
  );
}

function PreviewSkeleton(): React.JSX.Element {
  return (
    <View style={styles.skeletonCenter}>
      <View style={styles.skeletonQr} />
      <View style={styles.skeletonLineWide} />
      <View style={styles.skeletonLine} />
      <View style={styles.skeletonButtonRow}>
        <View style={styles.skeletonButton} />
        <View style={styles.skeletonButton} />
      </View>
    </View>
  );
}

function ListSkeleton(): React.JSX.Element {
  return (
    <View style={{ padding: 12 }}>
      <View style={styles.skeletonRow} />
      <View style={styles.skeletonRow} />
      <View style={[styles.skeletonRow, { marginBottom: 0 }]} />
    </View>
  );
}

function parseRuntimeAmount(value: string): number | null {
  const trimmed = value?.trim();
  if (!trimmed) {
    return null;
  }
  const amount = Number(trimmed);
  return Number.isFinite(amount) ? amount : null;
}

function getProfileMeta(profile: Profile): string {
  if (profile.type === ProfileType.UPI) {
    return profile.upiId;
  }
  if (profile.type === ProfileType.WhatsApp) {
    return profile.mobileNumber;
  }
  if (profile.type === ProfileType.Custom) {
    return profile.text;
  }
  return 'Imported QR';
}

function getListProfileMeta(profile: Profile): string {
  if (profile.type === ProfileType.UPI) {
    return `UPI · ${profile.upiId}`;
  }
  if (profile.type === ProfileType.WhatsApp) {
    return `WhatsApp · ${profile.mobileNumber}`;
  }
  if (profile.type === ProfileType.Custom) {
    const textPreview =
      profile.text.length > 22 ? `${profile.text.slice(0, 22)}...` : profile.text;
    return `Custom · ${textPreview}`;
  }
  return 'Imported · QR Image';
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F2EDE8',
  },
  header: {
    backgroundColor: '#F2EDE8',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  appTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.5,
  },
  settingsButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerProfiles: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerPill: {
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectedHeaderPill: {
    backgroundColor: '#0D6B50',
  },
  unselectedHeaderPill: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  headerPillText: {
    fontSize: 13,
    fontWeight: '600',
  },
  selectedHeaderPillText: {
    color: '#FFFFFF',
  },
  unselectedHeaderPillText: {
    color: '#334155',
  },
  addButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#FFFFFF',
  },
  mainContainer: {
    flex: 1,
  },
  previewSection: {
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 8,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 16,
    borderWidth: 1,
    borderColor: '#EAE6E1',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  cardHeaderInfo: {
    flex: 1,
  },
  cardHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  cardActionIcon: {
    padding: 4,
  },
  profileName: {
    color: '#0F172A',
    fontSize: 16,
    fontWeight: '700',
  },
  profileMeta: {
    marginTop: 2,
    color: '#64748B',
    fontSize: 12,
  },
  qrContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
  },
  amountInput: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
    fontSize: 14,
    fontWeight: '500',
    color: '#0F172A',
    paddingHorizontal: 12,
  },
  clearAmountButton: {
    position: 'absolute',
    right: 88,
    padding: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  payNowButton: {
    height: 44,
    paddingHorizontal: 22,
    borderRadius: 12,
    backgroundColor: '#0D6B50',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0D6B50',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  payNowButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  actionError: {
    marginTop: 6,
    color: '#DC2626',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  emptyTitle: {
    color: '#0F172A',
    fontSize: 18,
    fontWeight: '700',
  },
  emptyBody: {
    marginTop: 4,
    color: '#64748B',
    fontSize: 13,
  },
  emptyButton: {
    marginTop: 14,
    borderRadius: 10,
    backgroundColor: '#0D6B50',
    paddingVertical: 10,
    paddingHorizontal: 18,
  },
  emptyButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  listSection: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 76,
  },
  listSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#475569',
  },
  listCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#EAE6E1',
    overflow: 'hidden',
  },
  listScrollView: {
    flex: 1,
  },
  listScrollContent: {
    flexGrow: 1,
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  selectedProfileRow: {
    backgroundColor: '#E6F4F0',
  },
  profileRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#F8FAFC',
  },
  listAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#E6F4F0',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  listAvatarText: {
    color: '#0D6B50',
    fontSize: 13,
    fontWeight: '700',
  },
  profileText: {
    flex: 1,
    minWidth: 0,
  },
  rowName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0F172A',
  },
  rowMeta: {
    fontSize: 12,
    color: '#64748B',
  },
  rowRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  emptyListPadding: {
    padding: 16,
    alignItems: 'center',
  },
  emptyListText: {
    color: '#94A3B8',
    fontSize: 12,
  },
  skeletonCenter: {
    alignItems: 'center',
    width: '100%',
  },
  skeletonCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#E2E8F0',
  },
  skeletonCircleSmall: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#E2E8F0',
  },
  skeletonQr: {
    width: 190,
    height: 190,
    borderRadius: 4,
    backgroundColor: '#E2E8F0',
  },
  skeletonLineWide: {
    width: 140,
    height: 16,
    marginTop: 12,
    borderRadius: 4,
    backgroundColor: '#E2E8F0',
  },
  skeletonLine: {
    width: 90,
    height: 12,
    marginTop: 6,
    borderRadius: 4,
    backgroundColor: '#E2E8F0',
  },
  skeletonButtonRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
    width: '100%',
  },
  skeletonButton: {
    flex: 1,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#E2E8F0',
  },
  skeletonRow: {
    height: 48,
    marginBottom: 8,
    borderRadius: 8,
    backgroundColor: '#E2E8F0',
  },
  bottomDock: {
    position: 'absolute',
    bottom: 20,
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  floatingScanButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#0D6B50',
    borderRadius: 24,
    paddingHorizontal: 28,
    paddingVertical: 12,
    shadowColor: '#0D6B50',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  floatingScanText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
});
