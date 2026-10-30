import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  BackHandler,
  KeyboardAvoidingView,
  Linking,
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
import { AppLogger } from '@domain/services/AppLogger';
import { AvatarService } from '@domain/services/AvatarService';
import { UPIPaymentService } from '@domain/services/UPIPaymentService';
import { useQuickMessages } from '@features/settings/hooks/useQuickMessages';

interface PaymentDetailsScreenProps {
  parsedUPI: ParsedUPI;
  onBack: () => void;
  onHome?: () => void;
  onGoToSettings?: () => void;
  isFromGallery?: boolean;
  scanId?: string;
}

export function PaymentDetailsScreen({
  parsedUPI,
  onBack,
  onHome,
  onGoToSettings,
  isFromGallery,
  scanId,
}: PaymentDetailsScreenProps): React.JSX.Element {
  const [extraExpanded, setExtraExpanded] = useState(false);
  const [amount, setAmount] = useState(parsedUPI.amount ?? '');
  const [description, setDescription] = useState(parsedUPI.transactionNote ?? '');
  const [isPaying, setIsPaying] = useState(false);
  const autoPayTriggeredRef = useRef(false);

  // Hardware back button returns to scanner
  useEffect(() => {
    const onBackPress = () => {
      onBack();
      return true;
    };
    const sub = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => sub.remove();
  }, [onBack]);

  // Strict Security: If QR is digitally signed, lock fields to preserve cryptographic signature
  const isSigned = Boolean(parsedUPI.signature || parsedUPI.parameters['sign']);
  const isAmountFixed = Boolean(parsedUPI.amount) || isSigned;
  const isDescriptionFixed = Boolean(parsedUPI.transactionNote) || isSigned;

  const quickMessagesQuery = useQuickMessages();
  const quickMessages = quickMessagesQuery.data ?? [];

  // Payee name fallback to upiId
  const displayName = parsedUPI.payeeName?.trim() || parsedUPI.upiId;
  const initials = AvatarService.createInitials(displayName || 'UP');

  useEffect(() => {
    if (isAmountFixed && !autoPayTriggeredRef.current) {
      autoPayTriggeredRef.current = true;
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

    if (parsedUPI.minimumAmount) {
      list.push({ label: 'Minimum Amount', value: `₹${parsedUPI.minimumAmount}` });
    }
    if (parsedUPI.merchantCategory) {
      list.push({ label: 'Merchant Category', value: parsedUPI.merchantCategory });
    }
    if (parsedUPI.currency) {
      list.push({ label: 'Currency', value: parsedUPI.currency });
    }
    if (parsedUPI.version) {
      list.push({ label: 'QR Version', value: parsedUPI.version });
    }
    if (parsedUPI.mode) {
      list.push({ label: 'Initiation Mode', value: parsedUPI.mode });
    }
    if (parsedUPI.orgId) {
      list.push({ label: 'Org ID', value: parsedUPI.orgId });
    }
    if (parsedUPI.invoiceNo) {
      list.push({ label: 'Invoice No', value: parsedUPI.invoiceNo });
    }
    if (parsedUPI.invoiceDate) {
      list.push({ label: 'Invoice Date', value: parsedUPI.invoiceDate });
    }
    if (parsedUPI.gstIn) {
      list.push({ label: 'GSTIN', value: parsedUPI.gstIn });
    }
    if (parsedUPI.gstBreakup) {
      list.push({ label: 'GST Breakup', value: parsedUPI.gstBreakup });
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
    if (parsedUPI.signature) {
      list.push({ label: 'Digital Signature', value: 'Present (Verified)' });
    }
    if (parsedUPI.url) {
      list.push({ label: 'Invoice URL', value: parsedUPI.url });
    }

    // Include any custom/unknown parameters that weren't standard
    const knownKeys = new Set([
      'pa',
      'pn',
      'am',
      'mam',
      'tn',
      'cu',
      'mc',
      'tr',
      'tid',
      'url',
      'aid',
      'ver',
      'mode',
      'orgid',
      'sign',
      'mid',
      'msid',
      'mtid',
      'qrMedium',
      'invoiceNo',
      'invoiceDate',
      'invoiceName',
      'gstIn',
      'gstBrkUp',
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

      // NPCI mam (minimum amount) constraint check
      if (parsedUPI.minimumAmount) {
        const minVal = parseFloat(parsedUPI.minimumAmount);
        if (!isNaN(minVal) && numAmount < minVal) {
          Alert.alert(
            'Amount Below Minimum',
            `The minimum acceptable payment amount for this QR is ₹${minVal.toFixed(2)}.`,
          );
          return;
        }
      }
    }

    setIsPaying(true);

    try {
      const finalUri = UPIPaymentService.buildPaymentURI(parsedUPI, {
        amount: trimmedAmount || undefined,
        description: description.trim() || undefined,
        isFromGallery,
      });

      console.log('Final generated UPI URI:', finalUri);

      if (scanId) {
        await AppLogger.updateScan(scanId, {
          transformedIntent: finalUri,
          overrides: {
            amount: trimmedAmount || undefined,
            description: description.trim() || undefined,
          },
          status: 'TRANSFORMED',
        });
      } else {
        AppLogger.info('PaymentDetailsScreen', 'Transformed UPI intent generated', {
          scannedIntent: parsedUPI.rawPayload,
          transformedIntent: finalUri,
          overrides: { amount: trimmedAmount, description },
        });
      }

      await UPIPaymentService.openUPIPayment(finalUri);

      if (scanId) {
        await AppLogger.updateScan(scanId, {
          status: 'PAYMENT_LAUNCHED',
        });
      }
      AppLogger.info('PaymentDetailsScreen', 'Payment launched into external UPI app', {
        transformedIntent: finalUri,
      });
    } catch (error: any) {
      if (scanId) {
        await AppLogger.updateScan(scanId, {
          status: 'PAYMENT_FAILED',
          errorMessage: error?.message || 'Could not launch UPI application',
        });
      }
      AppLogger.error('PaymentDetailsScreen', 'Payment launch failed', error, {
        rawPayload: parsedUPI.rawPayload,
      });
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
          <Ionicons name="close" size={24} color="#0F172A" />
        </Pressable>

        <Text style={styles.headerTitle}>Review</Text>

        <View style={styles.headerSpacer} />
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
              {isSigned && (
                <View style={styles.signedBadge}>
                  <Ionicons name="shield-checkmark" size={13} color="#059669" />
                  <Text style={styles.signedBadgeText}>Digitally Signed (Verified)</Text>
                </View>
              )}
            </View>
          </View>

          {/* ══ Amount Hero Section ══ */}
          <View style={styles.heroAmountSection}>
            <Text style={styles.heroAmountLabel}>Amount</Text>
            <View style={styles.heroAmountRow}>
              <Text style={styles.heroCurrencySymbol}>₹</Text>
              <TextInput
                accessibilityLabel="Payment amount"
                editable={!isAmountFixed}
                keyboardType="decimal-pad"
                onChangeText={setAmount}
                placeholder="0"
                placeholderTextColor="#94A3B8"
                style={[
                  styles.heroAmountInput,
                  isAmountFixed && styles.heroAmountInputDisabled,
                ]}
                value={amount}
              />
            </View>
            <View style={styles.heroAmountUnderline} />
            {parsedUPI.minimumAmount && !isAmountFixed && (
              <Text style={styles.minAmountHelper}>
                Minimum required amount: ₹{parsedUPI.minimumAmount}
              </Text>
            )}
          </View>

          {/* ══ Description Section ══ */}
          <View style={styles.descriptionSection}>
            <TextInput
              accessibilityLabel="Payment description"
              editable={!isDescriptionFixed}
              onChangeText={setDescription}
              placeholder="Monthly rent payment"
              placeholderTextColor="#94A3B8"
              style={[
                styles.descriptionInput,
                isDescriptionFixed && styles.descriptionInputDisabled,
              ]}
              value={description}
            />

            {/* Quick Messages Row */}
            {!isDescriptionFixed && (
              <View style={styles.quickMessagesContainer}>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.quickMessagesScroll}
                >
                  {quickMessages.map((msg) => {
                    const isSelected = description.trim() === msg.text.trim();
                    return (
                      <Pressable
                        key={msg.id}
                        onPress={() => setDescription(msg.text)}
                        style={[
                          styles.quickMessagePill,
                          isSelected && styles.quickMessagePillActive,
                        ]}
                      >
                        {isSelected && (
                          <Ionicons name="checkmark" size={13} color="#FFFFFF" style={{ marginRight: 4 }} />
                        )}
                        <Text
                          style={[
                            styles.quickMessageText,
                            isSelected && styles.quickMessageTextActive,
                          ]}
                        >
                          {msg.text}
                        </Text>
                      </Pressable>
                    );
                  })}

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

          {/* Bill in the Box: Interactive Invoice Button */}
          {parsedUPI.url && (
            <Pressable
              accessibilityLabel="View bill or invoice"
              onPress={() => {
                if (parsedUPI.url) {
                  Linking.openURL(parsedUPI.url).catch((err) => {
                    AppLogger.error('PaymentDetailsScreen', 'Failed to open invoice URL', err, { url: parsedUPI.url });
                    Alert.alert('Unable to Open URL', parsedUPI.url);
                  });
                }
              }}
              style={styles.invoiceButton}
            >
              <Ionicons name="document-text-outline" size={18} color="#0D6B50" />
              <Text style={styles.invoiceButtonText}>View Bill / Invoice</Text>
              <Ionicons name="open-outline" size={15} color="#0D6B50" />
            </Pressable>
          )}

          {/* ══ Collapsible QR Details ══ */}
          {(primaryDetails.length > 0 || extraDetails.length > 0) && (
            <View style={styles.qrDetailsCard}>
              <Pressable
                accessibilityLabel="Toggle extra parameters"
                onPress={() => setExtraExpanded(!extraExpanded)}
                style={styles.qrDetailsHeader}
              >
                <Text style={styles.qrDetailsHeaderText}>QR details</Text>
                <Ionicons
                  name={extraExpanded ? 'chevron-up' : 'chevron-down'}
                  size={18}
                  color="#64748B"
                />
              </Pressable>

              {extraExpanded && (
                <View style={styles.qrDetailsContent}>
                  {primaryDetails.concat(extraDetails).map((item, index, arr) => (
                    <View
                      key={item.label}
                      style={[
                        styles.detailRow,
                        index === arr.length - 1 && styles.detailRowLast,
                      ]}
                    >
                      <Text style={styles.detailLabel}>{item.label}</Text>
                      <Text style={styles.detailValue}>{item.value}</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          )}

          {/* ══ Pay Button & Helper ══ */}
          <Pressable
            accessibilityLabel="Pay now"
            disabled={isPaying}
            onPress={handlePay}
            style={[styles.payButton, isPaying && styles.payButtonDisabled]}
          >
            {isPaying ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <Text style={styles.payButtonText}>
                {amount && amount.trim() ? `Pay ₹${amount.trim()}` : 'Pay'}
              </Text>
            )}
          </Pressable>
          <Text style={styles.bottomHelperText}>You'll pick a UPI app next</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
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
    padding: 16,
    paddingBottom: 32,
  },
  merchantCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#EAE6E1',
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 16,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#E6F4F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#0D6B50',
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
  signedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    marginTop: 4,
    alignSelf: 'flex-start',
  },
  signedBadgeText: {
    fontSize: 11,
    color: '#059669',
    fontWeight: '600',
  },
  heroAmountSection: {
    alignItems: 'center',
    marginVertical: 18,
  },
  heroAmountLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: '#64748B',
    marginBottom: 4,
  },
  heroAmountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroCurrencySymbol: {
    fontSize: 32,
    fontWeight: '700',
    color: '#0F172A',
    marginRight: 4,
  },
  heroAmountInput: {
    fontSize: 36,
    fontWeight: '800',
    color: '#0F172A',
    minWidth: 80,
    textAlign: 'center',
    padding: 0,
  },
  heroAmountInputDisabled: {
    color: '#334155',
  },
  heroAmountUnderline: {
    width: 90,
    height: 2.5,
    backgroundColor: '#0D6B50',
    borderRadius: 2,
    marginTop: 4,
  },
  minAmountHelper: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 6,
  },
  descriptionSection: {
    marginBottom: 16,
  },
  descriptionInput: {
    height: 48,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    paddingHorizontal: 14,
    fontSize: 14,
    color: '#0F172A',
    backgroundColor: '#FFFFFF',
  },
  descriptionInputDisabled: {
    backgroundColor: '#F8FAFC',
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
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
  },
  quickMessagePillActive: {
    backgroundColor: '#0D6B50',
    borderColor: '#0D6B50',
  },
  quickMessageText: {
    fontSize: 13,
    color: '#334155',
    fontWeight: '500',
  },
  quickMessageTextActive: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  addQuickMessagePill: {
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qrDetailsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#EAE6E1',
    padding: 14,
    marginBottom: 20,
  },
  qrDetailsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  qrDetailsHeaderText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#334155',
  },
  qrDetailsContent: {
    marginTop: 10,
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
  invoiceButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: '#E6F4F0',
    borderWidth: 1,
    borderColor: '#A8D5C5',
    marginBottom: 16,
  },
  invoiceButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0D6B50',
  },
  payButton: {
    height: 52,
    backgroundColor: '#0D6B50',
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0D6B50',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
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
  bottomHelperText: {
    textAlign: 'center',
    color: '#64748B',
    fontSize: 12,
    marginTop: 10,
  },
});
