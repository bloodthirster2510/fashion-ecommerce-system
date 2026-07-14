import React from 'react';
import { ActivityIndicator, Alert, Animated, Easing, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import type { RootStackParamList } from '../../navigation/AppNavigator';
import { colors, radii, shadows, spacing } from '../../theme';
import { useAuth } from '../auth/AuthContext';
import { RemoteImage } from '../../components/media/RemoteImage';
import { virtualTryOnApi } from './virtualTryOnApi';
import { useVirtualTryOnRealtime } from './virtualTryOnRealtime';
import type { VirtualTryOnJob } from './virtualTryOn.types';
import { tryOnRoleLabel } from './virtualTryOnSelection';

type NavigationProp = StackNavigationProp<RootStackParamList, 'VirtualTryOnProcessing'>;
type RouteProps = RouteProp<RootStackParamList, 'VirtualTryOnProcessing'>;

const imageSteps = [
  'Chuẩn bị ảnh người',
  'Tách từng món đồ',
  'Tạo 4 gợi ý',
  'Lưu kết quả',
];

const videoSteps = [
  'Chuẩn bị ảnh người',
  'Tạo 4 ảnh gợi ý',
  'Chọn ảnh phối làm khung đầu',
  'Sinh video chuyển động',
  'Lưu kết quả',
];

const studioPalette = {
  ink: '#213448',
  primaryDark: '#213448',
  primary: '#547792',
  primarySoft: '#EDF4F7',
  primaryPale: '#DDE7EC',
  header: '#547792',
  headerSoft: '#DDE7EC',
  surface: '#FFFFFF',
  canvas: '#F6FAFD',
  line: '#DDE7EC',
  success: '#198754',
  successSoft: '#EAF7EF',
} as const;

const VirtualTryOnProcessingScreen = () => {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<RouteProps>();
  const { session, runWithAuth } = useAuth();
  const [job, setJob] = React.useState<VirtualTryOnJob | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const progressGlow = React.useRef(new Animated.Value(0)).current;

  const jobId = route.params.jobId;
  const retainedSeedItems = route.params.seedItems;
  const retainedAlternativeSeedItems = route.params.alternativeSeedItems;
  const isProviderSafetyBlocked = job?.status === 'failed' && job.errorCode === 'PROVIDER_SAFETY_BLOCKED';

  const returnToBuilder = React.useCallback(() => {
    navigation.navigate('VirtualTryOnHome', retainedSeedItems?.length ? {
      entryPoint: 'builder',
      seedItems: retainedSeedItems,
      alternativeSeedItems: retainedAlternativeSeedItems,
    } : undefined);
  }, [navigation, retainedSeedItems, retainedAlternativeSeedItems]);

  const loadJob = React.useCallback(() => {
    let isCurrent = true;
    runWithAuth((token) => virtualTryOnApi.getJob(token, jobId))
      .then((nextJob) => {
        if (!isCurrent) return;
        setJob(nextJob);
        if (nextJob.status === 'succeeded') {
          navigation.replace('VirtualTryOnResult', {
            jobId: nextJob._id,
            seedItems: retainedSeedItems,
            alternativeSeedItems: retainedAlternativeSeedItems,
          });
        }
      })
      .catch((error: unknown) => {
        if (!isCurrent) return;
        const message = error instanceof Error ? error.message : 'Không tải được tiến trình phối đồ.';
        Alert.alert('Phối đồ ảo', message);
      })
      .finally(() => {
        if (isCurrent) setIsLoading(false);
      });

    return () => { isCurrent = false; };
  }, [jobId, navigation, retainedSeedItems, retainedAlternativeSeedItems, runWithAuth]);

  const realtime = useVirtualTryOnRealtime(session?.accessToken, (event) => {
    if (event.jobId !== jobId) return;
    setJob((current) => current
      ? {
          ...current,
          status: event.status,
          progress: event.progress,
          processingStage: event.processingStage ?? current.processingStage,
          generatedImageUrl: event.generatedImageUrl ?? current.generatedImageUrl,
          generatedImageUrls: event.generatedImageUrls ?? current.generatedImageUrls,
          generatedVideoUrl: event.generatedVideoUrl ?? current.generatedVideoUrl,
          videoStatus: event.videoStatus ?? current.videoStatus,
          videoProgress: event.videoProgress ?? current.videoProgress,
          videoErrorCode: event.videoErrorCode ?? current.videoErrorCode,
          videoErrorMessage: event.videoErrorMessage ?? current.videoErrorMessage,
          errorCode: event.errorCode ?? current.errorCode,
          errorMessage: event.errorMessage ?? current.errorMessage,
        }
      : current);
    if (event.status === 'succeeded') {
      navigation.replace('VirtualTryOnResult', {
        jobId,
        seedItems: retainedSeedItems,
        alternativeSeedItems: retainedAlternativeSeedItems,
      });
    }
  });

  React.useEffect(() => loadJob(), [loadJob]);

  React.useEffect(() => {
    realtime.subscribeJob(jobId);
    return () => realtime.unsubscribeJob(jobId);
  }, [jobId, realtime]);

  React.useEffect(() => {
    const timer = setInterval(() => {
      if (!job || ['queued', 'processing'].includes(job.status)) {
        loadJob();
      }
    }, 2500);
    return () => clearInterval(timer);
  }, [job, loadJob]);

  const isJobRunning = !job || ['queued', 'processing'].includes(job.status);

  React.useEffect(() => {
    if (!isJobRunning) {
      progressGlow.stopAnimation();
      progressGlow.setValue(0);
      return undefined;
    }

    const animation = Animated.loop(
      Animated.timing(progressGlow, {
        toValue: 1,
        duration: 1350,
        easing: Easing.inOut(Easing.quad),
        useNativeDriver: true,
      }),
    );
    animation.start();
    return () => animation.stop();
  }, [isJobRunning, progressGlow]);

  const retry = async () => {
    try {
      const nextJob = await runWithAuth((token) => virtualTryOnApi.retryJob(token, jobId));
      setJob(nextJob);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Không thể thử lại.';
      Alert.alert('Phối đồ ảo', message);
    }
  };

  const cancel = async () => {
    try {
      const nextJob = await runWithAuth((token) => virtualTryOnApi.cancelJob(token, jobId));
      setJob(nextJob);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Không thể hủy yêu cầu.';
      Alert.alert('Phối đồ ảo', message);
    }
  };

  const rawProgress = Math.min(100, Math.max(0, Math.round(job?.progress ?? 0)));
  const isTerminalFailure = job?.status === 'failed' || job?.status === 'canceled';
  const isVideoStage = job?.processingStage === 'video_generation' || job?.processingStage === 'video_persisting';
  const steps = job?.outputMode === 'image_and_video' ? videoSteps : imageSteps;
  const progress = isTerminalFailure ? 0 : rawProgress;
  const progressLabel = (() => {
    switch (job?.status) {
      case 'queued':
        return 'Đang chờ xử lý';
      case 'failed':
        return 'Tạo ảnh thất bại';
      case 'canceled':
        return 'Đã hủy';
      case 'processing':
        return isVideoStage
          ? job.processingStage === 'video_persisting' ? 'Đang lưu video' : 'Đang sinh video'
          : progress >= 100 ? 'Đang hoàn tất' : 'Đang tạo ảnh phối đồ';
      default:
        return 'Đang xử lý';
    }
  })();
  const progressGlowStyle = {
    transform: [
      {
        translateX: progressGlow.interpolate({
          inputRange: [0, 1],
          outputRange: [-72, 260],
        }),
      },
      { skewX: '-18deg' },
    ],
  };
  const completedStepCount = (() => {
    switch (job?.processingStage) {
      case 'image_generation': return 1;
      case 'image_persisting': return job.outputMode === 'image_and_video' ? 2 : 3;
      case 'video_generation': return 3;
      case 'video_persisting': return 4;
      case 'completed': return steps.length;
      default: return 0;
    }
  })();

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.headerButton}
          onPress={() => navigation.navigate('VirtualTryOnHome', retainedSeedItems?.length ? {
            entryPoint: 'builder',
            seedItems: retainedSeedItems,
          } : undefined)}
          activeOpacity={0.8}
        >
          <MaterialCommunityIcons name="close" size={24} color={colors.white} />
        </TouchableOpacity>
        <View style={styles.headerCopy}>
          <Text style={styles.headerKicker}>Fit Studio</Text>
          <Text style={styles.headerTitle}>{isVideoStage ? 'Đang sinh video phối đồ' : 'Đang tạo ảnh phối đồ'}</Text>
        </View>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {isLoading && !job ? (
          <View style={styles.loadingCard}>
            <ActivityIndicator color={studioPalette.primary} />
            <Text style={styles.loadingText}>Đang chuẩn bị ảnh phối đồ...</Text>
          </View>
        ) : (
          <>
            <View style={styles.previewCard}>
              <View style={styles.previewTop}>
                <View style={styles.imageWrap}>
                  {(isVideoStage ? job?.videoSourceImageUrl || job?.generatedImageUrl : job?.sourceImageUrl) ? (
                    <RemoteImage
                      uri={(isVideoStage ? job?.videoSourceImageUrl || job?.generatedImageUrl : job?.sourceImageUrl)!}
                      style={styles.image}
                      recyclingKey={`${job?._id}-${isVideoStage ? 'video-source' : 'source'}`}
                    />
                  ) : (
                    <MaterialCommunityIcons name="image-outline" size={44} color={studioPalette.ink} />
                  )}
                </View>
                <View style={styles.previewCopy}>
                  <Text style={styles.kickerText}>
                    {job?.status === 'failed' ? 'Thất bại' : job?.status === 'canceled' ? 'Đã hủy' : isVideoStage ? 'Ảnh đã sẵn sàng' : 'Đang phối đồ'}
                  </Text>
                  <Text style={styles.title}>
                    {job?.status === 'failed'
                      ? 'Chưa tạo được ảnh phối đồ'
                      : job?.status === 'canceled'
                        ? 'Đã hủy tạo ảnh'
                        : isVideoStage ? 'Đang tạo chuyển động từ ảnh phối' : 'Đang tạo 4 ảnh gợi ý'}
                  </Text>
                  <Text style={styles.subtitle}>
                    {isTerminalFailure
                      ? 'Bạn có thể thử lại hoặc đổi ảnh bất cứ lúc nào.'
                      : isVideoStage
                        ? 'Video chỉ dùng ảnh phối đồ đã sinh làm khung hình đầu; ảnh gốc không được gửi sang bước này.'
                        : 'Từng ảnh sản phẩm được gửi riêng để AI phối đúng màu, size và biến thể.'}
                  </Text>
                </View>
              </View>

              <View style={[styles.progressTrack, isTerminalFailure && styles.progressTrackFailed]}>
                {!isTerminalFailure ? (
                  <View style={[styles.progressFill, { width: `${Math.max(8, progress)}%` }]}>
                    {isJobRunning ? <Animated.View style={[styles.progressGlow, progressGlowStyle]} /> : null}
                  </View>
                ) : null}
              </View>
              <View style={styles.progressFooter}>
                <Text style={styles.progressLabel}>{progressLabel}</Text>
                {!isTerminalFailure ? <Text style={styles.progressText}>{progress}%</Text> : null}
              </View>
            </View>

            {job?.selectedItems.length ? (
              <View style={styles.processingItemsCard}>
                <View style={styles.processingItemsHeader}>
                    <Text style={styles.processingItemsTitle}>Đang xử lý từng món</Text>
                  <Text style={styles.processingItemsMeta}>{job.selectedItems.length} món</Text>
                </View>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.processingItemList}
                >
                  {job.selectedItems.map((item, index) => {
                    const itemDone = completedStepCount >= 2 && !isTerminalFailure;
                    return (
                      <View key={`${item.productId}-${item.colorVariantId}-${index}`} style={styles.processingItemCard}>
                        <RemoteImage
                          uri={item.imageSnapshot}
                          style={styles.processingItemImage}
                          recyclingKey={`processing-${item.colorVariantId}`}
                        />
                        <View style={styles.processingItemCopy}>
                          <Text style={styles.processingItemIndex}>{tryOnRoleLabel[item.role]}</Text>
                          <Text style={styles.processingItemName} numberOfLines={2}>{item.nameSnapshot}</Text>
                          <View style={[styles.processingItemStatus, itemDone && styles.processingItemStatusDone]}>
                            <MaterialCommunityIcons
                              name={itemDone ? 'check' : 'timer-sand'}
                              size={12}
                              color={itemDone ? colors.white : studioPalette.primary}
                            />
                            <Text style={[styles.processingItemStatusText, itemDone && styles.processingItemStatusTextDone]}>
                              {itemDone ? 'Đã tách riêng' : 'Đang chờ'}
                            </Text>
                          </View>
                        </View>
                      </View>
                    );
                  })}
                </ScrollView>
              </View>
            ) : null}

            <View style={styles.stepsCard}>
              {steps.map((step, index) => {
                const done = index < completedStepCount && !isTerminalFailure;
                const active = index === completedStepCount && !isTerminalFailure;
                return (
                  <View key={step} style={styles.stepRow}>
                    <View style={[styles.stepDot, done && styles.stepDotDone]}>
                      {done ? <MaterialCommunityIcons name="check" size={14} color={colors.white} /> : null}
                    </View>
                    <View style={styles.stepCopy}>
                      <Text style={[styles.stepText, done && styles.stepTextDone]}>{step}</Text>
                      <Text style={styles.stepMeta}>{done ? 'Đã xong' : active ? 'Đang xử lý' : 'Đang chờ'}</Text>
                    </View>
                  </View>
                );
              })}
            </View>

            {job?.status === 'failed' ? (
              <View style={styles.errorCard}>
                <Text style={styles.errorTitle}>
                  {isProviderSafetyBlocked ? 'AI đã từ chối ảnh này' : 'Có lỗi xảy ra'}
                </Text>
                <Text style={styles.errorText}>
                  {job.errorMessage || (isProviderSafetyBlocked
                    ? 'Bạn đổi ảnh người hoặc ảnh sản phẩm phù hợp hơn rồi tạo lại nhé.'
                    : 'Bạn thử lại sau ít phút nhé.')}
                </Text>
                <TouchableOpacity
                  style={styles.retryButton}
                  onPress={isProviderSafetyBlocked ? returnToBuilder : retry}
                  activeOpacity={0.86}
                >
                  <MaterialCommunityIcons
                    name={isProviderSafetyBlocked ? 'image-refresh-outline' : 'reload'}
                    size={20}
                    color={colors.white}
                  />
                  <Text style={styles.retryText}>{isProviderSafetyBlocked ? 'Đổi ảnh' : 'Thử lại'}</Text>
                </TouchableOpacity>
              </View>
            ) : null}

            {job?.status === 'canceled' ? (
              <View style={styles.errorCard}>
                <Text style={styles.errorTitle}>Đã hủy tạo ảnh</Text>
                <Text style={styles.errorText}>
                  Yêu cầu phối đồ đã được hủy. Bạn có thể thử lại với cùng bộ đồ hoặc đổi ảnh.
                </Text>
                <View style={styles.canceledActions}>
                  <TouchableOpacity
                    style={styles.canceledSecondaryButton}
                    onPress={() => navigation.navigate('VirtualTryOnHome', retainedSeedItems?.length ? {
                      entryPoint: 'builder',
                      seedItems: retainedSeedItems,
                      alternativeSeedItems: retainedAlternativeSeedItems,
                    } : undefined)}
                    activeOpacity={0.86}
                  >
                    <MaterialCommunityIcons name="home-outline" size={20} color={studioPalette.ink} />
                    <Text style={styles.canceledSecondaryText}>Về trang chủ</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.retryButton}
                    onPress={retry}
                    activeOpacity={0.86}
                  >
                    <MaterialCommunityIcons name="reload" size={20} color={colors.white} />
                    <Text style={styles.retryText}>Phối lại</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : null}

            {job && ['queued', 'processing'].includes(job.status) ? (
              <TouchableOpacity style={styles.cancelButton} onPress={cancel} activeOpacity={0.86}>
                <MaterialCommunityIcons name="close" size={18} color={studioPalette.ink} />
                <Text style={styles.cancelText}>{isVideoStage ? 'Hủy video, giữ lại ảnh' : 'Hủy yêu cầu'}</Text>
              </TouchableOpacity>
            ) : null}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: studioPalette.header,
  },
  header: {
    minHeight: 82,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: studioPalette.header,
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCopy: {
    flex: 1,
    minWidth: 0,
    paddingHorizontal: spacing.md,
  },
  headerKicker: {
    color: studioPalette.headerSoft,
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  headerTitle: {
    color: colors.white,
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '900',
  },
  headerSpacer: {
    width: 40,
  },
  content: {
    flex: 1,
    backgroundColor: studioPalette.canvas,
  },
  scrollContent: {
    flexGrow: 1,
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
    justifyContent: 'center',
    gap: spacing.lg,
  },
  loadingCard: {
    minHeight: 150,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    ...shadows.card,
  },
  loadingText: {
    color: colors.text,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '900',
  },
  previewCard: {
    borderRadius: radii.md,
    backgroundColor: studioPalette.surface,
    borderWidth: 1,
    borderColor: studioPalette.line,
    padding: spacing.lg,
    ...shadows.card,
  },
  previewTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  imageWrap: {
    width: 118,
    aspectRatio: 0.72,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: studioPalette.primarySoft,
    borderWidth: 1,
    borderColor: 'rgba(246,199,107,0.42)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  previewCopy: {
    flex: 1,
    minWidth: 0,
  },
  kickerText: {
    color: studioPalette.primary,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  title: {
    color: studioPalette.ink,
    fontSize: 21,
    lineHeight: 27,
    fontWeight: '900',
    marginTop: 4,
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '700',
    marginTop: spacing.sm,
  },
  progressTrack: {
    width: '100%',
    height: 12,
    borderRadius: 6,
    backgroundColor: studioPalette.successSoft,
    overflow: 'hidden',
    marginTop: spacing.xl,
    borderWidth: 1,
    borderColor: 'rgba(25,135,84,0.16)',
  },
  progressTrackFailed: {
    backgroundColor: 'rgba(220,38,38,0.08)',
    borderColor: 'rgba(220,38,38,0.16)',
  },
  progressFill: {
    height: '100%',
    borderRadius: 6,
    backgroundColor: studioPalette.success,
    overflow: 'hidden',
  },
  progressGlow: {
    position: 'absolute',
    top: -3,
    bottom: -3,
    width: 72,
    backgroundColor: 'rgba(255,255,255,0.34)',
  },
  progressFooter: {
    marginTop: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  progressLabel: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '900',
  },
  progressText: {
    color: studioPalette.success,
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '900',
  },
  processingItemsCard: {
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    padding: spacing.lg,
    gap: spacing.md,
    borderWidth: 1,
    borderColor: studioPalette.line,
    ...shadows.card,
  },
  processingItemsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  processingItemsTitle: {
    flex: 1,
    color: studioPalette.ink,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '900',
  },
  processingItemsMeta: {
    color: studioPalette.primary,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '900',
  },
  processingItemList: {
    gap: spacing.sm,
    paddingRight: spacing.sm,
  },
  processingItemCard: {
    width: 218,
    minHeight: 96,
    borderRadius: radii.sm,
    backgroundColor: studioPalette.primarySoft,
    borderWidth: 1,
    borderColor: studioPalette.primaryPale,
    padding: spacing.xs,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  processingItemImage: {
    width: 62,
    height: 78,
    borderRadius: radii.xs,
    backgroundColor: colors.surface,
  },
  processingItemCopy: {
    flex: 1,
    minWidth: 0,
  },
  processingItemIndex: {
    color: studioPalette.primary,
    fontSize: 10,
    lineHeight: 14,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  processingItemName: {
    color: studioPalette.ink,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '900',
    marginTop: 2,
  },
  processingItemStatus: {
    alignSelf: 'flex-start',
    minHeight: 22,
    borderRadius: radii.pill,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.sm,
    marginTop: spacing.xs,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  processingItemStatusDone: {
    backgroundColor: studioPalette.success,
  },
  processingItemStatusText: {
    color: studioPalette.primary,
    fontSize: 10,
    lineHeight: 13,
    fontWeight: '900',
  },
  processingItemStatusTextDone: {
    color: colors.white,
  },
  stepsCard: {
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    padding: spacing.lg,
    gap: spacing.md,
    borderWidth: 1,
    borderColor: studioPalette.line,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  stepDot: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepDotDone: {
    backgroundColor: studioPalette.success,
    borderColor: studioPalette.success,
  },
  stepCopy: {
    flex: 1,
    minWidth: 0,
  },
  stepText: {
    color: colors.textMuted,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '700',
  },
  stepTextDone: {
    color: colors.text,
    fontWeight: '900',
  },
  stepMeta: {
    color: colors.textSubtle,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '800',
    marginTop: 2,
  },
  errorCard: {
    borderRadius: radii.md,
    backgroundColor: colors.dangerSoft,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  errorTitle: {
    color: colors.danger,
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '900',
  },
  errorText: {
    color: colors.danger,
    fontSize: 13,
    lineHeight: 19,
  },
  retryButton: {
    alignSelf: 'flex-start',
    minHeight: 46,
    borderRadius: radii.pill,
    backgroundColor: studioPalette.primary,
    paddingHorizontal: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  retryText: {
    color: colors.white,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '900',
  },
  canceledActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  canceledSecondaryButton: {
    minHeight: 46,
    borderRadius: radii.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: studioPalette.line,
    paddingHorizontal: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  canceledSecondaryText: {
    color: studioPalette.ink,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '900',
  },
  cancelButton: {
    minHeight: 52,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  cancelText: {
    color: studioPalette.ink,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '900',
  },
});

export default VirtualTryOnProcessingScreen;
