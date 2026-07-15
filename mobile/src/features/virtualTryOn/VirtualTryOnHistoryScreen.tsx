import React from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
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

type NavigationProp = StackNavigationProp<RootStackParamList, 'VirtualTryOnHistory'>;

const statusLabel: Record<VirtualTryOnJob['status'], string> = {
  queued: 'Đang chờ',
  processing: 'Đang xử lý',
  succeeded: 'Đã xong',
  failed: 'Bị lỗi',
  canceled: 'Đã hủy',
};

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
  const [jobs, setJobs] = React.useState<VirtualTryOnJob[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);

  const loadJobs = React.useCallback(() => {
    let isCurrent = true;
    setIsLoading(true);
    runWithAuth((token) => virtualTryOnApi.getJobs(token, { limit: 30 }))
      .then((response) => {
        if (isCurrent) setJobs(response.items);
      })
      .catch((error: unknown) => {
        if (!isCurrent) return;
        const message = error instanceof Error ? error.message : 'Không tải được lịch sử phối đồ.';
        Alert.alert('Phối đồ ảo', message);
      })
      .finally(() => {
        if (isCurrent) setIsLoading(false);
      });

    return () => { isCurrent = false; };
  }, [runWithAuth]);

  useFocusEffect(React.useCallback(() => loadJobs(), [loadJobs]));

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
            .then(() => {
              setJobs((current) => current.filter((item) => item._id !== job._id));
              void refreshNotifications();
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

      <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {isLoading ? (
          <ActivityIndicator color={colors.brand} style={styles.loading} />
        ) : jobs.length ? (
          jobs.map((job) => {
            const imageCount = getJobImageCount(job);

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
                    <Text style={styles.badge}>{statusLabel[job.status]}</Text>
                    <Text style={styles.date}>{formatDate(job.createdAt)}</Text>
                  </View>
                  <Text style={styles.price}>{job.totalFinalPrice ? `${job.selectedItems.length} món - ${job.totalFinalPrice.toLocaleString('vi-VN')}đ` : `${job.selectedItems.length} món`}</Text>
                </View>
              </TouchableOpacity>
            );
          })
        ) : (
          <View style={styles.emptyState}>
            <MaterialCommunityIcons name="hanger" size={36} color={colors.brand} />
            <Text style={styles.emptyTitle}>Chưa có lịch sử</Text>
            <Text style={styles.emptyText}>Các kết quả phối đồ của bạn sẽ xuất hiện tại đây.</Text>
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
    color: colors.white,
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '900',
    backgroundColor: colors.brand,
    borderRadius: radii.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    overflow: 'hidden',
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
});

export default VirtualTryOnHistoryScreen;

