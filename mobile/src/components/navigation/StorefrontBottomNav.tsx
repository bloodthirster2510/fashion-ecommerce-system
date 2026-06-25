import React from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import type { RootStackParamList } from '../../navigation/AppNavigator';
import { colors, shadows, spacing } from '../../theme';
import { useAuth } from '../../features/auth/AuthContext';
import { useCustomerNotifications } from '../../features/notifications/CustomerNotificationProvider';

type MainTab = 'home' | 'catalog' | 'cart' | 'profile';
type IconName = keyof typeof MaterialCommunityIcons.glyphMap;

type Props = {
  activeTab: MainTab;
};

const tabs: Array<{ key: MainTab; label: string; icon: IconName; activeIcon: IconName }> = [
  { key: 'home', label: 'Trang chủ', icon: 'home-outline', activeIcon: 'home' },
  { key: 'catalog', label: 'Danh mục', icon: 'view-grid-outline', activeIcon: 'view-grid' },
  { key: 'cart', label: 'Giỏ hàng', icon: 'cart-outline', activeIcon: 'cart' },
  { key: 'profile', label: 'Tài khoản', icon: 'account-outline', activeIcon: 'account' },
];

export default function StorefrontBottomNav({ activeTab }: Props) {
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();
  const { isAuthenticated } = useAuth();
  const { summary } = useCustomerNotifications();

  const openTab = (tab: MainTab) => {
    if (tab === 'home') navigation.navigate('Home');
    if (tab === 'catalog') navigation.navigate('ProductList', { title: 'Danh mục sản phẩm' });
    if (tab === 'cart') navigation.navigate('Cart');
    if (tab === 'profile') navigation.navigate(isAuthenticated ? 'Profile' : 'Login');
  };

  return (
    <View style={styles.shell} accessibilityRole="tablist">
      <View style={styles.row}>
        {tabs.map((tab, index) => {
          const active = activeTab === tab.key;
          const badgeCount = tab.key === 'cart' ? summary?.cartItems ?? 0 : 0;

          return (
            <React.Fragment key={tab.key}>
              {index === 2 ? <View style={styles.centerSpace} /> : null}
              <TouchableOpacity
                style={styles.tab}
                onPress={() => openTab(tab.key)}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
                accessibilityLabel={tab.label}
                activeOpacity={0.78}
              >
                {active ? <View style={styles.activeIndicator} /> : null}
                <View style={styles.iconWrap}>
                  <MaterialCommunityIcons
                    name={active ? tab.activeIcon : tab.icon}
                    size={23}
                    color={active ? colors.brandDark : colors.textMuted}
                  />
                  {badgeCount > 0 ? (
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>{badgeCount > 99 ? '99+' : badgeCount}</Text>
                    </View>
                  ) : null}
                </View>
                <Text style={[styles.label, active && styles.activeLabel]} numberOfLines={1}>{tab.label}</Text>
              </TouchableOpacity>
            </React.Fragment>
          );
        })}
      </View>

      <TouchableOpacity
        style={styles.tryOnButton}
        onPress={() => Alert.alert('Phòng phối đồ ảo', 'Tính năng này đang được thiết kế và sẽ sớm ra mắt.')}
        accessibilityLabel="Phòng phối đồ ảo"
        activeOpacity={0.86}
      >
        <MaterialCommunityIcons name="tshirt-crew-outline" size={24} color={colors.brandDark} />
      </TouchableOpacity>
      <Text style={styles.tryOnLabel}>Phối đồ</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    position: 'relative',
    zIndex: 20,
    height: 70,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.white,
    ...shadows.card,
  },
  row: {
    height: '100%',
    flexDirection: 'row',
    alignItems: 'stretch',
    paddingHorizontal: spacing.xs,
  },
  tab: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  centerSpace: {
    width: 60,
  },
  activeIndicator: {
    position: 'absolute',
    top: 0,
    width: 26,
    height: 3,
    borderBottomLeftRadius: 3,
    borderBottomRightRadius: 3,
    backgroundColor: colors.brand,
  },
  iconWrap: {
    position: 'relative',
  },
  label: {
    color: colors.textMuted,
    fontSize: 10,
    lineHeight: 14,
    fontWeight: '700',
  },
  activeLabel: {
    color: colors.brandDark,
    fontWeight: '900',
  },
  badge: {
    position: 'absolute',
    top: -7,
    right: -11,
    minWidth: 17,
    height: 17,
    paddingHorizontal: 4,
    borderRadius: 9,
    borderWidth: 1.5,
    borderColor: colors.white,
    backgroundColor: colors.coral,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    color: colors.white,
    fontSize: 8,
    lineHeight: 10,
    fontWeight: '900',
  },
  tryOnButton: {
    position: 'absolute',
    top: 5,
    left: '50%',
    width: 44,
    height: 44,
    marginLeft: -22,
    borderWidth: 1,
    borderColor: colors.brandPale,
    borderRadius: 22,
    backgroundColor: colors.brandSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tryOnLabel: {
    position: 'absolute',
    top: 50,
    left: '50%',
    width: 68,
    marginLeft: -34,
    color: colors.textMuted,
    fontSize: 10,
    lineHeight: 14,
    fontWeight: '800',
    textAlign: 'center',
  },
});
