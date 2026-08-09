import React from 'react';
import { ActivityIndicator, Alert, Modal, ScrollView, Share, StyleSheet, Text, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system/legacy';
import * as MediaLibrary from 'expo-media-library';
import * as Sharing from 'expo-sharing';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import type { RootStackParamList } from '../../navigation/AppNavigator';
import { RemoteImage } from '../../components/media/RemoteImage';
import { colors, radii, shadows, spacing } from '../../theme';
import { useAuth } from '../auth/AuthContext';
import { cartApi, type CartResponse } from '../cart/cartApi';
import { virtualTryOnApi } from './virtualTryOnApi';
import { useVirtualTryOnRealtime } from './virtualTryOnRealtime';
import type { TryOnSeedItem, TryOnSelectedItem, VirtualTryOnJob } from './virtualTryOn.types';
import { getGeneratedTryOnImageUrls, getTryOnVideoPresentation } from './virtualTryOnResultMedia';
import {
  mergeVirtualTryOnRealtimeEvent,
  preferFreshVirtualTryOnJob,
} from './virtualTryOnJobState';
import { contextPresetLabel } from './contextPresets';
import { tryOnRoleLabel } from './virtualTryOnSelection';

type NavigationProp = StackNavigationProp<RootStackParamList, 'VirtualTryOnResult'>;
type RouteProps = RouteProp<RootStackParamList, 'VirtualTryOnResult'>;
type ImageActionScope = 'active' | 'all';
type PreviewImage = {
  uri: string;
  label: string;
  recyclingKey: string;
  resizeMode?: 'cover' | 'contain';
};

const formatPrice = (value: number) =>
  `${Math.round(value).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')}đ`;

const getSeedComparableKey = (item: Pick<TryOnSeedItem, 'productId' | 'variantId' | 'colorVariantId' | 'size'>) =>
  `${item.productId}:${item.variantId}:${item.colorVariantId}:${item.size ?? ''}`;

const selectedItemToSeed = (item: TryOnSelectedItem): TryOnSeedItem => ({
  productId: item.productId,
  variantId: item.variantId,
  colorVariantId: item.colorVariantId,
  size: item.size,
  role: item.role,
  nameSnapshot: item.nameSnapshot,
  colorSnapshot: item.colorSnapshot,
  imageSnapshot: item.imageSnapshot,
});

const findCartItemIdForTryOnItem = (cart: CartResponse, selection: TryOnSelectedItem) => {
  const normalizedSize = selection.size?.trim().toLowerCase() ?? '';

  return cart.product_list.find((item) => (
    item.productId === selection.productId &&
    item.variantId === selection.variantId &&
    item.colorVariantId === selection.colorVariantId &&
    item.size.trim().toLowerCase() === normalizedSize
  ))?._id;
};

const getDownloadExtension = (url: string) => {
  const cleanUrl = url.split('?')[0]?.toLowerCase() ?? '';
  if (cleanUrl.endsWith('.jpg') || cleanUrl.endsWith('.jpeg')) return 'jpg';
  if (cleanUrl.endsWith('.webp')) return 'webp';
  return 'png';
};

const getImageMimeType = (extension: string) => {
  if (extension === 'jpg' || extension === 'jpeg') return 'image/jpeg';
  if (extension === 'webp') return 'image/webp';
  return 'image/png';
};

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

type GeneratedVideoCardProps = {
  url: string;
  isSaving: boolean;
  isSharing: boolean;
  onSave: () => void;
  onShare: () => void;
  onPlaybackError: () => void;
};

const GeneratedVideoCard = ({
  url,
  isSaving,
  isSharing,
  onSave,
  onShare,
  onPlaybackError,
}: GeneratedVideoCardProps) => {
  const player = useVideoPlayer(url, (nextPlayer) => {
    nextPlayer.loop = true;
  });

  React.useEffect(() => {
    const subscription = player.addListener('statusChange', ({ status }) => {
      if (status === 'error') onPlaybackError();
    });
    if (player.status === 'error') onPlaybackError();
    return () => subscription.remove();
  }, [onPlaybackError, player]);

  return (
    <View style={styles.videoCard}>
      <View style={styles.videoHeader}>
        <View>
          <Text style={styles.videoTitle}>Video phối đồ</Text>
        </View>
        <View style={styles.videoReadyBadge}>
          <MaterialCommunityIcons name="check" size={14} color={colors.white} />
          <Text style={styles.videoReadyText}>Hoàn tất</Text>
        </View>
      </View>
      <VideoView
        player={player}
        style={styles.videoPlayer}
        nativeControls
        contentFit="contain"
        allowsFullscreen
        allowsPictureInPicture
      />
      <View style={styles.videoActions}>
        <TouchableOpacity
          style={[styles.videoActionButton, (isSaving || isSharing) && styles.actionButtonDisabled]}
          onPress={onSave}
          disabled={isSaving || isSharing}
          activeOpacity={0.86}
        >
          {isSaving ? <ActivityIndicator color={studioPalette.ink} /> : (
            <><MaterialCommunityIcons name="download-outline" size={21} color={studioPalette.ink} /><Text style={styles.videoActionText}>Lưu video</Text></>
          )}
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.videoActionButton, (isSaving || isSharing) && styles.actionButtonDisabled]}
          onPress={onShare}
          disabled={isSaving || isSharing}
          activeOpacity={0.86}
        >
          {isSharing ? <ActivityIndicator color={studioPalette.ink} /> : (
            <><MaterialCommunityIcons name="share-variant-outline" size={21} color={studioPalette.ink} /><Text style={styles.videoActionText}>Chia sẻ</Text></>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
};

const VirtualTryOnResultScreen = () => {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<RouteProps>();
  const { session, runWithAuth } = useAuth();
  const insets = useSafeAreaInsets();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const [job, setJob] = React.useState<VirtualTryOnJob | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isAddingCart, setIsAddingCart] = React.useState(false);
  const [savingScope, setSavingScope] = React.useState<ImageActionScope | null>(null);
  const [sharingScope, setSharingScope] = React.useState<ImageActionScope | null>(null);
  const [isSavingVideo, setIsSavingVideo] = React.useState(false);
  const [isSharingVideo, setIsSharingVideo] = React.useState(false);
  const [isRetryingVideo, setIsRetryingVideo] = React.useState(false);
  const [playbackFailedVideoUrl, setPlaybackFailedVideoUrl] = React.useState<string | null>(null);
  const [isPreviewVisible, setIsPreviewVisible] = React.useState(false);
  const [activeImageIndex, setActiveImageIndex] = React.useState(0);
  const [previewImages, setPreviewImages] = React.useState<PreviewImage[]>([]);
  const [previewImageIndex, setPreviewImageIndex] = React.useState(0);
  const [previewSyncsResult, setPreviewSyncsResult] = React.useState(false);
  const resultScrollRef = React.useRef<ScrollView>(null);
  const previewScrollRef = React.useRef<ScrollView>(null);
  const imageActionInFlightRef = React.useRef(false);
  const mountedRef = React.useRef(true);
  const jobRef = React.useRef<VirtualTryOnJob | null>(null);
  const activeJobIdRef = React.useRef(route.params.jobId);
  const loadingJobIdsRef = React.useRef(new Set<string>());

  const jobId = route.params.jobId;
  activeJobIdRef.current = jobId;
  const retainedSeedItems = route.params.seedItems;
  const retainedAlternativeSeedItems = route.params.alternativeSeedItems;
  const resultCardWidth = Math.max(1, windowWidth - spacing.lg * 2);
  const footerBottomInset = Math.max(insets.bottom, spacing.md);

  React.useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const applyJob = React.useCallback((incoming: VirtualTryOnJob) => {
    if (!mountedRef.current || activeJobIdRef.current !== incoming._id) return;

    const nextJob = jobRef.current
      ? preferFreshVirtualTryOnJob(jobRef.current, incoming)
      : incoming;
    if (nextJob === jobRef.current) return;

    jobRef.current = nextJob;
    setJob(nextJob);
  }, []);

  const loadJob = React.useCallback(async (showError = false) => {
    if (loadingJobIdsRef.current.has(jobId)) return;
    loadingJobIdsRef.current.add(jobId);

    try {
      const nextJob = await runWithAuth((token) => virtualTryOnApi.getJob(token, jobId));
      applyJob(nextJob);
    } catch (error) {
      if (!mountedRef.current || activeJobIdRef.current !== jobId || !showError) return;
      const message = error instanceof Error ? error.message : 'Không tải được kết quả phối đồ.';
      Alert.alert('Phối đồ', message);
    } finally {
      loadingJobIdsRef.current.delete(jobId);
      if (mountedRef.current && activeJobIdRef.current === jobId) setIsLoading(false);
    }
  }, [applyJob, jobId, runWithAuth]);

  const realtime = useVirtualTryOnRealtime(session?.accessToken, (event) => {
    if (event.jobId !== jobId || !jobRef.current) return;
    applyJob(mergeVirtualTryOnRealtimeEvent(jobRef.current, event));
  });

  React.useEffect(() => {
    jobRef.current = null;
    setJob(null);
    setIsLoading(true);
    setPlaybackFailedVideoUrl(null);
    void loadJob(true);
  }, [jobId, loadJob]);

  React.useEffect(() => {
    realtime.subscribeJob(jobId);
    return () => realtime.unsubscribeJob(jobId);
  }, [jobId, realtime]);

  React.useEffect(() => {
    const timer = setInterval(() => {
      if (!job || job.status === 'queued' || job.status === 'processing') {
        void loadJob();
      }
    }, 2500);
    return () => clearInterval(timer);
  }, [job, loadJob]);

  const resultImageUrls = React.useMemo(() => {
    if (!job) return [];
    return getGeneratedTryOnImageUrls(job);
  }, [job]);
  const activeImageUrl = resultImageUrls[activeImageIndex] || resultImageUrls[0] || '';
  const videoPresentation = React.useMemo(
    () => job ? getTryOnVideoPresentation(job) : { status: 'not_requested' as const, url: null },
    [job],
  );
  const videoProgress = Math.min(100, Math.max(0, Math.round(job?.videoProgress ?? 0)));
  const isVideoPlaybackFailed = Boolean(
    videoPresentation.url && playbackFailedVideoUrl === videoPresentation.url,
  );
  const isVideoPolicyBlocked = job?.videoErrorCode === 'VIDEO_PROVIDER_SAFETY_BLOCKED';
  const handleVideoPlaybackError = React.useCallback(() => {
    if (videoPresentation.url) setPlaybackFailedVideoUrl(videoPresentation.url);
  }, [videoPresentation.url]);
  const resultPreviewImages = React.useMemo<PreviewImage[]>(() => resultImageUrls.map((url, index) => ({
    uri: url,
    label: `Kết quả ${index + 1}`,
    recyclingKey: `${job?._id ?? 'result'}-preview-${index}`,
    resizeMode: 'contain',
  })), [job?._id, resultImageUrls]);

  React.useEffect(() => {
    setActiveImageIndex(0);
  }, [job?._id, resultImageUrls.length]);

  React.useEffect(() => {
    if (!isPreviewVisible) return;
    requestAnimationFrame(() => {
      previewScrollRef.current?.scrollTo({ x: windowWidth * previewImageIndex, animated: false });
    });
  }, [isPreviewVisible, previewImageIndex, windowWidth]);

  const openImagePreview = React.useCallback((
    images: PreviewImage[],
    index = 0,
    syncResult = false,
  ) => {
    const validImages = images.filter((image) => Boolean(image.uri));
    if (!validImages.length) return;

    const clampedIndex = Math.min(Math.max(index, 0), validImages.length - 1);
    setPreviewImages(validImages);
    setPreviewImageIndex(clampedIndex);
    setPreviewSyncsResult(syncResult);
    setIsPreviewVisible(true);
  }, []);

  const openResultPreview = React.useCallback((index: number) => {
    if (!resultPreviewImages.length) return;

    setActiveImageIndex(index);
    openImagePreview(resultPreviewImages, index, true);
  }, [openImagePreview, resultPreviewImages]);

  const openSingleImagePreview = React.useCallback((image: PreviewImage) => {
    openImagePreview([image], 0, false);
  }, [openImagePreview]);

  const downloadImageToCache = async (url: string, imageIndex: number) => {
    if (!url || !job) {
      throw new Error('Không tìm thấy ảnh kết quả.');
    }

    const baseDirectory = FileSystem.cacheDirectory ?? FileSystem.documentDirectory;
    if (!baseDirectory) {
      throw new Error('Không tìm thấy thư mục tạm để lưu ảnh.');
    }

    const extension = getDownloadExtension(url);
    const fileUri = `${baseDirectory}fit-studio-${job._id}-${imageIndex + 1}-${Date.now()}.${extension}`;
    const downloaded = await FileSystem.downloadAsync(url, fileUri);
    if (downloaded.status < 200 || downloaded.status >= 300) {
      throw new Error('Không tải được ảnh kết quả.');
    }

    return {
      uri: downloaded.uri,
      mimeType: getImageMimeType(extension),
    };
  };

  const shareActiveImage = async () => {
    if (!activeImageUrl || !job || savingScope || sharingScope || imageActionInFlightRef.current) return;

    imageActionInFlightRef.current = true;
    setSharingScope('active');
    try {
      const file = await downloadImageToCache(activeImageUrl, activeImageIndex);
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(file.uri, {
          dialogTitle: `Chia sẻ ảnh phối đồ ${activeImageIndex + 1}`,
          mimeType: file.mimeType,
        });
        return;
      }

      await Share.share({
        title: 'Kết quả phối đồ',
        message: `Kết quả phối đồ của tôi: ${activeImageUrl}`,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Không thể chia sẻ ảnh lúc này.';
      Alert.alert('Chia sẻ ảnh', message);
    } finally {
      setSharingScope(null);
      imageActionInFlightRef.current = false;
    }
  };

  const shareAllImages = async () => {
    if (!job || !resultImageUrls.length || savingScope || sharingScope || imageActionInFlightRef.current) return;

    imageActionInFlightRef.current = true;
    setSharingScope('all');
    try {
      const links = resultImageUrls
        .map((url, index) => `Ảnh ${index + 1}: ${url}`)
        .join('\n');
      await Share.share({
        message: resultImageUrls.length > 1
          ? `Bộ ${resultImageUrls.length} ảnh phối đồ của tôi:\n\n${links}`
          : `Ảnh phối đồ của tôi: ${resultImageUrls[0]}`,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Không thể chia sẻ cả bộ ảnh lúc này.';
      Alert.alert('Chia sẻ cả bộ', message);
    } finally {
      setSharingScope(null);
      imageActionInFlightRef.current = false;
    }
  };

  const saveImages = async (scope: ImageActionScope) => {
    if (!job || savingScope || sharingScope || imageActionInFlightRef.current) return;

    const images = scope === 'all'
      ? resultImageUrls.map((url, index) => ({ url, index }))
      : activeImageUrl
        ? [{ url: activeImageUrl, index: activeImageIndex }]
        : [];
    if (!images.length) return;

    imageActionInFlightRef.current = true;
    setSavingScope(scope);
    let savedCount = 0;
    try {
      const permission = await MediaLibrary.requestPermissionsAsync(true);
      if (!permission.granted) {
        Alert.alert('Cần quyền lưu ảnh', 'Cho phép ứng dụng lưu ảnh để tải kết quả về máy.');
        return;
      }

      for (const image of images) {
        const file = await downloadImageToCache(image.url, image.index);
        await MediaLibrary.saveToLibraryAsync(file.uri);
        savedCount += 1;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Không thể lưu ảnh lúc này.';
      const partialMessage = savedCount > 0
        ? `Đã lưu ${savedCount}/${images.length} ảnh. ${message}`
        : message;
      Alert.alert(scope === 'all' ? 'Lưu cả bộ' : 'Lưu ảnh', partialMessage);
    } finally {
      setSavingScope(null);
      imageActionInFlightRef.current = false;
    }
  };

  const downloadVideoToCache = async () => {
    if (!job || !videoPresentation.url) throw new Error('Không tìm thấy video kết quả.');
    const baseDirectory = FileSystem.cacheDirectory ?? FileSystem.documentDirectory;
    if (!baseDirectory) throw new Error('Không tìm thấy thư mục tạm để lưu video.');
    const extension = videoPresentation.url.split('?')[0]?.toLowerCase().endsWith('.webm') ? 'webm' : 'mp4';
    const fileUri = `${baseDirectory}fit-studio-${job._id}-${Date.now()}.${extension}`;
    const downloaded = await FileSystem.downloadAsync(videoPresentation.url, fileUri);
    if (downloaded.status < 200 || downloaded.status >= 300) {
      throw new Error('Không tải được video kết quả.');
    }
    return { uri: downloaded.uri, mimeType: extension === 'webm' ? 'video/webm' : 'video/mp4' };
  };

  const saveVideo = async () => {
    if (!videoPresentation.url || isSavingVideo || isSharingVideo) return;
    setIsSavingVideo(true);
    try {
      const permission = await MediaLibrary.requestPermissionsAsync(true);
      if (!permission.granted) {
        Alert.alert('Cần quyền lưu video', 'Cho phép ứng dụng lưu video vào thư viện thiết bị.');
        return;
      }
      const file = await downloadVideoToCache();
      await MediaLibrary.saveToLibraryAsync(file.uri);
    } catch (error) {
      Alert.alert('Lưu video', error instanceof Error ? error.message : 'Không thể lưu video lúc này.');
    } finally {
      setIsSavingVideo(false);
    }
  };

  const shareVideo = async () => {
    if (!videoPresentation.url || isSavingVideo || isSharingVideo) return;
    setIsSharingVideo(true);
    try {
      const file = await downloadVideoToCache();
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(file.uri, {
          dialogTitle: 'Chia sẻ video phối đồ',
          mimeType: file.mimeType,
        });
      } else {
        await Share.share({ title: 'Video phối đồ', message: videoPresentation.url });
      }
    } catch (error) {
      Alert.alert('Chia sẻ video', error instanceof Error ? error.message : 'Không thể chia sẻ video lúc này.');
    } finally {
      setIsSharingVideo(false);
    }
  };

  const retryVideo = async () => {
    if (!job || isRetryingVideo) return;
    setIsRetryingVideo(true);
    try {
      const nextJob = await runWithAuth((token) => virtualTryOnApi.retryVideo(token, job._id));
      navigation.replace('VirtualTryOnProcessing', {
        jobId: nextJob._id,
        seedItems: retainedSeedItems,
        alternativeSeedItems: retainedAlternativeSeedItems,
      });
    } catch (error) {
      Alert.alert('Thử lại video', error instanceof Error ? error.message : 'Không thể thử lại video lúc này.');
    } finally {
      setIsRetryingVideo(false);
    }
  };

  const addSetToCart = async (navigateTo?: 'cart' | 'checkout') => {
    if (!job) return;
    const itemWithoutSize = job.selectedItems.find((item) => !item.size);
    if (itemWithoutSize) {
      Alert.alert('Chọn kích cỡ', `Sản phẩm ${itemWithoutSize.nameSnapshot} chưa có kích cỡ để thêm vào giỏ.`);
      return;
    }

    setIsAddingCart(true);
    try {
      const addedCartItemIds = await runWithAuth(async (token) => {
        await cartApi.selectAll(token, false);
        const cartItemIds: string[] = [];

        for (const item of job.selectedItems) {
          const nextCart = await cartApi.addItem(token, {
            productId: item.productId,
            variantId: item.variantId,
            colorVariantId: item.colorVariantId,
            size: item.size!,
            quantity: 1,
            isSelected: true,
            replaceQuantity: true,
          });
          const cartItemId = findCartItemIdForTryOnItem(nextCart, item);

          if (!cartItemId) {
            throw new Error('Chưa xác định được sản phẩm vừa thêm vào giỏ. Bạn thử lại nha.');
          }

          if (!cartItemIds.includes(cartItemId)) {
            cartItemIds.push(cartItemId);
          }
        }

        return cartItemIds;
      });

      if (navigateTo === 'checkout') {
        navigation.navigate('Checkout', { cartItemIds: addedCartItemIds });
      } else {
        Alert.alert('Đã thêm vào giỏ', 'Toàn bộ sản phẩm trong bộ phối đã được thêm vào giỏ hàng.', [
          { text: 'Ở lại' },
          { text: 'Xem giỏ', onPress: () => navigation.navigate('Cart', { selectionSource: 'virtualTryOn' }) },
        ]);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Không thể thêm bộ phối vào giỏ.';
      Alert.alert('Giỏ hàng', message);
    } finally {
      setIsAddingCart(false);
    }
  };

  const handleResultScroll = (x: number) => {
    const nextIndex = Math.round(x / resultCardWidth);
    setActiveImageIndex(Math.min(Math.max(nextIndex, 0), Math.max(resultImageUrls.length - 1, 0)));
  };

  const handlePreviewScroll = (x: number) => {
    const nextIndex = Math.round(x / windowWidth);
    const clampedIndex = Math.min(Math.max(nextIndex, 0), Math.max(previewImages.length - 1, 0));
    setPreviewImageIndex(clampedIndex);

    if (previewSyncsResult) {
      setActiveImageIndex(clampedIndex);
      resultScrollRef.current?.scrollTo({ x: resultCardWidth * clampedIndex, animated: false });
    }
  };

  const resumeSeedItems = React.useMemo<TryOnSeedItem[]>(() => {
    if (retainedSeedItems?.length) return retainedSeedItems;
    return job?.selectedItems.map(selectedItemToSeed) ?? [];
  }, [job?.selectedItems, retainedSeedItems]);
  const activeSelectedKeys = React.useMemo(
    () => new Set((job?.selectedItems ?? []).map(getSeedComparableKey)),
    [job?.selectedItems],
  );
  const waitingSeedItems = React.useMemo(
    () => resumeSeedItems.filter((item) => !activeSelectedKeys.has(getSeedComparableKey(item))),
    [activeSelectedKeys, resumeSeedItems],
  );
  const activeSeedItems = React.useMemo(
    () => resumeSeedItems.filter((item) => activeSelectedKeys.has(getSeedComparableKey(item))),
    [activeSelectedKeys, resumeSeedItems],
  );
  const waitingSeedCount = waitingSeedItems.length;
  const nextWaitingSeedItem = waitingSeedItems[0];
  const preferredResumeSeedItems = React.useMemo(() => {
    if (!nextWaitingSeedItem) return waitingSeedItems;
    const nextKey = getSeedComparableKey(nextWaitingSeedItem);
    return [
      nextWaitingSeedItem,
      ...waitingSeedItems.filter((item) => getSeedComparableKey(item) !== nextKey),
    ];
  }, [nextWaitingSeedItem, waitingSeedItems]);
  const resumeAlternativeSeedItems = React.useMemo<TryOnSeedItem[]>(() => {
    const merged = [...activeSeedItems];
    if (retainedAlternativeSeedItems?.length) {
      const seen = new Set(merged.map(getSeedComparableKey));
      for (const item of retainedAlternativeSeedItems) {
        const key = getSeedComparableKey(item);
        if (!seen.has(key)) {
          merged.push(item);
          seen.add(key);
        }
      }
    }
    return merged;
  }, [activeSeedItems, retainedAlternativeSeedItems]);
  const hasResumeQueue = waitingSeedItems.length > 0;

  const resumeBuilder = () => {
    if (!job) return;

    navigation.navigate('VirtualTryOnBuilder', {
      assetId: job.sourceAsset?._id,
      imageUrl: job.sourceImageUrl,
      seedItems: hasResumeQueue ? preferredResumeSeedItems : undefined,
      alternativeSeedItems: hasResumeQueue && resumeAlternativeSeedItems.length
        ? resumeAlternativeSeedItems
        : undefined,
      entryPoint: 'builder',
    });
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerButton} onPress={() => navigation.goBack()} activeOpacity={0.8}>
          <MaterialCommunityIcons name="arrow-left" size={25} color={colors.white} />
        </TouchableOpacity>
        <View style={styles.headerCopy}>
          <Text style={styles.headerTitle}>Kết quả</Text>
        </View>
        <TouchableOpacity
          style={styles.headerButton}
          onPress={() => navigation.navigate('VirtualTryOnHome', hasResumeQueue ? {
            entryPoint: 'builder',
            seedItems: preferredResumeSeedItems,
            alternativeSeedItems: resumeAlternativeSeedItems.length ? resumeAlternativeSeedItems : undefined,
          } : undefined)}
          activeOpacity={0.8}
        >
          <MaterialCommunityIcons name="home-outline" size={23} color={colors.white} />
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={colors.brand} />
        </View>
      ) : job ? (
        <>
          <ScrollView
            style={styles.content}
            contentContainerStyle={[styles.scrollContent, { paddingBottom: 80 + footerBottomInset }]}
            showsVerticalScrollIndicator={false}
          >
            {job.sourceImageUrl && activeImageUrl ? (
              <View style={styles.transformationCard}>
                <Text style={styles.transformationTitle}>Ảnh gốc → Kết quả</Text>
                <View style={styles.transformationFlow}>
                  <View style={styles.transformationStage}>
                    <TouchableOpacity
                      style={styles.transformationImageWrap}
                      onPress={() => openSingleImagePreview({
                        uri: job.sourceImageUrl,
                        label: 'Ảnh gốc',
                        recyclingKey: `${job._id}-source-preview`,
                        resizeMode: 'contain',
                      })}
                      activeOpacity={0.9}
                    >
                      <RemoteImage
                        uri={job.sourceImageUrl}
                        style={styles.transformationImage}
                        recyclingKey={`${job._id}-source-compare`}
                        resizeMode="contain"
                      />
                      <View style={styles.imageExpandBadge}>
                        <MaterialCommunityIcons name="fullscreen" size={16} color={colors.white} />
                      </View>
                    </TouchableOpacity>
                    <Text style={styles.transformationStageLabel}>Ảnh gốc</Text>
                  </View>

                  <View style={styles.transformationProcess}>
                    <MaterialCommunityIcons name="arrow-right" size={24} color="#BFD8E6" />
                  </View>

                  <View style={styles.transformationStage}>
                    <TouchableOpacity
                      style={[styles.transformationImageWrap, styles.transformationResultWrap]}
                      onPress={() => openResultPreview(activeImageIndex)}
                      activeOpacity={0.9}
                    >
                      <RemoteImage
                        uri={activeImageUrl}
                        style={styles.transformationImage}
                        recyclingKey={`${job._id}-result-compare-${activeImageIndex}`}
                        resizeMode="contain"
                      />
                      <View style={styles.imageExpandBadge}>
                        <MaterialCommunityIcons name="fullscreen" size={16} color={colors.white} />
                      </View>
                    </TouchableOpacity>
                    <Text style={styles.transformationStageLabel}>Kết quả {activeImageIndex + 1}</Text>
                  </View>
                </View>
              </View>
            ) : null}

            <View style={styles.resultSectionHeader}>
              <View style={styles.resultSectionCopy}>
                <Text style={styles.resultSectionTitle}>Ảnh phối đồ</Text>
              </View>
              <View style={styles.resultSectionCounter}>
                <Text style={styles.resultSectionCounterText}>
                  {resultImageUrls.length ? `${activeImageIndex + 1}/${resultImageUrls.length}` : '0/0'}
                </Text>
              </View>
            </View>

            <View style={styles.resultCarousel}>
              <ScrollView
                ref={resultScrollRef}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                snapToInterval={resultCardWidth}
                decelerationRate="fast"
                onMomentumScrollEnd={(event) => handleResultScroll(event.nativeEvent.contentOffset.x)}
              >
                {resultImageUrls.length ? resultImageUrls.map((url, index) => (
                  <TouchableOpacity
                    key={`${url}-${index}`}
                    style={[styles.resultImageWrap, { width: resultCardWidth }]}
                    onPress={() => openResultPreview(index)}
                    activeOpacity={0.92}
                  >
                    <RemoteImage
                      uri={url}
                      style={styles.resultImage}
                      recyclingKey={`${job._id}-result-${index}`}
                      resizeMode="contain"
                    />
                    <View style={styles.resultOverlay}>
                      <View style={styles.contextBadge}>
                        <MaterialCommunityIcons name="map-marker-radius-outline" size={17} color={studioPalette.ink} />
                        <Text style={styles.contextText}>{contextPresetLabel(job.contextPreset) || 'Phối đồ'}</Text>
                      </View>
                      {resultImageUrls.length ? (
                        <View style={styles.mockBadge}>
                          <Text style={styles.mockText}>{index + 1}/{resultImageUrls.length}</Text>
                        </View>
                      ) : job.provider === 'mock' ? (
                        <View style={styles.mockBadge}>
                          <Text style={styles.mockText}>Ảnh mẫu</Text>
                        </View>
                      ) : null}
                    </View>
                  </TouchableOpacity>
                )) : (
                  <View style={[styles.resultImageWrap, { width: resultCardWidth }]}>
                    <View style={styles.imagePlaceholder}>
                      <MaterialCommunityIcons name="image-outline" size={48} color={colors.brand} />
                    </View>
                  </View>
                )}
              </ScrollView>

              {resultImageUrls.length > 1 ? (
                <>
                  <View style={styles.resultDots}>
                    {resultImageUrls.map((url, index) => (
                      <View
                        key={`dot-${url}-${index}`}
                        style={[styles.resultDot, activeImageIndex === index && styles.resultDotActive]}
                      />
                    ))}
                  </View>
                  <View style={styles.resultThumbRow}>
                    {resultImageUrls.map((url, index) => (
                      <TouchableOpacity
                        key={`thumb-${url}-${index}`}
                        style={[styles.resultThumbButton, activeImageIndex === index && styles.resultThumbButtonActive]}
                        onPress={() => {
                          setActiveImageIndex(index);
                          resultScrollRef.current?.scrollTo({ x: resultCardWidth * index, animated: true });
                        }}
                        activeOpacity={0.82}
                      >
                        <RemoteImage
                          uri={url}
                          style={styles.resultThumbImage}
                          recyclingKey={`${job._id}-thumb-${index}`}
                          resizeMode="cover"
                        />
                      </TouchableOpacity>
                    ))}
                  </View>
                </>
              ) : null}
            </View>

            <View style={styles.resultActions}>
              <View style={styles.actionGroup}>
                <View style={styles.actionRow}>
                  <TouchableOpacity
                    style={[styles.actionButton, (!resultImageUrls.length || savingScope || sharingScope) && styles.actionButtonDisabled]}
                    onPress={() => void saveImages('all')}
                    disabled={!resultImageUrls.length || Boolean(savingScope || sharingScope)}
                    activeOpacity={0.86}
                  >
                    {savingScope === 'all' ? (
                      <ActivityIndicator color={studioPalette.ink} />
                    ) : (
                      <>
                        <MaterialCommunityIcons name="download-multiple" size={24} color={studioPalette.ink} />
                        <Text style={styles.actionText}>Lưu tất cả</Text>
                      </>
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.actionButton, (!resultImageUrls.length || savingScope || sharingScope) && styles.actionButtonDisabled]}
                    onPress={shareAllImages}
                    disabled={!resultImageUrls.length || Boolean(savingScope || sharingScope)}
                    activeOpacity={0.86}
                  >
                    {sharingScope === 'all' ? (
                      <ActivityIndicator color={studioPalette.ink} />
                    ) : (
                      <>
                        <MaterialCommunityIcons name="share-all-outline" size={24} color={studioPalette.ink} />
                        <Text style={styles.actionText}>Chia sẻ tất cả</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            </View>

            {videoPresentation.status === 'succeeded' && videoPresentation.url && !isVideoPlaybackFailed ? (
              <GeneratedVideoCard
                url={videoPresentation.url}
                isSaving={isSavingVideo}
                isSharing={isSharingVideo}
                onSave={() => void saveVideo()}
                onShare={() => void shareVideo()}
                onPlaybackError={handleVideoPlaybackError}
              />
            ) : videoPresentation.status === 'pending' ? (
              <View style={styles.videoPendingCard}>
                <View style={styles.videoPendingIcon}>
                  <ActivityIndicator color={studioPalette.primary} />
                </View>
                <View style={styles.videoPendingCopy}>
                  <Text style={styles.videoPendingTitle}>Video đang được tạo</Text>
                  <Text style={styles.videoPendingText}>Bạn có thể dùng bộ ảnh ngay.</Text>
                  <View style={styles.videoPendingProgressTrack}>
                    <View style={[styles.videoPendingProgressFill, { width: `${Math.max(6, videoProgress)}%` }]} />
                  </View>
                  <Text style={styles.videoPendingProgressText}>{videoProgress}%</Text>
                </View>
              </View>
            ) : isVideoPlaybackFailed || videoPresentation.status === 'failed' || videoPresentation.status === 'canceled' ? (
              <View style={styles.videoFailureCard}>
                <View style={styles.videoFailureIcon}>
                  <MaterialCommunityIcons name="movie-remove-outline" size={28} color="#B42318" />
                </View>
                <View style={styles.videoFailureCopy}>
                  <Text style={styles.videoFailureTitle}>
                    {isVideoPlaybackFailed
                      ? 'Không phát được video'
                      : isVideoPolicyBlocked
                        ? 'Chưa thể tạo video này'
                        : videoPresentation.status === 'canceled' ? 'Đã hủy tạo video' : 'Chưa tạo được video'}
                  </Text>
                  <Text style={styles.videoFailureText}>
                    {isVideoPlaybackFailed
                      ? 'Bộ ảnh vẫn dùng bình thường.'
                      : job.videoErrorMessage || 'Bộ ảnh vẫn được giữ lại.'}
                  </Text>
                </View>
                {!isVideoPolicyBlocked ? (
                  <TouchableOpacity
                    style={[styles.videoRetryButton, isRetryingVideo && styles.actionButtonDisabled]}
                    onPress={() => {
                      if (isVideoPlaybackFailed) {
                        setPlaybackFailedVideoUrl(null);
                        return;
                      }
                      void retryVideo();
                    }}
                    disabled={isRetryingVideo}
                    activeOpacity={0.86}
                  >
                    {isRetryingVideo ? <ActivityIndicator color={colors.white} /> : (
                      <>
                        <MaterialCommunityIcons name="reload" size={19} color={colors.white} />
                        <Text style={styles.videoRetryText}>{isVideoPlaybackFailed ? 'Tải lại video' : 'Thử lại video'}</Text>
                      </>
                    )}
                  </TouchableOpacity>
                ) : null}
              </View>
            ) : null}

            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Bộ đồ</Text>
              <Text style={styles.sectionMeta}>{job.selectedItems.length} món</Text>
            </View>
            <View style={styles.itemList}>
              {job.selectedItems.map((item) => (
                <TouchableOpacity
                  key={`${item.productId}-${item.colorVariantId}`}
                  style={styles.itemCard}
                  onPress={() => openSingleImagePreview({
                    uri: item.imageSnapshot,
                    label: tryOnRoleLabel[item.role],
                    recyclingKey: `item-preview-${item.colorVariantId}`,
                    resizeMode: 'contain',
                  })}
                  activeOpacity={0.86}
                >
                  <RemoteImage uri={item.imageSnapshot} style={styles.itemImage} recyclingKey={item.colorVariantId} />
                  <View style={styles.itemCopy}>
                    <Text style={styles.itemIndex}>{tryOnRoleLabel[item.role]}</Text>
                    <Text style={styles.itemName} numberOfLines={2}>{item.nameSnapshot}</Text>
                    <Text style={styles.itemMeta}>
                      {[item.colorSnapshot, item.size].filter(Boolean).join(' / ')}
                    </Text>
                  </View>
                  <Text style={styles.itemPrice}>{formatPrice(item.finalPriceSnapshot)}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.totalCard}>
              <Text style={styles.totalLabel}>Tổng</Text>
              <Text style={styles.totalValue}>{formatPrice(job.totalFinalPrice)}</Text>
            </View>

            {waitingSeedCount > 0 ? (
              <View style={styles.queueResumeCard}>
                <View style={styles.queueResumeLead}>
                  <View style={styles.queueResumeIcon}>
                    <MaterialCommunityIcons name="hanger" size={22} color={studioPalette.primary} />
                  </View>
                  <View style={styles.queueResumeCopy}>
                    <Text style={styles.queueResumeTitle}>Còn {waitingSeedCount} món chờ thử</Text>
                  </View>
                </View>
                <TouchableOpacity style={styles.queueResumeButton} onPress={resumeBuilder} activeOpacity={0.86}>
                  <Text style={styles.queueResumeButtonText}>Tiếp tục phối</Text>
                  <MaterialCommunityIcons name="arrow-right" size={18} color={colors.surface} />
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity style={styles.queueResumeCard} onPress={resumeBuilder} activeOpacity={0.86}>
                <View style={styles.queueResumeLead}>
                  <View style={styles.queueResumeIcon}>
                    <MaterialCommunityIcons name="reload" size={22} color={studioPalette.primary} />
                  </View>
                  <View style={styles.queueResumeCopy}>
                    <Text style={styles.queueResumeTitle}>Phối lại bộ này</Text>
                  </View>
                </View>
                <View style={styles.queueResumeButton}>
                  <Text style={styles.queueResumeButtonText}>Phối lại</Text>
                  <MaterialCommunityIcons name="arrow-right" size={18} color={colors.surface} />
                </View>
              </TouchableOpacity>
            )}
          </ScrollView>

          <View style={[styles.footer, { paddingBottom: footerBottomInset }]}>
            <TouchableOpacity
              style={[styles.cartButton, isAddingCart && styles.cartButtonDisabled]}
              onPress={() => addSetToCart('cart')}
              disabled={isAddingCart}
              activeOpacity={0.86}
            >
              {isAddingCart ? (
                <ActivityIndicator color={studioPalette.primary} />
              ) : (
                <>
                  <MaterialCommunityIcons name="cart-plus" size={21} color={studioPalette.primary} />
                  <Text style={styles.cartButtonText}>Vào giỏ</Text>
                </>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.buyNowButton, isAddingCart && styles.cartButtonDisabled]}
              onPress={() => addSetToCart('checkout')}
              disabled={isAddingCart}
              activeOpacity={0.86}
            >
              {isAddingCart ? null : (
                <>
                  <MaterialCommunityIcons name="credit-card-outline" size={21} color={colors.white} />
                  <View style={styles.buyButtonCopy}>
                    <Text style={styles.buyButtonText}>Thanh toán</Text>
                    <Text style={styles.buyButtonPrice}>{formatPrice(job.totalFinalPrice)}</Text>
                  </View>
                </>
              )}
            </TouchableOpacity>
          </View>
        </>
      ) : (
        <View style={styles.loadingWrap}>
          <Text style={styles.emptyText}>Không tìm thấy kết quả phối đồ.</Text>
        </View>
      )}

      <Modal
        visible={isPreviewVisible}
        animationType="fade"
        transparent
        onRequestClose={() => setIsPreviewVisible(false)}
      >
        <SafeAreaView style={styles.previewModal} edges={['top', 'bottom']}>
          <View style={styles.previewHeader}>
            <View style={styles.previewCounter}>
              <Text style={styles.previewCounterLabel} numberOfLines={1}>
                {previewImages[previewImageIndex]?.label ?? 'Ảnh'}
              </Text>
              <Text style={styles.previewCounterText}>
                {previewImages.length > 1 ? `${previewImageIndex + 1}/${previewImages.length}` : '1/1'}
              </Text>
            </View>
            <View style={styles.previewHeaderActions}>
              {previewSyncsResult ? (
                <>
                  <TouchableOpacity
                    style={[styles.previewActionButton, (!activeImageUrl || savingScope || sharingScope) && styles.previewActionButtonDisabled]}
                    onPress={() => void saveImages('active')}
                    disabled={!activeImageUrl || Boolean(savingScope || sharingScope)}
                    activeOpacity={0.82}
                    accessibilityLabel="Lưu ảnh đang xem"
                  >
                    {savingScope === 'active' ? (
                      <ActivityIndicator color={colors.white} size="small" />
                    ) : (
                      <MaterialCommunityIcons name="download-outline" size={22} color={colors.white} />
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.previewActionButton, (!activeImageUrl || savingScope || sharingScope) && styles.previewActionButtonDisabled]}
                    onPress={shareActiveImage}
                    disabled={!activeImageUrl || Boolean(savingScope || sharingScope)}
                    activeOpacity={0.82}
                    accessibilityLabel="Chia sẻ ảnh đang xem"
                  >
                    {sharingScope === 'active' ? (
                      <ActivityIndicator color={colors.white} size="small" />
                    ) : (
                      <MaterialCommunityIcons name="share-variant-outline" size={22} color={colors.white} />
                    )}
                  </TouchableOpacity>
                </>
              ) : null}
              <TouchableOpacity
                style={styles.previewActionButton}
                onPress={() => setIsPreviewVisible(false)}
                activeOpacity={0.82}
                accessibilityLabel="Đóng ảnh"
              >
                <MaterialCommunityIcons name="close" size={24} color={colors.white} />
              </TouchableOpacity>
            </View>
          </View>
          <ScrollView
            ref={previewScrollRef}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={(event) => handlePreviewScroll(event.nativeEvent.contentOffset.x)}
          >
            {previewImages.map((image, index) => (
              <View key={`${image.recyclingKey}-${index}`} style={[styles.previewSlide, { width: windowWidth, height: windowHeight }]}>
                <RemoteImage
                  uri={image.uri}
                  style={styles.previewImage}
                  recyclingKey={image.recyclingKey}
                  resizeMode={image.resizeMode ?? 'contain'}
                />
              </View>
            ))}
          </ScrollView>
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
  loadingWrap: {
    flex: 1,
    backgroundColor: studioPalette.canvas,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
    backgroundColor: studioPalette.canvas,
  },
  scrollContent: {
    padding: spacing.lg,
    gap: spacing.lg,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  contextBadge: {
    minHeight: 36,
    borderRadius: radii.pill,
    backgroundColor: studioPalette.primaryPale,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  contextText: {
    color: studioPalette.ink,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '900',
  },
  mockBadge: {
    minHeight: 36,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(255,255,255,0.88)',
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mockText: {
    color: studioPalette.ink,
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '900',
  },
  resultSectionHeader: {
    minHeight: 46,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  resultSectionCopy: {
    flex: 1,
    minWidth: 0,
  },
  resultSectionTitle: {
    color: studioPalette.ink,
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '900',
  },
  resultSectionHint: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '700',
    marginTop: 2,
  },
  resultSectionCounter: {
    minWidth: 54,
    minHeight: 34,
    borderRadius: radii.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: studioPalette.primaryPale,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
  },
  resultSectionCounterText: {
    color: studioPalette.primary,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '900',
  },
  resultCarousel: {
    gap: spacing.md,
  },
  resultImageWrap: {
    width: '100%',
    aspectRatio: 3 / 4,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: colors.surface,
    ...shadows.card,
  },
  resultImage: {
    width: '100%',
    height: '100%',
  },
  imagePlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultOverlay: {
    position: 'absolute',
    left: spacing.md,
    right: spacing.md,
    top: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  resultDots: {
    minHeight: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  resultDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: studioPalette.primaryPale,
  },
  resultDotActive: {
    width: 22,
    backgroundColor: studioPalette.primary,
  },
  resultThumbRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  resultThumbButton: {
    flex: 1,
    aspectRatio: 3 / 4,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: studioPalette.line,
    overflow: 'hidden',
    backgroundColor: colors.surface,
  },
  resultThumbButtonActive: {
    borderWidth: 2,
    borderColor: studioPalette.primary,
  },
  resultThumbImage: {
    width: '100%',
    height: '100%',
  },
  transformationCard: {
    borderRadius: radii.md,
    backgroundColor: '#172431',
    padding: spacing.md,
    gap: spacing.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    ...shadows.card,
  },
  transformationHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  transformationHeaderCopy: {
    flex: 1,
    minWidth: 0,
  },
  transformationEyebrow: {
    color: '#BFD8E6',
    fontSize: 10,
    lineHeight: 14,
    fontWeight: '900',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  transformationTitle: {
    color: colors.white,
    fontSize: 18,
    lineHeight: 23,
    fontWeight: '900',
    marginTop: 3,
  },
  transformationBadge: {
    minHeight: 30,
    borderRadius: radii.pill,
    backgroundColor: studioPalette.primary,
    paddingHorizontal: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  transformationBadgeText: {
    color: colors.white,
    fontSize: 10,
    lineHeight: 14,
    fontWeight: '900',
  },
  transformationFlow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  transformationStage: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
    gap: spacing.xs,
  },
  transformationImageWrap: {
    width: '100%',
    aspectRatio: 0.82,
    maxHeight: 138,
    borderRadius: radii.sm,
    backgroundColor: '#F8FBFD',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    overflow: 'hidden',
  },
  transformationImage: {
    width: '100%',
    height: '100%',
  },
  transformationResultWrap: {
    borderColor: '#86B8D3',
    borderWidth: 2,
  },
  transformationStageLabel: {
    color: '#DCEAF1',
    fontSize: 10,
    lineHeight: 14,
    fontWeight: '900',
    textAlign: 'center',
  },
  transformationProcess: {
    width: 54,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },
  transformationProcessIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: studioPalette.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  transformationProcessText: {
    color: '#DCEAF1',
    fontSize: 9,
    lineHeight: 12,
    fontWeight: '900',
    textAlign: 'center',
  },
  transformationItemsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  transformationItemsTitle: {
    color: colors.white,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '900',
  },
  transformationItemsMeta: {
    color: '#BFD8E6',
    fontSize: 10,
    lineHeight: 14,
    fontWeight: '800',
  },
  transformationItemList: {
    gap: spacing.sm,
    paddingRight: spacing.sm,
  },
  transformationItemCard: {
    width: 218,
    borderRadius: radii.sm,
    backgroundColor: 'rgba(255,255,255,0.96)',
    padding: spacing.xs,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    overflow: 'hidden',
  },
  transformationItemImageWrap: {
    width: 70,
    height: 88,
    borderRadius: radii.xs,
    overflow: 'hidden',
    backgroundColor: studioPalette.primarySoft,
  },
  transformationItemImage: {
    width: '100%',
    height: '100%',
  },
  transformationItemCopy: {
    flex: 1,
    minWidth: 0,
    paddingRight: spacing.xs,
  },
  transformationItemIndex: {
    color: studioPalette.primary,
    fontSize: 10,
    lineHeight: 14,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  transformationItemName: {
    color: studioPalette.ink,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '900',
    marginTop: 2,
  },
  transformationItemVariant: {
    color: colors.textMuted,
    fontSize: 10,
    lineHeight: 14,
    fontWeight: '700',
    marginTop: 4,
  },
  imageExpandBadge: {
    position: 'absolute',
    right: spacing.xs,
    top: spacing.xs,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(23,36,49,0.78)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageExpandBadgeSmall: {
    position: 'absolute',
    right: 5,
    top: 5,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(23,36,49,0.76)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  transformationSummary: {
    minHeight: 46,
    borderRadius: radii.sm,
    backgroundColor: 'rgba(255,255,255,0.1)',
    padding: spacing.sm,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  transformationSummaryText: {
    flex: 1,
    minWidth: 0,
    color: '#DCEAF1',
    fontSize: 11,
    lineHeight: 16,
    fontWeight: '700',
  },
  resultActions: {
    gap: spacing.lg,
  },
  actionGroup: {
    gap: spacing.sm,
  },
  actionGroupHeader: {
    minHeight: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  actionGroupTitle: {
    color: colors.text,
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '900',
  },
  actionGroupMeta: {
    color: studioPalette.primary,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '900',
  },
  actionRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  actionButton: {
    flex: 1,
    minHeight: 74,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    borderWidth: 1,
    borderColor: studioPalette.line,
    ...shadows.card,
  },
  actionButtonDisabled: {
    opacity: 0.58,
  },
  actionText: {
    color: studioPalette.ink,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '900',
    textAlign: 'center',
  },
  videoCard: {
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: studioPalette.line,
    padding: spacing.md,
    gap: spacing.md,
    ...shadows.card,
  },
  videoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  videoPendingCard: {
    borderRadius: radii.md,
    backgroundColor: studioPalette.primarySoft,
    borderWidth: 1,
    borderColor: studioPalette.primaryPale,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  videoPendingIcon: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  videoPendingCopy: {
    flex: 1,
    minWidth: 0,
  },
  videoPendingTitle: {
    color: studioPalette.ink,
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '900',
  },
  videoPendingText: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '700',
  },
  videoPendingProgressTrack: {
    height: 7,
    borderRadius: 999,
    backgroundColor: colors.surface,
    overflow: 'hidden',
    marginTop: spacing.sm,
  },
  videoPendingProgressFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: studioPalette.primary,
  },
  videoPendingProgressText: {
    color: studioPalette.primary,
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '900',
    textAlign: 'right',
    marginTop: 3,
  },
  videoTitle: {
    color: studioPalette.ink,
    fontSize: 19,
    lineHeight: 25,
    fontWeight: '900',
  },
  videoHint: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '700',
    marginTop: 2,
  },
  videoReadyBadge: {
    minHeight: 30,
    borderRadius: radii.pill,
    backgroundColor: studioPalette.success,
    paddingHorizontal: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  videoReadyText: {
    color: colors.white,
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '900',
  },
  videoPlayer: {
    width: '100%',
    maxWidth: 315,
    aspectRatio: 9 / 16,
    maxHeight: 560,
    alignSelf: 'center',
    borderRadius: radii.sm,
    backgroundColor: '#101820',
    overflow: 'hidden',
  },
  videoActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  videoActionButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: radii.sm,
    backgroundColor: studioPalette.primarySoft,
    borderWidth: 1,
    borderColor: studioPalette.primaryPale,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  videoActionText: {
    color: studioPalette.ink,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '900',
  },
  videoFailureCard: {
    borderRadius: radii.md,
    backgroundColor: '#FFF6F5',
    borderWidth: 1,
    borderColor: '#FDA29B',
    padding: spacing.md,
    gap: spacing.md,
  },
  videoFailureIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FEE4E2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  videoFailureCopy: {
    gap: 4,
  },
  videoFailureTitle: {
    color: '#7A271A',
    fontSize: 17,
    lineHeight: 23,
    fontWeight: '900',
  },
  videoFailureText: {
    color: '#912018',
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '700',
  },
  videoRetryButton: {
    minHeight: 48,
    borderRadius: radii.sm,
    backgroundColor: studioPalette.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  videoRetryText: {
    color: colors.white,
    fontSize: 14,
    lineHeight: 19,
    fontWeight: '900',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 21,
    lineHeight: 27,
    fontWeight: '900',
  },
  sectionMeta: {
    color: studioPalette.primary,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '900',
  },
  itemList: {
    gap: spacing.sm,
  },
  itemCard: {
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    ...shadows.card,
  },
  itemImage: {
    width: 72,
    height: 72,
    borderRadius: radii.sm,
  },
  itemCopy: {
    flex: 1,
  },
  itemIndex: {
    color: studioPalette.primary,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '900',
  },
  itemName: {
    color: colors.text,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '900',
  },
  itemMeta: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
  },
  itemPrice: {
    color: studioPalette.primary,
    fontSize: 14,
    lineHeight: 19,
    fontWeight: '900',
  },
  totalCard: {
    borderWidth: 1.5,
    borderColor: studioPalette.primaryPale,
    borderRadius: radii.md,
    backgroundColor: studioPalette.primarySoft,
    padding: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  totalLabel: {
    color: colors.text,
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '900',
  },
  totalSubtext: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '700',
    marginTop: 2,
  },
  totalValue: {
    color: studioPalette.primary,
    fontSize: 20,
    lineHeight: 26,
    fontWeight: '900',
  },
  queueResumeCard: {
    borderRadius: radii.md,
    backgroundColor: studioPalette.primarySoft,
    borderWidth: 1,
    borderColor: studioPalette.primaryPale,
    padding: spacing.md,
    gap: spacing.md,
  },
  queueResumeLead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  queueResumeIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  queueResumeCopy: {
    flex: 1,
    minWidth: 0,
  },
  queueResumeTitle: {
    color: studioPalette.ink,
    fontSize: 16,
    lineHeight: 21,
    fontWeight: '900',
  },
  queueResumeText: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
    marginTop: 2,
  },
  queueResumeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    borderRadius: radii.pill,
    backgroundColor: studioPalette.primary,
    paddingVertical: spacing.sm,
  },
  queueResumeButtonText: {
    color: colors.surface,
    fontSize: 14,
    lineHeight: 19,
    fontWeight: '900',
  },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: 'rgba(255,255,255,0.96)',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  tryAgainButton: {
    minHeight: 58,
    borderRadius: radii.md,
    backgroundColor: studioPalette.primarySoft,
    borderWidth: 1,
    borderColor: studioPalette.primaryPale,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  tryAgainText: {
    color: studioPalette.ink,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '900',
  },
  cartButton: {
    flex: 0,
    minWidth: 106,
    paddingHorizontal: spacing.md,
    minHeight: 48,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: studioPalette.primaryPale,
    backgroundColor: studioPalette.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: spacing.xs,
  },
  buyNowButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: radii.sm,
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  cartButtonDisabled: {
    backgroundColor: colors.disabled,
  },
  cartButtonText: {
    color: studioPalette.primary,
    fontSize: 14,
    lineHeight: 19,
    fontWeight: '900',
  },
  buyButtonCopy: {
    minWidth: 0,
    alignItems: 'flex-start',
  },
  buyButtonText: {
    color: colors.white,
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '900',
  },
  buyButtonPrice: {
    color: 'rgba(255,255,255,0.78)',
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '800',
    marginTop: 1,
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '700',
  },
  previewModal: {
    flex: 1,
    backgroundColor: '#05070A',
  },
  previewHeader: {
    position: 'absolute',
    top: spacing.md,
    left: spacing.lg,
    right: spacing.lg,
    zIndex: 2,
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  previewCounter: {
    minHeight: 34,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(255,255,255,0.16)',
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    maxWidth: '72%',
  },
  previewCounterLabel: {
    color: colors.white,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '900',
  },
  previewCounterText: {
    color: 'rgba(255,255,255,0.72)',
    fontSize: 10,
    lineHeight: 13,
    fontWeight: '900',
  },
  previewHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  previewActionButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewActionButtonDisabled: {
    opacity: 0.52,
  },
  previewSlide: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
});

export default VirtualTryOnResultScreen;
