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
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import * as WebBrowser from 'expo-web-browser';
import { colors, radii, shadows, spacing } from '../../theme';
import type { RootStackParamList } from '../../navigation/AppNavigator';
import { useAuth } from '../auth/AuthContext';
import { paymentApi, PaymentApiError } from '../payments/paymentApi';
import { orderApi, OrderApiError, type CustomerOrder, type OrderItem } from './orderApi';
import {
  canCancelOrder,
  canConfirmReceived,
  canRequestReturn,
  formatAddress,
  formatCurrency,
  formatDate,
  formatShortDate,
  getDeliveryLine,
  paymentMethodLabels,
  paymentStatusLabels,
  statusMeta,
} from './orderPresentation';

type OrderDetailNavigationProp = StackNavigationProp<RootStackParamList, 'OrderDetail'>;
type OrderDetailRouteProp = RouteProp<RootStackParamList, 'OrderDetail'>;

type TimelineStep = {
  key: 'confirmed' | 'packed' | 'shipping' | 'delivered';
  label: string;
  helper: string;
};

const timelineSteps: TimelineStep[] = [
  { key: 'confirmed', label: 'Đã xác nhận', helper: 'Đã ghi nhận đơn' },
  { key: 'packed', label: 'Đã đóng gói', helper: 'Chờ bàn giao vận chuyển' },
  { key: 'shipping', label: 'Đã rời kho', helper: 'Đang giao tới bạn' },
  { key: 'delivered', label: 'Đã giao', helper: 'Hoàn tất' },
];

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

const getProgressIndex = (order: CustomerOrder) => {
  if (order.status === 'cancelled') return -1;
  if (order.status === 'returned' || order.status === 'return_requested') return 3;

  return timelineSteps.findIndex((step) => step.key === order.status);
};

const getPaymentStatusColor = (status: string) => {
  if (status === 'paid') return colors.success;
  if (status === 'failed' || status === 'refunded') return colors.danger;
  return colors.goldText;
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

  useFocusEffect(
    React.useCallback(() => {
      void loadOrder();
    }, [loadOrder]),
  );

  const handleCancelOrder = () => {
    if (!order) return;

    Alert.alert(
      'Hủy đơn hàng?',
      'Đơn sẽ dừng xử lý nếu chưa bàn giao cho đơn vị vận chuyển. Với đơn đã thanh toán, hoàn tiền sẽ được xử lý theo kênh thanh toán ban đầu.',
      [
        { text: 'Để sau', style: 'cancel' },
        {
          text: 'Hủy đơn',
          style: 'destructive',
          onPress: () => {
            void confirmCancelOrder();
          },
        },
      ],
    );
  };

  const confirmCancelOrder = async () => {
    if (!order) return;

    try {
      setIsCancelling(true);
      const nextOrder = await runWithAuth((accessToken) => orderApi.cancelOrder(accessToken, order._id));
      setOrder(nextOrder);
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

    Alert.alert(
      'Gửi yêu cầu trả hàng?',
      'Shop sẽ ghi nhận yêu cầu và liên hệ bạn để kiểm tra điều kiện trả hàng. Sản phẩm cần còn tem mác, chưa qua sử dụng và có hóa đơn.',
      [
        { text: 'Để sau', style: 'cancel' },
        {
          text: 'Gửi yêu cầu',
          onPress: () => {
            void requestReturn();
          },
        },
      ],
    );
  };

  const requestReturn = async () => {
    if (!order) return;

    try {
      setIsRequestingReturn(true);
      const nextOrder = await runWithAuth((accessToken) => orderApi.requestReturn(accessToken, order._id));
      setOrder(nextOrder);
      Alert.alert('Đã gửi yêu cầu trả hàng', 'Shop đã ghi nhận yêu cầu và sẽ phản hồi trong thời gian sớm nhất.');
    } catch (error) {
      Alert.alert('Không thể gửi yêu cầu', getErrorMessage(error));
    } finally {
      setIsRequestingReturn(false);
    }
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

      await WebBrowser.openBrowserAsync(paymentData.paymentUrl, {
        presentationStyle: WebBrowser.WebBrowserPresentationStyle.FULL_SCREEN,
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
          `Địa chỉ: ${formatAddress(order)}`,
        ].join('\n'),
      );
      return;
    }

    if (type === 'return') {
      handleRequestReturn();
      return;
    }

    Alert.alert(
      'Vấn đề đơn hàng',
      `Shop đã ghi nhận kênh hỗ trợ cho đơn ${order.orderCode}. Thời gian tư vấn: 8:30 - 21:45 mỗi ngày.`,
    );
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
      </View>
    );
  };

  const renderTimeline = (currentOrder: CustomerOrder) => {
    const progressIndex = getProgressIndex(currentOrder);
    const progressPercent = progressIndex <= 0 ? 0 : (progressIndex / (timelineSteps.length - 1)) * 100;
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
          {timelineSteps.map((step, index) => {
            const isDone = index <= progressIndex;
            const isCurrent = index === progressIndex;

            return (
              <View key={step.key} style={styles.timelineStep}>
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
              ? renderSummaryRow('Voucher', `-${formatCurrency(order.couponDiscountAmount)}`, 'discount')
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
            <Text style={styles.brand}>FASHIONISTA</Text>
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

  const meta = statusMeta[order.status];
  const shippingPayable = Math.max(0, order.shippingFee - order.shippingDiscountAmount);
  const paymentStatusColor = getPaymentStatusColor(order.paymentStatus);
  const canCancel = canCancelOrder(order.status);
  const canConfirmDelivery = canConfirmReceived(order.status);
  const canReturn = canRequestReturn(order.status);
  const canRetryVNPayPayment =
    order.paymentMethod === 'VNPAY' &&
    order.paymentStatus !== 'paid' &&
    order.paymentStatus !== 'refunded' &&
    order.status !== 'cancelled' &&
    order.status !== 'returned';

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
          <Text style={styles.brand}>FASHIONISTA</Text>
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
              <View style={[styles.heroStatusBadge, { backgroundColor: meta.backgroundColor }]}>
                <Text style={[styles.heroStatusText, { color: meta.color }]}>{meta.label}</Text>
              </View>
            </View>
            <Text style={styles.heroDate}>Ngày đặt: {formatDate(order.createdAt)}</Text>
            <Text style={styles.heroDelivery}>
              {getDeliveryLine(order)}
            </Text>
          </View>

          <TouchableOpacity style={styles.invoiceButton} onPress={() => setIsInvoiceVisible(true)} activeOpacity={0.84}>
            <MaterialCommunityIcons name="file-document-outline" size={22} color={colors.text} />
            <Text style={styles.invoiceButtonText}>Hóa đơn</Text>
          </TouchableOpacity>
        </View>

        <View style={[styles.statusCallout, { backgroundColor: meta.backgroundColor }]}>
          <MaterialCommunityIcons name="information-outline" size={20} color={meta.color} />
          <View style={styles.statusCalloutCopy}>
            <Text style={[styles.statusCalloutTitle, { color: meta.color }]}>{meta.label}</Text>
            <Text style={styles.statusCalloutText}>{meta.description}</Text>
          </View>
        </View>

        {renderTimeline(order)}

        <View style={styles.section}>
          {order.order_list.map(renderProduct)}
        </View>

        <View style={styles.summaryCard}>
          <Text style={styles.sectionTitle}>Tóm tắt đơn hàng</Text>
          {renderSummaryRow('Tạm tính', formatCurrency(order.subTotal))}
          {order.couponDiscountAmount > 0
            ? renderSummaryRow(`Voucher${order.couponCode ? ` ${order.couponCode}` : ''}`, `-${formatCurrency(order.couponDiscountAmount)}`, 'discount')
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
            <Text style={styles.infoValue}>{formatAddress(order)}</Text>
            <Text style={styles.infoHint}>{order.shippingAddress.phoneNumber}</Text>
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
    minHeight: 84,
    paddingHorizontal: spacing.xl,
    paddingTop: 10,
    paddingBottom: 18,
    backgroundColor: colors.brand,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerAction: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  headerActionPlaceholder: {
    width: 42,
    height: 42,
  },
  headerTitleGroup: {
    flex: 1,
    paddingHorizontal: 12,
  },
  brand: {
    color: colors.brandMist,
    fontSize: 13,
    fontWeight: '700',
  },
  headerTitle: {
    color: colors.white,
    fontSize: 25,
    lineHeight: 32,
    fontWeight: '800',
    marginTop: 2,
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
});

export default OrderDetailScreen;
