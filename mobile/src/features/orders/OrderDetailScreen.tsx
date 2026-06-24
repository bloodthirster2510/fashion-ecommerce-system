import React from 'react';
import {
  ActivityIndicator,
  Alert,
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
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import * as ImagePicker from 'expo-image-picker';
import * as WebBrowser from 'expo-web-browser';
import { brandedHeaderStyles, colors, radii, shadows, spacing } from '../../theme';
import type { RootStackParamList } from '../../navigation/AppNavigator';
import { useStaleFocusEffect } from '../../hooks/useStaleFocusEffect';
import { useAuth } from '../auth/AuthContext';
import { paymentApi, PaymentApiError } from '../payments/paymentApi';
import { orderApi, OrderApiError, type CustomerOrder, type OrderEvidenceImageAttachment, type OrderItem } from './orderApi';
import {
  canCancelOrder,
  canConfirmReceived,
  canRequestReturn,
  formatAddress,
  formatCurrency,
  formatDate,
  formatShortDate,
  getOrderDisplayState,
  getShippingStatusLabel,
  paymentMethodLabels,
  paymentStatusLabels,
} from './orderPresentation';
import { reviewApi } from '../reviews/reviewApi';

type OrderDetailNavigationProp = StackNavigationProp<RootStackParamList, 'OrderDetail'>;
type OrderDetailRouteProp = RouteProp<RootStackParamList, 'OrderDetail'>;

type TimelineStep = {
  key: CustomerOrder['status'];
  label: string;
  helper: string;
};

type EvidenceDraft = OrderEvidenceImageAttachment & {
  uri: string;
};

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

const timelineSteps: TimelineStep[] = [
  { key: 'confirmed', label: 'Đã đặt đơn', helper: 'Shop tiếp nhận' },
  { key: 'packed', label: 'Chuẩn bị hàng', helper: 'Đóng gói' },
  { key: 'shipping', label: 'Đang giao', helper: 'Theo dõi vận chuyển' },
  { key: 'delivered', label: 'Hoàn tất', helper: 'Đã nhận hàng' },
];

const getTimelineSteps = (order: CustomerOrder): TimelineStep[] => {
  if (order.status === 'return_requested') {
    return [
      ...timelineSteps,
      { key: 'return_requested', label: 'Chờ duyệt trả', helper: 'Shop đang kiểm tra' },
    ];
  }

  if (order.status === 'returned') {
    return [
      ...timelineSteps,
      { key: 'returned', label: 'Đã trả hàng', helper: 'Shop đã nhận trả' },
    ];
  }

  return timelineSteps;
};

const isUnauthorizedError = (error: unknown) =>
  typeof error === 'object' &&
  error !== null &&
  'status' in error &&
  (error as { status?: number }).status === 401;

const isPreviewableImage = (value?: string | null) => !!value && /^https?:\/\//i.test(value.trim());

const getErrorMessage = (error: unknown) => {
  if (error instanceof OrderApiError || error instanceof Error) {
    return error.message;
  }

  return 'Không thể tải chi tiết đơn hàng. Bạn thử lại sau nha.';
};

const getProgressIndex = (order: CustomerOrder, steps: TimelineStep[]) => {
  if (order.status === 'cancelled') return -1;

  return steps.findIndex((step) => step.key === order.status);
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

const returnRequestStatusLabels: Record<string, string> = {
  requested: 'Chờ duyệt',
  approved: 'Đã duyệt',
  rejected: 'Đã từ chối',
};

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
  // Lưu order_item_id đã được đánh giá để ẩn/đổi nhãn nút review trên từng dòng hàng.
  const [reviewedItemIds, setReviewedItemIds] = React.useState<Set<string>>(new Set());

  const loadOrder = React.useCallback(
    async (mode: 'loading' | 'refresh' = 'loading') => {
      if (!session?.accessToken) {
        navigation.navigate('Login');
        return;
      }

      if (mode === 'loading') {
        setIsLoading(true);
      } else {
        setIsRefreshing(true);
      }
      setErrorMessage('');

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
        setIsLoading(false);
        setIsRefreshing(false);
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
      handleRequestReturn();
      return;
    }

    navigation.navigate('SupportTicketCreate', {
      type: 'issue',
      category: 'orders',
      orderId: order._id,
    });
  };

  const renderProduct = (item: OrderItem) => {
    const imageUri = item.image?.trim();

    return (
      <View key={item._id ?? `${item.sku}-${item.size}`} style={styles.productCard}>
        {isPreviewableImage(imageUri) ? (
          <Image source={{ uri: imageUri }} style={styles.productImage} resizeMode="cover" />
        ) : (
          <View style={styles.productImagePlaceholder}>
            <MaterialCommunityIcons name="tshirt-crew-outline" size={26} color={colors.textSubtle} />
          </View>
        )}

        <View style={styles.productInfo}>
          <View style={styles.productTitleRow}>
            <Text style={styles.productName} numberOfLines={2}>
              {item.name}
            </Text>
            <Text style={styles.productPrice}>{formatCurrency(item.priceAtPurchased)}</Text>
          </View>
          <View style={styles.productMetaRow}>
            <Text style={styles.productMeta} numberOfLines={2}>
              {item.color} • {item.size} • {item.fitType}
            </Text>
            <Text style={styles.productQuantity}>SL: {item.quantity}</Text>
          </View>
        </View>
        {order?.status === 'delivered' && order.paymentStatus === 'paid' && item._id ? (
          reviewedItemIds.has(item._id) ? (
            <View style={styles.reviewButton} pointerEvents="none">
              <MaterialCommunityIcons name="check-circle-outline" size={18} color={colors.textMuted} />
              <Text style={styles.reviewButtonTextMuted}>Đã đánh giá</Text>
            </View>
          ) : (
          <TouchableOpacity
            style={styles.reviewButton}
            onPress={() => navigation.navigate('ReviewComposer', {
              orderId: order._id,
              orderItemId: item._id!,
              orderCode: order.orderCode,
              productName: item.name,
              productImage: item.image,
              variantLabel: `${item.color} • ${item.size} • ${item.fitType}`,
            })}
          >
            <MaterialCommunityIcons name="star-outline" size={18} color={colors.brand} />
            <Text style={styles.reviewButtonText}>Viết đánh giá</Text>
          </TouchableOpacity>
          )
        ) : null}
      </View>
    );
  };

  const renderTimeline = (currentOrder: CustomerOrder) => {
    const currentTimelineSteps = getTimelineSteps(currentOrder);
    const progressIndex = getProgressIndex(currentOrder, currentTimelineSteps);
    const progressPercent = progressIndex <= 0 ? 0 : (progressIndex / (currentTimelineSteps.length - 1)) * 100;
    const isCancelled = currentOrder.status === 'cancelled';

    if (isCancelled) {
      return (
        <View style={styles.cancelledTimelineCard}>
          <View style={styles.cancelledIcon}>
            <MaterialCommunityIcons name="close-circle-outline" size={26} color={colors.danger} />
          </View>
          <View style={styles.cancelledCopy}>
            <Text style={styles.cancelledTitle}>Đơn hàng đã hủy</Text>
            <Text style={styles.cancelledText}>
              Đơn dừng xử lý vào {formatDate(currentOrder.updatedAt)}. Nếu có thanh toán trước, shop sẽ hoàn tiền theo kênh thanh toán ban đầu.
            </Text>
          </View>
        </View>
      );
    }

    return (
      <View style={styles.timelineCard}>
        <View style={styles.timelineTrack}>
          <View style={styles.timelineBaseLine} />
          <View style={[styles.timelineProgressLine, { width: `${progressPercent}%` }]} />
          {currentTimelineSteps.map((step, index) => {
            const isDone = index <= progressIndex;
            const isCurrent = index === progressIndex;

            return (
              <View
                key={step.key}
                style={[styles.timelineStep, { width: `${100 / currentTimelineSteps.length}%` }]}
              >
                <View style={[styles.timelineDot, isDone && styles.timelineDotDone]}>
                  {isDone ? (
                    <MaterialCommunityIcons name="check" size={17} color={colors.white} />
                  ) : (
                    <View style={styles.timelineDotInner} />
                  )}
                </View>
                <Text style={[styles.timelineLabel, isCurrent && styles.timelineLabelActive]} numberOfLines={2}>
                  {step.label}
                </Text>
                <Text style={styles.timelineHelper} numberOfLines={2}>
                  {index <= progressIndex ? formatShortDate(currentOrder.updatedAt) : step.helper}
                </Text>
              </View>
            );
          })}
        </View>
      </View>
    );
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

  const renderEvidencePicker = (
    images: EvidenceDraft[],
    onPick: () => void,
    onRemove: (index: number) => void,
    disabled: boolean,
  ) => (
    <View style={styles.evidencePicker}>
      <View style={styles.evidenceHeader}>
        <Text style={styles.evidenceTitle}>Ảnh minh chứng</Text>
        <Text style={styles.evidenceHint}>Không bắt buộc, tối đa 3 ảnh</Text>
      </View>
      <View style={styles.evidenceImageRow}>
        {images.map((image, index) => (
          <View style={styles.evidenceImageFrame} key={`${image.uri}-${index}`}>
            <Image source={{ uri: image.uri }} style={styles.evidenceImage} resizeMode="cover" />
            <TouchableOpacity
              style={styles.evidenceRemoveButton}
              onPress={() => onRemove(index)}
              disabled={disabled}
              activeOpacity={0.8}
            >
              <MaterialCommunityIcons name="close" size={14} color={colors.white} />
            </TouchableOpacity>
          </View>
        ))}
        {images.length < 3 ? (
          <TouchableOpacity
            style={styles.evidenceAddButton}
            onPress={onPick}
            disabled={disabled}
            activeOpacity={0.84}
          >
            <MaterialCommunityIcons name="image-plus" size={22} color={colors.brand} />
          </TouchableOpacity>
        ) : null}
      </View>
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
          {renderEvidencePicker(
            cancelEvidenceImages,
            () => void pickEvidenceImage(cancelEvidenceImages, setCancelEvidenceImages, setCancelReasonError),
            (index) => removeEvidenceImage(index, setCancelEvidenceImages),
            isCancelling,
          )}

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

  const renderReturnRequestModal = () => (
    <Modal
      visible={isReturnModalVisible}
      transparent
      animationType="fade"
      onRequestClose={() => setIsReturnModalVisible(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.returnModal}>
          <View style={styles.invoiceHeader}>
            <View>
              <Text style={styles.invoiceEyebrow}>RETURN REQUEST</Text>
              <Text style={styles.invoiceTitle}>Lý do trả hàng</Text>
            </View>
            <TouchableOpacity
              style={styles.modalCloseButton}
              onPress={() => setIsReturnModalVisible(false)}
              disabled={isRequestingReturn}
            >
              <MaterialCommunityIcons name="close" size={22} color={colors.text} />
            </TouchableOpacity>
          </View>

          <Text style={styles.returnModalHint}>
            Shop sẽ xem lý do, hình ảnh minh chứng và phản hồi trên trạng thái đơn hàng. Yêu cầu trả hàng chỉ mở trong 7 ngày sau khi giao thành công.
          </Text>
          <TextInput
            style={styles.returnReasonInput}
            value={returnReason}
            onChangeText={(value) => {
              setReturnReason(value);
              if (returnReasonError) {
                setReturnReasonError('');
              }
            }}
            placeholder="Nhập lý do trả hàng"
            placeholderTextColor={colors.textSubtle}
            multiline
            maxLength={500}
            textAlignVertical="top"
            editable={!isRequestingReturn}
          />
          <View style={styles.returnModalMetaRow}>
            <Text style={styles.returnReasonCounter}>{returnReason.trim().length}/500</Text>
            {returnReasonError ? <Text style={styles.returnReasonError}>{returnReasonError}</Text> : null}
          </View>
          {renderEvidencePicker(
            returnEvidenceImages,
            () => void pickEvidenceImage(returnEvidenceImages, setReturnEvidenceImages, setReturnReasonError),
            (index) => removeEvidenceImage(index, setReturnEvidenceImages),
            isRequestingReturn,
          )}

          <View style={styles.returnModalActions}>
            <TouchableOpacity
              style={styles.returnModalSecondaryButton}
              onPress={() => setIsReturnModalVisible(false)}
              activeOpacity={0.84}
              disabled={isRequestingReturn}
            >
              <Text style={styles.returnModalSecondaryText}>Để sau</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.returnModalPrimaryButton}
              onPress={() => void requestReturn()}
              activeOpacity={0.84}
              disabled={isRequestingReturn}
            >
              {isRequestingReturn ? (
                <ActivityIndicator size="small" color={colors.white} />
              ) : (
                <MaterialCommunityIcons name="send-outline" size={18} color={colors.white} />
              )}
              <Text style={styles.returnModalPrimaryText}>Gửi yêu cầu</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );

  const renderInvoiceModal = () => {
    if (!order) return null;

    const shippingPayable = Math.max(0, order.shippingFee - order.shippingDiscountAmount);

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
              <Text style={styles.invoiceCode}>{order.invoiceCode || order.orderCode}</Text>
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
  const canRetryVNPayPayment =
    order.paymentMethod === 'VNPAY' &&
    order.paymentStatus !== 'paid' &&
    order.paymentStatus !== 'refunded' &&
    order.status !== 'cancelled' &&
    order.status !== 'returned' &&
    (paymentDeadlineRemainingMs === null || paymentDeadlineRemainingMs > 0);

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
          <View style={styles.heroCopy}>
            <Text style={styles.heroLabel}>Mã đơn hàng</Text>
            <View style={styles.heroCodeRow}>
              <Text style={styles.heroCode}>{order.orderCode}</Text>
              <View style={[styles.heroStatusBadge, { backgroundColor: displayState.backgroundColor }]}>
                <Text style={[styles.heroStatusText, { color: displayState.color }]}>{displayState.label}</Text>
              </View>
            </View>
            <Text style={styles.heroDate}>Ngày đặt: {formatDate(order.createdAt)}</Text>
            <Text style={styles.heroDelivery}>
              {displayState.deliveryLine}
            </Text>
          </View>

          <TouchableOpacity style={styles.invoiceButton} onPress={() => setIsInvoiceVisible(true)} activeOpacity={0.84}>
            <MaterialCommunityIcons name="file-document-outline" size={22} color={colors.text} />
            <Text style={styles.invoiceButtonText}>Hóa đơn</Text>
          </TouchableOpacity>
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
          <View style={[styles.statusCallout, { backgroundColor: displayState.backgroundColor }]}>
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

        {renderTimeline(order)}

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
          <View style={styles.returnRequestCard}>
            <View style={styles.returnRequestHeader}>
              <MaterialCommunityIcons name="archive-refresh-outline" size={22} color={colors.brand} />
              <View style={styles.returnRequestTitleGroup}>
                <Text style={styles.returnRequestTitle}>Yêu cầu trả hàng</Text>
                <Text style={styles.returnRequestStatus}>
                  {returnRequestStatusLabels[order.returnRequest.status] ?? order.returnRequest.status}
                </Text>
              </View>
            </View>
            <Text style={styles.returnRequestReason}>{order.returnRequest.reason}</Text>
            {order.returnRequest.reviewReason ? (
              <Text style={styles.returnRequestReview}>{order.returnRequest.reviewReason}</Text>
            ) : null}
            {order.returnRequest.imageUrls?.length ? (
              <View style={styles.evidenceUrlGrid}>
                {order.returnRequest.imageUrls.map((imageUrl) => (
                  <Image key={imageUrl} source={{ uri: imageUrl }} style={styles.evidenceUrlImage} resizeMode="cover" />
                ))}
              </View>
            ) : null}
          </View>
        ) : null}

        <View style={styles.section}>
          {order.order_list.map(renderProduct)}
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
            <Text style={styles.supportRowText}>{canReturn ? 'Trả hàng' : 'Chính sách trả hàng'}</Text>
            <MaterialCommunityIcons name="chevron-right" size={22} color={colors.action} />
          </TouchableOpacity>
        </View>

        {canCancel || canConfirmDelivery || canReturn ? (
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

            {canReturn ? (
              <TouchableOpacity
                style={styles.returnButton}
                onPress={handleRequestReturn}
                activeOpacity={0.84}
                disabled={isRequestingReturn}
              >
                {isRequestingReturn ? (
                  <ActivityIndicator size="small" color={colors.brand} />
                ) : (
                  <MaterialCommunityIcons name="archive-refresh-outline" size={20} color={colors.brand} />
                )}
                <Text style={styles.returnButtonText}>Yêu cầu trả hàng</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        ) : null}
      </ScrollView>

      {renderCancelOrderModal()}
      {renderReturnRequestModal()}
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    ...shadows.card,
  },
  heroCopy: {
    flex: 1,
  },
  heroLabel: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '900',
  },
  heroCode: {
    flex: 1,
    color: colors.text,
    fontSize: 26,
    lineHeight: 34,
    fontWeight: '900',
  },
  heroCodeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: 3,
  },
  heroStatusBadge: {
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
  },
  heroStatusText: {
    fontSize: 12,
    fontWeight: '900',
  },
  heroDate: {
    color: colors.textMuted,
    fontSize: 13,
    marginTop: 6,
  },
  heroDelivery: {
    color: colors.success,
    fontSize: 13,
    fontWeight: '800',
    marginTop: 4,
  },
  invoiceButton: {
    width: 92,
    minHeight: 70,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.surface,
  },
  invoiceButtonText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '900',
  },
  statusCallout: {
    borderRadius: radii.sm,
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
  timelineCard: {
    borderRadius: radii.sm,
    backgroundColor: colors.surface,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.sm,
    ...shadows.card,
  },
  timelineTrack: {
    minHeight: 108,
    flexDirection: 'row',
    justifyContent: 'space-between',
    position: 'relative',
  },
  timelineBaseLine: {
    position: 'absolute',
    left: '12%',
    right: '12%',
    top: 16,
    height: 3,
    borderRadius: 2,
    backgroundColor: colors.borderStrong,
  },
  timelineProgressLine: {
    position: 'absolute',
    left: '12%',
    top: 16,
    height: 3,
    borderRadius: 2,
    backgroundColor: colors.success,
    maxWidth: '76%',
  },
  timelineStep: {
    width: '25%',
    alignItems: 'center',
  },
  timelineDot: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.borderStrong,
    zIndex: 1,
  },
  timelineDotDone: {
    backgroundColor: colors.success,
  },
  timelineDotInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.surface,
  },
  timelineLabel: {
    color: colors.textMuted,
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '800',
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  timelineLabelActive: {
    color: colors.text,
  },
  timelineHelper: {
    color: colors.textSubtle,
    fontSize: 10,
    lineHeight: 14,
    textAlign: 'center',
    marginTop: 2,
  },
  cancelledTimelineCard: {
    borderRadius: radii.sm,
    backgroundColor: colors.surface,
    padding: spacing.lg,
    flexDirection: 'row',
    gap: spacing.md,
    ...shadows.card,
  },
  cancelledIcon: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.dangerSoft,
  },
  cancelledCopy: {
    flex: 1,
  },
  cancelledTitle: {
    color: colors.danger,
    fontSize: 15,
    fontWeight: '900',
  },
  cancelledText: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 4,
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
  returnRequestReview: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 18,
  },
  section: {
    gap: spacing.md,
  },
  productCard: {
    borderRadius: radii.sm,
    backgroundColor: colors.surface,
    padding: spacing.md,
    flexDirection: 'row',
    gap: spacing.md,
    ...shadows.card,
  },
  productImage: {
    width: 86,
    height: 86,
    borderRadius: radii.sm,
    backgroundColor: colors.brandSoft,
  },
  productImagePlaceholder: {
    width: 86,
    height: 86,
    borderRadius: radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F0F2F4',
  },
  productInfo: {
    flex: 1,
    gap: spacing.sm,
  },
  productTitleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  productName: {
    flex: 1,
    color: colors.text,
    fontSize: 15,
    lineHeight: 21,
    fontWeight: '900',
  },
  productPrice: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '900',
  },
  productMetaRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  productMeta: {
    flex: 1,
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
  },
  productQuantity: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '700',
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
    color: colors.text,
    fontSize: 18,
    fontWeight: '900',
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
  evidencePicker: {
    gap: spacing.sm,
  },
  evidenceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  evidenceTitle: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '900',
  },
  evidenceHint: {
    color: colors.textSubtle,
    fontSize: 12,
    fontWeight: '700',
  },
  evidenceImageRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  evidenceImageFrame: {
    position: 'relative',
    width: 64,
    height: 64,
    borderRadius: radii.sm,
    overflow: 'hidden',
    backgroundColor: colors.brandSoft,
  },
  evidenceImage: {
    width: '100%',
    height: '100%',
  },
  evidenceRemoveButton: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  evidenceAddButton: {
    width: 64,
    height: 64,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.brandSoft,
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
  reviewButton: {
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    borderWidth: 1,
    borderColor: colors.brand,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  reviewButtonText: {
    color: colors.brand,
    fontSize: 12,
    fontWeight: '900',
  },
  reviewButtonTextMuted: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '900',
  },
});

export default OrderDetailScreen;
