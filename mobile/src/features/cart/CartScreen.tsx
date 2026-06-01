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
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import StorefrontFooter from '../../components/layout/StorefrontFooter';
import StorefrontHeader from '../../components/layout/StorefrontHeader';
import { colors, radii, spacing } from '../../theme';
import type { RootStackParamList } from '../../navigation/AppNavigator';
import { useAuth } from '../auth/AuthContext';
import { accountApi, type UserAddress } from '../account/accountApi';
import { cartApi, CartApiError, CartItem, CartResponse } from './cartApi';

type CartNavigationProp = StackNavigationProp<RootStackParamList, 'Cart'>;
type PaymentMethod = 'COD' | 'VNPAY' | 'MOMO';

const COD_SHIPPING_FEE = 25000;
const FREE_SHIPPING_MINIMUM = 399000;

const formatCurrency = (value: number) =>
  `${Math.round(value).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')}đ`;

const isRemoteImage = (value?: string | null) => Boolean(value && /^https?:\/\//i.test(value.trim()));

const getErrorMessage = (error: unknown) => {
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
    address.district && address.district !== 'Không áp dụng' ? address.district : '',
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
  district: (address.district || 'Không áp dụng').trim(),
  ward: (address.ward || '').trim(),
  streetName: (address.streetName || '').trim(),
  phoneNumber: (address.phoneNumber || '').trim(),
});

const CartScreen = () => {
  const navigation = useNavigation<CartNavigationProp>();
  const { isAuthenticated, session, runWithAuth } = useAuth();
  const [cart, setCart] = React.useState<CartResponse | null>(null);
  const [addresses, setAddresses] = React.useState<UserAddress[]>([]);
  const [selectedAddressId, setSelectedAddressId] = React.useState<string | null>(null);
  const [isAddressLoading, setIsAddressLoading] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isRefreshing, setIsRefreshing] = React.useState(false);
  const [pendingItemId, setPendingItemId] = React.useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [paymentMethod, setPaymentMethod] = React.useState<PaymentMethod>('COD');
  const [form, setForm] = React.useState({
    fullName: session?.user.name ?? '',
    phone: session?.user.phone ?? '',
    email: session?.user.email ?? '',
    address: '',
    note: '',
  });
  const selectedAddressIdRef = React.useRef<string | null>(null);

  const selectedAddress = React.useMemo(
    () =>
      addresses.find((address) => address._id && address._id === selectedAddressId) ??
      addresses.find((address) => address.isDefault) ??
      addresses[0] ??
      null,
    [addresses, selectedAddressId],
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
        Alert.alert('Chưa tải được giỏ hàng', getErrorMessage(error));
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [runWithAuth, session?.accessToken],
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
          Alert.alert('Chưa tải được địa chỉ', getErrorMessage(error));
        }
      } finally {
        setIsAddressLoading(false);
      }
    },
    [applyAddressToForm, runWithAuth, session?.accessToken],
  );

  useFocusEffect(
    React.useCallback(() => {
      void loadCart();
      void loadAddresses();
    }, [loadAddresses, loadCart]),
  );

  const selectedItems = React.useMemo(
    () => cart?.product_list.filter((item) => item.isSelected) ?? [],
    [cart?.product_list],
  );
  const selectedCheckoutItems = selectedItems.filter((item) => item.isAvailable !== false);
  const unavailableSelectedItems = selectedItems.filter((item) => item.isAvailable === false);
  const allItemsSelected = Boolean(
    cart?.product_list.length && cart.product_list.every((item) => item.isSelected),
  );
  const subTotal = selectedCheckoutItems.reduce(
    (sum, item) => sum + item.quantity * item.priceAtAddedTime,
    0,
  );
  const shippingDiscountAmount =
    selectedCheckoutItems.length && subTotal >= FREE_SHIPPING_MINIMUM ? COD_SHIPPING_FEE : 0;
  const shippingPayable = selectedCheckoutItems.length ? COD_SHIPPING_FEE - shippingDiscountAmount : 0;
  const totalAmount = subTotal + shippingPayable;
  const canSubmit =
    selectedCheckoutItems.length > 0 &&
    unavailableSelectedItems.length === 0 &&
    Boolean(selectedAddress) &&
    !isSubmitting &&
    paymentMethod === 'COD';

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
      Alert.alert('Chưa cập nhật được lựa chọn', getErrorMessage(error));
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
      Alert.alert('Chưa cập nhật được giỏ hàng', getErrorMessage(error));
    } finally {
      setPendingItemId(null);
    }
  };

  const handleQuantityChange = async (item: CartItem, nextQuantity: number) => {
    if (!session?.accessToken || nextQuantity < 1 || pendingItemId) {
      return;
    }

    if (item.availableQuantity !== undefined && nextQuantity > item.availableQuantity) {
      Alert.alert('Không đủ tồn kho', `Sản phẩm này hiện chỉ còn ${item.availableQuantity}.`);
      return;
    }

    try {
      setPendingItemId(item._id);
      const nextCart = await runWithAuth((accessToken) => cartApi.updateItem(accessToken, item._id, { quantity: nextQuantity }));
      updateCartState(nextCart);
    } catch (error) {
      Alert.alert('Chưa cập nhật được số lượng', getErrorMessage(error));
      void loadCart(true);
    } finally {
      setPendingItemId(null);
    }
  };

  const handleRemoveItem = (item: CartItem) => {
    if (!session?.accessToken || pendingItemId) {
      return;
    }

    Alert.alert('Xóa sản phẩm', `Xóa ${getItemTitle(item)} khỏi giỏ hàng?`, [
      { text: 'Hủy', style: 'cancel' },
      {
        text: 'Xóa',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            try {
              setPendingItemId(item._id);
              const nextCart = await runWithAuth((accessToken) => cartApi.deleteItem(accessToken, item._id));
              updateCartState(nextCart);
            } catch (error) {
              Alert.alert('Chưa xóa được sản phẩm', getErrorMessage(error));
            } finally {
              setPendingItemId(null);
            }
          })();
        },
      },
    ]);
  };

  const validateCheckout = () => {
    if (!form.fullName.trim()) {
      Alert.alert('Thiếu thông tin', 'Bạn nhập họ tên người nhận trước nha.');
      return false;
    }

    if (!form.phone.trim()) {
      Alert.alert('Thiếu thông tin', 'Bạn nhập số điện thoại để shop giao hàng.');
      return false;
    }

    if (!form.address.trim()) {
      Alert.alert('Thiếu thông tin', 'Bạn nhập địa chỉ giao hàng trước nha.');
      return false;
    }

    if (!selectedAddress) {
      Alert.alert('Thiếu địa chỉ', 'Bạn chọn hoặc thêm địa chỉ nhận hàng trong hồ sơ trước nha.');
      return false;
    }

    const overStockItem = selectedItems.find((item) => {
      return item.availableQuantity !== undefined && item.quantity > item.availableQuantity;
    });

    if (overStockItem) {
      Alert.alert('Không đủ tồn kho', `${getItemTitle(overStockItem)} chỉ còn ${overStockItem.availableQuantity}.`);
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

    try {
      setIsSubmitting(true);
      const order = await runWithAuth((accessToken) => cartApi.createOrder(accessToken, {
        cartItemIds: selectedCheckoutItems.map((item) => item._id),
        paymentMethod: 'COD',
        shippingAddress: toShippingAddress(selectedAddress),
        orderNote: form.note.trim() || undefined,
      }));

      Alert.alert(
        'Đặt hàng thành công',
        `Mã đơn: ${order.orderCode}\nTổng thanh toán: ${formatCurrency(order.totalAmount)}`,
      );
      setForm((current) => ({ ...current, note: '' }));
      await loadCart(true);
      await loadAddresses(true);
    } catch (error) {
      Alert.alert('Chưa đặt được đơn', getErrorMessage(error));
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
        onPress={() => (disabled ? undefined : setPaymentMethod(method))}
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
          </View>
        ) : null}
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
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Home'))}
              accessibilityLabel="Trở về"
              activeOpacity={0.82}
            >
              <MaterialCommunityIcons name="arrow-left" size={21} color={colors.text} />
            </TouchableOpacity>
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
            {renderPaymentOption('VNPAY', 'Ví điện tử VNPAY', 'credit-card-outline', true, 'Sắp kết nối payment gateway.')}
            {renderPaymentOption('MOMO', 'Thanh toán MoMo', 'wallet-outline', true, 'Sắp kết nối payment gateway.')}
          </View>
        </View>

        <View style={styles.sectionBlock}>
          <Text style={styles.sectionTitle}>Ưu đãi dành cho bạn</Text>
          <View style={styles.promoStack}>
            <View style={[styles.promoCard, styles.promoOrange]}>
              <View style={[styles.promoBadge, styles.promoBadgeOrange]}>
                <Text style={styles.promoBadgeText}>GIẢM 15%</Text>
              </View>
              <View style={styles.promoBody}>
                <Text style={styles.promoTitle}>Giảm 15% cho đơn hàng từ 500K</Text>
                <Text style={styles.promoMeta}>Mã: SUMMER15 - voucher sẽ nối ở bước sau</Text>
              </View>
            </View>
            <View style={[styles.promoCard, styles.promoBlue]}>
              <View style={[styles.promoBadge, styles.promoBadgeBlue]}>
                <Text style={styles.promoBadgeText}>FREESHIP</Text>
              </View>
              <View style={styles.promoBody}>
                <Text style={styles.promoTitle}>Miễn phí vận chuyển đơn từ 399K</Text>
                <Text style={styles.promoMeta}>
                  {shippingDiscountAmount ? 'Đã áp dụng cho đơn hàng này' : 'Tự áp dụng khi đủ điều kiện'}
                </Text>
              </View>
            </View>
            <View style={styles.memberCard}>
              <View style={styles.memberBadge}>
                <Text style={styles.memberBadgeText}>V</Text>
              </View>
              <View style={styles.memberInfo}>
                <Text style={styles.memberTitle}>Hạng thẻ: Vàng</Text>
                <Text style={styles.memberMeta}>Ưu đãi thành viên sẽ tính ở bước khuyến mãi.</Text>
              </View>
              <Text style={styles.memberDiscount}>-5%</Text>
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
            <Text style={[styles.summaryValue, Boolean(shippingDiscountAmount) && styles.freeText]}>
              {shippingDiscountAmount ? 'Miễn phí' : formatCurrency(shippingPayable)}
            </Text>
          </View>
          <View style={styles.summaryLine}>
            <Text style={styles.summaryLabel}>Giảm phí vận chuyển:</Text>
            <Text style={styles.summaryDiscount}>-{formatCurrency(shippingDiscountAmount)}</Text>
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
        onMenuPress={() => navigation.navigate('ProductList', { title: 'Tất cả sản phẩm' })}
        onProfilePress={() => navigation.navigate(isAuthenticated ? 'Profile' : 'Login')}
        onFavoritesPress={() => Alert.alert('Yêu thích', 'Danh sách yêu thích sẽ được nối ở bước sau.')}
        onCartPress={() => loadCart(true)}
        onSearchSubmit={handleSearchSubmit}
        onImageSearchPress={() => Alert.alert('Tìm kiếm ảnh', 'Tính năng này sẽ được bổ sung ở bước sau.')}
        isAuthenticated={isAuthenticated}
        userName={session?.user.name}
        avatarImage={session?.user.avatarImage}
      />

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={() => loadCart(true)} tintColor={colors.brand} />
        }
      >
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
  backButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 2,
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
  addressSmallButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.brandSoft,
    alignItems: 'center',
    justifyContent: 'center',
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
    minHeight: 50,
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
