import React from 'react';
import {
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import { useAuth } from '../auth/AuthContext';
import { authApi } from '../auth/authApi';
import { accountApi, MembershipResponse } from './accountApi';
import { couponApi } from '../coupons/couponApi';
import { colors, radii, shadows, spacing } from '../../theme';
import type { RootStackParamList } from '../../navigation/AppNavigator';

type ProfileNavigationProp = StackNavigationProp<RootStackParamList, 'Profile'>;

type IconName = keyof typeof MaterialCommunityIcons.glyphMap;

type ProfileMenuItem = {
  id: string;
  icon: IconName;
  label: string;
};

type AccountStat = {
  label: string;
  value: string;
  tone: 'blue' | 'coral' | 'gold';
};

const profileMenuItems: ProfileMenuItem[] = [
  { id: 'personal-info', icon: 'account-outline', label: 'Thông tin cá nhân' },
  { id: 'cart', icon: 'cart-outline', label: 'Giỏ hàng' },
  { id: 'orders', icon: 'package-variant-closed', label: 'Đơn hàng của tôi' },
  { id: 'favorites', icon: 'heart-outline', label: 'Sản phẩm yêu thích' },
  { id: 'outfits', icon: 'tshirt-crew-outline', label: 'Phòng phối đồ ảo' },
  { id: 'membership', icon: 'medal-outline', label: 'Hạng thành viên' },
  { id: 'vouchers', icon: 'ticket-percent-outline', label: 'Voucher & Ưu đãi' },
  { id: 'payment', icon: 'credit-card-outline', label: 'Phương thức thanh toán' },
  { id: 'support', icon: 'help-circle-outline', label: 'Hỗ trợ' },
];

const isUnauthorizedError = (error: unknown) =>
  typeof error === 'object' &&
  error !== null &&
  'status' in error &&
  (error as { status?: number }).status === 401;

const getInitial = (name?: string) => {
  const trimmedName = name?.trim();
  if (!trimmedName) return 'U';

  return trimmedName.charAt(0).toUpperCase();
};

const isPreviewableImage = (value?: string | null) => !!value && /^https?:\/\//i.test(value.trim());

const ProfileScreen = () => {
  const { logout, session, runWithAuth } = useAuth();
  const navigation = useNavigation<ProfileNavigationProp>();
  const user = session?.user;
  const displayName = user?.name || 'Khách hàng FASHIONISTA';
  const contact = user?.email || user?.phone || 'Cập nhật thông tin liên hệ';
  const avatarImage = user?.avatarImage;
  const avatarUri = typeof avatarImage === 'string' && isPreviewableImage(avatarImage) ? avatarImage.trim() : '';

  const [membershipData, setMembershipData] = React.useState<MembershipResponse | null>(null);
  const [voucherCount, setVoucherCount] = React.useState<number | null>(null);
  const [orderCount, setOrderCount] = React.useState<number | null>(null);
  const [shippingOrderCount, setShippingOrderCount] = React.useState<number | null>(null);

  useFocusEffect(
    React.useCallback(() => {
      if (!session?.accessToken) {
        setMembershipData(null);
        setVoucherCount(null);
        setOrderCount(null);
        setShippingOrderCount(null);
        return;
      }

      runWithAuth((accessToken) => accountApi.getMembership(accessToken))
        .then(setMembershipData)
        .catch((error: unknown) => {
          if (isUnauthorizedError(error)) {
            setMembershipData(null);
            logout();
            navigation.reset({
              index: 0,
              routes: [{ name: 'Login' }],
            });
            return;
          }

          console.error(error);
        });
      runWithAuth((accessToken) => couponApi.getAvailableCoupons(accessToken))
        .then((response) => setVoucherCount(response.items.length))
        .catch(() => setVoucherCount(null));
      runWithAuth(async (accessToken) => {
        const [allOrders, shippingOrders] = await Promise.all([
          accountApi.getMyOrderSummary(accessToken),
          accountApi.getMyOrderSummary(accessToken, 'shipping'),
        ]);

        return {
          orderCount: allOrders.pagination?.totalItems ?? 0,
          shippingOrderCount: shippingOrders.pagination?.totalItems ?? 0,
        };
      })
        .then((summary) => {
          setOrderCount(summary.orderCount);
          setShippingOrderCount(summary.shippingOrderCount);
        })
        .catch(() => {
          setOrderCount(null);
          setShippingOrderCount(null);
        });
    }, [logout, navigation, runWithAuth, session?.accessToken])
  );

  const handleMenuPress = (item: ProfileMenuItem) => {
    if (item.id === 'personal-info') {
      navigation.navigate('EditProfile');
      return;
    }
    if (item.id === 'cart') {
      navigation.navigate('Cart');
      return;
    }
    if (item.id === 'favorites') {
      navigation.navigate('Favorites');
      return;
    }
    if (item.id === 'membership') {
      navigation.navigate('Membership');
      return;
    }
    if (item.id === 'vouchers') {
      navigation.navigate('Coupons');
      return;
    }

    Alert.alert('Sắp ra mắt', `${item.label} sẽ được thiết kế ở bước sau.`);
  };

  const handleLogout = () => {
    Alert.alert(
      'Xác nhận đăng xuất',
      'Bạn có chắc chắn muốn đăng xuất khỏi tài khoản?',
      [
        {
          text: 'Hủy',
          style: 'cancel',
        },
        {
          text: 'Đăng xuất',
          style: 'destructive',
          onPress: () => {
            const accessToken = session?.accessToken;

            void (async () => {
              try {
                if (accessToken) await authApi.logout(accessToken);
              } finally {
                logout();
                navigation.reset({
                  index: 0,
                  routes: [{ name: 'Home' }],
                });
              }
            })();
          },
        },
      ],
      { cancelable: true }
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.headerAction}
          onPress={() => navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Home')}
          accessibilityLabel="Trở về"
          activeOpacity={0.8}
        >
          <MaterialCommunityIcons name="arrow-left" size={24} color={colors.white} />
        </TouchableOpacity>

        <View style={styles.headerTitleContainer}>
          <Text style={styles.brand}>FASHIONISTA</Text>
          <Text style={styles.headerTitle}>Tài khoản</Text>
        </View>

        <TouchableOpacity
          style={styles.headerAction}
          onPress={handleLogout}
          accessibilityLabel="Đăng xuất"
          activeOpacity={0.8}
        >
          <MaterialCommunityIcons name="logout" size={22} color={colors.white} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.profileCard}>
          <View style={styles.avatar}>
            {avatarUri ? (
              <Image source={{ uri: avatarUri }} style={styles.avatarImage} />
            ) : (
              <Text style={styles.avatarText}>{getInitial(displayName)}</Text>
            )}
          </View>

          <View style={styles.profileInfo}>
            <Text style={styles.profileName} numberOfLines={1}>
              {displayName}
            </Text>
            <Text style={styles.profileContact} numberOfLines={1}>
              {contact}
            </Text>
            <View style={styles.memberPill}>
              <MaterialCommunityIcons name="crown-outline" size={15} color={colors.goldText} />
              <Text style={styles.memberText}>Thành viên {membershipData?.currentTier?.name || '...'}</Text>
            </View>
          </View>

          <TouchableOpacity
            style={styles.editButton}
            onPress={() => navigation.navigate('EditProfile')}
            accessibilityLabel="Chỉnh sửa thông tin cá nhân"
            activeOpacity={0.8}
          >
            <MaterialCommunityIcons name="pencil-outline" size={18} color={colors.brand} />
          </TouchableOpacity>
        </View>

        <View style={styles.progressPanel}>
          <View style={styles.progressHeader}>
            <Text style={styles.progressTitle}>Nâng hạng {membershipData?.nextTier?.name || 'MAX'}</Text>
            <Text style={styles.progressPercent}>{membershipData?.progressPercent || 0}%</Text>
          </View>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${membershipData?.progressPercent || 0}%` }]} />
          </View>
          <Text style={styles.progressNote}>
            {membershipData?.nextTier
              ? `Tích thêm ${(membershipData.pointToNextTier || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')} điểm để nhận ưu đãi ${membershipData.nextTier.name}`
              : 'Bạn đã đạt hạng cao nhất'}
          </Text>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <View style={[styles.statDot, styles.blueDot]} />
            <Text style={styles.statValue}>{shippingOrderCount ?? '-'}</Text>
            <Text style={styles.statLabel}>Đơn đang giao</Text>
          </View>
          <View style={styles.statCard}>
            <View style={[styles.statDot, styles.coralDot]} />
            <Text style={styles.statValue}>{voucherCount ?? '-'}</Text>
            <Text style={styles.statLabel}>Voucher</Text>
          </View>
          <View style={styles.statCard}>
            <View style={[styles.statDot, styles.goldDot]} />
            <Text style={styles.statValue}>{(membershipData?.loyaltyPoint || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')}</Text>
            <Text style={styles.statLabel}>Điểm</Text>
          </View>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Lối tắt tài khoản</Text>
        </View>

        <View style={styles.menuGrid}>
          {profileMenuItems.map((item) => (
            <TouchableOpacity
              key={item.id}
              style={styles.menuCard}
              onPress={() => handleMenuPress(item)}
              activeOpacity={0.82}
            >
              <View style={styles.iconWrap}>
                <MaterialCommunityIcons name={item.icon} size={26} color={colors.brand} />
                {item.id === 'orders' && orderCount ? (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{orderCount}</Text>
                  </View>
                ) : null}
              </View>
              <Text style={styles.menuLabel} numberOfLines={2}>
                {item.label}
              </Text>
            </TouchableOpacity>
          ))}
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
  header: {
    minHeight: 84,
    paddingHorizontal: spacing.xl,
    paddingTop: 10,
    paddingBottom: 18,
    backgroundColor: colors.brand,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitleContainer: {
    flex: 1,
    paddingHorizontal: 12,
  },
  brand: {
    color: colors.brandMist,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0,
  },
  headerTitle: {
    color: colors.white,
    fontSize: 26,
    lineHeight: 34,
    fontWeight: '800',
    marginTop: 2,
  },
  headerAction: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  content: {
    flex: 1,
    backgroundColor: colors.background,
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
  },
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: 28,
  },
  profileCard: {
    minHeight: 116,
    borderRadius: radii.sm,
    backgroundColor: colors.surface,
    padding: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    ...shadows.card,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
    overflow: 'hidden',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  avatarText: {
    color: colors.white,
    fontSize: 26,
    fontWeight: '800',
  },
  profileInfo: {
    flex: 1,
    minWidth: 0,
  },
  profileName: {
    color: colors.text,
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '800',
  },
  profileContact: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 2,
  },
  memberPill: {
    marginTop: 9,
    alignSelf: 'flex-start',
    minHeight: 28,
    paddingHorizontal: 10,
    borderRadius: 14,
    backgroundColor: colors.goldSoft,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  memberText: {
    color: colors.goldText,
    fontSize: 12,
    fontWeight: '700',
  },
  editButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.brandSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 10,
  },
  progressPanel: {
    marginTop: 12,
    borderRadius: radii.sm,
    backgroundColor: colors.brandDark,
    padding: 14,
  },
  progressHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  progressTitle: {
    color: colors.white,
    fontSize: 15,
    lineHeight: 21,
    fontWeight: '800',
  },
  progressPercent: {
    color: colors.gold,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '800',
  },
  progressTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.18)',
    marginTop: 12,
    overflow: 'hidden',
  },
  progressFill: {
    width: '62%',
    height: '100%',
    borderRadius: 4,
    backgroundColor: colors.gold,
  },
  progressNote: {
    color: colors.brandPale,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 10,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
  },
  statCard: {
    flex: 1,
    minHeight: 86,
    borderRadius: radii.sm,
    backgroundColor: colors.surface,
    padding: spacing.md,
    justifyContent: 'space-between',
  },
  statDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  blueDot: {
    backgroundColor: colors.brand,
  },
  coralDot: {
    backgroundColor: colors.coral,
  },
  goldDot: {
    backgroundColor: colors.goldDark,
  },
  statValue: {
    color: colors.text,
    fontSize: 19,
    lineHeight: 25,
    fontWeight: '800',
  },
  statLabel: {
    color: colors.textMuted,
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '600',
  },
  sectionHeader: {
    marginTop: 20,
    marginBottom: 10,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '800',
  },
  menuGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  menuCard: {
    width: '31.2%',
    minHeight: 112,
    borderRadius: radii.sm,
    backgroundColor: colors.surface,
    paddingHorizontal: 8,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: colors.brandSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 9,
  },
  badge: {
    position: 'absolute',
    top: -5,
    right: -6,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 5,
    backgroundColor: colors.coral,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.white,
  },
  badgeText: {
    color: colors.white,
    fontSize: 10,
    lineHeight: 12,
    fontWeight: '800',
  },
  menuLabel: {
    color: colors.text,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
    textAlign: 'center',
  },
});

export default ProfileScreen;
