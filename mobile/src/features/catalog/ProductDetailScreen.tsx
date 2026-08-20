import React from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import StorefrontFooter from '../../components/layout/StorefrontFooter';
import { resolveColorSwatch } from '../../components/ui/ColorSwatch';
import { colors, radii, shadows, spacing } from '../../theme';
import type { RootStackParamList } from '../../navigation/AppNavigator';
import { useStaleFocusEffect } from '../../hooks/useStaleFocusEffect';
import { useAuth } from '../auth/AuthContext';
import { cartApi, type CartResponse } from '../cart/cartApi';
import { favoritesApi } from '../favorites/favoritesApi';
import { interactionApi, type InteractionPayload } from '../recommendation/interactionApi';
import { recommendationApi, type RecommendationItem } from '../recommendation/recommendationApi';
import RecommendationRail from '../recommendation/RecommendationRail';
import { useRecommendationImpressions } from '../recommendation/useRecommendationImpressions';
import {
  catalogApi,
  CatalogProductDetail,
  ProductCategoryBreadcrumbItem,
  ProductDetailColor,
  ProductDetailVariant,
} from './catalogApi';
import {
  getAvailableQuantityForSize,
  getFirstAvailableSize,
  getInitialProductSelection,
  getInventoryForSelection,
  getProductDetailErrorMessage,
  isColorAvailable,
  isSizeAvailableForColor,
  isVariantAvailable,
} from './productDetailSelection';
import { readScreenData, writeScreenData } from '../../config/screenDataCache';
import ProductReviewsSection from '../reviews/ProductReviewsSection';
import type { PublicReviewList } from '../reviews/review.types';
import { useTryOnQueue } from '../virtualTryOn/TryOnQueueProvider';
import { inferRole, isFullOutfitProduct } from '../virtualTryOn/virtualTryOnSelection';
import type { TryOnSeedItem } from '../virtualTryOn/virtualTryOn.types';
import { normalizeProductDescription } from './productDescription';

type ProductDetailRouteProp = RouteProp<RootStackParamList, 'ProductDetail'>;
type ProductDetailNavigationProp = StackNavigationProp<RootStackParamList, 'ProductDetail'>;
type IconName = keyof typeof MaterialCommunityIcons.glyphMap;
type ReviewSummary = PublicReviewList['summary'];
type ProductLoadMode = 'loading' | 'refresh' | 'silent';
type SelectionSheetAction = 'cart' | 'buy' | 'tryOn';
type AddCartFeedback = {
  id: number;
  productName: string;
  variantText: string;
  imageUri?: string;
};

type ZoomableProductImageProps = {
  uri: string;
  previousUri?: string;
  nextUri?: string;
  onSwipe: (direction: -1 | 1) => void;
};

const MIN_IMAGE_SCALE = 1;
const MAX_IMAGE_SCALE = 4;

const ZoomableProductImage = ({ uri, previousUri, nextUri, onSwipe }: ZoomableProductImageProps) => {
  const { width: viewportWidth, height: viewportHeight } = useWindowDimensions();
  const scale = useSharedValue(MIN_IMAGE_SCALE);
  const savedScale = useSharedValue(MIN_IMAGE_SCALE);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedTranslateX = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);
  const carouselTranslateX = useSharedValue(0);
  const isChangingImage = useSharedValue(false);

  const pinchGesture = Gesture.Pinch()
    .onUpdate((event) => {
      if (isChangingImage.value) return;
      scale.value = Math.min(MAX_IMAGE_SCALE, Math.max(MIN_IMAGE_SCALE, savedScale.value * event.scale));
    })
    .onEnd(() => {
      if (isChangingImage.value) return;
      savedScale.value = scale.value;

      if (scale.value <= MIN_IMAGE_SCALE) {
        scale.value = withSpring(MIN_IMAGE_SCALE);
        translateX.value = withSpring(0);
        translateY.value = withSpring(0);
        savedTranslateX.value = 0;
        savedTranslateY.value = 0;
        return;
      }

      const maxTranslateX = (viewportWidth * (scale.value - MIN_IMAGE_SCALE)) / 2;
      const maxTranslateY = (viewportHeight * (scale.value - MIN_IMAGE_SCALE)) / 2;
      const nextTranslateX = Math.min(maxTranslateX, Math.max(-maxTranslateX, translateX.value));
      const nextTranslateY = Math.min(maxTranslateY, Math.max(-maxTranslateY, translateY.value));

      translateX.value = withSpring(nextTranslateX);
      translateY.value = withSpring(nextTranslateY);
      savedTranslateX.value = nextTranslateX;
      savedTranslateY.value = nextTranslateY;
    });

  const panGesture = Gesture.Pan()
    .onUpdate((event) => {
      if (isChangingImage.value) return;

      if (scale.value > MIN_IMAGE_SCALE) {
        translateX.value = savedTranslateX.value + event.translationX;
        translateY.value = savedTranslateY.value + event.translationY;
        return;
      }

      const canSwipe = event.translationX < 0 ? Boolean(nextUri) : Boolean(previousUri);
      carouselTranslateX.value = canSwipe ? event.translationX : event.translationX * 0.18;
    })
    .onEnd((event) => {
      if (isChangingImage.value) return;

      if (scale.value <= MIN_IMAGE_SCALE) {
        const direction: -1 | 1 = event.translationX < 0 ? 1 : -1;
        const canSwipe = direction === 1 ? Boolean(nextUri) : Boolean(previousUri);
        const isHorizontalSwipe = Math.abs(event.translationX) > Math.abs(event.translationY);
        const shouldChangeImage = canSwipe && isHorizontalSwipe && (
          Math.abs(event.translationX) >= viewportWidth * 0.18 || Math.abs(event.velocityX) >= 650
        );

        if (shouldChangeImage) {
          isChangingImage.value = true;
          carouselTranslateX.value = withTiming(
            direction === 1 ? -viewportWidth : viewportWidth,
            { duration: 140 },
            (finished) => {
              if (finished) {
                runOnJS(onSwipe)(direction);
                return;
              }

              carouselTranslateX.value = 0;
              isChangingImage.value = false;
            },
          );
        } else {
          carouselTranslateX.value = withSpring(0, { damping: 18, stiffness: 220 });
        }
        return;
      }

      const maxTranslateX = (viewportWidth * (scale.value - MIN_IMAGE_SCALE)) / 2;
      const maxTranslateY = (viewportHeight * (scale.value - MIN_IMAGE_SCALE)) / 2;
      const nextTranslateX = Math.min(maxTranslateX, Math.max(-maxTranslateX, translateX.value));
      const nextTranslateY = Math.min(maxTranslateY, Math.max(-maxTranslateY, translateY.value));

      translateX.value = withSpring(nextTranslateX);
      translateY.value = withSpring(nextTranslateY);
      savedTranslateX.value = nextTranslateX;
      savedTranslateY.value = nextTranslateY;
    });

  const doubleTapGesture = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd((_event, success) => {
      if (!success || isChangingImage.value) return;

      if (scale.value > MIN_IMAGE_SCALE) {
        scale.value = withSpring(MIN_IMAGE_SCALE);
        savedScale.value = MIN_IMAGE_SCALE;
        translateX.value = withSpring(0);
        translateY.value = withSpring(0);
        savedTranslateX.value = 0;
        savedTranslateY.value = 0;
      } else {
        scale.value = withSpring(2.5);
        savedScale.value = 2.5;
      }
    });

  const imageGesture = Gesture.Simultaneous(
    pinchGesture,
    Gesture.Race(doubleTapGesture, panGesture),
  );
  const animatedImageStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));
  const animatedCarouselStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: carouselTranslateX.value }],
  }));

  return (
    <View style={styles.imagePreviewCanvas}>
      <GestureDetector gesture={imageGesture}>
        <Animated.View
          style={[
            styles.imagePreviewTrack,
            { left: -viewportWidth, width: viewportWidth * 3 },
            animatedCarouselStyle,
          ]}
        >
          <View style={[styles.imagePreviewSlide, { width: viewportWidth }]}>
            {previousUri ? (
              <Image source={{ uri: previousUri }} style={styles.imagePreviewImage} resizeMode="contain" />
            ) : null}
          </View>
          <View style={[styles.imagePreviewSlide, { width: viewportWidth }]}>
            <Animated.Image
              source={{ uri }}
              style={[styles.imagePreviewImage, animatedImageStyle]}
              resizeMode="contain"
            />
          </View>
          <View style={[styles.imagePreviewSlide, { width: viewportWidth }]}>
            {nextUri ? (
              <Image source={{ uri: nextUri }} style={styles.imagePreviewImage} resizeMode="contain" />
            ) : null}
          </View>
        </Animated.View>
      </GestureDetector>
    </View>
  );
};

const formatCurrency = (value: number) => {
  return `${Math.round(value).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')}đ`;
};

const isRemoteImage = (value?: string | null) => Boolean(value && /^https?:\/\//i.test(value.trim()));

const findCartItemIdForSelection = (
  cart: CartResponse,
  selection: {
    productId: string;
    variantId: string;
    colorVariantId: string;
    size: string;
  },
) => {
  const normalizedSize = selection.size.trim().toLowerCase();

  return cart.product_list.find((item) => (
    item.productId === selection.productId &&
    item.variantId === selection.variantId &&
    item.colorVariantId === selection.colorVariantId &&
    item.size.trim().toLowerCase() === normalizedSize
  ))?._id;
};

const uniqueStrings = (values: string[]) =>
  Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));

const getImageOptions = (product: CatalogProductDetail) =>
  uniqueStrings([
    product.productImage,
    ...product.gallery,
    ...product.variants.flatMap((variant) => variant.colors.map((color) => color.image)),
  ]);

const getBreadcrumbCategories = (product: CatalogProductDetail): ProductCategoryBreadcrumbItem[] => {
  if (product.categoryBreadcrumb?.length) {
    return product.categoryBreadcrumb;
  }

  if (product.category) {
    return [
      {
        _id: product.category._id,
        name: product.category.name,
        gender: product.category.gender,
      },
    ];
  }

  return [];
};

const getPolicyIcon = (value: string): IconName => {
  return value in MaterialCommunityIcons.glyphMap
    ? (value as IconName)
    : 'shield-check-outline';
};

const getRatingDistribution = (product: CatalogProductDetail) => {
  const existing = product.ratingSummary.distribution;
  const totalFromDistribution = existing.reduce((sum, item) => sum + item.count, 0);

  if (totalFromDistribution > 0) {
    return [...existing].sort((a, b) => b.rating - a.rating);
  }

  const roundedRating = Math.max(1, Math.min(5, Math.round(product.averageRating || 5)));

  return ([5, 4, 3, 2, 1] as const).map((rating) => ({
    rating,
    count: product.reviewCount && rating === roundedRating ? product.reviewCount : 0,
    percent: product.reviewCount && rating === roundedRating ? 100 : 0,
  }));
};

const ProductDetailScreen = () => {
  const navigation = useNavigation<ProductDetailNavigationProp>();
  const route = useRoute<ProductDetailRouteProp>();
  const insets = useSafeAreaInsets();
  const { isAuthenticated, session, runWithAuth } = useAuth();
  const { items: tryOnQueueItems, addItem: addTryOnItem } = useTryOnQueue();
  const { productId } = route.params;
  const productCacheKey = `catalog:detail:${productId}`;
  const initialProductRef = React.useRef(readScreenData<CatalogProductDetail>(productCacheKey));
  const initialSelectionRef = React.useRef(
    initialProductRef.current ? getInitialProductSelection(initialProductRef.current) : null,
  );
  const [product, setProduct] = React.useState<CatalogProductDetail | null>(initialProductRef.current ?? null);
  const [recommendationItems, setRecommendationItems] = React.useState<RecommendationItem[]>([]);
  const [recommendationRequestId, setRecommendationRequestId] = React.useState<string | null>(null);
  const [recommendationAlgorithmVersion, setRecommendationAlgorithmVersion] = React.useState<string>();
  const [isLoading, setIsLoading] = React.useState(!initialProductRef.current);
  const [isRefreshing, setIsRefreshing] = React.useState(false);
  const [isRecommendationLoading, setIsRecommendationLoading] = React.useState(false);
  const [isAddingToCart, setIsAddingToCart] = React.useState(false);
  const [isFavorited, setIsFavorited] = React.useState(false);
  const [isFavoriteLoading, setIsFavoriteLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [selectedVariantId, setSelectedVariantId] = React.useState<string | undefined>(
    initialSelectionRef.current?.variant?._id,
  );
  const [selectedColorId, setSelectedColorId] = React.useState<string | undefined>(
    initialSelectionRef.current?.color?._id,
  );
  const [selectedSize, setSelectedSize] = React.useState<string | undefined>(initialSelectionRef.current?.size);
  const [selectedImage, setSelectedImage] = React.useState<string | undefined>(
    initialSelectionRef.current?.color?.image
      || initialProductRef.current?.gallery[0]
      || initialProductRef.current?.productImage,
  );
  const [quantity, setQuantity] = React.useState(1);
  const [isDescriptionExpanded, setIsDescriptionExpanded] = React.useState(false);
  const [isImagePreviewVisible, setIsImagePreviewVisible] = React.useState(false);
  const [isSelectionSheetVisible, setIsSelectionSheetVisible] = React.useState(false);
  const [selectionSheetAction, setSelectionSheetAction] = React.useState<SelectionSheetAction>('cart');
  const [publicReviewSummary, setPublicReviewSummary] = React.useState<ReviewSummary | null>(null);
  const [addCartFeedback, setAddCartFeedback] = React.useState<AddCartFeedback | null>(null);
  const addCartFeedbackTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const previewThumbnailListRef = React.useRef<FlatList<string>>(null);
  const loadedProductIdRef = React.useRef<string | undefined>(initialProductRef.current?._id);
  const productRequestIdRef = React.useRef(0);

  const clearAddCartFeedbackTimer = React.useCallback(() => {
    if (addCartFeedbackTimerRef.current) {
      clearTimeout(addCartFeedbackTimerRef.current);
      addCartFeedbackTimerRef.current = null;
    }
  }, []);

  const dismissAddCartFeedback = React.useCallback(() => {
    clearAddCartFeedbackTimer();
    setAddCartFeedback(null);
  }, [clearAddCartFeedbackTimer]);

  const showAddCartFeedback = React.useCallback(
    (feedback: Omit<AddCartFeedback, 'id'>) => {
      clearAddCartFeedbackTimer();
      setAddCartFeedback({ ...feedback, id: Date.now() });
      addCartFeedbackTimerRef.current = setTimeout(() => {
        setAddCartFeedback(null);
        addCartFeedbackTimerRef.current = null;
      }, 4500);
    },
    [clearAddCartFeedbackTimer],
  );

  React.useEffect(() => clearAddCartFeedbackTimer, [clearAddCartFeedbackTimer]);

  const initializeSelection = React.useCallback((detail: CatalogProductDetail) => {
    const initialSelection = getInitialProductSelection(detail);

    setSelectedVariantId(initialSelection.variant?._id);
    setSelectedColorId(initialSelection.color?._id);
    setSelectedSize(initialSelection.size);
    setSelectedImage(initialSelection.color?.image || detail.gallery[0] || detail.productImage);
    setQuantity(1);
  }, []);

  const recordInteraction = React.useCallback((payload: InteractionPayload) => {
    if (isAuthenticated) {
      void runWithAuth((accessToken) => interactionApi.recordInteraction(payload, accessToken)).catch(() => undefined);
      return;
    }

    void interactionApi.recordInteraction(payload).catch(() => undefined);
  }, [isAuthenticated, runWithAuth]);

  const recordRecommendationEvent = React.useCallback((item: RecommendationItem, eventType: 'impression' | 'click') => {
    if (!recommendationRequestId) {
      return;
    }

    const payload = {
      requestId: recommendationRequestId,
      eventType,
      context: 'product_detail_similar' as const,
      sourceProductId: productId,
      recommendedProductId: item.product._id,
      algorithmVersion: recommendationAlgorithmVersion,
      score: item.score,
      rank: item.rank,
      reasonCodes: item.reasonCodes,
    };

    if (isAuthenticated) {
      void runWithAuth((accessToken) => recommendationApi.recordEvent(payload, accessToken)).catch(() => undefined);
      return;
    }

    void recommendationApi.recordEvent(payload).catch(() => undefined);
  }, [isAuthenticated, productId, recommendationAlgorithmVersion, recommendationRequestId, runWithAuth]);
  const {
    recommendationSectionRef,
    setRecommendationItemRef,
    checkRecommendationVisibility,
  } = useRecommendationImpressions({
    requestId: recommendationRequestId,
    items: recommendationItems,
    onImpression: (item) => recordRecommendationEvent(item, 'impression'),
  });

  const loadProduct = React.useCallback((mode: ProductLoadMode = 'loading') => {
    let isCurrentRequest = true;
    const controller = new AbortController();
    const requestId = productRequestIdRef.current + 1;
    productRequestIdRef.current = requestId;
    const isCurrent = () => isCurrentRequest && productRequestIdRef.current === requestId;

    if (mode === 'loading') setIsLoading(true);
    if (mode === 'refresh') setIsRefreshing(true);
    if (mode === 'loading') {
      setIsRecommendationLoading(false);
      setError(null);
      setRecommendationItems([]);
      setRecommendationRequestId(null);
      setRecommendationAlgorithmVersion(undefined);
      setIsDescriptionExpanded(false);
      setPublicReviewSummary(null);
    }

    catalogApi
      .getProductById(productId, controller.signal, { forceRefresh: mode !== 'loading' })
      .then((detail) => {
        if (!isCurrent()) return;

        loadedProductIdRef.current = detail._id;
        setProduct(detail);
        writeScreenData(productCacheKey, detail);
        initializeSelection(detail);
        setIsRecommendationLoading(true);

        const recommendationPromise = isAuthenticated
          ? runWithAuth((accessToken) => recommendationApi.getSimilarProducts(detail._id, 10, accessToken))
          : recommendationApi.getSimilarProducts(detail._id, 10);

        recommendationPromise
          .then((response) => {
            if (isCurrent()) {
              setRecommendationItems(response.items);
              setRecommendationRequestId(response.requestId);
              setRecommendationAlgorithmVersion(response.algorithmVersion);
            }
          })
          .catch(() => {
            if (isCurrent()) {
              setRecommendationItems([]);
              setRecommendationRequestId(null);
              setRecommendationAlgorithmVersion(undefined);
            }
          })
          .finally(() => {
            if (isCurrent()) {
              setIsRecommendationLoading(false);
            }
          });
      })
      .catch((err: unknown) => {
        if (!isCurrent()) return;

        if (mode === 'loading') {
          loadedProductIdRef.current = undefined;
          setProduct(null);
          setError(getProductDetailErrorMessage(err));
        }
      })
      .finally(() => {
        if (!isCurrent()) return;
        setIsLoading(false);
        setIsRefreshing(false);
      });

    return () => {
      isCurrentRequest = false;
      productRequestIdRef.current += 1;
      controller.abort();
    };
  }, [initializeSelection, isAuthenticated, productCacheKey, productId, runWithAuth]);

  useStaleFocusEffect(
    () => loadProduct(loadedProductIdRef.current === productId ? 'silent' : 'loading'),
    [loadProduct, productId],
    { cacheScope: productCacheKey, runOnDepsChange: true, staleMs: 60 * 1000 },
  );

  React.useEffect(() => {
    if (!product?._id) {
      return;
    }

    recordInteraction({
      productId: product._id,
      actionType: 'view',
      source: 'product_detail',
      metadata: {
        recommendationRequestId: route.params.recommendationRequestId,
      },
    });
  }, [product?._id, recordInteraction, route.params.recommendationRequestId]);

  const isAuthenticatedRef = React.useRef(isAuthenticated);
  isAuthenticatedRef.current = isAuthenticated;

  React.useEffect(() => {
    let isCurrentRequest = true;

    if (!isAuthenticatedRef.current) {
      setIsFavorited(false);
      setIsFavoriteLoading(false);
      return () => {
        isCurrentRequest = false;
      };
    }

    setIsFavoriteLoading(true);
    runWithAuth((accessToken) => favoritesApi.getStatus(accessToken, productId))
      .then((status) => {
        if (isCurrentRequest) {
          setIsFavorited(status.isFavorited);
        }
      })
      .catch(() => {
        if (isCurrentRequest) {
          setIsFavorited(false);
        }
      })
      .finally(() => {
        if (isCurrentRequest) {
          setIsFavoriteLoading(false);
        }
      });

    return () => {
      isCurrentRequest = false;
    };
  }, [productId, runWithAuth]);

  const selectedVariant = product?.variants.find((variant) => variant._id === selectedVariantId);
  const selectedColor = selectedVariant?.colors.find((color) => color._id === selectedColorId);
  const selectedSizeOption = selectedVariant?.sizes.find((item) => item.size === selectedSize);
  const selectedInventory = getInventoryForSelection(selectedVariant, selectedColorId, selectedSize);
  const selectedAvailableQuantity = selectedSizeOption
    ? getAvailableQuantityForSize(selectedVariant, selectedColorId, selectedSizeOption)
    : selectedInventory?.availableQuantity ?? 0;
  const maxPurchasableQuantity = Math.max(0, selectedAvailableQuantity);
  const hasPurchasableOption = Boolean(
    product?.isAvailable && product.variants.some((variant) => isVariantAvailable(variant)),
  );
  const canCheckout = Boolean(
    product?.isAvailable &&
    selectedVariant?.isActive &&
    selectedColor &&
    selectedSizeOption &&
    isSizeAvailableForColor(selectedVariant, selectedColorId, selectedSizeOption) &&
    maxPurchasableQuantity > 0,
  );
  const isQuantityAtLimit = !canCheckout || quantity >= maxPurchasableQuantity;
  const imageOptions = product ? getImageOptions(product) : [];
  const selectedImageIndex = Math.max(imageOptions.indexOf(selectedImage ?? ''), 0);
  const ratingDistribution = product ? getRatingDistribution(product) : [];
  const productDescription = React.useMemo(
    () => normalizeProductDescription(product?.description),
    [product?.description],
  );
  const handleReviewSummaryChange = React.useCallback((summary: ReviewSummary) => {
    setPublicReviewSummary(summary);
  }, []);

  React.useEffect(() => {
    if (!isImagePreviewVisible || imageOptions.length <= 1) return;

    const frame = requestAnimationFrame(() => {
      previewThumbnailListRef.current?.scrollToIndex({
        index: selectedImageIndex,
        animated: true,
        viewPosition: 0.5,
      });
    });

    return () => cancelAnimationFrame(frame);
  }, [imageOptions.length, isImagePreviewVisible, selectedImageIndex]);

  React.useEffect(() => {
    setQuantity((current) => {
      if (maxPurchasableQuantity <= 0) {
        return 1;
      }

      return Math.max(1, Math.min(maxPurchasableQuantity, current));
    });
  }, [maxPurchasableQuantity]);

  const handleBreadcrumbCategoryPress = (category: ProductCategoryBreadcrumbItem) => {
    navigation.navigate('ProductList', {
      title: category.name,
      categoryId: category._id,
      gender: category.gender,
    });
  };

  const handleVariantPress = (variant: ProductDetailVariant) => {
    const firstColor = variant.colors.find((color) => isColorAvailable(variant, color._id)) ?? variant.colors[0];

    setSelectedVariantId(variant._id);
    setSelectedColorId(firstColor?._id);
    setSelectedSize(getFirstAvailableSize(variant, firstColor?._id));
    setSelectedImage(firstColor?.image || product?.productImage);
    setQuantity(1);
  };

  const handleColorPress = (color: ProductDetailColor) => {
    setSelectedColorId(color._id);
    setSelectedImage(color.image);
    setSelectedSize((currentSize) => {
      const currentSizeOption = selectedVariant?.sizes.find((item) => item.size === currentSize);

      if (currentSizeOption && isSizeAvailableForColor(selectedVariant, color._id, currentSizeOption)) {
        return currentSize;
      }

      return getFirstAvailableSize(selectedVariant, color._id);
    });
    setQuantity(1);
  };

  const handleQuantityChange = (delta: number) => {
    setQuantity((current) => {
      if (maxPurchasableQuantity <= 0) {
        return 1;
      }

      return Math.max(1, Math.min(maxPurchasableQuantity, current + delta));
    });
  };

  const handlePreviewImageChange = (direction: -1 | 1) => {
    const nextIndex = selectedImageIndex + direction;

    if (nextIndex >= 0 && nextIndex < imageOptions.length) {
      setSelectedImage(imageOptions[nextIndex]);
    }
  };

  const heroSwipeGesture = Gesture.Pan()
    .activeOffsetX([-24, 24])
    .failOffsetY([-18, 18])
    .onEnd((event) => {
      const isHorizontal = Math.abs(event.translationX) > Math.abs(event.translationY);
      if (!isHorizontal || (Math.abs(event.translationX) < 48 && Math.abs(event.velocityX) < 500)) return;
      runOnJS(handlePreviewImageChange)(event.translationX < 0 ? 1 : -1);
    });

  const handleOpenSelectionSheet = (action: SelectionSheetAction) => {
    if (!product || !hasPurchasableOption) {
      return;
    }

    dismissAddCartFeedback();

    if (!canCheckout) {
      initializeSelection(product);
    }

    setSelectionSheetAction(action);
    setIsSelectionSheetVisible(true);
  };

  const buildTryOnSeedItem = (): TryOnSeedItem | null => {
    if (!product || !selectedVariant || !selectedColor || !selectedSizeOption || !canCheckout) return null;

    return {
      productId: product._id,
      variantId: selectedVariant._id,
      colorVariantId: selectedColor._id,
      size: selectedSizeOption.size,
      role: inferRole(product),
      isFullOutfit: isFullOutfitProduct(product),
      nameSnapshot: product.name,
      colorSnapshot: selectedColor.color,
      imageSnapshot: selectedColor.image || selectedImage || product.productImage,
    };
  };

  const addSelectionToTryOnQueue = () => {
    const seedItem = buildTryOnSeedItem();
    if (!seedItem) {
      Alert.alert('Chọn sản phẩm', 'Bạn chọn đủ màu và size trước nha.');
      return false;
    }

    const result = addTryOnItem(seedItem);
    if (result === 'full') {
      Alert.alert('Hàng chờ đã đầy', 'Bạn bỏ bớt một món trong phòng phối rồi thử lại nha.');
      return false;
    }

    setIsSelectionSheetVisible(false);
    navigation.navigate('VirtualTryOnHome', {
      entryPoint: 'builder',
      seedItems: result === 'added' ? [...tryOnQueueItems, seedItem] : tryOnQueueItems,
    });
    return true;
  };

  const handleTryOnPress = () => {
    if (!isAuthenticated || !session?.accessToken) {
      navigation.navigate('Login');
      return;
    }

    if (!canCheckout) {
      handleOpenSelectionSheet('tryOn');
      return;
    }

    addSelectionToTryOnQueue();
  };

  React.useEffect(() => {
    if (!route.params.openTryOn || !product || isLoading) return;
    handleOpenSelectionSheet('tryOn');
    navigation.setParams({ openTryOn: undefined });
  }, [isLoading, navigation, product, route.params.openTryOn]);

  const handleCloseSelectionSheet = () => {
    if (!isAddingToCart) {
      setIsSelectionSheetVisible(false);
    }
  };

  const handleSelectionAction = async (action: 'cart' | 'buy'): Promise<boolean> => {
    if (!product || !selectedVariant || !selectedColor || !selectedSizeOption) {
      Alert.alert('Chọn sản phẩm', 'Bạn chọn đủ màu, size và số lượng trước nha.');
      return false;
    }

    if (!canCheckout) {
      Alert.alert('Tạm hết hàng', 'Biến thể này chưa sẵn sàng để mua.');
      return false;
    }

    if (!isAuthenticated || !session?.accessToken) {
      Alert.alert(
        'Cần đăng nhập',
        action === 'buy'
          ? 'Bạn đăng nhập để mua sản phẩm nha.'
          : 'Bạn đăng nhập để thêm sản phẩm vào giỏ nha.',
        [
          { text: 'Để sau', style: 'cancel' },
          {
            text: 'Đăng nhập',
            onPress: () => {
              setIsSelectionSheetVisible(false);
              navigation.navigate('Login');
            },
          },
        ],
      );
      return false;
    }

    try {
      setIsAddingToCart(true);
      const nextCart = await runWithAuth((accessToken) => cartApi.addItem(accessToken, {
        productId: product._id,
        variantId: selectedVariant._id,
        colorVariantId: selectedColor._id,
        size: selectedSizeOption.size,
        quantity,
        isSelected: false,
        replaceQuantity: action === 'buy',
        recommendationRequestId: route.params.recommendationRequestId,
      }));
      const checkoutCartItemId = findCartItemIdForSelection(nextCart, {
        productId: product._id,
        variantId: selectedVariant._id,
        colorVariantId: selectedColor._id,
        size: selectedSizeOption.size,
      });

      if (action === 'buy') {
        if (!checkoutCartItemId) {
          throw new Error('Chưa xác định được sản phẩm vừa thêm vào giỏ. Bạn thử lại nha.');
        }

        navigation.navigate('Checkout', { cartItemIds: [checkoutCartItemId] });
        return true;
      }

      showAddCartFeedback({
        productName: product.name,
        variantText: `${selectedColor.color} · Size ${selectedSizeOption.size} · SL ${quantity}`,
        imageUri: selectedColor.image || selectedImage || product.productImage,
      });
      return true;
    } catch (error) {
      Alert.alert(
        action === 'buy' ? 'Chưa thể mua ngay' : 'Chưa thêm được giỏ hàng',
        error instanceof Error ? error.message : 'Bạn thử lại sau nha.',
      );
      return false;
    } finally {
      setIsAddingToCart(false);
    }

  };

  const handleConfirmSelection = async () => {
    if (selectionSheetAction === 'tryOn') {
      addSelectionToTryOnQueue();
      return;
    }

    const wasCompleted = await handleSelectionAction(selectionSheetAction);

    if (wasCompleted) {
      setIsSelectionSheetVisible(false);
    }
  };

  const handleFavoritePress = async () => {
    if (!isAuthenticated || !session?.accessToken) {
      Alert.alert('Cần đăng nhập', 'Bạn đăng nhập để lưu sản phẩm yêu thích nha.', [
        { text: 'Để sau', style: 'cancel' },
        { text: 'Đăng nhập', onPress: () => navigation.navigate('Login') },
      ]);
      return;
    }

    if (isFavoriteLoading) {
      return;
    }

    const nextIsFavorited = !isFavorited;

    try {
      setIsFavoriteLoading(true);
      setIsFavorited(nextIsFavorited);

      if (nextIsFavorited) {
        await runWithAuth((accessToken) => favoritesApi.addFavorite(accessToken, productId));
      } else {
        await runWithAuth((accessToken) => favoritesApi.removeFavorite(accessToken, productId));
      }
    } catch (favoriteError) {
      setIsFavorited(!nextIsFavorited);
      Alert.alert(
        'Chưa cập nhật yêu thích',
        favoriteError instanceof Error ? favoriteError.message : 'Bạn thử lại sau nha.',
      );
    } finally {
      setIsFavoriteLoading(false);
    }
  };

  const handleRecommendationProductPress = (item: RecommendationItem) => {
    recordRecommendationEvent(item, 'click');

    if (item.product._id) {
      navigation.navigate('ProductDetail', {
        productId: item.product._id,
        recommendationRequestId: recommendationRequestId ?? undefined,
      });
    }
  };

  const renderAddCartFeedback = () => {
    if (!addCartFeedback) {
      return null;
    }

    const imageUri = addCartFeedback.imageUri?.trim();

    return (
      <View style={[styles.addCartFeedback, { bottom: 88 + Math.max(insets.bottom, spacing.sm) }]}>
        <View style={styles.addCartFeedbackIcon}>
          <MaterialCommunityIcons name="check" size={17} color={colors.success} />
        </View>
        <View style={styles.addCartFeedbackImageWrap}>
          {isRemoteImage(imageUri) ? (
            <Image source={{ uri: imageUri! }} style={styles.addCartFeedbackImage} />
          ) : (
            <MaterialCommunityIcons name="tshirt-crew-outline" size={24} color={colors.brand} />
          )}
        </View>
        <View style={styles.addCartFeedbackCopy}>
          <Text style={styles.addCartFeedbackTitle} numberOfLines={1}>
            Đã thêm vào giỏ
          </Text>
          <Text style={styles.addCartFeedbackName} numberOfLines={1}>
            {addCartFeedback.productName}
          </Text>
          <Text style={styles.addCartFeedbackMeta} numberOfLines={1}>
            {addCartFeedback.variantText}
          </Text>
          <View style={styles.addCartFeedbackActions}>
            <TouchableOpacity
              style={styles.addCartFeedbackSecondary}
              onPress={dismissAddCartFeedback}
              activeOpacity={0.82}
            >
              <Text style={styles.addCartFeedbackSecondaryText}>Mua tiếp</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.addCartFeedbackPrimary}
              onPress={() => {
                dismissAddCartFeedback();
                navigation.navigate('Cart', { selectionSource: 'normal' });
              }}
              activeOpacity={0.82}
            >
              <Text style={styles.addCartFeedbackPrimaryText}>Xem giỏ</Text>
            </TouchableOpacity>
          </View>
        </View>
        <TouchableOpacity
          style={styles.addCartFeedbackClose}
          onPress={dismissAddCartFeedback}
          accessibilityLabel="Đóng thông báo"
          activeOpacity={0.82}
        >
          <MaterialCommunityIcons name="close" size={17} color={colors.textMuted} />
        </TouchableOpacity>
      </View>
    );
  };

  const renderProductDescription = () => {
    if (!productDescription) {
      return null;
    }

    const canToggleDescription = productDescription.length > 180;

    return (
      <View style={styles.descriptionSection}>
        <View style={styles.descriptionHeader}>
          <View style={styles.descriptionIcon}>
            <MaterialCommunityIcons name="text-box-check-outline" size={19} color={colors.brand} />
          </View>
          <Text style={styles.descriptionTitle}>Mô tả sản phẩm</Text>
        </View>

        <Text
          style={styles.descriptionText}
          numberOfLines={isDescriptionExpanded ? undefined : 5}
        >
          {productDescription}
        </Text>

        {canToggleDescription ? (
          <TouchableOpacity
            style={styles.descriptionToggle}
            onPress={() => setIsDescriptionExpanded((current) => !current)}
            activeOpacity={0.82}
          >
            <Text style={styles.descriptionToggleText}>
              {isDescriptionExpanded ? 'Thu gọn' : 'Xem thêm'}
            </Text>
            <MaterialCommunityIcons
              name={isDescriptionExpanded ? 'chevron-up' : 'chevron-down'}
              size={17}
              color={colors.brand}
            />
          </TouchableOpacity>
        ) : null}
      </View>
    );
  };

  const renderStars = (rating: number, size = 14) => (
    <View style={styles.starRow}>
      {[1, 2, 3, 4, 5].map((star) => (
        <MaterialCommunityIcons
          key={star}
          name={rating >= star ? 'star' : 'star-outline'}
          size={size}
          color={colors.goldDark}
        />
      ))}
    </View>
  );

  const renderHeader = () => (
    <View style={styles.header}>
      <View style={styles.headerTop}>
        <TouchableOpacity
          style={styles.headerIcon}
          onPress={() => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Home'))}
          accessibilityLabel="Trở về"
          activeOpacity={0.82}
        >
          <MaterialCommunityIcons name="arrow-left" size={23} color={colors.white} />
        </TouchableOpacity>

        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.headerIcon}
            onPress={() => navigation.navigate('Cart', { selectionSource: 'normal' })}
            activeOpacity={0.82}
            accessibilityLabel="Giỏ hàng"
          >
            <MaterialCommunityIcons name="cart-outline" size={22} color={colors.white} />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  const renderSelectionControls = (detail: CatalogProductDetail) => (
    <>
      {detail.variants.length > 1 ? (
        <View style={styles.selectorBlock}>
          <Text style={styles.selectorTitle}>Kiểu dáng</Text>
          <View style={styles.chipWrap}>
            {detail.variants.map((variant) => {
              const isActive = variant._id === selectedVariantId;
              const variantAvailable = isVariantAvailable(variant);

              return (
                <TouchableOpacity
                  key={variant._id}
                  style={[
                    styles.fitChip,
                    isActive && variantAvailable && styles.fitChipActive,
                    !variantAvailable && styles.disabledChip,
                  ]}
                  onPress={() => handleVariantPress(variant)}
                  disabled={!variantAvailable}
                  activeOpacity={0.82}
                  accessibilityRole="button"
                  accessibilityLabel={variant.fitType?.label ?? 'Mặc định'}
                  accessibilityState={{ selected: isActive, disabled: !variantAvailable }}
                >
                  <Text
                    style={[styles.fitChipText, isActive && variantAvailable && styles.fitChipTextActive]}
                    numberOfLines={1}
                  >
                    {variant.fitType?.label ?? 'Mặc định'}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      ) : null}

      <View style={styles.selectorBlock}>
        <Text style={styles.selectorTitle}>Màu sắc</Text>

        <View style={styles.colorChipRow}>
          {selectedVariant?.colors.map((color) => {
            const isActive = color._id === selectedColorId;
            const colorAvailable = isColorAvailable(selectedVariant, color._id);
            const swatchColor = resolveColorSwatch(color.color, color.colorCode).hex;

            return (
              <TouchableOpacity
                key={color._id}
                style={[
                  styles.colorChip,
                  isActive && colorAvailable && styles.colorChipActive,
                  !colorAvailable && styles.disabledChip,
                ]}
                onPress={() => handleColorPress(color)}
                disabled={!colorAvailable}
                activeOpacity={0.78}
                accessibilityRole="button"
                accessibilityLabel={`Chọn màu ${color.color}`}
                accessibilityState={{ selected: isActive, disabled: !colorAvailable }}
              >
                <View style={[styles.colorChipDot, { backgroundColor: swatchColor }]} />
                <View style={styles.colorChipCopy}>
                  <Text
                    style={[styles.colorChipText, isActive && colorAvailable && styles.colorChipTextActive]}
                    numberOfLines={1}
                  >
                    {color.color}
                  </Text>
                </View>
                {isActive && colorAvailable ? (
                  <View style={styles.colorChipStatus}>
                    <MaterialCommunityIcons name="check" size={15} color={colors.brandDark} />
                  </View>
                ) : (
                  <View style={styles.colorChipStatus} />
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      <View style={styles.selectorBlock}>
        <View style={styles.selectorHeader}>
          <Text style={styles.selectorTitle}>Kích thước</Text>
          <TouchableOpacity
            onPress={() => Alert.alert('Hướng dẫn chọn size', 'Bảng size sẽ được nối từ category template ở bước tiếp theo.')}
            activeOpacity={0.82}
          >
            <Text style={styles.sizeGuide}>Hướng dẫn chọn size</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.sizeGrid}>
          {selectedVariant?.sizes.map((sizeOption) => {
            const isActive = sizeOption.size === selectedSize;
            const sizeAvailableQuantity = getAvailableQuantityForSize(selectedVariant, selectedColorId, sizeOption);
            const isAvailable = sizeAvailableQuantity > 0;

            return (
              <TouchableOpacity
                key={sizeOption.size}
                style={[
                  styles.sizeButton,
                  isActive && styles.sizeButtonActive,
                  !isAvailable && styles.disabledChip,
                ]}
                onPress={() => setSelectedSize(sizeOption.size)}
                disabled={!isAvailable}
                activeOpacity={0.82}
                accessibilityRole="button"
                accessibilityLabel={`Size ${sizeOption.size}`}
                accessibilityState={{ selected: isActive, disabled: !isAvailable }}
              >
                <Text style={[styles.sizeButtonText, isActive && styles.sizeButtonTextActive]}>
                  {sizeOption.size}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {selectedSizeOption?.measurements.length ? (
        <View style={styles.measurementPanel}>
          <Text style={styles.measurementTitle}>Thông số size {selectedSizeOption.size}</Text>
          <View style={styles.measurementGrid}>
            {selectedSizeOption.measurements.map((measurement) => (
              <View key={measurement.key} style={styles.measurementItem}>
                <Text style={styles.measurementLabel} numberOfLines={1}>
                  {measurement.label ?? measurement.key}
                </Text>
                <Text style={styles.measurementValue}>
                  {measurement.value}
                  {measurement.unit ? ` ${measurement.unit}` : ''}
                </Text>
              </View>
            ))}
          </View>
        </View>
      ) : null}

      <View style={styles.quantityRow}>
        <Text style={styles.selectorTitle}>Số lượng</Text>
        <View style={styles.stepper}>
          <TouchableOpacity
            style={[styles.stepperButton, quantity === 1 && styles.stepperButtonDisabled]}
            onPress={() => handleQuantityChange(-1)}
            disabled={quantity === 1}
            activeOpacity={0.82}
            accessibilityLabel="Giảm số lượng"
          >
            <MaterialCommunityIcons name="minus" size={18} color={quantity === 1 ? colors.textSubtle : colors.text} />
          </TouchableOpacity>
          <Text style={styles.quantityText}>{quantity}</Text>
          <TouchableOpacity
            style={[styles.stepperButton, isQuantityAtLimit && styles.stepperButtonDisabled]}
            onPress={() => handleQuantityChange(1)}
            disabled={isQuantityAtLimit}
            activeOpacity={0.82}
            accessibilityLabel="Tăng số lượng"
          >
            <MaterialCommunityIcons name="plus" size={18} color={isQuantityAtLimit ? colors.textSubtle : colors.text} />
          </TouchableOpacity>
        </View>
      </View>
    </>
  );

  if (isLoading) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        {renderHeader()}
        <View style={styles.centerState}>
          <ActivityIndicator color={colors.brand} />
          <Text style={styles.centerStateText}>Đang tải chi tiết sản phẩm</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error || !product) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        {renderHeader()}
        <View style={styles.centerState}>
          <MaterialCommunityIcons name="alert-circle-outline" size={34} color={colors.danger} />
          <Text style={styles.centerStateTitle}>Không tải được sản phẩm</Text>
          <Text style={styles.centerStateText}>{error ?? 'Sản phẩm không tồn tại hoặc đã ngừng bán.'}</Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={() => { void loadProduct(); }}
            activeOpacity={0.82}
          >
            <Text style={styles.retryButtonText}>Thử lại</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const breadcrumbCategories = getBreadcrumbCategories(product);
  const realReviewCount = publicReviewSummary?.reviewCount ?? 0;
  const realAverageRating = publicReviewSummary?.averageRating ?? 0;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {renderHeader()}

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={(
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={() => { void loadProduct('refresh'); }}
            colors={[colors.brand]}
            tintColor={colors.brand}
          />
        )}
        onScroll={checkRecommendationVisibility}
        scrollEventThrottle={100}
      >
        <View style={styles.breadcrumb}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.breadcrumbContent}
          >
            <TouchableOpacity onPress={() => navigation.navigate('Home')} activeOpacity={0.82}>
              <Text style={styles.breadcrumbLink}>Trang chủ</Text>
            </TouchableOpacity>

            {breadcrumbCategories.map((category) => (
              <React.Fragment key={category._id}>
                <Text style={styles.breadcrumbSeparator}>/</Text>
                <TouchableOpacity
                  onPress={() => handleBreadcrumbCategoryPress(category)}
                  activeOpacity={0.82}
                >
                  <Text style={styles.breadcrumbLink}>{category.name}</Text>
                </TouchableOpacity>
              </React.Fragment>
            ))}

            <Text style={styles.breadcrumbSeparator}>/</Text>
            <Text style={styles.breadcrumbCurrent} numberOfLines={1}>
              {product.name}
            </Text>
          </ScrollView>
        </View>

        <View style={styles.mediaSection}>
          <View style={styles.heroImageWrap}>
            <GestureDetector gesture={heroSwipeGesture}>
              <TouchableOpacity
                style={styles.heroImagePress}
                onPress={() => setIsImagePreviewVisible(true)}
                disabled={!isRemoteImage(selectedImage)}
                activeOpacity={0.92}
                accessibilityRole="button"
                accessibilityLabel="Xem ảnh sản phẩm toàn màn hình"
              >
                {isRemoteImage(selectedImage) ? (
                  <Image source={{ uri: selectedImage!.trim() }} style={styles.heroImage} resizeMode="cover" />
                ) : (
                  <View style={styles.imagePlaceholder}>
                    <MaterialCommunityIcons name="tshirt-crew-outline" size={54} color={colors.brand} />
                  </View>
                )}
              </TouchableOpacity>
            </GestureDetector>

            <TouchableOpacity
              style={styles.favoriteButton}
              onPress={handleFavoritePress}
              disabled={isFavoriteLoading}
              activeOpacity={0.82}
              accessibilityLabel={isFavorited ? 'Bỏ yêu thích' : 'Yêu thích'}
            >
              {isFavoriteLoading ? (
                <ActivityIndicator size="small" color={colors.coral} />
              ) : (
                <MaterialCommunityIcons
                  name={isFavorited ? 'heart' : 'heart-outline'}
                  size={21}
                  color={isFavorited ? colors.coral : colors.brand}
                />
              )}
            </TouchableOpacity>
          </View>

          {imageOptions.length ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.thumbnailRow}
            >
              {imageOptions.map((image) => {
                const isActive = image === selectedImage;

                return (
                  <TouchableOpacity
                    key={image}
                    style={[styles.thumbnail, isActive && styles.thumbnailActive]}
                    onPress={() => setSelectedImage(image)}
                    activeOpacity={0.82}
                  >
                    {isRemoteImage(image) ? (
                      <Image source={{ uri: image }} style={styles.thumbnailImage} resizeMode="cover" />
                    ) : (
                      <View style={styles.thumbnailPlaceholder} />
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          ) : null}
        </View>

        <View style={styles.productInfo}>
          <View style={styles.productTitleRow}>
            <Text style={styles.productName}>{product.name}</Text>
            {product.isSale ? (
              <View style={styles.saleBadge}>
                <Text style={styles.saleBadgeText}>-{product.discount}%</Text>
              </View>
            ) : null}
          </View>

          <Text style={styles.productMeta} numberOfLines={1}>
            {product.brand?.name ?? 'FASHIONISTA'} {product.category ? `• ${product.category.name}` : ''}
          </Text>

          <View style={styles.priceRow}>
            <Text style={styles.currentPrice}>{formatCurrency(product.finalPrice)}</Text>
            {product.isSale ? (
              <Text style={styles.originalPrice}>{formatCurrency(product.originalPrice)}</Text>
            ) : null}
          </View>

          <View style={styles.quickStats}>
            {realReviewCount > 0 ? (
              <>
                <View style={styles.statItem}>
                  <MaterialCommunityIcons name="star" size={16} color={colors.goldDark} />
                  <Text style={styles.statText}>{realAverageRating.toFixed(1)}</Text>
                </View>
                <View style={styles.statDivider} />
                <Text style={styles.statText}>{realReviewCount} đánh giá</Text>
              </>
            ) : (
              <View style={styles.statItem}>
                <MaterialCommunityIcons name="star-outline" size={16} color={colors.textMuted} />
                <Text style={styles.statText}>Chưa có đánh giá</Text>
              </View>
            )}
            <View style={styles.statDivider} />
            <Text style={styles.statText}>Đã bán {product.soldQuantity}</Text>
          </View>

          <TouchableOpacity
            style={[styles.tryOnCompact, !hasPurchasableOption && styles.tryOnCompactDisabled]}
            onPress={handleTryOnPress}
            disabled={!hasPurchasableOption}
            activeOpacity={0.84}
            accessibilityRole="button"
            accessibilityLabel="Thêm sản phẩm vào hàng chờ phối thử"
          >
            <View style={styles.tryOnCompactIcon}>
              <MaterialCommunityIcons name="hanger" size={20} color={colors.white} />
            </View>
            <View style={styles.tryOnCompactCopy}>
              <Text style={styles.tryOnCompactTitle}>Phối thử</Text>
              <Text style={styles.tryOnCompactText}>Xem món này trên ảnh của bạn</Text>
            </View>
            {tryOnQueueItems.length ? (
              <View style={styles.tryOnQueueCount}>
                <Text style={styles.tryOnQueueCountText}>{tryOnQueueItems.length}</Text>
              </View>
            ) : (
              <MaterialCommunityIcons name="chevron-right" size={20} color={colors.brand} />
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.selectorSection}>
          {renderSelectionControls(product)}
        </View>

        {renderProductDescription()}

        <View style={styles.policyPanel}>
          {product.policies.map((policy) => (
            <View key={`${policy.title}-${policy.icon}`} style={styles.policyItem}>
              <View style={styles.policyIcon}>
                <MaterialCommunityIcons name={getPolicyIcon(policy.icon)} size={18} color={colors.brand} />
              </View>
              <View style={styles.policyCopy}>
                <Text style={styles.policyTitle}>{policy.title}</Text>
                <Text style={styles.policyDescription}>{policy.description}</Text>
              </View>
            </View>
          ))}
        </View>

        <View style={styles.reviewSection}>
          <ProductReviewsSection productId={product._id} onSummaryChange={handleReviewSummaryChange} />
        </View>

        <RecommendationRail
          title="Sản phẩm tương tự"
          subtitle="Những lựa chọn cùng tinh thần với món bạn đang xem"
          items={recommendationItems}
          isLoading={isRecommendationLoading}
          trackingRef={recommendationSectionRef}
          onItemRef={setRecommendationItemRef}
          onProductPress={handleRecommendationProductPress}
        />

        <StorefrontFooter />
      </ScrollView>

      <Modal
        visible={isImagePreviewVisible}
        animationType="fade"
        hardwareAccelerated
        statusBarTranslucent
        presentationStyle="fullScreen"
        onRequestClose={() => setIsImagePreviewVisible(false)}
      >
        <GestureHandlerRootView style={styles.imagePreviewModal}>
          {isImagePreviewVisible && isRemoteImage(selectedImage) ? (
            <ZoomableProductImage
              key={selectedImage}
              uri={selectedImage!.trim()}
              previousUri={imageOptions[selectedImageIndex - 1]}
              nextUri={imageOptions[selectedImageIndex + 1]}
              onSwipe={handlePreviewImageChange}
            />
          ) : null}

          <View style={[styles.imagePreviewHeader, { paddingTop: Math.max(insets.top, spacing.md) }]}>
            <TouchableOpacity
              style={styles.imagePreviewHeaderButton}
              onPress={() => setIsImagePreviewVisible(false)}
              activeOpacity={0.82}
              accessibilityRole="button"
              accessibilityLabel="Đóng ảnh phóng to"
            >
              <MaterialCommunityIcons name="close" size={26} color={colors.white} />
            </TouchableOpacity>
            <View style={styles.imagePreviewHint}>
              <Text style={styles.imagePreviewHintText}>Chụm để phóng to · Chạm hai lần</Text>
              <Text style={styles.imagePreviewCounter}>{selectedImageIndex + 1}/{imageOptions.length}</Text>
            </View>
          </View>

          {imageOptions.length > 1 ? (
            <View
              style={[
                styles.imagePreviewThumbnails,
                { paddingBottom: Math.max(insets.bottom, spacing.sm) },
              ]}
            >
              <FlatList
                ref={previewThumbnailListRef}
                data={imageOptions}
                horizontal
                showsHorizontalScrollIndicator={false}
                keyExtractor={(image) => image}
                contentContainerStyle={styles.imagePreviewThumbnailContent}
                getItemLayout={(_data, index) => ({
                  length: 54 + spacing.sm,
                  offset: (54 + spacing.sm) * index,
                  index,
                })}
                renderItem={({ item: image, index }) => (
                  <TouchableOpacity
                    style={[
                      styles.imagePreviewThumbnail,
                      index === selectedImageIndex && styles.imagePreviewThumbnailActive,
                    ]}
                    onPress={() => setSelectedImage(image)}
                    activeOpacity={0.82}
                    accessibilityRole="button"
                    accessibilityLabel={`Xem ảnh sản phẩm ${index + 1}`}
                  >
                    {isRemoteImage(image) ? (
                      <Image
                        source={{ uri: image }}
                        style={styles.imagePreviewThumbnailImage}
                        resizeMode="cover"
                      />
                    ) : null}
                  </TouchableOpacity>
                )}
              />
            </View>
          ) : null}
        </GestureHandlerRootView>
      </Modal>

      <Modal
        visible={isSelectionSheetVisible}
        transparent
        animationType="slide"
        hardwareAccelerated
        statusBarTranslucent
        onRequestClose={handleCloseSelectionSheet}
      >
        <View style={styles.selectionModalRoot}>
          <Pressable
            style={styles.selectionModalBackdrop}
            onPress={handleCloseSelectionSheet}
            accessibilityRole="button"
            accessibilityLabel="Đóng hộp chọn sản phẩm"
          />
          <View
            style={[styles.selectionSheet, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}
            accessibilityViewIsModal
          >
            <View style={styles.selectionSheetHandle} />
            <View style={styles.selectionSheetHeader}>
              <View style={styles.selectionSheetHeading}>
                <Text style={styles.selectionSheetTitle}>Chọn sản phẩm</Text>
                <Text style={styles.selectionSheetSubtitle}>Chọn màu, kích thước và số lượng</Text>
              </View>
              <TouchableOpacity
                style={styles.selectionSheetClose}
                onPress={handleCloseSelectionSheet}
                disabled={isAddingToCart}
                activeOpacity={0.82}
                accessibilityLabel="Đóng"
              >
                <MaterialCommunityIcons name="close" size={22} color={colors.text} />
              </TouchableOpacity>
            </View>

            <View style={styles.selectionProductSummary}>
              <View style={styles.selectionProductImageWrap}>
                {isRemoteImage(selectedColor?.image || selectedImage || product.productImage) ? (
                  <Image
                    source={{ uri: (selectedColor?.image || selectedImage || product.productImage).trim() }}
                    style={styles.selectionProductImage}
                    resizeMode="cover"
                  />
                ) : (
                  <MaterialCommunityIcons name="tshirt-crew-outline" size={30} color={colors.brand} />
                )}
              </View>
              <View style={styles.selectionProductCopy}>
                <Text style={styles.selectionProductName} numberOfLines={2}>{product.name}</Text>
                <Text style={styles.selectionProductPrice}>
                  {formatCurrency((selectedVariant?.finalPrice ?? product.finalPrice) * quantity)}
                </Text>
                {canCheckout ? (
                  <Text style={styles.selectionProductMeta} numberOfLines={1}>
                    {selectedColor?.color} · Size {selectedSizeOption?.size} · SL {quantity}
                  </Text>
                ) : null}
              </View>
            </View>

            <ScrollView
              style={styles.selectionSheetScroll}
              contentContainerStyle={styles.selectionSheetContent}
              showsVerticalScrollIndicator={false}
              bounces={false}
            >
              {renderSelectionControls(product)}
            </ScrollView>

            <View style={styles.selectionSheetFooter}>
              <TouchableOpacity
                style={[
                  styles.selectionConfirmButton,
                  (!canCheckout || isAddingToCart) && styles.selectionConfirmButtonDisabled,
                ]}
                onPress={() => { void handleConfirmSelection(); }}
                disabled={!canCheckout || isAddingToCart}
                activeOpacity={0.86}
                accessibilityRole="button"
                accessibilityState={{ disabled: !canCheckout || isAddingToCart }}
              >
                {isAddingToCart ? <ActivityIndicator size="small" color={colors.white} /> : (
                  <MaterialCommunityIcons
                    name={selectionSheetAction === 'buy' ? 'flash' : selectionSheetAction === 'tryOn' ? 'hanger' : 'cart-plus'}
                    size={20}
                    color={colors.white}
                  />
                )}
                <Text style={styles.selectionConfirmButtonText}>
                  {isAddingToCart
                    ? selectionSheetAction === 'buy' ? 'Đang chuyển...' : 'Đang thêm...'
                    : selectionSheetAction === 'buy' ? 'Mua ngay' : selectionSheetAction === 'tryOn' ? 'Thêm vào phối' : 'Thêm vào giỏ'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {renderAddCartFeedback()}

      <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, spacing.sm) }]}>
        <Pressable
          style={[
            styles.bottomButton,
            styles.cartCta,
            (!hasPurchasableOption || isAddingToCart) && styles.bottomButtonDisabled,
          ]}
          onPress={() => handleOpenSelectionSheet('cart')}
          disabled={!hasPurchasableOption || isAddingToCart}
        >
          <MaterialCommunityIcons
            name="cart-plus"
            size={19}
            color={hasPurchasableOption && !isAddingToCart ? colors.brand : colors.textSubtle}
          />
          <Text style={[
            styles.cartCtaText,
            (!hasPurchasableOption || isAddingToCart) && styles.bottomButtonTextDisabled,
          ]}>
            Thêm vào giỏ
          </Text>
        </Pressable>

        <Pressable
          style={[
            styles.bottomButton,
            styles.buyCta,
            (!hasPurchasableOption || isAddingToCart) && styles.bottomButtonDisabled,
          ]}
          onPress={() => handleOpenSelectionSheet('buy')}
          disabled={!hasPurchasableOption || isAddingToCart}
        >
          <Text style={[
            styles.buyCtaText,
            (!hasPurchasableOption || isAddingToCart) && styles.bottomButtonTextDisabled,
          ]}>Mua ngay</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    backgroundColor: colors.brand,
  },
  headerTop: {
    minHeight: 52,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    backgroundColor: colors.brand,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  headerActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.xs,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 0,
  },
  breadcrumb: {
    minHeight: 31,
    paddingHorizontal: spacing.md,
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  breadcrumbContent: {
    minHeight: 31,
    alignItems: 'center',
    gap: 6,
    paddingRight: spacing.md,
  },
  breadcrumbLink: {
    color: colors.brand,
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '800',
  },
  breadcrumbSeparator: {
    color: colors.textMuted,
    fontSize: 11,
    lineHeight: 15,
  },
  breadcrumbCurrent: {
    maxWidth: 220,
    color: colors.textMuted,
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '700',
  },
  centerState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xxl,
  },
  centerStateTitle: {
    color: colors.text,
    fontSize: 17,
    lineHeight: 23,
    fontWeight: '800',
    marginTop: spacing.md,
    textAlign: 'center',
  },
  centerStateText: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  retryButton: {
    minHeight: 40,
    borderRadius: radii.xs,
    backgroundColor: colors.brand,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.lg,
  },
  retryButtonText: {
    color: colors.white,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '800',
  },
  mediaSection: {
    backgroundColor: colors.surface,
  },
  heroImageWrap: {
    width: '100%',
    aspectRatio: 0.82,
    backgroundColor: colors.brandSoft,
  },
  heroImagePress: {
    flex: 1,
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  imagePlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  favoriteButton: {
    position: 'absolute',
    right: spacing.md,
    top: spacing.md,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
    ...shadows.card,
  },
  thumbnailRow: {
    minHeight: 78,
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  thumbnail: {
    width: 58,
    height: 58,
    borderRadius: radii.xs,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    backgroundColor: colors.brandSoft,
  },
  thumbnailActive: {
    borderWidth: 2,
    borderColor: colors.brand,
  },
  thumbnailImage: {
    width: '100%',
    height: '100%',
  },
  thumbnailPlaceholder: {
    flex: 1,
    backgroundColor: colors.brandPale,
  },
  productInfo: {
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  productTitleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  productName: {
    flex: 1,
    color: colors.text,
    fontSize: 18,
    lineHeight: 25,
    fontWeight: '800',
  },
  saleBadge: {
    minHeight: 24,
    borderRadius: radii.xs,
    backgroundColor: colors.dangerSoft,
    paddingHorizontal: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saleBadgeText: {
    color: colors.danger,
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '800',
  },
  productMeta: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 5,
  },
  priceRow: {
    minHeight: 38,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.md,
    marginTop: spacing.sm,
  },
  currentPrice: {
    color: colors.brand,
    fontSize: 24,
    lineHeight: 31,
    fontWeight: '900',
  },
  originalPrice: {
    color: colors.textSubtle,
    fontSize: 14,
    lineHeight: 21,
    textDecorationLine: 'line-through',
  },
  quickStats: {
    minHeight: 30,
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  statText: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '700',
  },
  statDivider: {
    width: 1,
    height: 13,
    backgroundColor: colors.borderStrong,
  },
  tryOnCompact: {
    minHeight: 54,
    marginTop: spacing.md,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.brandPale,
    backgroundColor: colors.brandSoft,
    paddingHorizontal: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  tryOnCompactDisabled: {
    opacity: 0.5,
  },
  tryOnCompactIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tryOnCompactCopy: {
    flex: 1,
    minWidth: 0,
  },
  tryOnCompactTitle: {
    color: colors.brand,
    fontSize: 14,
    lineHeight: 19,
    fontWeight: '900',
  },
  tryOnCompactText: {
    color: colors.textMuted,
    fontSize: 11,
    lineHeight: 16,
    fontWeight: '600',
  },
  tryOnQueueCount: {
    minWidth: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.brand,
    paddingHorizontal: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tryOnQueueCountText: {
    color: colors.white,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '900',
  },
  selectorSection: {
    marginTop: spacing.sm,
    padding: spacing.md,
    backgroundColor: colors.surface,
    gap: spacing.lg,
  },
  selectorBlock: {
    gap: spacing.sm,
  },
  selectorHeader: {
    minHeight: 22,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  selectorTitle: {
    color: colors.text,
    fontSize: 14,
    lineHeight: 19,
    fontWeight: '800',
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  fitChip: {
    minHeight: 38,
    borderRadius: radii.xs,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.field,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fitChipActive: {
    backgroundColor: colors.brand,
    borderColor: colors.brand,
  },
  fitChipText: {
    color: colors.text,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '800',
  },
  fitChipTextActive: {
    color: colors.white,
  },
  disabledChip: {
    opacity: 0.45,
  },
  colorChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  colorChip: {
    minWidth: 0,
    minHeight: 44,
    alignSelf: 'flex-start',
    maxWidth: '100%',
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: spacing.sm,
  },
  colorChipActive: {
    borderColor: colors.brand,
    borderWidth: 2,
    backgroundColor: colors.brandSoft,
  },
  colorChipDot: {
    width: 22,
    height: 22,
    flexShrink: 0,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  colorChipCopy: {
    flexShrink: 1,
    minWidth: 0,
  },
  colorChipText: {
    color: colors.textBody,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
  },
  colorChipTextActive: {
    color: colors.brandDark,
    fontWeight: '800',
  },
  colorChipStatus: {
    width: 16,
    height: 16,
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sizeGuide: {
    color: colors.action,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '800',
  },
  sizeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  sizeButton: {
    minWidth: 66,
    minHeight: 48,
    borderRadius: radii.xs,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.field,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
  },
  sizeButtonActive: {
    backgroundColor: colors.brand,
    borderColor: colors.brand,
  },
  sizeButtonText: {
    color: colors.text,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '800',
  },
  sizeButtonTextActive: {
    color: colors.white,
  },
  measurementPanel: {
    borderRadius: radii.sm,
    backgroundColor: colors.brandSoft,
    padding: spacing.md,
  },
  measurementTitle: {
    color: colors.text,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '800',
    marginBottom: spacing.sm,
  },
  measurementGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  measurementItem: {
    minWidth: '30%',
    flexGrow: 1,
    borderRadius: radii.xs,
    backgroundColor: colors.surface,
    padding: spacing.sm,
  },
  measurementLabel: {
    color: colors.textMuted,
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '700',
  },
  measurementValue: {
    color: colors.text,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '900',
    marginTop: 2,
  },
  quantityRow: {
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  stepper: {
    height: 38,
    borderRadius: radii.xs,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.field,
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
  },
  stepperButton: {
    width: 40,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperButtonDisabled: {
    backgroundColor: colors.brandSoft,
  },
  quantityText: {
    minWidth: 40,
    color: colors.text,
    fontSize: 14,
    lineHeight: 19,
    fontWeight: '900',
    textAlign: 'center',
  },
  descriptionSection: {
    marginTop: spacing.sm,
    marginHorizontal: spacing.md,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.md,
    ...shadows.card,
  },
  descriptionHeader: {
    minHeight: 32,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  descriptionIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.brandSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  descriptionTitle: {
    flex: 1,
    color: colors.text,
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '900',
  },
  descriptionText: {
    color: colors.textBody,
    fontSize: 13,
    lineHeight: 21,
    fontWeight: '600',
  },
  descriptionToggle: {
    alignSelf: 'flex-start',
    minHeight: 34,
    marginTop: spacing.md,
    borderRadius: radii.xs,
    backgroundColor: colors.brandSoft,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  descriptionToggleText: {
    color: colors.brand,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '900',
  },
  policyPanel: {
    marginTop: spacing.sm,
    marginHorizontal: spacing.md,
    borderRadius: radii.sm,
    backgroundColor: colors.brandSoft,
    padding: spacing.md,
    gap: spacing.md,
  },
  policyItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  policyIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  policyCopy: {
    flex: 1,
    minWidth: 0,
  },
  policyTitle: {
    color: colors.text,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '800',
  },
  policyDescription: {
    color: colors.textMuted,
    fontSize: 11,
    lineHeight: 16,
    marginTop: 1,
  },
  reviewSection: {
    marginTop: spacing.xl,
    paddingHorizontal: spacing.md,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 17,
    lineHeight: 23,
    fontWeight: '900',
    marginBottom: spacing.md,
  },
  ratingPanel: {
    borderRadius: radii.sm,
    backgroundColor: colors.surface,
    padding: spacing.md,
    flexDirection: 'row',
    gap: spacing.md,
    ...shadows.card,
  },
  ratingScoreBlock: {
    width: 96,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ratingScore: {
    color: colors.text,
    fontSize: 30,
    lineHeight: 36,
    fontWeight: '900',
  },
  starRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 1,
  },
  ratingCount: {
    color: colors.textMuted,
    fontSize: 11,
    lineHeight: 16,
    marginTop: spacing.xs,
  },
  ratingBars: {
    flex: 1,
    minWidth: 0,
    gap: 6,
  },
  ratingBarRow: {
    minHeight: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  ratingBarLabel: {
    width: 9,
    color: colors.textMuted,
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '800',
  },
  ratingTrack: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.brandPale,
    overflow: 'hidden',
  },
  ratingFill: {
    height: '100%',
    borderRadius: 3,
    backgroundColor: colors.brand,
  },
  ratingBarCount: {
    width: 24,
    color: colors.textMuted,
    fontSize: 10,
    lineHeight: 14,
    textAlign: 'right',
  },
  experiencePanel: {
    marginTop: spacing.md,
    borderRadius: radii.sm,
    backgroundColor: colors.surface,
    padding: spacing.md,
    gap: spacing.sm,
  },
  experienceRow: {
    minHeight: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  experienceLabel: {
    color: colors.text,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '800',
  },
  reviewPlaceholder: {
    marginTop: spacing.md,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.lg,
    alignItems: 'center',
  },
  reviewPlaceholderTitle: {
    color: colors.text,
    fontSize: 14,
    lineHeight: 19,
    fontWeight: '900',
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  reviewPlaceholderText: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  imagePreviewModal: {
    flex: 1,
    backgroundColor: '#050505',
  },
  imagePreviewCanvas: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  imagePreviewTrack: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    flexDirection: 'row',
  },
  imagePreviewSlide: {
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  imagePreviewImage: {
    width: '100%',
    height: '100%',
  },
  imagePreviewHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 4,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: spacing.sm,
    backgroundColor: 'rgba(0,0,0,0.42)',
  },
  imagePreviewHeaderButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  imagePreviewHint: {
    flex: 1,
    minWidth: 0,
  },
  imagePreviewHintText: {
    color: colors.white,
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '700',
  },
  imagePreviewCounter: {
    color: 'rgba(255,255,255,0.76)',
    fontSize: 10,
    lineHeight: 14,
    fontWeight: '700',
  },
  imagePreviewThumbnails: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 4,
    paddingTop: spacing.sm,
    backgroundColor: 'rgba(0,0,0,0.42)',
  },
  imagePreviewThumbnailContent: {
    flexGrow: 1,
    justifyContent: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  imagePreviewThumbnail: {
    width: 54,
    height: 54,
    borderRadius: radii.xs,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  imagePreviewThumbnailActive: {
    borderWidth: 2,
    borderColor: colors.white,
  },
  imagePreviewThumbnailImage: {
    width: '100%',
    height: '100%',
  },
  selectionModalRoot: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'transparent',
  },
  selectionModalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.42)',
  },
  selectionSheet: {
    width: '100%',
    maxHeight: '88%',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    backgroundColor: colors.surface,
    overflow: 'hidden',
    ...shadows.card,
    elevation: 16,
  },
  selectionSheetHandle: {
    alignSelf: 'center',
    width: 42,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.borderStrong,
    marginTop: spacing.sm,
  },
  selectionSheetHeader: {
    minHeight: 64,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  selectionSheetHeading: {
    flex: 1,
    minWidth: 0,
  },
  selectionSheetTitle: {
    color: colors.text,
    fontSize: 19,
    lineHeight: 25,
    fontWeight: '900',
  },
  selectionSheetSubtitle: {
    color: colors.textMuted,
    fontSize: 11,
    lineHeight: 16,
    fontWeight: '600',
    marginTop: 1,
  },
  selectionSheetClose: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.field,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectionProductSummary: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
    minHeight: 88,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  selectionProductImageWrap: {
    width: 72,
    height: 82,
    borderRadius: radii.sm,
    backgroundColor: colors.brandSoft,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  selectionProductImage: {
    width: '100%',
    height: '100%',
  },
  selectionProductCopy: {
    flex: 1,
    minWidth: 0,
  },
  selectionProductName: {
    color: colors.text,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '800',
  },
  selectionProductPrice: {
    color: colors.brand,
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '900',
    marginTop: spacing.xs,
  },
  selectionProductMeta: {
    color: colors.textMuted,
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '700',
    marginTop: 2,
  },
  selectionSheetScroll: {
    flexShrink: 1,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  selectionSheetContent: {
    padding: spacing.md,
    gap: spacing.lg,
  },
  selectionSheetFooter: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    backgroundColor: colors.surface,
  },
  selectionConfirmButton: {
    minHeight: 50,
    borderRadius: radii.sm,
    backgroundColor: colors.brand,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  selectionConfirmButtonDisabled: {
    backgroundColor: colors.textSubtle,
  },
  selectionConfirmButtonText: {
    color: colors.white,
    fontSize: 14,
    lineHeight: 19,
    fontWeight: '900',
  },
  addCartFeedback: {
    position: 'absolute',
    left: spacing.md,
    right: spacing.md,
    zIndex: 20,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    ...shadows.card,
    elevation: 8,
  },
  addCartFeedbackIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.successSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addCartFeedbackImageWrap: {
    width: 54,
    height: 54,
    borderRadius: radii.xs,
    backgroundColor: colors.brandSoft,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  addCartFeedbackImage: {
    width: '100%',
    height: '100%',
  },
  addCartFeedbackCopy: {
    flex: 1,
    minWidth: 0,
  },
  addCartFeedbackTitle: {
    color: colors.black,
    fontSize: 14,
    lineHeight: 19,
    fontWeight: '900',
  },
  addCartFeedbackName: {
    color: colors.text,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '800',
    marginTop: 2,
  },
  addCartFeedbackMeta: {
    color: colors.textMuted,
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '700',
    marginTop: 2,
  },
  addCartFeedbackActions: {
    minHeight: 34,
    marginTop: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: spacing.sm,
  },
  addCartFeedbackSecondary: {
    minHeight: 34,
    borderRadius: radii.xs,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addCartFeedbackPrimary: {
    minHeight: 34,
    borderRadius: radii.xs,
    backgroundColor: colors.brand,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addCartFeedbackSecondaryText: {
    color: colors.text,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '900',
  },
  addCartFeedbackPrimaryText: {
    color: colors.white,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '900',
  },
  addCartFeedbackClose: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomBar: {
    minHeight: 76,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
  },
  bottomButton: {
    flex: 1,
    height: 48,
    borderRadius: radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  bottomButtonDisabled: {
    backgroundColor: colors.field,
    borderColor: colors.border,
  },
  cartCta: {
    borderWidth: 1,
    borderColor: colors.brand,
    backgroundColor: colors.surface,
  },
  buyCta: {
    backgroundColor: colors.brand,
  },
  cartCtaText: {
    color: colors.brand,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '900',
  },
  buyCtaText: {
    color: colors.white,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '900',
  },
  bottomButtonTextDisabled: {
    color: colors.textSubtle,
  },
});

export default ProductDetailScreen;
