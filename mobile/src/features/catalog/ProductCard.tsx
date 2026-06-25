import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, radii, shadows, spacing } from '../../theme';
import { RemoteImage } from '../../components/media/RemoteImage';
import type { CatalogProduct } from './catalogApi';

type ProductCardProps = {
  product: CatalogProduct;
  onPress?: (product: CatalogProduct) => void;
  onCartPress?: (product: CatalogProduct) => void;
};

const formatCurrency = (value: number) => {
  return `${Math.round(value).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')}đ`;
};

const isRemoteImage = (value?: string | null) => Boolean(value && /^https?:\/\//i.test(value.trim()));

const ProductCard = ({ product, onPress, onCartPress }: ProductCardProps) => {
  const imageUri = isRemoteImage(product.image) ? product.image.trim() : '';
  const originalPrice = product.originalPrice ?? product.price;

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={() => onPress?.(product)}
      activeOpacity={0.86}
      accessibilityLabel={`Xem ${product.name}`}
    >
      <View style={styles.imageWrap}>
        {imageUri ? (
          <RemoteImage uri={imageUri} style={styles.image} recyclingKey={product._id} />
        ) : (
          <View style={styles.placeholder}>
            <MaterialCommunityIcons name="tshirt-crew-outline" size={36} color={colors.brand} />
          </View>
        )}

        <View style={styles.badgeRow}>
          {product.isNew ? (
            <View style={styles.newBadge}>
              <Text style={styles.newBadgeText}>Hàng mới</Text>
            </View>
          ) : null}
          {product.isSale ? (
            <View style={styles.saleBadge}>
              <Text style={styles.saleBadgeText}>Sale</Text>
            </View>
          ) : null}
        </View>
      </View>

      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={2}>
          {product.name}
        </Text>

        <View style={styles.priceRow}>
          <View style={styles.priceCopy}>
            <Text style={styles.price}>{formatCurrency(product.finalPrice)}</Text>
            {product.isSale ? (
              <Text style={styles.originalPrice}>{formatCurrency(originalPrice)}</Text>
            ) : null}
          </View>

          <TouchableOpacity
            style={[styles.cartButton, !product.isAvailable && styles.cartButtonDisabled]}
            onPress={() => onCartPress?.(product)}
            disabled={!product.isAvailable}
            activeOpacity={0.82}
            accessibilityLabel={`Thêm ${product.name} vào giỏ hàng`}
          >
            <MaterialCommunityIcons name="cart-outline" size={18} color={colors.white} />
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    flex: 1,
    minWidth: 0,
    borderRadius: radii.sm,
    backgroundColor: colors.surface,
    overflow: 'hidden',
    ...shadows.card,
  },
  imageWrap: {
    width: '100%',
    aspectRatio: 1,
    backgroundColor: colors.brandSoft,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  placeholder: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.brandPale,
  },
  badgeRow: {
    position: 'absolute',
    top: spacing.sm,
    left: spacing.sm,
    right: spacing.sm,
    minHeight: 22,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 5,
  },
  newBadge: {
    minHeight: 22,
    borderRadius: radii.xs,
    backgroundColor: colors.white,
    paddingHorizontal: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  newBadgeText: {
    color: colors.black,
    fontSize: 10,
    lineHeight: 14,
    fontWeight: '800',
  },
  saleBadge: {
    minHeight: 22,
    borderRadius: radii.xs,
    backgroundColor: colors.danger,
    paddingHorizontal: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saleBadgeText: {
    color: colors.white,
    fontSize: 10,
    lineHeight: 14,
    fontWeight: '800',
  },
  info: {
    minHeight: 88,
    padding: spacing.md,
    justifyContent: 'space-between',
  },
  name: {
    minHeight: 36,
    color: colors.black,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
  },
  priceRow: {
    minHeight: 34,
    marginTop: spacing.sm,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  priceCopy: {
    flex: 1,
    minWidth: 0,
  },
  price: {
    color: colors.black,
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '800',
  },
  originalPrice: {
    color: colors.textMuted,
    fontSize: 11,
    lineHeight: 15,
    textDecorationLine: 'line-through',
    marginTop: 1,
  },
  cartButton: {
    width: 34,
    height: 34,
    borderRadius: radii.xs,
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cartButtonDisabled: {
    backgroundColor: colors.disabled,
  },
});

export default ProductCard;
