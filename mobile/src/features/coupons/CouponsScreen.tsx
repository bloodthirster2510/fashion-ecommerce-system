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
  const [isLoading, setIsLoading] = React.useState(true);
  const [isRefreshing, setIsRefreshing] = React.useState(false);
  const hasLoadedOnceRef = React.useRef(false);

  const routeCartItemIds = route.params?.cartItemIds;
  const cartItemIds = React.useMemo(() => routeCartItemIds ?? [], [routeCartItemIds]);
  const hasCartContext = cartItemIds.length > 0;

  const loadCoupons = React.useCallback(
    async (silent = false) => {
      if (!session?.accessToken) {
        setItems([]);
        setIsLoading(false);
        return;
      }

      if (silent || hasLoadedOnceRef.current) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }

      try {
        const response = await runWithAuth((accessToken) =>
          couponApi.getAvailableCoupons(accessToken, {
            cartItemIds: hasCartContext ? cartItemIds : undefined,
            paymentMethod: 'COD',
          }),
        );
        setItems(response.items);
      } catch (error) {
        Alert.alert(
          'Chưa tải được voucher',
          error instanceof Error ? error.message : 'Bạn thử lại sau nha.',
        );
      } finally {
        hasLoadedOnceRef.current = true;
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [cartItemIds, hasCartContext, runWithAuth, session?.accessToken],
  );

  React.useEffect(() => {
    void loadCoupons();
  }, [loadCoupons]);

  const handleUseCoupon = (item: AvailableCouponItem) => {
    if (item.isApplicable === false) {
      Alert.alert('Voucher chưa dùng được', item.reason || 'Voucher chưa phù hợp với đơn hàng này.');
      return;
    }

    navigation.navigate('Cart', { couponCode: item.coupon.code });
  };

  const renderCoupon = (item: AvailableCouponItem) => {
    const estimateText = getEstimateText(item);
    const isDisabled = item.isApplicable === false;
    const isSelected = route.params?.selectedCouponCode === item.coupon.code;

    return (
      <View
        key={item.coupon._id}
        style={[
          styles.couponCard,
          isSelected && styles.couponCardSelected,
          isDisabled && styles.couponCardDisabled,
        ]}
      >
        <View style={styles.couponTop}>
          <View style={styles.codeRow}>
            <MaterialCommunityIcons name="ticket-percent-outline" size={22} color={colors.brand} />
            <Text style={styles.codeText} numberOfLines={1}>
              {item.coupon.code}
            </Text>
          </View>
          <TouchableOpacity
            style={[styles.useButton, isDisabled && styles.useButtonDisabled]}
            onPress={() => handleUseCoupon(item)}
            activeOpacity={0.82}
          >
            <Text style={styles.useButtonText}>{isSelected ? 'Đang dùng' : 'Sử dụng'}</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.valueText}>{getCouponValueText(item)}</Text>
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
        <Text style={styles.headerTitle}>Ưu đãi</Text>
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
          refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={() => loadCoupons(true)} />}
          showsVerticalScrollIndicator={false}
        >
          {items.length ? items.map(renderCoupon) : (
            <View style={styles.emptyState}>
              <MaterialCommunityIcons name="ticket-confirmation-outline" size={36} color={colors.textSubtle} />
              <Text style={styles.emptyTitle}>Chưa có voucher khả dụng</Text>
              <Text style={styles.emptyText}>Ưu đãi mới sẽ xuất hiện tại đây khi được mở.</Text>
            </View>
          )}
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
  useButtonText: {
    color: colors.white,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '900',
  },
  valueText: {
    color: colors.brand,
    fontSize: 28,
    lineHeight: 36,
    fontWeight: '900',
    marginTop: spacing.sm,
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
