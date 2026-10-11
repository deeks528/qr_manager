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
      await UPIPaymentService.openUPIPayment(parsedUPI);
    } catch (error: any) {
      Alert.alert(
        'Payment Failed',
        error.message || 'Could not launch UPI application.',
      );
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* ══ Header (Fixed) ══ */}
      <View style={styles.header}>
        {quickProfilesQuery.isLoading ? (
          <HeaderSkeleton />
        ) : (
          <>
            <View style={styles.headerProfiles}>
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
                <Text style={styles.addButtonText}>+</Text>
              </Pressable>
            </View>

            <Pressable
              accessibilityLabel="Open settings"
              accessibilityHint="Opens the application settings"
              onPress={onGoToSettings}
              style={styles.settingsButton}
            >
              <Ionicons name="settings-sharp" size={17} color="#0F172A" />
            </Pressable>
          </>
        )}
      </View>

      {/* ══ Non-scrolling Main Container ══ */}
      <View style={styles.mainContainer}>
        {/* ══ QR Preview Card (Fixed) ══ */}
        <View style={styles.previewSection}>
          {settingsQuery.isLoading || defaultProfileQuery.isLoading ? (
            <View style={styles.card}>
              <PreviewSkeleton />
            </View>
          ) : selectedProfile ? (
            <View style={styles.card}>
              <QRPreview
                initialPayload={
                  useInitialPayload && selectedProfile.id === defaultProfileQuery.data?.id
                    ? initialDefaultPayload
                    : undefined
                }
                profile={selectedProfile}
                runtimeAmount={runtimeAmount}
                size={204}
              />

              <Text style={styles.profileName}>{selectedProfile.nickname}</Text>
              <Text style={styles.profileMeta}>{getProfileMeta(selectedProfile)}</Text>

              {selectedProfile.type === ProfileType.UPI && (
                <>
                  <View style={styles.amountRow}>
                    <Text style={styles.amountLabel}>Amount ₹</Text>
                    <TextInput
                      accessibilityLabel="Runtime amount"
                      accessibilityHint="Temporarily regenerates the UPI QR amount"
                      keyboardType="decimal-pad"
                      onChangeText={setRuntimeAmountText}
                      placeholder="0"
                      placeholderTextColor="#94A3B8"
                      style={styles.amountInput}
                      value={runtimeAmountText}
                    />
                    <Pressable
                      accessibilityLabel="Pay now"
                      onPress={handlePay}
                      style={styles.editButton}
                    >
                      <Text >{'>'}</Text>
                    </Pressable>
                  </View>
                </>
              )}

              <View style={styles.actionsRow}>
                <Pressable
                  accessibilityLabel="Edit profile"
                  accessibilityHint="Opens this profile for editing"
                  disabled={isActionPending}
                  onPress={() => onEditProfile(selectedProfile)}
                  style={styles.editButton}
                >
                  <Text style={styles.editButtonText}>Edit</Text>
                </Pressable>

                <Pressable
                  accessibilityLabel="Set as default profile"
                  accessibilityHint="Makes this profile open first on startup"
                  disabled={isDefaultSelected || isActionPending}
                  onPress={handleSetDefault}
                  style={[
                    styles.defaultButton,
                    isDefaultSelected
                      ? styles.defaultButtonActive
                      : styles.defaultButtonInactive,
                  ]}
                >
                  <Text
                    style={[
                      styles.defaultButtonText,
                      isDefaultSelected && styles.defaultButtonTextActive,
                    ]}
                  >
                    {isDefaultSelected ? '✓ Default' : 'Set as Default'}
                  </Text>
                </Pressable>
              </View>

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

        {/* ══ Profiles List Section (Scrollable within card) ══ */}
        <View style={styles.listSection}>
          <Text style={styles.sectionTitle}>Profiles</Text>
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
                  const isDefault = settingsQuery.data?.defaultProfileId === profile.id;
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
                      <View
                        style={[
                          styles.listAvatar,
                          { backgroundColor: profile.avatarColor },
                        ]}
                      >
                        <Text style={styles.listAvatarText}>
                          {AvatarService.createInitials(profile.nickname)}
                        </Text>
                      </View>

                      <View style={styles.profileText}>
                        <Text style={styles.rowName}>{profile.nickname}</Text>
                        <Text style={styles.rowMeta}>{getListProfileMeta(profile)}</Text>
                      </View>

                      <View style={styles.rowRight}>
                        {isDefault && <Text style={styles.defaultBadge}>Default</Text>}
                        <Text style={styles.chevron}>›</Text>
                      </View>
                    </Pressable>
                  );
                })}
              </ScrollView>
            )}
          </View>
        </View>
      </View>

      {/* ══ Bottom Navigation Bar ══ */}
      <View style={styles.bottomNav}>
        <Pressable
          accessibilityLabel="Home tab"
          style={styles.navItem}
        >
          <Ionicons name="home" size={22} color="#2563EB" />
          <Text style={[styles.navText, styles.navTextActive]}>Home</Text>
        </Pressable>

        <Pressable
          accessibilityLabel="Create profile tab"
          onPress={onCreateProfile}
          style={styles.navItem}
        >
          <Ionicons name="add-circle-outline" size={23} color="#64748B" />
          <Text style={styles.navText}>Create</Text>
        </Pressable>

        <Pressable
          accessibilityLabel="Scan QR tab"
          onPress={onScanQR}
          style={styles.navItem}
        >
          <Ionicons name="qr-code-outline" size={22} color="#64748B" />
          <Text style={styles.navText}>Scan QR</Text>
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
        styles.headerAvatar,
        { backgroundColor: profile.avatarColor },
        selected && styles.selectedHeaderAvatar,
      ]}
    >
      <Text style={styles.headerAvatarText}>
        {AvatarService.createInitials(profile.nickname)}
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
    backgroundColor: '#F8FAFC',
  },
  header: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerProfiles: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  headerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectedHeaderAvatar: {
    borderWidth: 2.5,
    borderColor: '#0F172A',
  },
  headerAvatarText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  addButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#FFFFFF',
  },
  addButtonText: {
    color: '#64748B',
    fontSize: 20,
    lineHeight: 22,
    fontWeight: '300',
  },
  settingsButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mainContainer: {
    flex: 1,
  },
  previewSection: {
    paddingHorizontal: 14,
    paddingTop: 8,
    paddingBottom: 4,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 12,
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  profileName: {
    marginTop: 8,
    color: '#0F172A',
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'center',
  },
  profileMeta: {
    marginTop: 2,
    color: '#64748B',
    fontSize: 12,
    textAlign: 'center',
  },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
    height: 46,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    paddingHorizontal: 12,
    alignSelf: 'stretch',
  },
  amountLabel: {
    color: '#64748B',
    fontSize: 13,
    fontWeight: '600',
  },
  amountInput: {
    flex: 1,
    borderWidth: 0,
    backgroundColor: 'transparent',
    fontSize: 15,
    fontWeight: '600',
    color: '#0F172A',
    paddingVertical: 0,
    paddingHorizontal: 4,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
    alignSelf: 'stretch',
  },
  editButton: {
    flex: 1,
    height: 36,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  editButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#0F172A',
  },
  defaultButton: {
    flex: 1,
    height: 36,
    borderWidth: 1,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  defaultButtonActive: {
    borderColor: '#2563EB',
    backgroundColor: '#EFF6FF',
  },
  defaultButtonInactive: {
    borderColor: '#CBD5E1',
    backgroundColor: '#FFFFFF',
  },
  defaultButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#0F172A',
  },
  defaultButtonTextActive: {
    color: '#2563EB',
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
    paddingVertical: 20,
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
    borderRadius: 8,
    backgroundColor: '#2563EB',
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
    paddingHorizontal: 14,
    paddingTop: 4,
    paddingBottom: 12,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '600',
    color: '#94A3B8',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  listCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
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
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  selectedProfileRow: {
    backgroundColor: '#EFF6FF',
  },
  profileRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  listAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  listAvatarText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  profileText: {
    flex: 1,
    minWidth: 0,
  },
  rowName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0F172A',
  },
  rowMeta: {
    marginTop: 1,
    fontSize: 11,
    color: '#94A3B8',
  },
  rowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  defaultBadge: {
    color: '#2563EB',
    fontSize: 11,
    fontWeight: '600',
  },
  chevron: {
    color: '#CBD5E1',
    fontSize: 16,
    lineHeight: 18,
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
    width: 204,
    height: 204,
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
  bottomNav: {
    height: 60,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  navItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
  },
  navText: {
    fontSize: 11,
    fontWeight: '500',
    color: '#64748B',
    marginTop: 2,
  },
  navTextActive: {
    color: '#2563EB',
    fontWeight: '700',
  },
});
