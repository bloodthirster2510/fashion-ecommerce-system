import React from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, radii, spacing } from '../../../theme';
import type { CatalogCategory, CatalogGender } from '../../catalog/catalogApi';

type MaterialIconName = keyof typeof MaterialCommunityIcons.glyphMap;
type CategoryIconVisual = { icon: MaterialIconName } | { custom: 'pants' };

type CategoryDrawerProps = {
  visible: boolean;
  categories: CatalogCategory[];
  isLoading?: boolean;
  onClose: () => void;
  onSelectAll: () => void;
  onSelectCategory: (category: CatalogCategory) => void;
};

const genderLabels: Record<CatalogGender, string> = {
  male: 'Nam',
  female: 'Nữ',
  unisex: 'Unisex',
};

const categoryOrder: Record<string, number> = {
  Áo: 1,
  Quần: 2,
  'Set / Bộ': 3,
  'Váy / Đầm': 4,
  'Áo polo': 10,
  'Áo thun': 11,
  'Áo sơ mi': 12,
  'Áo len': 13,
  'Áo hai dây': 14,
  'Áo giữ nhiệt': 15,
  'Hoodie / Áo nỉ': 16,
  'Áo khoác': 17,
  'Quần âu': 30,
  'Quần baggy': 31,
  'Quần jeans': 32,
  'Quần kaki': 33,
  'Quần short': 34,
  'Quần thể thao': 35,
  'Bộ thể thao': 50,
  'Đồ bộ': 51,
  'Set đồ': 52,
};

const normalizeCategoryLabel = (label: string) => label
  .trim()
  .toLocaleLowerCase('vi-VN')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/đ/g, 'd');

const isFootwearCategoryLabel = (label: string) =>
  /(^|[\s/.-])(giay|dep)([\s/.-]|$)/.test(normalizeCategoryLabel(label));

const genderIcons: Record<CatalogGender, MaterialIconName> = {
  male: 'gender-male',
  female: 'gender-female',
  unisex: 'gender-male-female',
};

const getCategoryIconVisual = (label: string): CategoryIconVisual => {
  const normalizedLabel = normalizeCategoryLabel(label);

  if (isFootwearCategoryLabel(label)) return { icon: 'shoe-sneaker' };
  if (normalizedLabel.includes('set') || normalizedLabel.includes('bo')) return { icon: 'layers-triple-outline' };
  if (normalizedLabel.includes('ao')) return { icon: 'tshirt-crew-outline' };
  if (normalizedLabel.includes('quan')) return { custom: 'pants' };
  if (normalizedLabel.includes('vay') || normalizedLabel.includes('dam')) return { icon: 'human-female-dance' };
  return { icon: 'wardrobe-outline' };
};

const PantsGlyph = ({ color, size = 17 }: { color: string; size?: number }) => {
  const stroke = Math.max(2, Math.round(size * 0.09));
  const waistHeight = Math.round(size * 0.22);
  const legTop = Math.round(size * 0.24);
  const legWidth = Math.round(size * 0.29);
  const legHeight = Math.round(size * 0.68);
  const sideInset = Math.round(size * 0.17);
  const pocketTop = Math.round(size * 0.29);

  return (
    <View style={[pantsGlyphStyles.root, { width: size, height: size }]}>
      <View
        style={[
          pantsGlyphStyles.waist,
          {
            left: sideInset,
            width: size - sideInset * 2,
            height: waistHeight,
            borderColor: color,
            borderWidth: stroke,
            borderRadius: Math.round(size * 0.12),
          },
        ]}
      />
      <View
        style={[
          pantsGlyphStyles.leg,
          pantsGlyphStyles.leftLeg,
          {
            top: legTop,
            left: sideInset + 1,
            width: legWidth,
            height: legHeight,
            borderColor: color,
            borderWidth: stroke,
            borderTopWidth: 0,
            borderRadius: Math.round(size * 0.1),
          },
        ]}
      />
      <View
        style={[
          pantsGlyphStyles.leg,
          pantsGlyphStyles.rightLeg,
          {
            top: legTop,
            right: sideInset + 1,
            width: legWidth,
            height: legHeight,
            borderColor: color,
            borderWidth: stroke,
            borderTopWidth: 0,
            borderRadius: Math.round(size * 0.1),
          },
        ]}
      />
      <View
        style={[
          pantsGlyphStyles.fly,
          {
            top: legTop,
            left: Math.round(size / 2 - stroke / 2),
            width: stroke,
            height: Math.round(size * 0.36),
            borderRadius: stroke,
            backgroundColor: color,
          },
        ]}
      />
      <View
        style={[
          pantsGlyphStyles.pocket,
          pantsGlyphStyles.leftPocket,
          {
            top: pocketTop,
            left: Math.round(size * 0.26),
            width: Math.round(size * 0.17),
            height: stroke,
            borderRadius: stroke,
            backgroundColor: color,
          },
        ]}
      />
      <View
        style={[
          pantsGlyphStyles.pocket,
          pantsGlyphStyles.rightPocket,
          {
            top: pocketTop,
            right: Math.round(size * 0.26),
            width: Math.round(size * 0.17),
            height: stroke,
            borderRadius: stroke,
            backgroundColor: color,
          },
        ]}
      />
    </View>
  );
};

const pantsGlyphStyles = StyleSheet.create({
  root: {
    alignItems: 'center',
    position: 'relative',
  },
  waist: {
    position: 'absolute',
    top: 0,
    backgroundColor: 'transparent',
  },
  leg: {
    position: 'absolute',
    backgroundColor: 'transparent',
  },
  leftLeg: {
    transform: [{ rotate: '4deg' }],
  },
  rightLeg: {
    transform: [{ rotate: '-4deg' }],
  },
  fly: {
    position: 'absolute',
  },
  pocket: {
    position: 'absolute',
  },
  leftPocket: {
    transform: [{ rotate: '34deg' }],
  },
  rightPocket: {
    transform: [{ rotate: '-34deg' }],
  },
});

const sortCategories = (categories: CatalogCategory[]) => {
  return [...categories].sort((a, b) => {
    const footwearDelta = Number(isFootwearCategoryLabel(a.name)) - Number(isFootwearCategoryLabel(b.name));
    if (footwearDelta !== 0) return footwearDelta;

    const orderDelta = (categoryOrder[a.name] ?? 999) - (categoryOrder[b.name] ?? 999);
    if (orderDelta !== 0) return orderDelta;

    return a.name.localeCompare(b.name);
  });
};

const CategoryDrawer = ({
  visible,
  categories,
  isLoading,
  onClose,
  onSelectAll,
  onSelectCategory,
}: CategoryDrawerProps) => {
  const [expandedGender, setExpandedGender] = React.useState<CatalogGender | null>(null);
  const [expandedGroupId, setExpandedGroupId] = React.useState<string | null>(null);
  const insets = useSafeAreaInsets();
  const visibleGenders = React.useMemo<CatalogGender[]>(() => {
    const availableGenders = new Set(categories.map((category) => category.gender));
    const defaultGenders: CatalogGender[] = ['male', 'female'];
    const allGenders: CatalogGender[] = ['male', 'female', 'unisex'];

    if (!categories.length) {
      return defaultGenders;
    }

    return allGenders.filter((gender) => availableGenders.has(gender));
  }, [categories]);

  React.useEffect(() => {
    if (!visible) {
      setExpandedGender(null);
      setExpandedGroupId(null);
    }
  }, [visible]);

  const getGroupCategories = React.useCallback((gender: CatalogGender) => {
    const rootCategoryIds = new Set(
      categories
        .filter((category) => category.gender === gender && category.level === 1)
        .map((category) => category._id),
    );

    return sortCategories(
      categories.filter(
        (category) =>
          category.gender === gender &&
          category.level === 2 &&
          (!rootCategoryIds.size || (category.parent_id ? rootCategoryIds.has(category.parent_id) : false)),
      ),
    );
  }, [categories]);

  const getChildCategories = React.useCallback(
    (gender: CatalogGender, parentId: string) =>
      sortCategories(
        categories.filter(
          (category) => category.gender === gender && category.level === 3 && category.parent_id === parentId,
        ),
      ),
    [categories],
  );

  const renderGenderRow = (gender: CatalogGender) => {
    const isExpanded = expandedGender === gender;
    const groupCategories = getGroupCategories(gender);

    return (
      <View key={gender}>
        <TouchableOpacity
          style={[styles.parentRow, isExpanded && styles.parentRowActive]}
          onPress={() => {
            setExpandedGender((current) => (current === gender ? null : gender));
            setExpandedGroupId(null);
          }}
          activeOpacity={0.82}
          accessibilityLabel={`${isExpanded ? 'Thu gọn' : 'Mở'} danh mục ${genderLabels[gender]}`}
        >
          <View style={styles.parentLabel}>
            <View style={[styles.parentIcon, isExpanded && styles.parentIconActive]}>
              <MaterialCommunityIcons
                name={genderIcons[gender]}
                size={17}
                color={isExpanded ? colors.white : colors.brand}
              />
            </View>
            <View style={styles.parentCopy}>
              <Text style={[styles.parentText, isExpanded && styles.parentTextActive]}>
                {genderLabels[gender]}
              </Text>
              <Text style={styles.parentHint}>
                {isExpanded ? 'Đang mở danh mục' : `${groupCategories.length} nhóm sản phẩm`}
              </Text>
            </View>
          </View>
          <MaterialCommunityIcons
            name={isExpanded ? 'chevron-up' : 'chevron-down'}
            size={22}
            color={isExpanded ? colors.brand : colors.text}
          />
        </TouchableOpacity>

        {isExpanded ? (
          <View style={styles.children}>
            {isLoading ? (
              <Text style={styles.loadingText}>Đang tải danh mục...</Text>
            ) : groupCategories.length ? (
              groupCategories.map((group) => {
                const childCategories = getChildCategories(gender, group._id);
                const isGroupExpanded = expandedGroupId === group._id;
                const categoryVisual = getCategoryIconVisual(group.name);

                return (
                  <View key={group._id}>
                    <TouchableOpacity
                      style={[styles.groupRow, isGroupExpanded && styles.groupRowActive]}
                      onPress={() => {
                        if (childCategories.length) {
                          setExpandedGroupId((current) => (current === group._id ? null : group._id));
                          return;
                        }

                        onSelectCategory(group);
                      }}
                      activeOpacity={0.82}
                      accessibilityLabel={`${isGroupExpanded ? 'Thu gọn' : 'Mở'} danh mục ${group.name}`}
                    >
                      <View style={styles.groupLabel}>
                        <View style={[styles.categoryIcon, isGroupExpanded && styles.categoryIconActive]}>
                          {'icon' in categoryVisual ? (
                            <MaterialCommunityIcons
                              name={categoryVisual.icon}
                              size={16}
                              color={isGroupExpanded ? colors.white : colors.brand}
                            />
                          ) : (
                            <PantsGlyph color={isGroupExpanded ? colors.white : colors.brand} />
                          )}
                        </View>
                        <View style={styles.groupCopy}>
                          <Text style={[styles.groupText, isGroupExpanded && styles.groupTextActive]} numberOfLines={1}>
                            {group.name}
                          </Text>
                          <Text style={styles.groupHint}>
                            {childCategories.length ? `${childCategories.length} loại` : 'Xem sản phẩm'}
                          </Text>
                        </View>
                      </View>
                      <MaterialCommunityIcons
                        name={childCategories.length ? (isGroupExpanded ? 'chevron-up' : 'chevron-down') : 'chevron-right'}
                        size={19}
                        color={isGroupExpanded ? colors.brand : colors.textMuted}
                      />
                    </TouchableOpacity>

                    {isGroupExpanded ? (
                      <View style={styles.groupChildren}>
                        {childCategories.map((category) => (
                          <TouchableOpacity
                            key={category._id}
                            style={[styles.childRow, styles.nestedChildRow]}
                            onPress={() => onSelectCategory(category)}
                            activeOpacity={0.82}
                          >
                            <View style={styles.childLabel}>
                              <View style={styles.childDot} />
                              <Text style={styles.childText} numberOfLines={1}>
                                {category.name}
                              </Text>
                            </View>
                            <MaterialCommunityIcons name="chevron-right" size={18} color={colors.textMuted} />
                          </TouchableOpacity>
                        ))}
                      </View>
                    ) : null}
                  </View>
                );
              })
            ) : (
              <Text style={styles.loadingText}>Chưa có danh mục con</Text>
            )}
          </View>
        ) : null}
      </View>
    );
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.root}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={[styles.drawer, { paddingTop: Math.max(insets.top + spacing.md, spacing.xl) }]}>
          <View style={styles.header}>
            <Text style={styles.title}>Danh mục</Text>
            <TouchableOpacity style={styles.closeButton} onPress={onClose} activeOpacity={0.82}>
              <MaterialCommunityIcons name="close" size={22} color={colors.text} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
            <TouchableOpacity style={styles.allProductsButton} onPress={onSelectAll} activeOpacity={0.82}>
              <View style={styles.allProductsIcon}>
                <MaterialCommunityIcons name="view-grid-outline" size={18} color={colors.white} />
              </View>
              <Text style={styles.allProductsText} numberOfLines={1}>
                Xem tất cả sản phẩm
              </Text>
              <MaterialCommunityIcons name="chevron-right" size={20} color={colors.white} />
            </TouchableOpacity>

            <Text style={styles.sectionLabel}>Danh mục theo đối tượng</Text>
            {visibleGenders.map(renderGenderRow)}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    flexDirection: 'row',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  drawer: {
    width: '76%',
    maxWidth: 340,
    height: '100%',
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    borderRightWidth: 1,
    borderRightColor: colors.border,
  },
  header: {
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  title: {
    color: colors.text,
    fontSize: 20,
    lineHeight: 27,
    fontWeight: '800',
  },
  closeButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.brandSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    paddingBottom: spacing.xxl,
  },
  allProductsButton: {
    minHeight: 46,
    borderRadius: radii.sm,
    backgroundColor: colors.brand,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  allProductsIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  allProductsText: {
    flex: 1,
    color: colors.white,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '800',
  },
  sectionLabel: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '800',
    textTransform: 'uppercase',
    marginBottom: spacing.sm,
  },
  parentRow: {
    minHeight: 58,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.field,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    marginBottom: spacing.xs,
  },
  parentRowActive: {
    backgroundColor: colors.brandSoft,
    borderColor: colors.brandPale,
  },
  parentLabel: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  parentIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.brandMist,
    alignItems: 'center',
    justifyContent: 'center',
  },
  parentIconActive: {
    backgroundColor: colors.brand,
  },
  parentCopy: {
    flex: 1,
  },
  parentText: {
    color: colors.text,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '800',
  },
  parentTextActive: {
    color: colors.brand,
  },
  parentHint: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '600',
  },
  children: {
    marginLeft: spacing.md,
    marginBottom: spacing.sm,
    paddingLeft: spacing.sm,
    paddingVertical: spacing.xs,
    borderLeftWidth: 2,
    borderLeftColor: colors.brandPale,
  },
  childRow: {
    minHeight: 40,
    borderRadius: radii.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: spacing.sm,
    paddingRight: spacing.xs,
  },
  groupRow: {
    minHeight: 50,
    borderRadius: radii.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: spacing.sm,
    paddingRight: spacing.xs,
    marginBottom: 2,
  },
  groupRowActive: {
    backgroundColor: colors.brandSoft,
  },
  groupChildren: {
    marginLeft: spacing.md,
    paddingLeft: spacing.sm,
    paddingVertical: 2,
    borderLeftWidth: 1,
    borderLeftColor: colors.brandPale,
  },
  nestedChildRow: {
    backgroundColor: colors.surface,
  },
  groupLabel: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  categoryIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.brandMist,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryIconActive: {
    backgroundColor: colors.brand,
  },
  groupCopy: {
    flex: 1,
  },
  groupText: {
    color: colors.text,
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '800',
  },
  groupTextActive: {
    color: colors.brand,
  },
  groupHint: {
    color: colors.textMuted,
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '600',
  },
  childLabel: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  childDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.brandPale,
  },
  childText: {
    flex: 1,
    color: colors.textBody,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
  },
  loadingText: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
    paddingVertical: spacing.sm,
    paddingLeft: spacing.sm,
  },
});

export default CategoryDrawer;
