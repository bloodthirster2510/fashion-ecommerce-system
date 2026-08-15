import React from 'react';
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
import { colors, radii, spacing } from '../../theme';
import { useAuth } from '../auth/AuthContext';
import { AvailableCouponItem, couponApi } from './couponApi';

type CouponsNavigationProp = StackNavigationProp<RootStackParamList, 'Coupons'>;
type CouponsRouteProp = RouteProp<RootStackParamList, 'Coupons'>;
type CouponCategory = 'all' | 'discount' | 'freeship';

const couponCategories: Array<{ key: CouponCategory; label: string; icon: keyof typeof MaterialCommunityIcons.glyphMap }> = [
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
    return 'Miễn phí ship';
  }

  if (item.coupon.discountType === 'percent') {
    return `${item.coupon.discountValue}%`;
  }

  return formatCurrency(item.coupon.discountValue);
};

const getCouponCategory = (item: AvailableCouponItem): Exclude<CouponCategory, 'all'> =>
  item.coupon.discountType === 'free_shipping' ? 'freeship' : 'discount';

const getCouponTypeLabel = (item: AvailableCouponItem) =>
  getCouponCategory(item) === 'freeship' ? 'Mã freeship' : 'Mã giảm giá';

const getCouponTypeIcon = (item: AvailableCouponItem): keyof typeof MaterialCommunityIcons.glyphMap =>
  getCouponCategory(item) === 'freeship' ? 'truck-fast-outline' : 'ticket-percent-outline';

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
  const [items, setItems] = React.useState<AvailableCouponItem[]>([]);
  const [activeCategory, setActiveCategory] = React.useState<CouponCategory>('all');
  const [isLoading, setIsLoading] = React.useState(true);
  const [isRefreshing, setIsRefreshing] = React.useState(false);
  const [isLoadingMore, setIsLoadingMore] = React.useState(false);
  const [pagination, setPagination] = React.useState(initialPagination);
  const [applyingCouponCode, setApplyingCouponCode] = React.useState<string | null>(null);
  const paginationRef = React.useRef(initialPagination);
  const isLoadingMoreRef = React.useRef(false);
  const requestSequenceRef = React.useRef(0);

  const routeCartItemIds = route.params?.cartItemIds;
  const cartItemIds = React.useMemo(() => routeCartItemIds ?? [], [routeCartItemIds]);
  const hasCartContext = cartItemIds.length > 0;
  const paymentMethod = route.params?.paymentMethod ?? 'COD';

  const loadCoupons = React.useCallback(
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

  React.useEffect(() => {
    void loadCoupons();
  }, [loadCoupons]);

  const filteredItems = React.useMemo(
    () => items.filter((item) => activeCategory === 'all' || getCouponCategory(item) === activeCategory),
    [activeCategory, items],
  );

  const getCategoryCount = (category: CouponCategory) =>
    category === 'all'
      ? items.length
      : items.filter((item) => getCouponCategory(item) === category).length;

  const handleUseCoupon = async (item: AvailableCouponItem) => {
    if (item.isApplicable === false) {
      Alert.alert('Voucher chưa dùng được', item.reason || 'Voucher chưa phù hợp với đơn hàng này.');
      return;
    }

    if (hasCartContext && session?.accessToken) {
      try {
        setApplyingCouponCode(item.coupon.code);
        await runWithAuth((accessToken) => couponApi.validateCoupon(accessToken, {
          couponCode: item.coupon.code,
          cartItemIds,
          paymentMethod,
        }));
      } catch (error) {
        Alert.alert(
          'Voucher chưa dùng được',
          error instanceof Error ? error.message : 'Voucher không còn phù hợp với đơn hàng này.',
        );
        return;
      } finally {
        setApplyingCouponCode(null);
      }
    }

    if (hasCartContext) {
      navigation.navigate('Checkout', {
        couponCode: item.coupon.code,
        cartItemIds,
      });
      return;
    }

    navigation.navigate('Cart', { couponCode: item.coupon.code, selectionSource: 'normal' });
  };

  const renderCoupon = (item: AvailableCouponItem) => {
    const estimateText = getEstimateText(item);
    const isDisabled = item.isApplicable === false;
    const isApplying = applyingCouponCode === item.coupon.code;
    const isSelected = route.params?.selectedCouponCode === item.coupon.code;
    const couponCategory = getCouponCategory(item);
    const isDiscountCoupon = couponCategory === 'discount';
    const typeColor = couponCategory === 'freeship' ? colors.success : colors.danger;
    const typeBackground = couponCategory === 'freeship' ? colors.successSoft : colors.dangerSoft;

    return (
      <View
        key={item.coupon._id}
        style={[
          styles.couponCard,
          isDiscountCoupon && styles.discountCouponCard,
          isSelected && (isDiscountCoupon ? styles.discountCouponCardSelected : styles.couponCardSelected),
          isDisabled && styles.couponCardDisabled,
        ]}
      >
        <View style={styles.couponTop}>
          <View style={styles.codeRow}>
            <MaterialCommunityIcons name={getCouponTypeIcon(item)} size={22} color={typeColor} />
            <Text style={styles.codeText} numberOfLines={1}>
              {item.coupon.code}
            </Text>
          </View>
          <TouchableOpacity
            style={[
              styles.useButton,
              isDiscountCoupon && styles.discountUseButton,
              (isDisabled || isApplying) && styles.useButtonDisabled,
            ]}
            onPress={() => void handleUseCoupon(item)}
            disabled={isDisabled || isApplying}
            activeOpacity={0.82}
          >
            {isApplying ? (
              <ActivityIndicator color={colors.white} size="small" />
            ) : (
              <Text style={styles.useButtonText}>{isSelected ? 'Đang dùng' : 'Sử dụng'}</Text>
            )}
          </TouchableOpacity>
        </View>

        <View style={[styles.typePill, { backgroundColor: typeBackground }]}>
          <MaterialCommunityIcons name={getCouponTypeIcon(item)} size={15} color={typeColor} />
          <Text style={[styles.typePillText, { color: typeColor }]}>{getCouponTypeLabel(item)}</Text>
        </View>

        <Text style={[styles.valueText, isDiscountCoupon && styles.discountValueText]}>
          {getCouponValueText(item)}
        </Text>
        <Text style={styles.metaText}>Đơn tối thiểu: {formatCurrency(item.coupon.minOrderAmount)}</Text>
        <Text style={styles.metaText}>HSD: {formatDate(item.coupon.endAt)}</Text>

        {estimateText ? <Text style={styles.estimateText}>{estimateText}</Text> : null}
        {isDisabled ? <Text style={styles.reasonText}>{item.reason}</Text> : null}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerButton} onPress={() => navigation.goBack()} activeOpacity={0.82}>
          <MaterialCommunityIcons name="arrow-left" size={26} color={colors.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Voucher & Ưu đãi</Text>
        <View style={styles.headerButton} />
      </View>

      {isLoading ? (
        <View style={styles.loadingState}>
          <ActivityIndicator size="large" color={colors.brand} />
        </View>
      ) : (
        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.contentBody}
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
                    size={17}
                    color={isActive ? colors.brandDark : colors.textMuted}
                  />
                  <Text style={[styles.categoryTabText, isActive && styles.categoryTabTextActive]}>
                    {category.label}
                  </Text>
                  <Text style={[styles.categoryCount, isActive && styles.categoryCountActive]}>
                    {getCategoryCount(category.key)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {filteredItems.length ? filteredItems.map(renderCoupon) : (
            <View style={styles.emptyState}>
              <MaterialCommunityIcons name="ticket-confirmation-outline" size={36} color={colors.textSubtle} />
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
          <TouchableOpacity style={styles.supportButton} onPress={() => navigation.navigate('SupportTicketCreate', { category: 'promotions', contextSource: 'coupon' })}>
            <MaterialCommunityIcons name="lifebuoy" size={20} color={colors.brand} />
            <Text style={styles.supportButtonText}>Cần hỗ trợ về voucher?</Text>
          </TouchableOpacity>
        </ScrollView>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    minHeight: 72,
    backgroundColor: colors.brand,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
  },
  headerButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    color: colors.white,
    fontSize: 26,
    lineHeight: 32,
    fontWeight: '900',
    textAlign: 'center',
  },
  loadingState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
  },
  contentBody: {
    padding: spacing.lg,
    gap: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  supportButton: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: colors.brand,
    borderRadius: radii.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  supportButtonText: { color: colors.brand, fontWeight: '800' },
  loadMoreButton: {
    minHeight: 48,
    borderRadius: radii.sm,
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadMoreText: { color: colors.white, fontWeight: '900' },
  categoryTabs: {
    gap: spacing.sm,
    paddingRight: spacing.lg,
  },
  categoryTab: {
    minHeight: 40,
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
    backgroundColor: colors.brandSoft,
  },
  categoryTabText: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '800',
  },
  categoryTabTextActive: {
    color: colors.brandDark,
  },
  categoryCount: {
    minWidth: 22,
    borderRadius: radii.pill,
    overflow: 'hidden',
    color: colors.textMuted,
    backgroundColor: colors.background,
    fontSize: 11,
    lineHeight: 18,
    fontWeight: '900',
    textAlign: 'center',
  },
  categoryCountActive: {
    color: colors.white,
    backgroundColor: colors.brand,
  },
  couponCard: {
    borderRadius: radii.sm,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: colors.brand,
    backgroundColor: colors.surface,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  couponCardSelected: {
    backgroundColor: colors.brandSoft,
  },
  discountCouponCard: {
    borderColor: colors.danger,
  },
  discountCouponCardSelected: {
    backgroundColor: colors.dangerSoft,
  },
  couponCardDisabled: {
    opacity: 0.58,
  },
  couponTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  codeRow: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  codeText: {
    color: colors.text,
    fontSize: 17,
    lineHeight: 23,
    fontWeight: '900',
  },
  useButton: {
    minWidth: 98,
    height: 48,
    borderRadius: radii.sm,
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  useButtonDisabled: {
    backgroundColor: colors.textSubtle,
  },
  discountUseButton: {
    backgroundColor: colors.danger,
  },
  useButtonText: {
    color: colors.white,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '900',
  },
  typePill: {
    alignSelf: 'flex-start',
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  typePillText: {
    fontSize: 12,
    fontWeight: '900',
  },
  valueText: {
    color: colors.brand,
    fontSize: 28,
    lineHeight: 36,
    fontWeight: '900',
    marginTop: spacing.sm,
  },
  discountValueText: {
    color: colors.danger,
  },
  metaText: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
  },
  estimateText: {
    color: colors.success,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '900',
    marginTop: spacing.xs,
  },
  reasonText: {
    color: colors.danger,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '800',
    marginTop: spacing.xs,
  },
  emptyState: {
    minHeight: 260,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  emptyTitle: {
    color: colors.text,
    fontSize: 17,
    lineHeight: 23,
    fontWeight: '900',
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
  },
});

export default CouponsScreen;
