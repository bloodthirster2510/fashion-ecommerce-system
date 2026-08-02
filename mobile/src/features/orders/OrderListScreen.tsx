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
import { useIsFocused, useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import { brandedHeaderStyles, colors, radii, shadows, spacing } from '../../theme';
import type { RootStackParamList } from '../../navigation/AppNavigator';
import { resolveFocusRefreshMode, useStaleFocusEffect } from '../../hooks/useStaleFocusEffect';
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
  getOrderMatchesTab,
  getOrderTab,
  getOrderTabCount,
  orderNeedsPaymentAction,
  orderTabs,
  onlinePaymentMethods,
  type OrderTabKey,
} from './orderPresentation';
import { useOrderRealtime } from './orderRealtime';
import { OrderCard } from './components/OrderCard';
import { OrderFilterPanel, type PaymentFilter } from './components/OrderFilterPanel';
import { readScreenData, writeScreenData } from '../../config/screenDataCache';

type OrderListNavigationProp = StackNavigationProp<RootStackParamList, 'Orders'>;
type OrderListRouteProp = RouteProp<RootStackParamList, 'Orders'>;

const paymentFilters: Array<{ key: PaymentFilter; label: string }> = [
  { key: 'all', label: 'Tất cả' },
  { key: 'cash', label: 'COD' },
  { key: 'transfer', label: 'Online' },
];

const ORDER_PAGE_LIMIT = 20;
const retryablePaymentStatuses: OrderPaymentStatus[] = ['pending', 'failed'];
const closedPaymentActionStatuses = new Set<OrderStatus>(['completed', 'cancelled', 'returned']);
const transferPaymentMethods = new Set<OrderPaymentMethod>(onlinePaymentMethods);
const displayedPaymentFilters: Array<{ key: PaymentFilter; label: string }> = [
  paymentFilters[0],
  { key: 'needs-payment', label: 'Cần thanh toán' },
  ...paymentFilters.slice(1),
];

const getOrdersScreenQueryKey = (
  accountScope: string,
  status: OrderTabKey,
  paymentFilter: PaymentFilter,
  searchText: string,
) => JSON.stringify({ accountScope, status, paymentFilter, searchText });

const getOrdersCacheKey = (queryKey: string) => `orders:list:${queryKey}`;

const getStatusesQuery = (status: OrderTabKey, filter: PaymentFilter) => {
  const tabStatuses = getOrderTab(status).statuses;

  if (filter !== 'needs-payment') {
    return tabStatuses;
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

const getErrorMessage = (error: unknown) => {
  if (error instanceof OrderApiError || error instanceof Error) {
    return error.message;
  }

  return 'Không thể tải đơn hàng. Bạn thử lại sau nha.';
};

const OrderListScreen = () => {
  const navigation = useNavigation<OrderListNavigationProp>();
  const route = useRoute<OrderListRouteProp>();
  const isFocused = useIsFocused();
  const { logout, runWithAuth, session } = useAuth();
  const initialStatus = getOrderTab(route.params?.status ?? 'all').key;
  const ordersAccountScope = session?.user?._id ?? 'logged-out';
  const initialOrdersQueryKeyRef = React.useRef(
    getOrdersScreenQueryKey(ordersAccountScope, initialStatus, 'all', ''),
  );
  const initialOrdersRef = React.useRef(
    session?.accessToken
      ? readScreenData<OrderListResponse>(getOrdersCacheKey(initialOrdersQueryKeyRef.current))
      : undefined,
  );

  const [activeStatus, setActiveStatus] = React.useState<OrderTabKey>(initialStatus);
  const [orders, setOrders] = React.useState<CustomerOrder[]>(initialOrdersRef.current?.items ?? []);
  const [statusSummary, setStatusSummary] = React.useState<OrderStatusSummary | null>(
    initialOrdersRef.current?.statusSummary ?? null,
  );
  const [pagination, setPagination] = React.useState<OrderListResponse['pagination'] | null>(
    initialOrdersRef.current?.pagination ?? null,
  );
  const [isLoading, setIsLoading] = React.useState(!initialOrdersRef.current);
  const [isRefreshing, setIsRefreshing] = React.useState(false);
  const [isLoadingMore, setIsLoadingMore] = React.useState(false);
  const [isConfirmingId, setIsConfirmingId] = React.useState<string | null>(null);
  const [errorMessage, setErrorMessage] = React.useState('');
  const [searchText, setSearchText] = React.useState('');
  const [debouncedSearchText, setDebouncedSearchText] = React.useState('');
  const [paymentFilter, setPaymentFilter] = React.useState<PaymentFilter>('all');
  const [isFilterOpen, setIsFilterOpen] = React.useState(false);
  const loadedOrdersQueryKeyRef = React.useRef<string | null>(
    initialOrdersRef.current ? initialOrdersQueryKeyRef.current : null,
  );
  const ordersRequestSequenceRef = React.useRef(0);

  const getOrdersQueryKey = React.useCallback((status: OrderTabKey) => getOrdersScreenQueryKey(
    ordersAccountScope,
    status,
    paymentFilter,
    debouncedSearchText,
  ), [debouncedSearchText, ordersAccountScope, paymentFilter]);

  React.useEffect(() => {
    const queryKey = getOrdersQueryKey(activeStatus);
    if (loadedOrdersQueryKeyRef.current !== queryKey || !pagination) return;
    writeScreenData<OrderListResponse>(getOrdersCacheKey(queryKey), {
      items: orders,
      pagination,
      ...(statusSummary ? { statusSummary } : {}),
    });
  }, [activeStatus, getOrdersQueryKey, orders, pagination, statusSummary]);

  React.useEffect(() => {
    const timeout = setTimeout(() => {
      setDebouncedSearchText(searchText.trim());
    }, 320);

    return () => clearTimeout(timeout);
  }, [searchText]);

  const loadOrders = React.useCallback(
    async (status: OrderTabKey, mode: 'loading' | 'refresh' | 'more' | 'silent' = 'loading', page = 1) => {
      const requestSequence = ordersRequestSequenceRef.current + 1;
      ordersRequestSequenceRef.current = requestSequence;

      if (!session?.accessToken) {
        loadedOrdersQueryKeyRef.current = null;
        setOrders([]);
        setStatusSummary(null);
        setPagination(null);
        setIsLoading(false);
        setIsRefreshing(false);
        setIsLoadingMore(false);
        navigation.navigate('Login');
        return;
      }

      if (mode === 'loading') {
        setIsLoading(true);
      } else if (mode === 'refresh') {
        setIsRefreshing(true);
      } else if (mode === 'more') {
        setIsLoadingMore(true);
      }
      if (mode !== 'more' && mode !== 'silent') {
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
        if (ordersRequestSequenceRef.current !== requestSequence) return;
        const nextOrders = response.items.filter((order) =>
          getOrderMatchesTab(order, status) &&
          getOrderMatchesPaymentFilter(order, paymentFilter),
        );

        setOrders((current) => (mode === 'more' ? mergeOrdersById(current, nextOrders) : nextOrders));
        if (mode !== 'more' && page === 1) {
          const queryKey = getOrdersQueryKey(status);
          loadedOrdersQueryKeyRef.current = queryKey;
          writeScreenData<OrderListResponse>(getOrdersCacheKey(queryKey), {
            ...response,
            items: nextOrders,
          });
        }
        setStatusSummary(response.statusSummary ?? null);
        setPagination(response.pagination ?? null);
      } catch (error) {
        if (ordersRequestSequenceRef.current !== requestSequence) return;
        if (mode === 'silent') {
          return;
        }

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
        } else if (mode === 'refresh') {
          Alert.alert('Chưa cập nhật được đơn hàng', getErrorMessage(error));
        } else if (mode === 'loading') {
          setErrorMessage(getErrorMessage(error));
        }
      } finally {
        if (ordersRequestSequenceRef.current !== requestSequence) return;
        setIsLoading(false);
        setIsRefreshing(false);
        setIsLoadingMore(false);
      }
    },
    [debouncedSearchText, getOrdersQueryKey, logout, navigation, paymentFilter, runWithAuth, session?.accessToken],
  );

  useStaleFocusEffect(
    () => {
      const mode = resolveFocusRefreshMode(
        loadedOrdersQueryKeyRef.current,
        getOrdersQueryKey(activeStatus),
        'silent',
      );
      void loadOrders(activeStatus, mode);
    },
    [activeStatus, getOrdersQueryKey, loadOrders],
    { cacheScope: 'orders:', runOnDepsChange: true, staleMs: 30 * 1000 },
  );

  const orderRealtime = useOrderRealtime(session?.accessToken, () => {
    void loadOrders(activeStatus, 'silent');
  });

  React.useEffect(() => {
    if (!isFocused || !session?.accessToken) return;
    const handle = setInterval(() => {
      void loadOrders(activeStatus, 'silent');
    }, orderRealtime.connected ? 30_000 : 12_000);

    return () => clearInterval(handle);
  }, [activeStatus, isFocused, loadOrders, orderRealtime.connected, session?.accessToken]);

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
  const hasVisiblePaymentAction = orders.some(orderNeedsPaymentAction);
  const hasShippingAction = (statusSummary?.delivered ?? 0) > 0;

  const shouldShowPaymentFilterDot = (filter: PaymentFilter) =>
    filter === 'needs-payment' && (hasVisiblePaymentAction || paymentFilter === 'needs-payment');

  const shouldShowTabDot = (tab: OrderTabKey) =>
    tab === 'shipping' && hasShippingAction;

  const clearFilters = () => {
    setSearchText('');
    setDebouncedSearchText('');
    setPaymentFilter('all');
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
          <MaterialCommunityIcons name="arrow-left" size={27} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.headerTitleGroup}>
          <Text style={styles.headerTitle}>Đơn hàng của tôi</Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={[styles.headerAction, isFilterOpen && styles.headerActionActive]}
            onPress={() => setIsFilterOpen((current) => !current)}
            activeOpacity={0.8}
            accessibilityLabel="Tìm kiếm và lọc đơn hàng"
          >
            <MaterialCommunityIcons name={isFilterOpen ? 'close' : 'magnify'} size={27} color={colors.brand} />
            {hasActiveFilters && !isFilterOpen ? <View style={styles.headerActionDot} /> : null}
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.headerAction}
            onPress={() => navigation.navigate('SupportHome')}
            activeOpacity={0.8}
            accessibilityLabel="Trung tâm hỗ trợ"
          >
            <MaterialCommunityIcons name="message-processing-outline" size={26} color={colors.brand} />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.content}>
        {isFilterOpen ? (
          <OrderFilterPanel
            hasActiveFilters={hasActiveFilters}
            paymentFilter={paymentFilter}
            paymentFilters={displayedPaymentFilters}
            searchText={searchText}
            onClearFilters={clearFilters}
            onPaymentFilterChange={setPaymentFilter}
            onSearchTextChange={setSearchText}
            shouldShowPaymentFilterDot={shouldShowPaymentFilterDot}
          />
        ) : null}

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
                    {count !== undefined && count > 0 ? (
                      <View style={[styles.tabCountBadge, isActive && styles.tabCountBadgeActive]}>
                        <Text style={[styles.tabCount, isActive && styles.tabCountActive]}>{count}</Text>
                      </View>
                    ) : null}
                  </View>
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
            <>
              {orders.map((order) => (
                <OrderCard
                  key={order._id}
                  isConfirming={isConfirmingId === order._id}
                  order={order}
                  onConfirmReceived={handleConfirmReceived}
                  onOpen={(nextOrder) => navigation.navigate('OrderDetail', { orderId: nextOrder._id })}
                />
              ))}
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

        </ScrollView>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  header: {
    ...brandedHeaderStyles.container,
    minHeight: 68,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerAction: {
    ...brandedHeaderStyles.action,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'transparent',
  },
  headerActionActive: {
    backgroundColor: colors.brandSoft,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  headerActionDot: {
    position: 'absolute',
    top: 7,
    right: 6,
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.danger,
    borderWidth: 1,
    borderColor: colors.surface,
  },
  headerTitleGroup: {
    ...brandedHeaderStyles.titleGroup,
    alignItems: 'flex-start',
    paddingHorizontal: spacing.sm,
  },
  headerTitle: {
    ...brandedHeaderStyles.title,
    color: colors.text,
    fontSize: 21,
    lineHeight: 28,
    marginTop: 0,
    textAlign: 'left',
  },
  content: {
    flex: 1,
    backgroundColor: colors.background,
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
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  tabsContent: {
    paddingHorizontal: spacing.xs,
  },
  tabButton: {
    minHeight: 52,
    minWidth: 88,
    borderBottomWidth: 3,
    borderBottomColor: 'transparent',
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingTop: 15,
    paddingBottom: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabButtonActive: {
    borderBottomColor: colors.brand,
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
    color: colors.textBody,
    fontSize: 14,
    fontWeight: '600',
  },
  tabLabelActive: {
    color: colors.brand,
    fontWeight: '800',
  },
  tabCountBadge: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EEF1F4',
  },
  tabCountBadgeActive: {
    backgroundColor: colors.brandSoft,
  },
  tabCount: {
    color: colors.textMuted,
    fontSize: 10,
    lineHeight: 14,
    fontWeight: '700',
  },
  tabCountActive: {
    color: colors.brand,
    fontWeight: '900',
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
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.xxl,
    gap: spacing.sm,
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
