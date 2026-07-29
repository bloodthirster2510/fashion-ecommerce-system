import React from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import type { RootStackParamList } from '../../../navigation/AppNavigator';
import { colors } from '../../../theme';
import { authApi } from '../authApi';
import { useAuth } from '../AuthContext';

type NavigationProp = StackNavigationProp<RootStackParamList, 'ForceChangePassword'>;

const ForceChangePasswordScreen = () => {
  const navigation = useNavigation<NavigationProp>();
  const { logout, runWithAuth } = useAuth();
  const [currentPassword, setCurrentPassword] = React.useState('');
  const [newPassword, setNewPassword] = React.useState('');
  const [confirmPassword, setConfirmPassword] = React.useState('');
  const [error, setError] = React.useState('');
  const [loading, setLoading] = React.useState(false);

  const handleSubmit = async () => {
    if (!currentPassword) {
      setError('Vui lòng nhập mật khẩu hiện tại.');
      return;
    }
    if (newPassword.length < 8) {
      setError('Mật khẩu mới phải có ít nhất 8 ký tự.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Xác nhận mật khẩu không khớp.');
      return;
    }

    try {
      setLoading(true);
      setError('');
      await runWithAuth((accessToken) =>
        authApi.changePassword(accessToken, currentPassword, newPassword, confirmPassword));
      logout();
      Alert.alert('Đổi mật khẩu thành công', 'Vui lòng đăng nhập lại bằng mật khẩu mới.', [
        {
          text: 'Đăng nhập',
          onPress: () => {
            setTimeout(() => {
              navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
            }, 0);
          },
        },
      ]);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Không thể đổi mật khẩu.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.card}>
          <Text style={styles.eyebrow}>BẢO MẬT TÀI KHOẢN</Text>
          <Text style={styles.title}>Bạn cần đổi mật khẩu</Text>
          <Text style={styles.description}>
            Quản trị viên đã yêu cầu đặt lại mật khẩu. Bạn chỉ có thể tiếp tục sử dụng ứng dụng sau khi hoàn tất bước này.
          </Text>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Text style={styles.label}>Mật khẩu hiện tại</Text>
          <TextInput
            value={currentPassword}
            onChangeText={setCurrentPassword}
            secureTextEntry
            autoCapitalize="none"
            style={styles.input}
            placeholder="Nhập mật khẩu hiện tại"
          />

          <Text style={styles.label}>Mật khẩu mới</Text>
          <TextInput
            value={newPassword}
            onChangeText={setNewPassword}
            secureTextEntry
            autoCapitalize="none"
            style={styles.input}
            placeholder="Tối thiểu 8 ký tự"
          />

          <Text style={styles.label}>Xác nhận mật khẩu mới</Text>
          <TextInput
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry
            autoCapitalize="none"
            style={styles.input}
            placeholder="Nhập lại mật khẩu mới"
          />

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={() => void handleSubmit()}
            disabled={loading}
          >
            <Text style={styles.buttonText}>{loading ? 'Đang cập nhật...' : 'Đổi mật khẩu'}</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => navigation.navigate('ForgotPassword')}>
            <Text style={styles.recoveryLink}>Không nhớ mật khẩu hiện tại? Khôi phục bằng email hoặc OTP</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f7f8fa',
  },
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 20,
  },
  card: {
    borderRadius: 18,
    backgroundColor: '#ffffff',
    padding: 22,
    shadowColor: '#000000',
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  eyebrow: {
    color: colors.brand,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.2,
    marginBottom: 8,
  },
  title: {
    color: '#1f2937',
    fontSize: 26,
    fontWeight: '700',
    marginBottom: 10,
  },
  description: {
    color: '#667085',
    fontSize: 14,
    lineHeight: 21,
    marginBottom: 18,
  },
  error: {
    color: '#b42318',
    backgroundColor: '#fef3f2',
    borderRadius: 8,
    padding: 10,
    marginBottom: 14,
  },
  label: {
    color: '#344054',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: '#d0d5dd',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginBottom: 14,
    color: '#101828',
  },
  button: {
    alignItems: 'center',
    borderRadius: 10,
    backgroundColor: colors.brand,
    paddingVertical: 14,
    marginTop: 4,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
  recoveryLink: {
    color: colors.brand,
    textAlign: 'center',
    fontSize: 13,
    fontWeight: '600',
    marginTop: 18,
  },
});

export default ForceChangePasswordScreen;
