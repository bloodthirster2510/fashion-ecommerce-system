import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import type { RootStackParamList } from '../../navigation/AppNavigator';
import { colors, radii, shadows, spacing, sharedStyles } from '../../theme';
import { LocationPicker } from '../../components/ui/LocationPicker';
import { useAuth } from '../auth/AuthContext';
import { locationApi, type ProvinceApiItem, type WardApiItem } from '../auth/locationApi';
import { accountApi, type Gender, type UserAddress } from './accountApi';

type EditProfileNavigationProp = StackNavigationProp<RootStackParamList, 'EditProfile'>;
type ProfileTab = 'profile' | 'addresses' | 'security';
type EditField =
  | 'name'
  | 'gender'
  | 'birthDay'
  | 'birthMonth'
  | 'birthYear'
  | 'customerName'
  | 'addressPhone'
  | 'province'
  | 'ward'
  | 'streetName'
  | 'currentPassword'
  | 'newPassword'
  | 'confirmPassword';
type SelectOption = {
  label: string;
  value: string;
};
type SelectConfig = {
  id: string;
  title: string;
  options: SelectOption[];
  selectedValue: string;
  onSelect: (value: string) => void | Promise<void>;
  field?: EditField;
};

const vietnamPhoneRegex = /^(0|\+84)(3|5|7|8|9)[0-9]{8}$/;
const currentYear = new Date().getFullYear();
const newAddressId = 'new';

const genderOptions: SelectOption[] = [
  { label: 'Nam', value: 'male' },
  { label: 'Nữ', value: 'female' },
];

const monthOptions: SelectOption[] = Array.from({ length: 12 }, (_, index) => {
  const value = String(index + 1);
  return { label: value, value };
});

const yearOptions: SelectOption[] = Array.from({ length: 88 }, (_, index) => {
  const value = String(currentYear - 13 - index);
  return { label: value, value };
});

const isInlineSelectId = (id?: string) =>
  id === 'gender' || id === 'birthDay' || id === 'birthMonth' || id === 'birthYear';

const tabItems: Array<{ id: ProfileTab; label: string; icon: keyof typeof MaterialCommunityIcons.glyphMap }> = [
  { id: 'profile', label: 'Hồ sơ', icon: 'account-outline' },
  { id: 'addresses', label: 'Địa chỉ', icon: 'map-marker-outline' },
  { id: 'security', label: 'Bảo mật', icon: 'shield-key-outline' },
];

const getDayOptions = (month: string, year: string): SelectOption[] => {
  const numericMonth = Number(month);
  const numericYear = Number(year) || currentYear;
  const dayCount = numericMonth ? new Date(numericYear, numericMonth, 0).getDate() : 31;

  return Array.from({ length: dayCount }, (_, index) => {
    const value = String(index + 1);
    return { label: value, value };
  });
};

const buildManualWardCode = (provinceCode: string, wardName: string) =>
  `manual-${provinceCode || 'unknown'}-${wardName.trim().replace(/\s+/g, '-').toLowerCase()}`;

const splitDateOfBirth = (value?: string) => {
  if (!value) return { day: '', month: '', year: '' };

  const [year, month, day] = value.slice(0, 10).split('-');
  return {
    day: String(Number(day) || ''),
    month: String(Number(month) || ''),
    year: year || '',
  };
};

const capitalizeWords = (value: string) =>
  value.trim().replace(/\s+/g, ' ').toLowerCase().replace(/(^|\s)\S/g, (match) => match.toUpperCase());

const formatAddress = (address: UserAddress) =>
  [
    address.streetName,
    address.ward,
    address.province,
  ]
    .filter(Boolean)
    .join(', ');

const getInitial = (name: string) => {
  const trimmedName = name.trim();
  if (!trimmedName) return 'U';

  return trimmedName.charAt(0).toUpperCase();
};

const isPreviewableImage = (value: string) => /^https?:\/\//i.test(value.trim());

const isUnauthorizedError = (error: unknown) =>
  typeof error === 'object' &&
  error !== null &&
  'status' in error &&
  (error as { status?: number }).status === 401;

const EditProfileScreen = () => {
  const navigation = useNavigation<EditProfileNavigationProp>();
  const { session, updateSessionUser, logout, runWithAuth: runAuthAction } = useAuth();

  const [activeTab, setActiveTab] = useState<ProfileTab>('profile');
  const [activeSelect, setActiveSelect] = useState<SelectConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [generalError, setGeneralError] = useState('');

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [gender, setGender] = useState<Gender | null>(null);
  const [birthDay, setBirthDay] = useState('');
  const [birthMonth, setBirthMonth] = useState('');
  const [birthYear, setBirthYear] = useState('');
  const [avatarImage, setAvatarImage] = useState('');
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMessage, setProfileMessage] = useState('');

  const [addresses, setAddresses] = useState<UserAddress[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState(newAddressId);
  const [customerName, setCustomerName] = useState('');
  const [addressPhone, setAddressPhone] = useState('');
  const [provinceCode, setProvinceCode] = useState('');
  const [province, setProvince] = useState('');
  const [wardCode, setWardCode] = useState('');
  const [ward, setWard] = useState('');
  const [streetName, setStreetName] = useState('');
  const [addressDefault, setAddressDefault] = useState(true);
  const [provinces, setProvinces] = useState<ProvinceApiItem[]>([]);
  const [wards, setWards] = useState<WardApiItem[]>([]);
  const [manualWardEntryAllowed, setManualWardEntryAllowed] = useState(false);
  const [wardLoading, setWardLoading] = useState(false);
  const [provinceLocationError, setProvinceLocationError] = useState('');
  const [wardLocationError, setWardLocationError] = useState('');
  const [addressSaving, setAddressSaving] = useState(false);
  const [addressMessage, setAddressMessage] = useState('');
  const [addressTouched, setAddressTouched] = useState<Record<string, boolean>>({});

  const markAddressTouched = (field: string) => {
    setAddressTouched((current) => ({ ...current, [field]: true }));
  };

  const touchAllAddressFields = () => {
    setAddressTouched({
      customerName: true,
      addressPhone: true,
      province: true,
      ward: true,
      streetName: true,
    });
  };

  const getAddressFieldError = (field: string, normalizedPhone: string) => {
    switch (field) {
      case 'customerName':
        const nameToCheck = customerName.trim() || name.trim();
        if (nameToCheck.length < 2 || nameToCheck.length > 60) return 'Tên người nhận cần từ 2 đến 60 ký tự';
        return '';
      case 'addressPhone':
        if (!vietnamPhoneRegex.test(normalizedPhone)) return 'Số điện thoại nhận hàng không đúng định dạng';
        return '';
      case 'province':
        if (!province.trim() || !provinceCode.trim()) return 'Vui lòng chọn tỉnh/thành phố';
        return '';
      case 'ward':
        if (!ward.trim() || !wardCode.trim()) return 'Vui lòng chọn phường/xã';
        return '';
      case 'streetName':
        if (streetName.trim().length < 5 || streetName.trim().length > 150) return 'Địa chỉ chi tiết cần từ 5 đến 150 ký tự';
        return '';
      default:
        return '';
    }
  };

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [securityMessage, setSecurityMessage] = useState('');

  const provinceOptions = useMemo(
    () => provinces.map((item) => ({ label: item.name, value: String(item.code) })),
    [provinces],
  );
  const wardOptions = useMemo(
    () => wards.map((item) => ({ label: item.name, value: String(item.code) })),
    [wards],
  );
  const dayOptions = useMemo(() => getDayOptions(birthMonth, birthYear), [birthMonth, birthYear]);
  const selectedAddress = addresses.find((item) => item._id === selectedAddressId);
  const avatarPreview = avatarImage.trim();

  const redirectToLogin = () => {
    logout();
    navigation.reset({
      index: 0,
      routes: [{ name: 'Login' }],
    });
  };

  const runWithAuth = async <T,>(action: (accessToken: string) => Promise<T>): Promise<T> => {
    if (!session) {
      redirectToLogin();
      throw new Error('Vui lòng đăng nhập để cập nhật tài khoản');
    }

    try {
      return await runAuthAction(action);
    } catch (error) {
      if (isUnauthorizedError(error)) {
        redirectToLogin();
      }

      throw error;
    }
  };

  const buildDateOfBirth = () => {
    const day = Number(birthDay);
    const month = Number(birthMonth);
    const year = Number(birthYear);

    if (!day || !month || !year) return null;

    const date = new Date(Date.UTC(year, month - 1, day));
    const isValidDate =
      date.getUTCFullYear() === year &&
      date.getUTCMonth() === month - 1 &&
      date.getUTCDate() === day;

    if (!isValidDate) return null;

    const today = new Date();
    let age = today.getFullYear() - year;
    const birthdayHasPassed =
      today.getMonth() + 1 > month ||
      (today.getMonth() + 1 === month && today.getDate() >= day);
    if (!birthdayHasPassed) age -= 1;

    if (age < 13 || age > 100) return null;

    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  };

  const isLocalProfileComplete = (nextAddresses = addresses) =>
    vietnamPhoneRegex.test(phone.trim()) && Boolean(gender && buildDateOfBirth() && nextAddresses.length > 0);

  const clearAddressForm = () => {
    setSelectedAddressId(newAddressId);
    setCustomerName(name.trim() ? capitalizeWords(name) : '');
    setAddressPhone(phone.trim());
    setProvinceCode('');
    setProvince('');
    setWardCode('');
    setWard('');
    setStreetName('');
    setAddressDefault(addresses.length === 0);
    setWards([]);
    setManualWardEntryAllowed(false);
    setWardLocationError('');
    setAddressMessage('');
    setAddressTouched({});
  };

  useEffect(() => {
    if (selectedAddressId !== newAddressId) return;

    if (!customerName.trim() && name.trim()) {
      setCustomerName(capitalizeWords(name));
    }

    if (!addressPhone.trim() && phone.trim()) {
      setAddressPhone(phone.trim());
    }
  }, [addressPhone, customerName, name, phone, selectedAddressId]);

  const loadWards = async (code: string) => {
    if (!code) {
      setWards([]);
      setManualWardEntryAllowed(false);
      return [];
    }

    try {
      setWardLoading(true);
      const result = await locationApi.getWardList(code);
      setWards(result.wards);
      setManualWardEntryAllowed(result.manualEntryAllowed);
      setWardLocationError('');
      return result.wards;
    } finally {
      setWardLoading(false);
    }
  };

  const fillAddressForm = async (address: UserAddress | null, provinceSource = provinces) => {
    if (!address) {
      clearAddressForm();
      return;
    }

    const matchedProvince = provinceSource.find((item) => (
      item.code === (address.provinceCode ?? String(address.provinceId ?? '')) || item.name === address.province
    ));
    setSelectedAddressId(address._id ?? newAddressId);
    setCustomerName(address.customerName ?? '');
    setAddressPhone(address.phoneNumber ?? '');
    setProvinceCode(matchedProvince ? String(matchedProvince.code) : '');
    setProvince(address.province ?? '');
    setWardCode(address.wardCode ?? '');
    setWard(address.ward ?? '');
    setStreetName(address.streetName ?? '');
    setAddressDefault(address.isDefault);

    if (matchedProvince) {
      let loadedWards: WardApiItem[] = [];
      try {
        loadedWards = await loadWards(String(matchedProvince.code));
      } catch (error) {
        setWards([]);
        setAddressMessage(error instanceof Error ? error.message : 'Không tải được danh sách phường/xã');
        return;
      }

      const matchedWard = loadedWards.find((item) => (
        item.code === address.wardCode || item.name === address.ward
      ));
      setWardCode(matchedWard ? String(matchedWard.code) : address.wardCode ?? '');
    } else {
      setWards([]);
    }
  };

  const loadAccount = async () => {
    try {
      setLoading(true);
      setGeneralError('');
      const [profile, addressList] = await runWithAuth((accessToken) => Promise.all([
        accountApi.getMe(accessToken),
        accountApi.getAddresses(accessToken),
      ]));

      const birthParts = splitDateOfBirth(profile.dateOfBirth);
      const nextAddresses = addressList.length > 0 ? addressList : profile.address ?? [];
      const defaultAddress = nextAddresses.find((item) => item.isDefault) ?? nextAddresses[0] ?? null;
      let provinceList: ProvinceApiItem[] = [];
      let locationMessage = '';

      try {
        provinceList = await locationApi.getProvinces();
        setProvinceLocationError('');
      } catch (error) {
        locationMessage = error instanceof Error ? error.message : 'Không tải được dữ liệu tỉnh/phường xã';
        setProvinceLocationError(locationMessage);
      }

      setName(profile.name ?? '');
      setPhone(profile.phone ?? '');
      setEmail(profile.email ?? '');
      setGender(profile.gender ?? null);
      setBirthDay(birthParts.day);
      setBirthMonth(birthParts.month);
      setBirthYear(birthParts.year);
      setAvatarImage(profile.avatarImage ?? '');
      setAddresses(nextAddresses);
      setProvinces(provinceList);
      await fillAddressForm(defaultAddress, provinceList);

      if (locationMessage) {
        setAddressMessage(locationMessage);
      }
    } catch (error) {
      setGeneralError(error instanceof Error ? error.message : 'Không thể tải thông tin tài khoản');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadAccount();
  }, [session?.accessToken]);

  const openSelect = (config: SelectConfig) => {
    setActiveSelect((current) => (current?.id === config.id ? null : config));
  };

  const handleMonthSelect = (value: string) => {
    setBirthMonth(value);
    const dayCount = getDayOptions(value, birthYear).length;
    if (Number(birthDay) > dayCount) setBirthDay('');
  };

  const handleYearSelect = (value: string) => {
    setBirthYear(value);
    const dayCount = getDayOptions(birthMonth, value).length;
    if (Number(birthDay) > dayCount) setBirthDay('');
  };

  const handleProvinceSelect = async (value: string) => {
    const selectedProvince = provinces.find((item) => String(item.code) === value);
    setProvinceCode(value);
    setProvince(selectedProvince?.name ?? '');
    setWardCode('');
    setWard('');
    setWards([]);
    setManualWardEntryAllowed(false);
    setWardLocationError('');

    try {
      await loadWards(value);
    } catch (error) {
      setWardLocationError(error instanceof Error ? error.message : 'Không tải được danh sách phường/xã');
    }
  };

  const handleWardSelect = (value: string) => {
    const selectedWard = wards.find((item) => String(item.code) === value);
    setWardCode(value);
    setWard(selectedWard?.name ?? '');
  };

  const handleManualWardSubmit = () => {
    const nextWard = ward.trim();
    if (!nextWard) return;

    setWard(nextWard);
    setWardCode(buildManualWardCode(provinceCode, nextWard));
    markAddressTouched('ward');
    setActiveSelect(null);
  };

  const handlePickAvatar = async () => {
    try {
      setAvatarUploading(true);
      setProfileMessage('');

      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Quyền truy cập ảnh', 'Vui lòng cho phép ứng dụng truy cập thư viện ảnh để đổi ảnh đại diện.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.72,
        base64: true,
      });

      if (result.canceled) return;

      const asset = result.assets[0];
      if (!asset?.base64) {
        setProfileMessage('Không thể đọc dữ liệu ảnh đã chọn');
        return;
      }

      const updatedProfile = await runWithAuth((accessToken) =>
        accountApi.uploadAvatar(accessToken, asset.base64!, asset.mimeType ?? 'image/jpeg'),
      );
      setAvatarImage(updatedProfile.avatarImage ?? '');
      updateSessionUser({ avatarImage: updatedProfile.avatarImage });
      setProfileMessage('Đã cập nhật ảnh đại diện');
    } catch (error) {
      setProfileMessage(error instanceof Error ? error.message : 'Không thể cập nhật ảnh đại diện');
    } finally {
      setAvatarUploading(false);
    }
  };

  const handleRemoveAvatar = async () => {
    try {
      setAvatarUploading(true);
      setProfileMessage('');
      const updatedProfile = await runWithAuth((accessToken) => accountApi.updateMe(accessToken, { avatarImage: null }));
      setAvatarImage('');
      updateSessionUser({ avatarImage: updatedProfile.avatarImage });
      setProfileMessage('Đã gỡ ảnh đại diện');
    } catch (error) {
      setProfileMessage(error instanceof Error ? error.message : 'Không thể gỡ ảnh đại diện');
    } finally {
      setAvatarUploading(false);
    }
  };

  const handleSaveProfile = async () => {
    const dateOfBirth = buildDateOfBirth();

    if (name.trim().length < 2 || name.trim().length > 60) {
      setProfileMessage('Họ tên cần từ 2 đến 60 ký tự');
      return;
    }

    if (!vietnamPhoneRegex.test(phone.trim())) {
      setProfileMessage('Số điện thoại không đúng định dạng');
      return;
    }

    if (!gender) {
      setProfileMessage('Vui lòng chọn giới tính');
      return;
    }

    if (!dateOfBirth) {
      setProfileMessage('Ngày sinh không hợp lệ hoặc độ tuổi chưa phù hợp');
      return;
    }

    try {
      setProfileSaving(true);
      setProfileMessage('');
      const updatedProfile = await runWithAuth((accessToken) => accountApi.updateMe(accessToken, {
        name: capitalizeWords(name),
        phone: phone.trim(),
        gender,
        dateOfBirth,
      }));
      updateSessionUser({
        name: updatedProfile.name,
        phone: updatedProfile.phone,
        email: updatedProfile.email,
        avatarImage: updatedProfile.avatarImage,
        profileCompleted: updatedProfile.profileCompleted ?? isLocalProfileComplete(),
      });
      setProfileMessage('Đã cập nhật hồ sơ');
    } catch (error) {
      setProfileMessage(error instanceof Error ? error.message : 'Không thể cập nhật hồ sơ');
    } finally {
      setProfileSaving(false);
    }
  };

  const handleSaveAddress = async () => {
    const normalizedName = customerName.trim() || name.trim();
    const normalizedPhone = addressPhone.trim() || phone.trim();
    const isNewAddress = selectedAddressId === newAddressId;

    touchAllAddressFields();

    if (isNewAddress && addresses.length >= 5) {
      setAddressMessage('Bạn chỉ có thể lưu tối đa 5 địa chỉ');
      return;
    }

    if (getAddressFieldError('customerName', normalizedPhone)) return;
    if (getAddressFieldError('addressPhone', normalizedPhone)) return;
    if (getAddressFieldError('province', normalizedPhone)) return;
    if (getAddressFieldError('ward', normalizedPhone)) return;
    if (getAddressFieldError('streetName', normalizedPhone)) return;

    const payload = {
      customerName: capitalizeWords(normalizedName),
      province: province.trim(),
      provinceCode: provinceCode.trim(),
      ward: ward.trim(),
      wardCode: wardCode.trim(),
      streetName: streetName.trim(),
      phoneNumber: normalizedPhone,
      isDefault: addressDefault || addresses.length === 0,
    };

    try {
      setAddressSaving(true);
      setAddressMessage('');
      const nextAddresses = await runWithAuth((accessToken) =>
        isNewAddress
          ? accountApi.addAddress(accessToken, payload)
          : accountApi.updateAddress(accessToken, selectedAddressId, payload),
      );
      const nextSelected =
        nextAddresses.find((item) => item.isDefault && payload.isDefault) ??
        nextAddresses.find((item) => item._id === selectedAddressId) ??
        nextAddresses[nextAddresses.length - 1] ??
        null;
      setAddresses(nextAddresses);
      updateSessionUser({ profileCompleted: isLocalProfileComplete(nextAddresses) });
      await fillAddressForm(nextSelected);
      setAddressMessage(isNewAddress ? 'Đã thêm địa chỉ' : 'Đã cập nhật địa chỉ');
    } catch (error) {
      setAddressMessage(error instanceof Error ? error.message : 'Không thể lưu địa chỉ');
    } finally {
      setAddressSaving(false);
    }
  };

  const handleSetDefaultAddress = async (addressId?: string) => {
    if (!addressId) return;

    try {
      setAddressSaving(true);
      setAddressMessage('');
      const nextAddresses = await runWithAuth((accessToken) => accountApi.setDefaultAddress(accessToken, addressId));
      setAddresses(nextAddresses);
      const nextSelected = nextAddresses.find((item) => item._id === addressId) ?? null;
      await fillAddressForm(nextSelected);
      setAddressMessage('Đã đặt địa chỉ mặc định');
    } catch (error) {
      setAddressMessage(error instanceof Error ? error.message : 'Không thể đặt mặc định');
    } finally {
      setAddressSaving(false);
    }
  };

  const handleDeleteAddress = () => {
    if (selectedAddressId === newAddressId) return;

    Alert.alert('Xóa địa chỉ', 'Địa chỉ này sẽ bị xóa khỏi tài khoản.', [
      { text: 'Hủy', style: 'cancel' },
      {
        text: 'Xóa',
        style: 'destructive',
        onPress: async () => {
          try {
            setAddressSaving(true);
            setAddressMessage('');
            await runWithAuth((accessToken) => accountApi.deleteAddress(accessToken, selectedAddressId));
            const remainingAddresses = addresses.filter((item) => item._id !== selectedAddressId);
            if (remainingAddresses.length > 0 && !remainingAddresses.some((item) => item.isDefault)) {
              const fallbackId = remainingAddresses[0]._id;
              if (fallbackId) {
                const nextAddresses = await runWithAuth((accessToken) =>
                  accountApi.setDefaultAddress(accessToken, fallbackId),
                );
                setAddresses(nextAddresses);
                await fillAddressForm(nextAddresses[0] ?? null);
              }
            } else {
              setAddresses(remainingAddresses);
              await fillAddressForm(remainingAddresses.find((item) => item.isDefault) ?? remainingAddresses[0] ?? null);
            }
            setAddressMessage('Đã xóa địa chỉ');
          } catch (error) {
            setAddressMessage(error instanceof Error ? error.message : 'Không thể xóa địa chỉ');
          } finally {
            setAddressSaving(false);
          }
        },
      },
    ]);
  };

  const handleChangePassword = async () => {
    if (!currentPassword) {
      setSecurityMessage('Vui lòng nhập mật khẩu hiện tại');
      return;
    }

    if (newPassword.length < 8 || !/[a-zA-Z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
      setSecurityMessage('Mật khẩu mới cần ít nhất 8 ký tự, gồm chữ và số');
      return;
    }

    if (newPassword !== confirmPassword) {
      setSecurityMessage('Xác nhận mật khẩu mới chưa trùng khớp');
      return;
    }

    try {
      setPasswordSaving(true);
      setSecurityMessage('');
      await runWithAuth((accessToken) =>
        accountApi.changePassword(accessToken, currentPassword, newPassword, confirmPassword),
      );
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      Alert.alert('Đổi mật khẩu', 'Mật khẩu đã được cập nhật. Vui lòng đăng nhập lại.', [
        {
          text: 'Đăng nhập',
          onPress: () => {
            logout();
            navigation.reset({
              index: 0,
              routes: [{ name: 'Login' }],
            });
          },
        },
      ]);
    } catch (error) {
      setSecurityMessage(error instanceof Error ? error.message : 'Không thể đổi mật khẩu');
    } finally {
      setPasswordSaving(false);
    }
  };

  const renderMessage = (message: string, type: 'success' | 'error' = message.startsWith('Đã') ? 'success' : 'error') => {
    if (!message) return null;

    return (
      <Text style={[styles.message, type === 'success' ? styles.successMessage : styles.errorMessage]}>
        {message}
      </Text>
    );
  };

  const renderAddressFeedback = (field: string) => {
    const normalizedPhone = addressPhone.trim() || phone.trim();
    const error = getAddressFieldError(field, normalizedPhone);
    if (!addressTouched[field] || !error) return null;

    return <Text style={styles.fieldError}>{error}</Text>;
  };

  const renderTextField = (
    label: string,
    value: string,
    onChangeText: (text: string) => void,
    placeholder: string,
    options: {
      keyboardType?: 'default' | 'phone-pad' | 'email-address' | 'numeric';
      autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
      secureTextEntry?: boolean;
      editable?: boolean;
      multiline?: boolean;
      rightAccessory?: React.ReactNode;
      onBlur?: () => void;
      errorMsg?: React.ReactNode;
    } = {},
  ) => (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.inputShell}>
        <TextInput
          style={[
            styles.input,
            options.multiline ? styles.textArea : undefined,
            options.editable === false ? styles.inputDisabled : undefined,
            options.rightAccessory ? styles.inputWithAccessory : undefined,
          ]}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.textSubtle}
          keyboardType={options.keyboardType ?? 'default'}
          autoCapitalize={options.autoCapitalize ?? 'none'}
          secureTextEntry={options.secureTextEntry}
          editable={options.editable ?? true}
          multiline={options.multiline}
          scrollEnabled={options.multiline}
          textAlignVertical={options.multiline ? 'top' : 'center'}
          onBlur={options.onBlur}
        />
        {options.rightAccessory ? <View style={styles.rightAccessory}>{options.rightAccessory}</View> : null}
      </View>
      {options.errorMsg}
    </View>
  );

  const renderSelectBox = (
    id: string,
    title: string,
    selectedValue: string,
    displayValue: string,
    placeholder: string,
    options: SelectOption[],
    onSelect: (value: string) => void | Promise<void>,
    disabled = false,
    compact = false,
    field?: EditField,
    anchor: 'bottom' | 'top' = 'bottom',
  ) => {
    const isInlineDropdown = isInlineSelectId(id);
    const isExpanded = activeSelect?.id === id;

    return (
      <View style={[compact ? styles.compactSelectWrapper : undefined, { position: 'relative' }]}>
        <TouchableOpacity
          style={[
            styles.selectInput,
            compact ? styles.compactSelectInput : undefined,
            disabled ? styles.selectDisabled : undefined,
          ]}
          onPress={() => !disabled && openSelect({ id, title, options, selectedValue, onSelect, field })}
          activeOpacity={0.82}
          disabled={disabled}
        >
          <Text style={[styles.selectText, !displayValue && styles.placeholderText]} numberOfLines={1}>
            {displayValue || placeholder}
          </Text>
          <MaterialCommunityIcons name="chevron-down" size={20} color={colors.textMuted} />
        </TouchableOpacity>
        {isInlineDropdown && isExpanded ? (
          <View
            style={[
              anchor === 'top' ? styles.dropdownAbove : styles.dropdownPanel,
              compact ? styles.compactDropdownPanel : undefined,
            ]}
          >
            {options.length ? (
              <ScrollView
                style={styles.dropdownList}
                nestedScrollEnabled
                keyboardShouldPersistTaps="handled"
              >
                {options.map((option) => {
                  const selected = option.value === selectedValue;

                  return (
                    <TouchableOpacity
                      key={option.value}
                      style={[styles.dropdownItem, selected && styles.dropdownItemSelected]}
                      onPress={() => {
                        void onSelect(option.value);
                        setActiveSelect(null);
                      }}
                      activeOpacity={0.82}
                    >
                      <Text style={[styles.dropdownItemText, selected && styles.dropdownItemTextSelected]}>
                        {option.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            ) : (
              <View style={styles.dropdownEmpty}>
                <Text style={styles.dropdownEmptyText}>Không có dữ liệu</Text>
              </View>
            )}
          </View>
        ) : null}
      </View>
    );
  };

  const renderSelectField = (
    id: string,
    label: string,
    selectedValue: string,
    displayValue: string,
    placeholder: string,
    options: SelectOption[],
    onSelect: (value: string) => void | Promise<void>,
    disabled = false,
    field?: EditField,
    errorMsg?: React.ReactNode,
    zIndex?: number,
  ) => (
    <View style={[styles.field, { zIndex: zIndex ?? 5 }]}>
      <Text style={styles.label}>{label}</Text>
      {renderSelectBox(id, label, selectedValue, displayValue, placeholder, options, onSelect, disabled, false, field)}
      {errorMsg}
    </View>
  );

  const renderProfileTab = () => (
    <View style={styles.sectionCard}>
      <View style={styles.avatarBlock}>
        <View style={styles.avatarPreview}>
          {isPreviewableImage(avatarPreview) ? (
            <Image source={{ uri: avatarPreview }} style={styles.avatarImage} />
          ) : (
            <Text style={styles.avatarInitial}>{getInitial(name || session?.user.name || '')}</Text>
          )}
        </View>
        <View style={styles.avatarTextBlock}>
          <Text style={styles.sectionTitle}>Hồ sơ cá nhân</Text>
          <Text style={styles.sectionMeta} numberOfLines={1}>
            {email || 'Chưa có email'}
          </Text>
        </View>
      </View>

      <View style={styles.avatarActions}>
        <TouchableOpacity
          style={[styles.avatarActionButton, avatarUploading && styles.buttonDisabled]}
          onPress={handlePickAvatar}
          disabled={avatarUploading}
          activeOpacity={0.84}
        >
          {avatarUploading ? (
            <ActivityIndicator color={colors.brand} />
          ) : (
            <MaterialCommunityIcons name="image-plus" size={20} color={colors.brand} />
          )}
          <Text style={styles.avatarActionText}>{avatarUploading ? 'Đang tải ảnh...' : 'Chọn ảnh'}</Text>
        </TouchableOpacity>
        {avatarImage ? (
          <TouchableOpacity
            style={styles.avatarRemoveButton}
            onPress={handleRemoveAvatar}
            disabled={avatarUploading}
            activeOpacity={0.84}
          >
            <MaterialCommunityIcons name="trash-can-outline" size={20} color={colors.danger} />
            <Text style={styles.avatarRemoveText}>Gỡ ảnh</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {renderTextField('Họ và tên', name, setName, 'Nhập họ và tên', { autoCapitalize: 'words' })}
      {renderTextField('Số điện thoại', phone, setPhone, 'Số điện thoại', {
        keyboardType: 'phone-pad',
        editable: !session?.user.profileCompleted || !phone.trim(),
      })}
      {renderTextField('Email', email, setEmail, 'Email', {
        keyboardType: 'email-address',
        editable: false,
      })}
      {renderSelectField(
        'gender',
        'Giới tính',
        gender ?? '',
        gender === 'male' ? 'Nam' : gender === 'female' ? 'Nữ' : '',
        'Chọn giới tính',
        genderOptions,
        (value) => setGender(value as Gender),
        false,
        'gender',
        undefined,
        15,
      )}

      <View style={[styles.field, { zIndex: 10 }]}>
        <Text style={styles.label}>Ngày sinh</Text>
        <View style={{ flexDirection: 'row', gap: 12, zIndex: 10 }}>
          <View style={{ flex: 1, zIndex: 10 }}>
            <Text style={{ color: colors.textBody, fontSize: 13, marginBottom: 6 }}>Ngày</Text>
            {renderSelectBox(
              'birthDay',
              'Ngày sinh',
              birthDay,
              birthDay,
              'Ngày',
              dayOptions,
              (value) => setBirthDay(value),
              !birthMonth || !birthYear,
              true,
              'birthDay',
              'bottom',
            )}
          </View>
          <View style={{ flex: 1, zIndex: 10 }}>
            <Text style={{ color: colors.textBody, fontSize: 13, marginBottom: 6 }}>Tháng</Text>
            {renderSelectBox(
              'birthMonth',
              'Tháng sinh',
              birthMonth,
              birthMonth,
              'Tháng',
              monthOptions,
              handleMonthSelect,
              false,
              true,
              'birthMonth',
              'bottom',
            )}
          </View>
          <View style={{ flex: 1, zIndex: 10 }}>
            <Text style={{ color: colors.textBody, fontSize: 13, marginBottom: 6 }}>Năm</Text>
            {renderSelectBox(
              'birthYear',
              'Năm sinh',
              birthYear,
              birthYear,
              'Năm',
              yearOptions,
              handleYearSelect,
              false,
              true,
              'birthYear',
              'bottom',
            )}
          </View>
        </View>
      </View>

      {renderMessage(profileMessage)}
      <TouchableOpacity
        style={[styles.primaryButton, profileSaving && styles.buttonDisabled]}
        onPress={handleSaveProfile}
        disabled={profileSaving}
        activeOpacity={0.86}
      >
        {profileSaving ? (
          <ActivityIndicator color={colors.white} />
        ) : (
          <>
            <MaterialCommunityIcons name="content-save-outline" size={20} color={colors.white} />
            <Text style={styles.primaryButtonText}>Lưu hồ sơ</Text>
          </>
        )}
      </TouchableOpacity>
    </View>
  );

  const renderAddressTab = () => (
    <View>
      <View style={styles.addressList}>
        <TouchableOpacity
          style={[styles.addressChip, selectedAddressId === newAddressId && styles.addressChipActive]}
          onPress={clearAddressForm}
          activeOpacity={0.82}
        >
          <MaterialCommunityIcons name="plus-circle-outline" size={18} color={selectedAddressId === newAddressId ? colors.white : colors.brand} />
          <Text style={[styles.addressChipText, selectedAddressId === newAddressId && styles.addressChipTextActive]}>
            Thêm mới
          </Text>
        </TouchableOpacity>
        {addresses.map((item, index) => (
          <TouchableOpacity
            key={item._id ?? `${item.phoneNumber}-${index}`}
            style={[styles.addressChip, selectedAddressId === item._id && styles.addressChipActive]}
            onPress={() => void fillAddressForm(item)}
            activeOpacity={0.82}
          >
            <MaterialCommunityIcons
              name={item.isDefault ? 'star' : 'map-marker-outline'}
              size={18}
              color={selectedAddressId === item._id ? colors.white : item.isDefault ? colors.goldDark : colors.brand}
            />
            <Text style={[styles.addressChipText, selectedAddressId === item._id && styles.addressChipTextActive]} numberOfLines={1}>
              {item.isDefault ? 'Mặc định' : `Địa chỉ ${index + 1}`}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {addresses.length > 0 ? (
        <View style={styles.addressSummary}>
          <MaterialCommunityIcons name="map-marker-check-outline" size={20} color={colors.brand} />
          <Text style={styles.addressSummaryText} numberOfLines={2}>
            {selectedAddress ? formatAddress(selectedAddress) : 'Đang tạo địa chỉ mới'}
          </Text>
        </View>
      ) : null}

      <View style={styles.sectionCard}>
        <View style={styles.sectionHeadingRow}>
          <View>
            <Text style={styles.sectionTitle}>Địa chỉ nhận hàng</Text>
            <Text style={styles.sectionMeta}>{selectedAddress ? 'Chỉnh sửa địa chỉ đã lưu' : 'Tạo địa chỉ mới'}</Text>
          </View>
          {selectedAddress ? (
            <TouchableOpacity style={styles.iconButton} onPress={handleDeleteAddress} activeOpacity={0.82}>
              <MaterialCommunityIcons name="trash-can-outline" size={20} color={colors.danger} />
            </TouchableOpacity>
          ) : null}
        </View>

        {renderTextField('Tên người nhận', customerName, setCustomerName, name || 'Mặc định theo họ tên', {
          autoCapitalize: 'words',
          onBlur: () => markAddressTouched('customerName'),
          errorMsg: renderAddressFeedback('customerName'),
        })}
        {renderTextField('Số điện thoại nhận hàng', addressPhone, setAddressPhone, phone || 'Bỏ trống nếu giống số chính', {
          keyboardType: 'phone-pad',
          onBlur: () => markAddressTouched('addressPhone'),
          errorMsg: renderAddressFeedback('addressPhone'),
        })}
        {renderSelectField(
          'province',
          'Tỉnh/Thành phố',
          provinceCode,
          province,
          'Chọn tỉnh/thành phố',
          provinceOptions,
          (value) => { void handleProvinceSelect(value); markAddressTouched('province'); },
          provinces.length === 0,
          'province',
          renderAddressFeedback('province'),
          30,
        )}
        {renderSelectField(
          'ward',
          'Phường/Xã',
          wardCode,
          ward,
          province ? 'Chọn phường/xã' : 'Chọn tỉnh/thành phố trước',
          wardOptions,
          (value) => { handleWardSelect(value); markAddressTouched('ward'); },
          !provinceCode,
          'ward',
          renderAddressFeedback('ward'),
          20,
        )}
        {renderTextField('Địa chỉ chi tiết', streetName, setStreetName, 'Số nhà, tên đường...', {
          autoCapitalize: 'sentences',
          multiline: true,
          onBlur: () => markAddressTouched('streetName'),
          errorMsg: renderAddressFeedback('streetName'),
        })}

        <TouchableOpacity
          style={[styles.defaultRow, addressDefault && styles.defaultRowActive]}
          onPress={() => setAddressDefault((value) => !value)}
          activeOpacity={0.82}
        >
          <View style={[styles.checkbox, addressDefault && styles.checkboxActive]}>
            {addressDefault ? <MaterialCommunityIcons name="check" size={15} color={colors.white} /> : null}
          </View>
          <Text style={styles.defaultText}>Đặt làm địa chỉ mặc định</Text>
        </TouchableOpacity>

        {renderMessage(addressMessage)}
        <View style={styles.addressActions}>
          <TouchableOpacity
            style={[styles.primaryButton, addressSaving && styles.buttonDisabled]}
            onPress={handleSaveAddress}
            disabled={addressSaving}
            activeOpacity={0.86}
          >
            {addressSaving ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <>
                <MaterialCommunityIcons name="content-save-outline" size={20} color={colors.white} />
                <Text style={styles.primaryButtonText}>{selectedAddress ? 'Lưu địa chỉ' : 'Thêm địa chỉ'}</Text>
              </>
            )}
          </TouchableOpacity>
          {selectedAddress && !selectedAddress.isDefault ? (
            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={() => void handleSetDefaultAddress(selectedAddress._id)}
              disabled={addressSaving}
              activeOpacity={0.86}
            >
              <MaterialCommunityIcons name="star-outline" size={20} color={colors.brand} />
              <Text style={styles.secondaryButtonText}>Mặc định</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>
    </View>
  );

  const renderSecurityTab = () => (
    <View style={styles.sectionCard}>
      <View style={styles.sectionHeadingRow}>
        <View>
          <Text style={styles.sectionTitle}>Tài khoản & Bảo mật</Text>
          <Text style={styles.sectionMeta}>{email || phone}</Text>
        </View>
        <View style={styles.securityBadge}>
          <MaterialCommunityIcons name="shield-check-outline" size={18} color={colors.success} />
        </View>
      </View>

      {renderTextField('Mật khẩu hiện tại', currentPassword, setCurrentPassword, 'Nhập mật khẩu hiện tại', {
        secureTextEntry: !showCurrentPassword,
        rightAccessory: (
          <TouchableOpacity onPress={() => setShowCurrentPassword((value) => !value)}>
            <MaterialCommunityIcons name={showCurrentPassword ? 'eye-off-outline' : 'eye-outline'} size={22} color={colors.textMuted} />
          </TouchableOpacity>
        ),
      })}
      {renderTextField('Mật khẩu mới', newPassword, setNewPassword, 'Nhập mật khẩu mới', {
        secureTextEntry: !showNewPassword,
        rightAccessory: (
          <TouchableOpacity onPress={() => setShowNewPassword((value) => !value)}>
            <MaterialCommunityIcons name={showNewPassword ? 'eye-off-outline' : 'eye-outline'} size={22} color={colors.textMuted} />
          </TouchableOpacity>
        ),
      })}
      {renderTextField('Xác nhận mật khẩu mới', confirmPassword, setConfirmPassword, 'Nhập lại mật khẩu mới', {
        secureTextEntry: !showConfirmPassword,
        rightAccessory: (
          <TouchableOpacity onPress={() => setShowConfirmPassword((value) => !value)}>
            <MaterialCommunityIcons name={showConfirmPassword ? 'eye-off-outline' : 'eye-outline'} size={22} color={colors.textMuted} />
          </TouchableOpacity>
        ),
      })}

      <View style={styles.passwordHint}>
        <MaterialCommunityIcons name="information-outline" size={18} color={colors.action} />
        <Text style={styles.passwordHintText}>Mật khẩu phải có ít nhất 8 ký tự, gồm chữ và số</Text>
      </View>

      {renderMessage(securityMessage)}
      <TouchableOpacity
        style={[styles.primaryButton, passwordSaving && styles.buttonDisabled]}
        onPress={handleChangePassword}
        disabled={passwordSaving}
        activeOpacity={0.86}
      >
        {passwordSaving ? (
          <ActivityIndicator color={colors.white} />
        ) : (
          <>
            <MaterialCommunityIcons name="lock-reset" size={20} color={colors.white} />
            <Text style={styles.primaryButtonText}>Đổi mật khẩu</Text>
          </>
        )}
      </TouchableOpacity>
    </View>
  );

  const renderActiveTab = () => {
    if (activeTab === 'profile') return renderProfileTab();
    if (activeTab === 'addresses') return renderAddressTab();
    return renderSecurityTab();
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={sharedStyles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.headerButton} onPress={() => navigation.goBack()} activeOpacity={0.82}>
            <MaterialCommunityIcons name="arrow-left" size={24} color={colors.white} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Thông tin cá nhân</Text>
          <TouchableOpacity style={styles.headerButton} onPress={() => void loadAccount()} activeOpacity={0.82}>
            <MaterialCommunityIcons name="refresh" size={22} color={colors.white} />
          </TouchableOpacity>
        </View>

        <LocationPicker
          visible={Boolean(activeSelect && !isInlineSelectId(activeSelect.id))}
          title={activeSelect?.title ?? ''}
          options={activeSelect?.options ?? []}
          selectedValue={activeSelect?.selectedValue}
          loading={activeSelect?.id === 'ward' ? wardLoading : false}
          error={
            activeSelect?.id === 'province'
              ? provinceLocationError
              : activeSelect?.id === 'ward'
              ? wardLocationError
              : ''
          }
          emptyText={activeSelect?.id === 'ward' ? 'Chưa có dữ liệu phường/xã' : 'Không có dữ liệu'}
          onRetry={() => {
            if (activeSelect?.id === 'province') {
              void loadAccount();
            }
            if (activeSelect?.id === 'ward' && provinceCode) {
              void handleProvinceSelect(provinceCode);
            }
          }}
          onClose={() => setActiveSelect(null)}
          onSelect={(value) => {
            void activeSelect?.onSelect(value);
            if (activeSelect?.field === 'province' || activeSelect?.field === 'ward') {
              markAddressTouched(activeSelect.field);
            }
          }}
          manualEntryAllowed={activeSelect?.id === 'ward' && manualWardEntryAllowed}
          manualValue={activeSelect?.id === 'ward' ? ward : ''}
          onManualChange={(value) => {
            setWard(value);
            setWardCode('');
          }}
          onManualSubmit={handleManualWardSubmit}
        />

        <FlatList
          style={styles.content}
          data={[]}
          renderItem={() => null}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={loading ? (
            <View style={styles.loadingPanel}>
              <ActivityIndicator color={colors.brand} />
              <Text style={styles.loadingText}>Đang tải tài khoản...</Text>
            </View>
          ) : (
            <>
              {generalError ? <Text style={styles.errorBanner}>{generalError}</Text> : null}
              <View style={styles.heroPanel}>
                <View style={styles.heroAvatar}>
                  {isPreviewableImage(avatarPreview) ? (
                    <Image source={{ uri: avatarPreview }} style={styles.heroAvatarImage} />
                  ) : (
                    <Text style={styles.heroAvatarText}>{getInitial(name || session?.user.name || '')}</Text>
                  )}
                </View>
                <View style={styles.heroInfo}>
                  <Text style={styles.heroName} numberOfLines={1}>
                    {name || 'Khách hàng Fashionista'}
                  </Text>
                  <Text style={styles.heroContact} numberOfLines={1}>
                    {email || phone || 'Tài khoản của bạn'}
                  </Text>
                </View>
              </View>

              <View style={styles.tabs}>
                {tabItems.map((item) => {
                  const selected = activeTab === item.id;

                  return (
                    <TouchableOpacity
                      key={item.id}
                      style={[styles.tabButton, selected && styles.tabButtonActive]}
                      onPress={() => {
                        setActiveTab(item.id);
                        setActiveSelect(null);
                      }}
                      activeOpacity={0.84}
                    >
                      <MaterialCommunityIcons name={item.icon} size={19} color={selected ? colors.white : colors.brand} />
                      <Text style={[styles.tabButtonText, selected && styles.tabButtonTextActive]} numberOfLines={1}>
                        {item.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {renderActiveTab()}
            </>
          )}
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.brand,
  },
  header: {
    minHeight: 64,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.brand,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  headerTitle: {
    color: colors.white,
    fontSize: 22,
    lineHeight: 30,
    fontWeight: '800',
  },
  content: {
    flex: 1,
    backgroundColor: colors.background,
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
  },
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: 240,
  },
  loadingPanel: {
    minHeight: 260,
    borderRadius: radii.sm,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    ...shadows.card,
  },
  loadingText: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: '600',
  },
  errorBanner: sharedStyles.errorBanner,
  heroPanel: {
    minHeight: 112,
    borderRadius: radii.sm,
    backgroundColor: colors.surface,
    padding: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    ...shadows.card,
  },
  heroAvatar: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  heroAvatarImage: {
    width: '100%',
    height: '100%',
  },
  heroAvatarText: {
    color: colors.white,
    fontSize: 28,
    fontWeight: '800',
  },
  heroInfo: {
    flex: 1,
    marginLeft: 14,
    minWidth: 0,
  },
  heroName: {
    color: colors.text,
    fontSize: 20,
    lineHeight: 27,
    fontWeight: '800',
  },
  heroContact: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 3,
  },
  tabs: {
    minHeight: 48,
    marginTop: 14,
    marginBottom: 14,
    padding: 4,
    borderRadius: radii.sm,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    gap: 6,
  },
  tabButton: {
    flex: 1,
    minHeight: 40,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 5,
  },
  tabButtonActive: {
    backgroundColor: colors.brand,
  },
  tabButtonText: {
    color: colors.brand,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '800',
  },
  tabButtonTextActive: {
    color: colors.white,
  },
  sectionCard: {
    borderRadius: radii.sm,
    backgroundColor: colors.surface,
    padding: spacing.lg,
    ...shadows.card,
  },
  sectionHeadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '800',
  },
  sectionMeta: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
    marginTop: 3,
  },
  avatarBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  avatarPreview: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: colors.brandSoft,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  avatarInitial: {
    color: colors.brand,
    fontSize: 24,
    fontWeight: '800',
  },
  avatarTextBlock: {
    flex: 1,
    minWidth: 0,
    marginLeft: 12,
  },
  avatarActions: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: spacing.lg,
  },
  avatarActionButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.brand,
    backgroundColor: colors.brandSoft,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  avatarActionText: {
    color: colors.brand,
    fontSize: 14,
    lineHeight: 19,
    fontWeight: '800',
  },
  avatarRemoveButton: {
    minWidth: 108,
    minHeight: 48,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.dangerSoft,
    backgroundColor: colors.dangerSoft,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 7,
  },
  avatarRemoveText: {
    color: colors.danger,
    fontSize: 14,
    lineHeight: 19,
    fontWeight: '800',
  },
  field: {
    marginBottom: spacing.lg,
  },
  label: {
    color: colors.text,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '800',
    marginBottom: 7,
  },
  inputShell: {
    position: 'relative',
  },
  input: {
    minHeight: 50,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.sm,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 14 : 10,
    backgroundColor: colors.field,
    color: colors.textBody,
    fontSize: 15,
  },
  inputDisabled: {
    backgroundColor: '#EFF2F5',
    color: colors.textMuted,
  },
  inputWithAccessory: {
    paddingRight: 48,
  },
  textArea: {
    minHeight: 104,
    maxHeight: 150,
    paddingTop: 12,
  },
  rightAccessory: {
    position: 'absolute',
    right: 13,
    top: 14,
  },
  selectInput: {
    minHeight: 50,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.sm,
    paddingHorizontal: 14,
    backgroundColor: colors.field,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  compactSelectWrapper: {
    flex: 1,
    zIndex: 10,
  },
  compactSelectInput: {
    paddingHorizontal: 10,
  },
  selectDisabled: {
    backgroundColor: '#EFF2F5',
  },
  selectText: {
    flex: 1,
    color: colors.textBody,
    fontSize: 15,
    lineHeight: 20,
    marginRight: 8,
  },
  placeholderText: {
    color: colors.textSubtle,
  },
  dropdownPanel: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    marginTop: 6,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.sm,
    backgroundColor: colors.surface,
    overflow: 'hidden',
    zIndex: 20,
    elevation: 5,
    maxHeight: 240,
  },
  compactDropdownPanel: {
    maxHeight: 180,
  },
  dropdownAbove: {
    position: 'absolute',
    bottom: '100%',
    left: 0,
    right: 0,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.sm,
    backgroundColor: colors.surface,
    overflow: 'hidden',
    zIndex: 20,
    elevation: 5,
    maxHeight: 180,
  },
  dropdownList: {
    maxHeight: 220,
  },
  dropdownItem: {
    minHeight: 44,
    paddingHorizontal: 14,
    justifyContent: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#EEF1F4',
  },
  dropdownItemSelected: {
    backgroundColor: colors.brandSoft,
  },
  dropdownItemText: {
    color: colors.textBody,
    fontSize: 14,
    lineHeight: 19,
  },
  dropdownItemTextSelected: {
    color: colors.brand,
    fontWeight: '800',
  },
  dropdownEmpty: {
    minHeight: 44,
    paddingHorizontal: 14,
    justifyContent: 'center',
  },
  dropdownEmptyText: {
    color: colors.textMuted,
    fontSize: 14,
  },
  dateRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-start',
  },
  message: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
    borderRadius: radii.sm,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: spacing.md,
  },
  successMessage: {
    color: colors.success,
    backgroundColor: '#E8F6EF',
  },
  errorMessage: {
    color: colors.danger,
    backgroundColor: colors.dangerSoft,
  },
  primaryButton: {
    minHeight: 52,
    borderRadius: radii.sm,
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  primaryButtonText: {
    color: colors.white,
    fontSize: 16,
    lineHeight: 21,
    fontWeight: '800',
  },
  buttonDisabled: {
    opacity: 0.72,
  },
  addressList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  addressChip: {
    maxWidth: '48%',
    minHeight: 40,
    borderRadius: 20,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  addressChipActive: {
    backgroundColor: colors.brand,
    borderColor: colors.brand,
  },
  addressChipText: {
    color: colors.text,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '800',
    flexShrink: 1,
  },
  addressChipTextActive: {
    color: colors.white,
  },
  addressSummary: {
    minHeight: 54,
    borderRadius: radii.sm,
    backgroundColor: colors.brandSoft,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  addressSummaryText: {
    flex: 1,
    color: colors.text,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
  },
  iconButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.dangerSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  defaultRow: {
    minHeight: 48,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  defaultRowActive: {
    backgroundColor: colors.brandSoft,
    borderColor: colors.brandLight,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  checkboxActive: {
    backgroundColor: colors.brand,
    borderColor: colors.brand,
  },
  defaultText: {
    color: colors.text,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '700',
  },
  addressActions: {
    gap: 10,
  },
  secondaryButton: {
    minHeight: 50,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.brand,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  secondaryButtonText: {
    color: colors.brand,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '800',
  },
  securityBadge: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#E8F6EF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  passwordHint: {
    minHeight: 48,
    borderRadius: radii.sm,
    backgroundColor: '#EAF3FF',
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: spacing.md,
  },
  passwordHintText: {
    flex: 1,
    color: '#0A58CA',
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
  },
  fieldError: {
    color: colors.danger,
    fontSize: 13,
    marginTop: 6,
  },
  dateLabelRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 6,
  },
  dateLabel: {
    flex: 1,
    textAlign: 'center',
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
  },
});

export default EditProfileScreen;
