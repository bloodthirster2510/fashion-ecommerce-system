import React from 'react';
import { ActivityIndicator, Clipboard, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, radii, shadows, spacing } from '../../../theme';
import type { CustomerOrder } from '../orderApi';
import {
  canConfirmReceived,
  formatCurrency,
  formatDate,
  getExtraItemText,
  getOrderDisplayState,
  getOrderItemCount,
  getPrimaryItem,
  orderNeedsPaymentAction,
  orderNeedsUserAction,
} from '../orderPresentation';

type OrderCardProps = {
  isConfirming: boolean;
  order: CustomerOrder;
  onConfirmReceived: (order: CustomerOrder) => void;
  onOpen: (order: CustomerOrder) => void;
};

const isPreviewableImage = (value?: string | null) => !!value && /^https?:\/\//i.test(value.trim());

export function OrderCard({
  isConfirming,
  order,
  onConfirmReceived,
  onOpen,
}: OrderCardProps) {
  const primaryItem = getPrimaryItem(order);
  const extraItemText = getExtraItemText(order);
  const displayState = getOrderDisplayState(order);
  const imageUri = primaryItem?.image?.trim();
  const canConfirmDelivery = canConfirmReceived(order);
  const requiresPayment = orderNeedsPaymentAction(order);
  const requiresUserAction = orderNeedsUserAction(order);
  const deadlineRemaining = order.paymentDeadlineAt
    ? new Date(order.paymentDeadlineAt).getTime() - Date.now()
    : null;
  const isDeadlineSoon = requiresPayment && deadlineRemaining !== null &&
    deadlineRemaining > 0 && deadlineRemaining <= 24 * 60 * 60 * 1000;
  const handleCopyOrderCode = () => {
    Clipboard.setString(order.orderCode);
  };

  return (
    <TouchableOpacity
      style={[
        styles.orderCard,
        requiresUserAction && styles.orderCardAttention,
        requiresPayment && styles.orderCardNeedsPayment,
      ]}
      activeOpacity={0.84}
      onPress={() => onOpen(order)}
    >
      <View style={styles.orderHeader}>
        <View style={styles.orderTitleGroup}>
          <View style={styles.orderCodeRow}>
            <Text style={styles.orderCode} numberOfLines={1}>{order.orderCode}</Text>
            <TouchableOpacity
              style={styles.copyCodeButton}
              onPress={(event) => {
                event.stopPropagation();
                handleCopyOrderCode();
              }}
              activeOpacity={0.78}
              accessibilityLabel="Sao chép mã đơn hàng"
            >
              <MaterialCommunityIcons name="content-copy" size={15} color={colors.brand} />
            </TouchableOpacity>
          </View>
          <Text style={styles.orderDate}>Đặt ngày {formatDate(order.createdAt)}</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: displayState.backgroundColor }]}>
          {requiresUserAction ? <View style={[styles.statusBadgeDot, { backgroundColor: displayState.color }]} /> : null}
          <Text style={[styles.statusBadgeText, { color: displayState.color }]}>{displayState.label}</Text>
        </View>
      </View>

      {isDeadlineSoon ? (
        <View style={styles.paymentDeadlineChip}>
          <MaterialCommunityIcons name="timer-alert-outline" size={15} color={colors.goldText} />
          <Text style={styles.paymentDeadlineChipText}>Sắp quá hạn thanh toán</Text>
        </View>
      ) : null}

      <View style={styles.productRow}>
        {isPreviewableImage(imageUri) ? (
          <Image source={{ uri: imageUri }} style={styles.productImage} resizeMode="cover" />
        ) : (
          <View style={styles.productImagePlaceholder}>
            <MaterialCommunityIcons name="tshirt-crew-outline" size={26} color={colors.textSubtle} />
          </View>
        )}

        <View style={styles.productInfo}>
          <Text style={styles.productName} numberOfLines={2}>
            {primaryItem?.name ?? 'Sản phẩm Fashionista'}
          </Text>
          <Text style={styles.productMeta} numberOfLines={1}>
            {primaryItem ? `${primaryItem.color} • ${primaryItem.size} • SL: ${primaryItem.quantity}` : 'Đang cập nhật'}
          </Text>
          {extraItemText ? <Text style={styles.extraItemText}>{extraItemText}</Text> : null}
        </View>

        <View style={styles.priceGroup}>
          <Text style={styles.totalLabel}>{getOrderItemCount(order)} món</Text>
          <Text style={styles.totalAmount}>{formatCurrency(order.totalAmount)}</Text>
        </View>
      </View>

      <View style={styles.deliveryRow}>
        <MaterialCommunityIcons
          name={displayState.icon as keyof typeof MaterialCommunityIcons.glyphMap}
          size={18}
          color={displayState.color}
        />
        <Text style={[styles.deliveryText, { color: displayState.color }]}>
          {displayState.description}
        </Text>
      </View>

      <View style={styles.cardActions}>
        <TouchableOpacity
          style={styles.secondaryAction}
          onPress={() => onOpen(order)}
          activeOpacity={0.82}
        >
          <MaterialCommunityIcons name="receipt-text-outline" size={18} color={colors.brand} />
          <Text style={styles.secondaryActionText}>Chi tiết</Text>
        </TouchableOpacity>

        {canConfirmDelivery ? (
          <TouchableOpacity
            style={styles.primaryAction}
            onPress={() => onConfirmReceived(order)}
            activeOpacity={0.82}
            disabled={isConfirming}
          >
            {isConfirming ? (
              <ActivityIndicator size="small" color={colors.white} />
            ) : (
              <MaterialCommunityIcons name="package-check" size={18} color={colors.white} />
            )}
            <Text style={styles.primaryActionText}>Đã nhận hàng</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  orderCard: {
    borderRadius: radii.sm,
    backgroundColor: colors.surface,
    padding: spacing.lg,
    ...shadows.card,
  },
  orderCardNeedsPayment: {
    borderWidth: 1,
    borderColor: colors.gold,
    backgroundColor: '#FFFCF5',
  },
  orderCardAttention: {
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  orderHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  orderTitleGroup: {
    flex: 1,
    minWidth: 0,
  },
  orderCodeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  orderCode: {
    flexShrink: 1,
    color: colors.text,
    fontSize: 17,
    lineHeight: 24,
    fontWeight: '800',
  },
  copyCodeButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.brandSoft,
  },
  orderDate: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  paymentDeadlineChip: {
    alignSelf: 'flex-start',
    marginTop: spacing.sm,
    borderRadius: radii.pill,
    backgroundColor: colors.brandSoft,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  paymentDeadlineChipText: {
    color: colors.goldText,
    fontSize: 11,
    fontWeight: '900',
  },
  statusBadge: {
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusBadgeDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: '800',
  },
  productRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.lg,
  },
  productImage: {
    width: 70,
    height: 70,
    borderRadius: radii.sm,
    backgroundColor: colors.brandSoft,
  },
  productImagePlaceholder: {
    width: 70,
    height: 70,
    borderRadius: radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F0F2F4',
  },
  productInfo: {
    flex: 1,
    minWidth: 0,
  },
  productName: {
    color: colors.text,
    fontSize: 15,
    lineHeight: 21,
    fontWeight: '800',
  },
  productMeta: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 3,
  },
  extraItemText: {
    color: colors.brand,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 4,
  },
  priceGroup: {
    alignItems: 'flex-end',
    gap: 3,
  },
  totalLabel: {
    color: colors.textMuted,
    fontSize: 12,
  },
  totalAmount: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '900',
  },
  deliveryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  deliveryText: {
    flex: 1,
    color: colors.success,
    fontSize: 13,
    fontWeight: '700',
  },
  cardActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  secondaryAction: {
    minHeight: 40,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  secondaryActionText: {
    color: colors.brand,
    fontSize: 13,
    fontWeight: '800',
  },
  primaryAction: {
    minHeight: 40,
    borderRadius: radii.sm,
    backgroundColor: colors.brand,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  primaryActionText: {
    color: colors.white,
    fontSize: 13,
    fontWeight: '900',
  },
});
