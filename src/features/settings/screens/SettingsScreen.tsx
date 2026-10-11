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
import {
  useQuickMessages,
  useAddQuickMessage,
  useUpdateQuickMessage,
  useDeleteQuickMessage,
  useReorderQuickMessages,
} from '../hooks/useQuickMessages';
import { QuickMessage } from '@domain/models/QuickMessage';
import { useProfiles } from '@features/home/hooks/useHomeProfiles';
import { ProfileType } from '@domain/models/Profile';
import { ImportService } from '@domain/services/ImportService';
import { AvatarService } from '@domain/services/AvatarService';

interface SettingsScreenProps {
  onBack: () => void;
}

function getQuickMessageEmoji(text: string): string {
  const lower = text.toLowerCase();
  if (lower.includes('rent')) return '🏠';
  if (lower.includes('bill') || lower.includes('electricity') || lower.includes('water')) return '📄';
  if (lower.includes('grocer') || lower.includes('mart') || lower.includes('supermarket')) return '🛒';
  if (
    lower.includes('food') ||
    lower.includes('lunch') ||
    lower.includes('dinner') ||
    lower.includes('coffee') ||
    lower.includes('tea') ||
    lower.includes('snack')
  ) {
    return '🍔';
  }
  if (lower.includes('shop') || lower.includes('dress') || lower.includes('cloth')) return '🛍️';
  if (lower.includes('fuel') || lower.includes('petrol') || lower.includes('diesel')) return '⛽';
  if (lower.includes('cab') || lower.includes('auto') || lower.includes('travel') || lower.includes('uber')) {
    return '🚖';
  }
  if (lower.includes('movie') || lower.includes('ticket')) return '🎬';
  return '💬';
}

export function SettingsScreen({ onBack }: SettingsScreenProps): React.JSX.Element {
  const { data: settings } = useSettings();
  const { data: profiles } = useProfiles();
  const updateSettings = useUpdateSettings();
  const exportBackup = useExportBackup();
  const importBackup = useImportBackup();

  const { data: quickMessages = [] } = useQuickMessages();
  const addQuickMessage = useAddQuickMessage();
  const updateQuickMessage = useUpdateQuickMessage();
  const deleteQuickMessage = useDeleteQuickMessage();
  const reorderQuickMessages = useReorderQuickMessages();

  // Profile dropdown state
  const [isProfileDropdownOpen, setIsProfileDropdownOpen] = useState(false);

  // Import modal state
  const [importModalVisible, setImportModalVisible] = useState(false);
  const [importJsonText, setImportJsonText] = useState('');
  const [validationSummary, setValidationSummary] = useState<string | null>(null);
  const [validatedBackup, setValidatedBackup] = useState<any>(null);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Quick message modal state
  const [messageModalVisible, setMessageModalVisible] = useState(false);
  const [editingMessage, setEditingMessage] = useState<QuickMessage | null>(null);
  const [messageInputText, setMessageInputText] = useState('');

  const activeProfiles = profiles ?? [];
  const selectedDefaultProfile = activeProfiles.find((p) => p.id === settings?.defaultProfileId);

  const handleOpenAddMessage = () => {
    setEditingMessage(null);
    setMessageInputText('');
    setMessageModalVisible(true);
  };

  const handleOpenEditMessage = (msg: QuickMessage) => {
    setEditingMessage(msg);
    setMessageInputText(msg.text);
    setMessageModalVisible(true);
  };

  const handleSaveMessage = () => {
    const trimmed = messageInputText.trim();
    if (!trimmed) {
      Alert.alert('Error', 'Quick message cannot be empty');
      return;
    }

    if (editingMessage) {
      updateQuickMessage.mutate({ id: editingMessage.id, text: trimmed });
    } else {
      addQuickMessage.mutate(trimmed);
    }
    setMessageModalVisible(false);
  };

  const handleDeleteMessage = (id: string) => {
    Alert.alert('Delete Quick Message', 'Are you sure you want to delete this message?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteQuickMessage.mutate(id) },
    ]);
  };

  const handleMoveMessage = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= quickMessages.length) return;

    const newOrder = [...quickMessages];
    const [moved] = newOrder.splice(index, 1);
    newOrder.splice(targetIndex, 0, moved);

    reorderQuickMessages.mutate(newOrder.map((m) => m.id));
  };

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
    setIsProfileDropdownOpen(false);
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

      const upiCount = parsed.profiles.filter((p) => p.type === ProfileType.UPI).length;
      const waCount = parsed.profiles.filter((p) => p.type === ProfileType.WhatsApp).length;

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

  return (
    <SafeAreaView style={styles.container}>
      {/* ══ Top Header ══ */}
      <View style={styles.header}>
        <Pressable
          accessibilityLabel="Go back"
          onPress={onBack}
          style={styles.backButton}
        >
          <Ionicons name="chevron-back" size={22} color="#0F172A" />
        </Pressable>
        <View style={styles.headerTextGroup}>
          <Text style={styles.headerTitle}>Settings</Text>
          <Text style={styles.headerSubtitle}>Customize your experience</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ══ Card 1: Profile Preferences ══ */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={[styles.badgeIconContainer, { backgroundColor: '#EFF6FF' }]}>
              <Ionicons name="person" size={20} color="#2563EB" />
            </View>
            <View style={styles.cardHeaderText}>
              <Text style={styles.cardTitle}>Profile Preferences</Text>
              <Text style={styles.cardSubtitle}>Choose how the app opens and what to show</Text>
            </View>
          </View>

          {/* Subsection: Default Startup Profile */}
          <View style={styles.subsectionHeader}>
            <View style={styles.subIndicatorRow}>
              <Ionicons name="play" size={11} color="#0F172A" style={{ marginTop: 2 }} />
              <Text style={styles.subSectionTitle}>Default Startup Profile</Text>
            </View>
            <Text style={styles.subSectionDescription}>
              The profile that opens automatically when launching the app.
            </Text>
          </View>

          {/* Dropdown Selector Component */}
          <View style={styles.dropdownWrapper}>
            <Pressable
              accessibilityLabel="Select default startup profile"
              onPress={() => setIsProfileDropdownOpen(!isProfileDropdownOpen)}
              style={[
                styles.dropdownTrigger,
                isProfileDropdownOpen && styles.dropdownTriggerActive,
              ]}
            >
              <View style={styles.dropdownSelectedContent}>
                {selectedDefaultProfile ? (
                  <>
                    <View
                      style={[
                        styles.dropdownAvatarChip,
                        { backgroundColor: selectedDefaultProfile.avatarColor },
                      ]}
                    >
                      <Text style={styles.dropdownAvatarText}>
                        {AvatarService.createInitials(selectedDefaultProfile.nickname)}
                      </Text>
                    </View>
                    <View style={styles.dropdownTextGroup}>
                      <Text numberOfLines={1} style={styles.dropdownSelectedName}>
                        {selectedDefaultProfile.nickname}
                      </Text>
                      <Text numberOfLines={1} style={styles.dropdownSelectedMeta}>
                        {selectedDefaultProfile.type === ProfileType.UPI
                          ? selectedDefaultProfile.upiId || 'UPI Profile'
                          : `${selectedDefaultProfile.type} Profile`}
                      </Text>
                    </View>
                  </>
                ) : (
                  <>
                    <View style={[styles.dropdownAvatarChip, styles.noneAvatarChip]}>
                      <Ionicons name="eye-off-outline" size={16} color="#64748B" />
                    </View>
                    <View style={styles.dropdownTextGroup}>
                      <Text style={styles.dropdownSelectedName}>None (Preview Off)</Text>
                      <Text style={styles.dropdownSelectedMeta}>No profile loaded on startup</Text>
                    </View>
                  </>
                )}
              </View>

              <Ionicons
                name={isProfileDropdownOpen ? 'chevron-up' : 'chevron-down'}
                size={18}
                color="#64748B"
              />
            </Pressable>

            {/* Expandable Dropdown Options Menu */}
            {isProfileDropdownOpen && (
              <View style={styles.dropdownMenu}>
                {/* Option: None */}
                <Pressable
                  onPress={() => handleDefaultProfileChange(null)}
                  style={[
                    styles.dropdownOption,
                    !settings?.defaultProfileId && styles.dropdownOptionSelected,
                  ]}
                >
                  <View style={styles.dropdownOptionLeft}>
                    <View style={[styles.dropdownAvatarChipSmall, styles.noneAvatarChip]}>
                      <Ionicons name="eye-off-outline" size={14} color="#64748B" />
                    </View>
                    <View>
                      <Text
                        style={[
                          styles.dropdownOptionTitle,
                          !settings?.defaultProfileId && styles.dropdownOptionTitleActive,
                        ]}
                      >
                        None (Preview Off)
                      </Text>
                      <Text style={styles.dropdownOptionSub}>Blank preview on launch</Text>
                    </View>
                  </View>
                  {!settings?.defaultProfileId && (
                    <Ionicons name="checkmark-circle" size={18} color="#2563EB" />
                  )}
                </Pressable>

                <View style={styles.dropdownDivider} />

                {/* List of profiles */}
                {activeProfiles.length === 0 ? (
                  <View style={styles.dropdownEmptyRow}>
                    <Text style={styles.dropdownEmptyText}>No profiles created yet</Text>
                  </View>
                ) : (
                  activeProfiles.map((p, idx) => {
                    const isSelected = settings?.defaultProfileId === p.id;
                    const isLast = idx === activeProfiles.length - 1;

                    return (
                      <Pressable
                        key={p.id}
                        onPress={() => handleDefaultProfileChange(p.id)}
                        style={[
                          styles.dropdownOption,
                          isSelected && styles.dropdownOptionSelected,
                          isLast && { borderBottomWidth: 0 },
                        ]}
                      >
                        <View style={styles.dropdownOptionLeft}>
                          <View
                            style={[
                              styles.dropdownAvatarChipSmall,
                              { backgroundColor: p.avatarColor },
                            ]}
                          >
                            <Text style={styles.dropdownAvatarTextSmall}>
                              {AvatarService.createInitials(p.nickname)}
                            </Text>
                          </View>
                          <View>
                            <Text
                              style={[
                                styles.dropdownOptionTitle,
                                isSelected && styles.dropdownOptionTitleActive,
                              ]}
                            >
                              {p.nickname}
                            </Text>
                            <Text style={styles.dropdownOptionSub}>
                              {p.type === ProfileType.UPI
                                ? p.upiId || 'UPI'
                                : `${p.type}`}
                            </Text>
                          </View>
                        </View>
                        {isSelected && (
                          <Ionicons name="checkmark-circle" size={18} color="#2563EB" />
                        )}
                      </Pressable>
                    );
                  })
                )}
              </View>
            )}
          </View>

          {/* Subsection: Max Header Slots */}
          <View style={[styles.subsectionHeader, { marginTop: 20 }]}>
            <View style={styles.subIndicatorRow}>
              <Ionicons name="grid-outline" size={14} color="#0F172A" style={{ marginTop: 1 }} />
              <Text style={styles.subSectionTitle}>Max Header Slots</Text>
            </View>
            <Text style={styles.subSectionDescription}>
              Maximum quick access profiles shown in the dashboard header (1–4).
            </Text>
          </View>

          <View style={styles.slotsRow}>
            {([1, 2, 3, 4] as const).map((num) => {
              const isActive = settings?.maxHeaderProfiles === num;
              return (
                <Pressable
                  key={num}
                  onPress={() => handleMaxHeaderChange(num)}
                  style={[styles.slotButton, isActive && styles.slotButtonActive]}
                >
                  <Text
                    style={[
                      styles.slotButtonText,
                      isActive && styles.slotButtonTextActive,
                    ]}
                  >
                    {num}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* ══ Card 2: Quick Messages ══ */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={[styles.badgeIconContainer, { backgroundColor: '#EEF2FF' }]}>
              <Ionicons name="chatbubble-ellipses" size={20} color="#6366F1" />
            </View>
            <View style={styles.cardHeaderText}>
              <Text style={styles.cardTitle}>Quick Messages</Text>
              <Text style={styles.cardSubtitle}>
                Pre-defined notes for quick entry during QR payments.
              </Text>
            </View>
            <Pressable
              accessibilityLabel="Add quick message"
              onPress={handleOpenAddMessage}
              style={styles.addMessageButton}
            >
              <Ionicons name="add" size={16} color="#FFFFFF" />
              <Text style={styles.addMessageButtonText}>Add</Text>
            </Pressable>
          </View>

          <View style={styles.messagesList}>
            {quickMessages.length === 0 ? (
              <View style={styles.emptyMessagesBox}>
                <Text style={styles.emptyMessagesText}>
                  No quick messages yet. Tap + Add to create one.
                </Text>
              </View>
            ) : (
              quickMessages.map((msg, index) => {
                const isFirst = index === 0;
                const isLast = index === quickMessages.length - 1;
                const emoji = getQuickMessageEmoji(msg.text);

                return (
                  <View
                    key={msg.id}
                    style={[
                      styles.messageRow,
                      isLast && { borderBottomWidth: 0 },
                    ]}
                  >
                    {/* Reorder control */}
                    <View style={styles.reorderColumn}>
                      <Pressable
                        disabled={isFirst}
                        onPress={() => handleMoveMessage(index, 'up')}
                        style={[styles.reorderBtn, isFirst && styles.reorderBtnDisabled]}
                      >
                        <Ionicons
                          name="chevron-up"
                          size={13}
                          color={isFirst ? '#CBD5E1' : '#64748B'}
                        />
                      </Pressable>
                      <Pressable
                        disabled={isLast}
                        onPress={() => handleMoveMessage(index, 'down')}
                        style={[styles.reorderBtn, isLast && styles.reorderBtnDisabled]}
                      >
                        <Ionicons
                          name="chevron-down"
                          size={13}
                          color={isLast ? '#CBD5E1' : '#64748B'}
                        />
                      </Pressable>
                    </View>

                    {/* Emoji category badge */}
                    <View style={styles.msgEmojiBadge}>
                      <Text style={styles.msgEmojiText}>{emoji}</Text>
                    </View>

                    {/* Note title */}
                    <Text numberOfLines={1} style={styles.messageText}>
                      {msg.text}
                    </Text>

                    {/* Action buttons */}
                    <View style={styles.messageActions}>
                      <Pressable
                        accessibilityLabel={`Edit ${msg.text}`}
                        onPress={() => handleOpenEditMessage(msg)}
                        style={styles.actionIconBtn}
                      >
                        <Ionicons name="pencil-outline" size={16} color="#64748B" />
                      </Pressable>
                      <Pressable
                        accessibilityLabel={`Delete ${msg.text}`}
                        onPress={() => handleDeleteMessage(msg.id)}
                        style={styles.actionIconBtn}
                      >
                        <Ionicons name="trash-outline" size={16} color="#EF4444" />
                      </Pressable>
                    </View>
                  </View>
                );
              })
            )}
          </View>
        </View>

        {/* ══ Card 3: Backup & Recovery ══ */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={[styles.badgeIconContainer, { backgroundColor: '#EFF6FF' }]}>
              <Ionicons name="cloud-outline" size={20} color="#2563EB" />
            </View>
            <View style={styles.cardHeaderText}>
              <Text style={styles.cardTitle}>Backup & Recovery</Text>
              <Text style={styles.cardSubtitle}>
                Export your configurations and profile cards to a secure JSON file, or restore them.
              </Text>
            </View>
          </View>

          <View style={styles.actionButtonsRow}>
            {/* Export button */}
            <Pressable
              accessibilityLabel="Export Backup"
              disabled={exportBackup.isPending}
              onPress={handleExport}
              style={[styles.backupBtn, styles.exportBtn]}
            >
              <Ionicons name="cloud-upload-outline" size={20} color="#FFFFFF" />
              <View style={styles.backupBtnTextCol}>
                <Text style={styles.exportBtnTitle}>Export Backup</Text>
                <Text style={styles.exportBtnSub}>Save to device</Text>
              </View>
            </Pressable>

            {/* Import button */}
            <Pressable
              accessibilityLabel="Import Backup"
              onPress={() => setImportModalVisible(true)}
              style={[styles.backupBtn, styles.importBtn]}
            >
              <Ionicons name="cloud-download-outline" size={20} color="#2563EB" />
              <View style={styles.backupBtnTextCol}>
                <Text style={styles.importBtnTitle}>Import Backup</Text>
                <Text style={styles.importBtnSub}>Restore from file</Text>
              </View>
            </Pressable>
          </View>
        </View>

        {/* ══ Card 4: About ══ */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={[styles.badgeIconContainer, { backgroundColor: '#ECFDF5' }]}>
              <Ionicons name="information-circle-outline" size={22} color="#059669" />
            </View>
            <View style={styles.cardHeaderText}>
              <Text style={styles.cardTitle}>About</Text>
              <Text style={styles.cardSubtitle}>App information and storage details.</Text>
            </View>
          </View>

          <View style={styles.aboutList}>
            <View style={styles.aboutRow}>
              <View style={styles.aboutRowLeft}>
                <Ionicons name="cube-outline" size={17} color="#475569" />
                <Text style={styles.aboutLabel}>Version</Text>
              </View>
              <Text style={styles.aboutValue}>1.0.0 (MVP)</Text>
            </View>

            <View style={[styles.aboutRow, { borderBottomWidth: 0 }]}>
              <View style={styles.aboutRowLeft}>
                <Ionicons name="server-outline" size={17} color="#475569" />
                <Text style={styles.aboutLabel}>Storage Mode</Text>
              </View>
              <Text style={styles.aboutValue}>Offline-Only (SQLite & MMKV)</Text>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* ══ Quick Message Modal ══ */}
      <Modal
        animationType="fade"
        onRequestClose={() => setMessageModalVisible(false)}
        transparent={true}
        visible={messageModalVisible}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              {editingMessage ? 'Edit Quick Message' : 'Add Quick Message'}
            </Text>
            <Text style={styles.modalSub}>
              Enter a note to quickly use during QR payments:
            </Text>

            <TextInput
              autoFocus
              onChangeText={setMessageInputText}
              placeholder="e.g. Groceries, Rent, Coffee"
              placeholderTextColor="#94A3B8"
              style={styles.modalInput}
              value={messageInputText}
            />

            <View style={styles.modalActions}>
              <Pressable
                onPress={() => setMessageModalVisible(false)}
                style={[styles.modalBtn, styles.modalBtnCancel]}
              >
                <Text style={styles.modalBtnTextCancel}>Cancel</Text>
              </Pressable>

              <Pressable
                onPress={handleSaveMessage}
                style={[styles.modalBtn, styles.modalBtnPrimary]}
              >
                <Text style={styles.modalBtnTextPrimary}>Save</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* ══ Import Modal ══ */}
      <Modal
        animationType="slide"
        onRequestClose={() => setImportModalVisible(false)}
        transparent={true}
        visible={importModalVisible}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Import Backup</Text>
            <Text style={styles.modalSub}>
              Paste the exported backup JSON payload below:
            </Text>

            <TextInput
              multiline
              numberOfLines={8}
              onChangeText={(text) => {
                setImportJsonText(text);
                setValidationSummary(null);
                setValidationError(null);
                setValidatedBackup(null);
              }}
              placeholder='{"version":1,"exportedAt":...}'
              placeholderTextColor="#94A3B8"
              style={styles.textInput}
              value={importJsonText}
            />

            {validationError && (
              <Text style={styles.errorBanner}>{validationError}</Text>
            )}

            {validationSummary && (
              <Text style={styles.successBanner}>{validationSummary}</Text>
            )}

            <View style={styles.modalButtons}>
              {!validatedBackup ? (
                <Pressable
                  onPress={handleVerifyImport}
                  style={[styles.modalBtn, styles.modalVerifyBtn]}
                >
                  <Text style={styles.modalBtnText}>Verify Backup</Text>
                </Pressable>
              ) : (
                <Pressable
                  onPress={handleConfirmImport}
                  style={[styles.modalBtn, styles.modalConfirmBtn]}
                >
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
                <Text style={[styles.modalBtnText, { color: '#475569' }]}>
                  Cancel
                </Text>
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
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
    gap: 16,
    backgroundColor: '#F8FAFC',
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  headerTextGroup: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 2,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 32,
    gap: 16,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  badgeIconContainer: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardHeaderText: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  cardSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
    lineHeight: 16,
  },
  subsectionHeader: {
    marginBottom: 10,
  },
  subIndicatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  subSectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  subSectionDescription: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  dropdownWrapper: {
    position: 'relative',
    zIndex: 10,
  },
  dropdownTrigger: {
    height: 54,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
  },
  dropdownTriggerActive: {
    borderColor: '#2563EB',
    backgroundColor: '#FFFFFF',
  },
  dropdownSelectedContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  dropdownAvatarChip: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noneAvatarChip: {
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  dropdownAvatarText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  dropdownTextGroup: {
    flex: 1,
  },
  dropdownSelectedName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  dropdownSelectedMeta: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
  },
  dropdownMenu: {
    marginTop: 6,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 4,
    overflow: 'hidden',
  },
  dropdownOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  dropdownOptionSelected: {
    backgroundColor: '#EFF6FF',
  },
  dropdownOptionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  dropdownAvatarChipSmall: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dropdownAvatarTextSmall: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  dropdownOptionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1E293B',
  },
  dropdownOptionTitleActive: {
    color: '#2563EB',
    fontWeight: '700',
  },
  dropdownOptionSub: {
    fontSize: 11,
    color: '#64748B',
  },
  dropdownDivider: {
    height: 1,
    backgroundColor: '#E2E8F0',
  },
  dropdownEmptyRow: {
    padding: 16,
    alignItems: 'center',
  },
  dropdownEmptyText: {
    fontSize: 12,
    color: '#94A3B8',
  },
  slotsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  slotButton: {
    flex: 1,
    height: 42,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  slotButtonActive: {
    backgroundColor: '#2563EB',
    borderColor: '#2563EB',
  },
  slotButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#334155',
  },
  slotButtonTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  addMessageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 10,
    backgroundColor: '#2563EB',
  },
  addMessageButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  messagesList: {
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    marginTop: 4,
  },
  emptyMessagesBox: {
    paddingVertical: 18,
    alignItems: 'center',
  },
  emptyMessagesText: {
    fontSize: 13,
    color: '#94A3B8',
  },
  messageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    gap: 10,
  },
  reorderColumn: {
    flexDirection: 'column',
    gap: 1,
  },
  reorderBtn: {
    padding: 2,
  },
  reorderBtnDisabled: {
    opacity: 0.25,
  },
  msgEmojiBadge: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  msgEmojiText: {
    fontSize: 16,
  },
  messageText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: '#0F172A',
  },
  messageActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  actionIconBtn: {
    padding: 6,
  },
  actionButtonsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  backupBtn: {
    flex: 1,
    height: 54,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    gap: 10,
  },
  exportBtn: {
    backgroundColor: '#2563EB',
  },
  exportBtnTitle: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  exportBtnSub: {
    color: '#BFDBFE',
    fontSize: 10,
    fontWeight: '500',
    marginTop: 1,
  },
  importBtn: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  importBtnTitle: {
    color: '#0F172A',
    fontSize: 13,
    fontWeight: '700',
  },
  importBtnSub: {
    color: '#64748B',
    fontSize: 10,
    fontWeight: '500',
    marginTop: 1,
  },
  backupBtnTextCol: {
    flex: 1,
  },
  aboutList: {
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    marginTop: 4,
  },
  aboutRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  aboutRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  aboutLabel: {
    fontSize: 14,
    color: '#334155',
    fontWeight: '500',
  },
  aboutValue: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
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
    borderRadius: 20,
    padding: 22,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
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
  modalInput: {
    height: 48,
    minHeight: 48,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingHorizontal: 12,
    fontSize: 14,
    color: '#0F172A',
    backgroundColor: '#F8FAFC',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
  },
  modalBtn: {
    flex: 1,
    height: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBtnPrimary: {
    backgroundColor: '#2563EB',
  },
  modalBtnCancel: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  modalBtnTextPrimary: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  modalBtnTextCancel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#475569',
  },
  textInput: {
    width: '100%',
    minHeight: 120,
    borderColor: '#CBD5E1',
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
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
    borderRadius: 8,
    fontSize: 12,
    fontWeight: '500',
  },
  successBanner: {
    marginTop: 12,
    color: '#15803D',
    backgroundColor: '#F0FDF4',
    padding: 10,
    borderRadius: 8,
    fontSize: 12,
    fontWeight: '500',
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
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
