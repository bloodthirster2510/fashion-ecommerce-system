import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import type { RootStackParamList } from '../../../navigation/AppNavigator';
import { authApi } from '../authApi';
import { locationApi, type ProvinceApiItem, type WardApiItem } from '../locationApi';
import { colors, sharedStyles } from '../../../theme';

type AuthNavigationProp = StackNavigationProp<RootStackParamList>;
type Gender = 'male' | 'female';
type RegisterField =
  | 'name'
  | 'phone'
  | 'otp'
  | 'email'
  | 'gender'
  | 'birthDay'
  | 'birthMonth'
  | 'birthYear'
  | 'customerName'
  | 'addressPhone'
  | 'province'
  | 'ward'
  | 'streetName'
  | 'password'
  | 'confirmPassword';
type Feedback = {
  type: 'error' | 'success';
  message: string;
};
type SelectOption = {
  label: string;
  value: string;
};
type SelectConfig = {
  id: string;
  field?: RegisterField;
  title: string;
  options: SelectOption[];
  selectedValue: string;
  onSelect: (value: string) => void | Promise<void>;
};

const vietnamPhoneRegex = /^(0|\+84)(3|5|7|8|9)[0-9]{8}$/;
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const nameRegex = /^[a-zA-ZÀ-ỹ\s]+$/;
const currentYear = new Date().getFullYear();

const capitalizeWords = (str: string) =>
  str.replace(/(^|\s)\S/g, (match) => match.toUpperCase());

const filterLettersOnly = (value: string) =>
  value.replace(/[^a-zA-ZÀ-ỹ\s]/g, '');
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

const getDayOptions = (month: string, year: string): SelectOption[] => {
  const numericMonth = Number(month);
  const numericYear = Number(year) || currentYear;
  const dayCount = numericMonth ? new Date(numericYear, numericMonth, 0).getDate() : 31;

  return Array.from({ length: dayCount }, (_, index) => {
    const value = String(index + 1);
    return { label: value, value };
  });
};

const RegisterScreen = () => {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [gender, setGender] = useState<Gender | null>(null);
  const [birthDay, setBirthDay] = useState('');
  const [birthMonth, setBirthMonth] = useState('');
  const [birthYear, setBirthYear] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [addressPhone, setAddressPhone] = useState('');
  const [provinceCode, setProvinceCode] = useState('');
  const [province, setProvince] = useState('');
  const [wardCode, setWardCode] = useState('');
  const [ward, setWard] = useState('');
  const [streetName, setStreetName] = useState('');
  const [provinces, setProvinces] = useState<ProvinceApiItem[]>([]);
  const [wards, setWards] = useState<WardApiItem[]>([]);
  const [provinceLoading, setProvinceLoading] = useState(false);
  const [wardLoading, setWardLoading] = useState(false);
  const [locationError, setLocationError] = useState('');
  const [otp, setOtp] = useState('');
  const [otpToken, setOtpToken] = useState('');
  const [otpLoading, setOtpLoading] = useState(false);
  const [otpVerifying, setOtpVerifying] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [activeSelect, setActiveSelect] = useState<SelectConfig | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [generalError, setGeneralError] = useState('');
  const [touched, setTouched] = useState<Record<RegisterField, boolean>>({
    name: false,
    phone: false,
    otp: false,
    email: false,
    gender: false,
    birthDay: false,
    birthMonth: false,
    birthYear: false,
    customerName: false,
    addressPhone: false,
    province: false,
    ward: false,
    streetName: false,
    password: false,
    confirmPassword: false,
  });
  const navigation = useNavigation<AuthNavigationProp>();
  const provinceOptions = provinces.map((item) => ({ label: item.name, value: String(item.code) }));
  const wardOptions = wards.map((item) => ({ label: item.name, value: String(item.code) }));
  const dayOptions = getDayOptions(birthMonth, birthYear);

  const handleNameChange = (value: string) => {
    setName(filterLettersOnly(value));
  };

  const handleCustomerNameChange = (value: string) => {
    setCustomerName(filterLettersOnly(value));
  };

  const loadProvinces = async () => {
    try {
      setProvinceLoading(true);
      setLocationError('');
      const result = await locationApi.getProvinces();
      setProvinces(result);
    } catch (error) {
      setLocationError(error instanceof Error ? error.message : 'Không tải được danh sách tỉnh/thành phố');
    } finally {
      setProvinceLoading(false);
    }
  };

  useEffect(() => {
    void loadProvinces();
  }, []);

  const openSelect = (config: SelectConfig) => {
    setActiveSelect((current) => (current?.id === config.id ? null : config));
  };

  const markTouched = (field: RegisterField) => {
    setTouched((current) => ({ ...current, [field]: true }));
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

    try {
      setWardLoading(true);
      const result = await locationApi.getWards(Number(value));
      setWards(result);
    } catch {
      setGeneralError('Không tải được danh sách phường/xã');
    } finally {
      setWardLoading(false);
    }
  };

  const handleWardSelect = (value: string) => {
    const selectedWard = wards.find((item) => String(item.code) === value);
    setWardCode(value);
    setWard(selectedWard?.name ?? '');
  };

  const resetOtpState = () => {
    setOtp('');
    setOtpToken('');
  };

  const handlePhoneChange = (value: string) => {
    setPhone(value);
    if (otpToken) resetOtpState();
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

  const getFieldError = (field: RegisterField) => {
    const dateOfBirth = buildDateOfBirth();
    const receiverName = customerName.trim() || name.trim();
    const receiverPhone = addressPhone.trim() || phone.trim();

    switch (field) {
      case 'name':
        if (!name.trim()) return '';
        if (!nameRegex.test(name.trim())) return 'Họ tên chỉ được chứa chữ cái';
        if (name.trim().length < 2 || name.trim().length > 60) return 'Họ tên cần từ 2 đến 60 ký tự';
        return '';
      case 'phone':
        if (!phone.trim()) return '';
        if (!vietnamPhoneRegex.test(phone.trim())) return 'Sai định dạng. VD: 0912345678';
        return '';
      case 'otp':
        if (!otpToken) return otp.trim() ? 'Vui lòng bấm xác thực OTP' : 'Vui lòng nhập và xác thực OTP';
        return '';
      case 'email':
        if (!email.trim()) return '';
        if (!emailRegex.test(email.trim())) return 'Email chưa đúng. VD: ten@email.com';
        return '';
      case 'gender':
        if (!gender) return '';
        return '';
      case 'birthDay':
      case 'birthMonth':
      case 'birthYear':
        if (!birthDay && !birthMonth && !birthYear) return '';
        if (!birthDay || !birthMonth || !birthYear) return 'Vui lòng chọn đủ ngày/tháng/năm sinh';
        if (!dateOfBirth) return 'Ngày sinh không hợp lệ hoặc độ tuổi không phù hợp';
        return '';
      case 'customerName':
        if (!receiverName) return '';
        if (!nameRegex.test(receiverName)) return 'Tên người nhận chỉ được chứa chữ cái';
        if (receiverName.length < 2 || receiverName.length > 60) return 'Tên người nhận cần từ 2 đến 60 ký tự';
        return '';
      case 'addressPhone':
        if (!receiverPhone) return '';
        if (!vietnamPhoneRegex.test(receiverPhone)) return 'Sai định dạng. VD: 0912345678';
        return '';
      case 'province':
        if (!province.trim()) return '';
        return '';
      case 'ward':
        if (!ward.trim()) return '';
        return '';
      case 'streetName':
        if (!streetName.trim()) return '';
        if (streetName.trim().length < 5 || streetName.trim().length > 150) {
          return 'Địa chỉ cần từ 5 đến 150 ký tự';
        }
        return '';
      case 'password':
        if (!password) return '';
        if (password.length < 8) return 'Mật khẩu cần tối thiểu 8 ký tự';
        if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) return 'Mật khẩu cần có ít nhất 1 chữ và 1 số';
        return '';
      case 'confirmPassword':
        if (!confirmPassword) return '';
        if (password !== confirmPassword) return 'Xác nhận mật khẩu không trùng khớp';
        return '';
      default:
        return '';
    }
  };

  const getFeedback = (field: RegisterField): Feedback | null => {
    if (!submitted && !touched[field]) return null;

    const error = getFieldError(field);
    if (error) return { type: 'error', message: error };

    return null;
  };

  const renderFeedback = (field: RegisterField) => {
    const error = getFieldError(field);
    if (!(submitted || touched[field]) || !error) return null;

    return (
      <Text style={styles.feedbackError} numberOfLines={1}>
        {error}
      </Text>
    );
  };

  const isFieldValid = (field: RegisterField) => {
    if (!submitted && !touched[field]) return false;
    const value = (() => {
      switch (field) {
        case 'name': return name;
        case 'phone': return phone;
        case 'otp': return otp;
        case 'email': return email;
        case 'password': return password;
        case 'confirmPassword': return confirmPassword;
        case 'streetName': return streetName;
        case 'customerName': return customerName;
        case 'addressPhone': return addressPhone;
        case 'gender': return gender ?? '';
        case 'birthDay': return birthDay;
        case 'birthMonth': return birthMonth;
        case 'birthYear': return birthYear;
        case 'province': return province;
        case 'ward': return ward;
        default: return '';
      }
    })();
    return !getFieldError(field) && value.trim().length > 0;
  };

  const renderInput = (
    field: RegisterField,
    value: string,
    onChangeText: (text: string) => void,
    placeholder: string,
    options: {
      keyboardType?: 'default' | 'phone-pad' | 'email-address' | 'numeric';
      autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
      secureTextEntry?: boolean;
      noFeedback?: boolean;
      rightAccessory?: React.ReactNode;
    } = {},
  ) => {
    const valid = isFieldValid(field);

    return (
      <View>
        <View style={styles.inputWrapper}>
          <TextInput
            style={[styles.input, valid && styles.inputValid, options.rightAccessory ? styles.inputWithRight : undefined]}
            value={value}
            onChangeText={onChangeText}
            placeholder={placeholder}
            placeholderTextColor="#9aa3b2"
            keyboardType={options.keyboardType ?? 'default'}
            autoCapitalize={options.autoCapitalize ?? 'none'}
            secureTextEntry={options.secureTextEntry}
            onBlur={() => markTouched(field)}
          />
          {options.rightAccessory ? (
            <View style={styles.rightAccessory}>
              {valid ? (
                <MaterialCommunityIcons name="check-circle" size={20} color="#198754" />
              ) : null}
              {options.rightAccessory}
            </View>
          ) : valid ? (
            <MaterialCommunityIcons name="check-circle" size={20} color="#198754" style={styles.inputCheck} />
          ) : null}
        </View>
        {!options.noFeedback ? renderFeedback(field) : null}
      </View>
    );
  };

  const validatePhone = useCallback(() => {
    if (!vietnamPhoneRegex.test(phone.trim())) {
      return false;
    }
    return true;
  }, [phone]);

  const handleSendOtp = async () => {
    if (!validatePhone()) {
      markTouched('phone');
      return;
    }
    setGeneralError('');
    try {
      setOtpLoading(true);
      await authApi.sendOtp(phone.trim());
    } catch (error) {
      setGeneralError(error instanceof Error ? error.message : 'Không thể gửi mã OTP');
    } finally {
      setOtpLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (!validatePhone()) {
      markTouched('phone');
      return;
    }

    if (!otp.trim()) {
      markTouched('otp');
      return;
    }
    setGeneralError('');

    try {
      setOtpVerifying(true);
      const result = await authApi.verifyOtp(phone.trim(), otp.trim());
      setOtpToken(result.otpToken);
    } catch (error) {
      setOtpToken('');
      setGeneralError(error instanceof Error ? error.message : 'Không thể xác thực OTP');
    } finally {
      setOtpVerifying(false);
    }
  };

  const handleRegister = async () => {
    setSubmitted(true);
    setGeneralError('');
    const dateOfBirth = buildDateOfBirth();
    const receiverName = customerName.trim() || name.trim();
    const receiverPhone = addressPhone.trim() || phone.trim();

    if (
      !name.trim() ||
      !phone.trim() ||
      !email.trim() ||
      !gender ||
      !birthDay.trim() ||
      !birthMonth.trim() ||
      !birthYear.trim() ||
      !province.trim() ||
      !ward.trim() ||
      !streetName.trim() ||
      !password ||
      !confirmPassword
    ) {
      setGeneralError('Vui lòng nhập đầy đủ thông tin');
      return;
    }

    if (!vietnamPhoneRegex.test(phone.trim())) {
      setGeneralError('Số điện thoại không đúng định dạng Việt Nam');
      return;
    }

    if (!emailRegex.test(email.trim())) {
      setGeneralError('Email không đúng định dạng');
      return;
    }

    if (!dateOfBirth) {
      setGeneralError('Ngày sinh không hợp lệ hoặc độ tuổi không phù hợp');
      return;
    }

    if (!vietnamPhoneRegex.test(receiverPhone)) {
      setGeneralError('Số điện thoại nhận hàng không đúng định dạng');
      return;
    }

    if (streetName.trim().length < 5) {
      setGeneralError('Địa chỉ chi tiết tối thiểu 5 ký tự');
      return;
    }

    if (password.length < 8) {
      setGeneralError('Mật khẩu tối thiểu 8 ký tự');
      return;
    }

    if (password !== confirmPassword) {
      setGeneralError('Mật khẩu xác nhận không khớp');
      return;
    }

    if (!otpToken) {
      setGeneralError('Vui lòng xác thực số điện thoại bằng OTP');
      return;
    }

    if (!acceptedTerms) {
      setGeneralError('Vui lòng đồng ý với điều khoản sử dụng');
      return;
    }

    try {
      setLoading(true);
      await authApi.register({
        name: capitalizeWords(name.trim()),
        phone: phone.trim(),
        email: email.trim(),
        gender,
        dateOfBirth,
        address: {
          customerName: capitalizeWords(receiverName),
          province: province.trim(),
          district: 'Không áp dụng',
          ward: ward.trim(),
          streetName: streetName.trim(),
          phoneNumber: receiverPhone,
          isDefault: true,
        },
        password,
        confirmPassword,
        otpToken,
      });
      navigation.navigate('Login');
    } catch (error) {
      setGeneralError(error instanceof Error ? error.message : 'Đăng ký thất bại');
    } finally {
      setLoading(false);
    }
  };

  const renderSelectBox = (
    id: string,
    title: string,
    selectedValue: string,
    displayValue: string,
    placeholder: string,
    options: SelectOption[],
    onSelect: (selectedValue: string) => void | Promise<void>,
    disabled = false,
    compact = false,
    field?: RegisterField,
  ) => {
    const isOpen = activeSelect?.id === id;

    return (
      <View style={compact ? styles.dateSelectWrapper : undefined}>
        <TouchableOpacity
          style={[
            styles.selectInput,
            compact ? styles.dateSelectInput : undefined,
            disabled ? styles.disabledSelectInput : undefined,
          ]}
          onPress={() => !disabled && openSelect({ id, field, title, options, selectedValue, onSelect })}
          disabled={disabled}
        >
          <Text style={[styles.selectText, !displayValue && styles.placeholderText]}>
            {displayValue || placeholder}
          </Text>
          <Text style={styles.selectChevron}>⌄</Text>
        </TouchableOpacity>
        {isOpen ? (
          <View style={[styles.dropdownPanel, compact ? styles.compactDropdownPanel : undefined]}>
            <ScrollView nestedScrollEnabled style={styles.dropdownList}>
              {activeSelect.options.length > 0 ? (
                activeSelect.options.map((option) => {
                  const selected = option.value === activeSelect.selectedValue;

                  return (
                    <TouchableOpacity
                      key={option.value}
                      style={[styles.dropdownItem, selected && styles.selectedDropdownItem]}
                      onPress={() => {
                        void activeSelect.onSelect(option.value);
                        if (activeSelect.field) markTouched(activeSelect.field);
                        setActiveSelect(null);
                      }}
                    >
                      <Text style={[styles.dropdownItemText, selected && styles.selectedDropdownItemText]}>
                        {option.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })
              ) : (
                <View style={styles.dropdownEmptyItem}>
                  <Text style={styles.dropdownEmptyText}>Không có dữ liệu</Text>
                </View>
              )}
            </ScrollView>
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
    onSelect: (selectedValue: string) => void | Promise<void>,
    disabled = false,
    field?: RegisterField,
  ) => (
    <View style={styles.inputContainer}>
      <Text style={styles.label}>{label}</Text>
      {renderSelectBox(id, label, selectedValue, displayValue, placeholder, options, onSelect, disabled, false, field)}
      {field ? renderFeedback(field) : null}
    </View>
  );

  const resetToHome = () => {
    navigation.reset({
      index: 0,
      routes: [{ name: 'Home' }],
    });
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.topHeader}>
          <TouchableOpacity style={styles.headerBack} onPress={resetToHome}>
            <Text style={styles.headerBackIcon}>‹</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>ĐĂNG KÍ TÀI KHOẢN</Text>
          <View style={styles.headerSpacer} />
        </View>
        <ScrollView contentContainerStyle={styles.scrollContainer} keyboardShouldPersistTaps="handled">
        <View style={styles.form}>
          {generalError ? (
            <Text style={styles.errorBanner}>{generalError}</Text>
          ) : null}
          <Text style={styles.sectionTitle}>Thông tin tài khoản</Text>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Họ và tên</Text>
            {renderInput('name', name, handleNameChange, 'Nhập họ và tên', { autoCapitalize: 'words' })}
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Số điện thoại chính</Text>
            {renderInput('phone', phone, handlePhoneChange, 'Nhập số điện thoại', { keyboardType: 'phone-pad' })}
          </View>

          <TouchableOpacity
            style={[styles.outlineButton, otpLoading && styles.disabledOutlineButton]}
            onPress={handleSendOtp}
            disabled={otpLoading || loading}
          >
            <Text style={styles.outlineButtonText}>{otpLoading ? 'Đang gửi OTP...' : 'Gửi mã OTP qua SMS'}</Text>
          </TouchableOpacity>

          <View style={styles.otpContainer}>
            <Text style={styles.label}>Mã OTP</Text>
            <View style={styles.otpRow}>
              {renderInput('otp', otp, setOtp, 'Nhập mã OTP', { keyboardType: 'numeric' })}
              <TouchableOpacity
                style={[styles.verifyButton, otpVerifying && styles.disabledButton]}
                onPress={handleVerifyOtp}
                disabled={otpVerifying || loading}
              >
                <Text style={styles.verifyButtonText}>{otpVerifying ? 'Đang...' : 'Xác thực'}</Text>
              </TouchableOpacity>
            </View>
            {otpToken ? <Text style={styles.verifiedText}>Số điện thoại đã xác thực</Text> : null}
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Email</Text>
            {renderInput('email', email, setEmail, 'Nhập email', { keyboardType: 'email-address' })}
          </View>

          <Text style={styles.sectionTitle}>Thông tin cá nhân</Text>

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
          )}

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Ngày sinh</Text>
            <View style={styles.dateRow}>
              {renderSelectBox(
                'birthDay',
                'Ngày',
                birthDay,
                birthDay,
                'Ngày',
                dayOptions,
                setBirthDay,
                false,
                true,
                'birthDay',
              )}
              {renderSelectBox(
                'birthMonth',
                'Tháng',
                birthMonth,
                birthMonth,
                'Tháng',
                monthOptions,
                handleMonthSelect,
                false,
                true,
                'birthMonth',
              )}
              {renderSelectBox(
                'birthYear',
                'Năm',
                birthYear,
                birthYear,
                'Năm',
                yearOptions,
                handleYearSelect,
                false,
                true,
                'birthYear',
              )}
            </View>
            {renderFeedback('birthYear')}
          </View>

          <Text style={styles.sectionTitle}>Địa chỉ nhận hàng</Text>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Tên người nhận</Text>
            {renderInput('customerName', customerName, handleCustomerNameChange, 'Mặc định theo họ tên', { autoCapitalize: 'words', noFeedback: true })}
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Số điện thoại nhận hàng</Text>
            {renderInput('addressPhone', addressPhone, setAddressPhone, 'Bỏ trống nếu giống số chính', { keyboardType: 'phone-pad', noFeedback: true })}
          </View>

          {renderSelectField(
            'province',
            'Tỉnh/Thành phố',
            provinceCode,
            province,
            provinceLoading ? 'Đang tải tỉnh/thành phố...' : 'Chọn tỉnh/thành phố',
            provinceOptions,
            handleProvinceSelect,
            provinceLoading || !!locationError,
            'province',
          )}

          {renderSelectField(
            'ward',
            'Phường/Xã',
            wardCode,
            ward,
            wardLoading ? 'Đang tải phường/xã...' : province ? 'Chọn phường/xã' : 'Chọn tỉnh/thành phố trước',
            wardOptions,
            handleWardSelect,
            !provinceCode || wardLoading,
            'ward',
          )}

          {locationError ? (
            <View style={styles.fieldErrorRow}>
              <Text style={styles.fieldErrorText}>{locationError}</Text>
              <TouchableOpacity onPress={loadProvinces} disabled={provinceLoading}>
                <Text style={styles.retryText}>{provinceLoading ? 'Đang tải...' : 'Thử lại'}</Text>
              </TouchableOpacity>
            </View>
          ) : null}

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Số nhà, tên đường</Text>
            {renderInput('streetName', streetName, setStreetName, 'Nhập địa chỉ chi tiết', { autoCapitalize: 'sentences' })}
          </View>

          <Text style={styles.sectionTitle}>Bảo mật</Text>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Mật khẩu</Text>
            {renderInput('password', password, setPassword, 'Nhập mật khẩu', {
              secureTextEntry: !showPassword,
              rightAccessory: (
                <TouchableOpacity onPress={() => setShowPassword((v) => !v)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <MaterialCommunityIcons name={showPassword ? 'eye-off' : 'eye'} size={20} color="#9aa3b2" />
                </TouchableOpacity>
              ),
            })}
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Xác nhận mật khẩu</Text>
            {renderInput('confirmPassword', confirmPassword, setConfirmPassword, 'Nhập lại mật khẩu', {
              secureTextEntry: !showConfirm,
              rightAccessory: (
                <TouchableOpacity onPress={() => setShowConfirm((v) => !v)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <MaterialCommunityIcons name={showConfirm ? 'eye-off' : 'eye'} size={20} color="#9aa3b2" />
                </TouchableOpacity>
              ),
            })}
          </View>

          <View style={styles.termsContainer}>
            <TouchableOpacity
              style={styles.checkbox}
              onPress={() => setAcceptedTerms(!acceptedTerms)}
            >
              <View style={[styles.checkboxBox, acceptedTerms && styles.checkedBox]}>
                {acceptedTerms && <Text style={styles.checkmark}>✓</Text>}
              </View>
            </TouchableOpacity>
            <Text style={styles.termsText}>
              Tôi đồng ý với <Text style={styles.termsLink}>Điều khoản sử dụng</Text> và{' '}
              <Text style={styles.termsLink}>Chính sách bảo mật</Text>
            </Text>
          </View>

          <TouchableOpacity
            style={[styles.registerButton, loading && styles.disabledButton]}
            onPress={handleRegister}
            disabled={loading}
          >
            <Text style={styles.registerButtonText}>
              {loading ? 'Đang đăng ký...' : 'Đăng ký'}
            </Text>
          </TouchableOpacity>

          <View style={styles.loginContainer}>
            <Text style={styles.loginText}>Đã có tài khoản?</Text>
            <TouchableOpacity onPress={() => navigation.navigate('Login')}>
              <Text style={styles.loginLink}> Đăng nhập ngay</Text>
            </TouchableOpacity>
          </View>
        </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  flex: sharedStyles.flex,
  container: sharedStyles.authContainer,
  scrollContainer: sharedStyles.authScrollContent,
  topHeader: sharedStyles.authTopHeader,
  headerBack: sharedStyles.authHeaderBack,
  headerBackIcon: sharedStyles.authHeaderBackIcon,
  headerTitle: sharedStyles.authHeaderTitle,
  headerSpacer: sharedStyles.authHeaderSpacer,
  form: {
    width: '100%',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 14,
    marginTop: 6,
  },
  inputContainer: {
    marginBottom: 20,
  },
  label: sharedStyles.formLabel,
  input: sharedStyles.textInput,
  feedbackError: {
    color: colors.danger,
    fontSize: 12,
    lineHeight: 16,
    marginTop: 4,
    textAlign: 'right',
  },
  inputWrapper: {
    position: 'relative',
  },
  inputCheck: {
    position: 'absolute',
    right: 12,
    top: 14,
  },
  inputValid: {
    borderColor: colors.success,
    paddingRight: 40,
  },
  inputWithRight: {
    paddingRight: 72,
  },
  rightAccessory: {
    position: 'absolute',
    right: 12,
    top: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  selectInput: {
    minHeight: 52,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.field,
  },
  disabledSelectInput: {
    backgroundColor: '#F1F1F1',
    borderColor: '#e2e2e2',
  },
  selectText: {
    flex: 1,
    color: colors.textBody,
    fontSize: 16,
  },
  placeholderText: {
    color: colors.textSubtle,
  },
  selectChevron: {
    color: '#666',
    fontSize: 18,
    marginLeft: 8,
  },
  dropdownPanel: {
    marginTop: 6,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  compactDropdownPanel: {
    maxHeight: 180,
  },
  dropdownList: {
    maxHeight: 220,
  },
  dropdownItem: {
    paddingHorizontal: 14,
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  selectedDropdownItem: {
    backgroundColor: '#eaf3ff',
  },
  dropdownItemText: {
    color: '#222',
    fontSize: 15,
  },
  selectedDropdownItemText: {
    color: colors.action,
    fontWeight: '700',
  },
  dropdownEmptyItem: {
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  dropdownEmptyText: {
    color: '#777',
    fontSize: 15,
  },
  outlineButton: {
    borderWidth: 1,
    borderColor: colors.action,
    borderRadius: 8,
    padding: 15,
    alignItems: 'center',
    marginBottom: 20,
    backgroundColor: colors.surface,
  },
  disabledOutlineButton: {
    borderColor: colors.disabled,
  },
  outlineButtonText: {
    color: colors.action,
    fontSize: 16,
    fontWeight: '700',
  },
  otpContainer: {
    marginBottom: 20,
  },
  otpRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  otpInput: {
    flex: 1,
  },
  verifyButton: {
    minWidth: 104,
    marginLeft: 10,
    backgroundColor: colors.action,
    paddingVertical: 15,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  verifyButtonText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '700',
  },
  verifiedText: {
    marginTop: 8,
    color: colors.success,
    fontSize: 14,
    fontWeight: '600',
  },
  dateRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
  },
  dateSelectWrapper: {
    flex: 1,
  },
  dateSelectInput: {
    paddingHorizontal: 10,
  },
  fieldErrorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: -8,
    marginBottom: 18,
    gap: 12,
  },
  fieldErrorText: {
    flex: 1,
    color: colors.danger,
    fontSize: 14,
  },
  retryText: {
    color: colors.action,
    fontSize: 14,
    fontWeight: '700',
  },
  termsContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  checkbox: {
    marginRight: 10,
  },
  checkboxBox: {
    width: 20,
    height: 20,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.field,
  },
  checkedBox: {
    backgroundColor: colors.action,
    borderColor: colors.action,
  },
  checkmark: {
    color: colors.white,
    fontSize: 14,
    fontWeight: 'bold',
  },
  termsText: {
    flex: 1,
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  termsLink: {
    color: colors.action,
    textDecorationLine: 'underline',
  },
  registerButton: {
    backgroundColor: colors.action,
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 20,
  },
  disabledButton: sharedStyles.disabledButton,
  registerButtonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: 'bold',
  },
  loginContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loginText: {
    fontSize: 16,
    color: '#666',
  },
  loginLink: {
    fontSize: 16,
    color: colors.action,
    fontWeight: 'bold',
  },
  errorBanner: sharedStyles.errorBanner,
});

export default RegisterScreen;
