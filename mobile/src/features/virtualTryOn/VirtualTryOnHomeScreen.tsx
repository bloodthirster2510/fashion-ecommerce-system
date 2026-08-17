import React from 'react';
import { ActivityIndicator, Alert, Animated, Easing, Image, Modal, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import type { RootStackParamList } from '../../navigation/AppNavigator';
import { RemoteImage } from '../../components/media/RemoteImage';
import { colors, radii, shadows, spacing } from '../../theme';
import { hasNextPage, mergePageItems, type PageInfo } from '../../utils/pagination';
import { useAuth } from '../auth/AuthContext';
import { VirtualTryOnApiError, virtualTryOnApi } from './virtualTryOnApi';
import {
  isImageValidationSoftGuidanceReason,
  isImageValidationSourceBlockReason,
} from './imageValidationPolicy';
import { TRY_ON_ACTIVE_ITEM_LIMIT, TRY_ON_QUEUE_LIMIT, type TryOnSeedItem, type VirtualTryOnAsset, type VirtualTryOnJob } from './virtualTryOn.types';
import { getGeneratedTryOnImageUrls } from './virtualTryOnResultMedia';
import { contextPresetLabel } from './contextPresets';

type NavigationProp = StackNavigationProp<RootStackParamList, 'VirtualTryOnHome'>;
type RouteProps = RouteProp<RootStackParamList, 'VirtualTryOnHome'>;
const ASSET_PAGE_SIZE = 20;
const RECENT_JOB_LIMIT = 4;

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

const getJobPreviewUrl = (job: VirtualTryOnJob) =>
  getGeneratedTryOnImageUrls(job)[0] || job.sourceImageUrl;

const getJobImageCount = (job: VirtualTryOnJob) =>
  getGeneratedTryOnImageUrls(job).length;

const isSourceAsset = (asset: VirtualTryOnAsset) =>
  asset.type === 'source_upload' || asset.type === 'source_camera';

const isBlockedSourceAsset = (asset: VirtualTryOnAsset | null) =>
  isImageValidationSourceBlockReason(asset?.validationWarning?.reasonCode);

const getUploadAssetErrorAlert = (error: unknown) => {
  if (error instanceof VirtualTryOnApiError) {
    if (error.errorCode === 'VIRTUAL_TRY_ON_ACCOUNT_LOCKED') {
      return {
        title: 'Tài khoản bị khóa',
        message: error.message || 'Tính năng phối đồ đang bị khóa. Hãy liên hệ cửa hàng để được hỗ trợ.',
      };
    }

    if (
      error.errorCode === 'NO_PERSON_DETECTED' ||
      error.errorCode === 'MULTIPLE_PEOPLE_DETECTED' ||
      error.errorCode === 'PERSON_TOO_SMALL' ||
      error.errorCode === 'BODY_NOT_VISIBLE'
    ) {
      return {
        title: 'Ảnh chưa sẵn sàng',
        message: error.message,
      };
    }

    if (
      error.errorCode === 'IMAGE_TOO_BLURRY' ||
      error.errorCode === 'IMAGE_TOO_DARK' ||
      error.errorCode === 'IMAGE_TOO_SMALL'
    ) {
      return {
        title: 'Ảnh chưa đủ rõ',
        message: error.message,
      };
    }

    if (error.errorCode === 'VALIDATION_PROVIDER_FAILED') {
      return {
        title: 'Chưa kiểm tra được ảnh',
        message: 'Hãy thử tải lại ảnh sau ít phút.',
      };
    }
  }

  return {
    title: 'Ảnh của bạn',
    message: error instanceof Error ? error.message : 'Không thể tải ảnh lên',
  };
};

const getAssetReadiness = (asset: VirtualTryOnAsset | null) => {
  if (!asset) {
    return {
      icon: 'camera-outline' as keyof typeof MaterialCommunityIcons.glyphMap,
      label: 'Cần ảnh người mặc',
      title: 'Chưa có ảnh',
      message: 'Chọn ảnh rõ và chỉ có một người.',
      color: studioPalette.primary,
      softColor: studioPalette.primarySoft,
      borderColor: studioPalette.line,
    };
  }

  const warning = asset.validationWarning;
  if (!warning && !asset.validationCheckedAt) {
    return {
      icon: 'alert-outline' as keyof typeof MaterialCommunityIcons.glyphMap,
      label: 'Chưa có kết quả',
      title: 'Ảnh chưa được kiểm tra',
      message: 'Hệ thống sẽ kiểm tra lại ảnh này trước khi tạo phối đồ.',
      color: colors.goldDark,
      softColor: colors.goldSoft,
      borderColor: 'rgba(201,151,52,0.28)',
    };
  }

  if (!warning || warning.reasonCode === 'MULTIPLE_PEOPLE_DETECTED') {
    return {
      icon: 'check' as keyof typeof MaterialCommunityIcons.glyphMap,
      label: 'Ảnh đã sẵn sàng',
      title: 'Ảnh đã sẵn sàng',
      message: 'Tiếp tục chọn đồ nhé.',
      color: studioPalette.success,
      softColor: studioPalette.successSoft,
      borderColor: 'rgba(25,135,84,0.22)',
    };
  }

  if (isImageValidationSourceBlockReason(warning.reasonCode)) {
    const block = {
      NO_PERSON_DETECTED: {
        icon: 'account-alert-outline' as keyof typeof MaterialCommunityIcons.glyphMap,
        title: 'Không thấy người trong ảnh',
        message: 'Chọn ảnh thấy rõ người hoặc một phần cơ thể hơn.',
      },
      VALIDATION_PROVIDER_FAILED: {
        icon: 'cloud-alert-outline' as keyof typeof MaterialCommunityIcons.glyphMap,
        title: 'Chưa kiểm tra được ảnh',
        message: 'Hãy thử lại sau ít phút.',
      },
    }[warning.reasonCode] ?? {
      icon: 'alert-outline' as keyof typeof MaterialCommunityIcons.glyphMap,
      title: 'Ảnh không thể dùng',
      message: 'Hãy chọn ảnh khác để phối đồ.',
    };

    return {
      icon: block.icon,
      label: 'Cần đổi ảnh',
      title: block.title,
      message: block.message,
      color: '#B42318',
      softColor: '#FFF1F0',
      borderColor: 'rgba(180,35,24,0.24)',
    };
  }

  if (isImageValidationSoftGuidanceReason(warning.reasonCode)) {
    const guidance = {
      MULTIPLE_PEOPLE_DETECTED: {
        icon: 'account-alert-outline' as keyof typeof MaterialCommunityIcons.glyphMap,
        title: 'Ảnh có nhiều người',
        message: 'Nên dùng ảnh chỉ có một người.',
      },
      PERSON_TOO_SMALL: {
        icon: 'account-alert-outline' as keyof typeof MaterialCommunityIcons.glyphMap,
        title: 'Người trong ảnh quá nhỏ',
        message: 'Nên chọn ảnh chụp gần hơn.',
      },
      IMAGE_TOO_BLURRY: {
        icon: 'image-alert-outline' as keyof typeof MaterialCommunityIcons.glyphMap,
        title: 'Ảnh bị mờ',
        message: 'Nên chọn ảnh rõ nét hơn.',
      },
      IMAGE_TOO_DARK: {
        icon: 'weather-night' as keyof typeof MaterialCommunityIcons.glyphMap,
        title: 'Ảnh quá tối',
        message: 'Nên chọn ảnh sáng hơn.',
      },
      IMAGE_TOO_SMALL: {
        icon: 'image-size-select-small' as keyof typeof MaterialCommunityIcons.glyphMap,
        title: 'Ảnh có độ phân giải thấp',
        message: 'Nên chọn ảnh chất lượng cao hơn.',
      },
      POSE_NOT_SUPPORTED: {
        icon: 'human-handsup' as keyof typeof MaterialCommunityIcons.glyphMap,
        title: 'Tư thế khó xử lý',
        message: 'Nên chọn ảnh đứng thẳng, ít bị che.',
      },
    }[warning.reasonCode] ?? {
      icon: 'alert-outline' as keyof typeof MaterialCommunityIcons.glyphMap,
      title: 'Ảnh cần lưu ý',
      message: 'Bạn vẫn có thể tiếp tục.',
    };

    return {
      icon: guidance.icon,
      label: 'Có lưu ý',
      title: guidance.title,
      message: guidance.message,
      color: studioPalette.success,
      softColor: studioPalette.guidanceSoft,
      borderColor: 'rgba(25,135,84,0.14)',
    };
  }

  if (warning.reasonCode === 'BODY_NOT_VISIBLE') {
    return {
      icon: 'human-male-height-variant' as keyof typeof MaterialCommunityIcons.glyphMap,
      label: 'Cần chọn đồ phù hợp',
      title: 'Ảnh chưa đủ vùng cơ thể',
      message: 'Chỉ các món dùng vùng cơ thể nhìn thấy rõ mới có thể tạo ảnh.',
      color: colors.goldDark,
      softColor: colors.goldSoft,
      borderColor: 'rgba(201,151,52,0.28)',
    };
  }

  return {
    icon: 'alert-outline' as keyof typeof MaterialCommunityIcons.glyphMap,
    label: 'Nên kiểm tra',
    title: 'Ảnh chưa rõ',
    message: 'Bạn vẫn có thể tiếp tục.',
    color: colors.goldDark,
    softColor: colors.goldSoft,
    borderColor: 'rgba(201,151,52,0.28)',
  };
};

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
  guidanceSoft: '#D7FAE4',
} as const;

const virtualTryOnHeroImage = require('../../../assets/virtual-try-on/hero-studio.jpg');

const VirtualTryOnHomeScreen = () => {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<RouteProps>();
  const { isAuthenticated, runWithAuth } = useAuth();
  const [latestAsset, setLatestAsset] = React.useState<VirtualTryOnAsset | null>(null);
  const [assetLibrary, setAssetLibrary] = React.useState<VirtualTryOnAsset[]>([]);
  const [assetPagination, setAssetPagination] = React.useState<PageInfo | null>(null);
  const [isLoadingMoreAssets, setIsLoadingMoreAssets] = React.useState(false);
  const [latestJob, setLatestJob] = React.useState<VirtualTryOnJob | null>(null);
  const [jobs, setJobs] = React.useState<VirtualTryOnJob[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [isUploading, setIsUploading] = React.useState(false);
  const [deletingAssetId, setDeletingAssetId] = React.useState<string | null>(null);
  const [pendingSeedItems, setPendingSeedItems] = React.useState<TryOnSeedItem[]>([]);
  const [pendingAlternativeSeedItems, setPendingAlternativeSeedItems] = React.useState<TryOnSeedItem[]>([]);
  const [pendingEntryPoint, setPendingEntryPoint] = React.useState<'cart' | 'builder' | undefined>();
  const [isPreviewVisible, setIsPreviewVisible] = React.useState(false);
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const heroLift = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    const nextSeedItems = route.params?.seedItems;
    if (!nextSeedItems?.length) return;

    setPendingSeedItems(nextSeedItems.slice(0, TRY_ON_QUEUE_LIMIT));
    setPendingAlternativeSeedItems(route.params?.alternativeSeedItems ?? []);
    setPendingEntryPoint(route.params?.entryPoint);
    navigation.setParams({ seedItems: undefined, alternativeSeedItems: undefined, entryPoint: undefined });
  }, [navigation, route.params?.entryPoint, route.params?.seedItems, route.params?.alternativeSeedItems]);

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
      setAssetPagination(null);
      setLatestJob(null);
      setJobs([]);
      return;
    }

    let isCurrent = true;
    setIsLoading(true);
    runWithAuth(async (token) => {
      const [assetsResponse, latest, jobsResponse] = await Promise.all([
        virtualTryOnApi.getAssets(token, { page: 1, limit: ASSET_PAGE_SIZE }),
        virtualTryOnApi.getLatestJob(token),
        virtualTryOnApi.getJobs(token, { limit: RECENT_JOB_LIMIT }),
      ]);
      if (!isCurrent) return;
      const sourceAssets = assetsResponse.items.filter(isSourceAsset);
      setAssetLibrary(sourceAssets);
      setAssetPagination(assetsResponse.pagination);
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
        Alert.alert('Phối đồ', message);
      })
      .finally(() => {
        if (isCurrent) setIsLoading(false);
      });

    return () => { isCurrent = false; };
  }, [isAuthenticated, runWithAuth]);

  useFocusEffect(React.useCallback(() => loadDashboard(), [loadDashboard]));

  const loadMoreAssets = React.useCallback(async () => {
    if (isLoadingMoreAssets || !hasNextPage(assetPagination)) return;
    setIsLoadingMoreAssets(true);
    try {
      const response = await runWithAuth((token) => virtualTryOnApi.getAssets(token, {
        page: (assetPagination?.page ?? 0) + 1,
        limit: ASSET_PAGE_SIZE,
      }));
      setAssetLibrary((current) => mergePageItems(current, response.items.filter(isSourceAsset)));
      setAssetPagination(response.pagination);
    } catch (caught) {
      Alert.alert(
        'Không thể tải thêm ảnh',
        caught instanceof Error ? caught.message : 'Bạn thử lại sau nhé.',
      );
    } finally {
      setIsLoadingMoreAssets(false);
    }
  }, [assetPagination, isLoadingMoreAssets, runWithAuth]);

  React.useEffect(() => {
    if (pendingSeedItems.length && !latestAsset && assetLibrary.length) {
      setLatestAsset(assetLibrary[0]);
    }
  }, [assetLibrary, latestAsset, pendingSeedItems.length]);

  const openBuilderWithAsset = React.useCallback((asset: VirtualTryOnAsset) => {
    const seedItems = pendingSeedItems;
    const alternativeSeedItems = pendingAlternativeSeedItems;
    const entryPoint = pendingEntryPoint;
    setPendingSeedItems([]);
    setPendingAlternativeSeedItems([]);
    setPendingEntryPoint(undefined);
    navigation.navigate('VirtualTryOnBuilder', {
      assetId: asset._id,
      imageUrl: asset.url,
      seedItems: seedItems.length ? seedItems : undefined,
      alternativeSeedItems: alternativeSeedItems.length ? alternativeSeedItems : undefined,
      entryPoint,
    });
  }, [navigation, pendingAlternativeSeedItems, pendingEntryPoint, pendingSeedItems]);

  const uploadPickedAsset = async (uri: string, source: 'upload' | 'camera') => {
    setIsUploading(true);
    try {
      const asset = await runWithAuth((token) => virtualTryOnApi.uploadAsset(token, uri, source));
      setLatestAsset(asset);
      setAssetLibrary((current) => [asset, ...current.filter((item) => isSourceAsset(item) && item._id !== asset._id)]);
    } catch (error) {
      const alert = getUploadAssetErrorAlert(error);
      Alert.alert(alert.title, alert.message);
    } finally {
      setIsUploading(false);
    }
  };

  const pickImage = async () => {
    if (!requireLogin()) return;
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Cần quyền truy cập ảnh', 'Cho phép ứng dụng truy cập thư viện ảnh.');
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
      Alert.alert('Cần quyền camera', 'Cho phép ứng dụng mở camera để chụp ảnh.');
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
      'Ảnh này sẽ bị xóa khỏi kho ảnh phòng phối đồ. Các kết quả phối đồ đã tạo trước đó vẫn giữ lịch sử riêng.',
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
    if (job.status === 'succeeded' && getGeneratedTryOnImageUrls(job).length > 0) {
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
    if (isBlockedSourceAsset(latestAsset)) {
      const readiness = getAssetReadiness(latestAsset);
      Alert.alert(readiness.title, readiness.message);
      return;
    }
    openBuilderWithAsset(latestAsset);
  };

  const pendingJob = latestJob && ['queued', 'processing'].includes(latestJob.status) ? latestJob : null;
  const flowSteps = pendingSeedItems.length
    ? [
        { label: 'Đã chọn đồ', icon: 'check-circle', active: true, done: true },
        { label: 'Chọn ảnh', icon: latestAsset ? 'check-circle' : 'image-plus', active: true, done: Boolean(latestAsset) },
        { label: 'Tạo kết quả', icon: 'auto-fix', active: Boolean(latestAsset), done: false },
      ]
    : [
        { label: 'Chọn ảnh', icon: latestAsset ? 'check-circle' : 'image-plus', active: true, done: Boolean(latestAsset) },
        { label: 'Phối đồ', icon: 'hanger', active: Boolean(latestAsset), done: false },
        { label: 'Xem kết quả', icon: 'auto-fix', active: Boolean(pendingJob), done: false },
      ];
  const assetReadiness = getAssetReadiness(latestAsset);
  const latestAssetIsBlocked = isBlockedSourceAsset(latestAsset);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.headerButton}
          onPress={() => navigation.navigate('Home', undefined, { pop: true })}
          activeOpacity={0.8}
        >
          <MaterialCommunityIcons name="arrow-left" size={25} color={colors.white} />
        </TouchableOpacity>
        <View style={styles.headerCopy}>
          <Text style={styles.headerTitle}>Phối đồ</Text>
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
          {flowSteps.map((step, index) => (
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

        {pendingSeedItems.length ? (
          <View style={styles.pendingOutfitCard}>
            <View style={styles.pendingOutfitTopRow}>
              <View style={styles.pendingOutfitIcon}>
                <MaterialCommunityIcons name="cart-check" size={22} color={colors.white} />
              </View>
              <View style={styles.pendingOutfitCopy}>
                <Text style={styles.pendingOutfitEyebrow}>
                  {pendingEntryPoint === 'cart' ? 'Mang từ giỏ hàng' : 'Bộ đồ được giữ lại'}
                </Text>
                <Text style={styles.pendingOutfitTitle}>{pendingSeedItems.length} món chờ thử</Text>
                <Text style={styles.pendingOutfitText}>Chọn ảnh để bắt đầu. Mỗi lượt tối đa {TRY_ON_ACTIVE_ITEM_LIMIT} món.</Text>
              </View>
            </View>
            <View style={styles.pendingOutfitThumbRow}>
              {pendingSeedItems.map((item, index) => (
                <View key={item.cartItemId ?? `${item.productId}-${item.variantId}-${item.colorVariantId}-${item.size ?? index}`} style={styles.pendingOutfitThumbWrap}>
                  {item.imageSnapshot ? (
                    <RemoteImage
                      uri={item.imageSnapshot}
                      style={styles.pendingOutfitThumb}
                      recyclingKey={`pending-outfit-${item.colorVariantId}`}
                    />
                  ) : (
                    <View style={styles.pendingOutfitThumbPlaceholder}>
                      <MaterialCommunityIcons name="hanger" size={22} color={studioPalette.primary} />
                    </View>
                  )}
                  <View style={styles.pendingOutfitIndex}>
                    <Text style={styles.pendingOutfitIndexText}>{index + 1}</Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        <View style={styles.hero}>
          <View style={styles.heroCopy}>
            <Text style={styles.heroTitle}>Chọn ảnh người mặc</Text>
            <Text style={styles.heroText}>
              {pendingSeedItems.length
                ? `${pendingSeedItems.length} món đã sẵn sàng để thử.`
                : 'Ảnh rõ, đủ sáng và chỉ có một người.'}
            </Text>
          </View>

          <View style={styles.heroStage}>
            <Animated.View style={heroAnimatedStyle}>
              {latestAsset ? (
                <TouchableOpacity
                  style={styles.heroImageWrap}
                  onPress={() => setIsPreviewVisible(true)}
                  activeOpacity={0.9}
                  accessibilityRole="button"
                  accessibilityLabel="Xem ảnh đã tải lên"
                >
                  <RemoteImage uri={latestAsset.url} style={styles.heroImage} recyclingKey={latestAsset._id} />
                  <View style={styles.imageExpandBadge}>
                    <MaterialCommunityIcons name="fullscreen" size={16} color={colors.white} />
                  </View>
                  <TouchableOpacity
                    style={styles.removeAssetButton}
                    onPress={(event) => {
                      event.stopPropagation();
                      removeLatestAsset();
                    }}
                    activeOpacity={0.82}
                    accessibilityLabel="Bỏ ảnh đã tải lên"
                  >
                    <MaterialCommunityIcons name="close" size={18} color={colors.white} />
                  </TouchableOpacity>
                </TouchableOpacity>
              ) : (
                <View style={styles.heroImageWrap}>
                  <Image source={virtualTryOnHeroImage} style={styles.heroImage} resizeMode="cover" />
                </View>
              )}
            </Animated.View>
            {latestAsset ? (
              <View
                style={[
                  styles.readinessCard,
                  {
                    backgroundColor: assetReadiness.softColor,
                    borderColor: assetReadiness.borderColor,
                  },
                ]}
              >
                <View style={[styles.readinessIcon, { backgroundColor: assetReadiness.color }]}>
                  <MaterialCommunityIcons name={assetReadiness.icon} size={18} color={colors.white} />
                </View>
                <View style={styles.readinessCopy}>
                  <Text style={[styles.readinessTitle, { color: assetReadiness.color }]}>
                    {assetReadiness.title}
                  </Text>
                  <Text style={styles.readinessText}>{assetReadiness.message}</Text>
                </View>
              </View>
            ) : null}
          </View>

          {latestAsset ? (
            <TouchableOpacity
              style={styles.heroPrimaryButton}
              onPress={latestAssetIsBlocked ? pickImage : continueWithLatestAsset}
              activeOpacity={0.86}
            >
              <Text style={styles.heroPrimaryText}>
                {latestAssetIsBlocked
                  ? 'Chọn ảnh khác để tiếp tục'
                  : pendingSeedItems.length
                    ? `Mở ${pendingSeedItems.length} món chờ thử`
                    : 'Tiếp tục phối đồ'}
              </Text>
              <MaterialCommunityIcons
                name={latestAssetIsBlocked ? 'upload-outline' : 'arrow-right'}
                size={20}
                color={colors.white}
              />
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
              <Text style={styles.actionMeta}>Từ thư viện</Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryAction} onPress={takePhoto} disabled={isUploading} activeOpacity={0.86}>
            <View style={styles.actionIconSecondary}>
              <MaterialCommunityIcons name="camera-outline" size={30} color={studioPalette.primary} />
            </View>
            <View style={styles.actionCopy}>
              <Text style={styles.secondaryActionText}>Chụp mới</Text>
              <Text style={styles.secondaryActionMeta}>Dùng camera</Text>
            </View>
          </TouchableOpacity>
        </View>

        {isUploading ? (
          <View style={styles.inlineLoading}>
            <ActivityIndicator color={colors.brand} />
            <Text style={styles.inlineLoadingText}>Đang tải và kiểm tra ảnh...</Text>
          </View>
        ) : null}

        {isAuthenticated && assetLibrary.length ? (
          <View style={styles.assetLibraryCard}>
            <View style={styles.assetLibraryHeader}>
              <View>
                <Text style={styles.assetLibraryTitle}>Kho ảnh của bạn</Text>
                <Text style={styles.assetLibraryText}>Chạm để dùng lại.</Text>
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
              {hasNextPage(assetPagination) ? (
                <TouchableOpacity
                  style={styles.assetLoadMoreButton}
                  onPress={() => void loadMoreAssets()}
                  disabled={isLoadingMoreAssets}
                  activeOpacity={0.84}
                  accessibilityLabel="Tải thêm ảnh trong kho"
                >
                  {isLoadingMoreAssets ? (
                    <ActivityIndicator color={studioPalette.primary} />
                  ) : (
                    <>
                      <MaterialCommunityIcons name="chevron-right" size={24} color={studioPalette.primary} />
                      <Text style={styles.assetLoadMoreText}>Tải thêm</Text>
                    </>
                  )}
                </TouchableOpacity>
              ) : null}
            </ScrollView>
          </View>
        ) : null}

        {pendingJob ? (
          <TouchableOpacity style={styles.processingCard} onPress={() => openJob(pendingJob)} activeOpacity={0.86}>
            <View style={styles.progressCircle}>
              <Text style={styles.progressText}>{pendingJob.progress}%</Text>
            </View>
            <View style={styles.continueCopy}>
              <Text style={styles.continueTitle}>Đang tạo bộ phối</Text>
              <Text style={styles.continueText}>Bạn sẽ nhận thông báo khi xong.</Text>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={26} color={studioPalette.ink} />
          </TouchableOpacity>
        ) : null}

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
                    {contextPresetLabel(job.contextPreset) || 'Phối đồ'}
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
            <Text style={styles.emptyText}>Chọn ảnh để bắt đầu.</Text>
          </View>
        )}
      </ScrollView>
      <Modal
        visible={Boolean(isPreviewVisible && latestAsset)}
        transparent
        animationType="fade"
        onRequestClose={() => setIsPreviewVisible(false)}
      >
        <SafeAreaView style={styles.previewModal} edges={['top', 'bottom']}>
          <Pressable style={styles.previewBackdrop} onPress={() => setIsPreviewVisible(false)} />
          <View style={styles.previewHeader}>
            <Text style={styles.previewTitle}>Ảnh người mặc</Text>
            <TouchableOpacity
              style={styles.previewCloseButton}
              onPress={() => setIsPreviewVisible(false)}
              activeOpacity={0.82}
            >
              <MaterialCommunityIcons name="close" size={24} color={colors.white} />
            </TouchableOpacity>
          </View>
          <View style={[styles.previewImageFrame, { width: windowWidth, height: windowHeight }]}>
            {latestAsset ? (
              <RemoteImage
                uri={latestAsset.url}
                style={styles.previewImage}
                recyclingKey={`preview-${latestAsset._id}`}
                resizeMode="contain"
              />
            ) : null}
          </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: studioPalette.header,
  },
  header: {
    minHeight: 60,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    backgroundColor: studioPalette.header,
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
  headerCopy: {
    flex: 1,
    minWidth: 0,
    paddingHorizontal: spacing.sm,
  },
  headerTitle: {
    color: colors.white,
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '800',
    textAlign: 'center',
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
  pendingOutfitCard: {
    borderRadius: radii.md,
    backgroundColor: studioPalette.ink,
    padding: spacing.lg,
    gap: spacing.md,
    overflow: 'hidden',
    ...shadows.card,
  },
  pendingOutfitTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  pendingOutfitIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: studioPalette.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pendingOutfitCopy: {
    flex: 1,
    minWidth: 0,
  },
  pendingOutfitEyebrow: {
    color: '#BFD8E6',
    fontSize: 10,
    lineHeight: 14,
    fontWeight: '900',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  pendingOutfitTitle: {
    color: colors.white,
    fontSize: 18,
    lineHeight: 23,
    fontWeight: '900',
    marginTop: 2,
  },
  pendingOutfitText: {
    color: '#DCEAF1',
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '600',
    marginTop: 4,
  },
  pendingOutfitThumbRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  pendingOutfitThumbWrap: {
    width: 62,
    height: 72,
    borderRadius: radii.sm,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.32)',
    overflow: 'hidden',
  },
  pendingOutfitThumb: {
    width: '100%',
    height: '100%',
  },
  pendingOutfitThumbPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: studioPalette.primarySoft,
  },
  pendingOutfitIndex: {
    position: 'absolute',
    top: 4,
    left: 4,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(33,52,72,0.84)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pendingOutfitIndexText: {
    color: colors.white,
    fontSize: 10,
    lineHeight: 13,
    fontWeight: '900',
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
  imageExpandBadge: {
    position: 'absolute',
    top: spacing.md,
    left: spacing.md,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(33,52,72,0.72)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.26)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  readinessCard: {
    marginTop: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  readinessIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  readinessCopy: {
    flex: 1,
    minWidth: 0,
  },
  readinessTitle: {
    fontSize: 14,
    lineHeight: 19,
    fontWeight: '900',
  },
  readinessText: {
    color: colors.textBody,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '700',
    marginTop: 2,
  },
  heroCopy: {
    gap: spacing.xs,
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
  assetLoadMoreButton: {
    width: 82,
    height: 104,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: studioPalette.line,
    backgroundColor: studioPalette.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  assetLoadMoreText: {
    color: studioPalette.primary,
    fontSize: 12,
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
  sectionTitle: {
    color: colors.text,
    fontSize: 21,
    lineHeight: 27,
    fontWeight: '900',
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
  previewModal: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.94)',
  },
  previewBackdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  previewHeader: {
    minHeight: 58,
    paddingHorizontal: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 2,
  },
  previewTitle: {
    flex: 1,
    color: colors.white,
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '900',
  },
  previewCloseButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewImageFrame: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
});

export default VirtualTryOnHomeScreen;
