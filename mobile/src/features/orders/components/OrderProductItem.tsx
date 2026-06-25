import React from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, radii, shadows, spacing } from '../../../theme';
import type { OrderItem } from '../orderApi';
import { formatCurrency } from '../orderPresentation';

type OrderProductItemProps = {
  item: OrderItem;
  isReviewable: boolean;
  isReviewed: boolean;
  onWriteReview: (item: OrderItem) => void;
};

const isPreviewableImage = (value?: string | null) => !!value && /^https?:\/\//i.test(value.trim());

export function OrderProductItem({ item, isReviewable, isReviewed, onWriteReview }: OrderProductItemProps) {
  const imageUri = item.image?.trim();

  return (
    <View style={styles.productCard}>
      {isPreviewableImage(imageUri) ? (
        <Image source={{ uri: imageUri }} style={styles.productImage} resizeMode="cover" />
      ) : (
        <View style={styles.productImagePlaceholder}>
          <MaterialCommunityIcons name="tshirt-crew-outline" size={26} color={colors.textSubtle} />
        </View>
      )}

      <View style={styles.productInfo}>
        <View style={styles.productTitleRow}>
          <Text style={styles.productName} numberOfLines={2}>
            {item.name}
          </Text>
          <Text style={styles.productPrice}>{formatCurrency(item.priceAtPurchased)}</Text>
        </View>
        <View style={styles.productMetaRow}>
          <Text style={styles.productMeta} numberOfLines={2}>
            {item.color} • {item.size} • {item.fitType}
          </Text>
          <Text style={styles.productQuantity}>SL: {item.quantity}</Text>
        </View>
      </View>

      {isReviewable && item._id ? (
        isReviewed ? (
          <View style={styles.reviewButton} pointerEvents="none">
            <MaterialCommunityIcons name="check-circle-outline" size={18} color={colors.textMuted} />
            <Text style={styles.reviewButtonTextMuted}>Đã đánh giá</Text>
          </View>
        ) : (
          <TouchableOpacity style={styles.reviewButton} onPress={() => onWriteReview(item)} activeOpacity={0.84}>
            <MaterialCommunityIcons name="star-outline" size={18} color={colors.brand} />
            <Text style={styles.reviewButtonText}>Viết đánh giá</Text>
          </TouchableOpacity>
        )
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  productCard: {
    borderRadius: radii.sm,
    backgroundColor: colors.surface,
    padding: spacing.md,
    flexDirection: 'row',
    gap: spacing.md,
    ...shadows.card,
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
    gap: spacing.sm,
  },
  productTitleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  productName: {
    flex: 1,
    color: colors.text,
    fontSize: 15,
    lineHeight: 21,
    fontWeight: '900',
  },
  productPrice: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '900',
  },
  productMetaRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  productMeta: {
    flex: 1,
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
  },
  productQuantity: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '700',
  },
  reviewButton: {
    alignSelf: 'flex-end',
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.surface,
  },
  reviewButtonText: {
    color: colors.brand,
    fontSize: 12,
    fontWeight: '900',
  },
  reviewButtonTextMuted: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '900',
  },
});
