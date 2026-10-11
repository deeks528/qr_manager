import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  BackHandler,
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
import Ionicons from 'react-native-vector-icons/Ionicons';

import { ParsedUPI } from '@domain/models/ParsedUPI';
import { AvatarService } from '@domain/services/AvatarService';
import { UPIPaymentService } from '@domain/services/UPIPaymentService';
import { useQuickMessages } from '@features/settings/hooks/useQuickMessages';

interface PaymentDetailsScreenProps {
  parsedUPI: ParsedUPI;
  onBack: () => void;
  onHome?: () => void;
  onGoToSettings?: () => void;
}

export function PaymentDetailsScreen({
  parsedUPI,
  onBack,
  onHome,
  onGoToSettings,
}: PaymentDetailsScreenProps): React.JSX.Element {
  const [extraExpanded, setExtraExpanded] = useState(false);
  const [amount, setAmount] = useState(parsedUPI.amount ?? '');
  const [description, setDescription] = useState(parsedUPI.transactionNote ?? '');
  const [isPaying, setIsPaying] = useState(false);

  // Hardware back button returns to scanner
  useEffect(() => {
    const onBackPress = () => {
      onBack();
      return true;
    };
    const sub = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => sub.remove();
  }, [onBack]);

  // If the scanned QR link already contains amount or transaction note, lock them
  const isAmountFixed = Boolean(parsedUPI.amount);
  const isDescriptionFixed = Boolean(parsedUPI.transactionNote);

  const quickMessagesQuery = useQuickMessages();
  const quickMessages = quickMessagesQuery.data ?? [];

  // Payee name fallback to upiId
  const displayName = parsedUPI.payeeName?.trim() || parsedUPI.upiId;
  const initials = AvatarService.createInitials(displayName || 'UP');

  useEffect(() => {
    if (isAmountFixed) {
      handlePay();
    }
  }, [isAmountFixed]);

  // Primary / required details shown by default
  const primaryDetails = useMemo(() => {
    const list: { label: string; value: string }[] = [];
    if (parsedUPI.upiId) {
      list.push({ label: 'UPI ID', value: parsedUPI.upiId });
    }
    if (parsedUPI.payeeName) {
      list.push({ label: 'Payee Name', value: parsedUPI.payeeName });
    }
    return list;
  }, [parsedUPI]);

  // Extra parameters displayed on expanding
  const extraDetails = useMemo(() => {
    const list: { label: string; value: string }[] = [];

    if (parsedUPI.merchantCategory) {
      list.push({ label: 'Merchant Category', value: parsedUPI.merchantCategory });
    }
    if (parsedUPI.currency) {
      list.push({ label: 'Currency', value: parsedUPI.currency });
    }
    if (parsedUPI.applicationId) {
      list.push({ label: 'Application ID', value: parsedUPI.applicationId });
    }
    if (parsedUPI.transactionReference) {
      list.push({ label: 'Transaction Ref', value: parsedUPI.transactionReference });
    }
    if (parsedUPI.transactionId) {
      list.push({ label: 'Transaction ID', value: parsedUPI.transactionId });
    }
    if (parsedUPI.url) {
      list.push({ label: 'URL', value: parsedUPI.url });
    }

    // Include any custom/unknown parameters that weren't standard
    const knownKeys = new Set([
      'pa',
      'pn',
      'am',
      'tn',
      'cu',
      'mc',
      'tr',
      'tid',
      'url',
      'aid',
    ]);
    for (const [key, val] of Object.entries(parsedUPI.parameters)) {
      if (!knownKeys.has(key) && val) {
        list.push({ label: key, value: val });
      }
    }

    return list;
  }, [parsedUPI]);

  const handlePay = async () => {
    if (!parsedUPI.upiId) {
      Alert.alert('Error', 'Missing UPI ID in payment details.');
      return;
    }

    // Amount validation if provided
    const trimmedAmount = amount.trim();
    if (trimmedAmount) {
      const numAmount = parseFloat(trimmedAmount);
      if (isNaN(numAmount) || numAmount <= 0) {
        Alert.alert('Invalid Amount', 'Please enter a valid positive payment amount.');
        return;
      }
    }

    setIsPaying(true);

    try {
      const finalUri = UPIPaymentService.buildPaymentURI(parsedUPI, {
        amount: trimmedAmount || undefined,
        description: description.trim() || undefined,
      });

      console.log('Final generated UPI URI:', finalUri);
      await UPIPaymentService.openUPIPayment(finalUri);
    } catch (error: any) {
      Alert.alert(
        'Payment Failed',
        error.message || 'Could not launch UPI application.',
      );
    } finally {
      setIsPaying(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* ══ Header ══ */}
      <View style={styles.header}>
        <Pressable
          accessibilityLabel="Back to scanner"
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          onPress={onBack}
          style={styles.backButton}
        >
          <Ionicons name="chevron-back" size={26} color="#0F172A" />
        </Pressable>

        <Text style={styles.headerTitle}>Review & Pay</Text>

        {onHome ? (
          <Pressable
            accessibilityLabel="Close and return home"
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            onPress={onHome}
            style={styles.closeButton}
          >
            <Ionicons name="close" size={24} color="#64748B" />
          </Pressable>
        ) : (
          <View style={styles.headerSpacer} />
        )}
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* ══ Merchant Card ══ */}
          <View style={styles.merchantCard}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{initials}</Text>
            </View>
            <View style={styles.merchantInfo}>
              <Text style={styles.merchantName}>{displayName}</Text>
              <Text style={styles.merchantUpi}>{parsedUPI.upiId}</Text>
            </View>
          </View>

          {/* ══ Details from QR Code Card ══ */}
          <View style={styles.card}>
            <View style={styles.detailsHeader}>
              <View style={styles.detailsHeaderLeft}>
                <Ionicons name="qr-code-outline" size={18} color="#2563EB" />
                <Text style={styles.detailsHeaderTitle}>
                  Details from QR Code
                </Text>
              </View>
            </View>

            {/* Default visible required / primary details */}
            {/* <View style={styles.detailsBody}>
              {primaryDetails.map((item, index) => (
                <View
                  key={item.label}
                  style={[
                    styles.detailRow,
                    index === primaryDetails.length - 1 &&
                    extraDetails.length === 0 &&
                    styles.detailRowLast,
                  ]}
                >
                  <Text style={styles.detailLabel}>{item.label}</Text>
                  <Text style={styles.detailValue}>{item.value}</Text>
                </View>
              ))}
            </View> */}

            {/* Extra parameters (collapsible / expandable) */}
            {extraDetails.length > 0 && (
              <>
                {extraExpanded && (
                  <View style={styles.extraDetailsBody}>
                    {extraDetails.map((item, index) => (
                      <View
                        key={item.label}
                        style={[
                          styles.detailRow,
                          index === extraDetails.length - 1 && styles.detailRowLast,
                        ]}
                      >
                        <Text style={styles.detailLabel}>{item.label}</Text>
                        <Text style={styles.detailValue}>{item.value}</Text>
                      </View>
                    ))}
                  </View>
                )}

                <Pressable
                  accessibilityLabel="Toggle extra parameters"
                  onPress={() => setExtraExpanded(!extraExpanded)}
                  style={styles.expandToggleRow}
                >
                  <Text style={styles.expandToggleText}>
                    {extraExpanded ? 'Hide Details' : 'More Details'}
                  </Text>
                  <Ionicons
                    name={extraExpanded ? 'chevron-up' : 'chevron-down'}
                    size={16}
                    color="#2563EB"
                  />
                </Pressable>
              </>
            )}
          </View>

          {/* ══ Amount Card ══ */}
          <View style={styles.card}>
            <View style={styles.labelRow}>
              <Text style={styles.inputLabel}>Amount</Text>
              {isAmountFixed && (
                <View style={styles.lockedBadge}>
                  <Ionicons name="lock-closed" size={13} color="#64748B" />
                </View>
              )}
            </View>
            <View
              style={[
                styles.amountInputRow,
                isAmountFixed && styles.amountInputRowDisabled,
              ]}
            >
              <Text
                style={[
                  styles.currencySymbol,
                  isAmountFixed && styles.currencySymbolDisabled,
                ]}
              >
                ₹
              </Text>
              <TextInput
                accessibilityLabel="Payment amount"
                editable={!isAmountFixed}
                keyboardType="decimal-pad"
                onChangeText={setAmount}
                placeholder="0.00"
                placeholderTextColor="#94A3B8"
                style={[
                  styles.amountInput,
                  isAmountFixed && styles.amountInputDisabled,
                ]}
                value={amount}
              />
            </View>
          </View>

          {/* ══ Description Card ══ */}
          <View style={styles.card}>
            <View style={styles.labelRow}>
              <Text style={styles.inputLabel}>Description (optional)</Text>
              {isDescriptionFixed && (
                <View style={styles.lockedBadge}>
                  <Ionicons name="lock-closed" size={13} color="#64748B" />
                </View>
              )}
            </View>
            <TextInput
              accessibilityLabel="Payment description"
              editable={!isDescriptionFixed}
              onChangeText={setDescription}
              placeholder="Add a note or quick message"
              placeholderTextColor="#94A3B8"
              style={[
                styles.descriptionInput,
                isDescriptionFixed && styles.descriptionInputDisabled,
              ]}
              value={description}
            />

            {/* Quick Messages Row (only available if description is not locked) */}
            {!isDescriptionFixed && (
              <View style={styles.quickMessagesContainer}>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.quickMessagesScroll}
                >
                  {quickMessages.map((msg) => (
                    <Pressable
                      key={msg.id}
                      onPress={() => setDescription(msg.text)}
                      style={styles.quickMessagePill}
                    >
                      <Text style={styles.quickMessageText}>{msg.text}</Text>
                    </Pressable>
                  ))}

                  {onGoToSettings && (
                    <Pressable
                      accessibilityLabel="Manage quick messages"
                      onPress={onGoToSettings}
                      style={[styles.quickMessagePill, styles.addQuickMessagePill]}
                    >
                      <Ionicons name="add" size={16} color="#64748B" />
                    </Pressable>
                  )}
                </ScrollView>
              </View>
            )}
          </View>

          {/* ══ Pay Button ══ */}
          <Pressable
            accessibilityLabel="Pay now"
            disabled={isPaying}
            onPress={handlePay}
            style={[styles.payButton, isPaying && styles.payButtonDisabled]}
          >
            {isPaying ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <Text style={styles.payButtonText}>Pay</Text>
            )}
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    height: 56,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
  },
  backButton: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButton: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
  },
  headerSpacer: {
    width: 38,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  merchantCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 12,
    shadowColor: '#0F1D3A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  merchantInfo: {
    flex: 1,
  },
  merchantName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  merchantUpi: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 2,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 16,
    marginBottom: 12,
    shadowColor: '#0F1D3A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  detailsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  detailsHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  detailsHeaderTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  detailsBody: {
    marginTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 4,
  },
  expandToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 4,
    marginTop: 4,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  expandToggleText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#2563EB',
  },
  extraDetailsBody: {
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 4,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F8FAFC',
  },
  detailRowLast: {
    borderBottomWidth: 0,
  },
  detailLabel: {
    fontSize: 13,
    color: '#64748B',
  },
  detailValue: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0F172A',
    maxWidth: '60%',
    textAlign: 'right',
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
  },
  lockedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  lockedBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
  },
  amountInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 58,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 14,
    paddingHorizontal: 16,
    backgroundColor: '#FFFFFF',
  },
  amountInputRowDisabled: {
    backgroundColor: '#F8FAFC',
    borderColor: '#E2E8F0',
  },
  currencySymbol: {
    fontSize: 22,
    fontWeight: '700',
    color: '#0F172A',
    marginRight: 8,
  },
  currencySymbolDisabled: {
    color: '#64748B',
  },
  amountInput: {
    flex: 1,
    fontSize: 22,
    fontWeight: '700',
    color: '#0F172A',
    padding: 0,
  },
  amountInputDisabled: {
    color: '#475569',
  },
  descriptionInput: {
    height: 48,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 12,
    paddingHorizontal: 12,
    fontSize: 14,
    color: '#0F172A',
    backgroundColor: '#FFFFFF',
  },
  descriptionInputDisabled: {
    backgroundColor: '#F8FAFC',
    borderColor: '#E2E8F0',
    color: '#475569',
  },
  quickMessagesContainer: {
    marginTop: 10,
  },
  quickMessagesScroll: {
    flexDirection: 'row',
    gap: 8,
  },
  quickMessagePill: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#FFFFFF',
  },
  quickMessageText: {
    fontSize: 13,
    color: '#334155',
    fontWeight: '500',
  },
  addQuickMessagePill: {
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  payButton: {
    height: 50,
    backgroundColor: '#2563EB',
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 3,
  },
  payButtonDisabled: {
    backgroundColor: '#94A3B8',
  },
  payButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});
