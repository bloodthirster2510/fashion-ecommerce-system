import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import type { RootStackParamList } from '../../navigation/AppNavigator';
import { colors, radii, shadows, spacing } from '../../theme';
import { useAuth } from '../auth/AuthContext';
import { AvailableCouponItem, couponApi } from './couponApi';

type CouponsNavigationProp = StackNavigationProp<RootStackParamList, 'Coupons'>;
type CouponsRouteProp = RouteProp<RootStackParamList, 'Coupons'>;
type CouponCategory = 'all' | 'discount' | 'freeship';

const couponCategories: Array<{
  key: CouponCategory;
  label: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
}> = [
  { key: 'all', label: 'Tất cả', icon: 'ticket-confirmation-outline' },
  { key: 'discount', label: 'Mã giảm giá', icon: 'ticket-percent-outline' },
  { key: 'freeship', label: 'Freeship', icon: 'truck-fast-outline' },
];

const PAGE_LIMIT = 20;
const initialPagination = { page: 1, limit: PAGE_LIMIT, totalItems: 0, totalPages: 0 };

const formatCurrency = (value: number) =>
  `${Math.round(value).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')}đ`;

const formatDate = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return `${date.getDate().toString().padStart(2, '0')}/${(date.getMonth() + 1)
    .toString()
    .padStart(2, '0')}/${date.getFullYear()}`;
};

const getCouponValueText = (item: AvailableCouponItem) => {
  if (item.coupon.discountType === 'free_shipping') {
    return 'FREESHIP';
  }

  if (item.coupon.discountType === 'percent') {
    return `${item.coupon.discountValue}%`;
  }

  const val = item.coupon.discountValue;
  if (val >= 1000) {
    return `${Math.round(val / 1000)}K`;
  }

  return formatCurrency(val);
};

const getCouponCategory = (item: AvailableCouponItem): Exclude<CouponCategory, 'all'> =>
  item.coupon.discountType === 'free_shipping' ? 'freeship' : 'discount';

const getCouponTypeLabel = (item: AvailableCouponItem) =>
  getCouponCategory(item) === 'freeship' ? 'Vận chuyển' : 'Đơn hàng';

const getEstimateText = (item: AvailableCouponItem) => {
  const totalDiscount = item.estimatedDiscountAmount + item.estimatedShippingDiscountAmount;
  if (item.isApplicable !== true || totalDiscount <= 0) {
    return null;
  }

  return `Dự kiến giảm ${formatCurrency(totalDiscount)}`;
};

const CouponsScreen = () => {
  const navigation = useNavigation<CouponsNavigationProp>();
  const route = useRoute<CouponsRouteProp>();
  const { session, runWithAuth } = useAuth();
  const [items, setItems] = useState<AvailableCouponItem[]>([]);
  const [activeCategory, setActiveCategory] = useState<CouponCategory>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [pagination, setPagination] = useState(initialPagination);
  const [selectedDiscountCode, setSelectedDiscountCode] = useState<string | null>(null);
  const [selectedFreeshipCode, setSelectedFreeshipCode] = useState<string | null>(null);
  const paginationRef = useRef(initialPagination);
  const isLoadingMoreRef = useRef(false);
  const requestSequenceRef = useRef(0);
  const isInitializedRef = useRef(false);

  const routeCartItemIds = route.params?.cartItemIds;
  const cartItemIds = useMemo(() => routeCartItemIds ?? [], [routeCartItemIds]);
  const hasCartContext = cartItemIds.length > 0;
  const paymentMethod = route.params?.paymentMethod ?? 'COD';

  useEffect(() => {
    if (isInitializedRef.current) return;
    const initialCodes = route.params?.selectedCouponCodes ?? (route.params?.selectedCouponCode ? [route.params.selectedCouponCode] : []);
    if (initialCodes.length > 0 && items.length > 0) {
      isInitializedRef.current = true;
      initialCodes.forEach((code) => {
        const found = items.find((it) => it.coupon.code.toUpperCase() === code.toUpperCase());
        if (found) {
          if (found.coupon.discountType === 'free_shipping') {
            setSelectedFreeshipCode(found.coupon.code);
          } else {
            setSelectedDiscountCode(found.coupon.code);
          }
        }
      });
    }
  }, [items, route.params?.selectedCouponCode, route.params?.selectedCouponCodes]);

  const loadCoupons = useCallback(
    async (mode: 'initial' | 'refresh' | 'more' = 'initial') => {
      if (!session?.accessToken) {
        requestSequenceRef.current += 1;
        setItems([]);
        paginationRef.current = initialPagination;
        setPagination(initialPagination);
        setIsLoading(false);
        return;
      }
      if (
        mode === 'more'
        && (isLoadingMoreRef.current || paginationRef.current.page >= paginationRef.current.totalPages)
      ) return;

      const requestSequence = requestSequenceRef.current + 1;
      requestSequenceRef.current = requestSequence;
      if (mode !== 'more') {
        isLoadingMoreRef.current = false;
        setIsLoadingMore(false);
      }

      if (mode === 'refresh') setIsRefreshing(true);
      else if (mode === 'more') {
        isLoadingMoreRef.current = true;
        setIsLoadingMore(true);
      } else setIsLoading(true);

      try {
        const page = mode === 'more' ? paginationRef.current.page + 1 : 1;
        const response = await runWithAuth((accessToken) =>
          couponApi.getAvailableCoupons(accessToken, {
            cartItemIds: hasCartContext ? cartItemIds : undefined,
            paymentMethod,
            page,
            limit: PAGE_LIMIT,
          }),
        );
        if (requestSequenceRef.current !== requestSequence) return;
        setItems((current) => {
          if (mode !== 'more') return response.items;
          const existingIds = new Set(current.map((item) => item.coupon._id));
          return [...current, ...response.items.filter((item) => !existingIds.has(item.coupon._id))];
        });
        paginationRef.current = response.pagination;
        setPagination(response.pagination);
      } catch (error) {
        if (requestSequenceRef.current !== requestSequence) return;
        Alert.alert(
          'Chưa tải được voucher',
          error instanceof Error ? error.message : 'Bạn thử lại sau nha.',
        );
      } finally {
        if (requestSequenceRef.current === requestSequence) {
          setIsLoading(false);
          setIsRefreshing(false);
          setIsLoadingMore(false);
          isLoadingMoreRef.current = false;
        }
      }
    },
    [cartItemIds, hasCartContext, paymentMethod, runWithAuth, session?.accessToken],
  );

  useEffect(() => {
    void loadCoupons();
  }, [loadCoupons]);

  const filteredItems = useMemo(
    () => items.filter((item) => activeCategory === 'all' || getCouponCategory(item) === activeCategory),
    [activeCategory, items],
  );

  const getCategoryCount = (category: CouponCategory) =>
    category === 'all'
      ? items.length
      : items.filter((item) => getCouponCategory(item) === category).length;

  const handleToggleCoupon = (item: AvailableCouponItem) => {
    if (item.isApplicable === false) {
      Alert.alert('Voucher chưa đủ điều kiện', item.reason || 'Voucher chưa phù hợp với đơn hàng này.');
      return;
    }

    if (!hasCartContext) {
      navigation.navigate('Cart', { couponCode: item.coupon.code, selectionSource: 'normal' });
      return;
    }

    const isFreeship = item.coupon.discountType === 'free_shipping';
    const code = item.coupon.code;

    if (isFreeship) {
      setSelectedFreeshipCode((prev) => (prev === code ? null : code));
    } else {
      setSelectedDiscountCode((prev) => (prev === code ? null : code));
    }
  };

  const handleApplySelectedCoupons = () => {
    const selectedCodes = [selectedDiscountCode, selectedFreeshipCode].filter(Boolean) as string[];
    if (hasCartContext) {
      navigation.popTo('Checkout', {
        couponCodes: selectedCodes,
        couponCode: selectedCodes[0] ?? undefined,
        cartItemIds,
      });
      return;
    }
    navigation.navigate('Cart', { selectionSource: 'normal' });
  };

  const selectedCount = (selectedDiscountCode ? 1 : 0) + (selectedFreeshipCode ? 1 : 0);

  const renderCoupon = (item: AvailableCouponItem) => {
    const estimateText = getEstimateText(item);
    const isDisabled = item.isApplicable === false;
    const isFreeship = item.coupon.discountType === 'free_shipping';
    const isSelected = isFreeship
      ? selectedFreeshipCode === item.coupon.code
      : selectedDiscountCode === item.coupon.code;

    const accentColor = isFreeship ? colors.success : colors.brand;
    const accentSoftBg = isFreeship ? colors.successSoft : colors.brandSoft;

    return (
      <TouchableOpacity
        key={item.coupon._id}
        style={[
          styles.ticketCard,
          isSelected && styles.ticketCardSelected,
          isDisabled && styles.ticketCardDisabled,
        ]}
        onPress={() => handleToggleCoupon(item)}
        activeOpacity={isDisabled ? 1 : 0.85}
      >
        {/* Left stub */}
        <View style={[styles.ticketStub, { backgroundColor: accentSoftBg }, isSelected && { backgroundColor: accentColor }]}>
          <MaterialCommunityIcons
            name={isFreeship ? 'truck-fast' : 'ticket-percent'}
            size={26}
            color={isSelected ? colors.white : accentColor}
          />
          <Text style={[styles.stubValueText, isSelected && styles.stubValueTextActive]} numberOfLines={1}>
            {getCouponValueText(item)}
          </Text>
          <Text style={[styles.stubTypeText, isSelected && styles.stubTypeTextActive]} numberOfLines={1}>
            {getCouponTypeLabel(item)}
          </Text>
        </View>

        {/* Clean vertical divider */}
        <View style={styles.ticketDivider} />

        {/* Right body */}
        <View style={styles.ticketBody}>
          <View style={styles.ticketHeaderRow}>
            <View style={styles.codeBadge}>
              <Text style={styles.codeBadgeText}>{item.coupon.code}</Text>
            </View>

            {hasCartContext ? (
              <View style={[styles.selectionCircle, isSelected && styles.selectionCircleActive, isDisabled && styles.selectionCircleDisabled]}>
                {isSelected ? <MaterialCommunityIcons name="check" size={14} color={colors.white} /> : null}
              </View>
            ) : (
              <TouchableOpacity
                style={[styles.useNowBtn, isDisabled && styles.useNowBtnDisabled]}
                onPress={() => handleToggleCoupon(item)}
                disabled={isDisabled}
              >
                <Text style={styles.useNowText}>Dùng ngay</Text>
              </TouchableOpacity>
            )}
          </View>

          <Text style={styles.ticketTitle} numberOfLines={2}>
            {item.coupon.name}
          </Text>

          <View style={styles.ticketMetaRow}>
            <MaterialCommunityIcons name="shopping-outline" size={13} color={colors.textMuted} />
            <Text style={styles.ticketMetaText}>
              Đơn tối thiểu: {formatCurrency(item.coupon.minOrderAmount)}
            </Text>
          </View>

          <View style={styles.ticketMetaRow}>
            <MaterialCommunityIcons name="clock-outline" size={13} color={colors.textMuted} />
            <Text style={styles.ticketMetaText}>HSD: {formatDate(item.coupon.endAt)}</Text>
          </View>

          {estimateText ? (
            <View style={styles.estimatePill}>
              <MaterialCommunityIcons name="lightning-bolt" size={13} color={colors.success} />
              <Text style={styles.estimatePillText}>{estimateText}</Text>
            </View>
          ) : null}

          {isDisabled && item.reason ? (
            <View style={styles.reasonPill}>
              <MaterialCommunityIcons name="alert-circle-outline" size={13} color={colors.danger} />
              <Text style={styles.reasonPillText} numberOfLines={1}>{item.reason}</Text>
            </View>
          ) : null}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerButton} onPress={() => navigation.goBack()} activeOpacity={0.82}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={colors.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Voucher & Ưu đãi</Text>
        <View style={styles.headerButton} />
      </View>

      <View style={styles.ruleBanner}>
        <MaterialCommunityIcons name="information-outline" size={16} color={colors.brandDark} />
        <Text style={styles.ruleBannerText}>
          Áp dụng tối đa <Text style={styles.ruleBannerBold}>1 Mã giảm giá</Text> + <Text style={styles.ruleBannerBold}>1 Mã Freeship</Text> cho mỗi đơn hàng.
        </Text>
      </View>

      {isLoading ? (
        <View style={styles.loadingState}>
          <ActivityIndicator size="large" color={colors.brand} />
          <Text style={styles.loadingText}>Đang tải danh sách ưu đãi...</Text>
        </View>
      ) : (
        <ScrollView
          style={styles.content}
          contentContainerStyle={[styles.contentBody, hasCartContext && styles.contentBodyWithFooter]}
          refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={() => loadCoupons('refresh')} />}
          showsVerticalScrollIndicator={false}
        >
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryTabs}>
            {couponCategories.map((category) => {
              const isActive = activeCategory === category.key;

              return (
                <TouchableOpacity
                  key={category.key}
                  style={[styles.categoryTab, isActive && styles.categoryTabActive]}
                  onPress={() => setActiveCategory(category.key)}
                  activeOpacity={0.84}
                >
                  <MaterialCommunityIcons
                    name={category.icon}
                    size={16}
                    color={isActive ? colors.white : colors.textMuted}
                  />
                  <Text style={[styles.categoryTabText, isActive && styles.categoryTabTextActive]}>
                    {category.label}
                  </Text>
                  <View style={[styles.categoryCountBadge, isActive && styles.categoryCountBadgeActive]}>
                    <Text style={[styles.categoryCountText, isActive && styles.categoryCountTextActive]}>
                      {getCategoryCount(category.key)}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {filteredItems.length ? (
            <View style={styles.couponListStack}>
              {filteredItems.map(renderCoupon)}
            </View>
          ) : (
            <View style={styles.emptyState}>
              <MaterialCommunityIcons name="ticket-confirmation-outline" size={48} color={colors.textSubtle} />
              <Text style={styles.emptyTitle}>Chưa có voucher khả dụng</Text>
              <Text style={styles.emptyText}>Ưu đãi mới sẽ xuất hiện tại đây khi được mở.</Text>
            </View>
          )}

          {pagination.page < pagination.totalPages ? (
            <TouchableOpacity
              style={styles.loadMoreButton}
              onPress={() => void loadCoupons('more')}
              disabled={isLoadingMore}
            >
              {isLoadingMore ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <Text style={styles.loadMoreText}>Xem thêm voucher</Text>
              )}
            </TouchableOpacity>
          ) : null}

          <TouchableOpacity
            style={styles.supportButton}
            onPress={() => navigation.navigate('SupportTicketCreate', { category: 'promotions', contextSource: 'coupon' })}
          >
            <MaterialCommunityIcons name="lifebuoy" size={18} color={colors.brand} />
            <Text style={styles.supportButtonText}>Cần hỗ trợ về voucher & ưu đãi?</Text>
          </TouchableOpacity>
        </ScrollView>
      )}

      {hasCartContext && !isLoading ? (
        <View style={styles.stickyFooter}>
          <View style={styles.stickyFooterInfo}>
            <Text style={styles.stickyFooterCount}>
              Đã chọn: <Text style={styles.stickyFooterCountBold}>{selectedCount}/2 voucher</Text>
            </Text>
            <Text style={styles.stickyFooterSubtext}>
              {selectedDiscountCode && selectedFreeshipCode
                ? '1 Giảm giá + 1 Freeship'
                : selectedDiscountCode
                ? '1 Mã giảm giá (có thể thêm Freeship)'
                : selectedFreeshipCode
                ? '1 Mã Freeship (có thể thêm Giảm giá)'
                : 'Chưa chọn voucher nào'}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.applyFooterBtn}
            onPress={handleApplySelectedCoupons}
            activeOpacity={0.85}
          >
            <Text style={styles.applyFooterBtnText}>
              Áp dụng {selectedCount > 0 ? `(${selectedCount})` : ''}
            </Text>
          </TouchableOpacity>
        </View>
      ) : null}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    minHeight: 56,
    backgroundColor: colors.brand,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
  },
  headerButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    color: colors.white,
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '900',
    textAlign: 'center',
  },
  ruleBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.brandMist,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  ruleBannerText: {
    flex: 1,
    color: colors.brandDark,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '600',
  },
  ruleBannerBold: {
    fontWeight: '900',
    color: colors.brandDark,
  },
  loadingState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  loadingText: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  contentBody: {
    padding: spacing.lg,
    gap: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  contentBodyWithFooter: {
    paddingBottom: 100,
  },
  categoryTabs: {
    gap: spacing.sm,
    paddingRight: spacing.lg,
  },
  categoryTab: {
    minHeight: 38,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  categoryTabActive: {
    borderColor: colors.brand,
    backgroundColor: colors.brand,
  },
  categoryTabText: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '800',
  },
  categoryTabTextActive: {
    color: colors.white,
  },
  categoryCountBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  categoryCountBadgeActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
  },
  categoryCountText: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '900',
  },
  categoryCountTextActive: {
    color: colors.white,
  },
  couponListStack: {
    gap: spacing.md,
  },
  ticketCard: {
    flexDirection: 'row',
    alignItems: 'stretch',
    backgroundColor: colors.surface,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.border,
    minHeight: 115,
  },
  ticketCardSelected: {
    borderColor: colors.brand,
    borderWidth: 1.5,
  },
  ticketCardDisabled: {
    opacity: 0.6,
  },
  ticketStub: {
    width: 90,
    paddingVertical: spacing.md,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    borderTopLeftRadius: radii.sm - 1,
    borderBottomLeftRadius: radii.sm - 1,
  },
  stubValueText: {
    fontSize: 14,
    fontWeight: '900',
    color: colors.brandDark,
    textAlign: 'center',
  },
  stubValueTextActive: {
    color: colors.white,
  },
  stubTypeText: {
    fontSize: 9,
    fontWeight: '900',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  stubTypeTextActive: {
    color: 'rgba(255, 255, 255, 0.9)',
  },
  ticketDivider: {
    width: 1,
    backgroundColor: colors.border,
  },
  ticketBody: {
    flex: 1,
    padding: spacing.md,
    gap: 4,
    justifyContent: 'center',
  },
  ticketHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  codeBadge: {
    backgroundColor: colors.field,
    borderRadius: radii.xs,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  codeBadgeText: {
    color: colors.brandDark,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  selectionCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectionCircleActive: {
    backgroundColor: colors.brand,
    borderColor: colors.brand,
  },
  selectionCircleDisabled: {
    borderColor: colors.disabled,
    backgroundColor: colors.field,
  },
  useNowBtn: {
    backgroundColor: colors.brand,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
  },
  useNowBtnDisabled: {
    backgroundColor: colors.disabled,
  },
  useNowText: {
    color: colors.white,
    fontSize: 12,
    fontWeight: '800',
  },
  ticketTitle: {
    color: colors.text,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '800',
  },
  ticketMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  ticketMetaText: {
    color: colors.textMuted,
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '600',
  },
  estimatePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.successSoft,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radii.xs,
    alignSelf: 'flex-start',
    marginTop: 2,
  },
  estimatePillText: {
    color: colors.success,
    fontSize: 11,
    fontWeight: '800',
  },
  reasonPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.dangerSoft,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radii.xs,
    alignSelf: 'flex-start',
    marginTop: 2,
  },
  reasonPillText: {
    color: colors.danger,
    fontSize: 11,
    fontWeight: '700',
  },
  emptyState: {
    minHeight: 220,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  emptyTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '900',
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: 13,
    textAlign: 'center',
  },
  loadMoreButton: {
    minHeight: 44,
    borderRadius: radii.sm,
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadMoreText: {
    color: colors.white,
    fontWeight: '900',
    fontSize: 13,
  },
  supportButton: {
    minHeight: 44,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radii.sm,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  supportButtonText: {
    color: colors.brandDark,
    fontSize: 13,
    fontWeight: '800',
  },
  stickyFooter: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    ...shadows.card,
  },
  stickyFooterInfo: {
    flex: 1,
    gap: 2,
  },
  stickyFooterCount: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  stickyFooterCountBold: {
    color: colors.brand,
    fontWeight: '900',
  },
  stickyFooterSubtext: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '600',
  },
  applyFooterBtn: {
    backgroundColor: colors.brand,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  applyFooterBtnText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '900',
  },
});

export default CouponsScreen;
