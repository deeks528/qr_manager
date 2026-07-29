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
} from 'react-native';

import { CreateProfileData } from '@database/repositories/ProfileRepository';
import { ProfileType } from '@domain/models/Profile';
import { useCreateProfile } from '@features/profile/hooks/useCreateProfile';

interface CreateProfileScreenProps {
  onCancel: () => void;
  onSaved: () => void;
}

type DraftType = ProfileType.UPI | ProfileType.WhatsApp | ProfileType.Other;

export function CreateProfileScreen({ onCancel, onSaved }: CreateProfileScreenProps): React.JSX.Element {
  const createProfile = useCreateProfile();
  const [selectedType, setSelectedType] = useState<DraftType>(ProfileType.UPI);
  const [nickname, setNickname] = useState('');
  const [upiId, setUpiId] = useState('');
  const [minimumAmount, setMinimumAmount] = useState('');
  const [defaultDescription, setDefaultDescription] = useState('');
  const [mobileNumber, setMobileNumber] = useState('');
  const [qrImagePath, setQrImagePath] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const canSave = useMemo(() => nickname.trim().length > 0 && !createProfile.isPending, [createProfile.isPending, nickname]);

  const handleSave = (): void => {
    setFormError(null);

    const profile = buildCreateProfileData({
      selectedType,
      nickname,
      upiId,
      minimumAmount,
      defaultDescription,
      mobileNumber,
      qrImagePath,
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
            <Pressable accessibilityLabel="Cancel create profile" accessibilityHint="Returns to Home" onPress={onCancel} style={styles.secondaryButton}>
              <Text style={styles.secondaryButtonText}>Cancel</Text>
            </Pressable>
            <Pressable
              accessibilityLabel="Save profile"
              accessibilityHint="Creates this QR profile"
              disabled={!canSave}
              onPress={handleSave}
              style={[styles.primaryButton, !canSave && styles.disabledButton]}
            >
              <Text style={styles.primaryButtonText}>{createProfile.isPending ? 'Saving' : 'Save'}</Text>
            </Pressable>
          </View>

          <Text style={styles.title}>Create Profile</Text>

          <View style={styles.typeGrid}>
            <TypeCard label="UPI" selected={selectedType === ProfileType.UPI} onPress={() => setSelectedType(ProfileType.UPI)} />
            <TypeCard label="WhatsApp" selected={selectedType === ProfileType.WhatsApp} onPress={() => setSelectedType(ProfileType.WhatsApp)} />
            <TypeCard label="Import QR" selected={selectedType === ProfileType.Other} onPress={() => setSelectedType(ProfileType.Other)} />
          </View>

          <Field label="Nickname" value={nickname} onChangeText={setNickname} placeholder="Home Account" />

          {selectedType === ProfileType.UPI && (
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

          {selectedType === ProfileType.WhatsApp && (
            <Field
              label="Mobile Number"
              value={mobileNumber}
              onChangeText={setMobileNumber}
              placeholder="9876543210"
              keyboardType="phone-pad"
            />
          )}

          {selectedType === ProfileType.Other && (
            <Field label="Imported QR Image" value={qrImagePath} onChangeText={setQrImagePath} placeholder="local/path/to/qr.png" autoCapitalize="none" />
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
  qrImagePath: string;
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

  return {
    ...common,
    type: ProfileType.Other,
    qrImagePath: input.qrImagePath,
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
  placeholder: string;
  onChangeText: (value: string) => void;
  keyboardType?: 'default' | 'decimal-pad' | 'phone-pad';
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
}

function Field({ label, value, placeholder, onChangeText, keyboardType = 'default', autoCapitalize = 'sentences' }: FieldProps): React.JSX.Element {
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
        style={styles.input}
        value={value}
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
    marginBottom: 20,
    color: '#0F172A',
    fontSize: 26,
    fontWeight: '700',
  },
  typeGrid: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 20,
  },
  typeCard: {
    flex: 1,
    minHeight: 56,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  selectedTypeCard: {
    borderColor: '#2563EB',
    backgroundColor: '#DBEAFE',
  },
  typeCardText: {
    color: '#334155',
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
  },
  selectedTypeCardText: {
    color: '#1D4ED8',
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
});
