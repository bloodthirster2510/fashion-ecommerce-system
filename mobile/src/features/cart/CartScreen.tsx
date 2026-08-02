import React from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import StorefrontFooter from '../../components/layout/StorefrontFooter';
import { brandedHeaderStyles, colors, radii, spacing } from '../../theme';
import type { RootStackParamList } from '../../navigation/AppNavigator';
import { resolveFocusRefreshMode, useStaleFocusEffect } from '../../hooks/useStaleFocusEffect';
import { useAuth } from '../auth/AuthContext';
import { cartApi, CartApiError, type CartItem, type CartResponse } from './cartApi';
import { recommendationApi, type RecommendationItem } from '../recommendation/recommendationApi';
import RecommendationRail from '../recommendation/RecommendationRail';
import { useRecommendationImpressions } from '../recommendation/useRecommendationImpressions';
import { TRY_ON_QUEUE_LIMIT } from '../virtualTryOn/virtualTryOn.types';
import { readScreenData, writeScreenData } from '../../config/screenDataCache';

type CartNavigationProp = StackNavigationProp<RootStackParamList, 'Cart'>;
type CartRouteProp = RouteProp<RootStackParamList, 'Cart'>;
type NoticeTone = 'success' | 'error' | 'warning' | 'info';
type CartLoadMode = 'auto' | 'loading' | 'refresh' | 'silent';

type CartNotice = {
  id: number;
  tone: NoticeTone;
  title: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
};

type CartScreenCache = {
  cart: CartResponse;
  recommendationItems: RecommendationItem[];
  recommendationRequestId: string | null;
  recommendationAlgorithmVersion: string | null;
};

const formatCurrency = (value: number) =>
  `${Math.round(value).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')}đ`;

const isRemoteImage = (value?: string | null) => Boolean(value && /^https?:\/\//i.test(value.trim()));

const getErrorMessage = (error: unknown) => {
  if (error instanceof CartApiError && error.status === 409 && error.errorCode === 'QUOTE_CHANGED') {
    return 'Phí giao hàng vừa thay đổi. Mình cần cập nhật lại tổng tiền trước khi đặt hàng.';
  }

  if (error instanceof CartApiError && error.status === 409) {
    return error.message || 'Dữ liệu đơn hàng vừa thay đổi. Bạn kiểm tra lại trước khi tiếp tục.';
  }

  return error instanceof Error ? error.message : 'Bạn thử lại sau nha.';
};

const getItemTitle = (item: CartItem) => item.name || `Sản phẩm ${item.sku}`;

const getStockText = (item: CartItem) => {
  const availableQuantity = item.availableQuantity;

  if (availableQuantity === undefined) {
    return undefined;
  }

  if (availableQuantity <= 0) {
    return 'Hết hàng';
  }

  if (item.quantity > availableQuantity) {
    return `Chỉ còn ${availableQuantity}`;
  }

  if (availableQuantity <= 5) {
    return `Còn ${availableQuantity}`;
  }

  return undefined;
};

const CartScreen = () => {
  const navigation = useNavigation<CartNavigationProp>();
  const route = useRoute<CartRouteProp>();
  const { isAuthenticated, session, runWithAuth } = useAuth();
  const cartAccountScope = session?.user?._id ?? null;
  const cartCacheKey = `cart:${cartAccountScope ?? 'logged-out'}`;
  const initialCartCacheRef = React.useRef(
    cartAccountScope ? readScreenData<CartScreenCache>(cartCacheKey) : undefined,
  );
  const [cart, setCart] = React.useState<CartResponse | null>(initialCartCacheRef.current?.cart ?? null);
  const [cartRecommendationItems, setCartRecommendationItems] = React.useState<RecommendationItem[]>(
    initialCartCacheRef.current?.recommendationItems ?? [],
  );
  const [cartRecommendationRequestId, setCartRecommendationRequestId] = React.useState<string | null>(
    initialCartCacheRef.current?.recommendationRequestId ?? null,
  );
  const [cartRecommendationAlgorithmVersion, setCartRecommendationAlgorithmVersion] = React.useState<string | null>(
    initialCartCacheRef.current?.recommendationAlgorithmVersion ?? null,
  );
  const [isLoading, setIsLoading] = React.useState(!initialCartCacheRef.current);
  const [isRefreshing, setIsRefreshing] = React.useState(false);
  const [pendingItemId, setPendingItemId] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<CartNotice | null>(null);
  const noticeTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const loadedCartTokenRef = React.useRef<string | null>(initialCartCacheRef.current ? cartAccountScope : null);
  const cartRequestSequenceRef = React.useRef(0);
  const shouldKeepSelectionOnFocus = route.params?.selectionSource === 'virtualTryOn';

  const clearNoticeTimer = React.useCallback(() => {
    if (noticeTimeoutRef.current) {
      clearTimeout(noticeTimeoutRef.current);
      noticeTimeoutRef.current = null;
    }
  }, []);

  const dismissNotice = React.useCallback(() => {
    clearNoticeTimer();
    setNotice(null);
  }, [clearNoticeTimer]);

  const showNotice = React.useCallback(
    (nextNotice: Omit<CartNotice, 'id'>, durationMs = 4500) => {
      clearNoticeTimer();
      setNotice({ ...nextNotice, id: Date.now() });

      if (durationMs > 0) {
        noticeTimeoutRef.current = setTimeout(() => {
          setNotice(null);
          noticeTimeoutRef.current = null;
        }, durationMs);
      }
    },
    [clearNoticeTimer],
  );

  React.useEffect(() => clearNoticeTimer, [clearNoticeTimer]);

  React.useEffect(() => {
    if (!cartAccountScope || !cart || loadedCartTokenRef.current !== cartAccountScope) return;
    writeScreenData<CartScreenCache>(cartCacheKey, {
      cart,
      recommendationItems: cartRecommendationItems,
      recommendationRequestId: cartRecommendationRequestId,
      recommendationAlgorithmVersion: cartRecommendationAlgorithmVersion,
    });
  }, [
    cart,
    cartAccountScope,
    cartCacheKey,
    cartRecommendationAlgorithmVersion,
    cartRecommendationItems,
    cartRecommendationRequestId,
  ]);

  const loadCart = React.useCallback(
    async (requestedMode: CartLoadMode = 'loading', options: { resetSelection?: boolean } = {}) => {
      const requestSequence = cartRequestSequenceRef.current + 1;
      cartRequestSequenceRef.current = requestSequence;

      if (!session?.accessToken) {
        loadedCartTokenRef.current = null;
        setCart(null);
        setCartRecommendationItems([]);
        setCartRecommendationRequestId(null);
        setCartRecommendationAlgorithmVersion(null);
        setIsLoading(false);
        setIsRefreshing(false);
        return;
      }

      const loadMode = requestedMode === 'auto'
        ? resolveFocusRefreshMode(loadedCartTokenRef.current, cartAccountScope!, 'silent')
        : requestedMode;

      if (
        loadMode === 'loading'
        && loadedCartTokenRef.current
        && loadedCartTokenRef.current !== cartAccountScope
      ) {
        setCart(null);
        setCartRecommendationItems([]);
        setCartRecommendationRequestId(null);
        setCartRecommendationAlgorithmVersion(null);
      }

      if (loadMode === 'refresh') {
        setIsRefreshing(true);
      } else if (loadMode === 'loading') {
        setIsLoading(true);
      }

      try {
        const nextCart = await runWithAuth((accessToken) => (
          options.resetSelection ? cartApi.selectAll(accessToken, false) : cartApi.getCart(accessToken)
        ));
        if (cartRequestSequenceRef.current !== requestSequence) return;
        setCart(nextCart);
        loadedCartTokenRef.current = cartAccountScope;
        void runWithAuth((accessToken) => recommendationApi.getCartRecommendations(8, accessToken))
          .then((response) => {
            if (cartRequestSequenceRef.current !== requestSequence) return;
            setCartRecommendationItems(response.items);
            setCartRecommendationRequestId(response.requestId);
            setCartRecommendationAlgorithmVersion(response.algorithmVersion);
          })
          .catch(() => {
            if (cartRequestSequenceRef.current === requestSequence && loadMode === 'loading') {
              setCartRecommendationItems([]);
              setCartRecommendationRequestId(null);
              setCartRecommendationAlgorithmVersion(null);
            }
          });
      } catch (error) {
        if (cartRequestSequenceRef.current !== requestSequence) return;
        if (loadMode !== 'silent') {
          showNotice({
            tone: 'error',
            title: 'Chưa tải được giỏ hàng',
            message: getErrorMessage(error),
          });
        }
      } finally {
        if (cartRequestSequenceRef.current !== requestSequence) return;
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [cartAccountScope, runWithAuth, session?.accessToken, showNotice],
  );

  const recordCartRecommendationEvent = React.useCallback((item: RecommendationItem, eventType: 'impression' | 'click') => {
    if (!cartRecommendationRequestId) {
      return;
    }

    const payload = {
      requestId: cartRecommendationRequestId,
      eventType,
      context: 'cart' as const,
      recommendedProductId: item.product._id,
      algorithmVersion: cartRecommendationAlgorithmVersion ?? undefined,
      score: item.score,
      rank: item.rank,
      reasonCodes: item.reasonCodes,
    };

    void runWithAuth((accessToken) => recommendationApi.recordEvent(payload, accessToken)).catch(() => undefined);
  }, [cartRecommendationAlgorithmVersion, cartRecommendationRequestId, runWithAuth]);
  const {
    recommendationSectionRef,
    checkRecommendationVisibility,
    handleRecommendationViewableItemsChanged,
  } = useRecommendationImpressions({
    requestId: cartRecommendationRequestId,
    items: cartRecommendationItems,
    onImpression: (item) => recordCartRecommendationEvent(item, 'impression'),
  });

  useStaleFocusEffect(
    () => {
      void loadCart('auto', { resetSelection: !shouldKeepSelectionOnFocus });
    },
    [loadCart, shouldKeepSelectionOnFocus],
    { cacheScope: 'cart:', runOnDepsChange: true, staleMs: 20 * 1000 },
  );

  const clearSelectedCartItemsLocally = React.useCallback(() => {
    setCart((currentCart) => {
      if (!currentCart) {
        return currentCart;
      }

      return {
        ...currentCart,
        product_list: currentCart.product_list.map((item) => (
          item.isSelected ? { ...item, isSelected: false } : item
        )),
        summary: {
          ...currentCart.summary,
          selectedItemCount: 0,
          subTotal: 0,
        },
      };
    });
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      return () => {
        if (!session?.accessToken) {
          return;
        }

        clearSelectedCartItemsLocally();
        void runWithAuth((accessToken) => cartApi.selectAll(accessToken, false)).catch(() => undefined);
      };
    }, [clearSelectedCartItemsLocally, runWithAuth, session?.accessToken]),
  );

  const selectedItems = React.useMemo(
    () => cart?.product_list.filter((item) => item.isSelected) ?? [],
    [cart?.product_list],
  );
  const selectedCheckoutItems = React.useMemo(
    () => selectedItems.filter((item) => item.isAvailable !== false),
    [selectedItems],
  );
  const unavailableSelectedItems = selectedItems.filter((item) => item.isAvailable === false);
  const allItemsSelected = Boolean(
    cart?.product_list.length && cart.product_list.every((item) => item.isSelected),
  );

  const handleStartVirtualTryOn = () => {
    if (!selectedCheckoutItems.length) {
      showNotice({
        tone: 'info',
        title: 'Chọn đồ muốn phối',
        message: `Tick từ 1 đến ${TRY_ON_QUEUE_LIMIT} sản phẩm còn hàng trong giỏ rồi mở phòng phối đồ ảo.`,
      });
      return;
    }

    if (selectedCheckoutItems.length > TRY_ON_QUEUE_LIMIT) {
      showNotice({
        tone: 'warning',
        title: `Chọn tối đa ${TRY_ON_QUEUE_LIMIT} món`,
        message: `Bạn đang chọn ${selectedCheckoutItems.length} món còn hàng. Bỏ chọn bớt để đưa vào hàng chờ phối đồ ảo.`,
      });
      return;
    }

    if (unavailableSelectedItems.length) {
      showNotice({
        tone: 'info',
        title: 'Bỏ qua món chưa khả dụng',
        message: `${unavailableSelectedItems.length} món hết hàng hoặc chưa khả dụng sẽ không được đưa vào phòng phối.`,
      });
    }

    navigation.navigate('VirtualTryOnHome', {
      entryPoint: 'cart',
      seedItems: selectedCheckoutItems.map((item) => ({
        cartItemId: item._id,
        productId: item.productId,
        variantId: item.variantId,
        colorVariantId: item.colorVariantId,
        size: item.size,
        nameSnapshot: getItemTitle(item),
        colorSnapshot: item.color,
        imageSnapshot: item.image,
      })),
    });
  };
  const localSubTotal = selectedCheckoutItems.reduce(
    (sum, item) => sum + item.quantity * item.priceAtAddedTime,
    0,
  );

  const updateCartState = (nextCart: CartResponse) => {
    setCart(nextCart);
  };

  const handleSelectItem = async (item: CartItem) => {
    if (!session?.accessToken || pendingItemId) {
      return;
    }

    try {
      setPendingItemId(item._id);
      const nextCart = await runWithAuth((accessToken) => cartApi.selectItem(accessToken, item._id, !item.isSelected));
      updateCartState(nextCart);
    } catch (error) {
      showNotice({
        tone: 'error',
        title: 'Chưa cập nhật được lựa chọn',
        message: getErrorMessage(error),
      });
    } finally {
      setPendingItemId(null);
    }
  };

  const handleSelectAll = async () => {
    if (!session?.accessToken || pendingItemId || !cart?.product_list.length) {
      return;
    }

    try {
      setPendingItemId('select-all');
      const nextCart = await runWithAuth((accessToken) => cartApi.selectAll(accessToken, !allItemsSelected));
      updateCartState(nextCart);
    } catch (error) {
      showNotice({
        tone: 'error',
        title: 'Chưa cập nhật được giỏ hàng',
        message: getErrorMessage(error),
      });
    } finally {
      setPendingItemId(null);
    }
  };

  const handleQuantityChange = async (item: CartItem, nextQuantity: number) => {
    if (!session?.accessToken || nextQuantity < 1 || pendingItemId) {
      return;
    }

    if (item.availableQuantity !== undefined && nextQuantity > item.availableQuantity) {
      showNotice({
        tone: 'warning',
        title: 'Không đủ tồn kho',
        message: `Sản phẩm này hiện chỉ còn ${item.availableQuantity}.`,
      });
      return;
    }

    try {
      setPendingItemId(item._id);
      const nextCart = await runWithAuth((accessToken) => cartApi.updateItem(accessToken, item._id, { quantity: nextQuantity }));
      updateCartState(nextCart);
    } catch (error) {
      showNotice({
        tone: 'error',
        title: 'Chưa cập nhật được số lượng',
        message: getErrorMessage(error),
      });
      void loadCart('silent');
    } finally {
      setPendingItemId(null);
    }
  };

  const handleRemoveItem = (item: CartItem) => {
    if (!session?.accessToken || pendingItemId) {
      return;
    }

    Alert.alert('Bỏ sản phẩm khỏi giỏ?', 'Bạn chắc chắn muốn bỏ sản phẩm này?', [
      { text: 'Không', style: 'cancel' },
      {
        text: 'Đồng ý',
        style: 'destructive',
        onPress: () => {
          void confirmRemoveItem(item);
        },
      },
    ]);
  };

  const confirmRemoveItem = async (item: CartItem) => {
    if (!session?.accessToken || pendingItemId) {
      return;
    }

    try {
      setPendingItemId(item._id);
      const nextCart = await runWithAuth((accessToken) => cartApi.deleteItem(accessToken, item._id));
      updateCartState(nextCart);
      showNotice({
        tone: 'success',
        title: 'Đã xóa sản phẩm',
        message: `${getItemTitle(item)} đã được bỏ khỏi giỏ hàng.`,
      }, 3000);
    } catch (error) {
      showNotice({
        tone: 'error',
        title: 'Chưa xóa được sản phẩm',
        message: getErrorMessage(error),
      });
    } finally {
      setPendingItemId(null);
    }
  };

  const renderQuantityStepper = (item: CartItem) => {
    const isPending = pendingItemId === item._id;
    const isAtMax = item.availableQuantity !== undefined && item.quantity >= item.availableQuantity;

    return (
      <View style={styles.stepper}>
        <TouchableOpacity
          style={[styles.stepperButton, (item.quantity <= 1 || isPending) && styles.stepperButtonDisabled]}
          onPress={() => handleQuantityChange(item, item.quantity - 1)}
          disabled={item.quantity <= 1 || isPending}
          activeOpacity={0.82}
        >
          <MaterialCommunityIcons name="minus" size={15} color={item.quantity <= 1 ? colors.textSubtle : colors.text} />
        </TouchableOpacity>
        <View style={styles.stepperValue}>
          {isPending ? (
            <ActivityIndicator size="small" color={colors.brand} />
          ) : (
            <Text style={styles.stepperText}>{item.quantity}</Text>
          )}
        </View>
        <TouchableOpacity
          style={[styles.stepperButton, (isAtMax || isPending) && styles.stepperButtonDisabled]}
          onPress={() => handleQuantityChange(item, item.quantity + 1)}
          disabled={isAtMax || isPending}
          activeOpacity={0.82}
        >
          <MaterialCommunityIcons name="plus" size={15} color={isAtMax ? colors.textSubtle : colors.text} />
        </TouchableOpacity>
      </View>
    );
  };

  const renderCartItem = (item: CartItem) => {
    const stockText = getStockText(item);
    const isStockWarning = Boolean(stockText);
    const imageUri = item.image?.trim();
    const isPending = pendingItemId === item._id;

    return (
      <View key={item._id} style={[styles.cartItem, item.isAvailable === false && styles.cartItemUnavailable]}>
        <TouchableOpacity
          style={styles.selectButton}
          onPress={() => handleSelectItem(item)}
          accessibilityLabel={item.isSelected ? 'Bỏ chọn sản phẩm' : 'Chọn sản phẩm'}
          disabled={isPending || pendingItemId === 'select-all'}
          activeOpacity={0.82}
        >
          <MaterialCommunityIcons
            name={item.isSelected ? 'checkbox-marked' : 'checkbox-blank-outline'}
            size={23}
            color={item.isSelected ? colors.brand : colors.textSubtle}
          />
        </TouchableOpacity>

        <View style={styles.itemImageWrap}>
          {isRemoteImage(imageUri) ? (
            <Image source={{ uri: imageUri }} style={styles.itemImage} />
          ) : (
            <MaterialCommunityIcons name="image-outline" size={28} color={colors.textSubtle} />
          )}
        </View>

        <View style={styles.itemBody}>
          <View style={styles.itemTopRow}>
            <View style={styles.itemTitleBlock}>
              <Text style={styles.itemName} numberOfLines={2}>
                {getItemTitle(item)}
              </Text>
              <Text style={styles.itemSku}>Mã: {item.sku}</Text>
            </View>
            <TouchableOpacity
              style={styles.removeButton}
              onPress={() => handleRemoveItem(item)}
              accessibilityLabel="Xóa khỏi giỏ hàng"
              activeOpacity={0.82}
            >
              <MaterialCommunityIcons name="close" size={17} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          <Text style={styles.itemBrand} numberOfLines={1}>
            {item.brand?.name || 'FASHIONISTA'}
          </Text>
          <Text style={styles.itemPrice}>{formatCurrency(item.priceAtAddedTime)}</Text>
          <Text style={styles.itemMeta}>Màu sắc: {item.color || 'Đang cập nhật'}</Text>
          <View style={styles.itemBottomRow}>
            <Text style={styles.itemMeta}>Kích thước: {item.size}</Text>
            {renderQuantityStepper(item)}
          </View>
          {isStockWarning ? (
            <Text style={[styles.stockText, item.isAvailable === false && styles.stockTextDanger]}>
              {stockText}
            </Text>
          ) : null}
        </View>
      </View>
    );
  };

  const renderVirtualTryOnCard = () => {
    const selectedCount = selectedCheckoutItems.length;
    const hasTooManyItems = selectedCount > TRY_ON_QUEUE_LIMIT;
    const previewItems = selectedCheckoutItems.slice(0, 4);
    const hiddenPreviewCount = Math.max(0, selectedCount - previewItems.length);

    return (
      <View style={styles.virtualTryOnCard}>
        <View style={styles.virtualTryOnGlow} />
        <View style={styles.virtualTryOnHeader}>
          <View style={styles.virtualTryOnIcon}>
            <MaterialCommunityIcons name="auto-fix" size={24} color={colors.white} />
          </View>
          <View style={styles.virtualTryOnCopy}>
            <Text style={styles.virtualTryOnEyebrow}>Fit Studio</Text>
            <Text style={styles.virtualTryOnTitle}>Thử đồ ảo trước khi mua</Text>
            <Text style={styles.virtualTryOnText}>
              Chọn sản phẩm trong giỏ để xem chúng lên ảnh người thật trước khi thanh toán.
            </Text>
          </View>
        </View>

        <View style={styles.virtualTryOnSelectionRow}>
          <View style={styles.virtualTryOnThumbs}>
            {previewItems.map((item, index) => {
              const imageUri = item.image?.trim();

              return (
                <View
                  key={`try-on-${item._id}`}
                  style={[styles.virtualTryOnThumb, index > 0 && styles.virtualTryOnThumbOverlap]}
                >
                  {isRemoteImage(imageUri) ? (
                    <Image source={{ uri: imageUri }} style={styles.virtualTryOnThumbImage} />
                  ) : (
                    <MaterialCommunityIcons name="hanger" size={18} color={colors.brand} />
                  )}
                </View>
              );
            })}
            {hiddenPreviewCount ? (
              <View style={[styles.virtualTryOnEmptyThumb, previewItems.length > 0 && styles.virtualTryOnThumbOverlap]}>
                <Text style={styles.virtualTryOnMoreText}>+{hiddenPreviewCount}</Text>
              </View>
            ) : null}
            {!selectedCount ? (
              <View style={styles.virtualTryOnEmptyThumb}>
                <MaterialCommunityIcons name="checkbox-marked-circle-outline" size={19} color={colors.brand} />
              </View>
            ) : null}
          </View>
          <Text style={[styles.virtualTryOnSelectionText, hasTooManyItems && styles.virtualTryOnSelectionTextWarning]}>
            {hasTooManyItems
              ? `${selectedCount} món · tối đa ${TRY_ON_QUEUE_LIMIT} món`
              : selectedCount
                ? `${selectedCount} món đã chọn`
                : 'Chưa chọn món nào'}
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.virtualTryOnButton, !selectedCount && styles.virtualTryOnButtonIdle]}
          onPress={handleStartVirtualTryOn}
          activeOpacity={0.86}
          accessibilityRole="button"
          accessibilityLabel="Mở phòng phối đồ ảo với các sản phẩm đã chọn"
        >
          <Text style={styles.virtualTryOnButtonText}>
            {hasTooManyItems
              ? `Bỏ chọn ${selectedCount - TRY_ON_QUEUE_LIMIT} món để tiếp tục`
              : selectedCount
                ? `Phối thử ${selectedCount} món`
                : 'Chọn sản phẩm để thử'}
          </Text>
          <MaterialCommunityIcons name="arrow-right" size={20} color={colors.white} />
        </TouchableOpacity>
      </View>
    );
  };

  const handleCartRecommendationPress = (item: RecommendationItem) => {
    recordCartRecommendationEvent(item, 'click');
    navigation.navigate('ProductDetail', {
      productId: item.product._id,
      recommendationRequestId: cartRecommendationRequestId ?? undefined,
    });
  };

  const renderCartRecommendations = () => {
    if (!cartRecommendationItems.length) {
      return null;
    }

    return (
      <RecommendationRail
        title="Gợi ý cho giỏ hàng"
        subtitle="Những món có thể phối cùng lựa chọn hiện tại"
        items={cartRecommendationItems}
        trackingRef={recommendationSectionRef}
        onViewableItemsChanged={handleRecommendationViewableItemsChanged}
        onProductPress={handleCartRecommendationPress}
      />
    );
  };

  const renderNotice = () => {
    if (!notice) {
      return null;
    }

    const toneStyle =
      notice.tone === 'success'
        ? styles.noticeSuccess
        : notice.tone === 'warning'
        ? styles.noticeWarning
        : notice.tone === 'error'
        ? styles.noticeError
        : styles.noticeInfo;
    const iconColor =
      notice.tone === 'success'
        ? colors.success
        : notice.tone === 'warning'
        ? colors.goldText
        : notice.tone === 'error'
        ? colors.danger
        : colors.brand;
    const iconName: keyof typeof MaterialCommunityIcons.glyphMap =
      notice.tone === 'success'
        ? 'check-circle-outline'
        : notice.tone === 'warning'
        ? 'alert-circle-outline'
        : notice.tone === 'error'
        ? 'close-circle-outline'
        : 'information-outline';

    return (
      <View style={[styles.noticeCard, toneStyle]}>
        <View style={styles.noticeIcon}>
          <MaterialCommunityIcons name={iconName} size={20} color={iconColor} />
        </View>
        <View style={styles.noticeCopy}>
          <Text style={styles.noticeTitle} numberOfLines={1}>
            {notice.title}
          </Text>
          {notice.message ? (
            <Text style={styles.noticeMessage} numberOfLines={2}>
              {notice.message}
            </Text>
          ) : null}
          {notice.actionLabel ? (
            <TouchableOpacity
              style={styles.noticeAction}
              onPress={() => {
                notice.onAction?.();
                dismissNotice();
              }}
              activeOpacity={0.82}
            >
              <Text style={styles.noticeActionText}>{notice.actionLabel}</Text>
              <MaterialCommunityIcons name="chevron-right" size={15} color={colors.brand} />
            </TouchableOpacity>
          ) : null}
        </View>
        <TouchableOpacity
          style={styles.noticeClose}
          onPress={dismissNotice}
          accessibilityLabel="Đóng thông báo"
          activeOpacity={0.82}
        >
          <MaterialCommunityIcons name="close" size={17} color={colors.textMuted} />
        </TouchableOpacity>
      </View>
    );
  };

  const renderContent = () => {
    if (!isAuthenticated || !session?.accessToken) {
      return (
        <View style={styles.statePanel}>
          <MaterialCommunityIcons name="cart-outline" size={42} color={colors.brand} />
          <Text style={styles.stateTitle}>Đăng nhập để xem giỏ hàng</Text>
          <Text style={styles.stateText}>Giỏ hàng được lưu theo tài khoản để giữ đúng tồn kho và đặt hàng.</Text>
          <TouchableOpacity style={styles.primarySmallButton} onPress={() => navigation.navigate('Login')} activeOpacity={0.82}>
            <Text style={styles.primarySmallButtonText}>Đăng nhập</Text>
          </TouchableOpacity>
        </View>
      );
    }

    if (isLoading) {
      return (
        <View style={styles.statePanel}>
          <ActivityIndicator color={colors.brand} />
          <Text style={styles.stateText}>Đang tải giỏ hàng</Text>
        </View>
      );
    }

    if (!cart?.product_list.length) {
      return (
        <View style={styles.statePanel}>
          <MaterialCommunityIcons name="cart-off" size={42} color={colors.brand} />
          <Text style={styles.stateTitle}>Giỏ hàng đang trống</Text>
          <Text style={styles.stateText}>Chọn màu, size và số lượng ở trang chi tiết sản phẩm rồi thêm vào giỏ nha.</Text>
          <TouchableOpacity
            style={styles.primarySmallButton}
            onPress={() => navigation.navigate('ProductList', { title: 'Tất cả sản phẩm' })}
            activeOpacity={0.82}
          >
            <Text style={styles.primarySmallButtonText}>Mua sắm ngay</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <>
        <View style={styles.sectionHeaderRow}>
          <View style={styles.titleWithIcon}>
            <MaterialCommunityIcons name="cart-outline" size={25} color={colors.black} />
            <Text style={styles.screenTitle}>Giỏ hàng</Text>
          </View>
          <TouchableOpacity
            style={styles.selectAllButton}
            onPress={handleSelectAll}
            disabled={pendingItemId === 'select-all'}
            activeOpacity={0.82}
          >
            <MaterialCommunityIcons
              name={allItemsSelected ? 'checkbox-marked' : 'checkbox-blank-outline'}
              size={18}
              color={allItemsSelected ? colors.brand : colors.textMuted}
            />
            <Text style={styles.selectAllText}>
              {allItemsSelected ? 'Bỏ chọn tất cả' : 'Chọn tất cả'}
            </Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.itemCount}>{cart.summary.itemCount} sản phẩm, {cart.summary.selectedItemCount} đã chọn</Text>

        <View style={styles.itemList}>
          {cart.product_list.map(renderCartItem)}
        </View>

        {renderVirtualTryOnCard()}

        {renderCartRecommendations()}

        {unavailableSelectedItems.length ? (
          <View style={styles.checkoutWarning}>
            <MaterialCommunityIcons name="alert-circle-outline" size={18} color={colors.danger} />
            <Text style={styles.checkoutWarningText}>
              Có sản phẩm đã chọn không còn đủ tồn kho. Bạn giảm số lượng, bỏ chọn hoặc xóa sản phẩm đó trước khi mua hàng.
            </Text>
          </View>
        ) : null}

      </>
    );
  };

  const handleGoToCheckout = () => {
    if (!isAuthenticated || !session?.accessToken) {
      navigation.navigate('Login');
      return;
    }

    if (!selectedCheckoutItems.length) {
      showNotice({
        tone: 'warning',
        title: 'Chưa chọn sản phẩm',
        message: 'Bạn tick ít nhất một sản phẩm trong giỏ để mua hàng.',
      });
      return;
    }

    if (unavailableSelectedItems.length) {
      showNotice({
        tone: 'warning',
        title: 'Có sản phẩm hết hàng',
        message: 'Bạn bỏ chọn hoặc xóa sản phẩm không còn hàng trước khi mua hàng.',
      });
      return;
    }

    navigation.navigate('Checkout', {
      cartItemIds: selectedCheckoutItems.map((item) => item._id),
      ...(route.params?.couponCode ? { couponCode: route.params.couponCode } : {}),
    });
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <View style={styles.shortcutHeader}>
        <TouchableOpacity
          style={styles.shortcutHeaderAction}
          onPress={() => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Home'))}
          accessibilityLabel="Trở về"
          activeOpacity={0.82}
        >
          <MaterialCommunityIcons name="arrow-left" size={24} color={colors.white} />
        </TouchableOpacity>
        <Text style={styles.shortcutHeaderTitle}>Giỏ hàng</Text>
        <TouchableOpacity
          style={styles.shortcutHeaderAction}
          onPress={() => loadCart('refresh')}
          accessibilityLabel="Tải lại"
          activeOpacity={0.82}
        >
          <MaterialCommunityIcons name="refresh" size={22} color={colors.white} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        nestedScrollEnabled
        showsVerticalScrollIndicator={false}
        onScroll={checkRecommendationVisibility}
        scrollEventThrottle={100}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={() => loadCart('refresh')} tintColor={colors.brand} />
        }
      >
        {renderNotice()}
        {renderContent()}
        <View style={styles.footerGapStorefront}>
          <StorefrontFooter />
        </View>
      </ScrollView>

      <View style={styles.stickyFooter}>
        <View style={styles.stickyFooterLeft}>
          <Text style={styles.stickyFooterTotal}>{formatCurrency(localSubTotal)}</Text>
          <Text style={styles.stickyFooterHint}>Tạm tính · Chọn mua hàng để xem phí ship</Text>
        </View>
        <Pressable
          style={[styles.checkoutButton, !selectedCheckoutItems.length && styles.checkoutButtonDisabled]}
          onPress={handleGoToCheckout}
          disabled={!selectedCheckoutItems.length}
        >
          <Text style={styles.checkoutText}>Mua hàng</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.brand,
  },
  shortcutHeader: {
    ...brandedHeaderStyles.container,
  },
  shortcutHeaderAction: {
    ...brandedHeaderStyles.action,
  },
  shortcutHeaderTitle: {
    ...brandedHeaderStyles.title,
    flex: 1,
    marginTop: 0,
    textAlign: 'center',
  },
  content: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    paddingBottom: 0,
  },
  noticeCard: {
    marginHorizontal: spacing.md,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
    borderRadius: radii.sm,
    borderWidth: 1,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  noticeSuccess: {
    borderColor: colors.success,
    backgroundColor: colors.successSoft,
  },
  noticeWarning: {
    borderColor: colors.goldDark,
    backgroundColor: colors.goldSoft,
  },
  noticeError: {
    borderColor: colors.danger,
    backgroundColor: colors.dangerSoft,
  },
  noticeInfo: {
    borderColor: colors.brandPale,
    backgroundColor: colors.brandSoft,
  },
  noticeIcon: {
    width: 24,
    minHeight: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noticeCopy: {
    flex: 1,
    minWidth: 0,
  },
  noticeTitle: {
    color: colors.black,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '900',
  },
  noticeMessage: {
    color: colors.textBody,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 2,
  },
  noticeAction: {
    alignSelf: 'flex-start',
    minHeight: 28,
    marginTop: spacing.sm,
    borderRadius: radii.xs,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  noticeActionText: {
    color: colors.brand,
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '900',
  },
  noticeClose: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionHeaderRow: {
    minHeight: 52,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  titleWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  screenTitle: {
    color: colors.black,
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '800',
  },
  itemCount: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
    paddingHorizontal: spacing.md,
    marginBottom: spacing.md,
  },
  selectAllButton: {
    minHeight: 34,
    borderRadius: radii.xs,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  selectAllText: {
    color: colors.text,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '800',
  },
  itemList: {
    paddingHorizontal: spacing.md,
    gap: spacing.md,
  },
  virtualTryOnCard: {
    marginHorizontal: spacing.md,
    marginTop: spacing.lg,
    borderRadius: radii.md,
    backgroundColor: '#213448',
    padding: spacing.md,
    overflow: 'hidden',
    gap: spacing.md,
  },
  virtualTryOnGlow: {
    position: 'absolute',
    width: 180,
    height: 180,
    borderRadius: 90,
    right: -72,
    top: -96,
    backgroundColor: 'rgba(123, 190, 225, 0.22)',
  },
  virtualTryOnHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  virtualTryOnIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#547792',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.28)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  virtualTryOnCopy: {
    flex: 1,
    minWidth: 0,
  },
  virtualTryOnEyebrow: {
    color: '#BFD8E6',
    fontSize: 10,
    lineHeight: 14,
    fontWeight: '900',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
  virtualTryOnTitle: {
    color: colors.white,
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '900',
    marginTop: 2,
  },
  virtualTryOnText: {
    color: '#DCEAF1',
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '600',
    marginTop: 4,
  },
  virtualTryOnSelectionRow: {
    minHeight: 44,
    borderRadius: radii.sm,
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: spacing.sm,
  },
  virtualTryOnThumbs: {
    minWidth: 44,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 2,
  },
  virtualTryOnThumb: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.white,
    borderWidth: 2,
    borderColor: '#213448',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  virtualTryOnThumbOverlap: {
    marginLeft: -8,
  },
  virtualTryOnThumbImage: {
    width: '100%',
    height: '100%',
  },
  virtualTryOnEmptyThumb: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  virtualTryOnMoreText: {
    color: colors.brand,
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '900',
  },
  virtualTryOnSelectionText: {
    flex: 1,
    color: colors.white,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '800',
    textAlign: 'left',
  },
  virtualTryOnSelectionTextWarning: {
    color: '#FFD9A8',
  },
  virtualTryOnButton: {
    minHeight: 46,
    borderRadius: radii.sm,
    backgroundColor: '#547792',
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  virtualTryOnButtonIdle: {
    backgroundColor: 'rgba(84,119,146,0.72)',
  },
  virtualTryOnButtonText: {
    color: colors.white,
    fontSize: 14,
    lineHeight: 19,
    fontWeight: '900',
  },
  cartItem: {
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.md,
    flexDirection: 'row',
    gap: spacing.md,
  },
  selectButton: {
    width: 24,
    minHeight: 72,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cartItemUnavailable: {
    borderColor: colors.dangerSoft,
    backgroundColor: '#FFF8F8',
  },
  itemImageWrap: {
    width: 72,
    height: 72,
    borderRadius: radii.sm,
    backgroundColor: colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  itemImage: {
    width: '100%',
    height: '100%',
  },
  itemBody: {
    flex: 1,
    minWidth: 0,
  },
  itemTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  itemTitleBlock: {
    flex: 1,
    minWidth: 0,
  },
  itemName: {
    color: colors.black,
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '800',
  },
  itemSku: {
    color: colors.textMuted,
    fontSize: 11,
    lineHeight: 16,
    marginTop: 2,
  },
  itemBrand: {
    color: colors.black,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '800',
    marginTop: 2,
  },
  itemPrice: {
    color: colors.black,
    fontSize: 14,
    lineHeight: 19,
    fontWeight: '900',
    marginTop: 4,
  },
  itemMeta: {
    color: colors.text,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 8,
  },
  itemBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  removeButton: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepper: {
    height: 28,
    borderRadius: radii.xs,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
  },
  stepperButton: {
    width: 32,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  stepperButtonDisabled: {
    backgroundColor: colors.field,
  },
  stepperValue: {
    width: 34,
    height: 28,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperText: {
    color: colors.text,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
  },
  stockText: {
    color: colors.goldText,
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '800',
    marginTop: 6,
  },
  stockTextDanger: {
    color: colors.danger,
  },
  sectionTitle: {
    color: colors.black,
    fontSize: 19,
    lineHeight: 25,
    fontWeight: '800',
    marginBottom: spacing.md,
  },
  checkoutWarning: {
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.dangerSoft,
    backgroundColor: '#FFF8F8',
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    marginBottom: spacing.sm,
    marginHorizontal: spacing.md,
  },
  checkoutWarningText: {
    flex: 1,
    color: colors.danger,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '700',
  },
  checkoutButton: {
    minHeight: 56,
    borderRadius: radii.sm,
    backgroundColor: colors.black,
    paddingHorizontal: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkoutButtonDisabled: {
    backgroundColor: colors.disabled,
  },
  checkoutText: {
    color: colors.white,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '900',
  },
  statePanel: {
    margin: spacing.md,
    minHeight: 240,
    borderRadius: radii.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  stateTitle: {
    color: colors.text,
    fontSize: 17,
    lineHeight: 23,
    fontWeight: '800',
    marginTop: spacing.md,
    textAlign: 'center',
  },
  stateText: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  primarySmallButton: {
    minHeight: 40,
    borderRadius: radii.xs,
    backgroundColor: colors.brand,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.lg,
  },
  primarySmallButtonText: {
    color: colors.white,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '800',
  },
  footerGapStorefront: {
    paddingTop: spacing.xxl,
    backgroundColor: colors.background,
  },
  stickyFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  stickyFooterLeft: {
    flex: 1,
    gap: spacing.xs,
  },
  stickyFooterTotal: {
    color: colors.text,
    fontSize: 20,
    lineHeight: 26,
    fontWeight: '900',
  },
  stickyFooterHint: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '600',
  },
});

export default CartScreen;
