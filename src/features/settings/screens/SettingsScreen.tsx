import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  ToastAndroid,
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
import { DraggableQuickMessagesList } from '../components/DraggableQuickMessagesList';
import { useProfiles } from '@features/home/hooks/useHomeProfiles';
import { ProfileType } from '@domain/models/Profile';
import { ImportService } from '@domain/services/ImportService';
import { AvatarService } from '@domain/services/AvatarService';
import { AppLogger } from '@domain/services/AppLogger';
import { UPIPaymentService } from '@domain/services/UPIPaymentService';
import { LogEntry, ScanLogEntry } from '@domain/models/LogEntry';
import { DeveloperModeService } from '@domain/services/DeveloperModeService';

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

function getScanStatusBadge(status: string): { bg: string; text: string; border: string } {
  switch (status) {
    case 'PAYMENT_LAUNCHED':
    case 'PAYMENT_SUCCESS':
      return { bg: '#DCFCE7', text: '#15803D', border: '#86EFAC' };
    case 'TRANSFORMED':
      return { bg: '#EFF6FF', text: '#1D4ED8', border: '#BFDBFE' };
    case 'PARSED':
      return { bg: '#F1F5F9', text: '#475569', border: '#CBD5E1' };
    case 'PARSE_FAILED':
    case 'PAYMENT_FAILED':
      return { bg: '#FEE2E2', text: '#B91C1C', border: '#FECACA' };
    default:
      return { bg: '#F8FAFC', text: '#64748B', border: '#E2E8F0' };
  }
}

function getLogLevelBadge(level: string): { bg: string; text: string } {
  switch (level) {
    case 'ERROR':
      return { bg: '#FEE2E2', text: '#DC2626' };
    case 'WARN':
      return { bg: '#FEF3C7', text: '#D97706' };
    case 'INFO':
      return { bg: '#EFF6FF', text: '#2563EB' };
    default:
      return { bg: '#F1F5F9', text: '#64748B' };
  }
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
  const [viewingQuickMessages, setViewingQuickMessages] = useState(false);
  const [newQuickMessageText, setNewQuickMessageText] = useState('');
  const [isDraggingQuickMessage, setIsDraggingQuickMessage] = useState(false);

  // Diagnostics & Logs / Developer Mode state (Hidden in normal UI)
  const [isDeveloperMode, setIsDeveloperMode] = useState(false);
  const [devTapCount, setDevTapCount] = useState(0);
  const lastTapTimeRef = useRef<number>(0);

  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const toastTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const [logsModalVisible, setLogsModalVisible] = useState(false);
  const [activeLogTab, setActiveLogTab] = useState<'scans' | 'system'>('scans');
  const [selectedLogLevel, setSelectedLogLevel] = useState<'ALL' | 'ERROR' | 'WARN' | 'INFO' | 'DEBUG'>('ALL');
  const [scanLogs, setScanLogs] = useState<ScanLogEntry[]>([]);
  const [systemLogs, setSystemLogs] = useState<LogEntry[]>([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);

  const showToast = (message: string) => {
    if (Platform.OS === 'android') {
      try {
        ToastAndroid.show(message, ToastAndroid.SHORT);
      } catch {}
    }
    setToastMessage(message);
    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current);
    }
    toastTimeoutRef.current = setTimeout(() => {
      setToastMessage(null);
    }, 2200);
  };

  useEffect(() => {
    if (isDeveloperMode) {
      AppLogger.getScanLogs().then(setScanLogs).catch(() => {});
      AppLogger.getAppLogs().then(setSystemLogs).catch(() => {});
    }
  }, [isDeveloperMode]);

  const handleVersionTap = () => {
    const { nextCount, lastTapTime, result } = DeveloperModeService.handleTap(
      devTapCount,
      lastTapTimeRef.current,
      isDeveloperMode
    );
    setDevTapCount(nextCount);
    lastTapTimeRef.current = lastTapTime;

    if (result.activated) {
      setIsDeveloperMode(true);
      AppLogger.info('SettingsScreen', 'Developer Mode activated via version tap gesture');
      showToast(result.message || 'You are now in Developer Mode!');
    } else if (result.message) {
      showToast(result.message);
    }
  };

  const handleDeactivateDevMode = () => {
    setIsDeveloperMode(false);
    setDevTapCount(0);
    lastTapTimeRef.current = 0;
    AppLogger.info('SettingsScreen', 'Developer Mode deactivated');
    showToast('Developer Mode deactivated');
  };

  const handleOpenLogs = async (tab: 'scans' | 'system' = 'scans') => {
    setActiveLogTab(tab);
    setIsLoadingLogs(true);
    setLogsModalVisible(true);
    try {
      const [scans, logs] = await Promise.all([
        AppLogger.getScanLogs(),
        AppLogger.getAppLogs(),
      ]);
      setScanLogs(scans);
      setSystemLogs(logs);
    } catch (err) {
      console.warn('Failed to fetch logs:', err);
    } finally {
      setIsLoadingLogs(false);
    }
  };

  const handleExportLogs = async () => {
    try {
      const report = await AppLogger.exportLogs();
      await Share.share({
        message: report,
        title: 'App Diagnostic & Scan Logs',
      });
    } catch (err) {
      Alert.alert('Export Failed', err instanceof Error ? err.message : 'Unknown error');
    }
  };

  const handleClearLogs = () => {
    Alert.alert(
      'Clear All Logs',
      'Are you sure you want to delete all recorded scan history and diagnostic logs?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            await AppLogger.clearAllLogs();
            setScanLogs([]);
            setSystemLogs([]);
            Alert.alert('Logs Cleared', 'All log history has been wiped.');
          },
        },
      ],
    );
  };

  const handlePayIntent = async (uri: string | undefined, label: string) => {
    if (!uri || !uri.trim()) {
      Alert.alert('Cannot Pay', 'No intent URI available to launch.');
      return;
    }
    try {
      AppLogger.info('SettingsScreen', `User testing manual payment from logs: ${label}`, { uri });
      await UPIPaymentService.openUPIPayment(uri.trim());
    } catch (error: any) {
      AppLogger.error('SettingsScreen', `Manual payment test failed for ${label}`, error, { uri });
      Alert.alert('Payment Launch Failed', error.message || 'Unable to open UPI payment');
    }
  };

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

  const handleAddDirectMessage = () => {
    const trimmed = newQuickMessageText.trim();
    if (trimmed) {
      addQuickMessage.mutate(trimmed);
      setNewQuickMessageText('');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {viewingQuickMessages ? (
        <>
          {/* ══ Quick Messages Screen (Screen 6) ══ */}
          <View style={styles.header}>
            <Pressable
              accessibilityLabel="Back to settings"
              onPress={() => setViewingQuickMessages(false)}
              style={styles.backButton}
            >
              <Ionicons name="arrow-back" size={22} color="#0F172A" />
            </Pressable>
            <Text style={styles.headerTitle}>Quick messages</Text>
            <View style={styles.headerSpacer} />
          </View>

          <ScrollView
            contentContainerStyle={styles.scrollContent}
            scrollEnabled={!isDraggingQuickMessage}
            showsVerticalScrollIndicator={false}
          >
            {/* Top Add Input Row */}
            <View style={styles.addMessageBar}>
              <TextInput
                accessibilityLabel="Add quick message input"
                onChangeText={setNewQuickMessageText}
                placeholder="Add a message"
                placeholderTextColor="#94A3B8"
                style={styles.addMessageInput}
                value={newQuickMessageText}
              />
              <Pressable
                accessibilityLabel="Add message"
                onPress={handleAddDirectMessage}
                style={styles.addMessagePlusButton}
              >
                <Ionicons name="add" size={22} color="#FFFFFF" />
              </Pressable>
            </View>

            {/* List */}
            <View
              style={[
                styles.groupCard,
                isDraggingQuickMessage && { overflow: 'visible', zIndex: 10 },
              ]}
            >
              {quickMessages.length === 0 ? (
                <View style={styles.emptyMessagesBox}>
                  <Text style={styles.emptyMessagesText}>
                    No quick messages yet. Type above and tap + to add.
                  </Text>
                </View>
              ) : (
                <DraggableQuickMessagesList
                  messages={quickMessages}
                  onDelete={handleDeleteMessage}
                  onDragEnd={() => setIsDraggingQuickMessage(false)}
                  onDragStart={() => setIsDraggingQuickMessage(true)}
                  onEdit={handleOpenEditMessage}
                  onReorder={(newOrderIds) => reorderQuickMessages.mutate(newOrderIds)}
                />
              )}
            </View>

            <Text style={styles.qmHelperText}>
              Drag to reorder. New messages show up on the pay screen right away.
            </Text>
          </ScrollView>
        </>
      ) : (
        <>
          {/* ══ Main Settings Screen (Screen 5) ══ */}
          <View style={styles.header}>
            <Pressable
              accessibilityLabel="Go back"
              onPress={onBack}
              style={styles.backButton}
            >
              <Ionicons name="arrow-back" size={22} color="#0F172A" />
            </Pressable>
            <Text style={styles.headerTitle}>Settings</Text>
            <View style={styles.headerSpacer} />
          </View>

          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Home Section */}
            <Text style={styles.sectionHeader}>Home</Text>
            <View style={styles.groupCard}>
              {/* Startup Profile Row */}
              <Pressable
                accessibilityLabel="Select default startup profile"
                onPress={() => setIsProfileDropdownOpen(!isProfileDropdownOpen)}
                style={[styles.groupRow, { borderBottomWidth: 1, borderBottomColor: '#F1F5F9' }]}
              >
                <Text style={styles.groupRowLabel}>Startup profile</Text>
                <View style={styles.rowRightGroup}>
                  <Text style={styles.groupRowValue}>
                    {selectedDefaultProfile ? selectedDefaultProfile.nickname : 'None'}
                  </Text>
                  <Ionicons name="chevron-down" size={16} color="#64748B" />
                </View>
              </Pressable>

              {isProfileDropdownOpen && (
                <View style={styles.dropdownMenuInline}>
                  <Pressable
                    onPress={() => handleDefaultProfileChange(null)}
                    style={[
                      styles.dropdownOptionInline,
                      !settings?.defaultProfileId && styles.dropdownOptionInlineActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.dropdownOptionInlineText,
                        !settings?.defaultProfileId && styles.dropdownOptionInlineTextActive,
                      ]}
                    >
                      None (Preview Off)
                    </Text>
                    {!settings?.defaultProfileId && (
                      <Ionicons name="checkmark-circle" size={16} color="#0D6B50" />
                    )}
                  </Pressable>

                  {activeProfiles.map((p) => {
                    const isSelected = settings?.defaultProfileId === p.id;
                    return (
                      <Pressable
                        key={p.id}
                        onPress={() => handleDefaultProfileChange(p.id)}
                        style={[
                          styles.dropdownOptionInline,
                          isSelected && styles.dropdownOptionInlineActive,
                        ]}
                      >
                        <Text
                          style={[
                            styles.dropdownOptionInlineText,
                            isSelected && styles.dropdownOptionInlineTextActive,
                          ]}
                        >
                          {p.nickname}
                        </Text>
                        {isSelected && (
                          <Ionicons name="checkmark-circle" size={16} color="#0D6B50" />
                        )}
                      </Pressable>
                    );
                  })}
                </View>
              )}

              {/* Header Slots Row */}
              <View style={styles.groupRow}>
                <Text style={styles.groupRowLabel}>Header slots</Text>
                <View style={styles.slotsRow}>
                  {([1, 2, 3, 4] as const).map((num) => {
                    const isActive = settings?.maxHeaderProfiles === num;
                    return (
                      <Pressable
                        key={num}
                        onPress={() => handleMaxHeaderChange(num)}
                        style={[styles.slotChip, isActive && styles.slotChipActive]}
                      >
                        <Text
                          style={[
                            styles.slotChipText,
                            isActive && styles.slotChipTextActive,
                          ]}
                        >
                          {num}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            </View>

            {/* Payments Section */}
            <Text style={styles.sectionHeader}>Payments</Text>
            <View style={styles.groupCard}>
              <Pressable
                accessibilityLabel="Open quick messages"
                onPress={() => setViewingQuickMessages(true)}
                style={styles.groupRow}
              >
                <Text style={styles.groupRowLabel}>Quick messages</Text>
                <View style={styles.rowRightGroup}>
                  <Text style={styles.groupRowValue}>{quickMessages.length}</Text>
                  <Ionicons name="chevron-forward" size={16} color="#94A3B8" />
                </View>
              </Pressable>
            </View>

            {/* Data Section */}
            <Text style={styles.sectionHeader}>Data</Text>
            <View style={styles.groupCard}>
              <Pressable
                accessibilityLabel="Export backup"
                disabled={exportBackup.isPending}
                onPress={handleExport}
                style={[styles.groupRow, { borderBottomWidth: 1, borderBottomColor: '#F1F5F9' }]}
              >
                <Text style={styles.groupRowLabel}>Export backup</Text>
                <Ionicons name="download-outline" size={20} color="#0D6B50" />
              </Pressable>
              <Pressable
                accessibilityLabel="Import backup"
                onPress={() => setImportModalVisible(true)}
                style={styles.groupRow}
              >
                <Text style={styles.groupRowLabel}>Import backup</Text>
                <Ionicons name="arrow-up-outline" size={20} color="#0D6B50" />
              </Pressable>
            </View>

            {/* About Section */}
            <Text style={styles.sectionHeader}>About</Text>
            <View style={styles.groupCard}>
              <Pressable
                accessibilityHint="Tap 7 times to enable developer mode"
                accessibilityLabel="Application version"
                onPress={handleVersionTap}
                style={styles.groupRow}
              >
                <Text style={styles.groupRowLabel}>Version</Text>
                <View style={styles.rowRightGroup}>
                  {isDeveloperMode && (
                    <View style={styles.devMiniBadge}>
                      <Text style={styles.devMiniBadgeText}>DEV</Text>
                    </View>
                  )}
                  <Text style={styles.groupRowValue}>1.0.0</Text>
                </View>
              </Pressable>
            </View>

            {/* ══ Diagnostics & Logs (Only in Developer Mode) ══ */}
            {isDeveloperMode && (
              <View style={{ marginTop: 12 }}>
                <View style={styles.devModePillBanner}>
                  <Text style={styles.devModePillText}>Developer mode on</Text>
                </View>

                <Text style={styles.sectionHeader}>Diagnostics & Logs</Text>

                {/* 1. Diagnostics Overview */}
                <View style={styles.groupCard}>
                  <View style={[styles.groupRow, { borderBottomWidth: 1, borderBottomColor: '#F1F5F9' }]}>
                    <Text style={styles.groupRowLabel}>Application Version</Text>
                    <Text style={styles.groupRowValue}>1.0.0 (MVP)</Text>
                  </View>
                  <View style={[styles.groupRow, { borderBottomWidth: 1, borderBottomColor: '#F1F5F9' }]}>
                    <Text style={styles.groupRowLabel}>Schema Version</Text>
                    <Text style={styles.groupRowValue}>v1 (SQLite)</Text>
                  </View>
                  <View style={[styles.groupRow, { borderBottomWidth: 1, borderBottomColor: '#F1F5F9' }]}>
                    <Text style={styles.groupRowLabel}>Storage Mode</Text>
                    <Text style={styles.groupRowValue}>SQLite & MMKV</Text>
                  </View>
                  <View style={[styles.groupRow, { borderBottomWidth: 1, borderBottomColor: '#F1F5F9' }]}>
                    <Text style={styles.groupRowLabel}>Database Status</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#10B981' }} />
                      <Text style={[styles.groupRowValue, { color: '#0D6B50', fontWeight: '700' }]}>
                        Healthy (Online)
                      </Text>
                    </View>
                  </View>
                  <View style={[styles.groupRow, { borderBottomWidth: 1, borderBottomColor: '#F1F5F9' }]}>
                    <Text style={styles.groupRowLabel}>Active Profiles</Text>
                    <Text style={styles.groupRowValue}>{activeProfiles.length} / 10</Text>
                  </View>
                  <View style={[styles.groupRow, { borderBottomWidth: 1, borderBottomColor: '#F1F5F9' }]}>
                    <Text style={styles.groupRowLabel}>Quick Messages</Text>
                    <Text style={styles.groupRowValue}>{quickMessages.length} configured</Text>
                  </View>
                  <View style={styles.groupRow}>
                    <Text style={styles.groupRowLabel}>Diagnostics</Text>
                    <Text style={styles.groupRowValue}>
                      {Platform.OS} • {scanLogs.length} scans • {systemLogs.length} events
                    </Text>
                  </View>
                </View>

                {/* 2. Logs Actions */}
                <View style={[styles.groupCard, { marginTop: 14 }]}>
                  <Pressable
                    accessibilityLabel="View logs"
                    onPress={() => handleOpenLogs('scans')}
                    style={[styles.groupRow, { borderBottomWidth: 1, borderBottomColor: '#F1F5F9' }]}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <Ionicons name="document-text-outline" size={18} color="#0F172A" />
                      <Text style={styles.groupRowLabel}>View Logs</Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text style={styles.groupRowValue}>
                        {scanLogs.length} scans, {systemLogs.length} events
                      </Text>
                      <Ionicons name="chevron-forward" size={16} color="#94A3B8" />
                    </View>
                  </Pressable>
                  <Pressable
                    accessibilityLabel="Export logs"
                    onPress={handleExportLogs}
                    style={[styles.groupRow, { borderBottomWidth: 1, borderBottomColor: '#F1F5F9' }]}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <Ionicons name="share-outline" size={18} color="#0D6B50" />
                      <Text style={styles.groupRowLabel}>Export Logs</Text>
                    </View>
                    <Ionicons name="arrow-up-outline" size={19} color="#0D6B50" />
                  </Pressable>
                  <Pressable
                    accessibilityLabel="Clear logs"
                    onPress={handleClearLogs}
                    style={styles.groupRow}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <Ionicons name="trash-outline" size={18} color="#DC2626" />
                      <Text style={[styles.groupRowLabel, { color: '#DC2626' }]}>Clear Logs</Text>
                    </View>
                    <Ionicons name="trash-outline" size={18} color="#DC2626" />
                  </Pressable>
                </View>

                {/* 3. Deactivate Developer Mode Button */}
                <Pressable
                  accessibilityLabel="Deactivate developer mode"
                  onPress={handleDeactivateDevMode}
                  style={styles.deactivateDevBtn}
                >
                  <Ionicons name="power-outline" size={16} color="#DC2626" style={{ marginRight: 6 }} />
                  <Text style={styles.deactivateDevBtnText}>Deactivate Developer Mode</Text>
                </Pressable>
              </View>
            )}
          </ScrollView>
        </>
      )}

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

      {/* ══ Diagnostics & Logs Modal ══ */}
      <Modal
        animationType="slide"
        onRequestClose={() => setLogsModalVisible(false)}
        transparent={false}
        visible={logsModalVisible}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: '#F8FAFC' }}>
          {/* Header */}
          <View style={styles.logsModalHeader}>
            <Pressable
              accessibilityLabel="Close logs"
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              onPress={() => setLogsModalVisible(false)}
              style={styles.logsModalCloseBtn}
            >
              <Ionicons name="close" size={24} color="#0F172A" />
            </Pressable>
            <Text style={styles.logsModalTitle}>Diagnostics & Logs</Text>
            <Pressable
              accessibilityLabel="Share all logs"
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              onPress={handleExportLogs}
              style={styles.logsModalShareBtn}
            >
              <Ionicons name="share-outline" size={22} color="#2563EB" />
            </Pressable>
          </View>

          {/* Tab selector */}
          <View style={styles.logsTabRow}>
            <Pressable
              onPress={() => setActiveLogTab('scans')}
              style={[styles.logsTabBtn, activeLogTab === 'scans' && styles.logsTabBtnActive]}
            >
              <Ionicons
                name="qr-code-outline"
                size={16}
                color={activeLogTab === 'scans' ? '#2563EB' : '#64748B'}
              />
              <Text
                style={[
                  styles.logsTabBtnText,
                  activeLogTab === 'scans' && styles.logsTabBtnTextActive,
                ]}
              >
                Scan History ({scanLogs.length})
              </Text>
            </Pressable>

            <Pressable
              onPress={() => setActiveLogTab('system')}
              style={[styles.logsTabBtn, activeLogTab === 'system' && styles.logsTabBtnActive]}
            >
              <Ionicons
                name="warning-outline"
                size={16}
                color={activeLogTab === 'system' ? '#2563EB' : '#64748B'}
              />
              <Text
                style={[
                  styles.logsTabBtnText,
                  activeLogTab === 'system' && styles.logsTabBtnTextActive,
                ]}
              >
                System Logs ({systemLogs.length})
              </Text>
            </Pressable>
          </View>

          {/* Level Filter for System Logs */}
          {activeLogTab === 'system' && (
            <View style={styles.logLevelFilterRow}>
              {(['ALL', 'ERROR', 'WARN', 'INFO', 'DEBUG'] as const).map((lvl) => (
                <Pressable
                  key={lvl}
                  onPress={() => setSelectedLogLevel(lvl)}
                  style={[
                    styles.logLevelFilterPill,
                    selectedLogLevel === lvl && styles.logLevelFilterPillActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.logLevelFilterText,
                      selectedLogLevel === lvl && styles.logLevelFilterTextActive,
                    ]}
                  >
                    {lvl}
                  </Text>
                </Pressable>
              ))}
            </View>
          )}

          {/* Tab Content */}
          <ScrollView contentContainerStyle={styles.logsScrollContent}>
            {activeLogTab === 'scans' ? (
              scanLogs.length === 0 ? (
                <View style={styles.emptyLogsContainer}>
                  <Ionicons name="scan-circle-outline" size={48} color="#94A3B8" />
                  <Text style={styles.emptyLogsTitle}>No scans recorded yet</Text>
                  <Text style={styles.emptyLogsSub}>
                    Scan a QR code from camera or gallery to see intent history here.
                  </Text>
                </View>
              ) : (
                scanLogs.map((scan) => {
                  const badge = getScanStatusBadge(scan.status);
                  return (
                    <View key={scan.id} style={styles.scanLogCard}>
                      <View style={styles.scanLogCardHeader}>
                        <View style={styles.scanLogBadgeRow}>
                          <View
                            style={[
                              styles.sourceBadge,
                              scan.source === 'gallery' ? styles.galleryBadge : styles.cameraBadge,
                            ]}
                          >
                            <Ionicons
                              name={scan.source === 'gallery' ? 'image-outline' : 'camera-outline'}
                              size={12}
                              color={scan.source === 'gallery' ? '#7C3AED' : '#0369A1'}
                            />
                            <Text
                              style={[
                                styles.sourceBadgeText,
                                { color: scan.source === 'gallery' ? '#7C3AED' : '#0369A1' },
                              ]}
                            >
                              {scan.source.toUpperCase()}
                            </Text>
                          </View>

                          <View
                            style={[
                              styles.statusBadge,
                              { backgroundColor: badge.bg, borderColor: badge.border },
                            ]}
                          >
                            <Text style={[styles.statusBadgeText, { color: badge.text }]}>
                              {scan.status}
                            </Text>
                          </View>
                        </View>
                        <Text style={styles.scanLogTime}>
                          {new Date(scan.timestamp).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit',
                          })}
                        </Text>
                      </View>

                      {/* Scanned Intent */}
                      <View style={styles.intentHeaderRow}>
                        <Text style={styles.intentFieldLabel}>1. Scanned Intent (Raw QR):</Text>
                        <Pressable
                          accessibilityLabel="Pay Scanned Raw Intent"
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                          onPress={() => handlePayIntent(scan.scannedIntent, 'Scanned Intent (Raw QR)')}
                          style={styles.payIntentButton}
                        >
                          <Ionicons name="flash-outline" size={13} color="#2563EB" />
                          <Text style={styles.payIntentButtonText}>Pay Raw</Text>
                        </Pressable>
                      </View>
                      <View style={styles.intentBox}>
                        <Text selectable style={styles.intentText}>
                          {scan.scannedIntent}
                        </Text>
                      </View>

                      {/* Transformed Intent */}
                      <View style={styles.intentHeaderRow}>
                        <Text style={styles.intentFieldLabel}>2. Transformed Intent (Payment URL):</Text>
                        {scan.transformedIntent ? (
                          <Pressable
                            accessibilityLabel="Pay Transformed Intent"
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                            onPress={() => handlePayIntent(scan.transformedIntent, 'Transformed Intent (Payment URL)')}
                            style={[styles.payIntentButton, styles.payIntentTransformedButton]}
                          >
                            <Ionicons name="paper-plane-outline" size={13} color="#15803D" />
                            <Text style={[styles.payIntentButtonText, { color: '#15803D' }]}>Pay Transformed</Text>
                          </Pressable>
                        ) : null}
                      </View>
                      <View
                        style={[
                          styles.intentBox,
                          {
                            backgroundColor: scan.transformedIntent ? '#F0FDF4' : '#F8FAFC',
                            borderColor: scan.transformedIntent ? '#BBF7D0' : '#E2E8F0',
                          },
                        ]}
                      >
                        <Text
                          selectable
                          style={[
                            styles.intentText,
                            { color: scan.transformedIntent ? '#166534' : '#94A3B8' },
                          ]}
                        >
                          {scan.transformedIntent || 'Not transformed yet'}
                        </Text>
                      </View>

                      {/* Overrides if any */}
                      {scan.overrides && (scan.overrides.amount || scan.overrides.description) && (
                        <View style={styles.scanOverridesRow}>
                          {scan.overrides.amount && (
                            <Text style={styles.overridePill}>Amount: ₹{scan.overrides.amount}</Text>
                          )}
                          {scan.overrides.description && (
                            <Text style={styles.overridePill}>Note: {scan.overrides.description}</Text>
                          )}
                        </View>
                      )}

                      {/* Error message if failed */}
                      {scan.errorMessage && (
                        <View style={styles.scanErrorBox}>
                          <Ionicons name="alert-circle" size={14} color="#DC2626" />
                          <Text style={styles.scanErrorText}>{scan.errorMessage}</Text>
                        </View>
                      )}
                    </View>
                  );
                })
              )
            ) : (() => {
              const displayedLogs = selectedLogLevel === 'ALL'
                ? systemLogs
                : systemLogs.filter((log) => log.level === selectedLogLevel);

              if (displayedLogs.length === 0) {
                return (
                  <View style={styles.emptyLogsContainer}>
                    <Ionicons name="filter-outline" size={48} color="#94A3B8" />
                    <Text style={styles.emptyLogsTitle}>No {selectedLogLevel} logs</Text>
                    <Text style={styles.emptyLogsSub}>
                      {selectedLogLevel === 'ALL'
                        ? 'All operations are running smoothly.'
                        : `No logs matching the ${selectedLogLevel} level filter.`}
                    </Text>
                  </View>
                );
              }

              return displayedLogs.map((log) => {
                const badge = getLogLevelBadge(log.level);
                return (
                  <View key={log.id} style={styles.systemLogCard}>
                    <View style={styles.systemLogHeader}>
                      <View style={[styles.levelBadge, { backgroundColor: badge.bg }]}>
                        <Text style={[styles.levelBadgeText, { color: badge.text }]}>
                          {log.level}
                        </Text>
                      </View>
                      <Text style={styles.systemLogTag}>[{log.tag}]</Text>
                      <Text style={styles.systemLogTime}>
                        {new Date(log.timestamp).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit',
                        })}
                      </Text>
                    </View>
                    <Text style={styles.systemLogMessage}>{log.message}</Text>
                    {log.details && (
                      <Text style={styles.systemLogDetails}>
                        {typeof log.details === 'string'
                          ? log.details
                          : JSON.stringify(log.details, null, 2)}
                      </Text>
                    )}
                    {log.errorStack && (
                      <Text style={styles.systemLogStack}>{log.errorStack}</Text>
                    )}
                  </View>
                );
              });
            })()}
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* ══ Floating Toast Alert ══ */}
      {toastMessage && (
        <View pointerEvents="none" style={styles.floatingToast}>
          <Ionicons name="information-circle" size={17} color="#93C5FD" style={{ marginRight: 6 }} />
          <Text style={styles.floatingToastText}>{toastMessage}</Text>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2EDE8',
  },
  header: {
    height: 52,
    backgroundColor: '#F2EDE8',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  backButton: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0F172A',
  },
  headerSpacer: {
    width: 38,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 40,
  },
  sectionHeader: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
    marginTop: 18,
    marginBottom: 8,
  },
  groupCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#EAE6E1',
    overflow: 'hidden',
  },
  groupRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  groupRowLabel: {
    fontSize: 15,
    color: '#0F172A',
    fontWeight: '500',
  },
  groupRowValue: {
    fontSize: 14,
    color: '#64748B',
    fontWeight: '500',
  },
  rowRightGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dropdownMenuInline: {
    backgroundColor: '#F8FAFC',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    paddingVertical: 4,
  },
  dropdownOptionInline: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  dropdownOptionInlineActive: {
    backgroundColor: '#E6F4F0',
  },
  dropdownOptionInlineText: {
    fontSize: 14,
    color: '#334155',
  },
  dropdownOptionInlineTextActive: {
    color: '#0D6B50',
    fontWeight: '700',
  },
  slotsRow: {
    flexDirection: 'row',
    gap: 6,
  },
  slotChip: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  slotChipActive: {
    backgroundColor: '#0D6B50',
    borderColor: '#0D6B50',
  },
  slotChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
  },
  slotChipTextActive: {
    color: '#FFFFFF',
  },
  devMiniBadge: {
    backgroundColor: '#E6F4F0',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  devMiniBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#0D6B50',
  },
  devModePillBanner: {
    alignSelf: 'flex-start',
    backgroundColor: '#E6F4F0',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 14,
    marginBottom: 10,
  },
  devModePillText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0D6B50',
  },
  deactivateDevBtn: {
    marginTop: 16,
    height: 46,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  deactivateDevBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#475569',
  },
  addMessageBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 16,
  },
  addMessageInput: {
    flex: 1,
    height: 48,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 14,
    fontSize: 15,
    color: '#0F172A',
  },
  addMessagePlusButton: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#0D6B50',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyMessagesBox: {
    paddingVertical: 24,
    alignItems: 'center',
  },
  emptyMessagesText: {
    fontSize: 13,
    color: '#94A3B8',
  },
  qmRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
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
  qmRowTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
  },
  qmRowSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  messageActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  actionIconBtn: {
    padding: 6,
  },
  qmHelperText: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 12,
    lineHeight: 18,
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
    borderColor: '#E2E8F0',
    borderRadius: 12,
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
    backgroundColor: '#0D6B50',
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
    borderColor: '#E2E8F0',
    borderWidth: 1,
    borderRadius: 12,
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
    backgroundColor: '#0D6B50',
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
  logsModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  logsModalCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F1F5F9',
  },
  logsModalTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0F172A',
  },
  logsModalShareBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E6F4F0',
  },
  logsTabRow: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    gap: 12,
  },
  logsTabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#F8FAFC',
    gap: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  logsTabBtnActive: {
    backgroundColor: '#E6F4F0',
    borderColor: '#0D6B50',
  },
  logsTabBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
  },
  logsTabBtnTextActive: {
    color: '#0D6B50',
    fontWeight: '700',
  },
  logsScrollContent: {
    padding: 16,
    gap: 12,
    paddingBottom: 40,
  },
  scanLogCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  scanLogCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  scanLogBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sourceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  cameraBadge: {
    backgroundColor: '#F0F9FF',
    borderColor: '#BAE6FD',
  },
  galleryBadge: {
    backgroundColor: '#F5F3FF',
    borderColor: '#DDD6FE',
  },
  sourceBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  scanLogTime: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '500',
  },
  intentHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
    marginBottom: 4,
  },
  intentFieldLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },
  payIntentButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#E6F4F0',
    borderWidth: 1,
    borderColor: '#A8D5C5',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  payIntentTransformedButton: {
    backgroundColor: '#F0FDF4',
    borderColor: '#BBF7D0',
  },
  payIntentButtonText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0D6B50',
  },
  intentBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  intentText: {
    fontSize: 12,
    fontFamily: 'monospace',
    color: '#0F172A',
    lineHeight: 16,
  },
  scanOverridesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
  },
  overridePill: {
    fontSize: 11,
    fontWeight: '600',
    color: '#0D6B50',
    backgroundColor: '#E6F4F0',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  scanErrorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
    backgroundColor: '#FEF2F2',
    padding: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  scanErrorText: {
    fontSize: 12,
    color: '#DC2626',
    fontWeight: '500',
    flex: 1,
  },
  systemLogCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  systemLogHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  levelBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  levelBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  systemLogTag: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
  },
  systemLogTime: {
    fontSize: 11,
    color: '#94A3B8',
    marginLeft: 'auto',
  },
  systemLogMessage: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0F172A',
    lineHeight: 18,
  },
  systemLogDetails: {
    fontSize: 11,
    fontFamily: 'monospace',
    color: '#475569',
    backgroundColor: '#F8FAFC',
    padding: 8,
    borderRadius: 6,
    marginTop: 6,
  },
  systemLogStack: {
    fontSize: 10,
    fontFamily: 'monospace',
    color: '#DC2626',
    backgroundColor: '#FEF2F2',
    padding: 8,
    borderRadius: 6,
    marginTop: 6,
  },
  emptyLogsContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 20,
  },
  emptyLogsTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
    marginTop: 12,
  },
  emptyLogsSub: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 18,
  },
  floatingToast: {
    position: 'absolute',
    bottom: 28,
    alignSelf: 'center',
    backgroundColor: '#0F172A',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 24,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 9999,
  },
  floatingToastText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  logLevelFilterRow: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingBottom: 10,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  logLevelFilterPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  logLevelFilterPillActive: {
    backgroundColor: '#EFF6FF',
    borderColor: '#2563EB',
  },
  logLevelFilterText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
  },
  logLevelFilterTextActive: {
    color: '#2563EB',
    fontWeight: '700',
  },
});

