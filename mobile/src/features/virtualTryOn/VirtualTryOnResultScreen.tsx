import React from 'react';
import { ActivityIndicator, Alert, Modal, ScrollView, Share, StyleSheet, Text, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system/legacy';
import * as MediaLibrary from 'expo-media-library';
import * as Sharing from 'expo-sharing';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import type { RootStackParamList } from '../../navigation/AppNavigator';
import { RemoteImage } from '../../components/media/RemoteImage';
import { colors, radii, shadows, spacing } from '../../theme';
import { useAuth } from '../auth/AuthContext';
import { cartApi, type CartResponse } from '../cart/cartApi';
import { virtualTryOnApi } from './virtualTryOnApi';
import type { TryOnSeedItem, TryOnSelectedItem, VirtualTryOnJob } from './virtualTryOn.types';
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

const VirtualTryOnResultScreen = () => {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<RouteProps>();
  const { runWithAuth } = useAuth();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const [job, setJob] = React.useState<VirtualTryOnJob | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isAddingCart, setIsAddingCart] = React.useState(false);
  const [savingScope, setSavingScope] = React.useState<ImageActionScope | null>(null);
  const [sharingScope, setSharingScope] = React.useState<ImageActionScope | null>(null);
  const [isPreviewVisible, setIsPreviewVisible] = React.useState(false);
  const [activeImageIndex, setActiveImageIndex] = React.useState(0);
  const [previewImages, setPreviewImages] = React.useState<PreviewImage[]>([]);
  const [previewImageIndex, setPreviewImageIndex] = React.useState(0);
  const [previewSyncsResult, setPreviewSyncsResult] = React.useState(false);
  const resultScrollRef = React.useRef<ScrollView>(null);
  const previewScrollRef = React.useRef<ScrollView>(null);

  const jobId = route.params.jobId;
  const retainedSeedItems = route.params.seedItems;
  const retainedAlternativeSeedItems = route.params.alternativeSeedItems;
  const resultCardWidth = Math.max(1, windowWidth - spacing.lg * 2);

  React.useEffect(() => {
    let isCurrent = true;
    runWithAuth((token) => virtualTryOnApi.getJob(token, jobId))
      .then((nextJob) => {
        if (isCurrent) setJob(nextJob);
      })
      .catch((error: unknown) => {
        if (!isCurrent) return;
        const message = error instanceof Error ? error.message : 'Không tải được kết quả phối đồ.';
        Alert.alert('Phối đồ ảo', message);
      })
      .finally(() => {
        if (isCurrent) setIsLoading(false);
      });

    return () => { isCurrent = false; };
  }, [jobId, runWithAuth]);

  const fallbackImageUrl = job?.generatedImageUrl || job?.sourceImageUrl || '';
  const resultImageUrls = React.useMemo(() => {
    if (!job) return [];
    if (job.generatedImageUrls?.length) return job.generatedImageUrls;
    return fallbackImageUrl ? [fallbackImageUrl] : [];
  }, [fallbackImageUrl, job]);
  const activeImageUrl = resultImageUrls[activeImageIndex] || resultImageUrls[0] || fallbackImageUrl;
  const resultPreviewImages = React.useMemo<PreviewImage[]>(() => resultImageUrls.map((url, index) => ({
    uri: url,
    label: `Kết quả ${index + 1}`,
    recyclingKey: `${job?._id ?? 'result'}-preview-${index}`,
    resizeMode: job?.generatedImageUrl ? 'contain' : 'cover',
  })), [job?._id, job?.generatedImageUrl, resultImageUrls]);

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
    if (!activeImageUrl || !job || savingScope || sharingScope) return;

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
    }
  };

  const shareAllImages = async () => {
    if (!job || resultImageUrls.length < 2 || savingScope || sharingScope) return;

    setSharingScope('all');
    try {
      const links = resultImageUrls
        .map((url, index) => `Ảnh ${index + 1}: ${url}`)
        .join('\n');
      await Share.share({
        title: 'Bộ ảnh phối đồ',
        message: `Bộ ${resultImageUrls.length} ảnh phối đồ của tôi:\n\n${links}`,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Không thể chia sẻ cả bộ ảnh lúc này.';
      Alert.alert('Chia sẻ cả bộ', message);
    } finally {
      setSharingScope(null);
    }
  };

  const saveImages = async (scope: ImageActionScope) => {
    if (!job || savingScope || sharingScope) return;

    const images = scope === 'all'
      ? resultImageUrls.map((url, index) => ({ url, index }))
      : activeImageUrl
        ? [{ url: activeImageUrl, index: activeImageIndex }]
        : [];
    if (!images.length) return;

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

      Alert.alert(
        scope === 'all' ? 'Đã lưu cả bộ' : 'Đã lưu ảnh',
        scope === 'all'
          ? `${savedCount} ảnh đã được lưu vào thư viện.`
          : `Ảnh ${activeImageIndex + 1} đã được lưu vào thư viện.`,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Không thể lưu ảnh lúc này.';
      const partialMessage = savedCount > 0
        ? `Đã lưu ${savedCount}/${images.length} ảnh. ${message}`
        : message;
      Alert.alert(scope === 'all' ? 'Lưu cả bộ' : 'Lưu ảnh', partialMessage);
    } finally {
      setSavingScope(null);
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
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerButton} onPress={() => navigation.goBack()} activeOpacity={0.8}>
          <MaterialCommunityIcons name="arrow-left" size={25} color={colors.white} />
        </TouchableOpacity>
        <View style={styles.headerCopy}>
          <Text style={styles.headerKicker}>Fit Studio</Text>
          <Text style={styles.headerTitle}>Kết quả phối đồ</Text>
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
          <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            {job.sourceImageUrl && activeImageUrl ? (
              <View style={styles.transformationCard}>
                <View style={styles.transformationHeader}>
                  <View style={styles.transformationHeaderCopy}>
                    <Text style={styles.transformationEyebrow}>Trước · Sau</Text>
                    <Text style={styles.transformationTitle}>Từ ảnh gốc đến bộ phối</Text>
                  </View>
                  <View style={styles.transformationBadge}>
                    <MaterialCommunityIcons name="auto-fix" size={15} color={colors.white} />
                    <Text style={styles.transformationBadgeText}>AI đã phối</Text>
                  </View>
                </View>

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
                        recyclingKey={`${job._id}-source-story`}
                      />
                      <View style={styles.imageExpandBadge}>
                        <MaterialCommunityIcons name="fullscreen" size={16} color={colors.white} />
                      </View>
                    </TouchableOpacity>
                    <Text style={styles.transformationStageLabel}>Ảnh gốc</Text>
                  </View>

                  <View style={styles.transformationProcess}>
                    <View style={styles.transformationProcessIcon}>
                      <MaterialCommunityIcons name="auto-fix" size={20} color={colors.white} />
                    </View>
                    <Text style={styles.transformationProcessText}>AI phối đồ</Text>
                    <MaterialCommunityIcons name="arrow-right" size={20} color="#BFD8E6" />
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
                        recyclingKey={`${job._id}-generated-story-${activeImageIndex}`}
                        resizeMode="contain"
                      />
                      <View style={styles.imageExpandBadge}>
                        <MaterialCommunityIcons name="fullscreen" size={16} color={colors.white} />
                      </View>
                    </TouchableOpacity>
                    <Text style={styles.transformationStageLabel}>Kết quả {activeImageIndex + 1}/{resultImageUrls.length}</Text>
                  </View>
                </View>

                <View style={styles.transformationItemsHeader}>
                  <Text style={styles.transformationItemsTitle}>Các món trong bộ này</Text>
                  <Text style={styles.transformationItemsMeta}>{job.selectedItems.length} món</Text>
                </View>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.transformationItemList}
                >
                  {job.selectedItems.map((item) => (
                    <TouchableOpacity
                      key={`story-${item.productId}-${item.colorVariantId}`}
                      style={styles.transformationItemCard}
                      onPress={() => openSingleImagePreview({
                        uri: item.imageSnapshot,
                        label: tryOnRoleLabel[item.role],
                        recyclingKey: `story-garment-preview-${item.colorVariantId}`,
                        resizeMode: 'contain',
                      })}
                      activeOpacity={0.88}
                    >
                      <View style={styles.transformationItemImageWrap}>
                        <RemoteImage
                          uri={item.imageSnapshot}
                          style={styles.transformationItemImage}
                          recyclingKey={`story-garment-${item.colorVariantId}`}
                        />
                        <View style={styles.imageExpandBadgeSmall}>
                          <MaterialCommunityIcons name="fullscreen" size={13} color={colors.white} />
                        </View>
                      </View>
                      <View style={styles.transformationItemCopy}>
                        <Text style={styles.transformationItemIndex}>{tryOnRoleLabel[item.role]}</Text>
                        <Text style={styles.transformationItemName} numberOfLines={2}>{item.nameSnapshot}</Text>
                        <Text style={styles.transformationItemVariant} numberOfLines={1}>
                          {[item.colorSnapshot, item.size].filter(Boolean).join(' · ')}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                </ScrollView>

                <View style={styles.transformationSummary}>
                  <MaterialCommunityIcons name="check-decagram" size={19} color={studioPalette.success} />
                  <Text style={styles.transformationSummaryText}>
                    AI giữ nguyên dáng người trong ảnh gốc, thay đúng {job.selectedItems.length} món bạn chọn theo màu và size.
                  </Text>
                </View>
              </View>
            ) : null}

            <View style={styles.resultSectionHeader}>
              <View style={styles.resultSectionCopy}>
                <Text style={styles.resultSectionTitle}>Kết quả</Text>
                <Text style={styles.resultSectionHint}>Ảnh phối đồ AI đã sinh</Text>
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
                      resizeMode={job.generatedImageUrl ? 'contain' : 'cover'}
                    />
                    <View style={styles.resultOverlay}>
                      <View style={styles.contextBadge}>
                        <MaterialCommunityIcons name="map-marker-radius-outline" size={17} color={studioPalette.ink} />
                        <Text style={styles.contextText}>{contextPresetLabel(job.contextPreset) || 'Phối đồ'}</Text>
                      </View>
                      {job.generatedImageUrl ? (
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
                <View style={styles.actionGroupHeader}>
                  <Text style={styles.actionGroupTitle}>Ảnh này</Text>
                  <Text style={styles.actionGroupMeta}>
                    {resultImageUrls.length ? `Ảnh ${activeImageIndex + 1}/${resultImageUrls.length}` : 'Chưa có ảnh'}
                  </Text>
                </View>
                <View style={styles.actionRow}>
                  <TouchableOpacity
                    style={[styles.actionButton, (!activeImageUrl || savingScope || sharingScope) && styles.actionButtonDisabled]}
                    onPress={shareActiveImage}
                    disabled={!activeImageUrl || Boolean(savingScope || sharingScope)}
                    activeOpacity={0.86}
                  >
                    {sharingScope === 'active' ? (
                      <ActivityIndicator color={studioPalette.ink} />
                    ) : (
                      <>
                        <MaterialCommunityIcons name="share-variant-outline" size={24} color={studioPalette.ink} />
                        <Text style={styles.actionText}>Chia sẻ</Text>
                      </>
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.actionButton, (!activeImageUrl || savingScope || sharingScope) && styles.actionButtonDisabled]}
                    onPress={() => void saveImages('active')}
                    disabled={!activeImageUrl || Boolean(savingScope || sharingScope)}
                    activeOpacity={0.86}
                  >
                    {savingScope === 'active' ? (
                      <ActivityIndicator color={studioPalette.ink} />
                    ) : (
                      <>
                        <MaterialCommunityIcons name="download-outline" size={24} color={studioPalette.ink} />
                        <Text style={styles.actionText}>Lưu</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              </View>

              {resultImageUrls.length > 1 ? (
                <View style={styles.actionGroup}>
                <View style={styles.actionGroupHeader}>
                  <Text style={styles.actionGroupTitle}>Cả {resultImageUrls.length} ảnh</Text>
                  <Text style={styles.actionGroupMeta}>{resultImageUrls.length} ảnh</Text>
                </View>
                  <View style={styles.actionRow}>
                    <TouchableOpacity
                      style={[styles.actionButton, (savingScope || sharingScope) && styles.actionButtonDisabled]}
                      onPress={() => void saveImages('all')}
                      disabled={Boolean(savingScope || sharingScope)}
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
                      style={[styles.actionButton, (savingScope || sharingScope) && styles.actionButtonDisabled]}
                      onPress={shareAllImages}
                      disabled={Boolean(savingScope || sharingScope)}
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
              ) : null}
            </View>

            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Chi tiết bộ phối</Text>
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
                <View>
                <Text style={styles.totalLabel}>Tổng giá trị</Text>
                <Text style={styles.totalSubtext}>Thêm cả bộ vào giỏ</Text>
              </View>
              <Text style={styles.totalValue}>{formatPrice(job.totalFinalPrice)}</Text>
            </View>

            {waitingSeedCount > 0 ? (
              <View style={styles.queueResumeCard}>
                <View style={styles.queueResumeLead}>
                  <View style={styles.queueResumeIcon}>
                    <MaterialCommunityIcons name="hanger" size={22} color={studioPalette.primary} />
                  </View>
                  <View style={styles.queueResumeCopy}>
                    <Text style={styles.queueResumeTitle}>Phối đồ tiếp theo</Text>
                    <Text style={styles.queueResumeText}>
                      Bạn còn {waitingSeedCount} món chờ thử cùng ảnh này.
                    </Text>
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
                    <Text style={styles.queueResumeTitle}>Phối lại</Text>
                    <Text style={styles.queueResumeText}>
                      Thử lại bộ đồ này hoặc đổi sản phẩm khác trên cùng ảnh người.
                    </Text>
                  </View>
                </View>
                <View style={styles.queueResumeButton}>
                  <Text style={styles.queueResumeButtonText}>Phối lại</Text>
                  <MaterialCommunityIcons name="arrow-right" size={18} color={colors.surface} />
                </View>
              </TouchableOpacity>
            )}
          </ScrollView>

          <View style={styles.footer}>
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
            <TouchableOpacity
              style={styles.previewCloseButton}
              onPress={() => setIsPreviewVisible(false)}
              activeOpacity={0.82}
            >
              <MaterialCommunityIcons name="close" size={24} color={colors.white} />
            </TouchableOpacity>
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
    paddingBottom: 96,
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
    padding: spacing.lg,
    gap: spacing.lg,
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
    paddingBottom: spacing.md,
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
  previewCloseButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
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
