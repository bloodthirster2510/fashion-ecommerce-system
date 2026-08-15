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
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import type { RootStackParamList } from '../../navigation/AppNavigator';
import { RemoteImage } from '../../components/media/RemoteImage';
import { colors, radii, shadows, spacing } from '../../theme';
import { useAuth } from '../auth/AuthContext';
import { useCustomerNotifications } from '../notifications/CustomerNotificationProvider';
import { virtualTryOnApi } from './virtualTryOnApi';
import type { VirtualTryOnJob } from './virtualTryOn.types';
import { getGeneratedTryOnImageUrls } from './virtualTryOnResultMedia';
import { hasNextPage, mergePageItems, type PageInfo } from '../../utils/pagination';

type NavigationProp = StackNavigationProp<RootStackParamList, 'VirtualTryOnHistory'>;
type LoadMode = 'initial' | 'refresh' | 'more';
type HistoryFilter = 'all' | VirtualTryOnJob['status'];
const PAGE_SIZE = 20;

const statusPresentation: Record<VirtualTryOnJob['status'], {
  label: string;
  color: string;
  backgroundColor: string;
}> = {
  queued: {
    label: 'Đang chờ',
    color: colors.goldText,
    backgroundColor: colors.goldSoft,
  },
  processing: {
    label: 'Đang xử lý',
    color: '#6D4DC3',
    backgroundColor: '#F2ECFF',
  },
  succeeded: {
    label: 'Hoàn thành',
    color: colors.success,
    backgroundColor: colors.successSoft,
  },
  failed: {
    label: 'Bị lỗi',
    color: colors.danger,
    backgroundColor: colors.dangerSoft,
  },
  canceled: {
    label: 'Đã hủy',
    color: colors.textMuted,
    backgroundColor: '#EEF1F4',
  },
};

const historyFilters: Array<{
  key: HistoryFilter;
  label: string;
  color: string;
}> = [
  { key: 'all', label: 'Tất cả', color: colors.brand },
  { key: 'succeeded', label: statusPresentation.succeeded.label, color: statusPresentation.succeeded.color },
  { key: 'processing', label: statusPresentation.processing.label, color: statusPresentation.processing.color },
  { key: 'queued', label: statusPresentation.queued.label, color: statusPresentation.queued.color },
  { key: 'failed', label: statusPresentation.failed.label, color: statusPresentation.failed.color },
  { key: 'canceled', label: statusPresentation.canceled.label, color: statusPresentation.canceled.color },
];

const formatDate = (value: string) => {
  try {
    return new Intl.DateTimeFormat('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(value));
  } catch {
    return '';
  }
};

const getJobPreviewUrl = (job: VirtualTryOnJob) =>
  getGeneratedTryOnImageUrls(job)[0] || job.sourceImageUrl;

const getJobImageCount = (job: VirtualTryOnJob) =>
  getGeneratedTryOnImageUrls(job).length;

const VirtualTryOnHistoryScreen = () => {
  const navigation = useNavigation<NavigationProp>();
  const { runWithAuth } = useAuth();
  const { refresh: refreshNotifications } = useCustomerNotifications();
  const [filter, setFilter] = React.useState<HistoryFilter>('all');
  const [jobs, setJobs] = React.useState<VirtualTryOnJob[]>([]);
  const [pagination, setPagination] = React.useState<PageInfo | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isRefreshing, setIsRefreshing] = React.useState(false);
  const [isLoadingMore, setIsLoadingMore] = React.useState(false);
  const [error, setError] = React.useState('');
  const requestSequenceRef = React.useRef(0);

  const loadJobs = React.useCallback(async (mode: LoadMode = 'initial', page = 1) => {
    if (mode === 'refresh') setIsRefreshing(true);
    else if (mode === 'more') setIsLoadingMore(true);
    else setIsLoading(true);
    if (mode !== 'more') setError('');

    const requestSequence = requestSequenceRef.current + 1;
    requestSequenceRef.current = requestSequence;
    try {
      const response = await runWithAuth((token) => virtualTryOnApi.getJobs(token, {
        page,
        limit: PAGE_SIZE,
        status: filter === 'all' ? undefined : filter,
      }));
      if (requestSequenceRef.current !== requestSequence) return;
      setJobs((current) => mode === 'more' ? mergePageItems(current, response.items) : response.items);
      setPagination(response.pagination);
    } catch (caught) {
      if (requestSequenceRef.current !== requestSequence) return;
      const message = caught instanceof Error ? caught.message : 'Không tải được lịch sử phối đồ.';
      if (mode === 'more') Alert.alert('Không thể tải thêm kết quả', message);
      else setError(message);
    } finally {
      if (requestSequenceRef.current !== requestSequence) return;
      setIsLoading(false);
      setIsRefreshing(false);
      setIsLoadingMore(false);
    }
  }, [filter, runWithAuth]);

  useFocusEffect(React.useCallback(() => {
    void loadJobs();
    return () => {
      requestSequenceRef.current += 1;
    };
  }, [loadJobs]));

  const openJob = (job: VirtualTryOnJob) => {
    if (job.status === 'succeeded' && getGeneratedTryOnImageUrls(job).length > 0) {
      navigation.navigate('VirtualTryOnResult', { jobId: job._id });
      return;
    }
    navigation.navigate('VirtualTryOnProcessing', { jobId: job._id });
  };

  const deleteJob = (job: VirtualTryOnJob) => {
    Alert.alert('Xóa khỏi lịch sử?', 'Kết quả này sẽ không còn hiển thị trong lịch sử của bạn.', [
      { text: 'Hủy', style: 'cancel' },
      {
        text: 'Xóa',
        style: 'destructive',
        onPress: () => {
          runWithAuth((token) => virtualTryOnApi.deleteJob(token, job._id))
            .then(async () => {
              await Promise.all([loadJobs('refresh'), refreshNotifications()]);
            })
            .catch((error: unknown) => {
              const message = error instanceof Error ? error.message : 'Không thể xóa kết quả.';
              Alert.alert('Phối đồ ảo', message);
            });
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerButton} onPress={() => navigation.goBack()} activeOpacity={0.8}>
          <MaterialCommunityIcons name="arrow-left" size={25} color={colors.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Lịch sử phối đồ</Text>
        <View style={styles.headerSpacer} />
      </View>

      <View style={styles.tabsPanel}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabsContent}
        >
          {historyFilters.map((option) => {
            const isActive = option.key === filter;

            return (
              <TouchableOpacity
                key={option.key}
                style={styles.tabButton}
                onPress={() => {
                  if (!isActive) setFilter(option.key);
                }}
                activeOpacity={0.84}
                accessibilityRole="tab"
                accessibilityState={{ selected: isActive }}
              >
                <Text style={[styles.tabLabel, isActive && { color: option.color, fontWeight: '900' }]}>
                  {option.label}
                </Text>
                {isActive ? <View style={[styles.tabIndicator, { backgroundColor: option.color }]} /> : null}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={(
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={() => void loadJobs('refresh')}
            tintColor={colors.brand}
          />
        )}
      >
        {isLoading ? (
          <ActivityIndicator color={colors.brand} style={styles.loading} />
        ) : error ? (
          <View style={styles.emptyState}>
            <MaterialCommunityIcons name="alert-circle-outline" size={36} color={colors.danger} />
            <Text style={styles.emptyTitle}>Chưa tải được lịch sử</Text>
            <Text style={styles.emptyText}>{error}</Text>
            <TouchableOpacity style={styles.loadMoreButton} onPress={() => void loadJobs()}>
              <Text style={styles.loadMoreText}>Thử lại</Text>
            </TouchableOpacity>
          </View>
        ) : jobs.length ? (
          <>
            {jobs.map((job) => {
              const imageCount = getJobImageCount(job);
              const presentation = statusPresentation[job.status];

              return (
                <TouchableOpacity key={job._id} style={styles.jobCard} onPress={() => openJob(job)} activeOpacity={0.86}>
                  <View style={styles.imageWrap}>
                    <RemoteImage
                      uri={getJobPreviewUrl(job)}
                      style={styles.image}
                      recyclingKey={`${job._id}-${job.status}`}
                    />
                    {imageCount > 1 ? (
                      <View style={styles.imageCountBadge}>
                        <Text style={styles.imageCountText}>{imageCount} ảnh</Text>
                      </View>
                    ) : null}
                  </View>
                  <View style={styles.copy}>
                    <View style={styles.titleRow}>
                      <Text style={styles.title} numberOfLines={2}>
                        {job.selectedItems.map((item) => item.nameSnapshot).join(' + ')}
                      </Text>
                      <TouchableOpacity style={styles.deleteButton} onPress={() => deleteJob(job)}>
                        <MaterialCommunityIcons name="trash-can-outline" size={20} color={colors.textMuted} />
                      </TouchableOpacity>
                    </View>
                    <View style={styles.metaRow}>
                      <View style={[styles.badge, { backgroundColor: presentation.backgroundColor }]}>
                        <Text style={[styles.badgeText, { color: presentation.color }]}>{presentation.label}</Text>
                      </View>
                      <Text style={styles.date}>{formatDate(job.createdAt)}</Text>
                    </View>
                    <Text style={styles.price}>{job.totalFinalPrice ? `${job.selectedItems.length} món - ${job.totalFinalPrice.toLocaleString('vi-VN')}đ` : `${job.selectedItems.length} món`}</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
            {hasNextPage(pagination) ? (
              <TouchableOpacity
                style={styles.loadMoreButton}
                disabled={isLoadingMore}
                onPress={() => void loadJobs('more', (pagination?.page ?? 0) + 1)}
              >
                {isLoadingMore ? <ActivityIndicator color={colors.white} /> : <Text style={styles.loadMoreText}>Tải thêm kết quả</Text>}
              </TouchableOpacity>
            ) : null}
          </>
        ) : (
          <View style={styles.emptyState}>
            <MaterialCommunityIcons
              name="hanger"
              size={36}
              color={filter === 'all' ? colors.brand : statusPresentation[filter].color}
            />
            <Text style={styles.emptyTitle}>
              {filter === 'all' ? 'Chưa có lịch sử' : `Chưa có kết quả ${statusPresentation[filter].label.toLowerCase()}`}
            </Text>
            <Text style={styles.emptyText}>
              {filter === 'all'
                ? 'Các kết quả phối đồ của bạn sẽ xuất hiện tại đây.'
                : 'Bạn có thể chọn trạng thái khác để xem các lượt phối đồ.'}
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.brand,
  },
  header: {
    minHeight: 60,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    backgroundColor: colors.brand,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.14)',
  },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    color: colors.white,
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '800',
    textAlign: 'center',
  },
  headerSpacer: {
    width: 40,
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
    minHeight: 54,
    minWidth: 96,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabLabel: {
    color: colors.textBody,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
  },
  tabIndicator: {
    position: 'absolute',
    left: spacing.md,
    right: spacing.md,
    bottom: 0,
    height: 3,
    borderTopLeftRadius: 3,
    borderTopRightRadius: 3,
  },
  content: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    padding: spacing.md,
    gap: spacing.md,
  },
  loading: {
    paddingVertical: spacing.xxl,
  },
  jobCard: {
    borderRadius: radii.sm,
    backgroundColor: colors.surface,
    padding: spacing.md,
    flexDirection: 'row',
    gap: spacing.md,
    ...shadows.card,
  },
  imageWrap: {
    width: 84,
    height: 112,
    borderRadius: radii.sm,
    overflow: 'hidden',
    backgroundColor: colors.brandSoft,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  imageCountBadge: {
    position: 'absolute',
    right: 6,
    top: 6,
    borderRadius: radii.xs,
    backgroundColor: 'rgba(255,255,255,0.9)',
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  imageCountText: {
    color: colors.text,
    fontSize: 10,
    lineHeight: 13,
    fontWeight: '900',
  },
  copy: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  title: {
    flex: 1,
    color: colors.text,
    fontSize: 15,
    lineHeight: 21,
    fontWeight: '900',
  },
  deleteButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  badge: {
    minHeight: 23,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radii.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  badgeText: {
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '900',
  },
  date: {
    color: colors.textMuted,
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '700',
  },
  price: {
    color: colors.brand,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '900',
    marginTop: spacing.sm,
  },
  emptyState: {
    minHeight: 260,
    borderRadius: radii.sm,
    backgroundColor: colors.surface,
    padding: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  emptyTitle: {
    color: colors.text,
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '900',
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
  },
  loadMoreButton: {
    minHeight: 46,
    borderRadius: radii.sm,
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  loadMoreText: {
    color: colors.white,
    fontWeight: '900',
  },
});

export default VirtualTryOnHistoryScreen;

