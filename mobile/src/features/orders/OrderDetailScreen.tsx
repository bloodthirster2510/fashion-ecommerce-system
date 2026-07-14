import React from 'react';
import {
  ActivityIndicator,
  Alert,
  Clipboard,
  Image,
  Modal,
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
import { useIsFocused, useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import * as ImagePicker from 'expo-image-picker';
import * as WebBrowser from 'expo-web-browser';
import { brandedHeaderStyles, colors, radii, shadows, spacing } from '../../theme';
import type { RootStackParamList } from '../../navigation/AppNavigator';
import { useStaleFocusEffect } from '../../hooks/useStaleFocusEffect';
import { useAuth } from '../auth/AuthContext';
import {
  paymentMethodsApi,
  type PaymentMethodRecord,
} from '../account/paymentMethodsApi';
import { paymentApi, PaymentApiError } from '../payments/paymentApi';
import { orderApi, OrderApiError, type CustomerOrder, type OrderItem } from './orderApi';
import {
  canCancelOrder,
  canConfirmReceived,
  canRequestReturn,
  formatAddress,
  formatCurrency,
  formatDate,
  getOrderDisplayState,
  getShippingStatusLabel,
  paymentMethodLabels,
  paymentStatusLabels,
} from './orderPresentation';
import { reviewApi } from '../reviews/reviewApi';
import { useOrderRealtime } from './orderRealtime';
import { EvidencePicker, type EvidenceDraft } from './components/EvidencePicker';
import { OrderProductItem } from './components/OrderProductItem';
import { OrderTimeline } from './components/OrderTimeline';
import { ReturnRequestModal } from './components/ReturnRequestModal';

type OrderDetailNavigationProp = StackNavigationProp<RootStackParamList, 'OrderDetail'>;
type OrderDetailRouteProp = RouteProp<RootStackParamList, 'OrderDetail'>;

const maxEvidenceImageBytes = 5 * 1024 * 1024;
const supportedEvidenceMimeTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);

const getImageAssetByteSize = (asset: ImagePicker.ImagePickerAsset) =>
  asset.fileSize ?? Math.ceil(((asset.base64?.length ?? 0) * 3) / 4);

const getImageAssetMimeType = (asset: ImagePicker.ImagePickerAsset) => {
  const mimeType = asset.mimeType?.toLowerCase();
  if (mimeType) return mimeType;

  const uri = asset.uri.toLowerCase();
  if (/\.(jpe?g)(?:\?|$)/.test(uri)) return 'image/jpeg';
  if (/\.png(?:\?|$)/.test(uri)) return 'image/png';
  if (/\.webp(?:\?|$)/.test(uri)) return 'image/webp';

  return '';
};

const validateEvidenceImage = (asset: ImagePicker.ImagePickerAsset): { mimeType: string } | { error: string } => {
  const mimeType = getImageAssetMimeType(asset);

  if (!supportedEvidenceMimeTypes.has(mimeType)) {
    return { error: 'Chỉ hỗ trợ ảnh JPG, PNG hoặc WebP.' };
  }

  if (getImageAssetByteSize(asset) > maxEvidenceImageBytes) {
    return { error: 'Mỗi ảnh minh chứng tối đa 5MB. Bạn chọn ảnh nhẹ hơn nha.' };
  }

  return { mimeType };
};

const isUnauthorizedError = (error: unknown) =>
  typeof error === 'object' &&
  error !== null &&
  'status' in error &&
  (error as { status?: number }).status === 401;

const getErrorMessage = (error: unknown) => {
  if (error instanceof OrderApiError || error instanceof Error) {
    return error.message;
  }

  return 'Không thể tải chi tiết đơn hàng. Bạn thử lại sau nha.';
};

const getPaymentStatusColor = (status: string) => {
  if (status === 'paid') return colors.success;
  if (status === 'failed' || status === 'refunded') return colors.danger;
  return colors.goldText;
};

const getShippingStatusColor = (status?: string | null) => {
  if (status === 'failed' || status === 'cancelled') return colors.danger;
  if (status === 'delivered') return colors.success;
  if (status === 'picking' || status === 'picked' || status === 'shipping' || status === 'delivering') {
    return colors.action;
  }

  return colors.goldText;
};

const getShippingStatusBackground = (status?: string | null) => {
  if (status === 'failed' || status === 'cancelled') return colors.dangerSoft;
  if (status === 'delivered') return colors.successSoft;
  if (status === 'picking' || status === 'picked' || status === 'shipping' || status === 'delivering') {
    return '#EAF3FF';
  }

  return colors.goldSoft;
};

const formatCodeForDisplay = (value: string) =>
  value.replace(/\s+/g, '').replace(/(.{4})(?=.)/g, '$1 ');

const returnRequestStatusLabels: Record<string, string> = {
  requested: 'Chờ duyệt',
  approved: 'Đã duyệt',
  rejected: 'Đã từ chối',
};

const getPaymentMethodMetadataText = (method: PaymentMethodRecord, key: string) => {
  const value = method.metadata?.[key];
  return typeof value === 'string' && value.trim() ? value.trim() : null;
};

const getRefundMethodRank = (method: PaymentMethodRecord) => {
  let rank = 20;
  if (method.status === 'verified') rank -= 10;
  if (method.isDefault) rank -= 5;
  if (method.metadata?.refundDestination === true) rank -= 2;
  return rank;
};

const getPreferredRefundMethod = (methods: PaymentMethodRecord[]) =>
  [...methods]
    .filter((method) => method.type === 'BANK' && method.status !== 'disabled')
    .sort((left, right) => getRefundMethodRank(left) - getRefundMethodRank(right))[0] ?? null;

const getRefundMethodTitle = (method: PaymentMethodRecord) =>
  getPaymentMethodMetadataText(method, 'accountHolder') ?? method.displayName;

const getRefundMethodSubtitle = (method: PaymentMethodRecord) =>
  [method.bankName, method.bankCode, method.maskedInfo].filter(Boolean).join(' • ');

const getAttentionToneColor = (tone: 'danger' | 'warning' | 'info' | 'success') => {
  if (tone === 'danger') return colors.danger;
  if (tone === 'warning') return colors.goldText;
  if (tone === 'success') return colors.success;
  return colors.action;
};

const getAttentionToneBackground = (tone: 'danger' | 'warning' | 'info' | 'success') => {
  if (tone === 'danger') return colors.dangerSoft;
  if (tone === 'warning') return colors.goldSoft;
  if (tone === 'success') return colors.successSoft;
  return '#EAF3FF';
};

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const OrderDetailScreen = () => {
  const navigation = useNavigation<OrderDetailNavigationProp>();
  const route = useRoute<OrderDetailRouteProp>();
  const { logout, runWithAuth, session } = useAuth();
  const orderId = route.params.orderId;
  const isFocused = useIsFocused();

  const [order, setOrder] = React.useState<CustomerOrder | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isRefreshing, setIsRefreshing] = React.useState(false);
  const [isCancelling, setIsCancelling] = React.useState(false);
  const [isConfirmingReceived, setIsConfirmingReceived] = React.useState(false);
  const [isRequestingReturn, setIsRequestingReturn] = React.useState(false);
  const [isRetryingPayment, setIsRetryingPayment] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState('');
  const [isInvoiceVisible, setIsInvoiceVisible] = React.useState(false);
  const [isCancelModalVisible, setIsCancelModalVisible] = React.useState(false);
  const [cancelReason, setCancelReason] = React.useState('');
  const [cancelReasonError, setCancelReasonError] = React.useState('');
  const [cancelEvidenceImages, setCancelEvidenceImages] = React.useState<EvidenceDraft[]>([]);
  const [isReturnModalVisible, setIsReturnModalVisible] = React.useState(false);
  const [returnReason, setReturnReason] = React.useState('');
  const [returnReasonError, setReturnReasonError] = React.useState('');
  const [returnEvidenceImages, setReturnEvidenceImages] = React.useState<EvidenceDraft[]>([]);
  const [refundMethods, setRefundMethods] = React.useState<PaymentMethodRecord[]>([]);
  const [isRefundMethodsLoading, setIsRefundMethodsLoading] = React.useState(false);
  // Lưu order_item_id đã được đánh giá để ẩn/đổi nhãn nút review trên từng dòng hàng.
  const [reviewedItemIds, setReviewedItemIds] = React.useState<Set<string>>(new Set());
  const copyReference = React.useCallback((_label: string, value: string) => {
    Clipboard.setString(value);
  }, []);

  const loadOrder = React.useCallback(
    async (mode: 'loading' | 'refresh' | 'silent' = 'loading') => {
      if (!session?.accessToken) {
        navigation.navigate('Login');
        return;
      }

      if (mode === 'loading') {
        setIsLoading(true);
      } else if (mode === 'refresh') {
        setIsRefreshing(true);
      }
      if (mode !== 'silent') {
        setErrorMessage('');
      }

      try {
        const response = await runWithAuth((accessToken) => orderApi.getOrderById(accessToken, orderId));
        setOrder(response);
        // Lấy danh sách order item đã đánh giá để hiển thị đúng trạng thái nút review.
        try {
          const eligibleItems = await runWithAuth((accessToken) => reviewApi.listEligibleItems(accessToken));
          const reviewed = new Set(
            eligibleItems.items
              .filter((item) => item.review)
              .map((item) => item.orderItemId),
          );
          setReviewedItemIds(reviewed);
        } catch {
          // Eligibility là dữ liệu phụ; không chặn hiển thị đơn nếu tải thất bại.
          setReviewedItemIds(new Set());
        }
      } catch (error) {
        if (mode === 'silent') {
          return;
        }

        if (isUnauthorizedError(error)) {
          logout();
          navigation.reset({
            index: 0,
            routes: [{ name: 'Login' }],
          });
          return;
        }

        setErrorMessage(getErrorMessage(error));
      } finally {
        if (mode === 'loading') setIsLoading(false);
        if (mode === 'refresh') setIsRefreshing(false);
      }
    },
    [logout, navigation, orderId, runWithAuth, session?.accessToken],
  );

  useStaleFocusEffect(
    () => {
      void loadOrder();
    },
    [loadOrder],
    { staleMs: 15 * 1000 },
  );

  const orderRealtime = useOrderRealtime(session?.accessToken, (event) => {
    if (event.orderId === orderId) void loadOrder('silent');
  });

  React.useEffect(() => {
    orderRealtime.subscribeOrder(orderId);
    return () => orderRealtime.unsubscribeOrder(orderId);
  }, [orderId, orderRealtime]);

  React.useEffect(() => {
    if (!isFocused) return;
    const handle = setInterval(() => {
      void loadOrder('silent');
    }, orderRealtime.connected ? 30_000 : 12_000);
    return () => clearInterval(handle);
  }, [isFocused, loadOrder, orderRealtime.connected]);

  const loadRefundMethods = React.useCallback(async () => {
    if (!session?.accessToken) {
      setRefundMethods([]);
      return;
    }

    setIsRefundMethodsLoading(true);
    try {
      const methods = await runWithAuth((accessToken) => paymentMethodsApi.list(accessToken));
      setRefundMethods(methods.filter((method) => method.type === 'BANK' && method.status !== 'disabled'));
    } catch {
      setRefundMethods([]);
    } finally {
      setIsRefundMethodsLoading(false);
    }
  }, [runWithAuth, session?.accessToken]);

  React.useEffect(() => {
    if (!isFocused) return;
    void loadRefundMethods();
  }, [isFocused, loadRefundMethods]);

  const handleCancelOrder = () => {
    if (!order) return;

    setCancelReason(order.cancellation?.reason ?? '');
    setCancelReasonError('');
    setCancelEvidenceImages([]);
    setIsCancelModalVisible(true);
  };

  const confirmCancelOrder = async () => {
    if (!order) return;

    const normalizedReason = cancelReason.trim();
    if (!normalizedReason) {
      setCancelReasonError('Vui lòng nhập lý do hủy đơn.');
      return;
    }

    try {
      setIsCancelling(true);
      const nextOrder = await runWithAuth((accessToken) =>
        orderApi.cancelOrder(accessToken, order._id, {
          reason: normalizedReason,
          imageAttachments: cancelEvidenceImages.map(({ imageBase64, mimeType }) => ({
            imageBase64,
            mimeType,
          })),
        }),
      );
      setOrder(nextOrder);
      setIsCancelModalVisible(false);
      Alert.alert('Đã hủy đơn', 'Đơn hàng đã được cập nhật sang trạng thái đã hủy.');
    } catch (error) {
      Alert.alert('Không thể hủy đơn', getErrorMessage(error));
    } finally {
      setIsCancelling(false);
    }
  };

  const handleConfirmReceived = () => {
    if (!order) return;

    Alert.alert(
      'Xác nhận đã nhận hàng?',
      'Khi xác nhận, đơn sẽ chuyển sang hoàn thành. Nếu thanh toán COD, hệ thống sẽ ghi nhận đơn đã thanh toán.',
      [
        { text: 'Để sau', style: 'cancel' },
        {
          text: 'Đã nhận hàng',
          onPress: () => {
            void confirmReceived();
          },
        },
      ],
    );
  };

  const confirmReceived = async () => {
    if (!order) return;

    try {
      setIsConfirmingReceived(true);
      const nextOrder = await runWithAuth((accessToken) => orderApi.confirmReceived(accessToken, order._id));
      setOrder(nextOrder);
      Alert.alert('Đã xác nhận nhận hàng', 'Đơn hàng đã được chuyển sang trạng thái hoàn thành.');
    } catch (error) {
      Alert.alert('Không thể xác nhận', getErrorMessage(error));
    } finally {
      setIsConfirmingReceived(false);
    }
  };

  const handleRequestReturn = () => {
    if (!order) return;

    if (!canRequestReturn(order.status)) {
      Alert.alert(
        'Chưa thể trả hàng',
        'Luồng trả hàng chỉ mở sau khi đơn được giao thành công. Nếu có vấn đề khẩn cấp, bạn liên hệ hỗ trợ đơn hàng để shop kiểm tra.',
      );
      return;
    }

    setReturnReason(order.returnRequest?.reason ?? '');
    setReturnReasonError('');
    setReturnEvidenceImages([]);
    setIsReturnModalVisible(true);
  };

  const requestReturn = async () => {
    if (!order) return;

    const normalizedReason = returnReason.trim();
    if (!normalizedReason) {
      setReturnReasonError('Vui lòng nhập lý do trả hàng.');
      return;
    }

    try {
      setIsRequestingReturn(true);
      const nextOrder = await runWithAuth((accessToken) =>
        orderApi.requestReturn(accessToken, order._id, normalizedReason, {
          imageAttachments: returnEvidenceImages.map(({ imageBase64, mimeType }) => ({
            imageBase64,
            mimeType,
          })),
        }),
      );
      setOrder(nextOrder);
      setIsReturnModalVisible(false);
      Alert.alert('Đã gửi yêu cầu trả hàng', 'Shop đã ghi nhận yêu cầu và sẽ phản hồi trong thời gian sớm nhất.');
    } catch (error) {
      Alert.alert('Không thể gửi yêu cầu', getErrorMessage(error));
    } finally {
      setIsRequestingReturn(false);
    }
  };

  const pickEvidenceImage = async (
    currentImages: EvidenceDraft[],
    setImages: React.Dispatch<React.SetStateAction<EvidenceDraft[]>>,
    setError?: React.Dispatch<React.SetStateAction<string>>,
  ) => {
    if (currentImages.length >= 3) {
      setError?.('Tối đa 3 ảnh minh chứng.');
      return;
    }

    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setError?.('Cần quyền truy cập thư viện ảnh để chọn ảnh minh chứng.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.65,
      base64: true,
    });

    if (result.canceled) {
      return;
    }

    const asset = result.assets[0];
    if (!asset?.base64) {
      setError?.('Không đọc được ảnh đã chọn. Bạn thử ảnh khác nha.');
      return;
    }

    const validation = validateEvidenceImage(asset);
    if ('error' in validation) {
      setError?.(validation.error);
      return;
    }

    setError?.('');
    setImages((images) => [
      ...images,
      {
        uri: asset.uri,
        imageBase64: asset.base64!,
        mimeType: validation.mimeType,
      },
    ]);
  };

  const removeEvidenceImage = (
    index: number,
    setImages: React.Dispatch<React.SetStateAction<EvidenceDraft[]>>,
  ) => {
    setImages((images) => images.filter((_, imageIndex) => imageIndex !== index));
  };

  const refreshOrderAfterPayment = async () => {
    for (let attempt = 0; attempt < 4; attempt += 1) {
      if (attempt > 0) {
        await wait(2500);
      }

      const paymentStatus = await runWithAuth((accessToken) =>
        paymentApi.getOrderPaymentStatus(accessToken, orderId),
      );

      if (paymentStatus.paymentStatus === 'paid') {
        const latestOrder = await runWithAuth((accessToken) => orderApi.getOrderById(accessToken, orderId));
        setOrder(latestOrder);
        return latestOrder;
      }
    }

    const latestOrder = await runWithAuth((accessToken) => orderApi.getOrderById(accessToken, orderId));
    setOrder(latestOrder);

    return latestOrder.paymentStatus === 'paid' ? latestOrder : null;
  };

  const handleRetryPayment = async () => {
    if (!order) return;

    try {
      setIsRetryingPayment(true);
      const paymentData = await runWithAuth((accessToken) =>
        paymentApi.createVNPayUrlFromOrder(accessToken, order._id),
      );

      void WebBrowser.openBrowserAsync(paymentData.paymentUrl, {
        presentationStyle: WebBrowser.WebBrowserPresentationStyle.FULL_SCREEN,
      }).catch((error) => {
        Alert.alert(
          'Không thể mở thanh toán',
          error instanceof Error ? error.message : 'Bạn thử lại sau nha.',
        );
      });

      const latestOrder = await refreshOrderAfterPayment();

      if (latestOrder?.paymentStatus === 'paid') {
        Alert.alert('Đã ghi nhận thanh toán', 'Đơn hàng của bạn đã được cập nhật thành đã thanh toán.');
        return;
      }

      Alert.alert(
        'Chưa ghi nhận thanh toán',
        'Bạn có thể thử lại hoặc đợi hệ thống cập nhật trong vài phút.',
      );
    } catch (error) {
      if (error instanceof PaymentApiError && error.status === 409) {
        await loadOrder('refresh');
        Alert.alert('Đơn hàng đã thanh toán', 'Hệ thống vừa cập nhật lại trạng thái đơn hàng.');
        return;
      }

      Alert.alert(
        'Không thể mở thanh toán',
        error instanceof Error ? error.message : 'Bạn thử lại sau nha.',
      );
    } finally {
      setIsRetryingPayment(false);
    }
  };

  const handleSupportAction = (type: 'issue' | 'shipping' | 'return') => {
    if (!order) return;

    if (type === 'shipping') {
      Alert.alert(
        'Thông tin giao hàng',
        [
          `Đơn vị: ${order.shipping?.provider || 'Fashionista Delivery'}`,
          `Mã vận đơn: ${order.shipping?.trackingCode || 'Đang cập nhật'}`,
          `Trạng thái: ${getShippingStatusLabel(order.shipping?.status)}`,
          `Địa chỉ: ${formatAddress(order)}`,
        ].join('\n'),
      );
      return;
    }

    if (type === 'return') {
      const isReturnAvailable = canRequestReturn(order.status) && !order.returnRequest;
      Alert.alert(
        'Chính sách trả hàng',
        'Shop hỗ trợ yêu cầu trả hàng trong 7 ngày sau khi đơn được giao. Bạn cần gửi lý do và ảnh minh chứng để admin duyệt.',
        isReturnAvailable
          ? [
              { text: 'Để sau', style: 'cancel' },
              { text: 'Gửi yêu cầu', onPress: handleRequestReturn },
            ]
          : [{ text: 'Đã hiểu' }],
      );
      return;
    }

    navigation.navigate('SupportTicketCreate', {
      type: 'issue',
      category: 'orders',
      orderId: order._id,
      contextSource: 'order_detail',
    });
  };

  const handleWriteReview = (item: OrderItem) => {
    if (!order || !item._id) return;

    navigation.navigate('ReviewComposer', {
      orderId: order._id,
      orderItemId: item._id,
      orderCode: order.orderCode,
      productName: item.name,
      productImage: item.image,
      variantLabel: `${item.color} • ${item.size} • ${item.fitType}`,
    });
  };

  const renderSummaryRow = (label: string, value: string, tone: 'default' | 'discount' | 'success' = 'default') => (
    <View style={styles.summaryRow}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text
        style={[
          styles.summaryValue,
          tone === 'discount' && styles.summaryDiscount,
          tone === 'success' && styles.summarySuccess,
        ]}
      >
        {value}
      </Text>
    </View>
  );

  const renderCancelOrderModal = () => (
    <Modal
      visible={isCancelModalVisible}
      transparent
      animationType="fade"
      onRequestClose={() => setIsCancelModalVisible(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.returnModal}>
          <View style={styles.invoiceHeader}>
            <View>
              <Text style={styles.invoiceEyebrow}>CANCEL ORDER</Text>
              <Text style={styles.invoiceTitle}>Lý do hủy đơn</Text>
            </View>
            <TouchableOpacity
              style={styles.modalCloseButton}
              onPress={() => setIsCancelModalVisible(false)}
              disabled={isCancelling}
            >
              <MaterialCommunityIcons name="close" size={22} color={colors.text} />
            </TouchableOpacity>
          </View>

          <Text style={styles.returnModalHint}>
            Sau khi hủy, đơn đã thanh toán trước sẽ được chuyển sang trạng thái cần hoàn tiền để shop xử lý.
          </Text>
          <TextInput
            style={styles.returnReasonInput}
            value={cancelReason}
            onChangeText={(value) => {
              setCancelReason(value);
              if (cancelReasonError) {
                setCancelReasonError('');
              }
            }}
            placeholder="Nhập lý do hủy đơn"
            placeholderTextColor={colors.textSubtle}
            multiline
            maxLength={500}
            textAlignVertical="top"
            editable={!isCancelling}
          />
          <View style={styles.returnModalMetaRow}>
            <Text style={styles.returnReasonCounter}>{cancelReason.trim().length}/500</Text>
            {cancelReasonError ? <Text style={styles.returnReasonError}>{cancelReasonError}</Text> : null}
          </View>
          <EvidencePicker
            images={cancelEvidenceImages}
            onPick={() => void pickEvidenceImage(cancelEvidenceImages, setCancelEvidenceImages, setCancelReasonError)}
            onRemove={(index) => removeEvidenceImage(index, setCancelEvidenceImages)}
            disabled={isCancelling}
          />

          <View style={styles.returnModalActions}>
            <TouchableOpacity
              style={styles.returnModalSecondaryButton}
              onPress={() => setIsCancelModalVisible(false)}
              activeOpacity={0.84}
              disabled={isCancelling}
            >
              <Text style={styles.returnModalSecondaryText}>Để sau</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.returnModalPrimaryButton, styles.cancelModalPrimaryButton]}
              onPress={() => void confirmCancelOrder()}
              activeOpacity={0.84}
              disabled={isCancelling}
            >
              {isCancelling ? (
                <ActivityIndicator size="small" color={colors.white} />
              ) : (
                <MaterialCommunityIcons name="close-circle-outline" size={18} color={colors.white} />
              )}
              <Text style={styles.returnModalPrimaryText}>Hủy đơn</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );

  const renderInvoiceModal = () => {
    if (!order) return null;

    const shippingPayable = Math.max(0, order.shippingFee - order.shippingDiscountAmount);
    const invoiceReference = order.invoiceCode || order.orderCode;

    return (
      <Modal visible={isInvoiceVisible} transparent animationType="fade" onRequestClose={() => setIsInvoiceVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.invoiceModal}>
            <View style={styles.invoiceHeader}>
              <View>
                <Text style={styles.invoiceEyebrow}>FASHIONISTA</Text>
                <Text style={styles.invoiceTitle}>Hóa đơn đơn hàng</Text>
              </View>
              <TouchableOpacity style={styles.modalCloseButton} onPress={() => setIsInvoiceVisible(false)}>
                <MaterialCommunityIcons name="close" size={22} color={colors.text} />
              </TouchableOpacity>
            </View>

            <View style={styles.invoiceCodeBox}>
              <Text style={styles.invoiceLabel}>Mã hóa đơn</Text>
              <View style={styles.invoiceCodeRow}>
                <Text style={styles.invoiceCode} numberOfLines={1}>{invoiceReference}</Text>
                <TouchableOpacity
                  style={styles.copyCodeButton}
                  onPress={() => copyReference('Mã hóa đơn', invoiceReference)}
                  activeOpacity={0.78}
                  accessibilityLabel="Sao chép mã hóa đơn"
                >
                  <MaterialCommunityIcons name="content-copy" size={15} color={colors.brand} />
                </TouchableOpacity>
              </View>
              <Text style={styles.invoiceDate}>Ngày lập: {formatDate(order.createdAt)}</Text>
            </View>

            {renderSummaryRow('Tạm tính', formatCurrency(order.subTotal))}
            {order.couponDiscountAmount > 0
              ? renderSummaryRow(`Voucher${order.couponCodes?.length ? ` ${order.couponCodes.join(' + ')}` : ''}`, `-${formatCurrency(order.couponDiscountAmount)}`, 'discount')
              : null}
            {order.membershipDiscountAmount > 0
              ? renderSummaryRow('Hạng thành viên', `-${formatCurrency(order.membershipDiscountAmount)}`, 'discount')
              : null}
            {renderSummaryRow('Phí giao hàng', shippingPayable === 0 ? 'Miễn phí' : formatCurrency(shippingPayable), shippingPayable === 0 ? 'success' : 'default')}
            <View style={styles.invoiceDivider} />
            <View style={styles.invoiceTotalRow}>
              <Text style={styles.invoiceTotalLabel}>Tổng thanh toán</Text>
              <Text style={styles.invoiceTotalValue}>{formatCurrency(order.totalAmount)}</Text>
            </View>
          </View>
        </View>
      </Modal>
    );
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <View style={styles.centerState}>
          <ActivityIndicator size="large" color={colors.white} />
          <Text style={styles.centerStateText}>Đang tải chi tiết đơn hàng</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (errorMessage || !order) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.headerAction} onPress={() => navigation.goBack()} activeOpacity={0.8}>
            <MaterialCommunityIcons name="arrow-left" size={24} color={colors.white} />
          </TouchableOpacity>
          <View style={styles.headerTitleGroup}>
            <Text style={styles.headerTitle}>Chi tiết đơn hàng</Text>
          </View>
          <View style={styles.headerActionPlaceholder} />
        </View>
        <View style={styles.content}>
          <View style={styles.errorPanel}>
            <MaterialCommunityIcons name="alert-circle-outline" size={44} color={colors.danger} />
            <Text style={styles.errorTitle}>Không mở được đơn hàng</Text>
            <Text style={styles.errorText}>{errorMessage || 'Đơn hàng không tồn tại hoặc bạn không có quyền xem.'}</Text>
            <TouchableOpacity style={styles.primaryButton} onPress={() => loadOrder()} activeOpacity={0.84}>
              <Text style={styles.primaryButtonText}>Thử lại</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  const displayState = getOrderDisplayState(order);
  const actionState = displayState.requiresUserAction ? displayState : null;
  const shippingPayable = Math.max(0, order.shippingFee - order.shippingDiscountAmount);
  const paymentStatusColor = getPaymentStatusColor(order.paymentStatus);
  const canCancel = canCancelOrder(order.status);
  const canConfirmDelivery = canConfirmReceived(order);
  const canReturn = canRequestReturn(order.status);
  const shippingStatusColor = getShippingStatusColor(order.shipping?.status);
  const shippingStatusBackground = getShippingStatusBackground(order.shipping?.status);
  const paymentDeadlineTime = order.paymentDeadlineAt ? new Date(order.paymentDeadlineAt).getTime() : null;
  const paymentDeadlineRemainingMs = paymentDeadlineTime ? paymentDeadlineTime - Date.now() : null;
  const paymentDeadlineHours = paymentDeadlineRemainingMs === null
    ? null
    : Math.max(0, Math.ceil(paymentDeadlineRemainingMs / (60 * 60 * 1000)));
  const displayOrderCode = formatCodeForDisplay(order.orderCode);
  const canRetryVNPayPayment =
    order.paymentMethod === 'VNPAY' &&
    order.paymentStatus !== 'paid' &&
    order.paymentStatus !== 'refunded' &&
    order.status !== 'cancelled' &&
    order.status !== 'return_approved' &&
    order.status !== 'returned' &&
    (paymentDeadlineRemainingMs === null || paymentDeadlineRemainingMs > 0);
  const usesVNPay = order.paymentMethod === 'VNPAY';
  const preferredRefundMethod = getPreferredRefundMethod(refundMethods);
  const returnRequestStatus = order.returnRequest?.status;
  const isReturnRejected = returnRequestStatus === 'rejected';
  const returnRequestColor = isReturnRejected
    ? colors.danger
    : returnRequestStatus === 'approved'
      ? colors.action
      : colors.coral;
  const returnRequestBackground = isReturnRejected
    ? colors.dangerSoft
    : returnRequestStatus === 'approved'
      ? '#EAF3FF'
      : '#FFF0EA';
  const returnRequestIcon = isReturnRejected
    ? 'archive-remove-outline'
    : returnRequestStatus === 'approved'
      ? 'archive-arrow-up-outline'
      : 'archive-clock-outline';
  const showRefundSupport =
    order.paymentStatus === 'refunded' ||
    (
      !isReturnRejected &&
      (
        canReturn ||
        Boolean(order.returnRequest) ||
        order.status === 'cancelled' ||
        order.status === 'returned'
      )
    );
  const showRefundAmount =
    (order.paymentStatus === 'paid' || order.paymentStatus === 'refunded') &&
    (
      order.status === 'cancelled' ||
      order.status === 'returned' ||
      order.returnRequest?.status === 'approved' ||
      order.paymentStatus === 'refunded'
    );
  const refundSupportStatus = (() => {
    if (order.paymentStatus === 'refunded') return 'Đã hoàn tiền';
    if (order.returnRequest?.status === 'requested') return 'Đang chờ shop duyệt';
    if (order.returnRequest?.status === 'approved') return 'Đã duyệt trả hàng';
    if (order.status === 'cancelled' && order.paymentStatus === 'paid') return 'Chờ shop hoàn tiền';
    if (order.status === 'returned' && order.paymentStatus === 'paid') return 'Chờ shop hoàn tiền';
    if (canReturn) return 'Có thể gửi yêu cầu';
    return 'Theo chính sách của shop';
  })();
  const refundSupportText = (() => {
    if (order.paymentStatus === 'refunded') {
      return usesVNPay
        ? 'Shop đã ghi nhận hoàn tiền qua VNPay. Khoản hoàn sẽ được trả về phương thức thanh toán ban đầu theo thời gian xử lý của ngân hàng.'
        : 'Shop đã ghi nhận hoàn tiền cho đơn này. Bạn có thể đối chiếu theo tài khoản nhận hoàn tiền đã lưu.';
    }
    if (order.returnRequest?.status === 'requested') {
      return 'Yêu cầu trả hàng đã được gửi. Shop sẽ duyệt minh chứng và phản hồi trên đơn hàng này.';
    }
    if (order.returnRequest?.status === 'approved') {
      return usesVNPay
        ? 'Yêu cầu đã được duyệt. Hãy gửi hàng về shop; sau khi xác nhận nhận hàng, khoản hoàn sẽ được xử lý qua VNPay về phương thức thanh toán ban đầu.'
        : 'Yêu cầu đã được duyệt. Hãy gửi hàng về shop; sau khi xác nhận nhận hàng, shop sẽ hoàn tiền theo tài khoản bạn đã lưu.';
    }
    if ((order.status === 'cancelled' || order.status === 'returned') && order.paymentStatus === 'paid') {
      return usesVNPay
        ? 'Đơn đang chờ shop đối soát và gửi yêu cầu hoàn tiền qua VNPay về phương thức thanh toán ban đầu.'
        : 'Đơn đã thanh toán cần được hoàn tiền. Hãy bảo đảm tài khoản nhận hoàn tiền đã được cập nhật chính xác.';
    }
    return 'Nếu sản phẩm có vấn đề, gửi yêu cầu kèm ảnh minh chứng để shop duyệt và hướng dẫn bước tiếp theo.';
  })();

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.headerAction}
          onPress={() => navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Orders')}
          activeOpacity={0.8}
          accessibilityLabel="Trở về"
        >
          <MaterialCommunityIcons name="arrow-left" size={24} color={colors.white} />
        </TouchableOpacity>
        <View style={styles.headerTitleGroup}>
          <Text style={styles.headerTitle}>Chi tiết đơn hàng</Text>
        </View>
        <TouchableOpacity
          style={styles.headerAction}
          onPress={() => setIsInvoiceVisible(true)}
          activeOpacity={0.8}
          accessibilityLabel="Xem hóa đơn"
        >
          <MaterialCommunityIcons name="receipt-text-outline" size={22} color={colors.white} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={() => loadOrder('refresh')} tintColor={colors.brand} />}
      >
        <View style={styles.orderHero}>
          <View style={styles.heroTopRow}>
            <View style={styles.heroLabelBlock}>
              <Text style={styles.heroLabel}>Mã đơn hàng</Text>
              <TouchableOpacity
                style={styles.copyCodeButton}
                onPress={() => copyReference('Mã đơn hàng', order.orderCode)}
                activeOpacity={0.78}
                accessibilityLabel="Sao chép mã đơn hàng"
              >
                <MaterialCommunityIcons name="content-copy" size={15} color={colors.brand} />
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={styles.invoiceButton} onPress={() => setIsInvoiceVisible(true)} activeOpacity={0.84}>
              <MaterialCommunityIcons name="file-document-outline" size={18} color={colors.text} />
              <Text style={styles.invoiceButtonText}>Hóa đơn</Text>
            </TouchableOpacity>
          </View>

          <Text
            style={styles.heroCode}
            numberOfLines={2}
            adjustsFontSizeToFit
            minimumFontScale={0.78}
            accessibilityLabel={`Mã đơn hàng ${order.orderCode}`}
          >
            {displayOrderCode}
          </Text>

          <View style={styles.heroMetaRow}>
            <View style={[styles.heroStatusBadge, { backgroundColor: displayState.backgroundColor }]}>
              <Text style={[styles.heroStatusText, { color: displayState.color }]} numberOfLines={1}>
                {displayState.label}
              </Text>
            </View>
            <Text style={styles.heroDate} numberOfLines={1}>Ngày đặt: {formatDate(order.createdAt)}</Text>
          </View>

          <Text style={[styles.heroDelivery, { color: displayState.color }]}>
            {displayState.deliveryLine}
          </Text>
        </View>

        {actionState ? (
          <View
            style={[
              styles.attentionCallout,
              { backgroundColor: displayState.backgroundColor, borderColor: displayState.color },
            ]}
          >
            <View style={[styles.attentionDot, { backgroundColor: displayState.color }]} />
            <MaterialCommunityIcons
              name={displayState.icon as keyof typeof MaterialCommunityIcons.glyphMap}
              size={22}
              color={displayState.color}
            />
            <View style={styles.attentionCopy}>
              <Text style={[styles.attentionTitle, { color: displayState.color }]}>
                {displayState.label}
              </Text>
              <Text style={styles.attentionText}>{displayState.description}</Text>
            </View>
          </View>
        ) : null}

        {!actionState ? (
          <View
            style={[
              styles.statusCallout,
              { backgroundColor: displayState.backgroundColor, borderColor: displayState.color },
            ]}
          >
            <MaterialCommunityIcons
              name={displayState.icon as keyof typeof MaterialCommunityIcons.glyphMap}
              size={20}
              color={displayState.color}
            />
            <View style={styles.statusCalloutCopy}>
              <Text style={[styles.statusCalloutTitle, { color: displayState.color }]}>{displayState.label}</Text>
              <Text style={styles.statusCalloutText}>{displayState.description}</Text>
            </View>
          </View>
        ) : null}
        <OrderTimeline order={order} />

        {order.cancellation ? (
          <View style={styles.returnRequestCard}>
            <View style={styles.returnRequestHeader}>
              <MaterialCommunityIcons name="close-circle-outline" size={22} color={colors.danger} />
              <View style={styles.returnRequestTitleGroup}>
                <Text style={styles.returnRequestTitle}>Thông tin hủy đơn</Text>
                <Text style={styles.returnRequestStatus}>
                  {order.paymentStatus === 'paid' ? 'Chờ hoàn tiền' : 'Đã ghi nhận'}
                </Text>
              </View>
            </View>
            {order.cancellation.reason ? (
              <Text style={styles.returnRequestReason}>{order.cancellation.reason}</Text>
            ) : null}
            {order.cancellation.imageUrls?.length ? (
              <View style={styles.evidenceUrlGrid}>
                {order.cancellation.imageUrls.map((imageUrl) => (
                  <Image key={imageUrl} source={{ uri: imageUrl }} style={styles.evidenceUrlImage} resizeMode="cover" />
                ))}
              </View>
            ) : null}
          </View>
        ) : null}

        {order.returnRequest ? (
          <View
            style={[
              styles.returnRequestCard,
              {
                backgroundColor: returnRequestBackground,
                borderColor: returnRequestColor,
              },
            ]}
          >
            <View style={styles.returnRequestHeader}>
              <MaterialCommunityIcons
                name={returnRequestIcon as keyof typeof MaterialCommunityIcons.glyphMap}
                size={22}
                color={returnRequestColor}
              />
              <View style={styles.returnRequestTitleGroup}>
                <Text style={styles.returnRequestTitle}>Yêu cầu trả hàng</Text>
                <Text style={[styles.returnRequestStatus, { color: returnRequestColor }]}>
                  {returnRequestStatusLabels[order.returnRequest.status] ?? order.returnRequest.status}
                </Text>
              </View>
            </View>
            <Text style={styles.returnRequestFieldLabel}>Lý do của bạn</Text>
            <Text style={styles.returnRequestReason}>{order.returnRequest.reason}</Text>
            {order.returnRequest.reviewReason ? (
              <View style={styles.returnRequestReviewGroup}>
                <Text style={[styles.returnRequestFieldLabel, { color: returnRequestColor }]}>Phản hồi từ shop</Text>
                <Text style={styles.returnRequestReview}>{order.returnRequest.reviewReason}</Text>
              </View>
            ) : null}
            {order.returnRequest.imageUrls?.length ? (
              <View style={styles.evidenceUrlGrid}>
                {order.returnRequest.imageUrls.map((imageUrl) => (
                  <Image key={imageUrl} source={{ uri: imageUrl }} style={styles.evidenceUrlImage} resizeMode="cover" />
                ))}
              </View>
            ) : null}
            {isReturnRejected ? (
              <TouchableOpacity
                style={[styles.returnRequestSupportButton, { borderColor: returnRequestColor }]}
                onPress={() => handleSupportAction('issue')}
                activeOpacity={0.82}
              >
                <MaterialCommunityIcons name="message-alert-outline" size={18} color={returnRequestColor} />
                <Text style={[styles.returnRequestSupportButtonText, { color: returnRequestColor }]}>Trao đổi với shop</Text>
                <MaterialCommunityIcons name="chevron-right" size={18} color={returnRequestColor} />
              </TouchableOpacity>
            ) : null}
          </View>
        ) : null}

        {showRefundSupport ? (
          <View style={styles.returnHelpCard}>
            <View style={styles.returnHelpHeader}>
              <View style={styles.returnHelpIcon}>
                <MaterialCommunityIcons name={order.paymentStatus === 'refunded' ? 'cash-check' : 'archive-refresh-outline'} size={22} color={colors.brand} />
              </View>
              <View style={styles.returnHelpTitleGroup}>
                <Text style={styles.returnHelpTitle}>Hoàn trả & hoàn tiền</Text>
                <Text style={styles.returnHelpStatus}>{refundSupportStatus}</Text>
              </View>
            </View>
            <Text style={styles.returnHelpText}>{refundSupportText}</Text>
            {showRefundAmount ? (
              <View style={styles.refundAmountRow}>
                <Text style={styles.refundAmountLabel}>Số tiền liên quan</Text>
                <Text style={styles.refundAmountValue}>{formatCurrency(order.totalAmount)}</Text>
              </View>
            ) : null}
            <View style={styles.refundMethodCard}>
              <View style={styles.refundMethodHeader}>
                <MaterialCommunityIcons name="bank-outline" size={18} color={colors.brand} />
                <Text style={styles.refundMethodHeading}>Tài khoản nhận hoàn tiền</Text>
              </View>
              {isRefundMethodsLoading ? (
                <Text style={styles.refundMethodText}>Đang tải tài khoản nhận hoàn tiền...</Text>
              ) : preferredRefundMethod ? (
                <>
                  <Text style={styles.refundMethodTitle}>{getRefundMethodTitle(preferredRefundMethod)}</Text>
                  <Text style={styles.refundMethodText}>
                    {getRefundMethodSubtitle(preferredRefundMethod) || 'Đã lưu tài khoản nhận hoàn tiền'}
                  </Text>
                </>
              ) : (
                <>
                  <Text style={styles.refundMethodTitle}>Chưa có tài khoản nhận hoàn tiền</Text>
                  <Text style={styles.refundMethodText}>
                    Thêm tài khoản ngân hàng để shop có thông tin chuyển khoản khi duyệt hoàn tiền.
                  </Text>
                </>
              )}
              <TouchableOpacity
                style={styles.refundMethodButton}
                onPress={() => navigation.navigate('PaymentMethods')}
                activeOpacity={0.84}
              >
                <Text style={styles.refundMethodButtonText}>
                  {preferredRefundMethod ? 'Cập nhật tài khoản' : 'Thêm tài khoản'}
                </Text>
                <MaterialCommunityIcons name="chevron-right" size={18} color={colors.brand} />
              </TouchableOpacity>
            </View>
            {canReturn && !order.returnRequest ? (
              <TouchableOpacity
                style={styles.returnHelpButton}
                onPress={handleRequestReturn}
                activeOpacity={0.84}
                disabled={isRequestingReturn}
              >
                {isRequestingReturn ? (
                  <ActivityIndicator size="small" color={colors.white} />
                ) : (
                  <MaterialCommunityIcons name="file-document-edit-outline" size={18} color={colors.white} />
                )}
                <Text style={styles.returnHelpButtonText}>Yêu cầu trả hàng</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        ) : null}

        <View style={styles.section}>
          {order.order_list.map((item) => (
            <OrderProductItem
              key={item._id ?? `${item.sku}-${item.size}`}
              item={item}
              isReviewable={order.status === 'completed' && order.paymentStatus === 'paid'}
              isReviewed={!!item._id && reviewedItemIds.has(item._id)}
              onWriteReview={handleWriteReview}
            />
          ))}
        </View>

        <View style={styles.summaryCard}>
          <Text style={styles.sectionTitle}>Tóm tắt đơn hàng</Text>
          {renderSummaryRow('Tạm tính', formatCurrency(order.subTotal))}
          {order.couponDiscountAmount > 0
            ? renderSummaryRow(`Voucher${order.couponCodes?.length ? ` ${order.couponCodes.join(' + ')}` : order.couponCode ? ` ${order.couponCode}` : ''}`, `-${formatCurrency(order.couponDiscountAmount)}`, 'discount')
            : null}
          {order.membershipDiscountAmount > 0
            ? renderSummaryRow('Hạng thẻ thành viên', `-${formatCurrency(order.membershipDiscountAmount)}`, 'discount')
            : null}
          {renderSummaryRow('Phí giao hàng', shippingPayable === 0 ? 'Miễn phí' : formatCurrency(shippingPayable), shippingPayable === 0 ? 'success' : 'default')}
          {order.taxAmount > 0 ? renderSummaryRow('Thuế', formatCurrency(order.taxAmount)) : null}
          <View style={styles.summaryDivider} />
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Tổng cộng</Text>
            <Text style={styles.totalValue}>{formatCurrency(order.totalAmount)}</Text>
          </View>
        </View>

        <View style={styles.infoGrid}>
          <View style={styles.infoCard}>
            <View style={styles.infoHeader}>
              <MaterialCommunityIcons name="credit-card-outline" size={20} color={colors.text} />
              <Text style={styles.infoTitle}>Thanh toán</Text>
            </View>
            <Text style={styles.infoValue}>{paymentMethodLabels[order.paymentMethod] ?? order.paymentMethod}</Text>
            <Text style={[styles.infoHint, { color: paymentStatusColor }]}>
              {paymentStatusLabels[order.paymentStatus] ?? order.paymentStatus}
            </Text>
            {order.paymentDeadlineAt && order.paymentStatus !== 'paid' && order.status !== 'cancelled' ? (
              <View style={styles.paymentDeadlineCard}>
                <MaterialCommunityIcons name="timer-sand" size={16} color={paymentDeadlineHours !== null && paymentDeadlineHours <= 24 ? colors.danger : colors.goldText} />
                <Text style={styles.paymentDeadlineText}>
                  Hạn thanh toán: {formatDate(order.paymentDeadlineAt)} · còn {paymentDeadlineHours} giờ
                </Text>
              </View>
            ) : null}
            {canRetryVNPayPayment ? (
              <TouchableOpacity
                style={styles.paymentRetryButton}
                onPress={handleRetryPayment}
                activeOpacity={0.84}
                disabled={isRetryingPayment}
              >
                {isRetryingPayment ? (
                  <ActivityIndicator size="small" color={colors.white} />
                ) : (
                  <MaterialCommunityIcons name="credit-card-refresh-outline" size={18} color={colors.white} />
                )}
                <Text style={styles.paymentRetryButtonText}>
                  {order.paymentStatus === 'failed' ? 'Thanh toán lại' : 'Thanh toán ngay'}
                </Text>
              </TouchableOpacity>
            ) : null}
          </View>

          <View style={styles.infoCard}>
            <View style={styles.infoHeader}>
              <MaterialCommunityIcons name="cube-outline" size={20} color={colors.text} />
              <Text style={styles.infoTitle}>Giao hàng</Text>
            </View>
            <View
              style={[
                styles.shippingStatusPill,
                { backgroundColor: shippingStatusBackground, borderColor: shippingStatusColor },
              ]}
            >
              <MaterialCommunityIcons name="truck-delivery-outline" size={15} color={shippingStatusColor} />
              <Text style={[styles.shippingStatusText, { color: shippingStatusColor }]}>
                {getShippingStatusLabel(order.shipping?.status)}
              </Text>
            </View>
            <Text style={styles.infoValue}>{formatAddress(order)}</Text>
            <Text style={styles.infoHint}>{order.shippingAddress.phoneNumber}</Text>
            <Text style={styles.infoHint}>Đơn vị: {order.shipping?.provider || 'Fashionista Delivery'}</Text>
            <Text style={styles.infoHint}>Mã vận đơn: {order.shipping?.trackingCode || 'Đang cập nhật'}</Text>
          </View>
        </View>

        <View style={styles.supportCard}>
          <View style={styles.supportHeader}>
            <MaterialCommunityIcons name="help-circle-outline" size={24} color={colors.text} />
            <Text style={styles.supportTitle}>Cần trợ giúp?</Text>
          </View>

          <TouchableOpacity style={styles.supportRow} onPress={() => handleSupportAction('issue')} activeOpacity={0.82}>
            <MaterialCommunityIcons name="message-alert-outline" size={20} color={colors.action} />
            <Text style={styles.supportRowText}>Vấn đề đơn hàng</Text>
            <MaterialCommunityIcons name="chevron-right" size={22} color={colors.action} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.supportRow} onPress={() => handleSupportAction('shipping')} activeOpacity={0.82}>
            <MaterialCommunityIcons name="truck-delivery-outline" size={20} color={colors.action} />
            <Text style={styles.supportRowText}>Thông tin giao hàng</Text>
            <MaterialCommunityIcons name="chevron-right" size={22} color={colors.action} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.supportRow} onPress={() => handleSupportAction('return')} activeOpacity={0.82}>
            <MaterialCommunityIcons name="archive-refresh-outline" size={20} color={colors.action} />
            <Text style={styles.supportRowText}>Chính sách trả hàng</Text>
            <MaterialCommunityIcons name="chevron-right" size={22} color={colors.action} />
          </TouchableOpacity>
        </View>

        {canCancel || canConfirmDelivery ? (
          <View style={styles.bottomActions}>
            {canCancel ? (
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={handleCancelOrder}
                activeOpacity={0.84}
                disabled={isCancelling}
              >
                {isCancelling ? (
                  <ActivityIndicator size="small" color={colors.danger} />
                ) : (
                  <MaterialCommunityIcons name="close-circle-outline" size={20} color={colors.danger} />
                )}
                <Text style={styles.cancelButtonText}>Hủy đơn hàng</Text>
              </TouchableOpacity>
            ) : null}

            {canConfirmDelivery ? (
              <TouchableOpacity
                style={styles.confirmReceivedButton}
                onPress={handleConfirmReceived}
                activeOpacity={0.84}
                disabled={isConfirmingReceived}
              >
                {isConfirmingReceived ? (
                  <ActivityIndicator size="small" color={colors.white} />
                ) : (
                  <MaterialCommunityIcons name="package-variant-closed-check" size={20} color={colors.white} />
                )}
                <Text style={styles.confirmReceivedButtonText}>Đã nhận hàng</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        ) : null}
      </ScrollView>

      {renderCancelOrderModal()}
      <ReturnRequestModal
        visible={isReturnModalVisible}
        reason={returnReason}
        reasonError={returnReasonError}
        evidenceImages={returnEvidenceImages}
        isSubmitting={isRequestingReturn}
        onClose={() => setIsReturnModalVisible(false)}
        onReasonChange={(value) => {
          setReturnReason(value);
          if (returnReasonError) {
            setReturnReasonError('');
          }
        }}
        onPickEvidence={() => void pickEvidenceImage(returnEvidenceImages, setReturnEvidenceImages, setReturnReasonError)}
        onRemoveEvidence={(index) => removeEvidenceImage(index, setReturnEvidenceImages)}
        onSubmit={() => void requestReturn()}
      />
      {renderInvoiceModal()}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.brand,
  },
  header: {
    ...brandedHeaderStyles.container,
  },
  headerAction: {
    ...brandedHeaderStyles.action,
  },
  headerActionPlaceholder: {
    width: 42,
    height: 42,
  },
  headerTitleGroup: {
    ...brandedHeaderStyles.titleGroup,
    alignItems: 'center',
  },
  brand: {
    color: colors.brandMist,
    fontSize: 13,
    fontWeight: '700',
  },
  headerTitle: {
    ...brandedHeaderStyles.title,
    marginTop: 0,
    textAlign: 'center',
  },
  content: {
    flex: 1,
    backgroundColor: colors.background,
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
  },
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
    gap: spacing.md,
  },
  orderHero: {
    borderRadius: radii.sm,
    backgroundColor: colors.surface,
    padding: spacing.lg,
    gap: spacing.sm,
    alignItems: 'stretch',
    ...shadows.card,
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  heroLabelBlock: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  heroLabel: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '900',
  },
  heroCode: {
    color: colors.text,
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '900',
    marginTop: 2,
  },
  copyCodeButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  heroMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: 2,
  },
  heroStatusBadge: {
    maxWidth: '100%',
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
  },
  heroStatusText: {
    fontSize: 12,
    fontWeight: '900',
  },
  heroDate: {
    flexShrink: 1,
    color: colors.textMuted,
    fontSize: 13,
  },
  heroDelivery: {
    color: colors.success,
    fontSize: 13,
    fontWeight: '800',
    marginTop: 4,
  },
  invoiceButton: {
    minHeight: 38,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surface,
  },
  invoiceButtonText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '900',
  },
  statusCallout: {
    borderRadius: radii.sm,
    borderWidth: 1,
    padding: spacing.md,
    flexDirection: 'row',
    gap: spacing.sm,
  },
  statusCalloutCopy: {
    flex: 1,
  },
  statusCalloutTitle: {
    fontSize: 14,
    fontWeight: '900',
  },
  statusCalloutText: {
    color: colors.textBody,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 2,
  },
  returnRequestCard: {
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.lg,
    gap: spacing.sm,
    ...shadows.card,
  },
  returnRequestHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  returnRequestTitleGroup: {
    flex: 1,
    minWidth: 0,
  },
  returnRequestTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '900',
  },
  returnRequestStatus: {
    color: colors.brand,
    fontSize: 12,
    fontWeight: '800',
    marginTop: 2,
  },
  returnRequestReason: {
    color: colors.textBody,
    fontSize: 13,
    lineHeight: 19,
  },
  returnRequestFieldLabel: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  returnRequestReviewGroup: {
    gap: spacing.xs,
  },
  returnRequestReview: {
    color: colors.textBody,
    fontSize: 13,
    lineHeight: 19,
  },
  returnRequestSupportButton: {
    minHeight: 42,
    borderRadius: radii.sm,
    borderWidth: 1,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  returnRequestSupportButtonText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '900',
  },
  returnHelpCard: {
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.brandPale,
    backgroundColor: colors.brandSoft,
    padding: spacing.lg,
    gap: spacing.md,
    ...shadows.card,
  },
  returnHelpHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  returnHelpIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  returnHelpTitleGroup: {
    flex: 1,
    minWidth: 0,
  },
  returnHelpTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '900',
  },
  returnHelpStatus: {
    color: colors.brand,
    fontSize: 12,
    fontWeight: '800',
    marginTop: 2,
  },
  returnHelpText: {
    color: colors.textBody,
    fontSize: 13,
    lineHeight: 19,
  },
  refundAmountRow: {
    borderRadius: radii.sm,
    backgroundColor: colors.surface,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  refundAmountLabel: {
    flex: 1,
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '800',
  },
  refundAmountValue: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '900',
  },
  refundMethodCard: {
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.brandPale,
    backgroundColor: colors.surface,
    padding: spacing.md,
    gap: spacing.sm,
  },
  refundMethodHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  refundMethodHeading: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '900',
  },
  refundMethodTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '900',
  },
  refundMethodText: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 18,
  },
  refundMethodButton: {
    alignSelf: 'flex-start',
    minHeight: 34,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.brandPale,
    backgroundColor: colors.brandSoft,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
  },
  refundMethodButtonText: {
    color: colors.brand,
    fontSize: 12,
    fontWeight: '900',
  },
  returnHelpButton: {
    minHeight: 46,
    borderRadius: radii.sm,
    backgroundColor: colors.brand,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  returnHelpButtonText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '900',
  },
  section: {
    gap: spacing.md,
  },
  summaryCard: {
    borderRadius: radii.sm,
    backgroundColor: colors.surface,
    padding: spacing.lg,
    gap: spacing.sm,
    ...shadows.card,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '900',
    marginBottom: spacing.sm,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  summaryLabel: {
    flex: 1,
    color: colors.textMuted,
    fontSize: 14,
  },
  summaryValue: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '800',
  },
  summaryDiscount: {
    color: colors.text,
  },
  summarySuccess: {
    color: colors.success,
  },
  summaryDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.sm,
  },
  totalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  totalLabel: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '900',
  },
  totalValue: {
    color: colors.text,
    fontSize: 25,
    fontWeight: '900',
  },
  infoGrid: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  infoCard: {
    flex: 1,
    minHeight: 126,
    borderRadius: radii.sm,
    backgroundColor: colors.surface,
    padding: spacing.md,
    gap: spacing.sm,
    ...shadows.card,
  },
  infoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  infoTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '900',
  },
  infoValue: {
    color: colors.textBody,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
  },
  infoHint: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 17,
  },
  shippingStatusPill: {
    alignSelf: 'flex-start',
    minHeight: 28,
    borderWidth: 1,
    borderRadius: radii.pill,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  shippingStatusText: {
    fontSize: 12,
    fontWeight: '900',
  },
  paymentRetryButton: {
    minHeight: 42,
    borderRadius: radii.sm,
    backgroundColor: colors.brand,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    marginTop: spacing.xs,
  },
  paymentRetryButtonText: {
    color: colors.white,
    fontSize: 13,
    fontWeight: '900',
  },
  supportCard: {
    borderRadius: radii.sm,
    backgroundColor: colors.surface,
    padding: spacing.lg,
    ...shadows.card,
  },
  supportHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  supportTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '900',
  },
  supportRow: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  supportRowText: {
    flex: 1,
    color: colors.action,
    fontSize: 15,
    fontWeight: '800',
  },
  bottomActions: {
    gap: spacing.sm,
  },
  cancelButton: {
    minHeight: 50,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.dangerSoft,
    backgroundColor: '#FFF7F7',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  cancelButtonText: {
    color: colors.danger,
    fontSize: 15,
    fontWeight: '900',
  },
  confirmReceivedButton: {
    minHeight: 50,
    borderRadius: radii.sm,
    backgroundColor: colors.success,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  confirmReceivedButtonText: {
    color: colors.white,
    fontSize: 15,
    fontWeight: '900',
  },
  returnButton: {
    minHeight: 50,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.brand,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  returnButtonText: {
    color: colors.brand,
    fontSize: 15,
    fontWeight: '900',
  },
  centerState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    padding: spacing.xl,
  },
  centerStateText: {
    color: colors.white,
    fontSize: 15,
    fontWeight: '800',
  },
  errorPanel: {
    margin: spacing.lg,
    borderRadius: radii.sm,
    backgroundColor: colors.surface,
    padding: spacing.xl,
    alignItems: 'center',
    gap: spacing.sm,
    ...shadows.card,
  },
  errorTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '900',
    textAlign: 'center',
  },
  errorText: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 20,
    textAlign: 'center',
  },
  primaryButton: {
    minHeight: 44,
    borderRadius: radii.sm,
    backgroundColor: colors.brand,
    paddingHorizontal: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.sm,
  },
  primaryButtonText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '800',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(33, 52, 72, 0.42)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  invoiceModal: {
    width: '100%',
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  returnModal: {
    width: '100%',
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    padding: spacing.lg,
    gap: spacing.md,
  },
  returnModalHint: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 19,
  },
  returnReasonInput: {
    minHeight: 132,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.sm,
    color: colors.text,
    backgroundColor: colors.background,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: 14,
    lineHeight: 20,
  },
  returnModalMetaRow: {
    minHeight: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  returnReasonCounter: {
    color: colors.textSubtle,
    fontSize: 12,
    fontWeight: '700',
  },
  returnReasonError: {
    flex: 1,
    color: colors.danger,
    fontSize: 12,
    fontWeight: '800',
    textAlign: 'right',
  },
  returnModalActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  returnModalSecondaryButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  returnModalSecondaryText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '900',
  },
  returnModalPrimaryButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: radii.sm,
    backgroundColor: colors.brand,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  cancelModalPrimaryButton: {
    backgroundColor: colors.danger,
  },
  returnModalPrimaryText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '900',
  },
  invoiceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  invoiceEyebrow: {
    color: colors.brand,
    fontSize: 12,
    fontWeight: '900',
  },
  invoiceTitle: {
    color: colors.text,
    fontSize: 19,
    fontWeight: '900',
    marginTop: 2,
  },
  modalCloseButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.brandSoft,
  },
  invoiceCodeBox: {
    borderRadius: radii.sm,
    backgroundColor: colors.brandSoft,
    padding: spacing.md,
    marginVertical: spacing.sm,
  },
  invoiceLabel: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
  },
  invoiceCode: {
    flexShrink: 1,
    color: colors.text,
    fontSize: 18,
    fontWeight: '900',
    marginTop: 2,
  },
  invoiceCodeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: 2,
  },
  invoiceDate: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 4,
  },
  invoiceDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.sm,
  },
  invoiceTotalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  invoiceTotalLabel: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '900',
  },
  invoiceTotalValue: {
    color: colors.text,
    fontSize: 24,
    fontWeight: '900',
  },
  attentionCallout: {
    position: 'relative',
    borderWidth: 1,
    borderRadius: radii.sm,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    overflow: 'hidden',
  },
  attentionDot: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 9,
    height: 9,
    borderRadius: 5,
  },
  attentionCopy: {
    flex: 1,
    gap: 3,
    paddingRight: spacing.md,
  },
  attentionTitle: {
    fontSize: 14,
    fontWeight: '900',
  },
  attentionText: {
    color: colors.textBody,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '700',
  },
  evidenceUrlGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  evidenceUrlImage: {
    width: 70,
    height: 70,
    borderRadius: radii.sm,
    backgroundColor: colors.brandSoft,
  },
  paymentDeadlineCard: {
    marginTop: spacing.sm,
    padding: spacing.sm,
    borderRadius: radii.sm,
    backgroundColor: colors.brandSoft,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  paymentDeadlineText: {
    flex: 1,
    color: colors.textBody,
    fontSize: 11,
    lineHeight: 16,
    fontWeight: '700',
  },
});

export default OrderDetailScreen;
