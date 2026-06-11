import React, { useCallback, useState } from 'react';
import {
  BackHandler,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Image,
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
import { authApi, type AuthSession } from '../authApi';
import { useGoogleAuth } from '../useGoogleAuth';
import { useFacebookAuth } from '../useFacebookAuth';
import { colors, sharedStyles } from '../../../theme';

type AuthNavigationProp = StackNavigationProp<RootStackParamList>;

const vietnamPhoneRegex = /^(0|\+84)(3|5|7|8|9)[0-9]{8}$/;
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const socialIcons = {
  facebook: require('../../../../assets/social/facebook.png'),
  google: require('../../../../assets/social/google.png'),
};

const LoginScreen = () => {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const navigation = useNavigation<AuthNavigationProp>();
  const { login } = useAuth();
  const resetToHome = useCallback(() => {
    navigation.reset({
      index: 0,
      routes: [{ name: 'Home' }],
    });
  }, [navigation]);
  const completeLogin = useCallback((session: AuthSession) => {
    login(session);
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
  const googleAuth = useGoogleAuth((session) => {
    completeLogin(session);
  });
  const facebookAuth = useFacebookAuth((session) => {
    completeLogin(session);
  });


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
      completeLogin(result);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Đăng nhập thất bại');
    } finally {
      setLoading(false);
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
          <Text style={styles.headerTitle}>FASHIONISTA</Text>
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
                onChangeText={setIdentifier}
                placeholder="Nhập số điện thoại hoặc email"
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

          {errorMessage || googleAuth.error || facebookAuth.error ? (
            <Text style={styles.errorBanner}>{errorMessage || googleAuth.error || facebookAuth.error}</Text>
          ) : null}

          <TouchableOpacity
            style={styles.forgotPasswordButton}
              onPress={() => navigation.navigate('ForgotPassword')}
            >
              <Text style={styles.forgotPasswordText}>Quên mật khẩu?</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.loginButton, loading && styles.disabledButton]}
              onPress={handleLogin}
              disabled={loading}
            >
              <Text style={styles.loginButtonText}>
                {loading ? 'Đang đăng nhập...' : 'Đăng nhập'}
              </Text>
            </TouchableOpacity>

            <Text style={styles.socialLabel}>Hoặc đăng nhập bằng</Text>

          <View style={styles.socialLoginContainer}>
            <TouchableOpacity
              style={styles.facebookButton}
              onPress={facebookAuth.signInWithFacebook}
              disabled={facebookAuth.loading}
            >
              {facebookAuth.loading ? (
                <ActivityIndicator size="small" color="#FFFFFF" style={styles.facebookIcon} />
              ) : (
                <Image source={socialIcons.facebook} style={styles.facebookIcon} />
              )}
              <Text style={styles.facebookButtonText}>
                {facebookAuth.loading ? 'Đang đăng nhập...' : 'Tiếp tục đăng nhập với Facebook'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.googleButton}
              onPress={googleAuth.signInWithGoogle}
              disabled={googleAuth.loading}
            >
              {googleAuth.loading ? (
                <ActivityIndicator size="small" color="#0A0A0A" style={styles.googleIcon} />
              ) : (
                <Image source={socialIcons.google} style={styles.googleIcon} />
              )}
              <Text style={styles.googleButtonText}>
                {googleAuth.loading ? 'Đang đăng nhập...' : 'Tiếp tục đăng nhập với Google'}
              </Text>
            </TouchableOpacity>
          </View>

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
  header: sharedStyles.authTopHeader,
  headerBack: sharedStyles.authHeaderBack,
  headerBackIcon: sharedStyles.authHeaderBackIcon,
  headerTitle: {
    ...sharedStyles.authHeaderTitle,
    fontSize: 20,
    lineHeight: 28,
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
  socialLabel: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    color: colors.textMuted,
    marginBottom: 16,
  },
  socialLoginContainer: {
    gap: 12,
    marginBottom: 20,
  },
  facebookButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    height: 44,
    borderRadius: 4,
    backgroundColor: colors.facebook,
  },
  facebookIcon: {
    width: 22,
    height: 22,
    marginRight: 10,
  },
  facebookButtonText: {
    flexShrink: 1,
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 20,
    textAlign: 'center',
    color: colors.white,
  },
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    height: 46,
    borderRadius: 4,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  googleIcon: {
    width: 22,
    height: 22,
    marginRight: 10,
  },
  googleButtonText: {
    flexShrink: 1,
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 20,
    textAlign: 'center',
    color: colors.black,
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
