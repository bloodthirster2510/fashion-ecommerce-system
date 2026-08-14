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
    ({ item }: { item: RecommendationItem }) => {
      const product = item.product;
      const imageUri = isRemoteImage(product.image) ? product.image.trim() : '';
      const originalPrice = product.originalPrice ?? product.price;
      const isPinned = item.merchandisingSource === 'admin_pinned';

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
              {isPinned ? (
                <View style={styles.featuredMark}>
                  <Text style={styles.featuredMarkText}>NỔI BẬT</Text>
                </View>
              ) : product.isSale ? (
                <View style={styles.saleBadge}>
                  <Text style={styles.saleBadgeText}>
                    {product.discount > 0 ? `-${Math.round(product.discount)}%` : 'SALE'}
                  </Text>
                </View>
              ) : null}
              {!isPinned && !product.isSale && product.isNew ? (
                <View style={styles.newBadge}>
                  <Text style={styles.newBadgeText}>Mới</Text>
                </View>
              ) : null}
            </View>

          </View>

          <View style={styles.cardBody}>
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
          <Text style={styles.title}>{title}</Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>
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
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: '#E1E9E6',
  },
  header: {
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  headingCopy: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    color: colors.brandDark,
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '800',
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 11,
    lineHeight: 16,
    marginTop: 2,
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
    borderWidth: 1,
    borderColor: '#E5EAE8',
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
    minHeight: 88,
    padding: spacing.md,
  },
  productName: {
    minHeight: 36,
    color: colors.brandDark,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
  },
  priceRow: {
    minHeight: 35,
    marginTop: spacing.sm,
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
