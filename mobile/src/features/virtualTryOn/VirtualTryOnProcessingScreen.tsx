import React from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
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
  'Đã nhận yêu cầu',
  'Chuẩn bị ảnh và sản phẩm',
  'AI đang tạo kết quả',
  'Lưu vào lịch sử',
];

const VirtualTryOnProcessingScreen = () => {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<RouteProps>();
  const { session, runWithAuth } = useAuth();
  const [job, setJob] = React.useState<VirtualTryOnJob | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);

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

  const progress = job?.progress ?? 0;
  const activeStep = progress >= 100 ? 3 : progress >= 62 ? 2 : progress >= 25 ? 1 : 0;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerButton} onPress={() => navigation.navigate('VirtualTryOnHome')} activeOpacity={0.8}>
          <MaterialCommunityIcons name="close" size={24} color={colors.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Đang xử lý</Text>
        <View style={styles.headerSpacer} />
      </View>

      <View style={styles.content}>
        {isLoading && !job ? (
          <ActivityIndicator color={colors.brand} />
        ) : (
          <>
            <View style={styles.previewCard}>
              <View style={styles.imageWrap}>
                {job?.sourceImageUrl ? (
                  <RemoteImage uri={job.sourceImageUrl} style={styles.image} recyclingKey={job._id} />
                ) : (
                  <MaterialCommunityIcons name="image-outline" size={42} color={colors.brand} />
                )}
              </View>
              <Text style={styles.title}>
                {job?.status === 'failed' ? 'Chưa tạo được kết quả' : 'AI đang tạo kết quả cho bạn'}
              </Text>
              <Text style={styles.subtitle}>
                Bạn có thể rời màn này. Kết quả sẽ tự lưu trong lịch sử phối đồ.
              </Text>

              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${Math.max(8, progress)}%` }]} />
              </View>
              <Text style={styles.progressText}>{progress}%</Text>
            </View>

            <View style={styles.stepsCard}>
              {steps.map((step, index) => {
                const done = index <= activeStep && job?.status !== 'failed';
                return (
                  <View key={step} style={styles.stepRow}>
                    <View style={[styles.stepDot, done && styles.stepDotDone]}>
                      {done ? <MaterialCommunityIcons name="check" size={14} color={colors.white} /> : null}
                    </View>
                    <Text style={[styles.stepText, done && styles.stepTextDone]}>{step}</Text>
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
                <Text style={styles.cancelText}>Hủy yêu cầu</Text>
              </TouchableOpacity>
            ) : null}
          </>
        )}
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
    minHeight: 70,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    backgroundColor: colors.brand,
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    color: colors.white,
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '900',
    textAlign: 'center',
  },
  headerSpacer: {
    width: 40,
  },
  content: {
    flex: 1,
    backgroundColor: colors.background,
    padding: spacing.md,
    justifyContent: 'center',
    gap: spacing.lg,
  },
  previewCard: {
    borderRadius: radii.sm,
    backgroundColor: colors.surface,
    padding: spacing.xl,
    alignItems: 'center',
    ...shadows.card,
  },
  imageWrap: {
    width: 150,
    aspectRatio: 0.72,
    borderRadius: radii.sm,
    overflow: 'hidden',
    backgroundColor: colors.brandSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  title: {
    color: colors.text,
    fontSize: 20,
    lineHeight: 27,
    fontWeight: '900',
    textAlign: 'center',
    marginTop: spacing.lg,
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  progressTrack: {
    width: '100%',
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.brandSoft,
    overflow: 'hidden',
    marginTop: spacing.xl,
  },
  progressFill: {
    height: '100%',
    borderRadius: 5,
    backgroundColor: colors.brand,
  },
  progressText: {
    color: colors.brand,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '900',
    marginTop: spacing.sm,
  },
  stepsCard: {
    borderRadius: radii.sm,
    backgroundColor: colors.surface,
    padding: spacing.lg,
    gap: spacing.md,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  stepDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepDotDone: {
    backgroundColor: colors.success,
    borderColor: colors.success,
  },
  stepText: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '700',
  },
  stepTextDone: {
    color: colors.text,
    fontWeight: '900',
  },
  errorCard: {
    borderRadius: radii.sm,
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
    minHeight: 40,
    borderRadius: radii.sm,
    backgroundColor: colors.brand,
    paddingHorizontal: spacing.md,
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
    minHeight: 46,
    borderRadius: radii.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelText: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 19,
    fontWeight: '900',
  },
});

export default VirtualTryOnProcessingScreen;

