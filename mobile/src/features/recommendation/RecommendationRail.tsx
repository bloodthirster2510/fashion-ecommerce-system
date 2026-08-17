import React from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import ProductCard from '../catalog/ProductCard';
import { colors, radii, spacing } from '../../theme';
import type { RecommendationItem } from './recommendationApi';

type RecommendationRailProps = {
  title: string;
  subtitle?: string;
  items: RecommendationItem[];
  isLoading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  onProductPress: (item: RecommendationItem) => void;
  trackingRef?: React.Ref<View>;
  onItemRef?: (productId: string, view: View | null) => void;
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
  onItemRef,
}: RecommendationRailProps) => {
  const renderItem = React.useCallback((item: RecommendationItem) => (
    <View
      key={item.product._id}
      ref={(view) => onItemRef?.(item.product._id, view)}
      collapsable={false}
      style={styles.gridItem}
    >
      <ProductCard
        product={item.product}
        featured={item.merchandisingSource === 'admin_pinned'}
        onPress={() => onProductPress(item)}
        onCartPress={() => onProductPress(item)}
      />
    </View>
  ), [onItemRef, onProductPress]);

  return (
    <View style={styles.section}>
      <View style={styles.header}>
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>

      <View ref={trackingRef} collapsable={false}>
        {isLoading && !items.length ? (
          <View style={styles.statePanel}>
            <ActivityIndicator color={colors.brand} />
            <Text style={styles.stateText}>Đang chọn sản phẩm phù hợp</Text>
          </View>
        ) : error && !items.length ? (
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
          <View style={styles.grid}>
            {items.map(renderItem)}
          </View>
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
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  header: {
    minHeight: 30,
    marginBottom: spacing.md,
  },
  title: {
    color: colors.black,
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '800',
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 11,
    lineHeight: 16,
    marginTop: 2,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  gridItem: {
    width: '47.5%',
  },
  statePanel: {
    minHeight: 120,
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
