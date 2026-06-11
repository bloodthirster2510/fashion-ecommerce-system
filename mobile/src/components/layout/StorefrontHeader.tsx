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
            accessibilityLabel="Giỏ hàng"
            activeOpacity={0.8}
          >
            <MaterialCommunityIcons name="shopping-outline" size={23} color={colors.white} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.iconButton, isAuthenticated && styles.profileButton]}
            onPress={onProfilePress}
            accessibilityLabel="Tài khoản"
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
  },
  profileButton: {
    backgroundColor: colors.white,
    overflow: 'hidden',
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
