import React from 'react';
import { Image, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, radii, spacing } from '../../theme';
import ShopNameLogo from '../branding/ShopNameLogo';

type HeaderIconName = keyof typeof MaterialCommunityIcons.glyphMap;

type StorefrontHeaderProps = {
  onMenuPress?: () => void;
  menuIcon?: HeaderIconName;
  menuAccessibilityLabel?: string;
  onProfilePress?: () => void;
  onFavoritesPress?: () => void;
  onSearchSubmit?: (keyword: string) => void;
  onSearchFocus?: () => void;
  isAuthenticated?: boolean;
  userName?: string;
  avatarImage?: string | null;
  profileBadgeCount?: number;
};

const StorefrontHeader = ({
  onMenuPress,
  menuIcon = 'menu',
  menuAccessibilityLabel = 'Mở menu',
  onProfilePress,
  onFavoritesPress,
  onSearchSubmit,
  onSearchFocus,
  isAuthenticated,
  userName,
  avatarImage,
  profileBadgeCount = 0,
}: StorefrontHeaderProps) => {
  const [searchTerm, setSearchTerm] = React.useState('');
  const [avatarLoadFailed, setAvatarLoadFailed] = React.useState(false);
  const avatarUri = avatarImage?.trim();
  const userInitial = userName?.trim().charAt(0).toUpperCase() || 'U';
  const canShowAvatar = Boolean(avatarUri && /^https?:\/\//i.test(avatarUri) && !avatarLoadFailed);

  React.useEffect(() => {
    setAvatarLoadFailed(false);
  }, [avatarUri]);

  const handleSearchSubmit = () => {
    const keyword = searchTerm.trim();

    if (keyword) {
      onSearchSubmit?.(keyword);
    }
  };

  const handleSearchRowPress = () => {
    if (onSearchFocus) {
      onSearchFocus();
    }
  };

  return (
    <View style={styles.header}>
      <View style={styles.topRow}>
        <TouchableOpacity
          style={styles.iconButton}
          onPress={onMenuPress}
          accessibilityLabel={menuAccessibilityLabel}
          activeOpacity={0.8}
        >
          <MaterialCommunityIcons name={menuIcon} size={26} color={colors.white} />
        </TouchableOpacity>

        <View style={styles.brand}>
          <ShopNameLogo />
        </View>

        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.iconButton}
            onPress={onFavoritesPress}
            accessibilityLabel="Sản phẩm yêu thích"
            activeOpacity={0.8}
          >
            <MaterialCommunityIcons name="heart-outline" size={25} color={colors.white} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.iconButton, isAuthenticated && styles.profileButton]}
            onPress={onProfilePress}
            accessibilityLabel={profileBadgeCount > 0 ? `Tài khoản, ${profileBadgeCount} việc cần chú ý` : 'Tài khoản'}
            activeOpacity={0.8}
          >
            {isAuthenticated ? (
              canShowAvatar ? (
                <Image
                  key={avatarUri}
                  source={{ uri: avatarUri }}
                  style={styles.avatarImage}
                  resizeMode="cover"
                  onError={() => setAvatarLoadFailed(true)}
                />
              ) : (
                <Text style={styles.avatarInitial}>{userInitial}</Text>
              )
            ) : (
              <MaterialCommunityIcons name="account-outline" size={25} color={colors.white} />
            )}
            {profileBadgeCount > 0 ? <View style={styles.notificationDot} /> : null}
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.searchRow}>
        <MaterialCommunityIcons name="magnify" size={23} color={colors.textMuted} />
        {onSearchFocus ? (
          <TouchableOpacity
            style={styles.searchFakeInput}
            onPress={handleSearchRowPress}
            activeOpacity={0.8}
            accessibilityLabel="Mở tìm kiếm"
          >
            <Text style={styles.searchPlaceholder}>Bạn tìm gì hôm nay?</Text>
          </TouchableOpacity>
        ) : (
          <TextInput
            style={styles.searchInput}
            value={searchTerm}
            onChangeText={setSearchTerm}
            placeholder="Bạn tìm gì hôm nay?"
            placeholderTextColor={colors.textMuted}
            returnKeyType="search"
            onSubmitEditing={handleSearchSubmit}
          />
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  header: {
    backgroundColor: colors.brand,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
  },
  topRow: {
    height: 50,
    flexDirection: 'row',
    alignItems: 'center',
  },
  brand: {
    flex: 1,
    alignItems: 'flex-start',
    paddingLeft: spacing.xs,
  },
  actions: {
    minWidth: 84,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.md,
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  notificationDot: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: colors.coral,
    borderWidth: 1.5,
    borderColor: colors.brand,
  },
  profileButton: {
    borderWidth: 1,
    borderColor: colors.brandPale,
    backgroundColor: colors.brandSoft,
  },
  avatarImage: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  avatarInitial: {
    color: colors.brandDark,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '800',
  },
  searchRow: {
    minHeight: 36,
    marginTop: spacing.sm,
    borderRadius: radii.xs,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
  },
  searchInput: {
    flex: 1,
    minHeight: 36,
    paddingVertical: 0,
    paddingHorizontal: spacing.sm,
    color: colors.text,
    fontSize: 13,
  },
  searchFakeInput: {
    flex: 1,
    minHeight: 36,
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
  },
  searchPlaceholder: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '600',
  },
});

export default StorefrontHeader;
