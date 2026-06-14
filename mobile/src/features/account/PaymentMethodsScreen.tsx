import React from 'react';
import {
  ActivityIndicator,
  Alert,
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
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import type { RootStackParamList } from '../../navigation/AppNavigator';
import { colors, radii, shadows, spacing } from '../../theme';
import { useAuth } from '../auth/AuthContext';
import {
  paymentMethodsApi,
  type PaymentMethodRecord,
  type PaymentMethodStatus,
  type PaymentMethodType,
} from './paymentMethodsApi';

type PaymentMethodsNavigationProp = StackNavigationProp<RootStackParamList, 'PaymentMethods'>;
type FieldConfig = {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  keyboardType?: 'default' | 'number-pad';
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
};
type BankOption = {
  code: string;
  name: string;
  shortName: string;
};

const DEFAULTABLE_STATUSES: PaymentMethodStatus[] = ['verified'];
const BANK_OPTIONS: BankOption[] = [
  { code: 'VCB', name: 'Ngân hàng TMCP Ngoại thương Việt Nam', shortName: 'Vietcombank' },
  { code: 'TCB', name: 'Ngân hàng TMCP Kỹ thương Việt Nam', shortName: 'Techcombank' },
  { code: 'BIDV', name: 'Ngân hàng TMCP Đầu tư và Phát triển Việt Nam', shortName: 'BIDV' },
  { code: 'CTG', name: 'Ngân hàng TMCP Công thương Việt Nam', shortName: 'VietinBank' },
  { code: 'VBA', name: 'Ngân hàng Nông nghiệp và Phát triển Nông thôn Việt Nam', shortName: 'Agribank' },
  { code: 'ACB', name: 'Ngân hàng TMCP Á Châu', shortName: 'ACB' },
  { code: 'MB', name: 'Ngân hàng TMCP Quân đội', shortName: 'MB Bank' },
  { code: 'VPB', name: 'Ngân hàng TMCP Việt Nam Thịnh Vượng', shortName: 'VPBank' },
  { code: 'TPB', name: 'Ngân hàng TMCP Tiên Phong', shortName: 'TPBank' },
  { code: 'STB', name: 'Ngân hàng TMCP Sài Gòn Thương Tín', shortName: 'Sacombank' },
  { code: 'HDB', name: 'Ngân hàng TMCP Phát triển TP.HCM', shortName: 'HDBank' },
  { code: 'VIB', name: 'Ngân hàng TMCP Quốc tế Việt Nam', shortName: 'VIB' },
  { code: 'OCB', name: 'Ngân hàng TMCP Phương Đông', shortName: 'OCB' },
  { code: 'MSB', name: 'Ngân hàng TMCP Hàng Hải Việt Nam', shortName: 'MSB' },
  { code: 'SHB', name: 'Ngân hàng TMCP Sài Gòn - Hà Nội', shortName: 'SHB' },
  { code: 'EIB', name: 'Ngân hàng TMCP Xuất Nhập khẩu Việt Nam', shortName: 'Eximbank' },
];

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : 'Bạn thử lại sau nha.';

const getMethodIcon = (method: PaymentMethodRecord): keyof typeof MaterialCommunityIcons.glyphMap => {
  if (method.type === 'VNPAY') return 'credit-card-check-outline';
  if (method.type === 'MOMO') return 'wallet-outline';
  if (method.type === 'CARD') return 'credit-card-outline';
  return 'bank-outline';
};

const getMethodLabel = (type: PaymentMethodType) => {
  if (type === 'VNPAY') return 'VNPay';
  if (type === 'MOMO') return 'MoMo';
  if (type === 'CARD') return 'Thẻ thanh toán';
  return 'Ngân hàng';
};

const getStatusLabel = (status: PaymentMethodStatus) => {
  if (status === 'verified') return 'Sẵn sàng';
  if (status === 'pending') return 'Chờ xác minh';
  if (status === 'expired') return 'Hết hạn';
  return 'Đã tắt';
};

const getStatusStyle = (status: PaymentMethodStatus) => {
  if (status === 'verified') {
    return {
      badge: styles.statusBadgeSuccess,
      text: styles.statusTextSuccess,
      icon: 'check-circle-outline' as const,
      color: colors.success,
    };
  }

  if (status === 'pending') {
    return {
      badge: styles.statusBadgeWarning,
      text: styles.statusTextWarning,
      icon: 'clock-outline' as const,
      color: colors.goldText,
    };
  }

  if (status === 'expired') {
    return {
      badge: styles.statusBadgeMuted,
      text: styles.statusTextMuted,
      icon: 'timer-sand' as const,
      color: colors.textMuted,
    };
  }

  return {
    badge: styles.statusBadgeDanger,
    text: styles.statusTextDanger,
    icon: 'close-circle-outline' as const,
    color: colors.danger,
  };
};

const isDefaultableMethod = (method: PaymentMethodRecord) =>
  DEFAULTABLE_STATUSES.includes(method.status);

const isRefundMethod = (method: PaymentMethodRecord) => method.type === 'BANK';
const isVisibleRefundMethod = (method: PaymentMethodRecord) =>
  isRefundMethod(method) && method.status !== 'disabled';

const getMetadataText = (method: PaymentMethodRecord, key: string) => {
  const value = method.metadata?.[key];
  return typeof value === 'string' && value.trim() ? value.trim() : null;
};

const getMethodMeta = (method: PaymentMethodRecord) => {
  const accountHolder = getMetadataText(method, 'accountHolder');

  return [
    accountHolder ? `Chủ TK: ${accountHolder}` : null,
    method.maskedInfo,
    method.bankName,
    method.bankCode,
  ].filter(Boolean).join(' / ') || method.provider;
};

const getFormTitle = () => 'Thêm thông tin hoàn tiền';

const getMaskedAccount = (value: string) => {
  const normalizedValue = value.replace(/\s+/g, '');
  if (normalizedValue.length <= 4) return normalizedValue;
  return `•••• ${normalizedValue.slice(-4)}`;
};

const PaymentMethodsScreen = () => {
  const navigation = useNavigation<PaymentMethodsNavigationProp>();
  const { isAuthenticated, session, runWithAuth } = useAuth();
  const [methods, setMethods] = React.useState<PaymentMethodRecord[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isRefreshing, setIsRefreshing] = React.useState(false);
  const [isSaving, setIsSaving] = React.useState(false);
  const [pendingMethodId, setPendingMethodId] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [isAddingMethod, setIsAddingMethod] = React.useState(false);
  const [bankCode, setBankCode] = React.useState('');
  const [bankName, setBankName] = React.useState('');
  const [isBankPickerOpen, setIsBankPickerOpen] = React.useState(false);
  const [bankSearchText, setBankSearchText] = React.useState('');
  const [displayName, setDisplayName] = React.useState('');
  const [accountHolder, setAccountHolder] = React.useState('');
  const [accountNumber, setAccountNumber] = React.useState('');

  const refundMethods = React.useMemo(() => methods.filter(isVisibleRefundMethod), [methods]);
  const defaultableMethods = React.useMemo(() => methods.filter(isDefaultableMethod), [methods]);
  const selectedBank = React.useMemo(
    () => BANK_OPTIONS.find((bank) => bank.code === bankCode) ?? null,
    [bankCode],
  );
  const filteredBanks = React.useMemo(() => {
    const keyword = bankSearchText.trim().toLowerCase();
    if (!keyword) return BANK_OPTIONS;

    return BANK_OPTIONS.filter((bank) =>
      [bank.code, bank.shortName, bank.name].some((value) => value.toLowerCase().includes(keyword)),
    );
  }, [bankSearchText]);

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
        setMethods(nextMethods.filter(isVisibleRefundMethod));
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

  const resetForm = () => {
    setBankCode('');
    setBankName('');
    setBankSearchText('');
    setIsBankPickerOpen(false);
    setDisplayName('');
    setAccountHolder('');
    setAccountNumber('');
  };

  const handleCreatePaymentMethod = async () => {
    if (!session?.accessToken) {
      navigation.navigate('Login');
      return;
    }

    const normalizedAccountNumber = accountNumber.replace(/\s+/g, '');
    if (!selectedBank) {
      Alert.alert('Chọn ngân hàng', 'Bạn chọn ngân hàng phát hành thẻ hoặc tài khoản nhận hoàn tiền nha.');
      return;
    }

    if (!accountHolder.trim() || normalizedAccountNumber.length < 4) {
      Alert.alert('Thiếu thông tin', 'Bạn nhập tên chủ thẻ/tài khoản và số thẻ/tài khoản nhận hoàn tiền nha.');
      return;
    }

    try {
      setIsSaving(true);
      await runWithAuth((accessToken) =>
        paymentMethodsApi.create(accessToken, {
          type: 'BANK',
          bankCode: selectedBank.code,
          bankName: selectedBank.shortName,
          displayName: displayName.trim() || undefined,
          maskedInfo: getMaskedAccount(normalizedAccountNumber),
          isDefault: defaultableMethods.length === 0,
          metadata: {
            accountHolder: accountHolder.trim(),
            accountNumberLast4: normalizedAccountNumber.slice(-4),
            bankFullName: selectedBank.name,
            refundDestination: true,
          },
        }),
      );

      resetForm();
      setIsAddingMethod(false);
      await loadMethods(true);
    } catch (createError) {
      Alert.alert('Chưa lưu được phương thức', getErrorMessage(createError));
    } finally {
      setIsSaving(false);
    }
  };

  const handleSetDefault = async (method: PaymentMethodRecord) => {
    if (method.isDefault || pendingMethodId || !isDefaultableMethod(method)) {
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
                setMethods((current) => current.filter((item) => item._id !== method._id));
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

  const renderField = ({
    label,
    value,
    onChangeText,
    placeholder,
    keyboardType = 'default',
    autoCapitalize = 'sentences',
  }: FieldConfig) => (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textSubtle}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
      />
    </View>
  );

  const renderBankPicker = () => (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>Ngân hàng nhận hoàn tiền</Text>
      <TouchableOpacity
        style={styles.selectInput}
        onPress={() => setIsBankPickerOpen(true)}
        activeOpacity={0.84}
      >
        <View style={styles.selectCopy}>
          <Text style={[styles.selectValue, !selectedBank && styles.selectPlaceholder]} numberOfLines={1}>
            {selectedBank ? selectedBank.shortName : 'Chọn ngân hàng'}
          </Text>
          {selectedBank ? (
            <Text style={styles.selectMeta} numberOfLines={1}>
              {selectedBank.code} - {selectedBank.name}
            </Text>
          ) : (
            <Text style={styles.selectMeta}>Bắt buộc để shop đối soát hoàn tiền</Text>
          )}
        </View>
        <MaterialCommunityIcons name="chevron-down" size={22} color={colors.textMuted} />
      </TouchableOpacity>
    </View>
  );

  const renderBankPickerModal = () => (
    <Modal
      visible={isBankPickerOpen}
      transparent
      animationType="slide"
      onRequestClose={() => setIsBankPickerOpen(false)}
    >
      <View style={styles.modalLayer}>
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={() => setIsBankPickerOpen(false)}
        />
        <View style={styles.bankSheet}>
          <View style={styles.bankSheetHandle} />
          <View style={styles.bankSheetHeader}>
            <View>
              <Text style={styles.bankSheetTitle}>Chọn ngân hàng</Text>
              <Text style={styles.bankSheetSubtitle}>Ngân hàng phát hành thẻ hoặc tài khoản nhận hoàn tiền</Text>
            </View>
            <TouchableOpacity
              style={styles.closeFormButton}
              onPress={() => setIsBankPickerOpen(false)}
              activeOpacity={0.84}
              accessibilityLabel="Đóng chọn ngân hàng"
            >
              <MaterialCommunityIcons name="close" size={20} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          <View style={styles.bankSearchBox}>
            <MaterialCommunityIcons name="magnify" size={20} color={colors.textMuted} />
            <TextInput
              style={styles.bankSearchInput}
              value={bankSearchText}
              onChangeText={setBankSearchText}
              placeholder="Tìm theo tên hoặc mã ngân hàng"
              placeholderTextColor={colors.textSubtle}
              autoCapitalize="characters"
            />
            {bankSearchText ? (
              <TouchableOpacity onPress={() => setBankSearchText('')} activeOpacity={0.84}>
                <MaterialCommunityIcons name="close-circle" size={19} color={colors.textSubtle} />
              </TouchableOpacity>
            ) : null}
          </View>

          <ScrollView style={styles.bankList} contentContainerStyle={styles.bankListContent}>
            {filteredBanks.map((bank) => {
              const selected = bank.code === selectedBank?.code;

              return (
                <TouchableOpacity
                  key={bank.code}
                  style={[styles.bankOption, selected && styles.bankOptionSelected]}
                  onPress={() => {
                    setBankCode(bank.code);
                    setBankName(bank.shortName);
                    setBankSearchText('');
                    setIsBankPickerOpen(false);
                  }}
                  activeOpacity={0.84}
                >
                  <View style={styles.bankLogo}>
                    <Text style={styles.bankLogoText}>{bank.code.slice(0, 3)}</Text>
                  </View>
                  <View style={styles.bankOptionCopy}>
                    <Text style={styles.bankOptionName} numberOfLines={1}>
                      {bank.shortName}
                    </Text>
                    <Text style={styles.bankOptionMeta} numberOfLines={1}>
                      {bank.code} - {bank.name}
                    </Text>
                  </View>
                  {selected ? (
                    <MaterialCommunityIcons name="check-circle" size={21} color={colors.brand} />
                  ) : null}
                </TouchableOpacity>
              );
            })}
            {filteredBanks.length === 0 ? (
              <View style={styles.bankEmpty}>
                <Text style={styles.bankEmptyTitle}>Không tìm thấy ngân hàng</Text>
                <Text style={styles.bankEmptyText}>Thử nhập mã như VCB, TCB, BIDV hoặc tên ngân hàng.</Text>
              </View>
            ) : null}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );

  const renderMethod = (method: PaymentMethodRecord) => {
    const isPending = pendingMethodId === method._id;
    const canSetDefault = isDefaultableMethod(method) && !method.isDefault;
    const statusStyle = getStatusStyle(method.status);

    return (
      <View key={method._id} style={[styles.methodCard, !isDefaultableMethod(method) && styles.methodCardMuted]}>
        <View style={styles.methodHeader}>
          <View style={styles.methodIcon}>
            <MaterialCommunityIcons name={getMethodIcon(method)} size={22} color={colors.brand} />
          </View>
          <View style={styles.methodTitleBlock}>
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
            <Text style={styles.methodTypeText}>{getMethodLabel(method.type)}</Text>
          </View>
        </View>

        <Text style={styles.methodMeta} numberOfLines={2}>
          {getMethodMeta(method)}
        </Text>

        <View style={styles.statusRow}>
          <View style={[styles.statusBadge, statusStyle.badge]}>
            <MaterialCommunityIcons name={statusStyle.icon} size={14} color={statusStyle.color} />
            <Text style={[styles.statusText, statusStyle.text]}>{getStatusLabel(method.status)}</Text>
          </View>
          {method.status === 'pending' ? (
            <Text style={styles.statusHint} numberOfLines={1}>
              Admin sẽ xác minh trước khi sử dụng.
            </Text>
          ) : null}
        </View>

        <View style={styles.methodActions}>
          {isPending ? (
            <ActivityIndicator color={colors.brand} />
          ) : (
            <>
              {canSetDefault ? (
                <TouchableOpacity
                  style={styles.secondaryAction}
                  onPress={() => void handleSetDefault(method)}
                  activeOpacity={0.84}
                >
                  <MaterialCommunityIcons name="star-outline" size={17} color={colors.brand} />
                  <Text style={styles.secondaryActionText}>Đặt mặc định</Text>
                </TouchableOpacity>
              ) : null}
              <TouchableOpacity
                style={styles.dangerAction}
                onPress={() => handleRemove(method)}
                activeOpacity={0.84}
                accessibilityLabel={`Xoá ${method.displayName}`}
              >
                <MaterialCommunityIcons name="trash-can-outline" size={17} color={colors.danger} />
                <Text style={styles.dangerActionText}>Xoá</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    );
  };

  const renderSavedMethodGroup = ({
    title,
    meta,
    icon,
    data,
    emptyTitle,
    emptyText,
  }: {
    title: string;
    meta: string;
    icon: keyof typeof MaterialCommunityIcons.glyphMap;
    data: PaymentMethodRecord[];
    emptyTitle: string;
    emptyText: string;
  }) => (
    <View style={styles.methodGroup}>
      <View style={styles.methodGroupHeader}>
        <View style={styles.methodGroupTitle}>
          <MaterialCommunityIcons name={icon} size={18} color={colors.brand} />
          <Text style={styles.methodGroupTitleText}>{title}</Text>
        </View>
        <Text style={styles.methodGroupMeta}>{meta}</Text>
      </View>
      {data.length ? (
        <View style={styles.methodList}>{data.map(renderMethod)}</View>
      ) : (
        <View style={styles.inlineEmpty}>
          <Text style={styles.inlineEmptyTitle}>{emptyTitle}</Text>
          <Text style={styles.inlineEmptyText}>{emptyText}</Text>
        </View>
      )}
    </View>
  );

  const renderAddForm = () => {
    if (!isAddingMethod) {
      return (
        <TouchableOpacity
          style={styles.addPanel}
          onPress={() => setIsAddingMethod(true)}
          activeOpacity={0.86}
        >
          <View style={styles.addIcon}>
            <MaterialCommunityIcons name="plus" size={22} color={colors.white} />
          </View>
          <View style={styles.addCopy}>
            <Text style={styles.addTitle}>Thêm thông tin</Text>
            <Text style={styles.addText}>Thêm thẻ hoặc tài khoản ngân hàng để shop xử lý hoàn tiền.</Text>
          </View>
          <MaterialCommunityIcons name="chevron-right" size={22} color={colors.textMuted} />
        </TouchableOpacity>
      );
    }

    return (
      <View style={styles.formCard}>
        <View style={styles.formHeader}>
          <View>
            <Text style={styles.formTitle}>{getFormTitle()}</Text>
            <Text style={styles.formSubtitle}>
              Chọn ngân hàng và nhập thẻ/tài khoản nhận hoàn tiền.
            </Text>
          </View>
          <TouchableOpacity
            style={styles.closeFormButton}
            onPress={() => {
              setIsAddingMethod(false);
              resetForm();
            }}
            activeOpacity={0.84}
            accessibilityLabel="Đóng form thêm phương thức"
          >
            <MaterialCommunityIcons name="close" size={20} color={colors.textMuted} />
          </TouchableOpacity>
        </View>

        {renderField({
          label: 'Tên gợi nhớ',
          value: displayName,
          onChangeText: setDisplayName,
          placeholder: 'Ví dụ: Thẻ hoàn tiền Vietcombank',
        })}

        {renderBankPicker()}
        {renderField({
          label: 'Tên chủ thẻ/tài khoản',
          value: accountHolder,
          onChangeText: setAccountHolder,
          placeholder: 'Nhập đúng tên trên thẻ hoặc tài khoản',
          autoCapitalize: 'characters',
        })}
        {renderField({
          label: 'Số thẻ/tài khoản',
          value: accountNumber,
          onChangeText: setAccountNumber,
          placeholder: 'Số thẻ hoặc tài khoản nhận hoàn tiền',
          keyboardType: 'number-pad',
        })}

        <View style={[styles.infoRow, styles.infoRowWarning]}>
          <MaterialCommunityIcons
            name="clock-check-outline"
            size={18}
            color={colors.goldText}
          />
          <Text style={[styles.infoText, styles.infoTextWarning]}>
            Chỉ hiển thị số đã che. Thông tin hoàn tiền sẽ chờ admin xác minh trước khi sử dụng.
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.primaryButton, isSaving && styles.primaryButtonDisabled]}
          onPress={() => void handleCreatePaymentMethod()}
          disabled={isSaving}
          activeOpacity={0.86}
        >
          {isSaving ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <>
              <MaterialCommunityIcons name="content-save-outline" size={19} color={colors.white} />
              <Text style={styles.primaryButtonText}>
                Lưu thông tin hoàn tiền
              </Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    );
  };

  const renderContent = () => {
    if (!isAuthenticated || !session?.accessToken) {
      return (
        <View style={styles.statePanel}>
          <MaterialCommunityIcons name="credit-card-outline" size={42} color={colors.brand} />
          <Text style={styles.stateTitle}>Đăng nhập để quản lý thanh toán</Text>
          <Text style={styles.stateText}>Bạn có thể lưu thẻ hoặc tài khoản nhận hoàn tiền sau khi đăng nhập.</Text>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => navigation.navigate('Login')}
            activeOpacity={0.86}
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
        showsVerticalScrollIndicator={false}
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
            <View style={styles.sectionTitleGroup}>
              <MaterialCommunityIcons name="bank-outline" size={20} color={colors.brand} />
              <Text style={styles.sectionTitle}>Thông tin hoàn tiền</Text>
            </View>
            <Text style={styles.sectionMeta}>{methods.length} đã lưu</Text>
          </View>

          <View style={styles.combinedPanel}>
            {renderSavedMethodGroup({
              title: 'Nhận hoàn tiền',
              meta: `${refundMethods.length} thẻ/tài khoản`,
              icon: 'bank-outline',
              data: refundMethods,
              emptyTitle: 'Chưa có thông tin hoàn tiền',
              emptyText: 'Thêm ngân hàng và số thẻ/tài khoản để shop xử lý hoàn tiền khi cần.',
            })}

            <View style={styles.groupDivider} />
            {renderAddForm()}
          </View>
        </View>
      </ScrollView>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.headerAction}
          onPress={() => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Profile'))}
          activeOpacity={0.82}
          accessibilityLabel="Trở về"
        >
          <MaterialCommunityIcons name="arrow-left" size={24} color={colors.white} />
        </TouchableOpacity>
        <View style={styles.headerTitleGroup}>
          <Text style={styles.brand}>FASHIONISTA</Text>
          <Text style={styles.headerTitle}>Hoàn tiền</Text>
          <Text style={styles.headerSubtitle}>Thẻ và tài khoản nhận hoàn tiền</Text>
        </View>
        <TouchableOpacity
          style={styles.headerAction}
          onPress={() => void loadMethods(true)}
          activeOpacity={0.82}
          accessibilityLabel="Tải lại"
        >
          <MaterialCommunityIcons name="refresh" size={22} color={colors.white} />
        </TouchableOpacity>
      </View>

      <View style={styles.content}>{renderContent()}</View>
      {renderBankPickerModal()}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.brand,
  },
  header: {
    minHeight: 92,
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
  headerTitleGroup: {
    flex: 1,
    minWidth: 0,
    paddingHorizontal: 12,
  },
  brand: {
    color: colors.brandMist,
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '700',
  },
  headerTitle: {
    color: colors.white,
    fontSize: 25,
    lineHeight: 32,
    fontWeight: '800',
    marginTop: 2,
  },
  headerSubtitle: {
    color: colors.brandPale,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '700',
  },
  content: {
    flex: 1,
    backgroundColor: colors.background,
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
    overflow: 'hidden',
  },
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
    gap: spacing.lg,
  },
  statePanel: {
    margin: spacing.lg,
    minHeight: 260,
    borderRadius: radii.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.md,
    ...shadows.card,
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
    textAlign: 'center',
  },
  errorBanner: {
    minHeight: 44,
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
    minHeight: 30,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  sectionTitleGroup: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  sectionTitle: {
    flex: 1,
    minWidth: 0,
    color: colors.text,
    fontSize: 17,
    lineHeight: 23,
    fontWeight: '900',
  },
  sectionMeta: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '800',
  },
  combinedPanel: {
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.md,
    gap: spacing.md,
    ...shadows.card,
  },
  methodGroup: {
    gap: spacing.md,
  },
  methodGroupHeader: {
    minHeight: 28,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  methodGroupTitle: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  methodGroupTitleText: {
    flex: 1,
    minWidth: 0,
    color: colors.text,
    fontSize: 14,
    lineHeight: 19,
    fontWeight: '900',
  },
  methodGroupMeta: {
    color: colors.textMuted,
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '800',
  },
  groupDivider: {
    height: 1,
    backgroundColor: colors.border,
  },
  methodList: {
    gap: spacing.md,
  },
  methodCard: {
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.md,
    gap: spacing.sm,
    ...shadows.card,
  },
  methodCardMuted: {
    borderColor: colors.border,
    backgroundColor: '#FCFDFD',
  },
  methodHeader: {
    minHeight: 46,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  methodIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.brandSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  methodTitleBlock: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  methodTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  methodTitle: {
    flex: 1,
    minWidth: 0,
    color: colors.text,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '900',
  },
  methodTypeText: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
  },
  methodMeta: {
    color: colors.textBody,
    fontSize: 12,
    lineHeight: 18,
  },
  statusRow: {
    minHeight: 28,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  statusBadge: {
    minHeight: 28,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  statusBadgeSuccess: {
    backgroundColor: colors.successSoft,
  },
  statusBadgeWarning: {
    backgroundColor: colors.goldSoft,
  },
  statusBadgeMuted: {
    backgroundColor: colors.field,
  },
  statusBadgeDanger: {
    backgroundColor: colors.dangerSoft,
  },
  statusText: {
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '900',
  },
  statusTextSuccess: {
    color: colors.success,
  },
  statusTextWarning: {
    color: colors.goldText,
  },
  statusTextMuted: {
    color: colors.textMuted,
  },
  statusTextDanger: {
    color: colors.danger,
  },
  statusHint: {
    flex: 1,
    minWidth: 0,
    color: colors.textMuted,
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '700',
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
    minHeight: 38,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: spacing.sm,
  },
  secondaryAction: {
    minHeight: 38,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.brandPale,
    backgroundColor: colors.brandSoft,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  secondaryActionText: {
    color: colors.brand,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '900',
  },
  dangerAction: {
    minHeight: 38,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.dangerSoft,
    backgroundColor: '#FFF7F7',
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  dangerActionText: {
    color: colors.danger,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '900',
  },
  inlineEmpty: {
    minHeight: 72,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.field,
    padding: spacing.md,
    justifyContent: 'center',
  },
  inlineEmptyTitle: {
    color: colors.text,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '900',
  },
  inlineEmptyText: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 3,
  },
  addPanel: {
    minHeight: 76,
    borderRadius: radii.sm,
    backgroundColor: colors.brandSoft,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  addIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addCopy: {
    flex: 1,
    minWidth: 0,
  },
  addTitle: {
    color: colors.text,
    fontSize: 14,
    lineHeight: 19,
    fontWeight: '900',
  },
  addText: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 2,
  },
  formCard: {
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.lg,
    gap: spacing.md,
    ...shadows.card,
  },
  formHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  formTitle: {
    color: colors.text,
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '900',
  },
  formSubtitle: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 3,
    fontWeight: '700',
  },
  closeFormButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.field,
    alignItems: 'center',
    justifyContent: 'center',
  },
  field: {
    gap: 7,
  },
  fieldLabel: {
    color: colors.text,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '900',
  },
  input: {
    minHeight: 48,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.field,
    paddingHorizontal: spacing.md,
    color: colors.text,
    fontSize: 14,
  },
  selectInput: {
    minHeight: 58,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.field,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  selectCopy: {
    flex: 1,
    minWidth: 0,
  },
  selectValue: {
    color: colors.text,
    fontSize: 14,
    lineHeight: 19,
    fontWeight: '900',
  },
  selectPlaceholder: {
    color: colors.textSubtle,
  },
  selectMeta: {
    color: colors.textMuted,
    fontSize: 11,
    lineHeight: 15,
    marginTop: 2,
    fontWeight: '700',
  },
  modalLayer: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.32)',
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  bankSheet: {
    maxHeight: '78%',
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.lg,
  },
  bankSheetHandle: {
    alignSelf: 'center',
    width: 44,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.borderStrong,
    marginBottom: spacing.md,
  },
  bankSheetHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  bankSheetTitle: {
    color: colors.text,
    fontSize: 19,
    lineHeight: 25,
    fontWeight: '900',
  },
  bankSheetSubtitle: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 3,
    fontWeight: '700',
  },
  bankSearchBox: {
    minHeight: 46,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.field,
    marginTop: spacing.md,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  bankSearchInput: {
    flex: 1,
    minWidth: 0,
    color: colors.text,
    fontSize: 14,
    paddingVertical: 0,
  },
  bankList: {
    marginTop: spacing.md,
  },
  bankListContent: {
    gap: spacing.sm,
    paddingBottom: spacing.lg,
  },
  bankOption: {
    minHeight: 62,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  bankOptionSelected: {
    borderColor: colors.brand,
    backgroundColor: colors.brandSoft,
  },
  bankLogo: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bankLogoText: {
    color: colors.white,
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '900',
  },
  bankOptionCopy: {
    flex: 1,
    minWidth: 0,
  },
  bankOptionName: {
    color: colors.text,
    fontSize: 14,
    lineHeight: 19,
    fontWeight: '900',
  },
  bankOptionMeta: {
    color: colors.textMuted,
    fontSize: 11,
    lineHeight: 16,
    marginTop: 2,
    fontWeight: '700',
  },
  bankEmpty: {
    minHeight: 130,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
    gap: spacing.sm,
  },
  bankEmptyTitle: {
    color: colors.text,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '900',
    textAlign: 'center',
  },
  bankEmptyText: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 17,
    textAlign: 'center',
  },
  infoRow: {
    borderRadius: radii.sm,
    backgroundColor: colors.successSoft,
    padding: spacing.sm,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  infoRowWarning: {
    backgroundColor: colors.goldSoft,
  },
  infoText: {
    flex: 1,
    minWidth: 0,
    color: colors.success,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '800',
  },
  infoTextWarning: {
    color: colors.goldText,
  },
  primaryButton: {
    minHeight: 48,
    borderRadius: radii.sm,
    backgroundColor: colors.brand,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  primaryButtonDisabled: {
    opacity: 0.62,
  },
  primaryButtonText: {
    color: colors.white,
    fontSize: 14,
    lineHeight: 19,
    fontWeight: '900',
  },
});

export default PaymentMethodsScreen;
