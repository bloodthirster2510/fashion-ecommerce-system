import React from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import type { RootStackParamList } from '../../navigation/AppNavigator';
import { RemoteImage } from '../../components/media/RemoteImage';
import { colors, radii, shadows, spacing } from '../../theme';
import { useAuth } from '../auth/AuthContext';
import { virtualTryOnApi } from './virtualTryOnApi';
import type { VirtualTryOnAsset, VirtualTryOnJob } from './virtualTryOn.types';

type NavigationProp = StackNavigationProp<RootStackParamList, 'VirtualTryOnHome'>;

const formatDate = (value: string) => {
  try {
    return new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
      .format(new Date(value));
  } catch {
    return '';
  }
};

const statusLabel: Record<VirtualTryOnJob['status'], string> = {
  queued: 'Đang chờ',
  processing: 'Đang xử lý',
  succeeded: 'Đã xong',
  failed: 'Bị lỗi',
  canceled: 'Đã hủy',
};

const contextLabel: Record<string, string> = {
  none: 'Không đổi nền',
  work: 'Đi làm',
  casual: 'Đi chơi',
  party: 'Dự tiệc',
  travel: 'Du lịch',
  sport: 'Thể thao',
  date: 'Hẹn hò',
  custom: 'Tự mô tả',
};

const VirtualTryOnHomeScreen = () => {
  const navigation = useNavigation<NavigationProp>();
  const { isAuthenticated, runWithAuth } = useAuth();
  const [latestAsset, setLatestAsset] = React.useState<VirtualTryOnAsset | null>(null);
  const [latestJob, setLatestJob] = React.useState<VirtualTryOnJob | null>(null);
  const [jobs, setJobs] = React.useState<VirtualTryOnJob[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [isUploading, setIsUploading] = React.useState(false);

  const requireLogin = React.useCallback(() => {
    if (isAuthenticated) return true;
    navigation.navigate('Login');
    return false;
  }, [isAuthenticated, navigation]);

  const loadDashboard = React.useCallback(() => {
    if (!isAuthenticated) {
      setLatestAsset(null);
      setLatestJob(null);
      setJobs([]);
      return;
    }

    let isCurrent = true;
    setIsLoading(true);
    runWithAuth(async (token) => {
      const [assetsResponse, latest, jobsResponse] = await Promise.all([
        virtualTryOnApi.getAssets(token, { limit: 1 }),
        virtualTryOnApi.getLatestJob(token),
        virtualTryOnApi.getJobs(token, { limit: 4 }),
      ]);
      if (!isCurrent) return;
      setLatestAsset(assetsResponse.items[0] ?? null);
      setLatestJob(latest);
      setJobs(jobsResponse.items);
    })
      .catch((error: unknown) => {
        if (!isCurrent) return;
        const message = error instanceof Error ? error.message : 'Không tải được phòng phối đồ';
        Alert.alert('Phối đồ ảo', message);
      })
      .finally(() => {
        if (isCurrent) setIsLoading(false);
      });

    return () => { isCurrent = false; };
  }, [isAuthenticated, runWithAuth]);

  useFocusEffect(React.useCallback(() => loadDashboard(), [loadDashboard]));

  const uploadPickedAsset = async (uri: string, source: 'upload' | 'camera') => {
    setIsUploading(true);
    try {
      const asset = await runWithAuth((token) => virtualTryOnApi.uploadAsset(token, uri, source));
      setLatestAsset(asset);
      navigation.navigate('VirtualTryOnBuilder', {
        assetId: asset._id,
        imageUrl: asset.url,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Không thể tải ảnh lên';
      Alert.alert('Ảnh của bạn', message);
    } finally {
      setIsUploading(false);
    }
  };

  const pickImage = async () => {
    if (!requireLogin()) return;
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Cần quyền truy cập ảnh', 'Vui lòng cho phép ứng dụng truy cập thư viện ảnh.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: false,
      quality: 0.9,
    });
    if (!result.canceled && result.assets[0]?.uri) {
      await uploadPickedAsset(result.assets[0].uri, 'upload');
    }
  };

  const takePhoto = async () => {
    if (!requireLogin()) return;
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Cần quyền camera', 'Vui lòng cho phép ứng dụng mở camera để chụp ảnh.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      quality: 0.9,
    });
    if (!result.canceled && result.assets[0]?.uri) {
      await uploadPickedAsset(result.assets[0].uri, 'camera');
    }
  };

  const openJob = (job: VirtualTryOnJob) => {
    if (job.status === 'succeeded') {
      navigation.navigate('VirtualTryOnResult', { jobId: job._id });
      return;
    }
    navigation.navigate('VirtualTryOnProcessing', { jobId: job._id });
  };

  const continueWithLatestAsset = () => {
    if (!requireLogin()) return;
    if (!latestAsset) {
      Alert.alert('Ảnh của bạn', 'Bạn hãy tải ảnh hoặc chụp ảnh trước khi phối đồ.');
      return;
    }
    navigation.navigate('VirtualTryOnBuilder', {
      assetId: latestAsset._id,
      imageUrl: latestAsset.url,
    });
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerButton} onPress={() => navigation.goBack()} activeOpacity={0.8}>
          <MaterialCommunityIcons name="arrow-left" size={25} color={colors.white} />
        </TouchableOpacity>
        <View style={styles.headerCopy}>
          <Text style={styles.headerTitle}>Phối đồ ảo</Text>
          <Text style={styles.headerSubtitle}>Thử outfit bằng ảnh của bạn</Text>
        </View>
        <TouchableOpacity
          style={styles.headerButton}
          onPress={() => navigation.navigate('VirtualTryOnHistory')}
          activeOpacity={0.8}
        >
          <MaterialCommunityIcons name="history" size={24} color={colors.white} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <View style={styles.heroImageWrap}>
            {latestAsset ? (
              <RemoteImage uri={latestAsset.url} style={styles.heroImage} recyclingKey={latestAsset._id} />
            ) : (
              <View style={styles.emptyHeroImage}>
                <MaterialCommunityIcons name="account-outline" size={54} color={colors.brand} />
              </View>
            )}
          </View>
          <View style={styles.heroCopy}>
            <Text style={styles.heroTitle}>Tạo outfit từ ảnh thật</Text>
            <Text style={styles.heroText}>
              Chọn ảnh toàn thân rõ sáng, thêm sản phẩm yêu thích rồi để AI dựng kết quả thử đồ.
            </Text>
          </View>
        </View>

        <View style={styles.actionGrid}>
          <TouchableOpacity style={styles.primaryAction} onPress={pickImage} disabled={isUploading} activeOpacity={0.86}>
            <MaterialCommunityIcons name="upload-outline" size={23} color={colors.white} />
            <Text style={styles.primaryActionText}>Tải ảnh</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryAction} onPress={takePhoto} disabled={isUploading} activeOpacity={0.86}>
            <MaterialCommunityIcons name="camera-outline" size={23} color={colors.brandDark} />
            <Text style={styles.secondaryActionText}>Chụp ảnh</Text>
          </TouchableOpacity>
        </View>

        {isUploading ? (
          <View style={styles.inlineLoading}>
            <ActivityIndicator color={colors.brand} />
            <Text style={styles.inlineLoadingText}>Đang tải ảnh lên...</Text>
          </View>
        ) : null}

        {latestAsset ? (
          <TouchableOpacity style={styles.continueCard} onPress={continueWithLatestAsset} activeOpacity={0.86}>
            <MaterialCommunityIcons name="creation-outline" size={24} color={colors.brand} />
            <View style={styles.continueCopy}>
              <Text style={styles.continueTitle}>Tiếp tục với ảnh gần nhất</Text>
              <Text style={styles.continueText}>Chọn sản phẩm và bối cảnh để tạo kết quả mới.</Text>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={24} color={colors.textMuted} />
          </TouchableOpacity>
        ) : null}

        {latestJob && ['queued', 'processing'].includes(latestJob.status) ? (
          <TouchableOpacity style={styles.processingCard} onPress={() => openJob(latestJob)} activeOpacity={0.86}>
            <View style={styles.progressCircle}>
              <Text style={styles.progressText}>{latestJob.progress}%</Text>
            </View>
            <View style={styles.continueCopy}>
              <Text style={styles.continueTitle}>Kết quả đang được tạo</Text>
              <Text style={styles.continueText}>Bạn có thể quay lại xem tiến trình bất cứ lúc nào.</Text>
            </View>
          </TouchableOpacity>
        ) : null}

        <View style={styles.guideCard}>
          <Text style={styles.sectionTitle}>Ảnh nên như thế nào?</Text>
          {['Đứng thẳng, chụp toàn thân', 'Nền sáng và ít vật thể che người', 'Ánh sáng tự nhiên, ảnh không quá mờ'].map((item) => (
            <View key={item} style={styles.guideRow}>
              <MaterialCommunityIcons name="check" size={20} color={colors.success} />
              <Text style={styles.guideText}>{item}</Text>
            </View>
          ))}
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Lịch sử gần đây</Text>
          <TouchableOpacity onPress={() => navigation.navigate('VirtualTryOnHistory')} activeOpacity={0.8}>
            <Text style={styles.linkText}>Xem tất cả</Text>
          </TouchableOpacity>
        </View>

        {isLoading ? (
          <ActivityIndicator color={colors.brand} style={styles.listLoading} />
        ) : jobs.length ? (
          <View style={styles.jobGrid}>
            {jobs.map((job) => (
              <TouchableOpacity key={job._id} style={styles.jobCard} onPress={() => openJob(job)} activeOpacity={0.86}>
                <View style={styles.jobImageWrap}>
                  <RemoteImage
                    uri={job.generatedImageUrl || job.sourceImageUrl}
                    style={styles.jobImage}
                    recyclingKey={`${job._id}-${job.status}`}
                  />
                  <View style={styles.jobBadge}>
                    <Text style={styles.jobBadgeText}>{statusLabel[job.status]}</Text>
                  </View>
                </View>
                <Text style={styles.jobTitle} numberOfLines={2}>
                  {contextLabel[job.contextPreset] ?? 'Phối đồ'}
                </Text>
                <Text style={styles.jobMeta}>{formatDate(job.createdAt)}</Text>
              </TouchableOpacity>
            ))}
          </View>
        ) : (
          <View style={styles.emptyState}>
            <MaterialCommunityIcons name="hanger" size={34} color={colors.brand} />
            <Text style={styles.emptyTitle}>Chưa có kết quả phối đồ</Text>
            <Text style={styles.emptyText}>Tải một ảnh của bạn và chọn sản phẩm để bắt đầu.</Text>
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
    minHeight: 78,
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
  headerCopy: {
    flex: 1,
    paddingHorizontal: spacing.md,
  },
  headerTitle: {
    color: colors.white,
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '900',
  },
  headerSubtitle: {
    color: colors.brandPale,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
    marginTop: 2,
  },
  content: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    padding: spacing.md,
    paddingBottom: spacing.xxl,
    gap: spacing.lg,
  },
  hero: {
    borderRadius: radii.sm,
    backgroundColor: colors.surface,
    padding: spacing.md,
    flexDirection: 'row',
    gap: spacing.md,
    ...shadows.card,
  },
  heroImageWrap: {
    width: 116,
    aspectRatio: 0.72,
    borderRadius: radii.sm,
    overflow: 'hidden',
    backgroundColor: colors.brandSoft,
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  emptyHeroImage: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.brandSoft,
  },
  heroCopy: {
    flex: 1,
    justifyContent: 'center',
  },
  heroTitle: {
    color: colors.text,
    fontSize: 20,
    lineHeight: 26,
    fontWeight: '900',
  },
  heroText: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 19,
    marginTop: spacing.sm,
  },
  actionGrid: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  primaryAction: {
    flex: 1,
    minHeight: 52,
    borderRadius: radii.sm,
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
    ...shadows.card,
  },
  primaryActionText: {
    color: colors.white,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '900',
  },
  secondaryAction: {
    flex: 1,
    minHeight: 52,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.sm,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  secondaryActionText: {
    color: colors.brandDark,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '900',
  },
  inlineLoading: {
    borderRadius: radii.sm,
    backgroundColor: colors.surface,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  inlineLoadingText: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
  },
  continueCard: {
    borderRadius: radii.sm,
    backgroundColor: colors.surface,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    ...shadows.card,
  },
  processingCard: {
    borderRadius: radii.sm,
    backgroundColor: colors.brandSoft,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  progressCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 3,
    borderColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  progressText: {
    color: colors.brandDark,
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '900',
  },
  continueCopy: {
    flex: 1,
  },
  continueTitle: {
    color: colors.text,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '900',
  },
  continueText: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 2,
  },
  guideCard: {
    borderRadius: radii.sm,
    backgroundColor: colors.surface,
    padding: spacing.md,
    gap: spacing.sm,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 17,
    lineHeight: 23,
    fontWeight: '900',
  },
  guideRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  guideText: {
    flex: 1,
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '700',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  linkText: {
    color: colors.brand,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '900',
  },
  listLoading: {
    paddingVertical: spacing.xl,
  },
  jobGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  jobCard: {
    width: '47.8%',
    minWidth: 0,
    borderRadius: radii.sm,
    backgroundColor: colors.surface,
    overflow: 'hidden',
    ...shadows.card,
  },
  jobImageWrap: {
    width: '100%',
    aspectRatio: 0.82,
    backgroundColor: colors.brandSoft,
  },
  jobImage: {
    width: '100%',
    height: '100%',
  },
  jobBadge: {
    position: 'absolute',
    left: spacing.sm,
    bottom: spacing.sm,
    borderRadius: radii.xs,
    backgroundColor: 'rgba(33,52,72,0.82)',
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  jobBadgeText: {
    color: colors.white,
    fontSize: 10,
    lineHeight: 13,
    fontWeight: '900',
  },
  jobTitle: {
    minHeight: 36,
    color: colors.text,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '900',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
  },
  jobMeta: {
    color: colors.textMuted,
    fontSize: 11,
    lineHeight: 15,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
  },
  emptyState: {
    borderRadius: radii.sm,
    backgroundColor: colors.surface,
    padding: spacing.xl,
    alignItems: 'center',
    gap: spacing.sm,
  },
  emptyTitle: {
    color: colors.text,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '900',
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
  },
});

export default VirtualTryOnHomeScreen;

