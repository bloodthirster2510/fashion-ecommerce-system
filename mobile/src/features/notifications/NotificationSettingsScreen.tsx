import React from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { RootStackParamList } from '../../navigation/AppNavigator';
import { colors, radii, shadows, spacing } from '../../theme';
import {
  usePushNotifications,
} from './PushNotificationProvider';
import type { PushNotificationCategory } from './pushNotifications';

type Navigation = StackNavigationProp<RootStackParamList, 'NotificationSettings'>;
type IconName = keyof typeof MaterialCommunityIcons.glyphMap;

const categoryOptions: Array<{
  category: PushNotificationCategory;
  label: string;
  description: string;
  icon: IconName;
}> = [
  {
    category: 'order',
    label: 'Đơn hàng và thanh toán',
    description: 'Trạng thái giao hàng, hạn thanh toán và cập nhật đơn.',
    icon: 'package-variant-closed',
  },
  {
    category: 'promotion',
    label: 'Ưu đãi',
    description: 'Voucher, chương trình khuyến mãi và ưu đãi thành viên.',
    icon: 'ticket-percent-outline',
  },
  {
    category: 'support',
    label: 'Hỗ trợ',
    description: 'Phản hồi mới từ đội ngũ chăm sóc khách hàng.',
    icon: 'message-reply-text-outline',
  },
  {
    category: 'account',
    label: 'Tài khoản',
    description: 'Điểm thành viên và các cập nhật liên quan tài khoản.',
    icon: 'account-circle-outline',
  },
  {
    category: 'virtual_try_on',
    label: 'Phối đồ ảo',
    description: 'Kết quả xử lý ảnh/video và trạng thái quyền truy cập.',
    icon: 'tshirt-crew-outline',
  },
  {
    category: 'system',
    label: 'Hệ thống',
    description: 'Thông báo vận hành quan trọng của ứng dụng.',
    icon: 'information-outline',
  },
];

const NotificationSettingsScreen = () => {
  const navigation = useNavigation<Navigation>();
  const {
    capability,
    disable,
    enable,
    enabled,
    error,
    loading,
    preferences,
    setCategoryEnabled,
  } = usePushNotifications();

  const changeMasterSetting = async (nextEnabled: boolean) => {
    try {
      if (nextEnabled) await enable();
      else await disable();
    } catch (caught) {
      Alert.alert(
        'Chưa cập nhật được thông báo',
        caught instanceof Error ? caught.message : 'Bạn thử lại sau nhé.',
      );
    }
  };

  const changeCategory = async (category: PushNotificationCategory, nextEnabled: boolean) => {
    try {
      await setCategoryEnabled(category, nextEnabled);
    } catch (caught) {
      Alert.alert(
        'Chưa lưu được lựa chọn',
        caught instanceof Error ? caught.message : 'Bạn thử lại sau nhé.',
      );
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.headerButton}
          onPress={() => navigation.goBack()}
          accessibilityLabel="Trở về"
        >
          <MaterialCommunityIcons name="arrow-left" size={24} color={colors.brandDark} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Cài đặt thông báo</Text>
        <View style={styles.headerButton} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.infoCard}>
          <View style={styles.infoIcon}>
            <MaterialCommunityIcons name="bell-ring-outline" size={27} color={colors.brand} />
          </View>
          <View style={styles.infoCopy}>
            <Text style={styles.infoTitle}>Thông báo đẩy trên thiết bị</Text>
            <Text style={styles.infoText}>
              Lịch sử thông báo trong ứng dụng và cập nhật realtime vẫn hoạt động khi bạn tắt mục này.
            </Text>
          </View>
          {loading ? (
            <ActivityIndicator color={colors.brand} />
          ) : (
            <Switch
              value={enabled}
              onValueChange={(value) => void changeMasterSetting(value)}
              disabled={!enabled && !capability.remoteEnabled}
              trackColor={{ false: colors.borderStrong, true: colors.brandMist }}
              thumbColor={enabled ? colors.brand : colors.white}
            />
          )}
        </View>

        {!capability.remoteEnabled ? (
          <View style={styles.warningCard}>
            <MaterialCommunityIcons name="alert-circle-outline" size={21} color={colors.goldDark} />
            <Text style={styles.warningText}>{capability.message}</Text>
          </View>
        ) : null}
        {error ? (
          <View style={styles.errorCard}>
            <Text style={styles.errorText}>{error}</Text>
            {error.toLowerCase().includes('quyền') ? (
              <TouchableOpacity onPress={() => void Linking.openSettings()}>
                <Text style={styles.settingsLink}>Mở cài đặt thiết bị</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        ) : null}

        <Text style={styles.sectionTitle}>Loại thông báo</Text>
        <View style={styles.categoryCard}>
          {categoryOptions.map((option, index) => (
            <View
              key={option.category}
              style={[styles.categoryRow, index < categoryOptions.length - 1 && styles.categoryDivider]}
            >
              <View style={styles.categoryIcon}>
                <MaterialCommunityIcons name={option.icon} size={22} color={colors.brand} />
              </View>
              <View style={styles.categoryCopy}>
                <Text style={styles.categoryTitle}>{option.label}</Text>
                <Text style={styles.categoryDescription}>{option.description}</Text>
              </View>
              <Switch
                value={preferences[option.category]}
                onValueChange={(value) => void changeCategory(option.category, value)}
                disabled={!enabled || loading}
                trackColor={{ false: colors.borderStrong, true: colors.brandMist }}
                thumbColor={preferences[option.category] ? colors.brand : colors.white}
              />
            </View>
          ))}
        </View>

        <Text style={styles.footerNote}>
          Ứng dụng tự làm mới push token khi thiết bị hoặc Expo thay đổi token. Bạn không cần đăng ký lại thủ công.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.white },
  header: {
    height: 62,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  headerButton: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { color: colors.brandDark, fontSize: 20, fontWeight: '900' },
  content: { padding: spacing.lg, paddingBottom: 40, gap: spacing.md },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    ...shadows.card,
  },
  infoIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.brandMist,
  },
  infoCopy: { flex: 1, gap: 4 },
  infoTitle: { color: colors.text, fontSize: 16, fontWeight: '800' },
  infoText: { color: colors.textMuted, fontSize: 13, lineHeight: 19 },
  warningCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radii.sm,
    backgroundColor: colors.goldSoft,
  },
  warningText: { flex: 1, color: colors.goldDark, fontSize: 13, lineHeight: 19 },
  errorCard: {
    gap: spacing.xs,
    padding: spacing.md,
    borderRadius: radii.sm,
    backgroundColor: colors.dangerSoft,
  },
  errorText: { color: colors.danger, fontSize: 13, lineHeight: 19 },
  settingsLink: { color: colors.brand, fontSize: 13, fontWeight: '800' },
  sectionTitle: { marginTop: spacing.sm, color: colors.text, fontSize: 17, fontWeight: '900' },
  categoryCard: {
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surface,
    ...shadows.card,
  },
  categoryRow: {
    minHeight: 86,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  categoryDivider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  categoryIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.brandMist,
  },
  categoryCopy: { flex: 1, gap: 3 },
  categoryTitle: { color: colors.text, fontSize: 15, fontWeight: '800' },
  categoryDescription: { color: colors.textMuted, fontSize: 12, lineHeight: 17 },
  footerNote: { color: colors.textMuted, fontSize: 12, lineHeight: 18, textAlign: 'center' },
});

export default NotificationSettingsScreen;
