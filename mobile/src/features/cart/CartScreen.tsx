import React from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import StorefrontFooter from '../../components/layout/StorefrontFooter';
import StorefrontHeader from '../../components/layout/StorefrontHeader';
import { colors, radii, spacing } from '../../theme';
import type { RootStackParamList } from '../../navigation/AppNavigator';
import { useAuth } from '../auth/AuthContext';
import { accountApi, type UserAddress } from '../account/accountApi';
import {
  paymentMethodsApi,
  type PaymentMethodRecord as SavedPaymentMethodRecord,
} from '../account/paymentMethodsApi';
import { cartApi, CartApiError, type CartItem, type CartResponse, type CheckoutPreviewResponse } from './cartApi';
import { paymentApi, PaymentApiError } from '../payments/paymentApi';
import * as WebBrowser from 'expo-web-browser';

type CartNavigationProp = StackNavigationProp<RootStackParamList, 'Cart'>;
type CartRouteProp = RouteProp<RootStackParamList, 'Cart'>;
type PaymentMethod = 'COD' | 'VNPAY' | 'MOMO';
type NoticeTone = 'success' | 'error' | 'warning' | 'info';

type CartNotice = {
  id: number;
  tone: NoticeTone;
  title: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
};

const COD_SHIPPING_FEE = 25000;

const formatCurrency = (value: number) =>
  `${Math.round(value).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')}đ`;

const isRemoteImage = (value?: string | null) => Boolean(value && /^https?:\/\//i.test(value.trim()));

const getErrorMessage = (error: unknown) => {
  if (error instanceof CartApiError && error.status === 409 && error.errorCode === 'QUOTE_CHANGED') {
    return 'Phí giao hàng vừa thay đổi. Mình cần cập nhật lại tổng tiền trước khi đặt hàng.';
  }

  if (error instanceof CartApiError && error.status === 409) {
    return 'Số lượng vừa chọn đã vượt tồn kho hiện có. Mình đã giữ giỏ hàng ở mức an toàn.';
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

const compactAddressParts = (address: UserAddress) =>
  [
    address.streetName,
    address.ward,
    address.province,
  ]
    .map((item) => item?.trim())
    .filter(Boolean);

const formatAddress = (address: UserAddress) => compactAddressParts(address).join(', ');

const getAddressKey = (address: UserAddress, index: number) =>
  address._id ?? `${address.phoneNumber}-${address.streetName}-${index}`;

const toShippingAddress = (address: UserAddress) => ({
  customerName: (address.customerName || '').trim(),
  province: (address.province || '').trim(),
  provinceCode: address.provinceCode ?? null,
  provinceId: address.provinceId ?? null,
  district: address.district?.trim() || null,
  districtId: address.districtId ?? null,
  ward: (address.ward || '').trim(),
  wardCode: address.wardCode ?? '',
  streetName: (address.streetName || '').trim(),
  phoneNumber: (address.phoneNumber || '').trim(),
  ghnProvinceId: address.ghnProvinceId ?? null,
  ghnDistrictId: address.ghnDistrictId ?? null,
  ghnWardCode: address.ghnWardCode ?? null,
  ghnMappingStatus: address.ghnMappingStatus ?? 'missing',
});

const hasShippingAreaCode = (address: UserAddress | null) =>
  Boolean((address?.ghnDistrictId && address?.ghnWardCode) || (address?.districtId && address?.wardCode));

const CartScreen = () => {
  const navigation = useNavigation<CartNavigationProp>();
  const route = useRoute<CartRouteProp>();
  const { isAuthenticated, session, runWithAuth } = useAuth();
  const [cart, setCart] = React.useState<CartResponse | null>(null);
  const [addresses, setAddresses] = React.useState<UserAddress[]>([]);
  const [selectedAddressId, setSelectedAddressId] = React.useState<string | null>(null);
  const [isAddressLoading, setIsAddressLoading] = React.useState(false);
  const [paymentMethods, setPaymentMethods] = React.useState<SavedPaymentMethodRecord[]>([]);
  const [selectedPaymentMethodId, setSelectedPaymentMethodId] = React.useState<string | null>(null);
  const [isPaymentMethodsLoading, setIsPaymentMethodsLoading] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isRefreshing, setIsRefreshing] = React.useState(false);
  const [pendingItemId, setPendingItemId] = React.useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [paymentMethod, setPaymentMethod] = React.useState<PaymentMethod>('COD');
  const [couponCode, setCouponCode] = React.useState('');
  const [appliedCouponCode, setAppliedCouponCode] = React.useState<string | null>(null);
  const [checkoutPreview, setCheckoutPreview] = React.useState<CheckoutPreviewResponse | null>(null);
  const [isApplyingCoupon, setIsApplyingCoupon] = React.useState(false);
  const [isPreviewLoading, setIsPreviewLoading] = React.useState(false);
  const [notice, setNotice] = React.useState<CartNotice | null>(null);
  const [confirmingRemoveItemId, setConfirmingRemoveItemId] = React.useState<string | null>(null);
  const [form, setForm] = React.useState({
    fullName: session?.user.name ?? '',
    phone: session?.user.phone ?? '',
    email: session?.user.email ?? '',
    address: '',
    note: '',
  });
  const selectedAddressIdRef = React.useRef<string | null>(null);
  const noticeTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const paymentMethodSelectionTouchedRef = React.useRef(false);

  const selectedAddress = React.useMemo(
    () =>
      addresses.find((address) => address._id && address._id === selectedAddressId) ??
      addresses.find((address) => address.isDefault) ??
      addresses[0] ??
      null,
    [addresses, selectedAddressId],
  );
  const selectedShippingAddress = React.useMemo(
    () => (selectedAddress ? toShippingAddress(selectedAddress) : undefined),
    [selectedAddress],
  );
  const selectedAddressKey = selectedAddress
    ? [
        selectedAddress._id,
        selectedAddress.provinceCode ?? selectedAddress.provinceId,
        selectedAddress.ghnDistrictId ?? selectedAddress.districtId,
        selectedAddress.ghnWardCode,
        selectedAddress.wardCode,
        selectedAddress.streetName,
      ].join(':')
    : '';
  const activeSavedPaymentMethods = React.useMemo(
    () => paymentMethods.filter((method) => method.status === 'verified'),
    [paymentMethods],
  );
  const defaultSavedPaymentMethod = React.useMemo(
    () => activeSavedPaymentMethods.find((method) => method.isDefault) ?? null,
    [activeSavedPaymentMethods],
  );
  const defaultVNPayPaymentMethod = React.useMemo(
    () =>
      activeSavedPaymentMethods.find((method) => method.type === 'VNPAY' && method.isDefault) ??
      activeSavedPaymentMethods.find((method) => method.type === 'VNPAY') ??
      null,
    [activeSavedPaymentMethods],
  );
  const pendingVNPayPaymentMethod = React.useMemo(
    () => paymentMethods.find((method) => method.type === 'VNPAY' && method.status === 'pending') ?? null,
    [paymentMethods],
  );
  const selectedSavedPaymentMethod = React.useMemo(
    () =>
      activeSavedPaymentMethods.find((method) => method._id === selectedPaymentMethodId && method.type === 'VNPAY') ??
      null,
    [activeSavedPaymentMethods, selectedPaymentMethodId],
  );

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

  const getCheckoutAddressPayload = React.useCallback(
    () => ({
      addressId: selectedAddress?._id,
      shippingAddress: selectedAddress?._id ? undefined : selectedShippingAddress,
    }),
    [selectedAddress?._id, selectedShippingAddress],
  );

  const applyAddressToForm = React.useCallback((address: UserAddress | null) => {
    if (!address) return;

    setForm((current) => ({
      ...current,
      fullName: address.customerName || current.fullName,
      phone: address.phoneNumber || current.phone,
      address: formatAddress(address),
    }));
  }, []);

  React.useEffect(() => {
    selectedAddressIdRef.current = selectedAddressId;
  }, [selectedAddressId]);

  React.useEffect(() => {
    setForm((current) => ({
      ...current,
      fullName: current.fullName || session?.user.name || '',
      phone: current.phone || session?.user.phone || '',
      email: current.email || session?.user.email || '',
    }));
  }, [session?.user.email, session?.user.name, session?.user.phone]);

  const loadCart = React.useCallback(
    async (silent = false) => {
      if (!session?.accessToken) {
        setCart(null);
        setIsLoading(false);
        return;
      }

      if (silent) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }

      try {
        const nextCart = await runWithAuth((accessToken) => cartApi.getCart(accessToken));
        setCart(nextCart);
      } catch (error) {
        showNotice({
          tone: 'error',
          title: 'Chưa tải được giỏ hàng',
          message: getErrorMessage(error),
        });
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [runWithAuth, session?.accessToken, showNotice],
  );

  const loadAddresses = React.useCallback(
    async (silent = false) => {
      if (!session?.accessToken) {
        setAddresses([]);
        setSelectedAddressId(null);
        return;
      }

      if (!silent) {
        setIsAddressLoading(true);
      }

      try {
        const nextAddresses = await runWithAuth((accessToken) => accountApi.getAddresses(accessToken));
        const currentSelectedAddressId = selectedAddressIdRef.current;
        const nextSelected =
          nextAddresses.find((address) => address._id && address._id === currentSelectedAddressId) ??
          nextAddresses.find((address) => address.isDefault) ??
          nextAddresses[0] ??
          null;

        setAddresses(nextAddresses);
        setSelectedAddressId(nextSelected?._id ?? null);
        applyAddressToForm(nextSelected);
      } catch (error) {
        setAddresses([]);
        setSelectedAddressId(null);
        if (!silent) {
          showNotice({
            tone: 'error',
            title: 'Chưa tải được địa chỉ',
            message: getErrorMessage(error),
          });
        }
      } finally {
        setIsAddressLoading(false);
      }
    },
    [applyAddressToForm, runWithAuth, session?.accessToken, showNotice],
  );

  const loadPaymentMethods = React.useCallback(
    async (silent = false) => {
      if (!session?.accessToken) {
        setPaymentMethods([]);
        setSelectedPaymentMethodId(null);
        setIsPaymentMethodsLoading(false);
        return;
      }

      if (!silent) {
        setIsPaymentMethodsLoading(true);
      }

      try {
        const nextPaymentMethods = await runWithAuth((accessToken) => paymentMethodsApi.list(accessToken));
        const activeMethods = nextPaymentMethods.filter((method) => method.status === 'verified');
        const nextDefaultMethod = activeMethods.find((method) => method.isDefault) ?? null;
        const nextDefaultVNPayMethod =
          activeMethods.find((method) => method.type === 'VNPAY' && method.isDefault) ??
          activeMethods.find((method) => method.type === 'VNPAY') ??
          null;

        setPaymentMethods(nextPaymentMethods);
        setSelectedPaymentMethodId((current) => {
          if (current && activeMethods.some((method) => method._id === current && method.type === 'VNPAY')) {
            return current;
          }

          return nextDefaultVNPayMethod?._id ?? null;
        });

        if (!paymentMethodSelectionTouchedRef.current && nextDefaultMethod?.type === 'VNPAY') {
          setPaymentMethod('VNPAY');
        }
      } catch (error) {
        setPaymentMethods([]);
        setSelectedPaymentMethodId(null);
        if (!silent) {
          showNotice({
            tone: 'warning',
            title: 'Chưa tải được phương thức thanh toán',
            message: getErrorMessage(error),
          });
        }
      } finally {
        setIsPaymentMethodsLoading(false);
      }
    },
    [runWithAuth, session?.accessToken, showNotice],
  );

  useFocusEffect(
    React.useCallback(() => {
      void loadCart();
      void loadAddresses();
      void loadPaymentMethods();
    }, [loadAddresses, loadCart, loadPaymentMethods]),
  );

  React.useEffect(() => {
    if (paymentMethod !== 'VNPAY') {
      if (selectedPaymentMethodId) {
        setSelectedPaymentMethodId(null);
      }
      return;
    }

    if (
      selectedPaymentMethodId &&
      !activeSavedPaymentMethods.some(
        (method) => method._id === selectedPaymentMethodId && method.type === 'VNPAY',
      )
    ) {
      setSelectedPaymentMethodId(defaultVNPayPaymentMethod?._id ?? null);
    }
  }, [activeSavedPaymentMethods, defaultVNPayPaymentMethod, paymentMethod, selectedPaymentMethodId]);

  const selectedItems = React.useMemo(
    () => cart?.product_list.filter((item) => item.isSelected) ?? [],
    [cart?.product_list],
  );
  const selectedCheckoutItems = React.useMemo(
    () => selectedItems.filter((item) => item.isAvailable !== false),
    [selectedItems],
  );
  const selectedCheckoutItemKey = React.useMemo(
    () =>
      selectedCheckoutItems
        .map((item) => `${item._id}:${item.quantity}:${item.priceAtAddedTime}:${item.isAvailable}`)
        .join('|'),
    [selectedCheckoutItems],
  );
  const unavailableSelectedItems = selectedItems.filter((item) => item.isAvailable === false);
  const allItemsSelected = Boolean(
    cart?.product_list.length && cart.product_list.every((item) => item.isSelected),
  );
  const localSubTotal = selectedCheckoutItems.reduce(
    (sum, item) => sum + item.quantity * item.priceAtAddedTime,
    0,
  );
  const localShippingDiscountAmount = 0;
  const checkoutSummary = checkoutPreview?.summary ?? {
    subTotal: localSubTotal,
    shippingFee: COD_SHIPPING_FEE,
    couponDiscountAmount: 0,
    shippingDiscountAmount: localShippingDiscountAmount,
    membershipDiscountAmount: 0,
    taxAmount: 0,
    totalAmount: localSubTotal + (selectedCheckoutItems.length ? COD_SHIPPING_FEE - localShippingDiscountAmount : 0),
  };
  const {
    subTotal,
    shippingFee,
    couponDiscountAmount,
    shippingDiscountAmount,
    membershipDiscountAmount,
    totalAmount,
  } = checkoutSummary;
  const appliedMembership = checkoutPreview?.appliedMembership ?? null;
  const appliedCoupon = checkoutPreview?.coupon ?? null;
  const shippingQuote = checkoutPreview?.shippingQuote ?? null;
  const shippingComparison = checkoutPreview?.shippingComparison ?? null;
  const shippingPayable = selectedCheckoutItems.length ? Math.max(0, shippingFee - shippingDiscountAmount) : 0;
  const isShippingFreeForUser = selectedCheckoutItems.length > 0 && shippingPayable === 0;
  const addressHasShippingCodes = hasShippingAreaCode(selectedAddress);
  const shippingQuoteIsLive =
    shippingQuote?.provider === 'GHN' &&
    shippingQuote.status === 'quoted' &&
    shippingComparison?.comparisonStatus !== 'fallback';
  const shippingNeedsAddressMapping = Boolean(
    selectedAddress &&
    !shippingQuoteIsLive &&
    !addressHasShippingCodes,
  );
  const shippingProviderLabel = shippingQuote?.provider === 'GHN'
    ? 'GHN toi uu'
    : shippingComparison?.comparisonStatus === 'fallback'
      ? 'Phí tạm tính'
      : 'Gia toi uu';
  const shippingStatusText = isPreviewLoading
    ? 'Đang tính phí giao hàng...'
    : !selectedCheckoutItems.length
    ? 'Chọn sản phẩm để tính phí giao hàng.'
    : !selectedAddress
    ? 'Chọn địa chỉ nhận hàng để tính phí giao hàng.'
    : shippingComparison?.note
    ? shippingComparison.note
    : shippingNeedsAddressMapping
    ? 'Địa chỉ này chưa có dữ liệu tính phí tự động, hệ thống đang dùng phí tạm tính.'
    : shippingComparison?.comparisonStatus === 'live' || shippingComparison?.comparisonStatus === 'partial'
    ? 'Hệ thống đã chọn giải pháp giao hàng tối ưu cho địa chỉ này.'
    : shippingQuote?.status === 'quoted'
    ? 'Đã tính phí theo địa chỉ nhận hàng.'
    : 'Đang dùng phí tạm tính, shop sẽ đối soát lại khi xử lý đơn.';
  const canSubmit =
    selectedCheckoutItems.length > 0 &&
    unavailableSelectedItems.length === 0 &&
    Boolean(selectedAddress) &&
    Boolean(checkoutPreview?.quoteVersion) &&
    !isPreviewLoading &&
    !isSubmitting &&
    (paymentMethod === 'COD' || paymentMethod === 'VNPAY');

  React.useEffect(() => {
    const nextCouponCode = route.params?.couponCode?.trim().toUpperCase();
    if (!nextCouponCode || nextCouponCode === appliedCouponCode) {
      return;
    }

    setCouponCode(nextCouponCode);
    setAppliedCouponCode(nextCouponCode);
  }, [appliedCouponCode, route.params?.couponCode]);

  React.useEffect(() => {
    if (!session?.accessToken || !selectedCheckoutItems.length) {
      setCheckoutPreview(null);
      return;
    }

    let isActive = true;
    setIsPreviewLoading(true);

    runWithAuth((accessToken) =>
      cartApi.previewCheckout(accessToken, {
        cartItemIds: selectedCheckoutItems.map((item) => item._id),
        ...getCheckoutAddressPayload(),
        couponCode: appliedCouponCode ?? undefined,
        paymentMethod,
      }),
    )
      .then((preview) => {
        if (!isActive) return;

        setCheckoutPreview(preview);
        if (preview.coupon) {
          setCouponCode(preview.coupon.code);
          setAppliedCouponCode(preview.coupon.code);
        }
      })
      .catch((error) => {
        if (!isActive) return;

        setCheckoutPreview(null);
        if (appliedCouponCode) {
          setAppliedCouponCode(null);
          showNotice({
            tone: 'warning',
            title: 'Voucher không còn phù hợp',
            message: getErrorMessage(error),
          });
        }
      })
      .finally(() => {
        if (isActive) {
          setIsPreviewLoading(false);
        }
      });

    return () => {
      isActive = false;
    };
  }, [
    appliedCouponCode,
    paymentMethod,
    getCheckoutAddressPayload,
    runWithAuth,
    selectedAddressKey,
    selectedCheckoutItemKey,
    selectedCheckoutItems,
    session?.accessToken,
    showNotice,
  ]);

  const handleSearchSubmit = (keyword: string) => {
    navigation.navigate('ProductList', {
      title: `Tìm kiếm: ${keyword}`,
      keyword,
    });
  };

  const updateCartState = (nextCart: CartResponse) => {
    setCart(nextCart);
  };

  const handleSelectAddress = (address: UserAddress) => {
    setSelectedAddressId(address._id ?? null);
    applyAddressToForm(address);
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
      void loadCart(true);
    } finally {
      setPendingItemId(null);
    }
  };

  const handleRemoveItem = (item: CartItem) => {
    if (!session?.accessToken || pendingItemId) {
      return;
    }

    setConfirmingRemoveItemId((current) => (current === item._id ? null : item._id));
  };

  const confirmRemoveItem = async (item: CartItem) => {
    if (!session?.accessToken || pendingItemId) {
      return;
    }

    try {
      setPendingItemId(item._id);
      setConfirmingRemoveItemId(null);
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

  const handleApplyCoupon = async () => {
    const code = couponCode.trim();

    if (!session?.accessToken) {
      navigation.navigate('Login');
      return;
    }

    if (!code) {
      showNotice({
        tone: 'warning',
        title: 'Thiếu mã giảm giá',
        message: 'Bạn nhập mã voucher trước nha.',
      });
      return;
    }

    if (!selectedCheckoutItems.length) {
      showNotice({
        tone: 'warning',
        title: 'Giỏ hàng trống',
        message: 'Bạn chọn ít nhất một sản phẩm để áp dụng voucher.',
      });
      return;
    }

    try {
      setIsApplyingCoupon(true);
      const preview = await runWithAuth((accessToken) =>
        cartApi.previewCheckout(accessToken, {
          couponCode: code,
          cartItemIds: selectedCheckoutItems.map((item) => item._id),
          ...getCheckoutAddressPayload(),
          paymentMethod,
        }),
      );

      if (!preview.coupon) {
        throw new CartApiError('Voucher chưa được áp dụng cho đơn hàng này.');
      }

      setCheckoutPreview(preview);
      setAppliedCouponCode(preview.coupon.code);
      setCouponCode(preview.coupon.code);
      showNotice({
        tone: 'success',
        title: 'Đã áp dụng voucher',
        message: `${preview.coupon.code} đã được tính vào đơn hàng.`,
      }, 3200);
    } catch (error) {
      setCheckoutPreview(null);
      setAppliedCouponCode(null);
      showNotice({
        tone: 'error',
        title: 'Chưa áp dụng được voucher',
        message: getErrorMessage(error),
      });
    } finally {
      setIsApplyingCoupon(false);
    }
  };

  const handleClearCoupon = () => {
    setAppliedCouponCode(null);
    setCouponCode('');
  };

  const handleOpenCoupons = () => {
    if (!session?.accessToken) {
      navigation.navigate('Login');
      return;
    }

    navigation.navigate('Coupons', {
      cartItemIds: selectedCheckoutItems.map((item) => item._id),
      selectedCouponCode: appliedCouponCode,
    });
  };

  const handleSelectPaymentMethod = React.useCallback(
    (method: PaymentMethod) => {
      paymentMethodSelectionTouchedRef.current = true;
      setPaymentMethod(method);

      if (method !== 'VNPAY') {
        setSelectedPaymentMethodId(null);
        return;
      }

      setSelectedPaymentMethodId((current) => {
        if (
          current &&
          activeSavedPaymentMethods.some(
            (savedMethod) => savedMethod._id === current && savedMethod.type === 'VNPAY',
          )
        ) {
          return current;
        }

        return defaultVNPayPaymentMethod?._id ?? null;
      });
    },
    [activeSavedPaymentMethods, defaultVNPayPaymentMethod],
  );

  const validateCheckout = () => {
    if (!selectedAddress) {
      showNotice({
        tone: 'warning',
        title: 'Thiếu địa chỉ nhận hàng',
        message: 'Bạn chọn hoặc thêm địa chỉ trong hồ sơ trước khi đặt hàng.',
        actionLabel: 'Mở hồ sơ',
        onAction: () => navigation.navigate('EditProfile'),
      });
      return false;
    }

    const overStockItem = selectedItems.find((item) => {
      return item.availableQuantity !== undefined && item.quantity > item.availableQuantity;
    });

    if (overStockItem) {
      showNotice({
        tone: 'warning',
        title: 'Không đủ tồn kho',
        message: `${getItemTitle(overStockItem)} chỉ còn ${overStockItem.availableQuantity}.`,
      });
      return false;
    }

    return true;
  };

  const handleCheckout = async () => {
    if (!session?.accessToken) {
      navigation.navigate('Login');
      return;
    }

    if (!canSubmit || !validateCheckout()) {
      return;
    }

    if (!selectedAddress) {
      return;
    }

    if (!checkoutPreview?.quoteVersion) {
      showNotice({
        tone: 'warning',
        title: 'Đang cập nhật tổng tiền',
        message: 'Hệ thống cần tính lại phí giao hàng trước khi đặt hàng.',
      });
      return;
    }

    try {
      setIsSubmitting(true);
      const order = await runWithAuth((accessToken) => cartApi.createOrder(accessToken, {
        cartItemIds: selectedCheckoutItems.map((item) => item._id),
        paymentMethod,
        paymentMethodId: paymentMethod === 'VNPAY' ? selectedSavedPaymentMethod?._id : undefined,
        quoteVersion: checkoutPreview.quoteVersion,
        ...getCheckoutAddressPayload(),
        couponCode: appliedCouponCode ?? undefined,
        orderNote: form.note.trim() || undefined,
      }));

      // Dọn dẹp form ngay sau khi tạo đơn thành công
      setForm((current) => ({ ...current, note: '' }));
      handleClearCoupon();

      if (paymentMethod === 'VNPAY') {
        // Luồng VNPay: lấy link thanh toán rồi mở WebBrowser
        try {
          const paymentData = await runWithAuth((accessToken) =>
            paymentApi.createVNPayUrlFromOrder(accessToken, order._id),
          );

          void WebBrowser.openBrowserAsync(paymentData.paymentUrl, {
            presentationStyle: WebBrowser.WebBrowserPresentationStyle.FULL_SCREEN,
          }).catch((error) => {
            console.warn('Cannot open VNPay browser', error);
          });

          navigation.replace('OrderSuccess', {
            orderId: order._id,
            orderCode: order.orderCode,
            totalAmount: order.totalAmount,
            paymentMethod: 'VNPAY',
            paymentStatus: 'pending',
            isProcessingPayment: true,
          });
        } catch (paymentError) {
          const paymentMsg =
            paymentError instanceof PaymentApiError || paymentError instanceof Error
              ? paymentError.message
              : 'Không lấy được link thanh toán.';

          navigation.replace('OrderSuccess', {
            orderId: order._id,
            orderCode: order.orderCode,
            totalAmount: order.totalAmount,
            paymentMethod: 'VNPAY',
            paymentStatus: 'pending',
            paymentMessage: paymentMsg,
          });
        }
      } else {
        // Luồng COD: điều hướng thẳng đến màn hình thành công
        navigation.replace('OrderSuccess', {
          orderId: order._id,
          orderCode: order.orderCode,
          totalAmount: order.totalAmount,
          paymentMethod: 'COD',
          paymentStatus: 'pending',
        });
      }

      await loadCart(true);
    } catch (error) {
      if (error instanceof CartApiError && error.status === 409 && error.errorCode === 'QUOTE_CHANGED') {
        try {
          const refreshedPreview = await runWithAuth((accessToken) =>
            cartApi.previewCheckout(accessToken, {
              cartItemIds: selectedCheckoutItems.map((item) => item._id),
              ...getCheckoutAddressPayload(),
              couponCode: appliedCouponCode ?? undefined,
              paymentMethod,
            }),
          );

          setCheckoutPreview(refreshedPreview);
          showNotice({
            tone: 'warning',
            title: 'Phí giao hàng vừa thay đổi',
            message: 'Tổng tiền đã được cập nhật. Bạn vui lòng kiểm tra lại trước khi đặt hàng.',
          });
          return;
        } catch (refreshError) {
          setCheckoutPreview(null);
          showNotice({
            tone: 'warning',
            title: 'Cần cập nhật lại phí giao hàng',
            message: getErrorMessage(refreshError),
          });
          void loadCart(true);
          return;
        }
      }

      showNotice({
        tone: 'error',
        title: 'Chưa đặt được đơn',
        message: getErrorMessage(error),
      });
      void loadCart(true);
    } finally {
      setIsSubmitting(false);
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
          {confirmingRemoveItemId === item._id ? (
            <View style={styles.removeConfirmRow}>
              <Text style={styles.removeConfirmText} numberOfLines={1}>
                Xóa sản phẩm này?
              </Text>
              <TouchableOpacity
                style={styles.removeConfirmCancel}
                onPress={() => setConfirmingRemoveItemId(null)}
                activeOpacity={0.82}
              >
                <Text style={styles.removeConfirmCancelText}>Hủy</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.removeConfirmDelete}
                onPress={() => confirmRemoveItem(item)}
                activeOpacity={0.82}
              >
                <Text style={styles.removeConfirmDeleteText}>Xóa</Text>
              </TouchableOpacity>
            </View>
          ) : null}
        </View>
      </View>
    );
  };

  const renderInput = (
    placeholder: string,
    value: string,
    onChangeText: (value: string) => void,
    keyboardType?: 'default' | 'email-address' | 'phone-pad',
    multiline = false,
  ) => (
    <TextInput
      style={[styles.input, multiline && styles.inputMultiline]}
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={colors.textSubtle}
      keyboardType={keyboardType}
      multiline={multiline}
      scrollEnabled={multiline}
      textAlignVertical={multiline ? 'top' : 'center'}
    />
  );

  const renderPaymentOption = (
    method: PaymentMethod,
    title: string,
    icon: keyof typeof MaterialCommunityIcons.glyphMap,
    disabled = false,
    subtitle?: string,
  ) => {
    const selected = paymentMethod === method;

    return (
      <TouchableOpacity
        style={[styles.paymentOption, selected && styles.paymentOptionSelected, disabled && styles.paymentOptionDisabled]}
        onPress={() => (disabled ? undefined : handleSelectPaymentMethod(method))}
        disabled={disabled}
        activeOpacity={0.82}
      >
        <View style={[styles.radioOuter, selected && styles.radioOuterSelected]}>
          {selected ? <View style={styles.radioInner} /> : null}
        </View>
        <MaterialCommunityIcons name={icon} size={24} color={disabled ? colors.textSubtle : colors.brand} />
        <View style={styles.paymentTextBlock}>
          <Text style={[styles.paymentTitle, disabled && styles.paymentTitleDisabled]}>{title}</Text>
          {subtitle ? <Text style={styles.paymentSubtitle}>{subtitle}</Text> : null}
        </View>
      </TouchableOpacity>
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

  const renderAddressSection = () => {
    if (isAddressLoading) {
      return (
        <View style={styles.addressState}>
          <ActivityIndicator color={colors.brand} />
          <Text style={styles.addressStateText}>Đang tải địa chỉ nhận hàng</Text>
        </View>
      );
    }

    if (!addresses.length) {
      return (
        <View style={styles.addressEmpty}>
          <MaterialCommunityIcons name="map-marker-plus-outline" size={24} color={colors.brand} />
          <View style={styles.addressEmptyCopy}>
            <Text style={styles.addressEmptyTitle}>Chưa có địa chỉ nhận hàng</Text>
            <Text style={styles.addressEmptyText}>
              Địa chỉ tạo ở đăng ký hoặc trong hồ sơ sẽ được dùng để đặt hàng.
            </Text>
          </View>
          <TouchableOpacity
            style={styles.addressEditButton}
            onPress={() => navigation.navigate('EditProfile')}
            activeOpacity={0.82}
          >
            <Text style={styles.addressEditText}>Thêm</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <View style={styles.addressStack}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.addressChipRow}
        >
          {addresses.map((address, index) => {
            const isSelected = selectedAddress?._id === address._id;

            return (
              <TouchableOpacity
                key={getAddressKey(address, index)}
                style={[styles.addressChip, isSelected && styles.addressChipActive]}
                onPress={() => handleSelectAddress(address)}
                activeOpacity={0.82}
              >
                <MaterialCommunityIcons
                  name={address.isDefault ? 'star' : 'map-marker-outline'}
                  size={17}
                  color={isSelected ? colors.white : address.isDefault ? colors.goldDark : colors.brand}
                />
                <Text style={[styles.addressChipText, isSelected && styles.addressChipTextActive]} numberOfLines={1}>
                  {address.isDefault ? 'Mặc định' : `Địa chỉ ${index + 1}`}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {selectedAddress ? (
          <View style={styles.selectedAddressCard}>
            <View style={styles.selectedAddressHeader}>
              <View style={styles.selectedAddressIcon}>
                <MaterialCommunityIcons name="map-marker-check-outline" size={20} color={colors.white} />
              </View>
              <View style={styles.selectedAddressCopy}>
                <Text style={styles.selectedAddressName} numberOfLines={1}>
                  {selectedAddress.customerName} - {selectedAddress.phoneNumber}
                </Text>
                <Text style={styles.selectedAddressText} numberOfLines={2}>
                  {formatAddress(selectedAddress)}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.addressSmallButton}
                onPress={() => navigation.navigate('EditProfile')}
                activeOpacity={0.82}
              >
                <MaterialCommunityIcons name="pencil-outline" size={17} color={colors.brand} />
              </TouchableOpacity>
            </View>
            <View style={[styles.addressQuoteRow, shippingNeedsAddressMapping && styles.addressQuoteRowWarning]}>
              <MaterialCommunityIcons
                name={shippingNeedsAddressMapping ? 'alert-circle-outline' : 'check-circle-outline'}
                size={15}
                color={shippingNeedsAddressMapping ? colors.goldText : colors.success}
              />
              <Text style={[styles.addressQuoteText, shippingNeedsAddressMapping && styles.addressQuoteTextWarning]}>
                {!shippingNeedsAddressMapping
                  ? 'Địa chỉ đã sẵn sàng để tính phí giao hàng.'
                  : 'Đang dùng địa chỉ đã chọn; phí giao hàng tạm tính vì chưa có dữ liệu tính phí tự động.'}
              </Text>
            </View>
          </View>
        ) : null}
      </View>
    );
  };

  const renderShippingQuoteCard = () => (
    <View style={styles.shippingQuoteCard}>
      <View style={styles.shippingQuoteIcon}>
        {isPreviewLoading ? (
          <ActivityIndicator color={colors.brand} size="small" />
        ) : (
          <MaterialCommunityIcons name="truck-fast-outline" size={21} color={colors.brand} />
        )}
      </View>
      <View style={styles.shippingQuoteCopy}>
        <View style={styles.shippingQuoteTopRow}>
          <Text style={styles.shippingQuoteTitle}>Giao hàng tiêu chuẩn</Text>
          <Text style={styles.shippingQuoteFee}>
            {selectedCheckoutItems.length ? formatCurrency(shippingFee) : '--'}
          </Text>
        </View>
        <Text style={styles.shippingQuoteMeta}>{shippingProviderLabel} · {shippingStatusText}</Text>
        {shippingNeedsAddressMapping ? (
          <TouchableOpacity
            style={styles.shippingQuoteAction}
            onPress={() => navigation.navigate('EditProfile')}
            activeOpacity={0.82}
          >
            <Text style={styles.shippingQuoteActionText}>Quản lý địa chỉ</Text>
            <MaterialCommunityIcons name="chevron-right" size={16} color={colors.brand} />
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );

  const vnpayPaymentSubtitle = isPaymentMethodsLoading
    ? 'Đang tải phương thức thanh toán đã lưu...'
    : selectedSavedPaymentMethod
      ? `Dùng ${selectedSavedPaymentMethod.displayName}${
          selectedSavedPaymentMethod.maskedInfo ? ` - ${selectedSavedPaymentMethod.maskedInfo}` : ''
        }.`
      : pendingVNPayPaymentMethod
      ? 'VNPay đã lưu đang chờ xác minh, bạn vẫn có thể thanh toán qua cổng VNPay.'
      : 'Ví điện tử, thẻ ATM, thẻ quốc tế qua VNPAY Sandbox.';

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

        <View style={styles.sectionBlock}>
          <Text style={styles.sectionTitle}>Thông tin đơn hàng</Text>
          <View style={styles.formStack}>
            {renderAddressSection()}
            {renderShippingQuoteCard()}
            {renderInput('Email', form.email, (value) => setForm((current) => ({ ...current, email: value })), 'email-address')}
            {renderInput(
              'Ghi chú thêm (Ví dụ: giao hàng giờ hành chính)',
              form.note,
              (value) => setForm((current) => ({ ...current, note: value })),
              'default',
              true,
            )}
          </View>
        </View>

        <View style={styles.sectionBlock}>
          <Text style={styles.sectionTitle}>Hình thức thanh toán</Text>
          <View style={styles.paymentStack}>
            {renderPaymentOption(
              'COD',
              'Thanh toán khi giao hàng (COD)',
              'truck-delivery-outline',
              false,
              'Khách hàng được kiểm tra hàng trước khi nhận.',
            )}
            {renderPaymentOption('VNPAY', 'Thanh toán qua VNPAY', 'credit-card-outline', false, vnpayPaymentSubtitle)}
            {renderPaymentOption('MOMO', 'Thanh toán MoMo', 'wallet-outline', true, 'Sắp kết nối — MoMo chưa được tích hợp.')}
          </View>
        </View>

        <View style={styles.sectionBlock}>
          <Text style={styles.sectionTitle}>Ưu đãi dành cho bạn</Text>
          <View style={styles.promoStack}>
            <View style={styles.couponCard}>
              <View style={styles.couponInputRow}>
                <TextInput
                  style={styles.couponInput}
                  value={couponCode}
                  onChangeText={(value) => {
                    setCouponCode(value.toUpperCase());
                    if (appliedCouponCode && value.trim().toUpperCase() !== appliedCouponCode) {
                      setAppliedCouponCode(null);
                    }
                  }}
                  placeholder="Nhập mã voucher"
                  placeholderTextColor={colors.textSubtle}
                  autoCapitalize="characters"
                  editable={!isApplyingCoupon}
                />
                <TouchableOpacity
                  style={[
                    styles.couponApplyButton,
                    (!couponCode.trim() || isApplyingCoupon || !selectedCheckoutItems.length) &&
                      styles.couponApplyButtonDisabled,
                  ]}
                  onPress={handleApplyCoupon}
                  disabled={!couponCode.trim() || isApplyingCoupon || !selectedCheckoutItems.length}
                  activeOpacity={0.82}
                >
                  {isApplyingCoupon ? (
                    <ActivityIndicator color={colors.white} size="small" />
                  ) : (
                    <Text style={styles.couponApplyText}>Áp dụng</Text>
                  )}
                </TouchableOpacity>
              </View>
              <TouchableOpacity
                style={styles.couponListButton}
                onPress={handleOpenCoupons}
                activeOpacity={0.82}
                disabled={!selectedCheckoutItems.length}
              >
                <MaterialCommunityIcons name="ticket-percent-outline" size={18} color={colors.brand} />
                <Text style={styles.couponListText}>Chọn voucher khả dụng</Text>
                <MaterialCommunityIcons name="chevron-right" size={20} color={colors.brand} />
              </TouchableOpacity>
              {appliedCoupon ? (
                <View style={styles.couponAppliedRow}>
                  <View style={styles.couponAppliedCopy}>
                    <Text style={styles.couponAppliedTitle}>{appliedCoupon.name}</Text>
                    <Text style={styles.couponAppliedMeta}>
                      Mã {appliedCoupon.code} đang được tính vào đơn hàng
                    </Text>
                  </View>
                  <TouchableOpacity onPress={handleClearCoupon} activeOpacity={0.82}>
                    <Text style={styles.couponClearText}>Bỏ</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <Text style={styles.couponHint}>
                  {isPreviewLoading
                    ? 'Đang tính lại voucher, phí ship và tổng tiền...'
                    : 'Voucher sẽ được kiểm tra theo sản phẩm, địa chỉ giao hàng và hạng thành viên.'}
                </Text>
              )}
            </View>

            <View style={styles.memberCard}>
              <View style={styles.memberBadge}>
                <Text style={styles.memberBadgeText}>
                  {appliedMembership?.name?.charAt(0).toUpperCase() ?? 'M'}
                </Text>
              </View>
              <View style={styles.memberInfo}>
                <Text style={styles.memberTitle}>
                  {appliedMembership
                    ? `Hạng thẻ: ${appliedMembership.name}`
                    : 'Ưu đãi thành viên'}
                </Text>
                <Text style={styles.memberMeta}>
                  {isPreviewLoading
                    ? 'Đang tính ưu đãi theo hạng...'
                    : membershipDiscountAmount
                    ? `Đã giảm ${formatCurrency(membershipDiscountAmount)} theo hạng hiện tại.`
                    : appliedMembership
                    ? 'Hạng hiện tại chưa có giảm giá trực tiếp.'
                    : 'Đăng nhập và tích điểm để nhận ưu đãi theo hạng.'}
                </Text>
              </View>
              <Text style={styles.memberDiscount}>
                {appliedMembership
                  ? appliedMembership.discountPercent > 0
                    ? `-${appliedMembership.discountPercent}%`
                    : '0%'
                  : '-'}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.summaryPanel}>
          {unavailableSelectedItems.length ? (
            <View style={styles.checkoutWarning}>
              <MaterialCommunityIcons name="alert-circle-outline" size={18} color={colors.danger} />
              <Text style={styles.checkoutWarningText}>
                Có sản phẩm đã chọn không còn đủ tồn kho. Bạn giảm số lượng, bỏ chọn hoặc xóa sản phẩm đó trước khi đặt hàng.
              </Text>
            </View>
          ) : null}
          <View style={styles.summaryLine}>
            <Text style={styles.summaryLabel}>Tạm tính:</Text>
            <Text style={styles.summaryValue}>{formatCurrency(subTotal)}</Text>
          </View>
          <View style={styles.summaryLine}>
            <Text style={styles.summaryLabel}>Phí giao hàng:</Text>
            <Text style={styles.summaryValue}>
              {selectedCheckoutItems.length ? formatCurrency(shippingFee) : '--'}
            </Text>
          </View>
          <View style={styles.summaryLine}>
            <Text style={styles.summaryLabel}>Giảm phí vận chuyển:</Text>
            <Text style={shippingDiscountAmount > 0 ? styles.summaryDiscount : styles.summaryValue}>
              {shippingDiscountAmount > 0 ? `-${formatCurrency(shippingDiscountAmount)}` : '0đ'}
            </Text>
          </View>
          <View style={styles.summaryLine}>
            <Text style={styles.summaryLabel}>Voucher{appliedCouponCode ? ` (${appliedCouponCode})` : ''}:</Text>
            <Text style={couponDiscountAmount > 0 ? styles.summaryDiscount : styles.summaryValue}>
              {couponDiscountAmount > 0 ? `-${formatCurrency(couponDiscountAmount)}` : '0đ'}
            </Text>
          </View>
          <View style={styles.summaryLine}>
            <Text style={styles.summaryLabel}>Khách hàng thân thiết:</Text>
            <Text style={membershipDiscountAmount > 0 ? styles.summaryDiscount : styles.summaryValue}>
              {membershipDiscountAmount > 0 ? `-${formatCurrency(membershipDiscountAmount)}` : '0đ'}
            </Text>
          </View>
          <View style={styles.totalLine}>
            <Text style={styles.totalLabel}>Tổng:</Text>
            <Text style={styles.totalValue}>{formatCurrency(totalAmount)}</Text>
          </View>
        </View>

        <Pressable
          style={[styles.checkoutButton, !canSubmit && styles.checkoutButtonDisabled]}
          onPress={handleCheckout}
          disabled={!canSubmit}
        >
          {isSubmitting ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <Text style={styles.checkoutText}>Đặt hàng</Text>
          )}
        </Pressable>
      </>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <StorefrontHeader
        menuIcon="arrow-left"
        menuAccessibilityLabel="Trở về"
        onMenuPress={() => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Home'))}
        onProfilePress={() => navigation.navigate(isAuthenticated ? 'Profile' : 'Login')}
        onFavoritesPress={() => navigation.navigate(isAuthenticated ? 'Favorites' : 'Login')}
        onCartPress={() => loadCart(true)}
        onSearchSubmit={handleSearchSubmit}
        onImageSearchPress={() => showNotice({
          tone: 'info',
          title: 'Tìm kiếm ảnh',
          message: 'Tính năng này sẽ được bổ sung ở bước sau.',
        })}
        isAuthenticated={isAuthenticated}
        userName={session?.user.name}
        avatarImage={session?.user.avatarImage}
      />

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        nestedScrollEnabled
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={() => loadCart(true)} tintColor={colors.brand} />
        }
      >
        {renderNotice()}
        {renderContent()}
        <View style={styles.footerGap}>
          <StorefrontFooter />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.brand,
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
  removeConfirmRow: {
    minHeight: 36,
    borderRadius: radii.xs,
    backgroundColor: colors.dangerSoft,
    paddingHorizontal: spacing.sm,
    marginTop: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  removeConfirmText: {
    flex: 1,
    minWidth: 0,
    color: colors.danger,
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '900',
  },
  removeConfirmCancel: {
    minWidth: 44,
    height: 26,
    borderRadius: radii.xs,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
  },
  removeConfirmCancelText: {
    color: colors.text,
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '900',
  },
  removeConfirmDelete: {
    minWidth: 44,
    height: 26,
    borderRadius: radii.xs,
    backgroundColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
  },
  removeConfirmDeleteText: {
    color: colors.white,
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '900',
  },
  sectionBlock: {
    paddingHorizontal: spacing.md,
    marginTop: spacing.xxl,
  },
  sectionTitle: {
    color: colors.black,
    fontSize: 19,
    lineHeight: 25,
    fontWeight: '800',
    marginBottom: spacing.md,
  },
  formStack: {
    gap: spacing.md,
  },
  addressState: {
    minHeight: 86,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  addressStateText: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
  },
  addressEmpty: {
    minHeight: 92,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.brandPale,
    backgroundColor: colors.surface,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  addressEmptyCopy: {
    flex: 1,
    minWidth: 0,
  },
  addressEmptyTitle: {
    color: colors.black,
    fontSize: 14,
    lineHeight: 19,
    fontWeight: '800',
  },
  addressEmptyText: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 2,
  },
  addressEditButton: {
    minHeight: 34,
    borderRadius: radii.xs,
    backgroundColor: colors.brand,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addressEditText: {
    color: colors.white,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '900',
  },
  addressStack: {
    gap: spacing.sm,
  },
  addressChipRow: {
    gap: spacing.sm,
    paddingRight: spacing.sm,
  },
  addressChip: {
    maxWidth: 142,
    height: 34,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.brandPale,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  addressChipActive: {
    borderColor: colors.brand,
    backgroundColor: colors.brand,
  },
  addressChipText: {
    flexShrink: 1,
    color: colors.brand,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '800',
  },
  addressChipTextActive: {
    color: colors.white,
  },
  selectedAddressCard: {
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.md,
  },
  selectedAddressHeader: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  selectedAddressIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectedAddressCopy: {
    flex: 1,
    minWidth: 0,
  },
  selectedAddressName: {
    color: colors.black,
    fontSize: 14,
    lineHeight: 19,
    fontWeight: '900',
  },
  selectedAddressText: {
    color: colors.textBody,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 3,
  },
  addressQuoteRow: {
    minHeight: 32,
    borderRadius: radii.xs,
    backgroundColor: colors.successSoft,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: spacing.sm,
  },
  addressQuoteRowWarning: {
    backgroundColor: colors.goldSoft,
  },
  addressQuoteText: {
    flex: 1,
    minWidth: 0,
    color: colors.success,
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '800',
  },
  addressQuoteTextWarning: {
    color: colors.goldText,
  },
  addressSmallButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.brandSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shippingQuoteCard: {
    minHeight: 86,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.brandPale,
    backgroundColor: colors.brandSoft,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  shippingQuoteIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shippingQuoteCopy: {
    flex: 1,
    minWidth: 0,
  },
  shippingQuoteTopRow: {
    minHeight: 22,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  shippingQuoteTitle: {
    flex: 1,
    minWidth: 0,
    color: colors.black,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '900',
  },
  shippingQuoteFee: {
    color: colors.black,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '900',
  },
  shippingQuoteMeta: {
    color: colors.textMuted,
    fontSize: 11,
    lineHeight: 16,
    marginTop: 4,
  },
  shippingQuoteAction: {
    alignSelf: 'flex-start',
    minHeight: 30,
    marginTop: spacing.sm,
    borderRadius: radii.xs,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  shippingQuoteActionText: {
    color: colors.brand,
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '900',
  },
  input: {
    minHeight: 46,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    color: colors.text,
    fontSize: 14,
  },
  inputMultiline: {
    minHeight: 104,
    maxHeight: 150,
    paddingTop: 13,
    paddingBottom: 13,
  },
  paymentStack: {
    gap: spacing.md,
  },
  paymentOption: {
    minHeight: 58,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  paymentOptionSelected: {
    borderColor: colors.black,
  },
  paymentOptionDisabled: {
    opacity: 0.72,
  },
  radioOuter: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOuterSelected: {
    borderColor: colors.black,
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.black,
  },
  paymentTextBlock: {
    flex: 1,
    minWidth: 0,
  },
  paymentTitle: {
    color: colors.black,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '800',
  },
  paymentTitleDisabled: {
    color: colors.textMuted,
  },
  paymentSubtitle: {
    color: colors.textMuted,
    fontSize: 11,
    lineHeight: 16,
    marginTop: 2,
  },
  promoStack: {
    gap: spacing.md,
  },
  couponCard: {
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.brandPale,
    backgroundColor: colors.surface,
    padding: spacing.md,
    gap: spacing.sm,
  },
  couponInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  couponInput: {
    flex: 1,
    minWidth: 0,
    height: 42,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
    paddingHorizontal: spacing.md,
    color: colors.black,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '800',
  },
  couponApplyButton: {
    minWidth: 88,
    height: 42,
    borderRadius: radii.sm,
    backgroundColor: colors.black,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  couponApplyButtonDisabled: {
    opacity: 0.45,
  },
  couponApplyText: {
    color: colors.white,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '900',
  },
  couponHint: {
    color: colors.textMuted,
    fontSize: 11,
    lineHeight: 16,
  },
  couponListButton: {
    minHeight: 38,
    borderRadius: radii.sm,
    backgroundColor: colors.brandSoft,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  couponListText: {
    flex: 1,
    minWidth: 0,
    color: colors.brand,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '900',
  },
  couponAppliedRow: {
    borderRadius: radii.sm,
    backgroundColor: colors.successSoft,
    padding: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  couponAppliedCopy: {
    flex: 1,
    minWidth: 0,
  },
  couponAppliedTitle: {
    color: colors.black,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '900',
  },
  couponAppliedMeta: {
    color: colors.textMuted,
    fontSize: 11,
    lineHeight: 15,
    marginTop: 2,
  },
  couponClearText: {
    color: colors.danger,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '900',
  },
  promoCard: {
    minHeight: 62,
    borderRadius: radii.sm,
    borderWidth: 1,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
  },
  promoOrange: {
    borderColor: '#FF7A1A',
    borderStyle: 'dashed',
  },
  promoBlue: {
    borderColor: colors.action,
    borderStyle: 'dashed',
  },
  promoBadge: {
    minWidth: 62,
    minHeight: 28,
    borderRadius: radii.xs,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
  },
  promoBadgeOrange: {
    backgroundColor: '#FF6B00',
  },
  promoBadgeBlue: {
    backgroundColor: colors.action,
  },
  promoBadgeText: {
    color: colors.white,
    fontSize: 9,
    lineHeight: 12,
    fontWeight: '900',
  },
  promoBody: {
    flex: 1,
    minWidth: 0,
  },
  promoTitle: {
    color: colors.black,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '800',
  },
  promoMeta: {
    color: colors.textMuted,
    fontSize: 11,
    lineHeight: 16,
    marginTop: 2,
  },
  memberCard: {
    minHeight: 78,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  memberBadge: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FFD400',
    alignItems: 'center',
    justifyContent: 'center',
  },
  memberBadgeText: {
    color: colors.black,
    fontSize: 19,
    lineHeight: 24,
    fontWeight: '900',
  },
  memberInfo: {
    flex: 1,
    minWidth: 0,
  },
  memberTitle: {
    color: colors.black,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '800',
  },
  memberMeta: {
    color: colors.textMuted,
    fontSize: 11,
    lineHeight: 16,
    marginTop: 2,
  },
  memberDiscount: {
    color: colors.action,
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '900',
  },
  summaryPanel: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xl,
    gap: spacing.sm,
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
  },
  checkoutWarningText: {
    flex: 1,
    color: colors.danger,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '700',
  },
  summaryLine: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  summaryLabel: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 19,
  },
  summaryValue: {
    color: colors.black,
    fontSize: 14,
    lineHeight: 19,
    fontWeight: '800',
  },
  summaryDiscount: {
    color: colors.success,
    fontSize: 14,
    lineHeight: 19,
    fontWeight: '800',
  },
  freeText: {
    color: colors.success,
  },
  totalLine: {
    marginTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  totalLabel: {
    color: colors.black,
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '900',
  },
  totalValue: {
    color: colors.text,
    fontSize: 21,
    lineHeight: 28,
    fontWeight: '900',
  },
  checkoutButton: {
    minHeight: 56,
    borderRadius: radii.sm,
    backgroundColor: colors.black,
    marginHorizontal: spacing.md,
    marginTop: spacing.lg,
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
  footerGap: {
    paddingTop: spacing.xxl,
    backgroundColor: colors.background,
  },
});

export default CartScreen;
