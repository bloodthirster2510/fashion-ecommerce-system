import React from 'react';
import {
  ActivityIndicator,
  Alert,
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
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import type { RootStackParamList } from '../../navigation/AppNavigator';
import { colors, radii, shadows, spacing } from '../../theme';
import { useAuth } from '../auth/AuthContext';
import {
  paymentMethodsApi,
  type PaymentMethodRecord,
  type PaymentMethodStatus,
} from './paymentMethodsApi';

type PaymentMethodsNavigationProp = StackNavigationProp<RootStackParamList, 'PaymentMethods'>;

const ACTIVE_STATUSES: PaymentMethodStatus[] = ['pending', 'verified'];

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : 'Bạn thử lại sau nha.';

const getMethodIcon = (method: PaymentMethodRecord): keyof typeof MaterialCommunityIcons.glyphMap => {
  if (method.type === 'VNPAY') return 'credit-card-check-outline';
  if (method.type === 'MOMO') return 'wallet-outline';
  if (method.type === 'CARD') return 'credit-card-outline';
  return 'bank-outline';
};

const getStatusLabel = (status: PaymentMethodStatus) => {
  if (status === 'verified') return 'Sẵn sàng';
  if (status === 'pending') return 'Đang xác minh';
  if (status === 'expired') return 'Hết hạn';
  return 'Đã tắt';
};

const isActiveMethod = (method: PaymentMethodRecord) => ACTIVE_STATUSES.includes(method.status);

const PaymentMethodsScreen = () => {
  const navigation = useNavigation<PaymentMethodsNavigationProp>();
  const { isAuthenticated, session, runWithAuth } = useAuth();
  const [methods, setMethods] = React.useState<PaymentMethodRecord[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isRefreshing, setIsRefreshing] = React.useState(false);
  const [isSaving, setIsSaving] = React.useState(false);
  const [pendingMethodId, setPendingMethodId] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [bankCode, setBankCode] = React.useState('');
  const [bankName, setBankName] = React.useState('');
  const [displayName, setDisplayName] = React.useState('');

  const activeMethods = React.useMemo(() => methods.filter(isActiveMethod), [methods]);

  const loadMethods = React.useCallback(
    async (silent = false) => {
      if (!isAuthenticated || !session?.accessToken) {
        setMethods([]);
        setIsLoading(false);
        setIsRefreshing(false);
        return;
      }

      if (silent) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }
      setError(null);

      try {
        const nextMethods = await runWithAuth((accessToken) => paymentMethodsApi.list(accessToken));
        setMethods(nextMethods);
      } catch (loadError) {
        const message = getErrorMessage(loadError);
        setError(message);
        if (silent) {
          Alert.alert('Chưa tải được phương thức thanh toán', message);
        }
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [isAuthenticated, runWithAuth, session?.accessToken],
  );

  useFocusEffect(
    React.useCallback(() => {
      void loadMethods();
    }, [loadMethods]),
  );

  const handleCreateVNPayMethod = async () => {
    if (!session?.accessToken) {
      navigation.navigate('Login');
      return;
    }

    try {
      setIsSaving(true);
      await runWithAuth((accessToken) =>
        paymentMethodsApi.create(accessToken, {
          type: 'VNPAY',
          bankCode: bankCode.trim() || undefined,
          bankName: bankName.trim() || undefined,
          displayName: displayName.trim() || undefined,
          isDefault: activeMethods.length === 0,
        }),
      );

      setBankCode('');
      setBankName('');
      setDisplayName('');
      await loadMethods(true);
    } catch (createError) {
      Alert.alert('Chưa lưu được phương thức', getErrorMessage(createError));
    } finally {
      setIsSaving(false);
    }
  };

  const handleSetDefault = async (method: PaymentMethodRecord) => {
    if (method.isDefault || pendingMethodId) {
      return;
    }

    try {
      setPendingMethodId(method._id);
      await runWithAuth((accessToken) => paymentMethodsApi.setDefault(accessToken, method._id));
      await loadMethods(true);
    } catch (defaultError) {
      Alert.alert('Chưa đặt được mặc định', getErrorMessage(defaultError));
    } finally {
      setPendingMethodId(null);
    }
  };

  const handleRemove = (method: PaymentMethodRecord) => {
    if (pendingMethodId) {
      return;
    }

    Alert.alert(
      'Xoá phương thức thanh toán',
      `Bạn muốn xoá ${method.displayName}?`,
      [
        { text: 'Huỷ', style: 'cancel' },
        {
          text: 'Xoá',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              try {
                setPendingMethodId(method._id);
                await runWithAuth((accessToken) => paymentMethodsApi.remove(accessToken, method._id));
                await loadMethods(true);
              } catch (removeError) {
                Alert.alert('Chưa xoá được phương thức', getErrorMessage(removeError));
              } finally {
                setPendingMethodId(null);
              }
            })();
          },
        },
      ],
    );
  };

  const renderMethod = (method: PaymentMethodRecord) => {
    const isPending = pendingMethodId === method._id;
    const isActive = isActiveMethod(method);

    return (
      <View key={method._id} style={[styles.methodCard, !isActive && styles.methodCardDisabled]}>
        <View style={styles.methodIcon}>
          <MaterialCommunityIcons name={getMethodIcon(method)} size={22} color={colors.brand} />
        </View>
        <View style={styles.methodBody}>
          <View style={styles.methodTitleRow}>
            <Text style={styles.methodTitle} numberOfLines={1}>
              {method.displayName}
            </Text>
            {method.isDefault ? (
              <View style={styles.defaultBadge}>
                <MaterialCommunityIcons name="star" size={12} color={colors.goldText} />
                <Text style={styles.defaultBadgeText}>Mặc định</Text>
              </View>
            ) : null}
          </View>
          <Text style={styles.methodMeta} numberOfLines={1}>
            {[method.maskedInfo, method.bankName, method.bankCode].filter(Boolean).join(' / ') || method.provider}
          </Text>
          <View style={styles.statusRow}>
            <View style={[styles.statusBadge, !isActive && styles.statusBadgeMuted]}>
              <Text style={[styles.statusText, !isActive && styles.statusTextMuted]}>
                {getStatusLabel(method.status)}
              </Text>
            </View>
          </View>
        </View>
        <View style={styles.methodActions}>
          {isPending ? (
            <ActivityIndicator size="small" color={colors.brand} />
          ) : (
            <>
              <TouchableOpacity
                style={[styles.iconButton, (method.isDefault || !isActive) && styles.iconButtonDisabled]}
                onPress={() => void handleSetDefault(method)}
                disabled={method.isDefault || !isActive}
                activeOpacity={0.82}
              >
                <MaterialCommunityIcons
                  name={method.isDefault ? 'star' : 'star-outline'}
                  size={19}
                  color={method.isDefault ? colors.goldDark : colors.textMuted}
                />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.iconButton}
                onPress={() => handleRemove(method)}
                activeOpacity={0.82}
              >
                <MaterialCommunityIcons name="trash-can-outline" size={19} color={colors.danger} />
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    );
  };

  const renderContent = () => {
    if (!isAuthenticated || !session?.accessToken) {
      return (
        <View style={styles.statePanel}>
          <MaterialCommunityIcons name="credit-card-outline" size={42} color={colors.brand} />
          <Text style={styles.stateTitle}>Đăng nhập để quản lý thanh toán</Text>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => navigation.navigate('Login')}
            activeOpacity={0.82}
          >
            <Text style={styles.primaryButtonText}>Đăng nhập</Text>
          </TouchableOpacity>
        </View>
      );
    }

    if (isLoading) {
      return (
        <View style={styles.statePanel}>
          <ActivityIndicator color={colors.brand} />
          <Text style={styles.stateText}>Đang tải phương thức thanh toán</Text>
        </View>
      );
    }

    return (
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={() => void loadMethods(true)}
            tintColor={colors.brand}
          />
        }
      >
        {error ? (
          <View style={styles.errorBanner}>
            <MaterialCommunityIcons name="alert-circle-outline" size={18} color={colors.danger} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Đã lưu</Text>
            <Text style={styles.sectionMeta}>{activeMethods.length} đang hoạt động</Text>
          </View>
          {methods.length ? (
            <View style={styles.methodList}>{methods.map(renderMethod)}</View>
          ) : (
            <View style={styles.emptyPanel}>
              <MaterialCommunityIcons name="credit-card-plus-outline" size={34} color={colors.brand} />
              <Text style={styles.emptyTitle}>Chưa có phương thức nào</Text>
              <Text style={styles.emptyText}>Thêm preference VNPay để checkout tự động dùng ngân hàng quen thuộc.</Text>
            </View>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Thêm VNPay</Text>
          <View style={styles.formCard}>
            <TextInput
              style={styles.input}
              value={displayName}
              onChangeText={setDisplayName}
              placeholder="Tên hiển thị (ví dụ: VNPay Vietcombank)"
              placeholderTextColor={colors.textSubtle}
            />
            <TextInput
              style={styles.input}
              value={bankCode}
              onChangeText={(value) => setBankCode(value.toUpperCase())}
              placeholder="Mã ngân hàng (tuỳ chọn)"
              placeholderTextColor={colors.textSubtle}
              autoCapitalize="characters"
            />
            <TextInput
              style={styles.input}
              value={bankName}
              onChangeText={setBankName}
              placeholder="Tên ngân hàng (tuỳ chọn)"
              placeholderTextColor={colors.textSubtle}
            />
            <View style={styles.safetyRow}>
              <MaterialCommunityIcons name="shield-check-outline" size={17} color={colors.success} />
              <Text style={styles.safetyText}>Không lưu số thẻ, CVV, OTP hoặc mật khẩu ngân hàng.</Text>
            </View>
            <TouchableOpacity
              style={[styles.primaryButton, isSaving && styles.primaryButtonDisabled]}
              onPress={() => void handleCreateVNPayMethod()}
              disabled={isSaving}
              activeOpacity={0.82}
            >
              {isSaving ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <Text style={styles.primaryButtonText}>Lưu VNPay</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Profile'))}
          activeOpacity={0.82}
        >
          <MaterialCommunityIcons name="chevron-left" size={28} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.headerCopy}>
          <Text style={styles.headerTitle}>Thanh toán</Text>
          <Text style={styles.headerSubtitle}>Phương thức mặc định cho checkout</Text>
        </View>
      </View>
      {renderContent()}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    minHeight: 72,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  backButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.brandSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCopy: {
    flex: 1,
    minWidth: 0,
  },
  headerTitle: {
    color: colors.black,
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '900',
  },
  headerSubtitle: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 2,
  },
  scrollContent: {
    padding: spacing.md,
    paddingBottom: spacing.xxl,
    gap: spacing.xl,
  },
  statePanel: {
    margin: spacing.md,
    minHeight: 260,
    borderRadius: radii.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.md,
  },
  stateTitle: {
    color: colors.text,
    fontSize: 17,
    lineHeight: 23,
    fontWeight: '900',
    textAlign: 'center',
  },
  stateText: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
  },
  errorBanner: {
    minHeight: 42,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.dangerSoft,
    backgroundColor: '#FFF8F8',
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  errorText: {
    flex: 1,
    color: colors.danger,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '700',
  },
  section: {
    gap: spacing.md,
  },
  sectionHeader: {
    minHeight: 28,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  sectionTitle: {
    color: colors.black,
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '900',
  },
  sectionMeta: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '800',
  },
  methodList: {
    gap: spacing.md,
  },
  methodCard: {
    minHeight: 92,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    ...shadows.card,
  },
  methodCardDisabled: {
    opacity: 0.68,
  },
  methodIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.brandSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  methodBody: {
    flex: 1,
    minWidth: 0,
    gap: 5,
  },
  methodTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  methodTitle: {
    flex: 1,
    minWidth: 0,
    color: colors.black,
    fontSize: 14,
    lineHeight: 19,
    fontWeight: '900',
  },
  methodMeta: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 17,
  },
  statusRow: {
    minHeight: 24,
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusBadge: {
    borderRadius: radii.pill,
    backgroundColor: colors.successSoft,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
  },
  statusBadgeMuted: {
    backgroundColor: colors.border,
  },
  statusText: {
    color: colors.success,
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '900',
  },
  statusTextMuted: {
    color: colors.textMuted,
  },
  defaultBadge: {
    height: 24,
    borderRadius: radii.pill,
    backgroundColor: colors.goldSoft,
    paddingHorizontal: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  defaultBadgeText: {
    color: colors.goldText,
    fontSize: 10,
    lineHeight: 14,
    fontWeight: '900',
  },
  methodActions: {
    width: 82,
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: spacing.sm,
  },
  iconButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.brandSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconButtonDisabled: {
    opacity: 0.52,
  },
  emptyPanel: {
    minHeight: 150,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.sm,
  },
  emptyTitle: {
    color: colors.black,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '900',
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 17,
    textAlign: 'center',
  },
  formCard: {
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.md,
    gap: spacing.md,
    ...shadows.card,
  },
  input: {
    minHeight: 46,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.field,
    paddingHorizontal: spacing.md,
    color: colors.text,
    fontSize: 14,
  },
  safetyRow: {
    borderRadius: radii.sm,
    backgroundColor: colors.successSoft,
    padding: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  safetyText: {
    flex: 1,
    minWidth: 0,
    color: colors.success,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '800',
  },
  primaryButton: {
    minHeight: 44,
    borderRadius: radii.sm,
    backgroundColor: colors.black,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonDisabled: {
    opacity: 0.56,
  },
  primaryButtonText: {
    color: colors.white,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '900',
  },
});

export default PaymentMethodsScreen;
