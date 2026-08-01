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
  const hasExceptionalStatus = displayState.tone === 'danger';
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
        hasExceptionalStatus && styles.orderCardDanger,
      ]}
      activeOpacity={0.84}
      onPress={() => onOpen(order)}
    >
      <View style={styles.orderHeader}>
        <View style={styles.storeGroup}>
          <View style={styles.storeBadge}>
            <MaterialCommunityIcons name="shopping-outline" size={13} color={colors.white} />
            <Text style={styles.storeBadgeText}>F+</Text>
          </View>
          <Text style={styles.storeName} numberOfLines={1}>Fashionista Official Store</Text>
        </View>
        <Text style={[styles.statusText, { color: displayState.color }]} numberOfLines={1}>
          {displayState.label}
        </Text>
      </View>

      <View style={styles.orderMetaRow}>
        <View style={styles.orderCodeRow}>
          <Text style={styles.orderCode} numberOfLines={1}>#{order.orderCode}</Text>
          <TouchableOpacity
            style={styles.copyCodeButton}
            onPress={(event) => {
              event.stopPropagation();
              handleCopyOrderCode();
            }}
            activeOpacity={0.78}
            accessibilityLabel="Sao chép mã đơn hàng"
          >
            <MaterialCommunityIcons name="content-copy" size={13} color={colors.textMuted} />
          </TouchableOpacity>
        </View>
        <Text style={styles.orderDate}>{formatDate(order.createdAt)}</Text>
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
          <View style={styles.productMetaRow}>
            <Text style={styles.productMeta} numberOfLines={1}>
              {primaryItem ? `${primaryItem.color} · Size ${primaryItem.size}` : 'Đang cập nhật'}
            </Text>
            {primaryItem ? <Text style={styles.productQuantity}>x{primaryItem.quantity}</Text> : null}
          </View>
          <View style={styles.productPriceRow}>
            {extraItemText ? <Text style={styles.extraItemText}>{extraItemText}</Text> : <View />}
            {primaryItem ? (
              <Text style={styles.itemPrice}>{formatCurrency(primaryItem.priceAtPurchased)}</Text>
            ) : null}
          </View>
        </View>
      </View>

      <View style={[styles.deliveryRow, { backgroundColor: displayState.backgroundColor }]}>
        <MaterialCommunityIcons
          name={displayState.icon as keyof typeof MaterialCommunityIcons.glyphMap}
          size={17}
          color={displayState.color}
        />
        <Text style={[styles.deliveryText, { color: displayState.color }]}>
          {displayState.description}
        </Text>
      </View>

      <View style={styles.totalRow}>
        <Text style={styles.totalLabel}>Tổng số tiền ({getOrderItemCount(order)} sản phẩm):</Text>
        <Text style={styles.totalAmount}>{formatCurrency(order.totalAmount)}</Text>
      </View>

      <View style={styles.cardActions}>
        <TouchableOpacity
          style={styles.secondaryAction}
          onPress={() => onOpen(order)}
          activeOpacity={0.82}
        >
          <Text style={styles.secondaryActionText}>Xem chi tiết</Text>
        </TouchableOpacity>

        {requiresPayment ? (
          <TouchableOpacity
            style={styles.primaryAction}
            onPress={() => onOpen(order)}
            activeOpacity={0.82}
          >
            <Text style={styles.primaryActionText}>Thanh toán ngay</Text>
          </TouchableOpacity>
        ) : canConfirmDelivery ? (
          <TouchableOpacity
            style={styles.primaryAction}
            onPress={() => onConfirmReceived(order)}
            activeOpacity={0.82}
            disabled={isConfirming}
          >
            {isConfirming ? (
              <ActivityIndicator size="small" color={colors.brand} />
            ) : null}
            <Text style={styles.primaryActionText}>Đã nhận hàng</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  orderCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#ECEFF1',
    backgroundColor: colors.surface,
    padding: 14,
    ...shadows.card,
  },
  orderCardNeedsPayment: {
    borderColor: colors.gold,
    backgroundColor: colors.surface,
  },
  orderCardAttention: {
    borderColor: colors.borderStrong,
  },
  orderCardDanger: {
    borderColor: '#F2C9C9',
    backgroundColor: colors.surface,
  },
  orderHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  storeGroup: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  storeBadge: {
    height: 24,
    borderRadius: radii.xs,
    paddingHorizontal: 6,
    backgroundColor: colors.brand,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  storeBadgeText: {
    color: colors.white,
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '900',
  },
  storeName: {
    flexShrink: 1,
    color: colors.text,
    fontSize: 15,
    lineHeight: 21,
    fontWeight: '800',
  },
  statusText: {
    flexShrink: 0,
    maxWidth: '38%',
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '800',
    textAlign: 'right',
  },
  orderMetaRow: {
    minHeight: 30,
    marginTop: spacing.xs,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: '#EEF0F2',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  orderCodeRow: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  orderCode: {
    flexShrink: 1,
    color: colors.textMuted,
    fontSize: 11,
    lineHeight: 16,
    fontWeight: '700',
  },
  copyCodeButton: {
    width: 26,
    height: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  orderDate: {
    color: colors.textMuted,
    fontSize: 11,
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
  productRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: spacing.md,
    marginTop: spacing.md,
  },
  productImage: {
    width: 86,
    height: 86,
    borderRadius: radii.sm,
    backgroundColor: colors.brandSoft,
  },
  productImagePlaceholder: {
    width: 86,
    height: 86,
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
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '700',
  },
  productMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  productMeta: {
    flex: 1,
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 3,
  },
  productQuantity: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 3,
  },
  productPriceRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  extraItemText: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
  },
  itemPrice: {
    color: colors.text,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '800',
    textAlign: 'right',
  },
  totalLabel: {
    color: colors.textBody,
    fontSize: 13,
    lineHeight: 20,
  },
  totalAmount: {
    color: colors.brandDark,
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '900',
  },
  deliveryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  deliveryText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '600',
  },
  totalRow: {
    marginTop: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    flexWrap: 'wrap',
    gap: 5,
  },
  cardActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    gap: spacing.sm,
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: '#EEF0F2',
  },
  secondaryAction: {
    minHeight: 42,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    paddingHorizontal: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  secondaryActionText: {
    color: colors.textBody,
    fontSize: 13,
    fontWeight: '700',
  },
  primaryAction: {
    minHeight: 42,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.brand,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  primaryActionText: {
    color: colors.brand,
    fontSize: 13,
    fontWeight: '900',
  },
});
