import React from 'react';
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
  type FlatListProps,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { RemoteImage } from '../../components/media/RemoteImage';
import { colors, radii, spacing } from '../../theme';
import type { RecommendationItem } from './recommendationApi';

const formatCurrency = (value: number) =>
  `${Math.round(value).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')}đ`;

const isRemoteImage = (value?: string | null) => Boolean(value && /^https?:\/\//i.test(value.trim()));

type RecommendationRailProps = {
  title: string;
  subtitle?: string;
  items: RecommendationItem[];
  isLoading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  onProductPress: (item: RecommendationItem) => void;
  trackingRef?: React.Ref<View>;
  onViewableItemsChanged?: FlatListProps<RecommendationItem>['onViewableItemsChanged'];
};

const viewabilityConfig = {
  minimumViewTime: 300,
  itemVisiblePercentThreshold: 60,
};

const RecommendationRail = ({
  title,
  subtitle,
  items,
  isLoading,
  error,
  onRetry,
  onProductPress,
  trackingRef,
  onViewableItemsChanged,
}: RecommendationRailProps) => {
  const { width } = useWindowDimensions();
  const cardWidth = Math.min(164, Math.max(148, Math.round(width * 0.4)));

  const renderItem = React.useCallback(
    ({ item, index }: { item: RecommendationItem; index: number }) => {
      const product = item.product;
      const imageUri = isRemoteImage(product.image) ? product.image.trim() : '';
      const originalPrice = product.originalPrice ?? product.price;
      const isFeatured = index === 0;

      return (
        <TouchableOpacity
          style={[styles.card, { width: cardWidth }]}
          onPress={() => onProductPress(item)}
          activeOpacity={0.88}
          accessibilityRole="button"
          accessibilityLabel={`Xem ${product.name}`}
        >
          <View style={styles.imageWrap}>
            {imageUri ? (
              <RemoteImage uri={imageUri} style={styles.image} recyclingKey={product._id} />
            ) : (
              <View style={styles.imagePlaceholder}>
                <MaterialCommunityIcons name="tshirt-crew-outline" size={30} color={colors.brand} />
              </View>
            )}

            <View style={styles.badgeRow}>
              {product.isSale ? (
                <View style={styles.saleBadge}>
                  <Text style={styles.saleBadgeText}>
                    {product.discount > 0 ? `-${Math.round(product.discount)}%` : 'SALE'}
                  </Text>
                </View>
              ) : null}
              {product.isNew ? (
                <View style={styles.newBadge}>
                  <Text style={styles.newBadgeText}>Mới</Text>
                </View>
              ) : null}
            </View>

            {isFeatured ? (
              <View style={styles.featuredMark}>
                <Text style={styles.featuredMarkText}>HỢP NHẤT</Text>
              </View>
            ) : null}
          </View>

          <View style={styles.cardBody}>
            <Text style={styles.cardIndex}>{String(index + 1).padStart(2, '0')}</Text>
            <Text style={styles.productName} numberOfLines={2}>
              {product.name}
            </Text>

            <View style={styles.priceRow}>
              <View style={styles.priceCopy}>
                <Text style={[styles.price, !product.isAvailable && styles.unavailableText]}>
                  {product.isAvailable ? formatCurrency(product.finalPrice) : 'Hết hàng'}
                </Text>
                {product.isAvailable && product.isSale ? (
                  <Text style={styles.originalPrice}>{formatCurrency(originalPrice)}</Text>
                ) : null}
              </View>
              <View style={styles.openButton}>
                <MaterialCommunityIcons name="arrow-top-right" size={15} color={colors.white} />
              </View>
            </View>
          </View>
        </TouchableOpacity>
      );
    },
    [cardWidth, onProductPress],
  );

  return (
    <View style={styles.section}>
      <View style={styles.header}>
        <View style={styles.headingCopy}>
          <Text style={styles.eyebrow}>GỢI Ý CÓ CHỌN LỌC</Text>
          <Text style={styles.title}>{title}</Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>
        {items.length ? (
          <View style={styles.itemCount}>
            <Text style={styles.itemCountNumber}>{items.length}</Text>
            <Text style={styles.itemCountLabel}>MÓN</Text>
          </View>
        ) : null}
      </View>

      <View ref={trackingRef} collapsable={false}>
        {isLoading ? (
          <View style={styles.statePanel}>
            <ActivityIndicator color={colors.brand} />
            <Text style={styles.stateText}>Đang chọn sản phẩm phù hợp</Text>
          </View>
        ) : error ? (
          <View style={styles.statePanel}>
            <MaterialCommunityIcons name="alert-circle-outline" size={25} color={colors.danger} />
            <Text style={styles.stateText}>{error}</Text>
            {onRetry ? (
              <TouchableOpacity style={styles.retryButton} onPress={onRetry} activeOpacity={0.82}>
                <Text style={styles.retryText}>Thử lại</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        ) : items.length ? (
          <FlatList
            horizontal
            data={items}
            renderItem={renderItem}
            keyExtractor={(item) => item.product._id}
            ItemSeparatorComponent={() => <View style={styles.separator} />}
            contentContainerStyle={styles.railContent}
            showsHorizontalScrollIndicator={false}
            decelerationRate="normal"
            directionalLockEnabled
            nestedScrollEnabled
            viewabilityConfig={viewabilityConfig}
            onViewableItemsChanged={onViewableItemsChanged}
            removeClippedSubviews={false}
            initialNumToRender={4}
            windowSize={5}
          />
        ) : (
          <View style={styles.statePanel}>
            <MaterialCommunityIcons name="hanger" size={26} color={colors.brand} />
            <Text style={styles.stateText}>Chưa có sản phẩm gợi ý phù hợp</Text>
          </View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  section: {
    marginTop: spacing.xl,
    paddingTop: spacing.xl,
    paddingBottom: spacing.lg,
    backgroundColor: '#EEF3F1',
    borderTopWidth: 1,
    borderTopColor: '#E1E9E6',
  },
  header: {
    minHeight: 58,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.lg,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.md,
  },
  headingCopy: {
    flex: 1,
    minWidth: 0,
  },
  eyebrow: {
    color: colors.coral,
    fontSize: 9,
    lineHeight: 12,
    fontWeight: '900',
    letterSpacing: 1.2,
    marginBottom: 2,
  },
  title: {
    color: colors.brandDark,
    fontSize: 21,
    lineHeight: 27,
    fontWeight: '900',
    letterSpacing: -0.45,
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 11,
    lineHeight: 16,
    marginTop: 2,
  },
  itemCount: {
    width: 46,
    height: 46,
    borderRadius: 23,
    borderWidth: 1,
    borderColor: colors.brandPale,
    backgroundColor: 'rgba(255,255,255,0.72)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemCountNumber: {
    color: colors.brandDark,
    fontSize: 14,
    lineHeight: 16,
    fontWeight: '900',
  },
  itemCountLabel: {
    color: colors.textMuted,
    fontSize: 6,
    lineHeight: 8,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  railContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
  },
  separator: {
    width: spacing.md,
  },
  card: {
    alignSelf: 'flex-start',
    borderRadius: radii.md,
    borderWidth: 0,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  imageWrap: {
    width: '100%',
    aspectRatio: 0.92,
    backgroundColor: colors.brandSoft,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  imagePlaceholder: {
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
    flexDirection: 'row',
    gap: spacing.xs,
  },
  saleBadge: {
    minHeight: 21,
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
  newBadge: {
    minHeight: 21,
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
  featuredMark: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    minHeight: 21,
    borderRadius: radii.pill,
    backgroundColor: colors.gold,
    paddingHorizontal: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  featuredMarkText: {
    color: colors.brandDark,
    fontSize: 7,
    lineHeight: 9,
    fontWeight: '900',
    letterSpacing: 0.7,
  },
  cardBody: {
    position: 'relative',
    minHeight: 106,
    padding: spacing.md,
  },
  cardIndex: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.md,
    color: colors.brandPale,
    fontSize: 22,
    lineHeight: 24,
    fontWeight: '900',
  },
  productName: {
    minHeight: 36,
    maxWidth: '84%',
    color: colors.brandDark,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
  },
  priceRow: {
    minHeight: 35,
    marginTop: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
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
    fontSize: 10,
    lineHeight: 14,
    textDecorationLine: 'line-through',
  },
  openButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.brandDark,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unavailableText: {
    color: colors.danger,
    fontSize: 12,
  },
  statePanel: {
    minHeight: 112,
    marginHorizontal: spacing.md,
    borderRadius: radii.sm,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  stateText: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  retryButton: {
    minHeight: 34,
    borderRadius: radii.xs,
    backgroundColor: colors.brand,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.md,
  },
  retryText: {
    color: colors.white,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '800',
  },
});

export default RecommendationRail;
