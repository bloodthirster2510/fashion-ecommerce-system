import React from 'react';
import {
  ActivityIndicator,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, radii, spacing } from '../../../theme';
import { EvidencePicker, type EvidenceDraft } from './EvidencePicker';

type ReturnRequestModalProps = {
  visible: boolean;
  reason: string;
  reasonError: string;
  evidenceImages: EvidenceDraft[];
  isSubmitting: boolean;
  onClose: () => void;
  onReasonChange: (value: string) => void;
  onPickEvidence: () => void;
  onRemoveEvidence: (index: number) => void;
  onSubmit: () => void;
};

export function ReturnRequestModal({
  visible,
  reason,
  reasonError,
  evidenceImages,
  isSubmitting,
  onClose,
  onReasonChange,
  onPickEvidence,
  onRemoveEvidence,
  onSubmit,
}: ReturnRequestModalProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.returnModal}>
          <View style={styles.invoiceHeader}>
            <View>
              <Text style={styles.invoiceEyebrow}>RETURN REQUEST</Text>
              <Text style={styles.invoiceTitle}>Lý do trả hàng</Text>
            </View>
            <TouchableOpacity style={styles.modalCloseButton} onPress={onClose} disabled={isSubmitting}>
              <MaterialCommunityIcons name="close" size={22} color={colors.text} />
            </TouchableOpacity>
          </View>

          <Text style={styles.returnModalHint}>
            Shop sẽ xem lý do, hình ảnh minh chứng và phản hồi trên trạng thái đơn hàng. Yêu cầu trả hàng chỉ mở trong 7 ngày sau khi giao thành công.
          </Text>
          <TextInput
            style={styles.returnReasonInput}
            value={reason}
            onChangeText={onReasonChange}
            placeholder="Nhập lý do trả hàng"
            placeholderTextColor={colors.textSubtle}
            multiline
            maxLength={500}
            textAlignVertical="top"
            editable={!isSubmitting}
          />
          <View style={styles.returnModalMetaRow}>
            <Text style={styles.returnReasonCounter}>{reason.trim().length}/500</Text>
            {reasonError ? <Text style={styles.returnReasonError}>{reasonError}</Text> : null}
          </View>
          <EvidencePicker
            images={evidenceImages}
            onPick={onPickEvidence}
            onRemove={onRemoveEvidence}
            disabled={isSubmitting}
          />

          <View style={styles.returnModalActions}>
            <TouchableOpacity
              style={styles.returnModalSecondaryButton}
              onPress={onClose}
              activeOpacity={0.84}
              disabled={isSubmitting}
            >
              <Text style={styles.returnModalSecondaryText}>Để sau</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.returnModalPrimaryButton}
              onPress={onSubmit}
              activeOpacity={0.84}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <ActivityIndicator size="small" color={colors.white} />
              ) : (
                <MaterialCommunityIcons name="send-outline" size={18} color={colors.white} />
              )}
              <Text style={styles.returnModalPrimaryText}>Gửi yêu cầu</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(33, 52, 72, 0.42)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  returnModal: {
    width: '100%',
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    padding: spacing.lg,
    gap: spacing.md,
  },
  invoiceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  invoiceEyebrow: {
    color: colors.brand,
    fontSize: 12,
    fontWeight: '900',
  },
  invoiceTitle: {
    color: colors.text,
    fontSize: 19,
    fontWeight: '900',
    marginTop: 2,
  },
  modalCloseButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.brandSoft,
  },
  returnModalHint: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 19,
  },
  returnReasonInput: {
    minHeight: 132,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.sm,
    color: colors.text,
    backgroundColor: colors.background,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: 14,
    lineHeight: 20,
  },
  returnModalMetaRow: {
    minHeight: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  returnReasonCounter: {
    color: colors.textSubtle,
    fontSize: 12,
    fontWeight: '700',
  },
  returnReasonError: {
    flex: 1,
    color: colors.danger,
    fontSize: 12,
    fontWeight: '800',
    textAlign: 'right',
  },
  returnModalActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  returnModalSecondaryButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  returnModalSecondaryText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '900',
  },
  returnModalPrimaryButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: radii.sm,
    backgroundColor: colors.brand,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  returnModalPrimaryText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '900',
  },
});
