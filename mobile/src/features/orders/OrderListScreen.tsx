import React from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import { colors, radii, shadows, spacing } from '../../theme';
import type { RootStackParamList } from '../../navigation/AppNavigator';
import { useAuth } from '../auth/AuthContext';
import { orderApi, OrderApiError, type CustomerOrder, type OrderStatusSummary } from './orderApi';
import {
  canCancelOrder,
  formatCurrency,
  formatDate,
  getDeliveryLine,
  getExtraItemText,
  getOrderMatchesTab,
  getOrderItemCount,
  getOrderTabCount,
  getPrimaryStatusForTab,
  getPrimaryItem,
  orderTabs,
  statusMeta,
  type OrderTabKey,
} from './orderPresentation';

type OrderListNavigationProp = StackNavigationProp<RootStackParamList, 'Orders'>;
type OrderListRouteProp = RouteProp<RootStackParamList, 'Orders'>;
type PaymentFilter = 'all' | 'needs-payment' | 'cash' | 'transfer';

const paymentFilters: Array<{ key: PaymentFilter; label: string }> = [
  { key: 'all', label: 'Tất cả thanh toán' },
  { key: 'cash', label: 'Tiền mặt' },
  { key: 'transfer', label: 'Chuyển khoản' },
];

const transferPaymentMethods = new Set(['VNPAY', 'MOMO', 'BANK', 'CARD']);
const displayedPaymentFilters: Array<{ key: PaymentFilter; label: string }> = [
  paymentFilters[0],
  { key: 'needs-payment', label: 'Chờ thanh toán' },
  ...paymentFilters.slice(1),
];

const getPaymentMethodQuery = (filter: PaymentFilter) => {
  if (filter === 'cash') return 'COD';
  return 'all';
};

const getPaymentStatusQuery = (filter: PaymentFilter) => {
  if (filter === 'needs-payment') return 'pending';
  return 'all';
};

const needsPaymentAction = (order: CustomerOrder) =>
  order.paymentMethod === 'VNPAY' &&
  (order.paymentStatus === 'pending' || order.paymentStatus === 'failed') &&
  !['cancelled', 'returned'].includes(order.status);

const getOrderMatchesPaymentFilter = (order: CustomerOrder, filter: PaymentFilter) => {
  if (filter === 'all') return true;
  if (filter === 'needs-payment') return needsPaymentAction(order);
  if (filter === 'cash') return order.paymentMethod === 'COD';

  return transferPaymentMethods.has(order.paymentMethod);
};

const isUnauthorizedError = (error: unknown) =>
  typeof error === 'object' &&
  error !== null &&
  'status' in error &&
  (error as { status?: number }).status === 401;

const isPreviewableImage = (value?: string | null) => !!value && /^https?:\/\//i.test(value.trim());

const getErrorMessage = (error: unknown) => {
  if (error instanceof OrderApiError || error instanceof Error) {
    return error.message;
  }

  return 'Không thể tải đơn hàng. Bạn thử lại sau nha.';
};

const OrderListScreen = () => {
  const navigation = useNavigation<OrderListNavigationProp>();
  const route = useRoute<OrderListRouteProp>();
  const { logout, runWithAuth, session } = useAuth();
  const initialStatus = route.params?.status ?? 'all';

  const [activeStatus, setActiveStatus] = React.useState<OrderTabKey>(initialStatus);
  const [orders, setOrders] = React.useState<CustomerOrder[]>([]);
  const [statusSummary, setStatusSummary] = React.useState<OrderStatusSummary | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isRefreshing, setIsRefreshing] = React.useState(false);
  const [isCancellingId, setIsCancellingId] = React.useState<string | null>(null);
  const [errorMessage, setErrorMessage] = React.useState('');
  const [searchText, setSearchText] = React.useState('');
  const [debouncedSearchText, setDebouncedSearchText] = React.useState('');
  const [paymentFilter, setPaymentFilter] = React.useState<PaymentFilter>('all');

  React.useEffect(() => {
    const timeout = setTimeout(() => {
      setDebouncedSearchText(searchText.trim());
    }, 320);

    return () => clearTimeout(timeout);
  }, [searchText]);

  const loadOrders = React.useCallback(
    async (status: OrderTabKey, mode: 'loading' | 'refresh' = 'loading') => {
      if (!session?.accessToken) {
        setOrders([]);
        setStatusSummary(null);
        navigation.navigate('Login');
        return;
      }

      if (mode === 'loading') {
        setIsLoading(true);
      } else {
        setIsRefreshing(true);
      }
      setErrorMessage('');

      try {
        const primaryStatus = getPrimaryStatusForTab(status);
        const paymentMethodQuery = getPaymentMethodQuery(paymentFilter);
        const paymentStatusQuery = getPaymentStatusQuery(paymentFilter);
        const response = await runWithAuth((accessToken) =>
          orderApi.getMyOrders(accessToken, {
            status: primaryStatus ?? 'all',
            paymentMethod: paymentMethodQuery,
            paymentStatus: paymentStatusQuery,
            keyword: debouncedSearchText || undefined,
            page: 1,
            limit: primaryStatus && paymentFilter === 'cash' ? 30 : 100,
          }),
        );
        setOrders(
          response.items.filter((order) =>
            (primaryStatus || status === 'all' ? true : getOrderMatchesTab(order, status)) &&
            getOrderMatchesPaymentFilter(order, paymentFilter),
          ),
        );
        setStatusSummary(response.statusSummary ?? null);
      } catch (error) {
        if (isUnauthorizedError(error)) {
          logout();
          navigation.reset({
            index: 0,
            routes: [{ name: 'Login' }],
          });
          return;
        }

        setErrorMessage(getErrorMessage(error));
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [debouncedSearchText, logout, navigation, paymentFilter, runWithAuth, session?.accessToken],
  );

  useFocusEffect(
    React.useCallback(() => {
      void loadOrders(activeStatus);
    }, [activeStatus, loadOrders]),
  );

  const handleRefresh = () => {
    void loadOrders(activeStatus, 'refresh');
  };

  const handleCancelOrder = (order: CustomerOrder) => {
    Alert.alert(
      'Hủy đơn hàng?',
      'Bạn có thể hủy khi đơn chưa bàn giao cho đơn vị vận chuyển. Sau khi hủy, tồn kho và voucher sẽ được hệ thống xử lý lại.',
      [
        { text: 'Để sau', style: 'cancel' },
        {
          text: 'Hủy đơn',
          style: 'destructive',
          onPress: () => {
            void confirmCancelOrder(order);
          },
        },
      ],
    );
  };

  const confirmCancelOrder = async (order: CustomerOrder) => {
    try {
      setIsCancellingId(order._id);
      const nextOrder = await runWithAuth((accessToken) => orderApi.cancelOrder(accessToken, order._id));
      setOrders((current) => current.map((item) => (item._id === nextOrder._id ? nextOrder : item)));
      void loadOrders(activeStatus, 'refresh');
    } catch (error) {
      Alert.alert('Không thể hủy đơn', getErrorMessage(error));
    } finally {
      setIsCancellingId(null);
    }
  };

  const getTabCount = (status: OrderTabKey) => getOrderTabCount(statusSummary, status);
  const hasActiveFilters = Boolean(debouncedSearchText) || paymentFilter !== 'all';

  const clearFilters = () => {
    setSearchText('');
    setDebouncedSearchText('');
    setPaymentFilter('all');
  };

  const renderOrderCard = (order: CustomerOrder) => {
    const primaryItem = getPrimaryItem(order);
    const extraItemText = getExtraItemText(order);
    const meta = statusMeta[order.status];
    const imageUri = primaryItem?.image?.trim();
    const canCancel = canCancelOrder(order.status);
    const requiresPayment = needsPaymentAction(order);

    return (
      <TouchableOpacity
        key={order._id}
        style={[styles.orderCard, requiresPayment && styles.orderCardNeedsPayment]}
        activeOpacity={0.84}
        onPress={() => navigation.navigate('OrderDetail', { orderId: order._id })}
      >
        <View style={styles.orderHeader}>
          <View style={styles.orderTitleGroup}>
            <Text style={styles.orderCode}>{order.orderCode}</Text>
            <Text style={styles.orderDate}>Đặt ngày {formatDate(order.createdAt)}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: meta.backgroundColor }]}>
            <Text style={[styles.statusBadgeText, { color: meta.color }]}>{meta.label}</Text>
          </View>
        </View>

        <View style={styles.productRow}>
          {isPreviewableImage(imageUri) ? (
            <Image source={{ uri: imageUri }} style={styles.productImage} resizeMode="cover" />
          ) : (
            <View style={styles.productImagePlaceholder}>
              <MaterialCommunityIcons name="tshirt-crew-outline" size={26} color={colors.textSubtle} />
            </View>
          )}

          <View style={styles.productInfo}>
            <Text style={styles.productName} numberOfLines={2}>
              {primaryItem?.name ?? 'Sản phẩm Fashionista'}
            </Text>
            <Text style={styles.productMeta} numberOfLines={1}>
              {primaryItem ? `${primaryItem.color} • ${primaryItem.size} • SL: ${primaryItem.quantity}` : 'Đang cập nhật'}
            </Text>
            {extraItemText ? <Text style={styles.extraItemText}>{extraItemText}</Text> : null}
          </View>

          <View style={styles.priceGroup}>
            <Text style={styles.totalLabel}>{getOrderItemCount(order)} món</Text>
            <Text style={styles.totalAmount}>{formatCurrency(order.totalAmount)}</Text>
          </View>
        </View>

        <View style={styles.deliveryRow}>
          <MaterialCommunityIcons
            name={requiresPayment ? 'credit-card-clock-outline' : 'truck-delivery-outline'}
            size={18}
            color={requiresPayment ? colors.goldText : colors.success}
          />
          <Text style={[styles.deliveryText, requiresPayment && styles.deliveryTextWarning]}>
            {requiresPayment ? 'Đơn VNPay đang chờ thanh toán. Bấm chi tiết để thanh toán lại.' : getDeliveryLine(order)}
          </Text>
        </View>

        <View style={styles.cardActions}>
          <TouchableOpacity
            style={styles.secondaryAction}
            onPress={() => navigation.navigate('OrderDetail', { orderId: order._id })}
            activeOpacity={0.82}
          >
            <MaterialCommunityIcons name="receipt-text-outline" size={18} color={colors.brand} />
            <Text style={styles.secondaryActionText}>Chi tiết</Text>
          </TouchableOpacity>

          {canCancel ? (
            <TouchableOpacity
              style={styles.dangerAction}
              onPress={() => handleCancelOrder(order)}
              activeOpacity={0.82}
              disabled={isCancellingId === order._id}
            >
              {isCancellingId === order._id ? (
                <ActivityIndicator size="small" color={colors.danger} />
              ) : (
                <MaterialCommunityIcons name="close-circle-outline" size={18} color={colors.danger} />
              )}
              <Text style={styles.dangerActionText}>Hủy đơn</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.headerAction}
          onPress={() => navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Profile')}
          activeOpacity={0.8}
          accessibilityLabel="Trở về"
        >
          <MaterialCommunityIcons name="arrow-left" size={24} color={colors.white} />
        </TouchableOpacity>
        <View style={styles.headerTitleGroup}>
          <Text style={styles.brand}>FASHIONISTA</Text>
          <Text style={styles.headerTitle}>Đơn hàng của tôi</Text>
        </View>
        <TouchableOpacity
          style={styles.headerAction}
          onPress={handleRefresh}
          activeOpacity={0.8}
          accessibilityLabel="Tải lại"
        >
          <MaterialCommunityIcons name="refresh" size={22} color={colors.white} />
        </TouchableOpacity>
      </View>

      <View style={styles.content}>
        <View style={styles.filterPanel}>
          <View style={styles.searchBox}>
            <MaterialCommunityIcons name="magnify" size={21} color={colors.textMuted} />
            <TextInput
              style={styles.searchInput}
              value={searchText}
              onChangeText={setSearchText}
              placeholder="Tìm mã đơn, hóa đơn, sản phẩm"
              placeholderTextColor={colors.textSubtle}
              returnKeyType="search"
            />
            {searchText ? (
              <TouchableOpacity onPress={() => setSearchText('')} style={styles.searchClearButton} activeOpacity={0.8}>
                <MaterialCommunityIcons name="close-circle" size={19} color={colors.textSubtle} />
              </TouchableOpacity>
            ) : null}
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.paymentFilters}>
            {displayedPaymentFilters.map((item) => {
              const isActive = paymentFilter === item.key;

              return (
                <TouchableOpacity
                  key={item.key}
                  style={[styles.paymentFilterButton, isActive && styles.paymentFilterButtonActive]}
                  onPress={() => setPaymentFilter(item.key)}
                  activeOpacity={0.84}
                >
                  <Text style={[styles.paymentFilterText, isActive && styles.paymentFilterTextActive]}>
                    {item.label}
                  </Text>
                </TouchableOpacity>
              );
            })}

            {hasActiveFilters ? (
              <TouchableOpacity style={styles.resetFilterButton} onPress={clearFilters} activeOpacity={0.84}>
                <MaterialCommunityIcons name="filter-remove-outline" size={17} color={colors.danger} />
                <Text style={styles.resetFilterText}>Xóa lọc</Text>
              </TouchableOpacity>
            ) : null}
          </ScrollView>
        </View>

        <View style={styles.tabsPanel}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabsContent}>
            {orderTabs.map((tab) => {
              const isActive = activeStatus === tab.key;
              const count = getTabCount(tab.key);

              return (
                <TouchableOpacity
                  key={tab.key}
                  style={[styles.tabButton, isActive && styles.tabButtonActive]}
                  onPress={() => setActiveStatus(tab.key)}
                  activeOpacity={0.84}
                >
                  <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]}>{tab.label}</Text>
                  <Text style={[styles.tabCount, isActive && styles.tabCountActive]}>
                    {count === undefined ? tab.helper : `${count} đơn`}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        <ScrollView
          style={styles.orderScroll}
          contentContainerStyle={styles.orderScrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} tintColor={colors.brand} />}
        >
          {isLoading ? (
            <View style={styles.statePanel}>
              <ActivityIndicator size="large" color={colors.brand} />
              <Text style={styles.stateTitle}>Đang tải đơn hàng</Text>
              <Text style={styles.stateText}>Fashionista đang gom lại lịch sử mua sắm của bạn.</Text>
            </View>
          ) : errorMessage ? (
            <View style={styles.statePanel}>
              <MaterialCommunityIcons name="alert-circle-outline" size={42} color={colors.danger} />
              <Text style={styles.stateTitle}>Có lỗi khi tải đơn</Text>
              <Text style={styles.stateText}>{errorMessage}</Text>
              <TouchableOpacity style={styles.primaryButton} onPress={handleRefresh} activeOpacity={0.84}>
                <Text style={styles.primaryButtonText}>Thử lại</Text>
              </TouchableOpacity>
            </View>
          ) : orders.length === 0 ? (
            <View style={styles.statePanel}>
              <MaterialCommunityIcons name="package-variant-closed" size={46} color={colors.brand} />
              <Text style={styles.stateTitle}>Chưa có đơn phù hợp</Text>
              <Text style={styles.stateText}>
                Bạn có thể chuyển tab khác hoặc tiếp tục mua sắm để tạo đơn mới.
              </Text>
              <TouchableOpacity
                style={styles.primaryButton}
                onPress={() => navigation.navigate('ProductList', { title: 'Tất cả sản phẩm' })}
                activeOpacity={0.84}
              >
                <Text style={styles.primaryButtonText}>Mua sắm ngay</Text>
              </TouchableOpacity>
            </View>
          ) : (
            orders.map(renderOrderCard)
          )}

          <View style={styles.policyCard}>
            <View style={styles.policyIcon}>
              <MaterialCommunityIcons name="shield-check-outline" size={22} color={colors.brand} />
            </View>
            <View style={styles.policyCopy}>
              <Text style={styles.policyTitle}>Chính sách xử lý đơn</Text>
              <Text style={styles.policyText}>
                Hủy đơn trước khi bàn giao vận chuyển. Đơn đã giao có thể yêu cầu hỗ trợ đổi trả trong 7 ngày nếu còn tem mác và hóa đơn.
              </Text>
            </View>
          </View>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.brand,
  },
  header: {
    minHeight: 84,
    paddingHorizontal: spacing.xl,
    paddingTop: 10,
    paddingBottom: 18,
    backgroundColor: colors.brand,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerAction: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  headerTitleGroup: {
    flex: 1,
    paddingHorizontal: 12,
  },
  brand: {
    color: colors.brandMist,
    fontSize: 13,
    fontWeight: '700',
  },
  headerTitle: {
    color: colors.white,
    fontSize: 25,
    lineHeight: 32,
    fontWeight: '800',
    marginTop: 2,
  },
  content: {
    flex: 1,
    backgroundColor: colors.background,
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
    overflow: 'hidden',
  },
  filterPanel: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    gap: spacing.sm,
    backgroundColor: colors.background,
  },
  searchBox: {
    minHeight: 48,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  searchInput: {
    flex: 1,
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
    paddingVertical: 0,
  },
  searchClearButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  paymentFilters: {
    gap: spacing.sm,
    paddingRight: spacing.lg,
  },
  paymentFilterButton: {
    minHeight: 36,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  paymentFilterButtonActive: {
    borderColor: colors.brand,
    backgroundColor: colors.brandSoft,
  },
  paymentFilterText: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '800',
  },
  paymentFilterTextActive: {
    color: colors.brandDark,
  },
  resetFilterButton: {
    minHeight: 36,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.dangerSoft,
    backgroundColor: '#FFF7F7',
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },
  resetFilterText: {
    color: colors.danger,
    fontSize: 12,
    fontWeight: '900',
  },
  tabsPanel: {
    paddingTop: spacing.md,
    backgroundColor: colors.background,
  },
  tabsContent: {
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  tabButton: {
    minWidth: 118,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  tabButtonActive: {
    borderColor: colors.brand,
    backgroundColor: colors.brandSoft,
  },
  tabLabel: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '800',
  },
  tabLabelActive: {
    color: colors.brandDark,
  },
  tabCount: {
    color: colors.textMuted,
    fontSize: 11,
    lineHeight: 16,
    marginTop: 2,
  },
  tabCountActive: {
    color: colors.brand,
    fontWeight: '700',
  },
  orderScroll: {
    flex: 1,
  },
  orderScrollContent: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
    gap: spacing.md,
  },
  orderCard: {
    borderRadius: radii.sm,
    backgroundColor: colors.surface,
    padding: spacing.lg,
    ...shadows.card,
  },
  orderCardNeedsPayment: {
    borderWidth: 1,
    borderColor: colors.gold,
    backgroundColor: '#FFFCF5',
  },
  orderHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  orderTitleGroup: {
    flex: 1,
  },
  orderCode: {
    color: colors.text,
    fontSize: 17,
    lineHeight: 24,
    fontWeight: '800',
  },
  orderDate: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  statusBadge: {
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: '800',
  },
  productRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.lg,
  },
  productImage: {
    width: 70,
    height: 70,
    borderRadius: radii.sm,
    backgroundColor: colors.brandSoft,
  },
  productImagePlaceholder: {
    width: 70,
    height: 70,
    borderRadius: radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F0F2F4',
  },
  productInfo: {
    flex: 1,
    minWidth: 0,
  },
  productName: {
    color: colors.text,
    fontSize: 15,
    lineHeight: 21,
    fontWeight: '800',
  },
  productMeta: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 3,
  },
  extraItemText: {
    color: colors.brand,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 4,
  },
  priceGroup: {
    alignItems: 'flex-end',
    gap: 3,
  },
  totalLabel: {
    color: colors.textMuted,
    fontSize: 12,
  },
  totalAmount: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '900',
  },
  deliveryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  deliveryText: {
    flex: 1,
    color: colors.success,
    fontSize: 13,
    fontWeight: '700',
  },
  deliveryTextWarning: {
    color: colors.goldText,
  },
  cardActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  secondaryAction: {
    minHeight: 40,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  secondaryActionText: {
    color: colors.brand,
    fontSize: 13,
    fontWeight: '800',
  },
  dangerAction: {
    minHeight: 40,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.dangerSoft,
    backgroundColor: '#FFF7F7',
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  dangerActionText: {
    color: colors.danger,
    fontSize: 13,
    fontWeight: '800',
  },
  statePanel: {
    minHeight: 260,
    borderRadius: radii.sm,
    backgroundColor: colors.surface,
    padding: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    ...shadows.card,
  },
  stateTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '900',
    textAlign: 'center',
  },
  stateText: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 20,
    textAlign: 'center',
  },
  primaryButton: {
    minHeight: 44,
    borderRadius: radii.sm,
    backgroundColor: colors.brand,
    paddingHorizontal: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.sm,
  },
  primaryButtonText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '800',
  },
  policyCard: {
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.lg,
    flexDirection: 'row',
    gap: spacing.md,
  },
  policyIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.brandSoft,
  },
  policyCopy: {
    flex: 1,
  },
  policyTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '900',
  },
  policyText: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 4,
  },
});

export default OrderListScreen;
