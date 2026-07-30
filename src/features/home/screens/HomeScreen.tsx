import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, SafeAreaView, StyleSheet, Text, TextInput, View, ScrollView, Image } from 'react-native';
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

interface HomeScreenProps {
  onCreateProfile: () => void;
  onEditProfile: (profile: Profile) => void;
  onGoToSettings: () => void;
  initialDefaultProfile?: Profile | null;
  initialDefaultPayload?: string | null;
  selectProfileId?: Profile | null;
}

export function HomeScreen({ onCreateProfile, onEditProfile, onGoToSettings, initialDefaultProfile, initialDefaultPayload, selectProfileId }: HomeScreenProps): React.JSX.Element {
  const settingsQuery = useSettings();
  const defaultProfileQuery = useDefaultProfile(
    settingsQuery.data?.defaultProfileId ?? null,
    initialDefaultProfile,
  );
  const quickProfilesQuery = useQuickProfiles();
  const profilesQuery = useProfiles();
  const setDefaultProfile = useSetDefaultProfile();
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(selectProfileId?.id ?? null);
  const [runtimeAmountText, setRuntimeAmountText] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);
  const runtimeAmount = parseRuntimeAmount(runtimeAmountText);
  const profiles = profilesQuery.data ?? [];
  const settings = settingsQuery.data

  const fallbackProfileId = defaultProfileQuery.data?.id ?? settingsQuery.data?.defaultProfileId ?? profiles[0]?.id ?? null;

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

  const isDefaultSelected = Boolean(selectedProfile && settingsQuery.data?.defaultProfileId === selectedProfile.id);
  const isActionPending = setDefaultProfile.isPending;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        {quickProfilesQuery.isLoading ? (
          <HeaderSkeleton />
        ) : (
          <>
            <View style={styles.headerProfiles}>
                {(profiles.slice(0, settings.maxHeaderProfiles ?? 4) ?? []).map((profile) => (
                  <AvatarChip
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
              <Ionicons name="settings-sharp" size={24} color="#0F172A" />
            </Pressable>
          </>
        )}
      </View>

      <View style={styles.preview}>
        {settingsQuery.isLoading || defaultProfileQuery.isLoading ? (
          <PreviewSkeleton />
        ) : selectedProfile ? (
          <>
            {selectedProfile.type === ProfileType.Other ? (
              <>
              <Image
                source = {{ uri: selectedProfile.imagePath }}
                style={styles.image}
                resizeMode="contain"
              />
              </>
            ):(
              <QRPreview profile={selectedProfile} runtimeAmount={runtimeAmount} initialPayload={useInitialPayload && selectedProfile.id === defaultProfileQuery.data?.id ? initialDefaultPayload : undefined} />
            )}
            <Text style={styles.profileName}>{selectedProfile.nickname}</Text>
            <Text style={styles.profileMeta}>{getProfileMeta(selectedProfile)}</Text>
            {selectedProfile.type === ProfileType.UPI && (
              <View style={styles.amountEditor}>
                <Text style={styles.amountLabel}>Amount</Text>
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
              </View>
            )}
            <View style={styles.actionsRow}>
              <Pressable
                accessibilityLabel="Edit profile"
                accessibilityHint="Opens this profile for editing"
                disabled={isActionPending}
                onPress={() => onEditProfile(selectedProfile)}
                style={[styles.hide, styles.actionButton, isActionPending && styles.disabledActionButton]}
              >
                <Text style={[styles.actionButtonText, isActionPending && styles.disabledActionButtonText]}>Edit</Text>
              </Pressable>
              <Pressable
                accessibilityLabel="Set as default profile"
                accessibilityHint="Makes this profile open first on startup"
                disabled={isDefaultSelected || isActionPending}
                onPress={handleSetDefault}
                style={[styles.actionButton, (isDefaultSelected || isActionPending) && styles.disabledActionButton]}
              >
                <Text style={[styles.actionButtonText, (isDefaultSelected || isActionPending) && styles.disabledActionButtonText]}>
                  {isDefaultSelected ? 'Default' : 'Set as Default'}
                </Text>
              </Pressable>
            </View>
            {actionError && <Text style={styles.actionError}>{actionError}</Text>}
          </>
        ) : (
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
        )}
      </View>

      <View style={styles.listSection}>
        <Text style={styles.sectionTitle}>Profiles</Text>
        <ScrollView
          showsVerticalScrollIndicator={true}
        >
            {profilesQuery.isLoading ? (
              <ListSkeleton />
            ) : (
              profiles.map((profile) => (
                <Pressable
                  accessibilityLabel={`${profile.nickname} profile`}
                  accessibilityHint="Shows this profile in the preview"
                  key={profile.id}
                  onPress={() => handleSelectProfile(profile.id)}
                  onLongPress={() => onEditProfile(profile)}
                  delayLongPress={500}
                  style={[styles.profileRow, profile.id === selectedProfile?.id && styles.selectedProfileRow]}
                >
                  <AvatarChip profile={profile} selected={profile.id === selectedProfile?.id} />
                  <View style={styles.profileText}>
                    <Text style={styles.rowName}>{profile.nickname}</Text>
                    <Text style={styles.rowMeta}>{getProfileMeta(profile)}</Text>
                  </View>
                  {settingsQuery.data?.defaultProfileId === profile.id && <Text style={styles.defaultBadge}>Default</Text>}
                </Pressable>
              ))
            )}
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

interface AvatarChipProps {
  profile: Profile;
  selected?: boolean;
  onPress?: () => void;
}

function AvatarChip({ profile, selected = false, onPress }: AvatarChipProps): React.JSX.Element {
  const content = (
    <View style={[styles.avatar, { backgroundColor: profile.avatarColor }, selected && styles.selectedAvatar]}>
      <Text style={styles.avatarText}>{AvatarService.createInitials(profile.nickname)}</Text>
    </View>
  );

  if (!onPress) {
    return content;
  }

  return (
    <Pressable
      accessibilityLabel={`${profile.nickname} quick profile`}
      accessibilityHint="Shows this profile in the preview"
      onPress={onPress}
      style={styles.avatarButton}
    >
      {content}
    </Pressable>
  );
}

function HeaderSkeleton(): React.JSX.Element {
  return (
    <>
      <View style={styles.skeletonCircle} />
      <View style={styles.skeletonCircle} />
      <View style={styles.skeletonCircle} />
    </>
  );
}

function PreviewSkeleton(): React.JSX.Element {
  return (
    <>
      <View style={styles.skeletonQr} />
      <View style={styles.skeletonLineWide} />
      <View style={styles.skeletonLine} />
    </>
  );
}

function ListSkeleton(): React.JSX.Element {
  return (
    <>
      <View style={styles.skeletonRow} />
      <View style={styles.skeletonRow} />
      <View style={styles.skeletonRow} />
    </>
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

 if (profile.type === ProfileType.Custom)
   return `${profile.text.slice(0,10)}${profile.text.length>10 ? '...' : ''}`

  return 'Imported QR';
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    padding: 16,
  },
  hide: {
    display: 'none',
  },
  header: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    justifyContent: 'space-between',
  },
  headerProfiles: {
      minHeight: 56,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
  },
  avatarButton: {
    minWidth: 48,
    minHeight: 48,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectedAvatar: {
    borderWidth: 3,
    borderColor: '#0F172A',
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  addButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#FFFFFF',
  },
  settingsButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButtonText: {
    color: '#0F172A',
    fontSize: 24,
    lineHeight: 28,
  },
  settingsButtonText: {
    fontSize: 20,
    lineHeight: 24,
  },
  preview: {
    minHeight: 450,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 24,
  },
  profileName: {
    marginTop: 16,
    color: '#0F172A',
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
  },
  profileMeta: {
    marginTop: 6,
    color: '#475569',
    fontSize: 15,
    textAlign: 'center',
  },
  amountEditor: {
    width: '100%',
    maxWidth: 220,
    marginTop: 16,
  },
  amountLabel: {
    marginBottom: 6,
    color: '#334155',
    fontSize: 13,
    fontWeight: '700',
  },
  amountInput: {
    minHeight: 48,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#FFFFFF',
    color: '#0F172A',
    fontSize: 16,
    paddingHorizontal: 12,
  },
  actionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    justifyContent: 'center',
    marginTop: 16,
  },
  actionButton: {
    minHeight: 48,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14,
  },
  actionButtonText: {
    color: '#334155',
    fontSize: 14,
    fontWeight: '700',
  },
  disabledActionButton: {
    backgroundColor: '#E2E8F0',
  },
  disabledActionButtonText: {
    color: '#64748B',
  },
  destructiveButton: {
    minHeight: 48,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#DC2626',
    paddingHorizontal: 14,
  },
  destructiveButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  actionError: {
    marginTop: 10,
    color: '#DC2626',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  emptyState: {
    alignItems: 'center',
  },
  emptyTitle: {
    color: '#0F172A',
    fontSize: 22,
    fontWeight: '700',
  },
  emptyBody: {
    marginTop: 6,
    color: '#475569',
    fontSize: 15,
  },
  emptyButton: {
    minHeight: 48,
    marginTop: 18,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2563EB',
    paddingHorizontal: 18,
  },
  emptyButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  listSection: {
    flex: 1,
  },
  sectionTitle: {
    marginBottom: 12,
    color: '#0F172A',
    fontSize: 18,
    fontWeight: '700',
    borderBottomWidth: 1,
    borderBottomColor: '#CBD5E1',
  },
  profileRow: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  selectedProfileRow: {
    backgroundColor: '#EFF6FF',
  },
  profileText: {
    flex: 1,
  },
  rowName: {
    color: '#0F172A',
    fontSize: 16,
    fontWeight: '600',
  },
  rowMeta: {
    marginTop: 2,
    color: '#64748B',
    fontSize: 13,
  },
  defaultBadge: {
    color: '#2563EB',
    fontSize: 12,
    fontWeight: '700',
  },
  skeletonCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#E2E8F0',
  },
  skeletonQr: {
    width: 220,
    height: 220,
    borderRadius: 8,
    backgroundColor: '#E2E8F0',
  },
  skeletonLineWide: {
    width: 180,
    height: 18,
    marginTop: 16,
    borderRadius: 4,
    backgroundColor: '#E2E8F0',
  },
  skeletonLine: {
    width: 120,
    height: 14,
    marginTop: 8,
    borderRadius: 4,
    backgroundColor: '#E2E8F0',
  },
  skeletonRow: {
    height: 56,
    marginBottom: 8,
    borderRadius: 8,
    backgroundColor: '#E2E8F0',
  },
  image: {
    width: 240,
    height: 240,
    alignSelf: "center",
  },
});
