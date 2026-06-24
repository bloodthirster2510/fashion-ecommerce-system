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
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import { brandedHeaderStyles, colors, radii, shadows, spacing } from '../../theme';
import type { RootStackParamList } from '../../navigation/AppNavigator';
import { useStaleFocusEffect } from '../../hooks/useStaleFocusEffect';
import { useAuth } from '../auth/AuthContext';
import {
  orderApi,
  OrderApiError,
  type CustomerOrder,
  type OrderListResponse,
  type OrderPaymentMethod,
  type OrderPaymentStatus,
  type OrderStatus,
  type OrderStatusSummary,
} from './orderApi';
import {
  canConfirmReceived,
  formatCurrency,
  formatDate,
  getExtraItemText,
  getOrderDisplayState,
  getOrderMatchesTab,
  getOrderItemCount,
  getOrderTab,
  getOrderTabCount,
  getPrimaryItem,
  orderNeedsPaymentAction,
  orderNeedsUserAction,
  orderTabs,
  type OrderTabKey,
} from './orderPresentation';
import { useOrderRealtime } from './orderRealtime';

type OrderListNavigationProp = StackNavigationProp<RootStackParamList, 'Orders'>;
type OrderListRouteProp = RouteProp<RootStackParamList, 'Orders'>;
type PaymentFilter = 'all' | 'needs-payment' | 'cash' | 'transfer';

const paymentFilters: Array<{ key: PaymentFilter; label: string }> = [
  { key: 'all', label: 'Tất cả' },
  { key: 'cash', label: 'COD' },
  { key: 'transfer', label: 'Online' },
];

const ORDER_PAGE_LIMIT = 20;
const onlinePaymentMethods: OrderPaymentMethod[] = ['VNPAY', 'MOMO', 'BANK', 'CARD'];
const retryablePaymentStatuses: OrderPaymentStatus[] = ['pending', 'failed'];
const closedPaymentActionStatuses = new Set<OrderStatus>(['cancelled', 'returned']);
const transferPaymentMethods = new Set<OrderPaymentMethod>(onlinePaymentMethods);
const displayedPaymentFilters: Array<{ key: PaymentFilter; label: string }> = [
  paymentFilters[0],
  { key: 'needs-payment', label: 'Cần thanh toán' },
  ...paymentFilters.slice(1),
];

const getStatusesQuery = (status: OrderTabKey, filter: PaymentFilter) => {
  const tabStatuses = getOrderTab(status).statuses;

  if (filter !== 'needs-payment') {
    return status === 'all' ? undefined : tabStatuses;
  }

  return tabStatuses.filter((orderStatus) => !closedPaymentActionStatuses.has(orderStatus));
};

const getPaymentMethodsQuery = (filter: PaymentFilter): OrderPaymentMethod[] | undefined => {
  if (filter === 'cash') return ['COD'];
  if (filter === 'transfer') return onlinePaymentMethods;
  if (filter === 'needs-payment') return ['VNPAY'];
  return undefined;
};

const getPaymentStatusesQuery = (filter: PaymentFilter): OrderPaymentStatus[] | undefined =>
  filter === 'needs-payment' ? retryablePaymentStatuses : undefined;

const mergeOrdersById = (current: CustomerOrder[], incoming: CustomerOrder[]) => {
  const seenOrderIds = new Set(current.map((order) => order._id));
  return [
    ...current,
    ...incoming.filter((order) => {
      if (seenOrderIds.has(order._id)) {
        return false;
      }

      seenOrderIds.add(order._id);
      return true;
    }),
  ];
};

const getOrderMatchesPaymentFilter = (order: CustomerOrder, filter: PaymentFilter) => {
  if (filter === 'all') return true;
  if (filter === 'needs-payment') return orderNeedsPaymentAction(order);
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
  const initialStatus = getOrderTab(route.params?.status ?? 'active').key;

  const [activeStatus, setActiveStatus] = React.useState<OrderTabKey>(initialStatus);
  const [orders, setOrders] = React.useState<CustomerOrder[]>([]);
  const [statusSummary, setStatusSummary] = React.useState<OrderStatusSummary | null>(null);
  const [pagination, setPagination] = React.useState<OrderListResponse['pagination'] | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isRefreshing, setIsRefreshing] = React.useState(false);
  const [isLoadingMore, setIsLoadingMore] = React.useState(false);
  const [isConfirmingId, setIsConfirmingId] = React.useState<string | null>(null);
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
    async (status: OrderTabKey, mode: 'loading' | 'refresh' | 'more' = 'loading', page = 1) => {
      if (!session?.accessToken) {
        setOrders([]);
        setStatusSummary(null);
        setPagination(null);
        navigation.navigate('Login');
        return;
      }

      if (mode === 'loading') {
        setIsLoading(true);
      } else if (mode === 'refresh') {
        setIsRefreshing(true);
      } else {
        setIsLoadingMore(true);
      }
      if (mode !== 'more') {
        setErrorMessage('');
      }

      try {
        const statusesQuery = getStatusesQuery(status, paymentFilter);
        const paymentMethodsQuery = getPaymentMethodsQuery(paymentFilter);
        const paymentStatusesQuery = getPaymentStatusesQuery(paymentFilter);
        const response = await runWithAuth((accessToken) =>
          orderApi.getMyOrders(accessToken, {
            statuses: statusesQuery,
            paymentMethods: paymentMethodsQuery,
            paymentStatuses: paymentStatusesQuery,
            keyword: debouncedSearchText || undefined,
            page,
            limit: ORDER_PAGE_LIMIT,
          }),
        );
        const nextOrders = response.items.filter((order) =>
          getOrderMatchesTab(order, status) &&
          getOrderMatchesPaymentFilter(order, paymentFilter),
        );

        setOrders((current) => (mode === 'more' ? mergeOrdersById(current, nextOrders) : nextOrders));
        setStatusSummary(response.statusSummary ?? null);
        setPagination(response.pagination ?? null);
      } catch (error) {
        if (isUnauthorizedError(error)) {
          logout();
          navigation.reset({
            index: 0,
            routes: [{ name: 'Login' }],
          });
          return;
        }

        if (mode === 'more') {
          Alert.alert('Không thể tải thêm đơn', getErrorMessage(error));
        } else {
          setErrorMessage(getErrorMessage(error));
        }
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
        setIsLoadingMore(false);
      }
    },
    [debouncedSearchText, logout, navigation, paymentFilter, runWithAuth, session?.accessToken],
  );

  useStaleFocusEffect(
    () => {
      void loadOrders(activeStatus);
    },
    [activeStatus, loadOrders],
    { staleMs: 30 * 1000 },
  );

  useOrderRealtime(session?.accessToken, () => {
    void loadOrders(activeStatus, 'refresh');
  });

  const handleRefresh = () => {
    void loadOrders(activeStatus, 'refresh');
  };

  const hasMoreOrders = Boolean(pagination && pagination.page < pagination.totalPages);

  const handleLoadMore = () => {
    if (!pagination || !hasMoreOrders || isLoading || isRefreshing || isLoadingMore) {
      return;
    }

    void loadOrders(activeStatus, 'more', pagination.page + 1);
  };

  const handleConfirmReceived = (order: CustomerOrder) => {
    Alert.alert(
      'Xác nhận đã nhận hàng?',
      'Sau khi xác nhận, đơn sẽ chuyển sang Hoàn tất. Bạn vẫn có thể yêu cầu hỗ trợ đổi trả nếu phát sinh vấn đề.',
      [
        { text: 'Để sau', style: 'cancel' },
        {
          text: 'Đã nhận hàng',
          onPress: () => {
            void confirmReceivedOrder(order);
          },
        },
      ],
    );
  };

  const confirmReceivedOrder = async (order: CustomerOrder) => {
    try {
      setIsConfirmingId(order._id);
      const nextOrder = await runWithAuth((accessToken) => orderApi.confirmReceived(accessToken, order._id));
      setOrders((current) => current.map((item) => (item._id === nextOrder._id ? nextOrder : item)));
      void loadOrders(activeStatus, 'refresh');
    } catch (error) {
      Alert.alert('Không thể xác nhận nhận hàng', getErrorMessage(error));
    } finally {
      setIsConfirmingId(null);
    }
  };

  const getTabCount = (status: OrderTabKey) => getOrderTabCount(statusSummary, status);
  const hasActiveFilters = Boolean(debouncedSearchText) || paymentFilter !== 'all';
  const selectedTab = getOrderTab(activeStatus);
  const hasVisiblePaymentAction = orders.some(orderNeedsPaymentAction);
  const hasShippingAction = (statusSummary?.shipping ?? 0) > 0;

  const shouldShowPaymentFilterDot = (filter: PaymentFilter) =>
    filter === 'needs-payment' && (hasVisiblePaymentAction || paymentFilter === 'needs-payment');

  const shouldShowTabDot = (tab: OrderTabKey) =>
    tab === 'shipping' && hasShippingAction;

  const clearFilters = () => {
    setSearchText('');
    setDebouncedSearchText('');
    setPaymentFilter('all');
  };

  const renderOrderCard = (order: CustomerOrder) => {
    const primaryItem = getPrimaryItem(order);
    const extraItemText = getExtraItemText(order);
    const displayState = getOrderDisplayState(order);
    const imageUri = primaryItem?.image?.trim();
    const canConfirmDelivery = canConfirmReceived(order);
    const requiresPayment = orderNeedsPaymentAction(order);
    const requiresUserAction = orderNeedsUserAction(order);
    const deadlineRemaining = order.paymentDeadlineAt
      ? new Date(order.paymentDeadlineAt).getTime() - Date.now()
      : null;
    const isDeadlineSoon = requiresPayment && deadlineRemaining !== null &&
      deadlineRemaining > 0 && deadlineRemaining <= 24 * 60 * 60 * 1000;

    return (
      <TouchableOpacity
        key={order._id}
        style={[
          styles.orderCard,
          requiresUserAction && styles.orderCardAttention,
          requiresPayment && styles.orderCardNeedsPayment,
        ]}
        activeOpacity={0.84}
        onPress={() => navigation.navigate('OrderDetail', { orderId: order._id })}
      >
        <View style={styles.orderHeader}>
          <View style={styles.orderTitleGroup}>
            <Text style={styles.orderCode}>{order.orderCode}</Text>
            <Text style={styles.orderDate}>Đặt ngày {formatDate(order.createdAt)}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: displayState.backgroundColor }]}>
            {requiresUserAction ? <View style={[styles.statusBadgeDot, { backgroundColor: displayState.color }]} /> : null}
            <Text style={[styles.statusBadgeText, { color: displayState.color }]}>{displayState.label}</Text>
          </View>
        </View>

        {isDeadlineSoon ? (
          <View style={styles.paymentDeadlineChip}>
            <MaterialCommunityIcons name="timer-alert-outline" size={15} color={colors.goldText} />
            <Text style={styles.paymentDeadlineChipText}>Sắp quá hạn thanh toán</Text>
          </View>
        ) : null}

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
            name={displayState.icon as keyof typeof MaterialCommunityIcons.glyphMap}
            size={18}
            color={displayState.color}
          />
          <Text style={[styles.deliveryText, { color: displayState.color }]}>
            {displayState.description}
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

          {canConfirmDelivery ? (
            <TouchableOpacity
              style={styles.primaryAction}
              onPress={() => handleConfirmReceived(order)}
              activeOpacity={0.82}
              disabled={isConfirmingId === order._id}
            >
              {isConfirmingId === order._id ? (
                <ActivityIndicator size="small" color={colors.white} />
              ) : (
                <MaterialCommunityIcons name="package-check" size={18} color={colors.white} />
              )}
              <Text style={styles.primaryActionText}>Đã nhận hàng</Text>
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
              const showDot = shouldShowPaymentFilterDot(item.key);

              return (
                <TouchableOpacity
                  key={item.key}
                  style={[styles.paymentFilterButton, isActive && styles.paymentFilterButtonActive]}
                  onPress={() => setPaymentFilter(item.key)}
                  activeOpacity={0.84}
                >
                  {showDot ? <View style={styles.filterActionDot} /> : null}
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
              const showDot = shouldShowTabDot(tab.key);

              return (
                <TouchableOpacity
                  key={tab.key}
                  style={[styles.tabButton, isActive && styles.tabButtonActive]}
                  onPress={() => setActiveStatus(tab.key)}
                  activeOpacity={0.84}
                >
                  <View style={styles.tabLabelRow}>
                    {showDot ? <View style={styles.tabActionDot} /> : null}
                    <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]}>{tab.label}</Text>
                  </View>
                  <Text style={[styles.tabCount, isActive && styles.tabCountActive]}>
                    {count === undefined ? tab.helper : `${count} đơn`}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        <View style={styles.listSummary}>
          <View style={styles.listSummaryCopy}>
            <Text style={styles.listSummaryTitle}>{selectedTab.label}</Text>
            <Text style={styles.listSummaryText}>{selectedTab.helper}</Text>
          </View>
          <View style={styles.listSummaryBadge}>
            <Text style={styles.listSummaryBadgeText}>{isLoading ? '...' : `${orders.length} đơn`}</Text>
          </View>
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
            <>
              {orders.map(renderOrderCard)}
              {hasMoreOrders ? (
                <TouchableOpacity
                  style={[styles.primaryButton, styles.loadMoreButton]}
                  onPress={handleLoadMore}
                  activeOpacity={0.84}
                  disabled={isLoadingMore}
                >
                  {isLoadingMore ? (
                    <ActivityIndicator size="small" color={colors.white} />
                  ) : (
                    <MaterialCommunityIcons name="chevron-down" size={18} color={colors.white} />
                  )}
                  <Text style={styles.primaryButtonText}>
                    {isLoadingMore ? 'Đang tải thêm' : 'Tải thêm đơn'}
                  </Text>
                </TouchableOpacity>
              ) : null}
            </>
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
    ...brandedHeaderStyles.container,
  },
  headerAction: {
    ...brandedHeaderStyles.action,
  },
  headerTitleGroup: {
    ...brandedHeaderStyles.titleGroup,
    alignItems: 'center',
  },
  brand: {
    color: colors.brandMist,
    fontSize: 13,
    fontWeight: '700',
  },
  headerTitle: {
    ...brandedHeaderStyles.title,
    marginTop: 0,
    textAlign: 'center',
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
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
  filterActionDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.goldDark,
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
  tabLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  tabActionDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.danger,
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
  listSummary: {
    minHeight: 58,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    backgroundColor: colors.background,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  listSummaryCopy: {
    flex: 1,
    minWidth: 0,
  },
  listSummaryTitle: {
    color: colors.text,
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '900',
  },
  listSummaryText: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 2,
  },
  listSummaryBadge: {
    minHeight: 32,
    borderRadius: radii.pill,
    backgroundColor: colors.brandSoft,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listSummaryBadgeText: {
    color: colors.brandDark,
    fontSize: 12,
    fontWeight: '900',
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
  orderCardAttention: {
    borderWidth: 1,
    borderColor: colors.borderStrong,
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
  paymentDeadlineChip: {
    alignSelf: 'flex-start',
    marginTop: spacing.sm,
    borderRadius: radii.pill,
    backgroundColor: colors.brandSoft,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  paymentDeadlineChipText: {
    color: colors.goldText,
    fontSize: 11,
    fontWeight: '900',
  },
  attentionBadge: {
    alignSelf: 'flex-start',
    minHeight: 24,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.sm,
    marginTop: spacing.xs,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  attentionDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  attentionBadgeText: {
    maxWidth: 180,
    fontSize: 12,
    fontWeight: '900',
  },
  statusBadge: {
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusBadgeDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
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
    flexWrap: 'wrap',
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
  primaryAction: {
    minHeight: 40,
    borderRadius: radii.sm,
    backgroundColor: colors.brand,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  primaryActionText: {
    color: colors.white,
    fontSize: 13,
    fontWeight: '900',
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
  loadMoreButton: {
    flexDirection: 'row',
    alignSelf: 'stretch',
    gap: spacing.sm,
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
