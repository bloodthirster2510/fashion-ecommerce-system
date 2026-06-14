import React from 'react';
import {
  ActivityIndicator,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import * as WebBrowser from 'expo-web-browser';
import type { RootStackParamList } from '../../navigation/AppNavigator';
import { colors, radii, spacing } from '../../theme';
import { useAuth } from '../auth/AuthContext';
import { paymentApi, PaymentApiError } from '../payments/paymentApi';

type OrderSuccessNavigationProp = StackNavigationProp<RootStackParamList, 'OrderSuccess'>;
type OrderSuccessRouteProp = RouteProp<RootStackParamList, 'OrderSuccess'>;

const formatCurrency = (value: number) =>
  `${Math.round(value).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')}đ`;

const getUrlParam = (url: string, key: string) => {
  const match = url.match(new RegExp(`[?&]${key}=([^&]+)`));
  return match ? decodeURIComponent(match[1]) : null;
};

type PaymentStatusBadgeProps = {
  paymentMethod: string;
  paymentStatus: string;
};

const PaymentStatusBadge = ({ paymentMethod, paymentStatus }: PaymentStatusBadgeProps) => {
  const isVnpay = paymentMethod === 'VNPAY';
  const isMomo = paymentMethod === 'MOMO';
  const isOnline = isVnpay || isMomo;

  if (!isOnline) {
    return (
      <View style={[styles.badge, styles.badgeCod]}>
        <MaterialCommunityIcons name="truck-delivery-outline" size={16} color={colors.text} />
        <Text style={styles.badgeTextCod}>Thanh toán khi nhận hàng (COD)</Text>
      </View>
    );
  }

  if (paymentStatus === 'paid') {
    return (
      <View style={[styles.badge, styles.badgeSuccess]}>
        <MaterialCommunityIcons name="check-circle-outline" size={16} color={colors.success} />
        <Text style={styles.badgeTextSuccess}>Đã thanh toán qua {isVnpay ? 'VNPAY' : 'MoMo'}</Text>
      </View>
    );
  }

  if (paymentStatus === 'failed') {
    return (
      <View style={[styles.badge, styles.badgeFailed]}>
        <MaterialCommunityIcons name="close-circle-outline" size={16} color={colors.danger} />
        <Text style={styles.badgeTextFailed}>Thanh toán chưa thành công</Text>
      </View>
    );
  }

  // pending / awaiting
  return (
    <View style={[styles.badge, styles.badgePending]}>
      <MaterialCommunityIcons name="clock-outline" size={16} color={colors.goldText} />
      <Text style={styles.badgeTextPending}>Chờ thanh toán qua {isVnpay ? 'VNPAY' : 'MoMo'}</Text>
    </View>
  );
};

const OrderSuccessScreen = () => {
  const navigation = useNavigation<OrderSuccessNavigationProp>();
  const route = useRoute<OrderSuccessRouteProp>();
  const { runWithAuth, session } = useAuth();

  const {
    orderId,
    orderCode,
    totalAmount,
    paymentMethod,
    paymentStatus,
    isProcessingPayment,
    paymentMessage: initialPaymentMessage,
  } = route.params;
  const [latestPaymentStatus, setLatestPaymentStatus] = React.useState<string>(paymentStatus);
  const [canPayNow, setCanPayNow] = React.useState(paymentMethod === 'VNPAY' && paymentStatus !== 'paid');
  const [isCheckingPayment, setIsCheckingPayment] = React.useState(Boolean(isProcessingPayment));
  const [isRetryingPayment, setIsRetryingPayment] = React.useState(false);
  const [paymentMessage, setPaymentMessage] = React.useState(initialPaymentMessage ?? '');
  const isVNPayPending = paymentMethod === 'VNPAY' && latestPaymentStatus !== 'paid';

  const refreshPaymentStatus = React.useCallback(
    async (silent = false) => {
      if (paymentMethod !== 'VNPAY' || !session?.accessToken) {
        return latestPaymentStatus;
      }

      if (!silent) {
        setIsCheckingPayment(true);
      }

      try {
        const result = await runWithAuth((accessToken) =>
          paymentApi.getOrderPaymentStatus(accessToken, orderId),
        );
        setLatestPaymentStatus(result.paymentStatus);
        setCanPayNow(result.canPayNow);
        if (result.paymentStatus === 'paid') {
          setPaymentMessage('Hệ thống đã ghi nhận thanh toán.');
        } else if (!silent) {
          setPaymentMessage('Chưa ghi nhận thanh toán. Bạn có thể thử lại hoặc đợi hệ thống cập nhật.');
        } else {
          setPaymentMessage((currentMessage) =>
            currentMessage || 'Chưa ghi nhận thanh toán. Bạn có thể thử lại hoặc đợi hệ thống cập nhật.',
          );
        }

        return result.paymentStatus;
      } catch (error) {
        if (!silent) {
          setPaymentMessage(error instanceof Error ? error.message : 'Chưa kiểm tra được trạng thái thanh toán.');
        }

        return latestPaymentStatus;
      } finally {
        if (!silent) {
          setIsCheckingPayment(false);
        }
      }
    },
    [latestPaymentStatus, orderId, paymentMethod, runWithAuth, session?.accessToken],
  );

  const handlePaymentReturnUrl = React.useCallback(
    (url: string) => {
      if (!url.includes('payment-return')) {
        return;
      }

      const returnedOrderId = getUrlParam(url, 'orderId');
      if (returnedOrderId && returnedOrderId !== orderId) {
        return;
      }

      const returnedStatus = getUrlParam(url, 'paymentStatus');
      if (returnedStatus) {
        setLatestPaymentStatus(returnedStatus);
      }

      void refreshPaymentStatus(false);
    },
    [orderId, refreshPaymentStatus],
  );

  React.useEffect(() => {
    const subscription = Linking.addEventListener('url', ({ url }) => {
      handlePaymentReturnUrl(url);
    });

    Linking.getInitialURL()
      .then((url) => {
        if (url) {
          handlePaymentReturnUrl(url);
        }
      })
      .catch(() => undefined);

    return () => {
      subscription.remove();
    };
  }, [handlePaymentReturnUrl]);

  React.useEffect(() => {
    if (!isVNPayPending || !session?.accessToken) {
      return undefined;
    }

    let isActive = true;
    let attempt = 0;
    let timeout: ReturnType<typeof setTimeout> | null = null;

    const poll = async () => {
      if (!isActive || attempt >= 8) {
        setIsCheckingPayment(false);
        return;
      }

      attempt += 1;
      setIsCheckingPayment(true);
      const nextStatus = await refreshPaymentStatus(true);

      if (!isActive || nextStatus === 'paid') {
        setIsCheckingPayment(false);
        return;
      }

      timeout = setTimeout(() => {
        void poll();
      }, 3000);
    };

    void poll();

    return () => {
      isActive = false;
      if (timeout) {
        clearTimeout(timeout);
      }
    };
  }, [isVNPayPending, refreshPaymentStatus, session?.accessToken]);

  const handleRetryPayment = async () => {
    if (!session?.accessToken || isRetryingPayment) {
      return;
    }

    try {
      setIsRetryingPayment(true);
      setPaymentMessage('');
      const paymentData = await runWithAuth((accessToken) =>
        paymentApi.createVNPayUrlFromOrder(accessToken, orderId),
      );

      void WebBrowser.openBrowserAsync(paymentData.paymentUrl, {
        presentationStyle: WebBrowser.WebBrowserPresentationStyle.FULL_SCREEN,
      })
        .then(() => refreshPaymentStatus(false))
        .catch((error) => {
          console.warn('Cannot open VNPay browser', error);
          setPaymentMessage('Không thể mở trang thanh toán VNPay. Bạn thử lại sau nha.');
        });

      setPaymentMessage('Trang thanh toán VNPay đã mở. Sau khi thanh toán, quay lại app để hệ thống cập nhật trạng thái.');
    } catch (error) {
      const message =
        error instanceof PaymentApiError || error instanceof Error
          ? error.message
          : 'Không lấy được link thanh toán.';
      setPaymentMessage(message);
    } finally {
      setIsRetryingPayment(false);
    }
  };

  const handleDismiss = () => {
    navigation.navigate('Home');
  };

  const handleViewInvoice = () => {
    navigation.replace('OrderDetail', { orderId });
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero Section */}
        <View style={styles.heroSection}>
          <View style={styles.heroIcon}>
            <MaterialCommunityIcons
              name="check-circle"
              size={64}
              color={colors.success}
            />
          </View>
          <Text style={styles.heroTitle}>Đặt hàng thành công!</Text>
          <Text style={styles.heroSubtitle}>
            Cảm ơn bạn đã mua sắm tại FashionShop
          </Text>
        </View>

        {/* Order Info Card */}
        <View style={styles.card}>
          <View style={styles.cardRow}>
            <Text style={styles.cardLabel}>Mã đơn hàng</Text>
            <Text style={styles.cardValueBold}>{orderCode}</Text>
          </View>
          <View style={[styles.cardRow, styles.cardRowLast]}>
            <Text style={styles.cardLabel}>Tổng thanh toán</Text>
            <Text style={styles.cardValueAmount}>{formatCurrency(totalAmount)}</Text>
          </View>
        </View>

        {/* Payment Status */}
        <View style={styles.card}>
          <Text style={styles.cardSectionTitle}>Thanh toán</Text>
          <PaymentStatusBadge
            paymentMethod={paymentMethod}
            paymentStatus={latestPaymentStatus}
          />
          {(isProcessingPayment || isCheckingPayment) && latestPaymentStatus !== 'paid' && (
            <View style={styles.processingRow}>
              <ActivityIndicator size="small" color={colors.brand} />
              <Text style={styles.processingText}>Đang xác nhận thanh toán với cổng...</Text>
            </View>
          )}
          {paymentMessage ? (
            <Text style={styles.paymentNote}>{paymentMessage}</Text>
          ) : null}
          {paymentMethod === 'VNPAY' && latestPaymentStatus !== 'paid' && (
            <Text style={styles.paymentNote}>
              Nếu bạn đã thanh toán thành công, hệ thống sẽ tự động cập nhật trạng thái đơn hàng trong vài phút.
            </Text>
          )}
          {paymentMethod === 'COD' && (
            <Text style={styles.paymentNote}>
              Bạn sẽ thanh toán cho người giao hàng khi nhận được sản phẩm.
            </Text>
          )}
        </View>

        {/* Actions */}
        <View style={styles.actions}>
          <Text style={styles.invoicePrompt}>Bạn muốn xem hóa đơn của đơn hàng này không?</Text>
          <Pressable style={styles.primaryButton} onPress={handleViewInvoice}>
            <MaterialCommunityIcons name="receipt-text-outline" size={20} color={colors.white} />
            <Text style={styles.primaryButtonText}>Xem hóa đơn</Text>
          </Pressable>
          {isVNPayPending ? (
            <>
              <Pressable
                style={[styles.secondaryButton, isCheckingPayment && styles.buttonDisabled]}
                onPress={() => void refreshPaymentStatus(false)}
                disabled={isCheckingPayment}
              >
                {isCheckingPayment ? (
                  <ActivityIndicator size="small" color={colors.brand} />
                ) : (
                  <MaterialCommunityIcons name="sync" size={20} color={colors.brand} />
                )}
                <Text style={styles.secondaryButtonText}>Kiểm tra trạng thái</Text>
              </Pressable>
              <Pressable
                style={[styles.secondaryButton, (!canPayNow || isRetryingPayment) && styles.buttonDisabled]}
                onPress={() => void handleRetryPayment()}
                disabled={!canPayNow || isRetryingPayment}
              >
                {isRetryingPayment ? (
                  <ActivityIndicator size="small" color={colors.brand} />
                ) : (
                  <MaterialCommunityIcons name="credit-card-refresh-outline" size={20} color={colors.brand} />
                )}
                <Text style={styles.secondaryButtonText}>Thanh toán lại</Text>
              </Pressable>
            </>
          ) : null}
          <Pressable style={styles.secondaryButton} onPress={handleDismiss}>
            <MaterialCommunityIcons name="home-outline" size={20} color={colors.brand} />
            <Text style={styles.secondaryButtonText}>Để sau</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.md,
    paddingBottom: spacing.xl,
  },
  heroSection: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    gap: spacing.sm,
  },
  heroIcon: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: colors.successSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  heroTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.black,
    textAlign: 'center',
  },
  heroSubtitle: {
    fontSize: 14,
    color: colors.textBody,
    textAlign: 'center',
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  cardSectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  cardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  cardRowLast: {
    borderBottomWidth: 0,
  },
  cardLabel: {
    fontSize: 14,
    color: colors.textBody,
  },
  cardValueBold: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.black,
    fontFamily: 'monospace',
  },
  cardValueAmount: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.brand,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: radii.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: 8,
  },
  badgeCod: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  badgeTextCod: {
    fontSize: 13,
    color: colors.text,
    fontWeight: '600',
    flex: 1,
  },
  badgeSuccess: {
    backgroundColor: colors.successSoft,
  },
  badgeTextSuccess: {
    fontSize: 13,
    color: colors.success,
    fontWeight: '700',
    flex: 1,
  },
  badgeFailed: {
    backgroundColor: colors.dangerSoft,
  },
  badgeTextFailed: {
    fontSize: 13,
    color: colors.danger,
    fontWeight: '700',
    flex: 1,
  },
  badgePending: {
    backgroundColor: colors.goldSoft,
  },
  badgeTextPending: {
    fontSize: 13,
    color: colors.goldText,
    fontWeight: '700',
    flex: 1,
  },
  processingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: 4,
  },
  processingText: {
    fontSize: 12,
    color: colors.textMuted,
    flex: 1,
  },
  paymentNote: {
    fontSize: 12,
    color: colors.textMuted,
    lineHeight: 17,
    marginTop: 4,
  },
  actions: {
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  invoicePrompt: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.textBody,
    textAlign: 'center',
    fontWeight: '700',
    marginBottom: 2,
  },
  primaryButton: {
    height: 50,
    borderRadius: radii.sm,
    backgroundColor: colors.brand,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  primaryButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.white,
  },
  secondaryButton: {
    height: 50,
    borderRadius: radii.sm,
    borderWidth: 1.5,
    borderColor: colors.brand,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  buttonDisabled: {
    opacity: 0.56,
  },
  secondaryButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.brand,
  },
});

export default OrderSuccessScreen;
