import React, { useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  SafeAreaView,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';

import {
  useSettings,
  useUpdateSettings,
  useExportBackup,
  useImportBackup,
} from '../hooks/useSettings';
import { useProfiles } from '@features/home/hooks/useHomeProfiles';
import { ProfileType } from '@domain/models/Profile';
import { ImportService } from '@domain/services/ImportService';

interface SettingsScreenProps {
  onBack: () => void;
}

export function SettingsScreen({ onBack }: SettingsScreenProps): React.JSX.Element {
  const { data: settings, isLoading: isSettingsLoading } = useSettings();
  const { data: profiles, isLoading: isProfilesLoading } = useProfiles();
  const updateSettings = useUpdateSettings();
  const exportBackup = useExportBackup();
  const importBackup = useImportBackup();

  const [importModalVisible, setImportModalVisible] = useState(false);
  const [importJsonText, setImportJsonText] = useState('');
  const [validationSummary, setValidationSummary] = useState<string | null>(null);
  const [validatedBackup, setValidatedBackup] = useState<any>(null);
  const [validationError, setValidationError] = useState<string | null>(null);

  const handleMaxHeaderChange = (val: number) => {
    if (!settings) return;
    updateSettings.mutate({
      ...settings,
      maxHeaderProfiles: val as 1 | 2 | 3 | 4,
    });
  };

  const handleDefaultProfileChange = (profileId: string | null) => {
    if (!settings) return;
    updateSettings.mutate({
      ...settings,
      defaultProfileId: profileId,
    });
  };

  const handleExport = async () => {
    try {
      const backupJson = await exportBackup.mutateAsync();
      await Share.share({
        message: backupJson,
        title: 'QR Profiles Backup',
      });
    } catch (err) {
      Alert.alert('Export Failed', err instanceof Error ? err.message : 'Unknown error');
    }
  };

  const handleVerifyImport = () => {
    setValidationError(null);
    setValidationSummary(null);
    setValidatedBackup(null);

    try {
      if (!importJsonText.trim()) {
        throw new Error('Please paste a JSON backup payload.');
      }
      const parsed = ImportService.parseBackup(importJsonText);
      
      const upiCount = parsed.profiles.filter(p => p.type === ProfileType.UPI).length;
      const waCount = parsed.profiles.filter(p => p.type === ProfileType.WhatsApp).length;
      
      setValidatedBackup(parsed);
      setValidationSummary(
        `✓ Valid Backup Found!\n• Settings restored: Max header profiles (${parsed.settings.maxHeaderProfiles})\n• UPI Profiles to import: ${upiCount}\n• WhatsApp Profiles to import: ${waCount}\n\nWARNING: Importing will overwrite all existing data. This cannot be undone.`
      );
    } catch (err) {
      setValidationError(err instanceof Error ? err.message : 'Invalid backup JSON schema.');
    }
  };

  const handleConfirmImport = async () => {
    if (!validatedBackup) return;
    try {
      await importBackup.mutateAsync(importJsonText);
      setImportModalVisible(false);
      setImportJsonText('');
      setValidationSummary(null);
      setValidatedBackup(null);
      Alert.alert('Import Successful', 'Your profiles and settings have been restored.');
      onBack();
    } catch (err) {
      Alert.alert('Import Failed', err instanceof Error ? err.message : 'Unknown error during restore.');
    }
  };

  const activeProfiles = profiles ?? [];

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Pressable accessibilityLabel="Go back" onPress={onBack}>
          <Ionicons name="arrow-back" size={24} color="#0F172A" />
        </Pressable>
        <Text style={styles.headerTitle}>Settings</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Profile Settings Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Profile Preferences</Text>

          {/* Default Profile */}
          <View style={styles.settingRow}>
            <View style={styles.settingTextContainer}>
              <Text style={styles.settingLabel}>Default Startup Profile</Text>
              <Text style={styles.settingDescription}>The profile that opens automatically when launching the app.</Text>
            </View>
          </View>
          <View style={styles.selectorContainer}>
            <Pressable
              style={[
                styles.selectorItem,
                !settings?.defaultProfileId && styles.selectorItemActive,
              ]}
              onPress={() => handleDefaultProfileChange(null)}
            >
              <Text style={[styles.selectorItemText, !settings?.defaultProfileId && styles.selectorItemTextActive]}>
                None (Preview Off)
              </Text>
            </Pressable>
            {activeProfiles.map((p) => (
              <Pressable
                key={p.id}
                style={[
                  styles.selectorItem,
                  settings?.defaultProfileId === p.id && styles.selectorItemActive,
                ]}
                onPress={() => handleDefaultProfileChange(p.id)}
              >
                <Text
                  numberOfLines={1}
                  style={[styles.selectorItemText, settings?.defaultProfileId === p.id && styles.selectorItemTextActive]}
                >
                  {p.nickname}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* Max Header Profiles */}
          <View style={[styles.settingRow, { marginTop: 24 }]}>
            <View style={styles.settingTextContainer}>
              <Text style={styles.settingLabel}>Max Header Slots</Text>
              <Text style={styles.settingDescription}>Maximum quick access profiles shown in the dashboard header (1-4).</Text>
            </View>
          </View>
          <View style={styles.slotsRow}>
            {([1, 2, 3, 4] as const).map((num) => (
              <Pressable
                key={num}
                style={[
                  styles.slotButton,
                  settings?.maxHeaderProfiles === num && styles.slotButtonActive,
                ]}
                onPress={() => handleMaxHeaderChange(num)}
              >
                <Text style={[styles.slotButtonText, settings?.maxHeaderProfiles === num && styles.slotButtonTextActive]}>
                  {num}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Backup & Recovery Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Backup & Recovery</Text>
          <Text style={styles.infoText}>
            Export your configurations and profile cards to a secure JSON file, or restore them.
          </Text>

          <View style={styles.actionButtonsRow}>
            <Pressable
              accessibilityLabel="Export Backup"
              onPress={handleExport}
              disabled={exportBackup.isPending}
              style={[styles.actionBtn, styles.exportBtn]}
            >
              <Text style={styles.actionBtnText}>Export Backup</Text>
            </Pressable>

            <Pressable
              accessibilityLabel="Import Backup"
              onPress={() => setImportModalVisible(true)}
              style={[styles.actionBtn, styles.importBtn]}
            >
              <Text style={[styles.actionBtnText, { color: '#0F172A' }]}>Import Backup</Text>
            </Pressable>
          </View>
        </View>

        {/* About App Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>About</Text>
          <View style={styles.aboutRow}>
            <Text style={styles.aboutLabel}>Version</Text>
            <Text style={styles.aboutValue}>1.0.0 (MVP)</Text>
          </View>
          <View style={styles.aboutRow}>
            <Text style={styles.aboutLabel}>Storage Mode</Text>
            <Text style={styles.aboutValue}>Offline-Only (SQLite & MMKV)</Text>
          </View>
        </View>
      </ScrollView>

      {/* Import Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={importModalVisible}
        onRequestClose={() => setImportModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Import Backup</Text>
            <Text style={styles.modalSub}>Paste the exported backup JSON payload below:</Text>

            <TextInput
              multiline
              numberOfLines={8}
              placeholder='{"version":1,"exportedAt":...}'
              placeholderTextColor="#94A3B8"
              value={importJsonText}
              onChangeText={(text) => {
                setImportJsonText(text);
                setValidationSummary(null);
                setValidationError(null);
                setValidatedBackup(null);
              }}
              style={styles.textInput}
            />

            {validationError && (
              <Text style={styles.errorBanner}>{validationError}</Text>
            )}

            {validationSummary && (
              <Text style={styles.successBanner}>{validationSummary}</Text>
            )}

            <View style={styles.modalButtons}>
              {!validatedBackup ? (
                <Pressable onPress={handleVerifyImport} style={[styles.modalBtn, styles.modalVerifyBtn]}>
                  <Text style={styles.modalBtnText}>Verify Backup</Text>
                </Pressable>
              ) : (
                <Pressable onPress={handleConfirmImport} style={[styles.modalBtn, styles.modalConfirmBtn]}>
                  <Text style={styles.modalBtnText}>Restore Now</Text>
                </Pressable>
              )}
              <Pressable
                onPress={() => {
                  setImportModalVisible(false);
                  setImportJsonText('');
                  setValidationSummary(null);
                  setValidationError(null);
                  setValidatedBackup(null);
                }}
                style={[styles.modalBtn, styles.modalCancelBtn]}
              >
                <Text style={[styles.modalBtnText, { color: '#475569' }]}>Cancel</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F1F5F9',
  },
  backButtonText: {
    fontSize: 20,
    color: '#0F172A',
    fontWeight: '700',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
  },
  placeholder: {
    width: 40,
  },
  scrollContent: {
    padding: 16,
    gap: 16,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 12,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  settingTextContainer: {
    flex: 1,
    paddingRight: 16,
  },
  settingLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#334155',
  },
  settingDescription: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  selectorContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  selectorItem: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#FFFFFF',
  },
  selectorItemActive: {
    borderColor: '#2563EB',
    backgroundColor: '#EFF6FF',
  },
  selectorItemText: {
    fontSize: 13,
    color: '#475569',
  },
  selectorItemTextActive: {
    color: '#2563EB',
    fontWeight: '600',
  },
  slotsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 4,
  },
  slotButton: {
    flex: 1,
    height: 40,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  slotButtonActive: {
    borderColor: '#2563EB',
    backgroundColor: '#EFF6FF',
  },
  slotButtonText: {
    fontSize: 14,
    color: '#475569',
  },
  slotButtonTextActive: {
    color: '#2563EB',
    fontWeight: '700',
  },
  infoText: {
    fontSize: 13,
    color: '#475569',
    lineHeight: 18,
    marginBottom: 16,
  },
  actionButtonsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  actionBtn: {
    flex: 1,
    height: 44,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  exportBtn: {
    backgroundColor: '#0F172A',
  },
  importBtn: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#FFFFFF',
  },
  actionBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  aboutRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  aboutLabel: {
    fontSize: 13,
    color: '#475569',
  },
  aboutValue: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0F172A',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 4,
  },
  modalSub: {
    fontSize: 13,
    color: '#64748B',
    marginBottom: 16,
  },
  textInput: {
    width: '100%',
    minHeight: 120,
    borderColor: '#CBD5E1',
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    color: '#0F172A',
    fontSize: 13,
    backgroundColor: '#F8FAFC',
    textAlignVertical: 'top',
  },
  errorBanner: {
    marginTop: 12,
    color: '#DC2626',
    backgroundColor: '#FEF2F2',
    padding: 10,
    borderRadius: 6,
    fontSize: 12,
    fontWeight: '500',
  },
  successBanner: {
    marginTop: 12,
    color: '#15803D',
    backgroundColor: '#F0FDF4',
    padding: 10,
    borderRadius: 6,
    fontSize: 12,
    fontWeight: '500',
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
  },
  modalBtn: {
    flex: 1,
    height: 40,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalVerifyBtn: {
    backgroundColor: '#2563EB',
  },
  modalConfirmBtn: {
    backgroundColor: '#DC2626',
  },
  modalCancelBtn: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#FFFFFF',
  },
  modalBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
