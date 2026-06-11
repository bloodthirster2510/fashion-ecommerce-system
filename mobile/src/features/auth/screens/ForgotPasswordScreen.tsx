import React, { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  LayoutAnimation,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import type { RootStackParamList } from '../../../navigation/AppNavigator';
import { authApi } from '../authApi';
import { colors, sharedStyles } from '../../../theme';

type AuthNavigationProp = StackNavigationProp<RootStackParamList>;
type ForgotField = 'identifier' | 'resetToken' | 'otp' | 'newPassword' | 'confirmPassword';
type RecoveryMethod = 'email' | 'phone';

const vietnamPhoneRegex = /^(0|\+84)(3|5|7|8|9)[0-9]{8}$/;
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const getRecoveryMessage = (method: RecoveryMethod) =>
  method === 'phone' ? 'Mã OTP đã được gửi qua SMS.' : 'Token khôi phục đã được gửi qua email.';

const ForgotPasswordScreen = () => {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [method, setMethod] = useState<RecoveryMethod | null>(null);
  const [identifier, setIdentifier] = useState('');
  const [otp, setOtp] = useState('');
  const [otpToken, setOtpToken] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [generalError, setGeneralError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [focusedField, setFocusedField] = useState<ForgotField | null>(null);

  React.useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    if (countdown > 0) {
      timer = setTimeout(() => setCountdown(countdown - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [countdown]);

  const [touched, setTouched] = useState<Record<ForgotField, boolean>>({
    identifier: false,
    resetToken: false,
    otp: false,
    newPassword: false,
    confirmPassword: false,
  });

  const navigation = useNavigation<AuthNavigationProp>();

  const markTouched = (field: ForgotField) => {
    setTouched((current) => ({ ...current, [field]: true }));
  };

  const clearMessages = () => {
    setGeneralError('');
    setSuccessMessage('');
  };

  const getIdentifierError = () => {
    const value = identifier.trim();
    if (!value) return 'Vui lòng nhập email hoặc số điện thoại';

    const isEmail = value.includes('@');
    const isValid = isEmail ? emailRegex.test(value) : vietnamPhoneRegex.test(value);

    if (!isValid) return 'Email hoặc số điện thoại không đúng định dạng';
    return '';
  };

  const getFieldError = (field: ForgotField) => {
    switch (field) {
      case 'identifier':
        return getIdentifierError();
      case 'otp':
        if (!otp.trim()) return 'Vui lòng nhập mã OTP';
        return otp.trim().length >= 4 ? '' : 'Mã OTP không hợp lệ';
      case 'resetToken':
        return resetToken.trim() ? '' : 'Vui lòng nhập token khôi phục';
      case 'newPassword':
        if (!newPassword) return 'Vui lòng nhập mật khẩu mới';
        return newPassword.length >= 8 ? '' : 'Mật khẩu mới tối thiểu 8 ký tự';
      case 'confirmPassword':
        if (!confirmPassword) return 'Vui lòng nhập lại mật khẩu mới';
        return newPassword === confirmPassword ? '' : 'Xác nhận mật khẩu không khớp';
      default:
        return '';
    }
  };

  const isFieldValid = (field: ForgotField) => {
    if (!submitted && !touched[field]) return false;

    const value = (() => {
      switch (field) {
        case 'identifier':
          return identifier;
        case 'otp':
          return otp;
        case 'resetToken':
          return resetToken;
        case 'newPassword':
          return newPassword;
        case 'confirmPassword':
          return confirmPassword;
        default:
          return '';
      }
    })();

    return !getFieldError(field) && value.trim().length > 0;
  };

  const renderFeedback = (field: ForgotField) => {
    const error = getFieldError(field);
    if (!(submitted || touched[field]) || !error) return null;

    return (
      <Text style={styles.feedbackError} numberOfLines={1}>
        {error.replace(/!/g, '')}
      </Text>
    );
  };

  const renderInput = (
    field: ForgotField,
    value: string,
    onChangeText: (text: string) => void,
    placeholder: string,
    options: {
      keyboardType?: 'default' | 'email-address' | 'numeric';
      autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
      secureTextEntry?: boolean;
    } = {},
  ) => {
    const error = getFieldError(field);
    const valid = isFieldValid(field);
    const showError = (submitted || touched[field]) && !!error;
    const isFocused = focusedField === field;

    return (
      <View style={styles.inputOuterContainer}>
        <View style={styles.inputWrapper}>
          <TextInput
            style={[
              styles.input,
              valid && styles.inputValid,
              isFocused && styles.inputFocused,
              showError && styles.inputError,
            ]}
            value={value}
            onChangeText={(text) => {
              onChangeText(text);
              if (generalError || successMessage) clearMessages();
            }}
            placeholder={placeholder}
            placeholderTextColor={colors.textSubtle}
            keyboardType={options.keyboardType ?? 'default'}
            autoCapitalize={options.autoCapitalize ?? 'none'}
            secureTextEntry={options.secureTextEntry}
            onFocus={() => {
              LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
              setFocusedField(field);
            }}
            onBlur={() => {
              LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
              setFocusedField(null);
              markTouched(field);
            }}
          />
          {valid && !isFocused ? (
            <MaterialCommunityIcons name="check-circle" size={20} color={colors.success} style={styles.inputCheck} />
          ) : null}
        </View>
        {renderFeedback(field)}
      </View>
    );
  };

  const requestRecoveryCode = async (isResend = false) => {
    setSubmitted(true);
    markTouched('identifier');

    const identifierError = getIdentifierError();
    if (identifierError) {
      clearMessages();
      return;
    }

    const value = identifier.trim();
    const setBusy = isResend ? setResending : setLoading;

    try {
      setBusy(true);
      setGeneralError('');
      const result = await authApi.forgotPassword(value);
      
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setMethod(result.method);
      setStep(2);
      setOtp('');
      setOtpToken('');
      setResetToken('');
      setTouched((current) => ({ ...current, otp: false, resetToken: false }));
      setSubmitted(false);
      setSuccessMessage(isResend ? `Đã gửi lại. ${getRecoveryMessage(result.method)}` : getRecoveryMessage(result.method));
      setCountdown(60);
    } catch (error) {
      setSuccessMessage('');
      setGeneralError(error instanceof Error ? error.message.replace(/!/g, '') : 'Không thể gửi mã khôi phục');
    } finally {
      setBusy(false);
    }
  };

  const handleVerifyOtp = async () => {
    setSubmitted(true);
    markTouched('otp');

    if (getFieldError('otp')) {
      setGeneralError('');
      return;
    }

    try {
      setVerifying(true);
      clearMessages();
      const result = await authApi.verifyOtp(identifier.trim(), otp.trim());
      
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setOtpToken(result.otpToken);
      setStep(3);
      setSubmitted(false);
      setSuccessMessage('OTP đã xác thực. Tạo mật khẩu mới để hoàn tất.');
    } catch (error) {
      setOtpToken('');
      setSuccessMessage('');
      setGeneralError(error instanceof Error ? error.message.replace(/!/g, '') : 'Không thể xác thực OTP');
    } finally {
      setVerifying(false);
    }
  };

  const handleResetPassword = async () => {
    setSubmitted(true);
    if (method === 'email') markTouched('resetToken');
    markTouched('newPassword');
    markTouched('confirmPassword');

    const tokenError = method === 'email' ? getFieldError('resetToken') : '';
    if (tokenError || getFieldError('newPassword') || getFieldError('confirmPassword')) {
      setGeneralError('');
      return;
    }

    const finalToken = method === 'email' ? resetToken.trim() : otpToken;

    try {
      setResetting(true);
      clearMessages();
      await authApi.resetPassword(identifier.trim(), finalToken, newPassword, confirmPassword);
      Alert.alert('Thành công', 'Đặt lại mật khẩu thành công', [
        {
          text: 'Đăng nhập ngay',
          onPress: () => navigation.navigate('Login'),
        },
      ]);
    } catch (error) {
      setSuccessMessage('');
      setGeneralError(error instanceof Error ? error.message.replace(/!/g, '') : 'Không thể đặt lại mật khẩu');
    } finally {
      setResetting(false);
    }
  };

  const backToIdentifier = () => {
    setStep(1);
    setSubmitted(false);
    clearMessages();
  };

  const backToCodeStep = () => {
    setStep(2);
    setSubmitted(false);
    clearMessages();
  };

  const resetToHome = () => {
    navigation.reset({
      index: 0,
      routes: [{ name: 'Home' }],
    });
  };

  const renderResendButton = () => {
    const isCounting = countdown > 0;
    const disabled = resending || loading || verifying || resetting || isCounting;
    
    return (
      <TouchableOpacity
        style={[styles.resendButton, disabled && styles.disabledOutlineButton]}
        onPress={() => requestRecoveryCode(true)}
        disabled={disabled}
      >
        <Text style={styles.resendButtonText}>
          {resending 
            ? 'Đang gửi lại...' 
            : isCounting
              ? `Gửi lại sau ${countdown}s`
              : method === 'phone' ? 'Gửi lại OTP' : 'Gửi lại token'}
        </Text>
      </TouchableOpacity>
    );
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
          <Text style={styles.headerTitle}>KHÔI PHỤC MẬT KHẨU</Text>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView contentContainerStyle={styles.scrollContainer} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <Text style={styles.title}>Quên mật khẩu</Text>
            <Text style={styles.subtitle}>
              {step === 1 && 'Nhập email hoặc số điện thoại để nhận mã khôi phục'}
              {step === 2 && method === 'phone' && `Nhập mã OTP đã gửi đến ${identifier.trim()}`}
              {step === 2 && method === 'email' && `Nhập token khôi phục đã gửi đến ${identifier.trim()}`}
              {step === 3 && 'Tạo mật khẩu mới cho tài khoản của bạn'}
            </Text>
          </View>

          <View style={styles.form}>
            {generalError ? <Text style={styles.errorBanner}>{generalError.replace(/!/g, '')}</Text> : null}
            {successMessage ? <Text style={styles.successBanner}>{successMessage}</Text> : null}

            {step === 1 && (
              <View>
                <View style={styles.inputContainer}>
                  <Text style={styles.label}>Số điện thoại hoặc Email</Text>
                  {renderInput('identifier', identifier, setIdentifier, 'Nhập số điện thoại hoặc email')}
                </View>

                <TouchableOpacity
                  style={[styles.primaryButton, loading && styles.disabledButton]}
                  onPress={() => requestRecoveryCode(false)}
                  disabled={loading}
                >
                  <Text style={styles.primaryButtonText}>
                    {loading ? 'Đang gửi...' : 'Gửi mã khôi phục'}
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            {step === 2 && method === 'phone' && (
              <View>
                <View style={styles.inputContainer}>
                  <Text style={styles.label}>Mã OTP</Text>
                  {renderInput('otp', otp, setOtp, 'Nhập mã OTP', { keyboardType: 'numeric' })}
                </View>

                <TouchableOpacity
                  style={[styles.primaryButton, verifying && styles.disabledButton]}
                  onPress={handleVerifyOtp}
                  disabled={verifying}
                >
                  <Text style={styles.primaryButtonText}>
                    {verifying ? 'Đang xác thực...' : 'Xác thực OTP'}
                  </Text>
                </TouchableOpacity>

                {renderResendButton()}

                <TouchableOpacity onPress={backToIdentifier} style={styles.backStepContainer}>
                  <Text style={styles.backStepText}>Đổi số điện thoại hoặc email</Text>
                </TouchableOpacity>
              </View>
            )}

            {((step === 2 && method === 'email') || step === 3) && (
              <View style={styles.resetForm}>
                {method === 'email' && (
                  <>
                    <View style={styles.inputContainer}>
                      <Text style={styles.label}>Token khôi phục</Text>
                      {renderInput('resetToken', resetToken, setResetToken, 'Nhập token từ email của bạn')}
                    </View>
                    {step === 2 ? renderResendButton() : null}
                  </>
                )}

                {(step === 3 || method === 'email') && (
                  <>
                    <View style={styles.inputContainer}>
                      <Text style={styles.label}>Mật khẩu mới</Text>
                      {renderInput('newPassword', newPassword, setNewPassword, 'Nhập mật khẩu mới', {
                        secureTextEntry: true,
                      })}
                    </View>

                    <View style={styles.inputContainer}>
                      <Text style={styles.label}>Xác nhận mật khẩu mới</Text>
                      {renderInput('confirmPassword', confirmPassword, setConfirmPassword, 'Nhập lại mật khẩu mới', {
                        secureTextEntry: true,
                      })}
                    </View>
                  </>
                )}

                <TouchableOpacity
                  style={[styles.primaryButton, resetting && styles.disabledButton]}
                  onPress={handleResetPassword}
                  disabled={resetting}
                >
                  <Text style={styles.primaryButtonText}>
                    {resetting ? 'Đang đặt lại...' : 'Đặt lại mật khẩu'}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity onPress={method === 'email' ? backToIdentifier : backToCodeStep} style={styles.backStepContainer}>
                  <Text style={styles.backStepText}>Quay lại</Text>
                </TouchableOpacity>
              </View>
            )}

            <View style={styles.loginContainer}>
              <Text style={styles.loginText}>Nhớ mật khẩu?</Text>
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
  header: {
    alignItems: 'center',
    marginBottom: 40,
    marginTop: 40,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.textBody,
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 15,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: 10,
  },
  form: {
    width: '100%',
  },
  resetForm: {
    marginBottom: 0,
  },
  inputContainer: {
    marginBottom: 24,
  },
  label: sharedStyles.formLabel,
  inputWrapper: {
    position: 'relative',
  },
  input: sharedStyles.textInput,
  inputOuterContainer: {
    marginBottom: 4,
  },
  inputValid: {
    borderColor: colors.success,
    paddingRight: 40,
  },
  inputFocused: {
    borderColor: colors.action,
    borderWidth: 1.5,
  },
  inputError: {
    borderColor: colors.danger,
    borderWidth: 1.5,
  },
  inputCheck: {
    position: 'absolute',
    right: 12,
    top: 14,
  },
  feedbackError: {
    color: colors.danger,
    fontSize: 12,
    lineHeight: 16,
    marginTop: 4,
    textAlign: 'right',
    paddingRight: 4,
  },
  primaryButton: {
    backgroundColor: colors.action,
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 16,
  },
  disabledButton: sharedStyles.disabledButton,
  primaryButtonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: 'bold',
  },
  resendButton: {
    borderWidth: 1,
    borderColor: colors.action,
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
    marginBottom: 16,
    backgroundColor: colors.surface,
  },
  disabledOutlineButton: {
    borderColor: colors.disabled,
    opacity: 0.7,
  },
  resendButtonText: {
    color: colors.action,
    fontSize: 15,
    fontWeight: '700',
  },
  backStepContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  backStepText: {
    color: colors.textMuted,
    fontSize: 14,
    textDecorationLine: 'underline',
  },
  loginContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
  },
  loginText: {
    fontSize: 16,
    color: colors.textMuted,
  },
  loginLink: {
    fontSize: 16,
    color: colors.action,
    fontWeight: 'bold',
  },
  errorBanner: sharedStyles.errorBanner,
  successBanner: {
    backgroundColor: '#E7F5EE',
    color: colors.success,
    fontSize: 14,
    lineHeight: 20,
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    textAlign: 'center',
  },
});

export default ForgotPasswordScreen;
