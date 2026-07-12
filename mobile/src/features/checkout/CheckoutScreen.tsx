import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import { brandedHeaderStyles, colors, radii, spacing } from '../../theme';
import type { RootStackParamList } from '../../navigation/AppNavigator';
import { useStaleFocusEffect } from '../../hooks/useStaleFocusEffect';
import { useAuth } from '../auth/AuthContext';
import { accountApi, type UserAddress } from '../account/accountApi';
import {
  paymentMethodsApi,
  type PaymentMethodRecord as SavedPaymentMethodRecord,
} from '../account/paymentMethodsApi';
import { cartApi, CartApiError, type CartItem, type CartResponse, type CheckoutPreviewResponse } from '../cart/cartApi';
import { paymentApi, PaymentApiError } from '../payments/paymentApi';
import * as WebBrowser from 'expo-web-browser';
import * as Crypto from 'expo-crypto';

type CheckoutNavigationProp = StackNavigationProp<RootStackParamList, 'Checkout'>;
type CheckoutRouteProp = RouteProp<RootStackParamList, 'Checkout'>;
type PaymentMethod = 'COD' | 'VNPAY' | 'MOMO';
type NoticeTone = 'success' | 'error' | 'warning' | 'info';

type CheckoutNotice = {
  id: number;
  tone: NoticeTone;
  title: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
};

const formatCurrency = (value: number) =>
  `${Math.round(value).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')}đ`;

const CHECKOUT_PREVIEW_DEBOUNCE_MS = 450;

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

const compactAddressParts = (address: UserAddress) =>
  [address.streetName, address.ward, address.province].map((item) => item?.trim()).filter(Boolean);

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

const CheckoutScreen = () => {
  const navigation = useNavigation<CheckoutNavigationProp>();
  const route = useRoute<CheckoutRouteProp>();
  const { isAuthenticated, session, runWithAuth } = useAuth();
  const [cart, setCart] = React.useState<CartResponse | null>(null);
  const [addresses, setAddresses] = React.useState<UserAddress[]>([]);
  const [selectedAddressId, setSelectedAddressId] = React.useState<string | null>(null);
  const [isAddressLoading, setIsAddressLoading] = useState(false);
  const [paymentMethods, setPaymentMethods] = React.useState<SavedPaymentMethodRecord[]>([]);
  const [selectedPaymentMethodId, setSelectedPaymentMethodId] = React.useState<string | null>(null);
  const [isPaymentMethodsLoading, setIsPaymentMethodsLoading] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('COD');
  const [couponCode, setCouponCode] = useState('');
  const [appliedCouponCodes, setAppliedCouponCodes] = useState<string[]>([]);
  const [checkoutPreview, setCheckoutPreview] = useState<CheckoutPreviewResponse | null>(null);
  const [checkoutPreviewKey, setCheckoutPreviewKey] = useState('');
  const [isApplyingCoupon, setIsApplyingCoupon] = useState(false);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [notice, setNotice] = useState<CheckoutNotice | null>(null);
  const [form, setForm] = useState({
    fullName: session?.user.name ?? '',
    phone: session?.user.phone ?? '',
    email: session?.user.email ?? '',
    address: '',
    note: '',
  });
  const noticeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const paymentMethodSelectionTouchedRef = useRef(false);

  const selectedAddress = useMemo(
    () =>
      addresses.find((address) => address._id && address._id === selectedAddressId) ??
      addresses.find((address) => address.isDefault) ??
      addresses[0] ??
      null,
    [addresses, selectedAddressId],
  );
  const selectedShippingAddress = useMemo(
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
  const activeSavedPaymentMethods = useMemo(
    () => paymentMethods.filter((method) => method.status === 'verified'),
    [paymentMethods],
  );
  const defaultVNPayPaymentMethod = useMemo(
    () =>
      activeSavedPaymentMethods.find((method) => method.type === 'VNPAY' && method.isDefault) ??
      activeSavedPaymentMethods.find((method) => method.type === 'VNPAY') ??
      null,
    [activeSavedPaymentMethods],
  );
  const pendingVNPayPaymentMethod = useMemo(
    () => paymentMethods.find((method) => method.type === 'VNPAY' && method.status === 'pending') ?? null,
    [paymentMethods],
  );
  const selectedSavedPaymentMethod = useMemo(
    () =>
      activeSavedPaymentMethods.find((method) => method._id === selectedPaymentMethodId && method.type === 'VNPAY') ??
      null,
    [activeSavedPaymentMethods, selectedPaymentMethodId],
  );
  const checkoutCartItemIds = useMemo(
    () => Array.from(new Set((route.params?.cartItemIds ?? []).map((itemId) => itemId.trim()).filter(Boolean))),
    [route.params?.cartItemIds],
  );
  const checkoutCartItemIdsKey = checkoutCartItemIds.join('|');
  const checkoutCartItemIdSet = useMemo(
    () => new Set(checkoutCartItemIds),
    [checkoutCartItemIds],
  );
  const hasScopedCheckoutItems = checkoutCartItemIds.length > 0;

  const clearNoticeTimer = useCallback(() => {
    if (noticeTimeoutRef.current) {
      clearTimeout(noticeTimeoutRef.current);
      noticeTimeoutRef.current = null;
    }
  }, []);

  const dismissNotice = useCallback(() => {
    clearNoticeTimer();
    setNotice(null);
  }, [clearNoticeTimer]);

  const showNotice = useCallback(
    (nextNotice: Omit<CheckoutNotice, 'id'>, durationMs = 4500) => {
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

  useEffect(() => clearNoticeTimer, [clearNoticeTimer]);

  const getCheckoutAddressPayload = useCallback(
    () => ({
      addressId: selectedAddress?._id,
      shippingAddress: selectedAddress?._id ? undefined : selectedShippingAddress,
    }),
    [selectedAddress?._id, selectedShippingAddress],
  );

  const applyAddressToForm = useCallback((address: UserAddress | null) => {
    if (!address) return;

    setForm((current) => ({
      ...current,
      fullName: address.customerName || current.fullName,
      phone: address.phoneNumber || current.phone,
      address: formatAddress(address),
    }));
  }, []);

  useEffect(() => {
    setForm((current) => ({
      ...current,
      fullName: current.fullName || session?.user.name || '',
      phone: current.phone || session?.user.phone || '',
      email: current.email || session?.user.email || '',
    }));
  }, [session?.user.email, session?.user.name, session?.user.phone]);

  const loadCart = useCallback(
    async (silent = false) => {
      if (!session?.accessToken) {
        setCart(null);
        setIsLoading(false);
        return;
      }

      if (!silent) setIsLoading(true);

      try {
        const nextCart = await runWithAuth((accessToken) => cartApi.getCart(accessToken));
        setCart(nextCart);
      } catch (error) {
        showNotice({
          tone: 'error',
          title: 'Không tải được giỏ hàng',
          message: getErrorMessage(error),
        });
      } finally {
        if (!silent) setIsLoading(false);
      }
    },
    [runWithAuth, session?.accessToken, showNotice],
  );

  const loadAddresses = useCallback(
    async () => {
      if (!session?.accessToken) {
        setAddresses([]);
        return;
      }

      setIsAddressLoading(true);
      try {
        const nextAddresses = await runWithAuth((accessToken) => accountApi.getAddresses(accessToken));
        setAddresses(nextAddresses);

        const defaultAddress = nextAddresses.find((address) => address.isDefault) ?? nextAddresses[0] ?? null;
        setSelectedAddressId(defaultAddress?._id ?? null);
        applyAddressToForm(defaultAddress);
      } catch (error) {
        showNotice({
          tone: 'error',
          title: 'Không tải được địa chỉ',
          message: getErrorMessage(error),
        });
      } finally {
        setIsAddressLoading(false);
      }
    },
    [applyAddressToForm, runWithAuth, session?.accessToken, showNotice],
  );

  const loadPaymentMethods = useCallback(
    async () => {
      if (!session?.accessToken) {
        setPaymentMethods([]);
        return;
      }

      setIsPaymentMethodsLoading(true);
      try {
        const nextPaymentMethods = await runWithAuth((accessToken) => paymentMethodsApi.list(accessToken));
        setPaymentMethods(nextPaymentMethods);
      } catch (error) {
        showNotice({
          tone: 'error',
          title: 'Không tải được phương thức thanh toán',
          message: getErrorMessage(error),
        });
      } finally {
        setIsPaymentMethodsLoading(false);
      }
    },
    [runWithAuth, session?.accessToken, showNotice],
  );

  useStaleFocusEffect(
    () => {
      void loadCart();
      void loadAddresses();
      void loadPaymentMethods();
    },
    [loadAddresses, loadCart, loadPaymentMethods],
    { staleMs: 20 * 1000 },
  );

  useEffect(() => {
    if (paymentMethod !== 'VNPAY') {
      if (selectedPaymentMethodId) setSelectedPaymentMethodId(null);
      return;
    }

    if (
      selectedPaymentMethodId &&
      !activeSavedPaymentMethods.some((method) => method._id === selectedPaymentMethodId && method.type === 'VNPAY')
    ) {
      setSelectedPaymentMethodId(defaultVNPayPaymentMethod?._id ?? null);
    }
  }, [activeSavedPaymentMethods, defaultVNPayPaymentMethod, paymentMethod, selectedPaymentMethodId]);

  const selectedItems = useMemo(
    () => {
      const cartItems = cart?.product_list ?? [];

      if (hasScopedCheckoutItems) {
        return cartItems.filter((item) => checkoutCartItemIdSet.has(item._id));
      }

      return cartItems.filter((item) => item.isSelected);
    },
    [cart?.product_list, checkoutCartItemIdSet, hasScopedCheckoutItems],
  );
  const selectedCheckoutItems = useMemo(
    () => selectedItems.filter((item) => item.isAvailable !== false),
    [selectedItems],
  );
  const selectedCheckoutItemKey = useMemo(
    () => selectedCheckoutItems.map((item) => `${item._id}:${item.quantity}:${item.priceAtAddedTime}:${item.isAvailable}`).join('|'),
    [selectedCheckoutItems],
  );
  const checkoutPreviewRequestKey = useMemo(
    () => [selectedCheckoutItemKey, selectedAddressKey, appliedCouponCodes.join(','), paymentMethod].join('::'),
    [appliedCouponCodes, paymentMethod, selectedAddressKey, selectedCheckoutItemKey],
  );
  const checkoutPreviewIsCurrent = Boolean(checkoutPreview && checkoutPreviewKey === checkoutPreviewRequestKey);
  const unavailableSelectedItems = selectedItems.filter((item) => item.isAvailable === false);

  const localSubTotal = selectedCheckoutItems.reduce((sum, item) => sum + item.quantity * item.priceAtAddedTime, 0);
  const checkoutSummary = checkoutPreview?.summary ?? {
    subTotal: localSubTotal,
    shippingFee: 0,
    couponDiscountAmount: 0,
    shippingDiscountAmount: 0,
    membershipDiscountAmount: 0,
    taxAmount: 0,
    totalAmount: localSubTotal,
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
  const appliedCoupons = checkoutPreview?.coupons?.length ? checkoutPreview.coupons : appliedCoupon ? [appliedCoupon] : [];
  const appliedCouponCode = appliedCouponCodes[0] ?? null;
  const shippingQuote = checkoutPreview?.shippingQuote ?? null;
  const shippingComparison = checkoutPreview?.shippingComparison ?? null;
  const shippingPayable = selectedCheckoutItems.length ? Math.max(0, shippingFee - shippingDiscountAmount) : 0;
  const isShippingFreeForUser = selectedCheckoutItems.length > 0 && shippingPayable === 0;
  const addressHasShippingCodes = hasShippingAreaCode(selectedAddress);
  const shippingQuoteIsLive =
    shippingQuote?.provider === 'GHN' && shippingQuote.status === 'quoted' && shippingComparison?.comparisonStatus !== 'fallback';
  const shippingNeedsAddressMapping = Boolean(selectedAddress && !shippingQuoteIsLive && !addressHasShippingCodes);
  const shippingProviderLabel = shippingQuote?.provider === 'GHN'
    ? 'GHN tối ưu'
    : shippingComparison?.comparisonStatus === 'fallback'
      ? 'Phí tạm tính'
      : 'Giá tối ưu';
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
  const savingsAmount = couponDiscountAmount + shippingDiscountAmount + membershipDiscountAmount;
  const canSubmit =
    selectedCheckoutItems.length > 0 &&
    unavailableSelectedItems.length === 0 &&
    Boolean(selectedAddress) &&
    Boolean(checkoutPreview?.quoteVersion) &&
    checkoutPreviewIsCurrent &&
    !isPreviewLoading &&
    !isSubmitting &&
    (paymentMethod === 'COD' || paymentMethod === 'VNPAY');

  useEffect(() => {
    const nextCouponCode = route.params?.couponCode?.trim().toUpperCase();
    if (!nextCouponCode || appliedCouponCodes.includes(nextCouponCode)) return;

    setCouponCode(nextCouponCode);
    setAppliedCouponCodes((current) => [...current, nextCouponCode].slice(0, 3));
  }, [appliedCouponCodes, route.params?.couponCode]);

  useEffect(() => {
    if (route.params?.couponCode) return;

    setCouponCode('');
    setAppliedCouponCodes([]);
  }, [checkoutCartItemIdsKey, route.params?.couponCode]);

  useEffect(() => {
    if (!session?.accessToken || !selectedCheckoutItems.length) {
      setCheckoutPreview(null);
      setCheckoutPreviewKey('');
      setIsPreviewLoading(false);
      return;
    }

    let isActive = true;
    setIsPreviewLoading(true);
    const previewKey = checkoutPreviewRequestKey;

    const handle = setTimeout(() => {
      runWithAuth((accessToken) =>
        cartApi.previewCheckout(accessToken, {
          cartItemIds: selectedCheckoutItems.map((item) => item._id),
          ...getCheckoutAddressPayload(),
          couponCodes: appliedCouponCodes.length ? appliedCouponCodes : undefined,
          paymentMethod,
        }),
      )
        .then((preview) => {
          if (!isActive) return;

          setCheckoutPreview(preview);
          setCheckoutPreviewKey(previewKey);
          const previewCodes = preview.coupons?.map((coupon) => coupon.code) ?? (preview.coupon ? [preview.coupon.code] : []);
          if (previewCodes.length) {
            setCouponCode('');
            setAppliedCouponCodes((current) => (
              current.length === previewCodes.length && current.every((code, index) => code === previewCodes[index])
                ? current
                : previewCodes
            ));
          }
        })
        .catch((error) => {
          if (!isActive) return;

          setCheckoutPreview(null);
          setCheckoutPreviewKey('');
          if (appliedCouponCodes.length) {
            setAppliedCouponCodes([]);
            showNotice({ tone: 'warning', title: 'Voucher không còn phù hợp', message: getErrorMessage(error) });
          }
        })
        .finally(() => {
          if (isActive) setIsPreviewLoading(false);
        });
    }, CHECKOUT_PREVIEW_DEBOUNCE_MS);

    return () => {
      isActive = false;
      clearTimeout(handle);
    };
  }, [
    appliedCouponCodes,
    checkoutPreviewRequestKey,
    paymentMethod,
    getCheckoutAddressPayload,
    runWithAuth,
    selectedAddressKey,
    selectedCheckoutItemKey,
    selectedCheckoutItems,
    session?.accessToken,
    showNotice,
  ]);

  const handleSelectAddress = (address: UserAddress) => {
    setSelectedAddressId(address._id ?? null);
    applyAddressToForm(address);
  };

  const handleSelectPaymentMethod = useCallback(
    (method: PaymentMethod) => {
      paymentMethodSelectionTouchedRef.current = true;
      setPaymentMethod(method);

      if (method !== 'VNPAY') {
        setSelectedPaymentMethodId(null);
        return;
      }

      setSelectedPaymentMethodId((current) => {
        if (current && activeSavedPaymentMethods.some((savedMethod) => savedMethod._id === current && savedMethod.type === 'VNPAY')) {
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

    const overStockItem = selectedItems.find((item) => item.availableQuantity !== undefined && item.quantity > item.availableQuantity);
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

    if (paymentMethod === 'MOMO') {
      showNotice({
        tone: 'warning',
        title: 'MoMo chưa sẵn sàng',
        message: 'Cổng MoMo chưa được tích hợp. Bạn chọn COD hoặc VNPay để đặt hàng nha.',
      });
      return;
    }

    if (!canSubmit || !validateCheckout()) return;

    if (!selectedAddress) return;

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
      const idempotencyKey = Crypto.randomUUID();
      const order = await runWithAuth((accessToken) => cartApi.createOrder(accessToken, {
        cartItemIds: selectedCheckoutItems.map((item) => item._id),
        paymentMethod,
        paymentMethodId: paymentMethod === 'VNPAY' ? selectedSavedPaymentMethod?._id : undefined,
        quoteVersion: checkoutPreview.quoteVersion,
        ...getCheckoutAddressPayload(),
        couponCodes: appliedCouponCodes.length ? appliedCouponCodes : undefined,
        orderNote: form.note.trim() || undefined,
      }, idempotencyKey));

      setForm((current) => ({ ...current, note: '' }));
      handleClearCoupon();

      if (paymentMethod === 'VNPAY') {
        try {
          const paymentData = await runWithAuth((accessToken) => paymentApi.createVNPayUrlFromOrder(accessToken, order._id));
          try {
            await WebBrowser.openBrowserAsync(paymentData.paymentUrl, {
              presentationStyle: WebBrowser.WebBrowserPresentationStyle.FULL_SCREEN,
            });
          } catch (openError) {
            console.warn('Cannot open VNPay browser', openError);
            navigation.replace('OrderSuccess', {
              orderId: order._id,
              orderCode: order.orderCode,
              totalAmount: order.totalAmount,
              paymentMethod: 'VNPAY',
              paymentStatus: 'pending',
              paymentMessage: 'Không thể mở trang thanh toán VNPay. Bạn thử lại sau nha.',
            });
            return;
          }

          navigation.replace('OrderSuccess', {
            orderId: order._id,
            orderCode: order.orderCode,
            totalAmount: order.totalAmount,
            paymentMethod: 'VNPAY',
            paymentStatus: 'pending',
            isProcessingPayment: true,
          });
        } catch (paymentError) {
          if (paymentError instanceof PaymentApiError) {
            navigation.replace('OrderSuccess', {
              orderId: order._id,
              orderCode: order.orderCode,
              totalAmount: order.totalAmount,
              paymentMethod: 'VNPAY',
              paymentStatus: 'failed',
              paymentMessage: paymentError.message,
            });
          } else {
            navigation.replace('OrderSuccess', {
              orderId: order._id,
              orderCode: order.orderCode,
              totalAmount: order.totalAmount,
              paymentMethod: 'VNPAY',
              paymentStatus: 'failed',
              paymentMessage: 'Không tạo được link thanh toán VNPay. Bạn thử lại sau nha.',
            });
          }
        }
      } else {
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
        showNotice({
          tone: 'warning',
          title: 'Phí giao hàng đã thay đổi',
          message: getErrorMessage(error),
        });
        setCheckoutPreview(null);
        setCheckoutPreviewKey('');
      } else {
        showNotice({
          tone: 'error',
          title: 'Không đặt được hàng',
          message: getErrorMessage(error),
        });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleApplyCoupon = async () => {
    const code = couponCode.trim();

    if (!session?.accessToken) {
      navigation.navigate('Login');
      return;
    }

    if (!code) {
      showNotice({ tone: 'warning', title: 'Thiếu mã giảm giá', message: 'Bạn nhập mã voucher trước nha.' });
      return;
    }

    if (!selectedCheckoutItems.length) {
      showNotice({ tone: 'warning', title: 'Giỏ hàng trống', message: 'Bạn chọn ít nhất một sản phẩm để áp dụng voucher.' });
      return;
    }

    if (!appliedCouponCodes.includes(code.toUpperCase()) && appliedCouponCodes.length >= 3) {
      showNotice({ tone: 'warning', title: 'Đã đạt giới hạn voucher', message: 'Mỗi đơn chỉ có thể áp dụng tối đa 3 voucher.' });
      return;
    }

    try {
      setIsApplyingCoupon(true);
      const preview = await runWithAuth((accessToken) =>
        cartApi.previewCheckout(accessToken, {
          couponCodes: Array.from(new Set([...appliedCouponCodes, code.toUpperCase()])).slice(0, 3),
          cartItemIds: selectedCheckoutItems.map((item) => item._id),
          ...getCheckoutAddressPayload(),
          paymentMethod,
        }),
      );

      if (!preview.coupon) {
        throw new CartApiError('Voucher chưa được áp dụng cho đơn hàng này.');
      }

      const previewCodes = preview.coupons?.map((coupon) => coupon.code) ?? [preview.coupon.code];
      setCheckoutPreview(preview);
      setCheckoutPreviewKey([selectedCheckoutItemKey, selectedAddressKey, previewCodes.join(','), paymentMethod].join('::'));
      setAppliedCouponCodes(previewCodes);
      setCouponCode('');
      showNotice({ tone: 'success', title: 'Đã áp dụng voucher', message: `${preview.coupon.code} đã được tính vào đơn hàng.` }, 3200);
    } catch (error) {
      showNotice({ tone: 'error', title: 'Chưa áp dụng được voucher', message: getErrorMessage(error) });
    } finally {
      setIsApplyingCoupon(false);
    }
  };

  const handleClearCoupon = (code?: string) => {
    setAppliedCouponCodes((current) => (code ? current.filter((item) => item !== code) : []));
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
      paymentMethod,
    });
  };

  const vnpayPaymentSubtitle = isPaymentMethodsLoading
    ? 'Đang tải phương thức thanh toán đã lưu...'
    : selectedSavedPaymentMethod
      ? `Dùng ${selectedSavedPaymentMethod.displayName}${selectedSavedPaymentMethod.maskedInfo ? ` - ${selectedSavedPaymentMethod.maskedInfo}` : ''}.`
      : pendingVNPayPaymentMethod
        ? 'VNPay đã lưu đang chờ xác minh, bạn vẫn có thể thanh toán qua cổng VNPay.'
        : 'Ví điện tử, thẻ ATM, thẻ quốc tế qua VNPAY Sandbox.';

  const renderInput = (
    label: string,
    value: string,
    onChange: (value: string) => void,
    keyboardType: 'default' | 'email-address' = 'default',
    multiline = false,
  ) => (
    <View style={styles.inputGroup}>
      <Text style={styles.inputLabel}>{label}</Text>
      <TextInput
        style={[styles.inputField, multiline && styles.inputFieldMultiline]}
        value={value}
        onChangeText={onChange}
        placeholder={`Nhập ${label.toLowerCase()}`}
        placeholderTextColor={colors.textSubtle}
        keyboardType={keyboardType}
        multiline={multiline}
        scrollEnabled={multiline}
        textAlignVertical={multiline ? 'top' : 'center'}
      />
    </View>
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
    if (!notice) return null;

    const toneStyle =
      notice.tone === 'success' ? styles.noticeSuccess
        : notice.tone === 'warning' ? styles.noticeWarning
        : notice.tone === 'error' ? styles.noticeError
        : styles.noticeInfo;
    const iconColor =
      notice.tone === 'success' ? colors.success
        : notice.tone === 'warning' ? colors.goldText
        : notice.tone === 'error' ? colors.danger
        : colors.brand;
    const iconName: keyof typeof MaterialCommunityIcons.glyphMap =
      notice.tone === 'success' ? 'check-circle-outline'
        : notice.tone === 'warning' ? 'alert-circle-outline'
        : notice.tone === 'error' ? 'close-circle-outline'
        : 'information-outline';

    return (
      <View style={[styles.noticeCard, toneStyle]}>
        <MaterialCommunityIcons name={iconName} size={20} color={iconColor} />
        <View style={styles.noticeCopy}>
          <Text style={styles.noticeTitle}>{notice.title}</Text>
          {notice.message ? <Text style={styles.noticeText}>{notice.message}</Text> : null}
        </View>
        {notice.actionLabel && notice.onAction ? (
          <TouchableOpacity style={styles.noticeAction} onPress={notice.onAction} activeOpacity={0.82}>
            <Text style={styles.noticeActionText}>{notice.actionLabel}</Text>
          </TouchableOpacity>
        ) : null}
        <TouchableOpacity style={styles.noticeClose} onPress={dismissNotice} activeOpacity={0.82}>
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
          <TouchableOpacity style={styles.addressEditButton} onPress={() => navigation.navigate('EditProfile')} activeOpacity={0.82}>
            <Text style={styles.addressEditText}>Thêm</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <View style={styles.addressStack}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.addressChipRow}>
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
              <TouchableOpacity style={styles.addressSmallButton} onPress={() => navigation.navigate('EditProfile')} activeOpacity={0.82}>
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
        {isPreviewLoading ? <ActivityIndicator color={colors.brand} size="small" /> : <MaterialCommunityIcons name="truck-fast-outline" size={21} color={colors.brand} />}
      </View>
      <View style={styles.shippingQuoteCopy}>
        <View style={styles.shippingQuoteTopRow}>
          <Text style={styles.shippingQuoteTitle}>Giao hàng tiêu chuẩn</Text>
          <Text style={styles.shippingQuoteFee}>
            {selectedCheckoutItems.length && checkoutPreview ? formatCurrency(shippingFee) : '--'}
          </Text>
        </View>
        <Text style={styles.shippingQuoteMeta}>{shippingProviderLabel} · {shippingStatusText}</Text>
        {shippingNeedsAddressMapping ? (
          <TouchableOpacity style={styles.shippingQuoteAction} onPress={() => navigation.navigate('EditProfile')} activeOpacity={0.82}>
            <Text style={styles.shippingQuoteActionText}>Quản lý địa chỉ</Text>
            <MaterialCommunityIcons name="chevron-right" size={16} color={colors.brand} />
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );

  const renderCartItem = (item: CartItem) => (
    <View style={styles.checkoutItemCard} key={item._id}>
      {item.image ? (
        <Image source={{ uri: item.image }} style={styles.checkoutItemImage} />
      ) : (
        <View style={styles.checkoutItemImagePlaceholder}>
          <MaterialCommunityIcons name="image-outline" size={24} color={colors.textSubtle} />
        </View>
      )}
      <View style={styles.checkoutItemCopy}>
        <Text style={styles.checkoutItemName} numberOfLines={2}>{getItemTitle(item)}</Text>
        {item.brand?.name ? <Text style={styles.checkoutItemBrand}>{item.brand.name}</Text> : null}
        <Text style={styles.checkoutItemVariant}>
          {[item.color, item.size].filter(Boolean).join(' · ')}
        </Text>
        <View style={styles.checkoutItemBottomRow}>
          <Text style={styles.checkoutItemQuantity}>SL: {item.quantity}</Text>
          <Text style={styles.checkoutItemPrice}>{formatCurrency(item.lineTotal)}</Text>
        </View>
      </View>
    </View>
  );

  if (!isAuthenticated || !session?.accessToken) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <View style={styles.shortcutHeader}>
          <TouchableOpacity style={styles.shortcutHeaderAction} onPress={() => navigation.goBack()} activeOpacity={0.82}>
            <MaterialCommunityIcons name="arrow-left" size={24} color={colors.white} />
          </TouchableOpacity>
          <Text style={styles.shortcutHeaderTitle}>Thanh toán</Text>
          <View style={styles.shortcutHeaderSpacer} />
        </View>
        <View style={styles.statePanel}>
          <MaterialCommunityIcons name="cart-outline" size={42} color={colors.brand} />
          <Text style={styles.stateTitle}>Đăng nhập để thanh toán</Text>
          <Text style={styles.stateText}>Bạn đăng nhập để xem giỏ hàng và đặt hàng.</Text>
          <TouchableOpacity style={styles.primarySmallButton} onPress={() => navigation.navigate('Login')} activeOpacity={0.82}>
            <Text style={styles.primarySmallButtonText}>Đăng nhập</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (isLoading) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <View style={styles.shortcutHeader}>
          <TouchableOpacity style={styles.shortcutHeaderAction} onPress={() => navigation.goBack()} activeOpacity={0.82}>
            <MaterialCommunityIcons name="arrow-left" size={24} color={colors.white} />
          </TouchableOpacity>
          <Text style={styles.shortcutHeaderTitle}>Thanh toán</Text>
          <View style={styles.shortcutHeaderSpacer} />
        </View>
        <View style={styles.statePanel}>
          <ActivityIndicator color={colors.brand} />
          <Text style={styles.stateText}>Đang tải giỏ hàng</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!cart?.product_list.length || !selectedCheckoutItems.length) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <View style={styles.shortcutHeader}>
          <TouchableOpacity style={styles.shortcutHeaderAction} onPress={() => navigation.goBack()} activeOpacity={0.82}>
            <MaterialCommunityIcons name="arrow-left" size={24} color={colors.white} />
          </TouchableOpacity>
          <Text style={styles.shortcutHeaderTitle}>Thanh toán</Text>
          <View style={styles.shortcutHeaderSpacer} />
        </View>
        <View style={styles.statePanel}>
          <MaterialCommunityIcons name="cart-off" size={42} color={colors.brand} />
          <Text style={styles.stateTitle}>Chưa có sản phẩm để thanh toán</Text>
          <Text style={styles.stateText}>Bạn chọn ít nhất một sản phẩm trong giỏ hàng rồi quay lại đây.</Text>
          <TouchableOpacity style={styles.primarySmallButton} onPress={() => navigation.navigate('Cart', { selectionSource: 'normal' })} activeOpacity={0.82}>
            <Text style={styles.primarySmallButtonText}>Về giỏ hàng</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <View style={styles.shortcutHeader}>
        <TouchableOpacity
          style={styles.shortcutHeaderAction}
          onPress={() => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Cart', { selectionSource: 'normal' }))}
          activeOpacity={0.82}
        >
          <MaterialCommunityIcons name="arrow-left" size={24} color={colors.white} />
        </TouchableOpacity>
        <Text style={styles.shortcutHeaderTitle}>Thanh toán</Text>
        <View style={styles.shortcutHeaderSpacer} />
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        nestedScrollEnabled
        showsVerticalScrollIndicator={false}
      >
        {renderNotice()}

        <View style={styles.sectionBlock}>
          <Text style={styles.sectionTitle}>Địa chỉ nhận hàng</Text>
          {renderAddressSection()}
        </View>

        <View style={styles.sectionBlock}>
          <Text style={styles.sectionTitle}>Sản phẩm đã chọn ({selectedCheckoutItems.length})</Text>
          <View style={styles.checkoutItemList}>
            {selectedCheckoutItems.map(renderCartItem)}
          </View>
        </View>

        <View style={styles.sectionBlock}>
          <Text style={styles.sectionTitle}>Thông tin đơn hàng</Text>
          <View style={styles.formStack}>
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
          <Text style={styles.sectionTitle}>Phương thức vận chuyển</Text>
          {renderShippingQuoteCard()}
        </View>

        <View style={styles.sectionBlock}>
          <Text style={styles.sectionTitle}>Hình thức thanh toán</Text>
          <View style={styles.paymentStack}>
            {renderPaymentOption('COD', 'Thanh toán khi giao hàng (COD)', 'truck-delivery-outline', false, 'Khách hàng được kiểm tra hàng trước khi nhận.')}
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
                  onChangeText={(value) => setCouponCode(value.toUpperCase())}
                  placeholder="Nhập mã voucher"
                  placeholderTextColor={colors.textSubtle}
                  autoCapitalize="characters"
                  editable={!isApplyingCoupon}
                />
                <TouchableOpacity
                  style={[
                    styles.couponApplyButton,
                    (!couponCode.trim() || isApplyingCoupon || !selectedCheckoutItems.length) && styles.couponApplyButtonDisabled,
                  ]}
                  onPress={handleApplyCoupon}
                  disabled={!couponCode.trim() || isApplyingCoupon || !selectedCheckoutItems.length}
                  activeOpacity={0.82}
                >
                  {isApplyingCoupon ? <ActivityIndicator color={colors.white} size="small" /> : <Text style={styles.couponApplyText}>Áp dụng</Text>}
                </TouchableOpacity>
              </View>
              <TouchableOpacity style={styles.couponListButton} onPress={handleOpenCoupons} activeOpacity={0.82} disabled={!selectedCheckoutItems.length}>
                <MaterialCommunityIcons name="ticket-percent-outline" size={18} color={colors.brand} />
                <Text style={styles.couponListText}>Chọn voucher khả dụng</Text>
                <MaterialCommunityIcons name="chevron-right" size={20} color={colors.brand} />
              </TouchableOpacity>
              {appliedCoupons.length ? (
                appliedCoupons.map((coupon) => (
                  <View style={styles.couponAppliedRow} key={coupon.code}>
                    <View style={styles.couponAppliedCopy}>
                      <Text style={styles.couponAppliedTitle}>{coupon.name}</Text>
                      <Text style={styles.couponAppliedMeta}>Mã {coupon.code} đang được tính vào đơn hàng</Text>
                    </View>
                    <TouchableOpacity onPress={() => handleClearCoupon(coupon.code)} activeOpacity={0.82}>
                      <Text style={styles.couponClearText}>Bỏ</Text>
                    </TouchableOpacity>
                  </View>
                ))
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
                <Text style={styles.memberBadgeText}>{appliedMembership?.name?.charAt(0).toUpperCase() ?? 'M'}</Text>
              </View>
              <View style={styles.memberInfo}>
                <Text style={styles.memberTitle}>
                  {appliedMembership ? `Hạng thẻ: ${appliedMembership.name}` : 'Ưu đãi thành viên'}
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
                {appliedMembership ? (appliedMembership.discountPercent > 0 ? `-${appliedMembership.discountPercent}%` : '0%') : '-'}
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
            <Text style={styles.summaryValue}>{selectedCheckoutItems.length && checkoutPreview ? formatCurrency(shippingFee) : '--'}</Text>
          </View>
          <View style={styles.summaryLine}>
            <Text style={styles.summaryLabel}>Giảm phí vận chuyển:</Text>
            <Text style={shippingDiscountAmount > 0 ? styles.summaryDiscount : styles.summaryValue}>
              {shippingDiscountAmount > 0 ? `-${formatCurrency(shippingDiscountAmount)}` : '0đ'}
            </Text>
          </View>
          <View style={styles.summaryLine}>
            <Text style={styles.summaryLabel}>Voucher{appliedCouponCodes.length ? ` (${appliedCouponCodes.join(' + ')})` : ''}:</Text>
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
            <Text style={styles.totalLabel}>Tổng tiền:</Text>
            <Text style={styles.totalValue}>{formatCurrency(totalAmount)}</Text>
          </View>
        </View>

      </ScrollView>

      <View style={styles.stickyFooter}>
        <View style={styles.stickyFooterLeft}>
          <Text style={styles.stickyFooterTotal}>{formatCurrency(totalAmount)}</Text>
          {savingsAmount > 0 ? (
            <Text style={styles.stickyFooterSavings}>Tiết kiệm {formatCurrency(savingsAmount)}</Text>
          ) : null}
        </View>
        <Pressable
          style={[styles.placeOrderButton, !canSubmit && styles.placeOrderButtonDisabled]}
          onPress={handleCheckout}
          disabled={!canSubmit}
        >
          {isSubmitting ? <ActivityIndicator color={colors.white} /> : <Text style={styles.placeOrderText}>Đặt hàng</Text>}
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
    minHeight: 56,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.brand,
  },
  shortcutHeaderAction: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shortcutHeaderTitle: {
    ...brandedHeaderStyles.title,
    color: colors.white,
    fontSize: 18,
    fontWeight: '900',
  },
  shortcutHeaderSpacer: {
    width: 44,
    height: 44,
  },
  content: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
  },
  statePanel: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.md,
    backgroundColor: colors.background,
  },
  stateTitle: {
    color: colors.text,
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '900',
    textAlign: 'center',
  },
  stateText: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '600',
    textAlign: 'center',
  },
  primarySmallButton: {
    marginTop: spacing.sm,
    borderRadius: radii.pill,
    backgroundColor: colors.brand,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xl,
  },
  primarySmallButtonText: {
    color: colors.white,
    fontSize: 14,
    lineHeight: 19,
    fontWeight: '900',
  },
  sectionBlock: {
    marginBottom: spacing.xl,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '900',
    marginBottom: spacing.sm,
  },
  formStack: {
    gap: spacing.md,
  },
  inputGroup: {
    gap: spacing.xs,
  },
  inputLabel: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
  },
  inputField: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.sm,
    backgroundColor: colors.white,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    color: colors.text,
    fontSize: 14,
    lineHeight: 20,
  },
  inputFieldMultiline: {
    minHeight: 80,
  },
  addressState: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.lg,
  },
  addressStateText: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '600',
  },
  addressEmpty: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.white,
    borderRadius: radii.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  addressEmptyCopy: {
    flex: 1,
    gap: spacing.xs,
  },
  addressEmptyTitle: {
    color: colors.text,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '900',
  },
  addressEmptyText: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '600',
  },
  addressEditButton: {
    borderRadius: radii.pill,
    backgroundColor: colors.brand,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  addressEditText: {
    color: colors.white,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '900',
  },
  addressStack: {
    gap: spacing.sm,
  },
  addressChipRow: {
    gap: spacing.sm,
  },
  addressChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    borderRadius: radii.pill,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  addressChipActive: {
    backgroundColor: colors.brand,
    borderColor: colors.brand,
  },
  addressChipText: {
    color: colors.text,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
  },
  addressChipTextActive: {
    color: colors.white,
  },
  selectedAddressCard: {
    backgroundColor: colors.white,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  selectedAddressHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    padding: spacing.md,
  },
  selectedAddressIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectedAddressCopy: {
    flex: 1,
    gap: spacing.xs,
  },
  selectedAddressName: {
    color: colors.text,
    fontSize: 14,
    lineHeight: 19,
    fontWeight: '900',
  },
  selectedAddressText: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '600',
  },
  addressSmallButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addressQuoteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.successSoft,
  },
  addressQuoteRowWarning: {
    backgroundColor: colors.goldSoft,
  },
  addressQuoteText: {
    flex: 1,
    color: colors.success,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '700',
  },
  addressQuoteTextWarning: {
    color: colors.goldText,
  },
  shippingQuoteCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    backgroundColor: colors.white,
    borderRadius: radii.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  shippingQuoteIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shippingQuoteCopy: {
    flex: 1,
    gap: spacing.xs,
  },
  shippingQuoteTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  shippingQuoteTitle: {
    color: colors.text,
    fontSize: 14,
    lineHeight: 19,
    fontWeight: '900',
  },
  shippingQuoteFee: {
    color: colors.brand,
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '900',
  },
  shippingQuoteMeta: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '600',
  },
  shippingQuoteAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  shippingQuoteActionText: {
    color: colors.brand,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '900',
  },
  checkoutItemList: {
    gap: spacing.md,
  },
  checkoutItemCard: {
    flexDirection: 'row',
    gap: spacing.md,
    backgroundColor: colors.white,
    borderRadius: radii.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  checkoutItemImage: {
    width: 64,
    height: 64,
    borderRadius: radii.sm,
    backgroundColor: colors.surface,
    resizeMode: 'cover',
  },
  checkoutItemImagePlaceholder: {
    width: 64,
    height: 64,
    borderRadius: radii.sm,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkoutItemCopy: {
    flex: 1,
    gap: spacing.xs,
  },
  checkoutItemName: {
    color: colors.text,
    fontSize: 14,
    lineHeight: 19,
    fontWeight: '900',
  },
  checkoutItemBrand: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '600',
  },
  checkoutItemVariant: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '600',
  },
  checkoutItemBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.xs,
  },
  checkoutItemQuantity: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
  },
  checkoutItemPrice: {
    color: colors.text,
    fontSize: 14,
    lineHeight: 19,
    fontWeight: '900',
  },
  paymentStack: {
    gap: spacing.sm,
  },
  paymentOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.white,
    borderRadius: radii.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  paymentOptionSelected: {
    borderColor: colors.brand,
    backgroundColor: colors.surface,
  },
  paymentOptionDisabled: {
    opacity: 0.5,
  },
  radioOuter: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOuterSelected: {
    borderColor: colors.brand,
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.brand,
  },
  paymentTextBlock: {
    flex: 1,
    gap: spacing.xs,
  },
  paymentTitle: {
    color: colors.text,
    fontSize: 14,
    lineHeight: 19,
    fontWeight: '900',
  },
  paymentTitleDisabled: {
    color: colors.textSubtle,
  },
  paymentSubtitle: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '600',
  },
  promoStack: {
    gap: spacing.md,
  },
  couponCard: {
    backgroundColor: colors.white,
    borderRadius: radii.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.sm,
  },
  couponInputRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  couponInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.sm,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  couponApplyButton: {
    borderRadius: radii.sm,
    backgroundColor: colors.brand,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  couponApplyButtonDisabled: {
    opacity: 0.4,
  },
  couponApplyText: {
    color: colors.white,
    fontSize: 14,
    lineHeight: 19,
    fontWeight: '900',
  },
  couponListButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
  },
  couponListText: {
    flex: 1,
    color: colors.brand,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '900',
  },
  couponAppliedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  couponAppliedCopy: {
    flex: 1,
    gap: spacing.xs,
  },
  couponAppliedTitle: {
    color: colors.text,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '900',
  },
  couponAppliedMeta: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '600',
  },
  couponClearText: {
    color: colors.danger,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '900',
  },
  couponHint: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '600',
  },
  memberCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.white,
    borderRadius: radii.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  memberBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  memberBadgeText: {
    color: colors.white,
    fontSize: 18,
    fontWeight: '900',
  },
  memberInfo: {
    flex: 1,
    gap: spacing.xs,
  },
  memberTitle: {
    color: colors.text,
    fontSize: 14,
    lineHeight: 19,
    fontWeight: '900',
  },
  memberMeta: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '600',
  },
  memberDiscount: {
    color: colors.brand,
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '900',
  },
  summaryPanel: {
    backgroundColor: colors.white,
    borderRadius: radii.md,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.sm,
  },
  checkoutWarning: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
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
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
  },
  summaryValue: {
    color: colors.text,
    fontSize: 14,
    lineHeight: 19,
    fontWeight: '700',
  },
  summaryDiscount: {
    color: colors.success,
    fontSize: 14,
    lineHeight: 19,
    fontWeight: '900',
  },
  totalLine: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  totalLabel: {
    color: colors.text,
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '900',
  },
  totalValue: {
    color: colors.brand,
    fontSize: 20,
    lineHeight: 26,
    fontWeight: '900',
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
  stickyFooterSavings: {
    color: colors.success,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '700',
  },
  placeOrderButton: {
    borderRadius: radii.pill,
    backgroundColor: colors.brand,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    minWidth: 140,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeOrderButtonDisabled: {
    opacity: 0.4,
  },
  placeOrderText: {
    color: colors.white,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '900',
  },
  noticeCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    borderRadius: radii.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  noticeSuccess: {
    backgroundColor: colors.successSoft,
  },
  noticeWarning: {
    backgroundColor: colors.goldSoft,
  },
  noticeError: {
    backgroundColor: colors.dangerSoft,
  },
  noticeInfo: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  noticeCopy: {
    flex: 1,
    gap: spacing.xs,
  },
  noticeTitle: {
    color: colors.text,
    fontSize: 14,
    lineHeight: 19,
    fontWeight: '900',
  },
  noticeText: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
  },
  noticeAction: {
    borderRadius: radii.pill,
    backgroundColor: colors.brand,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  noticeActionText: {
    color: colors.white,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '900',
  },
  noticeClose: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default CheckoutScreen;
