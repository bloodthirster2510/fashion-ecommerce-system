import React, { useCallback, useState } from 'react';
import {
  BackHandler,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import type { RootStackParamList } from '../../../navigation/AppNavigator';
import { useAuth } from '../AuthContext';
import { authApi, AuthApiError, type AuthSession } from '../authApi';
import { colors, sharedStyles } from '../../../theme';
import ShopNameLogo from '../../../components/branding/ShopNameLogo';

type AuthNavigationProp = StackNavigationProp<RootStackParamList>;

const vietnamPhoneRegex = /^(0|\+84)(3|5|7|8|9)[0-9]{8}$/;
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const LoginScreen = () => {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isLoginLocked, setIsLoginLocked] = useState(false);
  const [unlockCode, setUnlockCode] = useState('');
  const [unlockMethod, setUnlockMethod] = useState<'email' | 'phone'>('email');
  const [unlockMessage, setUnlockMessage] = useState('');
  const [unlockRequested, setUnlockRequested] = useState(false);
  const [unlockLoading, setUnlockLoading] = useState(false);
  const navigation = useNavigation<AuthNavigationProp>();
  const { login } = useAuth();
  const resetToHome = useCallback(() => {
    navigation.reset({
      index: 0,
      routes: [{ name: 'Home' }],
    });
  }, [navigation]);
  const completeLogin = useCallback(async (session: AuthSession) => {
    await login(session);
    if (session.user.mustChangePassword) {
      return;
    }
    navigation.reset({
      index: 0,
      routes: [{ name: session.user.profileCompleted === false ? 'EditProfile' : 'Home' }],
    });
  }, [login, navigation]);

  useFocusEffect(
    useCallback(() => {
      const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
        resetToHome();
        return true;
      });

      return () => subscription.remove();
    }, [resetToHome])
  );
  const handleLogin = async () => {
    const trimmedIdentifier = identifier.trim();
    if (!trimmedIdentifier || !password) {
      setErrorMessage('Vui lòng nhập đầy đủ thông tin');
      return;
    }
    setErrorMessage('');
    try {
      setLoading(true);
      const result = await authApi.login(trimmedIdentifier, password);
      await completeLogin(result);
    } catch (error) {
      if (error instanceof AuthApiError && error.errorCode === 'LOGIN_TEMPORARILY_LOCKED') {
        setIsLoginLocked(true);
        setUnlockRequested(false);
        setUnlockCode('');
        setUnlockMessage('');
      }
      setErrorMessage(error instanceof Error ? error.message : 'Đăng nhập thất bại');
    } finally {
      setLoading(false);
    }
  };

  const handleIdentifierChange = (value: string) => {
    setIdentifier(value);
    if (isLoginLocked) {
      setIsLoginLocked(false);
      setUnlockRequested(false);
      setUnlockCode('');
      setUnlockMessage('');
      setErrorMessage('');
    }
  };

  const handleRequestUnlock = async (channel: 'email' | 'phone') => {
    const trimmedIdentifier = identifier.trim();
    if (!emailRegex.test(trimmedIdentifier) && !vietnamPhoneRegex.test(trimmedIdentifier)) {
      setUnlockMessage('Email hoặc số điện thoại không hợp lệ.');
      return;
    }

    try {
      setUnlockLoading(true);
      setUnlockMessage('');
      const result = await authApi.requestLoginUnlock(trimmedIdentifier, channel);
      setUnlockMethod(result.method);
      setUnlockRequested(true);
      if (result.delivery.mode === 'mock' && result.delivery.testOtp) {
        setUnlockCode(result.delivery.testOtp);
        setUnlockMessage(`Mã OTP thử nghiệm: ${result.delivery.testOtp}`);
      } else {
        setUnlockMessage(result.method === 'email'
          ? 'Mã OTP đã được gửi tới email của bạn.'
          : 'Mã OTP đã được gửi tới số điện thoại của bạn.');
      }
    } catch (error) {
      setUnlockMessage(error instanceof Error ? error.message : 'Chưa thể gửi mã OTP.');
    } finally {
      setUnlockLoading(false);
    }
  };

  const handleVerifyUnlock = async () => {
    if (!/^\d{6}$/.test(unlockCode.trim())) {
      setUnlockMessage('Vui lòng nhập đủ 6 chữ số OTP.');
      return;
    }

    try {
      setUnlockLoading(true);
      setUnlockMessage('');
      await authApi.verifyLoginUnlock(identifier.trim(), unlockCode.trim());
      setIsLoginLocked(false);
      setUnlockRequested(false);
      setUnlockCode('');
      setErrorMessage('');
      setUnlockMessage('Đã mở khóa. Bạn có thể đăng nhập lại.');
    } catch (error) {
      setUnlockMessage(error instanceof Error ? error.message : 'Không thể xác thực mã OTP.');
    } finally {
      setUnlockLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.header}>
          <TouchableOpacity style={styles.headerBack} onPress={resetToHome}>
            <Text style={styles.headerBackIcon}>‹</Text>
          </TouchableOpacity>
          <View style={styles.headerTitle}>
            <ShopNameLogo />
          </View>
          <View style={styles.headerSpacer} />
        </View>
        <ScrollView
          contentContainerStyle={styles.scrollContainer}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.heading}>
            <Text style={styles.title}>ĐĂNG NHẬP TÀI KHOẢN</Text>
          </View>

          <View style={styles.form}>
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Số điện thoại hoặc Email</Text>
              <TextInput
                style={styles.input}
                value={identifier}
                onChangeText={handleIdentifierChange}
                placeholder="Nhập số điện thoại hoặc email"
                placeholderTextColor={colors.textSubtle}
                selectionColor={colors.brand}
                keyboardType="default"
                autoCapitalize="none"
              />
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>Mật khẩu</Text>
              <View style={styles.inputWrapper}>
                <TextInput
                  style={[styles.input, styles.passwordInput]}
                  value={password}
                  onChangeText={setPassword}
                  placeholder="Nhập mật khẩu"
                  placeholderTextColor={colors.textSubtle}
                  selectionColor={colors.brand}
                  secureTextEntry={!showPassword}
                />
                <TouchableOpacity
                  onPress={() => setShowPassword(!showPassword)}
                  style={styles.eyeButton}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <MaterialCommunityIcons
                    name={showPassword ? 'eye-off' : 'eye'}
                    size={20}
                    color="#9aa3b2"
                  />
                </TouchableOpacity>
              </View>
          </View>

          {errorMessage ? (
            <Text style={styles.errorBanner}>{errorMessage}</Text>
          ) : null}

          {isLoginLocked ? (
            <View style={styles.unlockCard}>
              <View style={styles.unlockHeading}>
                <MaterialCommunityIcons name="shield-lock-outline" size={22} color={colors.brandDark} />
                <Text style={styles.unlockTitle}>Mở khóa đăng nhập</Text>
              </View>
              <Text style={styles.unlockDescription}>
                Chọn email hoặc SMS đã đăng ký để nhận mã mở khóa.
              </Text>

              {unlockRequested ? (
                <>
                  <TextInput
                    style={[styles.input, styles.unlockInput]}
                    value={unlockCode}
                    onChangeText={(value) => setUnlockCode(value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="Nhập mã OTP 6 số"
                    placeholderTextColor={colors.textSubtle}
                    selectionColor={colors.brand}
                    keyboardType="number-pad"
                    maxLength={6}
                    textContentType="oneTimeCode"
                  />
                  <TouchableOpacity
                    style={[styles.unlockPrimaryButton, unlockLoading && styles.disabledButton]}
                    onPress={handleVerifyUnlock}
                    disabled={unlockLoading}
                  >
                    {unlockLoading ? (
                      <ActivityIndicator size="small" color={colors.white} />
                    ) : (
                      <Text style={styles.unlockPrimaryText}>Xác nhận mở khóa</Text>
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => handleRequestUnlock(unlockMethod)} disabled={unlockLoading}>
                    <Text style={styles.unlockResendText}>
                      Gửi lại qua {unlockMethod === 'email' ? 'email' : 'SMS'}
                    </Text>
                  </TouchableOpacity>
                </>
              ) : (
                <View style={styles.unlockChannelRow}>
                  <TouchableOpacity
                    style={[styles.unlockChannelButton, unlockLoading && styles.disabledButton]}
                    onPress={() => handleRequestUnlock('email')}
                    disabled={unlockLoading}
                  >
                    <MaterialCommunityIcons name="email-outline" size={18} color={colors.brandDark} />
                    <Text style={styles.unlockChannelText}>Email</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.unlockChannelButton, unlockLoading && styles.disabledButton]}
                    onPress={() => handleRequestUnlock('phone')}
                    disabled={unlockLoading}
                  >
                    <MaterialCommunityIcons name="message-text-outline" size={18} color={colors.brandDark} />
                    <Text style={styles.unlockChannelText}>SMS</Text>
                  </TouchableOpacity>
                  {unlockLoading ? <ActivityIndicator size="small" color={colors.brandDark} /> : null}
                </View>
              )}
              {unlockMessage ? <Text style={styles.unlockMessage}>{unlockMessage}</Text> : null}
            </View>
          ) : unlockMessage ? (
            <Text style={styles.unlockSuccess}>{unlockMessage}</Text>
          ) : null}

          <TouchableOpacity
            style={styles.forgotPasswordButton}
              onPress={() => navigation.navigate('ForgotPassword')}
            >
              <Text style={styles.forgotPasswordText}>Quên mật khẩu?</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.loginButton, (loading || isLoginLocked) && styles.disabledButton]}
              onPress={handleLogin}
              disabled={loading || isLoginLocked}
            >
              <Text style={styles.loginButtonText}>
                {loading ? 'Đang đăng nhập...' : 'Đăng nhập'}
              </Text>
            </TouchableOpacity>

            <View style={styles.registerContainer}>
              <Text style={styles.registerText}>Chưa có tài khoản?</Text>
              <TouchableOpacity onPress={() => navigation.navigate('Register')}>
                <Text style={styles.registerLink}> Đăng ký ngay</Text>
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
  header: {
    ...sharedStyles.authTopHeader,
    height: 72,
  },
  headerBack: sharedStyles.authHeaderBack,
  headerBackIcon: sharedStyles.authHeaderBackIcon,
  headerTitle: {
    flex: 1,
    alignItems: 'center',
  },
  headerSpacer: sharedStyles.authHeaderSpacer,
  heading: {
    marginBottom: 24,
    marginTop: 24,
    alignItems: 'center',
  },
  title: {
    fontWeight: '700',
    fontSize: 20,
    lineHeight: 28,
    textAlign: 'center',
    color: colors.textBody,
  },
  form: {
    width: '100%',
  },
  inputContainer: {
    marginBottom: 20,
  },
  label: sharedStyles.formLabel,
  input: sharedStyles.textInput,
  inputWrapper: {
    position: 'relative',
  },
  passwordInput: {
    paddingRight: 50,
  },
  eyeButton: {
    position: 'absolute',
    right: 12,
    top: 15,
  },
  forgotPasswordButton: {
    alignSelf: 'flex-end',
    marginBottom: 20,
  },
  forgotPasswordText: {
    color: colors.action,
    fontSize: 14,
  },
  loginButton: {
    backgroundColor: colors.black,
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 20,
  },
  disabledButton: sharedStyles.disabledButton,
  loginButtonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: 'bold',
  },
  unlockCard: {
    marginBottom: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.brandPale,
    borderRadius: 10,
    backgroundColor: colors.brandSoft,
  },
  unlockHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  unlockTitle: {
    color: colors.brandDark,
    fontSize: 15,
    fontWeight: '800',
  },
  unlockDescription: {
    marginBottom: 12,
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 19,
  },
  unlockInput: {
    marginBottom: 10,
    backgroundColor: colors.white,
    textAlign: 'center',
    letterSpacing: 5,
    fontSize: 18,
    fontWeight: '700',
  },
  unlockPrimaryButton: {
    minHeight: 42,
    borderRadius: 8,
    backgroundColor: colors.brandDark,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  unlockChannelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  unlockChannelButton: {
    flex: 1,
    minHeight: 42,
    borderWidth: 1,
    borderColor: colors.brandPale,
    borderRadius: 8,
    backgroundColor: colors.white,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  unlockChannelText: {
    color: colors.brandDark,
    fontSize: 13,
    fontWeight: '800',
  },
  unlockPrimaryText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '800',
  },
  unlockResendText: {
    marginTop: 11,
    color: colors.action,
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
  },
  unlockMessage: {
    marginTop: 10,
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 17,
    textAlign: 'center',
  },
  unlockSuccess: {
    marginBottom: 16,
    padding: 12,
    borderRadius: 8,
    backgroundColor: colors.successSoft,
    color: colors.success,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '700',
    textAlign: 'center',
  },
  registerContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  registerText: {
    fontSize: 16,
    color: colors.textMuted,
  },
  registerLink: {
    fontSize: 16,
    color: colors.action,
    fontWeight: 'bold',
  },
  errorBanner: sharedStyles.errorBanner,
});

export default LoginScreen;
