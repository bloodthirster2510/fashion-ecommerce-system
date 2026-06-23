import React from 'react';
import { Image, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, radii, spacing } from '../../theme';

type HeaderIconName = keyof typeof MaterialCommunityIcons.glyphMap;

type StorefrontHeaderProps = {
  onMenuPress?: () => void;
  menuIcon?: HeaderIconName;
  menuAccessibilityLabel?: string;
  onProfilePress?: () => void;
  onFavoritesPress?: () => void;
  onCartPress?: () => void;
  onSearchSubmit?: (keyword: string) => void;
  onImageSearchPress?: () => void;
  isAuthenticated?: boolean;
  userName?: string;
  avatarImage?: string | null;
  cartBadgeCount?: number;
  profileBadgeCount?: number;
};

const StorefrontHeader = ({
  onMenuPress,
  menuIcon = 'menu',
  menuAccessibilityLabel = 'Mở menu',
  onProfilePress,
  onFavoritesPress,
  onCartPress,
  onSearchSubmit,
  onImageSearchPress,
  isAuthenticated,
  userName,
  avatarImage,
  cartBadgeCount = 0,
  profileBadgeCount = 0,
}: StorefrontHeaderProps) => {
  const [searchTerm, setSearchTerm] = React.useState('');
  const avatarUri = avatarImage?.trim();
  const userInitial = userName?.trim().charAt(0).toUpperCase() || 'U';

  const handleSearchSubmit = () => {
    const keyword = searchTerm.trim();

    if (keyword) {
      onSearchSubmit?.(keyword);
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
          <MaterialCommunityIcons name={menuIcon} size={24} color={colors.white} />
        </TouchableOpacity>

        <Text style={styles.brand}>FASHIONISTA</Text>

        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.iconButton}
            onPress={onFavoritesPress}
            accessibilityLabel="Sản phẩm yêu thích"
            activeOpacity={0.8}
          >
            <MaterialCommunityIcons name="heart-outline" size={23} color={colors.white} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.iconButton}
            onPress={onCartPress}
            accessibilityLabel={cartBadgeCount > 0 ? `Giỏ hàng, ${cartBadgeCount} sản phẩm` : 'Giỏ hàng'}
            activeOpacity={0.8}
          >
            <MaterialCommunityIcons name="shopping-outline" size={23} color={colors.white} />
            {cartBadgeCount > 0 ? (
              <View style={styles.notificationBadge}>
                <Text style={styles.notificationBadgeText}>{cartBadgeCount > 99 ? '99+' : cartBadgeCount}</Text>
              </View>
            ) : null}
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.iconButton, isAuthenticated && styles.profileButton]}
            onPress={onProfilePress}
            accessibilityLabel={profileBadgeCount > 0 ? `Tài khoản, ${profileBadgeCount} việc cần chú ý` : 'Tài khoản'}
            activeOpacity={0.8}
          >
            {isAuthenticated ? (
              avatarUri ? (
                <Image source={{ uri: avatarUri }} style={styles.avatarImage} />
              ) : (
                <Text style={styles.avatarInitial}>{userInitial}</Text>
              )
            ) : (
              <MaterialCommunityIcons name="account-outline" size={23} color={colors.white} />
            )}
            {profileBadgeCount > 0 ? <View style={styles.notificationDot} /> : null}
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.searchRow}>
        <MaterialCommunityIcons name="magnify" size={21} color={colors.textMuted} />
        <TextInput
          style={styles.searchInput}
          value={searchTerm}
          onChangeText={setSearchTerm}
          placeholder="Bạn tìm gì hôm nay?"
          placeholderTextColor={colors.textMuted}
          returnKeyType="search"
          onSubmitEditing={handleSearchSubmit}
        />
        <TouchableOpacity
          style={styles.cameraButton}
          onPress={onImageSearchPress}
          accessibilityLabel="Tìm kiếm bằng hình ảnh"
          activeOpacity={0.8}
        >
          <MaterialCommunityIcons name="camera-outline" size={21} color={colors.textMuted} />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  header: {
    backgroundColor: colors.brand,
    paddingHorizontal: spacing.md,
    paddingTop: 6,
    paddingBottom: 10,
  },
  topRow: {
    height: 32,
    flexDirection: 'row',
    alignItems: 'center',
  },
  brand: {
    flex: 1,
    color: colors.white,
    fontSize: 17,
    lineHeight: 23,
    fontWeight: '800',
    textAlign: 'center',
  },
  actions: {
    minWidth: 96,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  iconButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  notificationBadge: {
    position: 'absolute',
    top: -6,
    right: -7,
    minWidth: 17,
    height: 17,
    paddingHorizontal: 4,
    borderRadius: 9,
    backgroundColor: colors.coral,
    borderWidth: 1.5,
    borderColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notificationBadgeText: {
    color: colors.white,
    fontSize: 9,
    lineHeight: 11,
    fontWeight: '800',
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
    backgroundColor: colors.white,
  },
  avatarImage: {
    width: 30,
    height: 30,
    borderRadius: 15,
  },
  avatarInitial: {
    color: colors.brandDark,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '800',
  },
  searchRow: {
    minHeight: 34,
    marginTop: 7,
    borderRadius: radii.xs,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
  },
  searchInput: {
    flex: 1,
    minHeight: 34,
    paddingVertical: 0,
    paddingHorizontal: spacing.sm,
    color: colors.text,
    fontSize: 13,
  },
  cameraButton: {
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default StorefrontHeader;
