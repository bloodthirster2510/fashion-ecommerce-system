import React from 'react';
import { Animated, Easing, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, radii, shadows, spacing } from '../../theme';
import { RemoteImage } from '../../components/media/RemoteImage';
import type { CatalogProduct } from './catalogApi';

type ProductCardProps = {
  product: CatalogProduct;
  animationIndex?: number;
  onPress?: (product: CatalogProduct) => void;
  onCartPress?: (product: CatalogProduct) => void;
};

const formatCurrency = (value: number) => {
  return `${Math.round(value).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')}đ`;
};

const formatSoldQuantity = (value: number) => {
  const quantity = Math.max(0, Math.floor(Number.isFinite(value) ? value : 0));

  if (quantity < 1_000) return quantity.toString();

  const divisor = quantity >= 1_000_000 ? 1_000_000 : 1_000;
  const suffix = quantity >= 1_000_000 ? 'tr' : 'k';
  const compactValue = quantity / divisor;
  const roundedValue = compactValue >= 100
    ? Math.floor(compactValue)
    : Math.floor(compactValue * 10) / 10;

  return `${String(roundedValue).replace('.', ',')}${suffix}+`;
};

const isRemoteImage = (value?: string | null) => Boolean(value && /^https?:\/\//i.test(value.trim()));

const ProductCard = ({ product, animationIndex, onPress, onCartPress }: ProductCardProps) => {
  const imageUri = isRemoteImage(product.image) ? product.image.trim() : '';
  const originalPrice = product.originalPrice ?? product.price;
  const shouldAnimateEntrance = animationIndex !== undefined && animationIndex < 6;
  const entrance = React.useRef(new Animated.Value(shouldAnimateEntrance ? 0 : 1)).current;
  const pressScale = React.useRef(new Animated.Value(1)).current;
  const productGender = product.category?.gender;
  const genderLabel = productGender === 'male' ? 'NAM' : productGender === 'female' ? 'NỮ' : 'UNISEX';
  const genderIcon = productGender === 'male'
    ? 'gender-male'
    : productGender === 'female'
      ? 'gender-female'
      : 'gender-male-female';

  React.useEffect(() => {
    if (!shouldAnimateEntrance) return;

    const animation = Animated.timing(entrance, {
      toValue: 1,
      delay: (animationIndex ?? 0) * 65,
      duration: 340,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });

    animation.start();
    return () => animation.stop();
  }, [animationIndex, entrance, shouldAnimateEntrance]);

  const animatePress = (toValue: number) => {
    Animated.spring(pressScale, {
      toValue,
      speed: 28,
      bounciness: 1,
      useNativeDriver: true,
    }).start();
  };

  return (
    <Animated.View
      style={[
        styles.animatedShell,
        {
          opacity: entrance,
          transform: [
            { translateY: entrance.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) },
            { scale: pressScale },
          ],
        },
      ]}
    >
      <TouchableOpacity
        style={styles.card}
        onPress={() => onPress?.(product)}
        onPressIn={() => animatePress(0.975)}
        onPressOut={() => animatePress(1)}
        activeOpacity={1}
        accessibilityLabel={`Xem ${product.name}`}
      >
        <View style={styles.imageWrap}>
          {imageUri ? (
            <RemoteImage uri={imageUri} style={styles.image} recyclingKey={product._id} />
          ) : (
            <View style={styles.placeholder}>
              <MaterialCommunityIcons name="tshirt-crew-outline" size={40} color={colors.brand} />
            </View>
          )}

          <View style={styles.badgeRow}>
            {product.isNew ? (
              <View style={styles.newBadge}>
                <Text style={styles.newBadgeText}>NEW</Text>
              </View>
            ) : null}
            {product.isSale ? (
              <View style={styles.saleBadge}>
                <Text style={styles.saleBadgeText}>
                  {product.discount > 0 ? `-${Math.round(product.discount)}%` : 'SALE'}
                </Text>
              </View>
            ) : null}
          </View>
        </View>

        <View style={styles.info}>
          <View style={styles.productMetaRow}>
            {productGender ? (
              <View style={[
                styles.genderBadge,
                productGender === 'female' && styles.genderBadgeFemale,
              ]}>
                <MaterialCommunityIcons
                  name={genderIcon}
                  size={11}
                  color={productGender === 'female' ? '#9B4C55' : colors.brandDark}
                />
                <Text style={[
                  styles.genderBadgeText,
                  productGender === 'female' && styles.genderBadgeTextFemale,
                ]}>
                  {genderLabel}
                </Text>
              </View>
            ) : <View />}
            <View style={styles.engagementMeta}>
              {product.averageRating > 0 ? (
                <>
                  <View style={styles.rating}>
                    <MaterialCommunityIcons name="star" size={11} color={colors.goldDark} />
                    <Text style={styles.ratingText}>{product.averageRating.toFixed(1)}</Text>
                  </View>
                  <Text style={styles.metaDivider}>•</Text>
                </>
              ) : null}
              <Text style={styles.soldText} numberOfLines={1}>
                Đã bán {formatSoldQuantity(product.soldQuantity)}
              </Text>
            </View>
          </View>

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
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  animatedShell: {
    flex: 1,
  },
  card: {
    flex: 1,
    minWidth: 0,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: '#E9EEF1',
    backgroundColor: colors.surface,
    overflow: 'hidden',
    ...shadows.card,
  },
  imageWrap: {
    width: '100%',
    aspectRatio: 0.86,
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
    borderRadius: radii.pill,
    backgroundColor: colors.brandDark,
    paddingHorizontal: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  newBadgeText: {
    color: colors.white,
    fontSize: 10,
    lineHeight: 14,
    fontWeight: '800',
  },
  saleBadge: {
    minHeight: 22,
    borderRadius: radii.pill,
    backgroundColor: colors.coral,
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
    minHeight: 120,
    padding: spacing.md,
    justifyContent: 'space-between',
  },
  productMetaRow: {
    minHeight: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  genderBadge: {
    minHeight: 20,
    borderRadius: radii.pill,
    backgroundColor: colors.brandSoft,
    paddingHorizontal: 7,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  genderBadgeFemale: {
    backgroundColor: '#F8E9E7',
  },
  genderBadgeText: {
    color: colors.brandDark,
    fontSize: 8,
    lineHeight: 10,
    fontWeight: '900',
    letterSpacing: 0.6,
  },
  genderBadgeTextFemale: {
    color: '#9B4C55',
  },
  rating: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  engagementMeta: {
    minWidth: 0,
    marginLeft: spacing.xs,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 3,
    flexShrink: 1,
  },
  ratingText: {
    color: colors.textMuted,
    fontSize: 9,
    lineHeight: 12,
    fontWeight: '800',
  },
  metaDivider: {
    color: colors.textSubtle,
    fontSize: 8,
    lineHeight: 12,
  },
  soldText: {
    color: colors.textMuted,
    fontSize: 9,
    lineHeight: 12,
    fontWeight: '700',
    flexShrink: 1,
  },
  name: {
    minHeight: 36,
    color: colors.brandDark,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
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
    color: colors.brandDark,
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
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.brandDark,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cartButtonDisabled: {
    backgroundColor: colors.disabled,
  },
});

export default ProductCard;
