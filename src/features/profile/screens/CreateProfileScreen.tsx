import React, { useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  Image,
  KeyboardTypeOptions,
  TextInputProps,
} from 'react-native';

import { CreateProfileData } from '@database/repositories/ProfileRepository';
import { Profile, ProfileType } from '@domain/models/Profile';
import { useCreateProfile } from '@features/profile/hooks/useCreateProfile';
import { getImage } from '@features/profile/hooks/getImage';

interface CreateProfileScreenProps {
  onCancel: () => void;
  onSaved: (profile: Profile) => void;
}

type DraftType = ProfileType.UPI | ProfileType.WhatsApp | ProfileType.Custom | ProfileType.Other;

export function CreateProfileScreen({ onCancel, onSaved }: CreateProfileScreenProps): React.JSX.Element {
  const createProfile = useCreateProfile();
  const [selectedType, setSelectedType] = useState<DraftType>(ProfileType.UPI);
  const [nickname, setNickname] = useState('');
  const [upiId, setUpiId] = useState('');
  const [minimumAmount, setMinimumAmount] = useState('');
  const [defaultDescription, setDefaultDescription] = useState('');
  const [mobileNumber, setMobileNumber] = useState('+91');
  const [imagePath, setImagePath] = useState('');
  const [text, setText] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const canSave = useMemo(() => {
    const hasNickname = nickname.trim().length > 0;
    const hasTypeData = selectedType !== ProfileType.Other || imagePath.trim().length > 0;
    return hasNickname && hasTypeData && !createProfile.isPending;
  }, [createProfile.isPending, nickname, selectedType, imagePath]);

  const handlePickImage = async () => {
    try {
      const path = await getImage();
      if (path) {
        setImagePath(path);
      }
    } catch (error) {
      setFormError('Failed to pick or save image');
    }
  };

  const handleSave = (): void => {
    setFormError(null);

    const profile = buildCreateProfileData({
      selectedType,
      nickname,
      upiId,
      minimumAmount,
      defaultDescription,
      mobileNumber,
      imagePath,
      text,
    });

    createProfile.mutate(profile, {
      onSuccess: onSaved,
      onError: (error) => {
        setFormError(error.message);
      },
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.keyboardView}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.topBar}>
            <Pressable
              accessibilityLabel="Cancel create profile"
              accessibilityHint="Returns to Home"
              onPress={onCancel}
              style={styles.cancelTextButton}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </Pressable>

            <Text style={styles.navTitle}>New profile</Text>

            <Pressable
              accessibilityLabel="Save profile"
              accessibilityHint="Creates this QR profile"
              disabled={!canSave}
              onPress={handleSave}
              style={styles.saveTextButton}
            >
              <Text style={[styles.saveButtonText, !canSave && styles.saveButtonTextDisabled]}>
                {createProfile.isPending ? 'Saving' : 'Save'}
              </Text>
            </Pressable>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.typeGrid}
          >
            <TypeCard label="UPI" selected={selectedType === ProfileType.UPI} onPress={() => setSelectedType(ProfileType.UPI)} />
            <TypeCard label="WhatsApp" selected={selectedType === ProfileType.WhatsApp} onPress={() => setSelectedType(ProfileType.WhatsApp)} />
            <TypeCard label="Custom" selected={selectedType === ProfileType.Custom} onPress={() => setSelectedType(ProfileType.Custom)} />
            <TypeCard label="Import" selected={selectedType === ProfileType.Other} onPress={() => setSelectedType(ProfileType.Other)} />
          </ScrollView>

          <Field label="Nickname" value={nickname} onChangeText={setNickname} placeholder="Home account" />

          {selectedType === ProfileType.UPI && (
            <>
              <Field label="UPI ID" value={upiId} onChangeText={setUpiId} placeholder="name@bank" autoCapitalize="none" />
              <Field
                label="Minimum amount (optional)"
                value={minimumAmount}
                onChangeText={setMinimumAmount}
                placeholder="0"
                keyboardType="decimal-pad"
              />
              <Field
                label="Default note"
                value={defaultDescription}
                onChangeText={setDefaultDescription}
                placeholder="Payment"
              />
              <Text style={styles.helperText}>
                You'll choose a UPI app after scanning, so there's no need to add one here.
              </Text>
            </>
          )}

          {selectedType === ProfileType.WhatsApp && (
            <Field
              label="Mobile Number"
              value={mobileNumber}
              onChangeText={setMobileNumber}
              placeholder="9876543210"
              keyboardType="phone-pad"
            />
          )}

          {selectedType === ProfileType.Custom && (
            <Field
              label="Text"
              value={text}
              onChangeText={setText}
              placeholder="Write something to wrap in QR..."
              multiline
              numberOfLines={5}
              maxLength={120}
            />
          )}

          {selectedType === ProfileType.Other && (
            <View style={styles.imagePickerSection}>
              <Text style={styles.label}>Imported QR Image</Text>
              {imagePath ? (
                <View style={styles.imagePreviewContainer}>
                  <Image source={{ uri: imagePath }} style={styles.imagePreview} resizeMode="contain" />
                  <Pressable onPress={handlePickImage} style={styles.changeImageButton}>
                    <Text style={styles.changeImageButtonText}>Change Image</Text>
                  </Pressable>
                </View>
              ) : (
                <Pressable onPress={handlePickImage} style={styles.pickImageButton}>
                  <Text style={styles.pickImageButtonText}>Pick QR Image from Gallery</Text>
                </Pressable>
              )}
            </View>
          )}

          {formError && <Text style={styles.error}>{formError}</Text>}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

interface BuildCreateProfileDataInput {
  selectedType: DraftType;
  nickname: string;
  upiId: string;
  minimumAmount: string;
  defaultDescription: string;
  mobileNumber: string;
  imagePath: string;
  text: string;
}

function buildCreateProfileData(input: BuildCreateProfileDataInput): CreateProfileData {
  const common = {
    nickname: input.nickname,
    logoPath: null,
    quickAccessSlot: null,
  };

  if (input.selectedType === ProfileType.UPI) {
    return {
      ...common,
      type: ProfileType.UPI,
      upiId: input.upiId,
      minimumAmount: input.minimumAmount.trim() ? Number(input.minimumAmount) : null,
      defaultDescription: input.defaultDescription.trim() || null,
    };
  }

  if (input.selectedType === ProfileType.WhatsApp) {
    return {
      ...common,
      type: ProfileType.WhatsApp,
      mobileNumber: input.mobileNumber,
    };
  }

  if (input.selectedType === ProfileType.Custom) {
    return {
      ...common,
      type: ProfileType.Custom,
      text: input.text,
    };
  }

  return {
    ...common,
    type: ProfileType.Other,
    imagePath: input.imagePath,
    extractedText: null,
  };
}

interface TypeCardProps {
  label: string;
  selected: boolean;
  onPress: () => void;
}

function TypeCard({ label, selected, onPress }: TypeCardProps): React.JSX.Element {
  return (
    <Pressable
      accessibilityLabel={`${label} profile type`}
      accessibilityHint="Selects this profile type"
      onPress={onPress}
      style={[styles.typeCard, selected && styles.selectedTypeCard]}
    >
      <Text style={[styles.typeCardText, selected && styles.selectedTypeCardText]}>{label}</Text>
    </Pressable>
  );
}

interface FieldProps {
  label: string;
  value: string;
  placeholder?: string;
  onChangeText: (text: string) => void;
  keyboardType?: KeyboardTypeOptions;
  autoCapitalize?: TextInputProps['autoCapitalize'];
  multiline?: boolean;
  numberOfLines?: number;
  maxLength?: number;
}

function Field({
  label,
  value,
  placeholder,
  onChangeText,
  keyboardType = "default",
  autoCapitalize = "sentences",
  multiline = false,
  numberOfLines = 1,
  maxLength,
}: FieldProps): React.JSX.Element {
  return (
    <View style={styles.fieldGroup}>
      <Text style={styles.label}>{label}</Text>

      <TextInput
        accessibilityLabel={label}
        accessibilityHint={`Enter ${label}`}
        autoCapitalize={autoCapitalize}
        keyboardType={keyboardType}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#94A3B8"
        value={value}
        multiline={multiline}
        numberOfLines={numberOfLines}
        maxLength={maxLength}
        textAlignVertical={multiline ? "top" : "center"}
        style={[
          styles.input,
          multiline && styles.textArea,
        ]}
      />

      {maxLength && (
        <Text style={styles.counter}>
          {value.length}/{maxLength}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2EDE8',
  },
  keyboardView: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 40,
  },
  topBar: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  navTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0F172A',
  },
  cancelTextButton: {
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  cancelButtonText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#0F172A',
  },
  saveTextButton: {
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  saveButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0D6B50',
  },
  saveButtonTextDisabled: {
    color: '#94A3B8',
  },
  typeGrid: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 20,
  },
  typeCard: {
    minHeight: 38,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectedTypeCard: {
    borderColor: '#0D6B50',
    backgroundColor: '#0D6B50',
  },
  typeCardText: {
    color: '#334155',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  selectedTypeCardText: {
    color: '#FFFFFF',
  },
  fieldGroup: {
    marginBottom: 16,
  },
  label: {
    marginBottom: 6,
    color: '#334155',
    fontSize: 13,
    fontWeight: '600',
  },
  input: {
    minHeight: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
    color: '#0F172A',
    fontSize: 15,
    paddingHorizontal: 14,
  },
  textArea: {
    minHeight: 120,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: 12,
    textAlignVertical: 'top',
  },
  counter: {
    alignSelf: 'flex-end',
    marginTop: 4,
    color: '#64748B',
    fontSize: 12,
  },
  helperText: {
    marginTop: 8,
    color: '#64748B',
    fontSize: 12,
    lineHeight: 18,
  },
  error: {
    marginTop: 6,
    color: '#DC2626',
    fontSize: 14,
    fontWeight: '600',
  },
  imagePickerSection: {
    marginBottom: 20,
  },
  pickImageButton: {
    minHeight: 120,
    borderRadius: 12,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: '#CBD5E1',
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  pickImageButtonText: {
    color: '#64748B',
    fontSize: 15,
    fontWeight: '600',
  },
  imagePreviewContainer: {
    marginTop: 8,
    alignItems: 'center',
  },
  imagePreview: {
    width: '100%',
    height: 200,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
  },
  changeImageButton: {
    marginTop: 12,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#E6F4F0',
    borderWidth: 1,
    borderColor: '#A8D5C5',
  },
  changeImageButtonText: {
    color: '#0D6B50',
    fontSize: 14,
    fontWeight: '600',
  },
});
