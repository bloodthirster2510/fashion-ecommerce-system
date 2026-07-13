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
import { getRecommendationReasonLabel } from './recommendationUtils';

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
  const cardWidth = Math.min(
    166,
    Math.max(144, Math.round((width - spacing.md * 3) / 2.25)),
  );

  const renderItem = React.useCallback(
    ({ item }: { item: RecommendationItem }) => {
      const product = item.product;
      const imageUri = isRemoteImage(product.image) ? product.image.trim() : '';
      const originalPrice = product.originalPrice ?? product.price;

      return (
        <TouchableOpacity
          style={[styles.card, { width: cardWidth }]}
          onPress={() => onProductPress(item)}
          activeOpacity={0.84}
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
                  <Text style={styles.saleBadgeText}>Sale</Text>
                </View>
              ) : null}
              {product.isNew ? (
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

            <View style={styles.reasonRow}>
              <MaterialCommunityIcons name="lightbulb-outline" size={13} color={colors.brand} />
              <Text style={styles.reasonText} numberOfLines={1}>
                {getRecommendationReasonLabel(item)}
              </Text>
            </View>

            <View style={styles.priceRow}>
              <View style={styles.priceCopy}>
                <Text style={[styles.price, !product.isAvailable && styles.unavailableText]}>
                  {product.isAvailable ? formatCurrency(product.finalPrice) : 'Hết hàng'}
                </Text>
                {product.isAvailable && product.isSale ? (
                  <Text style={styles.originalPrice}>{formatCurrency(originalPrice)}</Text>
                ) : null}
              </View>
              <MaterialCommunityIcons name="chevron-right" size={20} color={colors.textMuted} />
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
        <View style={styles.titleIcon}>
          <MaterialCommunityIcons name="star-four-points-outline" size={18} color={colors.goldDark} />
        </View>
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
    paddingBottom: spacing.sm,
  },
  header: {
    minHeight: 44,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  titleIcon: {
    width: 34,
    height: 34,
    borderRadius: radii.sm,
    backgroundColor: colors.goldSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headingCopy: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    color: colors.black,
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '800',
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 1,
  },
  railContent: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
  },
  separator: {
    width: spacing.md,
  },
  card: {
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    overflow: 'hidden',
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
  newBadge: {
    minHeight: 21,
    borderRadius: radii.xs,
    backgroundColor: colors.white,
    paddingHorizontal: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  newBadgeText: {
    color: colors.text,
    fontSize: 10,
    lineHeight: 14,
    fontWeight: '800',
  },
  cardBody: {
    minHeight: 112,
    padding: spacing.sm,
  },
  productName: {
    minHeight: 36,
    color: colors.text,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
  },
  reasonRow: {
    height: 17,
    marginTop: spacing.xs,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  reasonText: {
    flex: 1,
    minWidth: 0,
    color: colors.brand,
    fontSize: 11,
    lineHeight: 15,
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
    color: colors.text,
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
