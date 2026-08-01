import React from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  SectionList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import StorefrontBottomNav from '../../components/navigation/StorefrontBottomNav';
import { RemoteImage } from '../../components/media/RemoteImage';
import OutfitIcon from '../../components/ui/OutfitIcon';
import type { RootStackParamList } from '../../navigation/AppNavigator';
import { colors, radii, spacing } from '../../theme';
import { useAuth } from '../auth/AuthContext';
import { useCustomerNotifications } from './CustomerNotificationProvider';
import {
  notificationApi,
  type CustomerNotificationCategory,
  type CustomerNotificationItem,
} from './notificationApi';

type NotificationsNavigationProp = StackNavigationProp<RootStackParamList, 'Notifications'>;
type NotificationFilter = 'all' | CustomerNotificationCategory;
type IconName = keyof typeof MaterialCommunityIcons.glyphMap;

const PAGE_LIMIT = 20;

const filters: Array<{ key: NotificationFilter; label: string; icon: IconName }> = [
  { key: 'all', label: 'Tất cả', icon: 'bell-outline' },
  { key: 'order', label: 'Đơn hàng', icon: 'package-variant-closed' },
  { key: 'virtual_try_on', label: 'Phối đồ', icon: 'hanger' },
  { key: 'promotion', label: 'Ưu đãi', icon: 'ticket-percent-outline' },
  { key: 'support', label: 'Hỗ trợ', icon: 'message-reply-text-outline' },
  { key: 'account', label: 'Tài khoản', icon: 'account-circle-outline' },
];

const categoryPresentation: Record<CustomerNotificationCategory, {
  icon: IconName;
  label: string;
  color: string;
  background: string;
}> = {
  order: { icon: 'package-variant-closed', label: 'Đơn hàng', color: colors.brand, background: colors.brandMist },
  promotion: { icon: 'ticket-percent-outline', label: 'Ưu đãi', color: colors.coral, background: '#FFF0EC' },
  support: { icon: 'message-reply-text-outline', label: 'Hỗ trợ', color: colors.success, background: colors.successSoft },
  account: { icon: 'account-circle-outline', label: 'Tài khoản', color: colors.goldDark, background: colors.goldSoft },
  virtual_try_on: { icon: 'hanger', label: 'Phối đồ', color: '#7C3AED', background: '#F2ECFF' },
  system: { icon: 'information-outline', label: 'Hệ thống', color: colors.textMuted, background: colors.background },
};

const isRemoteImage = (value?: string | null) => Boolean(value && /^https?:\/\//i.test(value.trim()));

const toDayKey = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'invalid';
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
};

const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());

const formatSectionTitle = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Trước đó';
  const today = startOfDay(new Date());
  const target = startOfDay(date);
  const dayDifference = Math.round((today.getTime() - target.getTime()) / 86_400_000);
  if (dayDifference === 0) return 'Hôm nay';
  if (dayDifference === 1) return 'Hôm qua';
  return date.toLocaleDateString('vi-VN', {
    weekday: 'long',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
};

const formatTime = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
};

const mergeUnique = (current: CustomerNotificationItem[], incoming: CustomerNotificationItem[]) => {
  const seen = new Set(current.map((item) => item._id));
  return [...current, ...incoming.filter((item) => !seen.has(item._id))];
};

const NotificationsScreen = () => {
  const navigation = useNavigation<NotificationsNavigationProp>();
  const { isAuthenticated, session, runWithAuth } = useAuth();
  const { summary, refresh: refreshSummary } = useCustomerNotifications();
  const [items, setItems] = React.useState<CustomerNotificationItem[]>([]);
  const [filter, setFilter] = React.useState<NotificationFilter>('all');
  const [isLoading, setIsLoading] = React.useState(true);
  const [isRefreshing, setIsRefreshing] = React.useState(false);
  const [isLoadingMore, setIsLoadingMore] = React.useState(false);
  const [isMarkingAll, setIsMarkingAll] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const nextCursorRef = React.useRef<string | null>(null);
  const hasMoreRef = React.useRef(false);
  const isLoadingMoreRef = React.useRef(false);
  const requestSequenceRef = React.useRef(0);

  const loadNotifications = React.useCallback(async (
    mode: 'initial' | 'refresh' | 'more' = 'initial',
  ) => {
    if (!isAuthenticated || !session?.accessToken) {
      requestSequenceRef.current += 1;
      setItems([]);
      setIsLoading(false);
      return;
    }
    if (mode === 'more' && (!hasMoreRef.current || !nextCursorRef.current || isLoadingMoreRef.current)) return;

    if (mode === 'refresh') setIsRefreshing(true);
    else if (mode === 'more') {
      isLoadingMoreRef.current = true;
      setIsLoadingMore(true);
    }
    else setIsLoading(true);
    setError(null);
    const requestSequence = requestSequenceRef.current + 1;
    requestSequenceRef.current = requestSequence;

    try {
      const response = await runWithAuth((token) => notificationApi.getNotifications(token, {
        limit: PAGE_LIMIT,
        cursor: mode === 'more' ? nextCursorRef.current : null,
        category: filter === 'all' ? undefined : filter,
      }));
      if (requestSequenceRef.current !== requestSequence) return;
      setItems((current) => mode === 'more' ? mergeUnique(current, response.items) : response.items);
      nextCursorRef.current = response.pagination.nextCursor;
      hasMoreRef.current = response.pagination.hasMore;
      if (mode !== 'more') void refreshSummary();
    } catch (loadError) {
      if (requestSequenceRef.current !== requestSequence) return;
      setError(loadError instanceof Error ? loadError.message : 'Không thể tải lịch sử thông báo.');
    } finally {
      if (requestSequenceRef.current !== requestSequence) return;
      setIsLoading(false);
      setIsRefreshing(false);
      setIsLoadingMore(false);
      isLoadingMoreRef.current = false;
    }
  }, [filter, isAuthenticated, refreshSummary, runWithAuth, session?.accessToken]);

  useFocusEffect(React.useCallback(() => {
    void loadNotifications('initial');
  }, [loadNotifications]));

  const sections = React.useMemo(() => {
    const grouped = new Map<string, { title: string; data: CustomerNotificationItem[] }>();
    items.forEach((item) => {
      const key = toDayKey(item.createdAt);
      const existing = grouped.get(key);
      if (existing) existing.data.push(item);
      else grouped.set(key, { title: formatSectionTitle(item.createdAt), data: [item] });
    });
    return Array.from(grouped.values());
  }, [items]);
  const unreadCount = summary?.unreadCount ?? items.filter((item) => !item.isRead).length;

  const markRead = React.useCallback(async (notification: CustomerNotificationItem) => {
    if (notification.isRead) return;
    setItems((current) => current.map((item) => (
      item._id === notification._id ? { ...item, isRead: true, readAt: new Date().toISOString() } : item
    )));
    try {
      await runWithAuth((token) => notificationApi.markRead(token, notification._id));
      await refreshSummary();
    } catch {
      setItems((current) => current.map((item) => (
        item._id === notification._id ? { ...item, isRead: false, readAt: null } : item
      )));
    }
  }, [refreshSummary, runWithAuth]);

  const openNotification = (notification: CustomerNotificationItem) => {
    void markRead(notification);
    const action = notification.action;
    const entityId = action?.entityId;
    if (!action) return;
    if (action.type === 'order_detail' && entityId) navigation.navigate('OrderDetail', { orderId: entityId });
    else if (action.type === 'support_ticket_detail' && entityId) navigation.navigate('SupportTicketDetail', { ticketId: entityId });
    else if (action.type === 'product_detail' && entityId) navigation.navigate('ProductDetail', { productId: entityId });
    else if (action.type === 'coupons') navigation.navigate('Coupons');
    else if (action.type === 'membership') navigation.navigate('Membership');
    else if (action.type === 'profile') navigation.navigate('Profile');
    else if (action.type === 'virtual_try_on_result' && entityId) {
      navigation.navigate('VirtualTryOnResult', { jobId: entityId });
    } else if (action.type === 'virtual_try_on_processing' && entityId) {
      navigation.navigate('VirtualTryOnProcessing', { jobId: entityId });
    } else if (action.type === 'virtual_try_on_home') {
      navigation.navigate('VirtualTryOnHome');
    }
  };

  const markAllRead = async () => {
    if (isMarkingAll || !unreadCount) return;
    setIsMarkingAll(true);
    try {
      await runWithAuth((token) => notificationApi.markAllRead(token));
      setItems((current) => current.map((item) => ({
        ...item,
        isRead: true,
        readAt: item.readAt ?? new Date().toISOString(),
      })));
      await refreshSummary();
    } catch (markError) {
      Alert.alert(
        'Chưa đánh dấu được thông báo',
        markError instanceof Error ? markError.message : 'Bạn thử lại sau nhé.',
      );
    } finally {
      setIsMarkingAll(false);
    }
  };

  const renderNotification = ({ item }: { item: CustomerNotificationItem }) => {
    const presentation = categoryPresentation[item.category];
    const imageUri = isRemoteImage(item.imageUrl) ? item.imageUrl!.trim() : '';
    const hasPromotionBanner = item.category === 'promotion' && Boolean(imageUri);

    return (
      <TouchableOpacity
        style={[styles.notificationCard, !item.isRead && styles.notificationCardUnread]}
        onPress={() => openNotification(item)}
        activeOpacity={0.84}
        accessibilityLabel={`${item.isRead ? '' : 'Chưa đọc, '}${item.title}`}
      >
        <View style={styles.notificationMainRow}>
          {imageUri && !hasPromotionBanner ? (
            <RemoteImage uri={imageUri} style={styles.notificationImage} recyclingKey={item._id} />
          ) : (
            <View style={[styles.notificationIcon, { backgroundColor: presentation.background }]}>
              {item.category === 'virtual_try_on' ? (
                <OutfitIcon size={25} color={presentation.color} />
              ) : (
                <MaterialCommunityIcons name={presentation.icon} size={23} color={presentation.color} />
              )}
            </View>
          )}

          <View style={styles.notificationCopy}>
            <Text style={[styles.categoryLabel, { color: presentation.color }]}>{presentation.label}</Text>
            <View style={styles.notificationTitleRow}>
              <Text style={[styles.notificationTitle, !item.isRead && styles.notificationTitleUnread]} numberOfLines={2}>
                {item.title}
              </Text>
              {!item.isRead ? <View style={styles.unreadDot} /> : null}
            </View>
            <Text style={styles.notificationBody} numberOfLines={3}>{item.body}</Text>
            <View style={styles.notificationMetaRow}>
              <Text style={styles.timeLabel}>{formatTime(item.createdAt)}</Text>
              {item.action?.label ? (
                <View style={styles.actionRow}>
                  <Text style={styles.actionLabel}>{item.action.label}</Text>
                  <MaterialCommunityIcons name="chevron-right" size={16} color={colors.brand} />
                </View>
              ) : null}
            </View>
          </View>
        </View>
        {hasPromotionBanner ? (
          <RemoteImage
            uri={imageUri}
            style={styles.promotionBanner}
            recyclingKey={`${item._id}-banner`}
            resizeMode="cover"
          />
        ) : null}
      </TouchableOpacity>
    );
  };

  const renderEmpty = () => {
    if (isLoading) {
      return (
        <View style={styles.centerState}>
          <ActivityIndicator color={colors.brand} />
          <Text style={styles.stateText}>Đang tải lịch sử thông báo</Text>
        </View>
      );
    }
    if (error) {
      return (
        <View style={styles.centerState}>
          <MaterialCommunityIcons name="alert-circle-outline" size={38} color={colors.danger} />
          <Text style={styles.stateTitle}>Chưa tải được thông báo</Text>
          <Text style={styles.stateText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => loadNotifications('initial')} activeOpacity={0.82}>
            <Text style={styles.retryButtonText}>Thử lại</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return (
      <View style={styles.centerState}>
        <View style={styles.emptyIcon}>
          <MaterialCommunityIcons name="bell-check-outline" size={44} color={colors.brand} />
        </View>
        <Text style={styles.stateTitle}>Chưa có thông báo</Text>
        <Text style={styles.stateText}>Các cập nhật về đơn hàng, phối đồ, ưu đãi và hỗ trợ sẽ xuất hiện tại đây.</Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.headerButton}
          onPress={() => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Home'))}
          activeOpacity={0.82}
          accessibilityLabel="Trở về"
        >
          <MaterialCommunityIcons name="arrow-left" size={25} color={colors.brandDark} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Thông báo</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.headerActionButton}
            onPress={() => navigation.navigate('Cart')}
            activeOpacity={0.78}
            accessibilityLabel="Giỏ hàng"
          >
            <MaterialCommunityIcons name="cart-outline" size={25} color={colors.brandDark} />
            {(summary?.cartItems ?? 0) > 0 ? (
              <View style={styles.headerBadge}>
                <Text style={styles.headerBadgeText}>{Math.min(summary?.cartItems ?? 0, 99)}</Text>
              </View>
            ) : null}
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.headerActionButton}
            onPress={() => navigation.navigate('NotificationSettings')}
            activeOpacity={0.78}
            accessibilityLabel="Cài đặt thông báo"
          >
            <MaterialCommunityIcons name="bell-cog-outline" size={25} color={colors.brandDark} />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.content}>
        <View style={styles.updatesHeader}>
          <View>
            <Text style={styles.updatesTitle}>Cập nhật mới nhất</Text>
            <Text style={styles.updatesSubtitle}>{unreadCount} thông báo chưa đọc</Text>
          </View>
          <TouchableOpacity
            style={styles.readAllButton}
            onPress={() => void markAllRead()}
            disabled={isMarkingAll || !unreadCount}
            activeOpacity={0.78}
            accessibilityLabel="Đánh dấu tất cả đã đọc"
          >
            {isMarkingAll ? (
              <ActivityIndicator size="small" color={colors.brand} />
            ) : (
              <Text style={[styles.readAllLabel, !unreadCount && styles.readAllLabelDisabled]}>Đọc tất cả</Text>
            )}
          </TouchableOpacity>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.filterScroller}
          contentContainerStyle={styles.filterRow}
        >
          {filters.map((option) => {
            const active = option.key === filter;
            return (
              <TouchableOpacity
                key={option.key}
                style={styles.filterTab}
                onPress={() => {
                  if (option.key === filter) return;
                  setItems([]);
                  nextCursorRef.current = null;
                  hasMoreRef.current = false;
                  setFilter(option.key);
                }}
                activeOpacity={0.82}
              >
                <View style={styles.filterIconWrap}>
                  {option.key === 'virtual_try_on' ? (
                    <OutfitIcon
                      size={25}
                      color={active ? colors.brand : colors.textMuted}
                      muted={!active}
                    />
                  ) : (
                    <MaterialCommunityIcons
                      name={option.icon}
                      size={25}
                      color={active ? colors.brand : colors.textMuted}
                    />
                  )}
                  {option.key === 'all' && unreadCount > 0 ? (
                    <View style={styles.filterBadge}>
                      <Text style={styles.filterBadgeText}>{Math.min(unreadCount, 99)}</Text>
                    </View>
                  ) : null}
                </View>
                <Text style={[styles.filterLabel, active && styles.filterLabelActive]} numberOfLines={2}>
                  {option.label}
                </Text>
                {active ? <View style={styles.filterIndicator} /> : null}
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        <SectionList
          sections={sections}
          keyExtractor={(item) => item._id}
          renderItem={renderNotification}
          renderSectionHeader={({ section }) => (
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>{section.title}</Text>
            </View>
          )}
          ListEmptyComponent={renderEmpty}
          ListFooterComponent={isLoadingMore ? <ActivityIndicator style={styles.footerLoader} color={colors.brand} /> : null}
          contentContainerStyle={[styles.listContent, !sections.length && styles.emptyListContent]}
          showsVerticalScrollIndicator={false}
          stickySectionHeadersEnabled={false}
          refreshing={isRefreshing}
          onRefresh={() => void loadNotifications('refresh')}
          onEndReached={() => void loadNotifications('more')}
          onEndReachedThreshold={0.35}
        />
      </View>
      <StorefrontBottomNav activeTab="notifications" />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.surface },
  header: {
    height: 62,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  headerButton: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    position: 'absolute',
    left: 100,
    right: 100,
    color: colors.brandDark,
    fontSize: 21,
    lineHeight: 27,
    fontWeight: '900',
    textAlign: 'center',
  },
  headerActions: { flexDirection: 'row', alignItems: 'center' },
  headerActionButton: {
    width: 38,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerBadge: {
    position: 'absolute',
    top: 1,
    right: -1,
    minWidth: 17,
    height: 17,
    paddingHorizontal: 4,
    borderRadius: 9,
    borderWidth: 1.5,
    borderColor: colors.white,
    backgroundColor: colors.coral,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerBadgeText: { color: colors.white, fontSize: 9, lineHeight: 11, fontWeight: '900' },
  content: { flex: 1, backgroundColor: colors.background },
  updatesHeader: {
    minHeight: 64,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
  },
  updatesTitle: { color: colors.text, fontSize: 16, lineHeight: 22, fontWeight: '900' },
  updatesSubtitle: { marginTop: 1, color: colors.textMuted, fontSize: 11, lineHeight: 15, fontWeight: '600' },
  readAllButton: { minHeight: 38, paddingLeft: spacing.md, alignItems: 'center', justifyContent: 'center' },
  readAllLabel: { color: colors.brand, fontSize: 13, lineHeight: 18, fontWeight: '800' },
  readAllLabelDisabled: { color: colors.textSubtle },
  filterScroller: {
    flexGrow: 0,
    height: 92,
    maxHeight: 92,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  filterRow: { minHeight: 92, paddingHorizontal: spacing.sm, alignItems: 'stretch' },
  filterTab: {
    width: 78,
    height: 92,
    paddingHorizontal: 4,
    paddingTop: 10,
    paddingBottom: 8,
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  filterIconWrap: { width: 38, height: 34, alignItems: 'center', justifyContent: 'center' },
  filterBadge: {
    position: 'absolute',
    top: -5,
    right: -7,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: 9,
    backgroundColor: colors.coral,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterBadgeText: { color: colors.white, fontSize: 9, lineHeight: 11, fontWeight: '900' },
  filterLabel: {
    marginTop: 5,
    color: colors.textMuted,
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '700',
    textAlign: 'center',
  },
  filterLabelActive: { color: colors.brand, fontWeight: '900' },
  filterIndicator: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 0,
    height: 3,
    borderTopLeftRadius: 3,
    borderTopRightRadius: 3,
    backgroundColor: colors.brand,
  },
  listContent: { paddingBottom: spacing.xxl },
  emptyListContent: { flexGrow: 1 },
  sectionHeader: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    backgroundColor: colors.background,
  },
  sectionTitle: { color: colors.textMuted, fontSize: 12, lineHeight: 17, fontWeight: '800', textTransform: 'capitalize' },
  notificationCard: {
    paddingHorizontal: spacing.lg,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  notificationCardUnread: { backgroundColor: '#F4F8FA' },
  notificationMainRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  notificationIcon: {
    width: 48,
    height: 48,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notificationImage: { width: 48, height: 48, borderRadius: radii.md, backgroundColor: colors.brandMist },
  notificationCopy: { flex: 1, minWidth: 0 },
  categoryLabel: { fontSize: 10, lineHeight: 14, fontWeight: '900', textTransform: 'uppercase' },
  notificationTitleRow: { marginTop: 2, flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  notificationTitle: { flex: 1, color: colors.text, fontSize: 14, lineHeight: 20, fontWeight: '700' },
  notificationTitleUnread: { fontWeight: '900' },
  notificationBody: { marginTop: 3, color: colors.textMuted, fontSize: 12, lineHeight: 18 },
  notificationMetaRow: { marginTop: 7, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  timeLabel: { color: colors.textSubtle, fontSize: 10, lineHeight: 14, fontWeight: '600' },
  actionRow: { flexDirection: 'row', alignItems: 'center' },
  actionLabel: { color: colors.brand, fontSize: 11, lineHeight: 15, fontWeight: '800' },
  unreadDot: { width: 8, height: 8, marginTop: 6, borderRadius: 4, backgroundColor: colors.coral },
  promotionBanner: {
    height: 142,
    marginTop: spacing.md,
    marginLeft: 60,
    borderRadius: radii.sm,
    backgroundColor: colors.brandMist,
  },
  centerState: { flex: 1, minHeight: 320, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xxl, paddingBottom: spacing.xxl },
  emptyIcon: { width: 76, height: 76, borderRadius: 38, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.brandSoft },
  stateTitle: { marginTop: spacing.md, color: colors.brandDark, fontSize: 18, lineHeight: 24, fontWeight: '900', textAlign: 'center' },
  stateText: { maxWidth: 310, marginTop: spacing.sm, color: colors.textMuted, fontSize: 13, lineHeight: 20, textAlign: 'center' },
  retryButton: { marginTop: spacing.lg, paddingHorizontal: spacing.lg, paddingVertical: 10, borderRadius: radii.pill, backgroundColor: colors.brand },
  retryButtonText: { color: colors.white, fontSize: 13, lineHeight: 18, fontWeight: '900' },
  footerLoader: { paddingVertical: spacing.lg },
});

export default NotificationsScreen;
