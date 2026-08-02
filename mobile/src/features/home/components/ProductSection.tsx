import React from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, radii, spacing } from '../../../theme';
import type { CatalogProduct } from '../../catalog/catalogApi';
import ProductCard from '../../catalog/ProductCard';

type ProductSectionProps = {
  title: string;
  products: CatalogProduct[];
  isLoading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  onViewMore?: () => void;
  viewMoreLabel?: string;
  onProductPress?: (product: CatalogProduct) => void;
  onCartPress?: (product: CatalogProduct) => void;
};

const ProductSection = ({
  title,
  products,
  isLoading,
  error,
  onRetry,
  onViewMore,
  viewMoreLabel = 'Xem thêm',
  onProductPress,
  onCartPress,
}: ProductSectionProps) => {
  const hasProducts = products.length > 0;

  return (
    <View style={styles.section}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>{title}</Text>
        {onViewMore ? (
          <TouchableOpacity style={styles.viewMoreButton} onPress={onViewMore} activeOpacity={0.82}>
            <Text style={styles.viewMoreText}>{viewMoreLabel}</Text>
            <MaterialCommunityIcons name="chevron-right" size={18} color={colors.brand} />
          </TouchableOpacity>
        ) : null}
      </View>

      {isLoading && !hasProducts ? (
        <View style={styles.statePanel}>
          <ActivityIndicator color={colors.brand} />
          <Text style={styles.stateText}>Đang tải sản phẩm</Text>
        </View>
      ) : error && !hasProducts ? (
        <View style={styles.statePanel}>
          <MaterialCommunityIcons name="alert-circle-outline" size={26} color={colors.danger} />
          <Text style={styles.stateText}>{error}</Text>
          {onRetry ? (
            <TouchableOpacity style={styles.retryButton} onPress={onRetry} activeOpacity={0.82}>
              <Text style={styles.retryText}>Thử lại</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      ) : !hasProducts ? (
        <View style={styles.statePanel}>
          <MaterialCommunityIcons name="hanger" size={28} color={colors.brand} />
          <Text style={styles.stateText}>Chưa có sản phẩm để hiển thị</Text>
        </View>
      ) : (
        <>
          {isLoading ? (
            <View style={styles.inlineState}>
              <ActivityIndicator size="small" color={colors.brand} />
              <Text style={styles.inlineStateText}>Đang cập nhật sản phẩm</Text>
            </View>
          ) : null}
          {error ? (
            <View style={styles.inlineError}>
              <MaterialCommunityIcons name="alert-circle-outline" size={18} color={colors.danger} />
              <Text style={styles.inlineErrorText}>Đang hiển thị dữ liệu gần nhất.</Text>
              {onRetry ? (
                <TouchableOpacity onPress={onRetry} activeOpacity={0.82}>
                  <Text style={styles.inlineRetryText}>Thử lại</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          ) : null}
          <View style={styles.grid}>
            {products.map((product) => (
              <View key={product._id} style={styles.gridItem}>
                <ProductCard
                  product={product}
                  onPress={onProductPress}
                  onCartPress={onCartPress}
                />
              </View>
            ))}
          </View>
        </>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  section: {
    marginTop: spacing.xl,
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  headerRow: {
    minHeight: 30,
    marginBottom: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  title: {
    flex: 1,
    color: colors.black,
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '800',
  },
  viewMoreButton: {
    minHeight: 30,
    borderRadius: radii.pill,
    backgroundColor: colors.brandSoft,
    paddingLeft: spacing.md,
    paddingRight: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewMoreText: {
    color: colors.brand,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '800',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  gridItem: {
    width: '47.5%',
  },
  inlineState: {
    minHeight: 34,
    marginBottom: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  inlineStateText: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
  },
  inlineError: {
    minHeight: 38,
    marginBottom: spacing.sm,
    borderRadius: radii.xs,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  inlineErrorText: {
    flex: 1,
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 16,
  },
  inlineRetryText: {
    color: colors.brand,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '800',
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

export default ProductSection;
