import React from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, radii, spacing } from '../../theme';
import ShopNameLogo from '../branding/ShopNameLogo';

type HeaderIconName = keyof typeof MaterialCommunityIcons.glyphMap;

type StorefrontHeaderProps = {
  onMenuPress?: () => void;
  menuIcon?: HeaderIconName;
  menuAccessibilityLabel?: string;
  onFavoritesPress?: () => void;
  onCartPress?: () => void;
  onSearchSubmit?: (keyword: string) => void;
  onSearchFocus?: () => void;
  cartBadgeCount?: number;
};

const StorefrontHeader = ({
  onMenuPress,
  menuIcon = 'menu',
  menuAccessibilityLabel = 'Mở menu',
  onFavoritesPress,
  onCartPress,
  onSearchSubmit,
  onSearchFocus,
  cartBadgeCount = 0,
}: StorefrontHeaderProps) => {
  const [searchTerm, setSearchTerm] = React.useState('');

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
          <MaterialCommunityIcons name={menuIcon} size={26} color={colors.white} />
        </TouchableOpacity>

        <ShopNameLogo header />

        {onSearchFocus ? (
          <TouchableOpacity
            style={styles.searchRow}
            onPress={onSearchFocus}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Mở tìm kiếm"
          >
            <MaterialCommunityIcons name="magnify" size={21} color={colors.textMuted} />
            <Text style={styles.searchPlaceholder} numberOfLines={1}>Tìm sản phẩm</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.searchRow}>
            <MaterialCommunityIcons name="magnify" size={21} color={colors.textMuted} />
            <TextInput
              style={styles.searchInput}
              value={searchTerm}
              onChangeText={setSearchTerm}
              placeholder="Tìm sản phẩm"
              placeholderTextColor={colors.textMuted}
              returnKeyType="search"
              onSubmitEditing={handleSearchSubmit}
            />
          </View>
        )}

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
            style={styles.iconButton}
            onPress={onCartPress}
            accessibilityLabel={cartBadgeCount > 0 ? `Giỏ hàng, ${cartBadgeCount} sản phẩm` : 'Giỏ hàng'}
            activeOpacity={0.8}
          >
            <MaterialCommunityIcons name="shopping-outline" size={25} color={colors.white} />
            {cartBadgeCount > 0 ? (
              <View style={styles.cartBadge}>
                <Text style={styles.cartBadgeText}>{cartBadgeCount > 99 ? '99+' : cartBadgeCount}</Text>
              </View>
            ) : null}
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  header: {
    backgroundColor: colors.brand,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  topRow: {
    minHeight: 36,
    flexDirection: 'row',
    alignItems: 'center',
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.xs,
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  cartBadge: {
    position: 'absolute',
    top: -5,
    right: -4,
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
  cartBadgeText: {
    color: colors.white,
    fontSize: 8,
    lineHeight: 10,
    fontWeight: '900',
  },
  searchRow: {
    flex: 1,
    minWidth: 0,
    minHeight: 36,
    marginHorizontal: spacing.xs,
    borderRadius: radii.xs,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
  },
  searchInput: {
    flex: 1,
    minHeight: 36,
    paddingVertical: 0,
    paddingHorizontal: spacing.sm,
    color: colors.text,
    fontSize: 13,
  },
  searchPlaceholder: {
    flex: 1,
    marginLeft: spacing.xs,
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '600',
  },
});

export default StorefrontHeader;
