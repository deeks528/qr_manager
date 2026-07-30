import React, { useMemo, useState } from 'react';
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { useDeleteProfile } from '@features/home/hooks/useHomeProfiles';
import { Profile, ProfileType } from '@domain/models/Profile';
import { useUpdateProfile } from '@features/profile/hooks/useUpdateProfile';
import { getImage } from '../hooks/getImage';

interface EditProfileScreenProps {
  profile: Profile;
  onCancel: () => void;
  onSaved: (profile: Profile) => void;
  onDelete: () => void;
}

export function EditProfileScreen({ profile, onCancel, onSaved, onDelete }: EditProfileScreenProps): React.JSX.Element {
  const updateProfile = useUpdateProfile();
  const deleteProfile = useDeleteProfile();

  const [nickname, setNickname] = useState(profile.nickname);
  const [upiId, setUpiId] = useState(profile.type === ProfileType.UPI ? profile.upiId : '');
  const [minimumAmount, setMinimumAmount] = useState(
    profile.type === ProfileType.UPI && profile.minimumAmount !== null ? String(profile.minimumAmount) : '',
  );
  const [defaultDescription, setDefaultDescription] = useState(
    profile.type === ProfileType.UPI ? profile.defaultDescription ?? '' : '',
  );
  const [mobileNumber, setMobileNumber] = useState(profile.type === ProfileType.WhatsApp ? profile.mobileNumber : '');
  const [text, setText] = useState(profile.type === ProfileType.Custom ? profile.text : '');
  const [imagePath, setImagePath] = useState(profile.type === ProfileType.Other ? profile.imagePath : '');
  const [formError, setFormError] = useState<string | null>(null);

  const canSave = useMemo(() => {
    const hasNickname = nickname.trim().length > 0;
    const hasTypeData = profile.type !== ProfileType.Other || imagePath.trim().length > 0;
    return hasNickname && hasTypeData && !updateProfile.isPending;
  }, [nickname, updateProfile.isPending, profile.type, imagePath]);

  const isActionPending = deleteProfile.isPending || updateProfile.isPending;

  const handlePickImage = async () => {
    try {
      const path = await getImage();
      if (path) {
        setImagePath(path);
      }
    } catch (error) {
      setFormError('Failed to pick image');
    }
  };

  const handleSave = (): void => {
    setFormError(null);
    const updatedProfile = buildUpdatedProfile({
      profile,
      nickname,
      upiId,
      minimumAmount,
      defaultDescription,
      mobileNumber,
      text,
      imagePath,
    });

    updateProfile.mutate(updatedProfile, {
      onSuccess: onSaved,
      onError: (error) => setFormError(error.message),
    });
  };

  const handleDelete = (): void => {
    Alert.alert('Delete Profile', `Delete ${profile.nickname}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          setFormError(null);
          deleteProfile.mutate(profile.id, {
            onSuccess: onDelete,
            onError: (error) => setFormError(error.message),
          });
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.keyboardView}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.topBar}>
            <Pressable accessibilityLabel="Cancel edit profile" accessibilityHint="Returns to Home" onPress={onCancel} style={styles.secondaryButton}>
              <Text style={styles.secondaryButtonText}>Cancel</Text>
            </Pressable>
            <Pressable
              accessibilityLabel="Delete profile"
              accessibilityHint="Deletes this profile after confirmation"
              disabled={isActionPending}
              onPress={handleDelete}
              style={[styles.destructiveButton, isActionPending && styles.disabledActionButton]}
            >
              <Text style={styles.destructiveButtonText}>{deleteProfile.isPending ? 'Deleting' : 'Delete'}</Text>
            </Pressable>
          </View>

          <Text style={styles.title}>Edit Profile</Text>
          <View style={styles.typePill}>
            <Text style={styles.typePillText}>{getProfileTypeLabel(profile.type)}</Text>
          </View>

          <Field label="Nickname" value={nickname} onChangeText={setNickname} placeholder="Home Account" />

          {profile.type === ProfileType.UPI && (
            <>
              <Field label="UPI ID" value={upiId} onChangeText={setUpiId} placeholder="name@bank" autoCapitalize="none" />
              <Field
                label="Minimum Amount"
                value={minimumAmount}
                onChangeText={setMinimumAmount}
                placeholder="0"
                keyboardType="decimal-pad"
              />
              <Field
                label="Default Description"
                value={defaultDescription}
                onChangeText={setDefaultDescription}
                placeholder="Payment"
              />
            </>
          )}

          {profile.type === ProfileType.WhatsApp && (
            <Field
              label="Mobile Number"
              value={mobileNumber}
              onChangeText={setMobileNumber}
              placeholder="9876543210"
              keyboardType="phone-pad"
            />
          )}

          {profile.type === ProfileType.Custom && (
            <Field
              label="Text"
              value={text}
              onChangeText={setText}
              placeholder="QR content..."
              multiline
            />
          )}

          {profile.type === ProfileType.Other && (
            <View style={styles.imagePickerSection}>
              <Text style={styles.label}>Imported QR Image</Text>
              <View style={styles.imagePreviewContainer}>
                <Image source={{ uri: imagePath }} style={styles.imagePreview} resizeMode="contain" />
                <Pressable onPress={handlePickImage} style={styles.changeImageButton}>
                  <Text style={styles.changeImageButtonText}>Change Image</Text>
                </Pressable>
              </View>
            </View>
          )}

          <View style={styles.footer}>
            <Pressable
              accessibilityLabel="Save profile changes"
              accessibilityHint="Updates this QR profile"
              disabled={!canSave}
              onPress={handleSave}
              style={[styles.primaryButton, !canSave && styles.disabledButton]}
            >
              <Text style={styles.primaryButtonText}>{updateProfile.isPending ? 'Saving' : 'Save'}</Text>
            </Pressable>
          </View>

          {formError && <Text style={styles.error}>{formError}</Text>}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

interface BuildUpdatedProfileInput {
  profile: Profile;
  nickname: string;
  upiId: string;
  minimumAmount: string;
  defaultDescription: string;
  mobileNumber: string;
  text: string;
  imagePath: string;
}

function buildUpdatedProfile(input: BuildUpdatedProfileInput): Profile {
  const base = {
    ...input.profile,
    nickname: input.nickname,
  };

  if (base.type === ProfileType.UPI) {
    return {
      ...base,
      upiId: input.upiId,
      minimumAmount: input.minimumAmount.trim() ? Number(input.minimumAmount) : null,
      defaultDescription: input.defaultDescription.trim() || null,
    };
  }

  if (base.type === ProfileType.WhatsApp) {
    return {
      ...base,
      mobileNumber: input.mobileNumber,
    };
  }

  if (base.type === ProfileType.Custom) {
    return {
      ...base,
      text: input.text,
    };
  }

  if (base.type === ProfileType.Other) {
    return {
      ...base,
      imagePath: input.imagePath,
    };
  }

  return base;
}

function getProfileTypeLabel(type: ProfileType): string {
  switch (type) {
    case ProfileType.UPI: return 'UPI';
    case ProfileType.WhatsApp: return 'WhatsApp';
    case ProfileType.Custom: return 'Custom';
    case ProfileType.Other: return 'Import QR';
    default: return 'Other';
  }
}

interface FieldProps {
  label: string;
  value: string;
  placeholder: string;
  onChangeText: (value: string) => void;
  keyboardType?: 'default' | 'decimal-pad' | 'phone-pad';
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  editable?: boolean;
  multiline?: boolean;
}

function Field({
  label,
  value,
  placeholder,
  onChangeText,
  keyboardType = 'default',
  autoCapitalize = 'sentences',
  editable = true,
  multiline = false,
}: FieldProps): React.JSX.Element {
  return (
    <View style={styles.fieldGroup}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        accessibilityHint={editable ? `Enter ${label}` : `${label} is read only`}
        autoCapitalize={autoCapitalize}
        editable={editable}
        keyboardType={keyboardType}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#94A3B8"
        style={[
          styles.input,
          !editable && styles.readOnlyInput,
          multiline && { minHeight: 100, textAlignVertical: 'top' }
        ]}
        value={value}
        multiline={multiline}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  keyboardView: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  topBar: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    marginTop: 8,
    color: '#0F172A',
    fontSize: 26,
    fontWeight: '700',
  },
  typePill: {
    alignSelf: 'flex-start',
    minHeight: 32,
    marginTop: 10,
    marginBottom: 20,
    borderRadius: 8,
    justifyContent: 'center',
    backgroundColor: '#DBEAFE',
    paddingHorizontal: 12,
  },
  typePillText: {
    color: '#1D4ED8',
    fontSize: 13,
    fontWeight: '700',
  },
  fieldGroup: {
    marginBottom: 14,
  },
  label: {
    marginBottom: 6,
    color: '#334155',
    fontSize: 14,
    fontWeight: '700',
  },
  input: {
    minHeight: 48,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#FFFFFF',
    color: '#0F172A',
    fontSize: 16,
    paddingHorizontal: 12,
  },
  readOnlyInput: {
    backgroundColor: '#E2E8F0',
    color: '#475569',
  },
  footer: {
    marginTop: 8,
  },
  primaryButton: {
    minHeight: 48,
    minWidth: 88,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2563EB',
    paddingHorizontal: 16,
  },
  disabledButton: {
    backgroundColor: '#94A3B8',
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  secondaryButton: {
    minHeight: 48,
    minWidth: 88,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
  },
  secondaryButtonText: {
    color: '#334155',
    fontSize: 15,
    fontWeight: '700',
  },
  error: {
    marginTop: 6,
    color: '#DC2626',
    fontSize: 14,
    fontWeight: '600',
  },
  disabledActionButton: {
    backgroundColor: '#E2E8F0',
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
  imagePickerSection: {
    marginBottom: 20,
  },
  imagePreviewContainer: {
    marginTop: 8,
    alignItems: 'center',
  },
  imagePreview: {
    width: '100%',
    height: 200,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
  },
  changeImageButton: {
    marginTop: 12,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  changeImageButtonText: {
    color: '#2563EB',
    fontSize: 14,
    fontWeight: '600',
  },
});
