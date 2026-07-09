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

type NavigationProp = StackNavigationProp<RootStackParamList, 'VirtualTryOnProcessing'>;
type RouteProps = RouteProp<RootStackParamList, 'VirtualTryOnProcessing'>;

const steps = [
  'Chuẩn bị ảnh người',
  'Ghép outfit',
  'Tạo 4 gợi ý',
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

  const loadJob = React.useCallback(() => {
    let isCurrent = true;
    runWithAuth((token) => virtualTryOnApi.getJob(token, jobId))
      .then((nextJob) => {
        if (!isCurrent) return;
        setJob(nextJob);
        if (nextJob.status === 'succeeded') {
          navigation.replace('VirtualTryOnResult', { jobId: nextJob._id });
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
  }, [jobId, navigation, runWithAuth]);

  const realtime = useVirtualTryOnRealtime(session?.accessToken, (event) => {
    if (event.jobId !== jobId) return;
    setJob((current) => current
      ? {
          ...current,
          status: event.status,
          progress: event.progress,
          generatedImageUrl: event.generatedImageUrl ?? current.generatedImageUrl,
          generatedImageUrls: event.generatedImageUrls ?? current.generatedImageUrls,
          generatedVideoUrl: event.generatedVideoUrl ?? current.generatedVideoUrl,
          errorMessage: event.errorMessage ?? current.errorMessage,
        }
      : current);
    if (event.status === 'succeeded') {
      navigation.replace('VirtualTryOnResult', { jobId });
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

  const progress = Math.min(100, Math.max(0, Math.round(job?.progress ?? 0)));
  const progressLabel = (() => {
    switch (job?.status) {
      case 'queued':
        return 'Đang xếp hàng';
      case 'failed':
        return 'Tạo ảnh lỗi';
      case 'canceled':
        return 'Đã hủy';
      case 'processing':
        return progress >= 100 ? 'Đang hoàn tất' : 'Đang xử lý';
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
  const activeStep = progress >= 100 ? 3 : progress >= 62 ? 2 : progress >= 25 ? 1 : 0;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerButton} onPress={() => navigation.navigate('VirtualTryOnHome')} activeOpacity={0.8}>
          <MaterialCommunityIcons name="close" size={24} color={colors.white} />
        </TouchableOpacity>
        <View style={styles.headerCopy}>
          <Text style={styles.headerKicker}>Fit Studio</Text>
          <Text style={styles.headerTitle}>Đang tạo ảnh thử đồ</Text>
        </View>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {isLoading && !job ? (
          <View style={styles.loadingCard}>
            <ActivityIndicator color={studioPalette.primary} />
            <Text style={styles.loadingText}>Đang chuẩn bị ảnh thử đồ...</Text>
          </View>
        ) : (
          <>
            <View style={styles.previewCard}>
              <View style={styles.previewTop}>
                <View style={styles.imageWrap}>
                  {job?.sourceImageUrl ? (
                    <RemoteImage uri={job.sourceImageUrl} style={styles.image} recyclingKey={job._id} />
                  ) : (
                    <MaterialCommunityIcons name="image-outline" size={44} color={studioPalette.ink} />
                  )}
                </View>
                <View style={styles.previewCopy}>
                  <Text style={styles.kickerText}>Đang thử đồ</Text>
                  <Text style={styles.title}>
                    {job?.status === 'failed' ? 'Chưa tạo được ảnh thử đồ' : 'Đang tạo 4 ảnh gợi ý'}
                  </Text>
                  <Text style={styles.subtitle}>
                    Các món đã chọn sẽ được ghép thành một ảnh outfit trước khi gửi sang Comfy.
                  </Text>
                </View>
              </View>

              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${Math.max(8, progress)}%` }]}>
                  {isJobRunning ? <Animated.View style={[styles.progressGlow, progressGlowStyle]} /> : null}
                </View>
              </View>
              <View style={styles.progressFooter}>
                <Text style={styles.progressLabel}>{progressLabel}</Text>
                <Text style={styles.progressText}>{progress}%</Text>
              </View>
            </View>

            <View style={styles.stepsCard}>
              {steps.map((step, index) => {
                const done = index <= activeStep && job?.status !== 'failed';
                return (
                  <View key={step} style={styles.stepRow}>
                    <View style={[styles.stepDot, done && styles.stepDotDone]}>
                      {done ? <MaterialCommunityIcons name="check" size={14} color={colors.white} /> : null}
                    </View>
                    <View style={styles.stepCopy}>
                      <Text style={[styles.stepText, done && styles.stepTextDone]}>{step}</Text>
                      <Text style={styles.stepMeta}>{done ? 'Đã xong' : index === activeStep + 1 ? 'Sắp tới' : 'Đang chờ'}</Text>
                    </View>
                  </View>
                );
              })}
            </View>

            {job?.status === 'failed' ? (
              <View style={styles.errorCard}>
                <Text style={styles.errorTitle}>Có lỗi xảy ra</Text>
                <Text style={styles.errorText}>{job.errorMessage || 'Bạn thử lại sau ít phút nhé.'}</Text>
                <TouchableOpacity style={styles.retryButton} onPress={retry} activeOpacity={0.86}>
                  <MaterialCommunityIcons name="reload" size={20} color={colors.white} />
                  <Text style={styles.retryText}>Thử lại</Text>
                </TouchableOpacity>
              </View>
            ) : null}

            {job && ['queued', 'processing'].includes(job.status) ? (
              <TouchableOpacity style={styles.cancelButton} onPress={cancel} activeOpacity={0.86}>
                <MaterialCommunityIcons name="close" size={18} color={studioPalette.ink} />
                <Text style={styles.cancelText}>Hủy yêu cầu</Text>
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
