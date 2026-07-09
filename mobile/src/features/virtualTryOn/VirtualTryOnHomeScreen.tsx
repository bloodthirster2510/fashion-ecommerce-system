import React from 'react';
import { ActivityIndicator, Alert, Animated, Easing, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
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
  none: 'Giữ nền cũ',
  work: 'Đi làm',
  casual: 'Đi chơi',
  party: 'Dự tiệc',
  travel: 'Du lịch',
  sport: 'Thể thao',
  date: 'Hẹn hò',
  custom: 'Mô tả riêng',
};

const getJobPreviewUrl = (job: VirtualTryOnJob) =>
  job.generatedImageUrls?.[0] || job.generatedImageUrl || job.sourceImageUrl;

const getJobImageCount = (job: VirtualTryOnJob) =>
  job.generatedImageUrls?.length || (job.generatedImageUrl ? 1 : 0);

const isSourceAsset = (asset: VirtualTryOnAsset) =>
  asset.type === 'source_upload' || asset.type === 'source_camera';

const studioPalette = {
  ink: '#213448',
  primaryDark: '#213448',
  primary: '#547792',
  primarySoft: '#EDF4F7',
  header: '#547792',
  headerSoft: '#DDE7EC',
  panel: '#FFFFFF',
  canvas: '#F6FAFD',
  cloth: '#EAF3F8',
  line: '#DDE7EC',
  success: '#198754',
  successSoft: '#EAF7EF',
} as const;

const virtualTryOnHeroImage = require('../../../assets/virtual-try-on/hero-studio.jpg');

const VirtualTryOnHomeScreen = () => {
  const navigation = useNavigation<NavigationProp>();
  const { isAuthenticated, runWithAuth } = useAuth();
  const [latestAsset, setLatestAsset] = React.useState<VirtualTryOnAsset | null>(null);
  const [assetLibrary, setAssetLibrary] = React.useState<VirtualTryOnAsset[]>([]);
  const [latestJob, setLatestJob] = React.useState<VirtualTryOnJob | null>(null);
  const [jobs, setJobs] = React.useState<VirtualTryOnJob[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [isUploading, setIsUploading] = React.useState(false);
  const [deletingAssetId, setDeletingAssetId] = React.useState<string | null>(null);
  const heroLift = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(heroLift, {
          toValue: 1,
          duration: 2200,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(heroLift, {
          toValue: 0,
          duration: 2200,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );

    animation.start();
    return () => animation.stop();
  }, [heroLift]);

  const heroAnimatedStyle = {
    transform: [
      {
        translateY: heroLift.interpolate({
          inputRange: [0, 1],
          outputRange: [0, -4],
        }),
      },
    ],
  };

  const requireLogin = React.useCallback(() => {
    if (isAuthenticated) return true;
    navigation.navigate('Login');
    return false;
  }, [isAuthenticated, navigation]);

  const loadDashboard = React.useCallback(() => {
    if (!isAuthenticated) {
      setLatestAsset(null);
      setAssetLibrary([]);
      setLatestJob(null);
      setJobs([]);
      return;
    }

    let isCurrent = true;
    setIsLoading(true);
    runWithAuth(async (token) => {
      const [assetsResponse, latest, jobsResponse] = await Promise.all([
        virtualTryOnApi.getAssets(token, { limit: 20 }),
        virtualTryOnApi.getLatestJob(token),
        virtualTryOnApi.getJobs(token, { limit: 4 }),
      ]);
      if (!isCurrent) return;
      const sourceAssets = assetsResponse.items.filter(isSourceAsset);
      setAssetLibrary(sourceAssets);
      setLatestAsset((current) => (
        current && sourceAssets.some((asset) => asset._id === current._id)
          ? current
          : null
      ));
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
      setAssetLibrary((current) => [asset, ...current.filter((item) => isSourceAsset(item) && item._id !== asset._id)]);
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

  const removeLatestAsset = () => {
    if (!latestAsset) return;
    Alert.alert(
      'Bỏ ảnh này?',
      'Ảnh chỉ được bỏ khỏi lượt phối hiện tại và vẫn nằm trong kho ảnh của bạn.',
      [
        { text: 'Giữ lại', style: 'cancel' },
        {
          text: 'Bỏ ảnh',
          style: 'destructive',
          onPress: () => setLatestAsset(null),
        },
      ],
    );
  };

  const deleteLibraryAsset = (asset: VirtualTryOnAsset) => {
    Alert.alert(
      'Xóa ảnh khỏi kho?',
      'Ảnh này sẽ bị xóa khỏi kho ảnh phòng thử đồ. Các kết quả phối đồ đã tạo trước đó vẫn giữ lịch sử riêng.',
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Xóa ảnh',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              setDeletingAssetId(asset._id);
              try {
                await runWithAuth((token) => virtualTryOnApi.deleteAsset(token, asset._id));
                setAssetLibrary((current) => current.filter((item) => item._id !== asset._id));
                setLatestAsset((current) => (current?._id === asset._id ? null : current));
              } catch (error) {
                const message = error instanceof Error ? error.message : 'Không thể xóa ảnh lúc này.';
                Alert.alert('Xóa ảnh', message);
              } finally {
                setDeletingAssetId(null);
              }
            })();
          },
        },
      ],
    );
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

  const pendingJob = latestJob && ['queued', 'processing'].includes(latestJob.status) ? latestJob : null;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerButton} onPress={() => navigation.goBack()} activeOpacity={0.8}>
          <MaterialCommunityIcons name="arrow-left" size={25} color={colors.white} />
        </TouchableOpacity>
        <View style={styles.headerCopy}>
          <Text style={styles.headerKicker}>Fit Studio</Text>
          <Text style={styles.headerTitle}>Phòng phối đồ ảo</Text>
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
        <View style={styles.studioFlowCard}>
          {[
            { label: 'Chọn ảnh', icon: latestAsset ? 'check-circle' : 'image-plus', active: true, done: Boolean(latestAsset) },
            { label: 'Phối đồ', icon: 'hanger', active: Boolean(latestAsset), done: false },
            { label: 'Xem kết quả', icon: 'auto-fix', active: Boolean(pendingJob), done: false },
          ].map((step, index) => (
            <View key={step.label} style={styles.flowStepWrap}>
              <View
                style={[
                  styles.flowIcon,
                  step.active && styles.flowIconActive,
                  step.done && styles.flowIconDone,
                ]}
              >
                <MaterialCommunityIcons
                  name={step.icon as keyof typeof MaterialCommunityIcons.glyphMap}
                  size={18}
                  color={step.active || step.done ? colors.white : studioPalette.primary}
                />
              </View>
              <Text style={[styles.flowLabel, (step.active || step.done) && styles.flowLabelActive]} numberOfLines={1}>
                {step.label}
              </Text>
              {index < 2 ? <View style={[styles.flowLine, step.done && styles.flowLineDone]} /> : null}
            </View>
          ))}
        </View>

        <View style={styles.hero}>
          <View style={styles.heroCopy}>
            <Text style={styles.heroEyebrow}>Phòng thử đồ cá nhân</Text>
            <Text style={styles.heroTitle}>Thử đồ trên ảnh của bạn</Text>
            <Text style={styles.heroText}>
              Chọn ảnh rõ người, thêm vài món đồ phù hợp rồi xem bộ phối hoàn chỉnh.
            </Text>
          </View>

          <View style={styles.heroStage}>
            <Animated.View style={[styles.heroImageWrap, heroAnimatedStyle]}>
              {latestAsset ? (
                <RemoteImage uri={latestAsset.url} style={styles.heroImage} recyclingKey={latestAsset._id} />
              ) : (
                <Image source={virtualTryOnHeroImage} style={styles.heroImage} resizeMode="cover" />
              )}
              {latestAsset ? (
                <TouchableOpacity
                  style={styles.removeAssetButton}
                  onPress={removeLatestAsset}
                  activeOpacity={0.82}
                  accessibilityLabel="Bỏ ảnh đã tải lên"
                >
                  <MaterialCommunityIcons name="close" size={18} color={colors.white} />
                </TouchableOpacity>
              ) : null}
              <View style={[styles.heroBadge, latestAsset && styles.heroBadgeReady]}>
                <MaterialCommunityIcons name={latestAsset ? 'check' : 'camera-outline'} size={16} color={colors.white} />
                <Text style={styles.heroBadgeText}>{latestAsset ? 'Ảnh đã sẵn sàng' : 'Cần ảnh người mặc'}</Text>
              </View>
            </Animated.View>
          </View>

          {latestAsset ? (
            <TouchableOpacity style={styles.heroPrimaryButton} onPress={continueWithLatestAsset} activeOpacity={0.86}>
              <Text style={styles.heroPrimaryText}>Tiếp tục phối đồ</Text>
              <MaterialCommunityIcons name="arrow-right" size={20} color={colors.white} />
            </TouchableOpacity>
          ) : null}
        </View>

        <View style={styles.actionGrid}>
          <TouchableOpacity style={styles.primaryAction} onPress={pickImage} disabled={isUploading} activeOpacity={0.86}>
            <View style={styles.actionIconPrimary}>
              <MaterialCommunityIcons name="upload-outline" size={30} color={studioPalette.ink} />
            </View>
            <View style={styles.actionCopy}>
              <Text style={styles.primaryActionText}>Tải ảnh</Text>
              <Text style={styles.actionMeta}>Ảnh toàn thân có sẵn</Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryAction} onPress={takePhoto} disabled={isUploading} activeOpacity={0.86}>
            <View style={styles.actionIconSecondary}>
              <MaterialCommunityIcons name="camera-outline" size={30} color={studioPalette.primary} />
            </View>
            <View style={styles.actionCopy}>
              <Text style={styles.secondaryActionText}>Chụp mới</Text>
              <Text style={styles.secondaryActionMeta}>Chụp ảnh mới để thử đồ</Text>
            </View>
          </TouchableOpacity>
        </View>

        {isAuthenticated && assetLibrary.length ? (
          <View style={styles.assetLibraryCard}>
            <View style={styles.assetLibraryHeader}>
              <View>
                <Text style={styles.assetLibraryTitle}>Kho ảnh của bạn</Text>
                <Text style={styles.assetLibraryText}>Chọn lại ảnh đã tải lên để phối đồ nhanh hơn.</Text>
              </View>
              <Text style={styles.assetLibraryCount}>{assetLibrary.length} ảnh</Text>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.assetLibraryList}>
              {assetLibrary.map((asset) => {
                const selected = latestAsset?._id === asset._id;

                return (
                  <TouchableOpacity
                    key={asset._id}
                    style={[styles.assetThumbButton, selected && styles.assetThumbButtonSelected]}
                    onPress={() => setLatestAsset(asset)}
                    activeOpacity={0.84}
                    accessibilityLabel={selected ? 'Ảnh đang được chọn' : 'Chọn ảnh này để phối đồ'}
                  >
                    <RemoteImage
                      uri={asset.thumbnailUrl || asset.url}
                      style={styles.assetThumbImage}
                      recyclingKey={`asset-library-${asset._id}`}
                    />
                    {selected ? (
                      <View style={styles.assetSelectedBadge}>
                        <MaterialCommunityIcons name="check" size={15} color={colors.white} />
                      </View>
                    ) : null}
                    <TouchableOpacity
                      style={styles.assetDeleteButton}
                      onPress={(event) => {
                        event.stopPropagation();
                        deleteLibraryAsset(asset);
                      }}
                      activeOpacity={0.82}
                      accessibilityLabel="Xóa ảnh khỏi kho"
                      disabled={deletingAssetId === asset._id}
                    >
                      {deletingAssetId === asset._id ? (
                        <ActivityIndicator size="small" color={colors.white} />
                      ) : (
                        <MaterialCommunityIcons name="trash-can-outline" size={15} color={colors.white} />
                      )}
                    </TouchableOpacity>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        ) : null}

        {isUploading ? (
          <View style={styles.inlineLoading}>
            <ActivityIndicator color={colors.brand} />
            <Text style={styles.inlineLoadingText}>Đang tải ảnh lên...</Text>
          </View>
        ) : null}

        {pendingJob ? (
          <TouchableOpacity style={styles.processingCard} onPress={() => openJob(pendingJob)} activeOpacity={0.86}>
            <View style={styles.progressCircle}>
              <Text style={styles.progressText}>{pendingJob.progress}%</Text>
            </View>
            <View style={styles.continueCopy}>
              <Text style={styles.continueTitle}>Một bộ phối đang được tạo</Text>
              <Text style={styles.continueText}>Quá trình thử đồ vẫn đang chạy trong nền.</Text>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={26} color={studioPalette.ink} />
          </TouchableOpacity>
        ) : null}

        <View style={styles.guideCard}>
          <Text style={styles.sectionTitle}>Ảnh phù hợp để thử đồ</Text>
          {['Chỉ có một người trong ảnh', 'Thấy rõ dáng người', 'Ảnh đủ sáng và rõ nét'].map((item) => (
            <View key={item} style={styles.guideRow}>
              <View style={styles.guideIcon}>
                <MaterialCommunityIcons name="check" size={16} color={colors.white} />
              </View>
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
            {jobs.map((job) => {
              const imageCount = getJobImageCount(job);

              return (
                <TouchableOpacity key={job._id} style={styles.jobCard} onPress={() => openJob(job)} activeOpacity={0.86}>
                  <View style={styles.jobImageWrap}>
                    <RemoteImage
                      uri={getJobPreviewUrl(job)}
                      style={styles.jobImage}
                      recyclingKey={`${job._id}-${job.status}`}
                    />
                    <View style={styles.jobBadge}>
                      <Text style={styles.jobBadgeText}>{statusLabel[job.status]}</Text>
                    </View>
                    {imageCount > 1 ? (
                      <View style={styles.jobImageCountBadge}>
                        <Text style={styles.jobImageCountText}>{imageCount} ảnh</Text>
                      </View>
                    ) : null}
                  </View>
                  <Text style={styles.jobTitle} numberOfLines={2}>
                    {contextLabel[job.contextPreset] ?? 'Phối đồ'}
                  </Text>
                  <Text style={styles.jobMeta}>{formatDate(job.createdAt)}</Text>
                </TouchableOpacity>
              );
            })}
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
  headerSubtitle: {
    color: colors.brandPale,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
    marginTop: 2,
  },
  content: {
    flex: 1,
    backgroundColor: studioPalette.canvas,
  },
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
    gap: spacing.lg,
  },
  studioFlowCard: {
    borderRadius: radii.md,
    backgroundColor: studioPalette.panel,
    borderWidth: 1,
    borderColor: studioPalette.line,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    ...shadows.card,
  },
  flowStepWrap: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
    position: 'relative',
  },
  flowIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: studioPalette.primarySoft,
    borderWidth: 1,
    borderColor: studioPalette.line,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  flowIconActive: {
    backgroundColor: studioPalette.primary,
    borderColor: studioPalette.primary,
  },
  flowIconDone: {
    backgroundColor: studioPalette.success,
    borderColor: studioPalette.success,
  },
  flowLabel: {
    color: colors.textMuted,
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '900',
    marginTop: spacing.xs,
  },
  flowLabelActive: {
    color: studioPalette.ink,
  },
  flowLine: {
    position: 'absolute',
    top: 19,
    right: '-50%',
    width: '100%',
    height: 2,
    backgroundColor: studioPalette.line,
    zIndex: 0,
  },
  flowLineDone: {
    backgroundColor: studioPalette.success,
  },
  hero: {
    borderRadius: radii.md,
    backgroundColor: studioPalette.panel,
    padding: spacing.lg,
    gap: spacing.lg,
    borderWidth: 1,
    borderColor: studioPalette.line,
    ...shadows.card,
  },
  heroStage: {
    width: '100%',
  },
  heroImageWrap: {
    width: '100%',
    aspectRatio: 0.92,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: studioPalette.cloth,
    borderWidth: 1,
    borderColor: studioPalette.line,
    position: 'relative',
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  removeAssetButton: {
    position: 'absolute',
    top: spacing.md,
    right: spacing.md,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(33,52,72,0.78)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.28)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroBadge: {
    position: 'absolute',
    left: spacing.md,
    bottom: spacing.md,
    minHeight: 32,
    borderRadius: radii.pill,
    backgroundColor: studioPalette.primary,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  heroBadgeReady: {
    backgroundColor: studioPalette.success,
  },
  heroBadgeText: {
    color: colors.white,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '900',
  },
  heroCopy: {
    gap: spacing.xs,
  },
  heroEyebrow: {
    color: studioPalette.primary,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  heroTitle: {
    color: studioPalette.primaryDark,
    fontSize: 26,
    lineHeight: 32,
    fontWeight: '900',
  },
  heroText: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '700',
    marginTop: spacing.sm,
  },
  heroPrimaryButton: {
    alignSelf: 'flex-start',
    borderRadius: radii.pill,
    minHeight: 52,
    backgroundColor: studioPalette.primary,
    paddingHorizontal: spacing.lg,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  heroPrimaryText: {
    color: colors.white,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '900',
  },
  actionGrid: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  primaryAction: {
    flex: 1,
    minHeight: 118,
    borderRadius: radii.md,
    backgroundColor: studioPalette.panel,
    borderWidth: 1,
    borderColor: studioPalette.line,
    padding: spacing.md,
    justifyContent: 'space-between',
    ...shadows.card,
  },
  actionIconPrimary: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: studioPalette.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionIconSecondary: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: studioPalette.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionCopy: {
    gap: 2,
  },
  primaryActionText: {
    color: studioPalette.ink,
    fontSize: 18,
    lineHeight: 23,
    fontWeight: '900',
  },
  actionMeta: {
    color: studioPalette.ink,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '800',
  },
  secondaryAction: {
    flex: 1,
    minHeight: 118,
    borderWidth: 1,
    borderColor: studioPalette.line,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    padding: spacing.md,
    justifyContent: 'space-between',
    ...shadows.card,
  },
  secondaryActionText: {
    color: studioPalette.ink,
    fontSize: 18,
    lineHeight: 23,
    fontWeight: '900',
  },
  secondaryActionMeta: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '800',
  },
  assetLibraryCard: {
    borderRadius: radii.md,
    backgroundColor: studioPalette.panel,
    borderWidth: 1,
    borderColor: studioPalette.line,
    padding: spacing.lg,
    gap: spacing.md,
  },
  assetLibraryHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  assetLibraryTitle: {
    color: studioPalette.ink,
    fontSize: 18,
    lineHeight: 23,
    fontWeight: '900',
  },
  assetLibraryText: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '700',
    marginTop: 2,
  },
  assetLibraryCount: {
    color: studioPalette.primary,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '900',
  },
  assetLibraryList: {
    gap: spacing.sm,
    paddingRight: spacing.lg,
  },
  assetThumbButton: {
    width: 82,
    height: 104,
    borderRadius: radii.sm,
    overflow: 'hidden',
    backgroundColor: studioPalette.cloth,
    borderWidth: 2,
    borderColor: 'transparent',
    position: 'relative',
  },
  assetThumbButtonSelected: {
    borderColor: studioPalette.success,
  },
  assetThumbImage: {
    width: '100%',
    height: '100%',
  },
  assetSelectedBadge: {
    position: 'absolute',
    bottom: 6,
    right: 6,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: studioPalette.success,
    borderWidth: 1.5,
    borderColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  assetDeleteButton: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(204, 0, 0, 0.62)',
    borderWidth: 1.5,
    borderColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
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
    borderRadius: radii.md,
    backgroundColor: studioPalette.panel,
    padding: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderWidth: 1,
    borderColor: studioPalette.line,
  },
  progressCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 3,
    borderColor: studioPalette.primary,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  progressText: {
    color: studioPalette.ink,
    fontSize: 12,
    lineHeight: 15,
    fontWeight: '900',
  },
  continueCopy: {
    flex: 1,
  },
  continueTitle: {
    color: colors.text,
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '900',
  },
  continueText: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '700',
    marginTop: 2,
  },
  guideCard: {
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    padding: spacing.lg,
    gap: spacing.md,
    borderWidth: 1,
    borderColor: studioPalette.line,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 21,
    lineHeight: 27,
    fontWeight: '900',
  },
  guideRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  guideIcon: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: studioPalette.success,
    alignItems: 'center',
    justifyContent: 'center',
  },
  guideText: {
    flex: 1,
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '800',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  linkText: {
    color: studioPalette.primary,
    fontSize: 14,
    lineHeight: 19,
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
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    overflow: 'hidden',
    ...shadows.card,
  },
  jobImageWrap: {
    width: '100%',
    aspectRatio: 3 / 4,
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
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '900',
  },
  jobImageCountBadge: {
    position: 'absolute',
    right: spacing.sm,
    top: spacing.sm,
    borderRadius: radii.xs,
    backgroundColor: 'rgba(255,255,255,0.9)',
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  jobImageCountText: {
    color: studioPalette.ink,
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '900',
  },
  jobTitle: {
    minHeight: 36,
    color: colors.text,
    fontSize: 14,
    lineHeight: 19,
    fontWeight: '900',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
  },
  jobMeta: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 16,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
  },
  emptyState: {
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    padding: spacing.xl,
    alignItems: 'center',
    gap: spacing.sm,
  },
  emptyTitle: {
    color: colors.text,
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '900',
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
});

export default VirtualTryOnHomeScreen;
