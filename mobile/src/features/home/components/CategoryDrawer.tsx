import React from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, radii, spacing } from '../../../theme';
import type { CatalogCategory, CatalogGender } from '../../catalog/catalogApi';

type CategoryDrawerProps = {
  visible: boolean;
  categories: CatalogCategory[];
  isLoading?: boolean;
  onClose: () => void;
  onSelectAll: () => void;
  onSelectGender: (gender: CatalogGender) => void;
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
  onSelectGender,
  onSelectCategory,
}: CategoryDrawerProps) => {
  const [selectedGender, setSelectedGender] = React.useState<CatalogGender | null>(null);
  const [selectedGroupId, setSelectedGroupId] = React.useState<string | null>(null);
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
      setSelectedGender(null);
      setSelectedGroupId(null);
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

  const renderBackRow = (label: string, onPress: () => void, accessibilityLabel: string) => (
    <TouchableOpacity
      style={[styles.parentRow, styles.parentRowActive]}
      onPress={onPress}
      activeOpacity={0.82}
      accessibilityLabel={accessibilityLabel}
    >
      <View style={styles.backLabel}>
        <MaterialCommunityIcons name="chevron-left" size={22} color={colors.brand} />
        <Text style={[styles.parentText, styles.parentTextActive]} numberOfLines={1}>
          {label}
        </Text>
      </View>
    </TouchableOpacity>
  );

  const renderGenderRow = (gender: CatalogGender) => (
    <TouchableOpacity
      key={gender}
      style={styles.parentRow}
      onPress={() => {
        setSelectedGender(gender);
        setSelectedGroupId(null);
      }}
      activeOpacity={0.82}
      accessibilityLabel={`Mở danh mục ${genderLabels[gender]}`}
    >
      <Text style={styles.parentText}>{genderLabels[gender]}</Text>
      <MaterialCommunityIcons name="chevron-right" size={22} color={colors.text} />
    </TouchableOpacity>
  );

  const renderGenderLevel = (gender: CatalogGender) => {
    const groupCategories = getGroupCategories(gender);

    return (
      <>
        {renderBackRow(genderLabels[gender], () => {
          setSelectedGender(null);
          setSelectedGroupId(null);
        }, 'Quay lại chọn đối tượng')}

        <View style={styles.children}>
          <TouchableOpacity
            style={styles.childRow}
            onPress={() => onSelectGender(gender)}
            activeOpacity={0.82}
          >
            <Text style={styles.childText}>Tất cả {genderLabels[gender].toLowerCase()}</Text>
            <MaterialCommunityIcons name="chevron-right" size={19} color={colors.textMuted} />
          </TouchableOpacity>

          {isLoading ? (
            <Text style={styles.loadingText}>Đang tải danh mục...</Text>
          ) : groupCategories.length ? (
            groupCategories.map((group) => {
              const childCategories = getChildCategories(gender, group._id);

              return (
                <TouchableOpacity
                  key={group._id}
                  style={styles.groupRow}
                  onPress={() => {
                    if (childCategories.length) {
                      setSelectedGroupId(group._id);
                      return;
                    }

                    onSelectCategory(group);
                  }}
                  activeOpacity={0.82}
                  accessibilityLabel={`Mở danh mục ${group.name}`}
                >
                  <Text style={styles.groupText} numberOfLines={1}>
                    {group.name}
                  </Text>
                  <MaterialCommunityIcons name="chevron-right" size={19} color={colors.textMuted} />
                </TouchableOpacity>
              );
            })
          ) : (
            <Text style={styles.loadingText}>Chưa có danh mục con</Text>
          )}
        </View>
      </>
    );
  };

  const renderGroupLevel = (gender: CatalogGender, groupId: string) => {
    const group = categories.find((category) => category._id === groupId && category.gender === gender);

    if (!group) {
      return renderGenderLevel(gender);
    }

    const childCategories = getChildCategories(gender, group._id);

    return (
      <>
        {renderBackRow(group.name, () => setSelectedGroupId(null), `Quay lại danh mục ${genderLabels[gender]}`)}

        <View style={styles.children}>
          <TouchableOpacity
            style={styles.childRow}
            onPress={() => onSelectCategory(group)}
            activeOpacity={0.82}
          >
            <Text style={styles.childText} numberOfLines={1}>
              Tất cả {group.name}
            </Text>
            <MaterialCommunityIcons name="chevron-right" size={19} color={colors.textMuted} />
          </TouchableOpacity>

          {isLoading ? (
            <Text style={styles.loadingText}>Đang tải danh mục...</Text>
          ) : childCategories.length ? (
            childCategories.map((category) => (
              <TouchableOpacity
                key={category._id}
                style={styles.childRow}
                onPress={() => onSelectCategory(category)}
                activeOpacity={0.82}
              >
                <Text style={styles.childText} numberOfLines={1}>
                  {category.name}
                </Text>
                <MaterialCommunityIcons name="chevron-right" size={18} color={colors.textMuted} />
              </TouchableOpacity>
            ))
          ) : (
            <Text style={styles.loadingText}>Chưa có danh mục con</Text>
          )}
        </View>
      </>
    );
  };

  const renderSelectedLevel = () => {
    if (!selectedGender) {
      return visibleGenders.map(renderGenderRow);
    }

    if (selectedGroupId) {
      return renderGroupLevel(selectedGender, selectedGroupId);
    }

    return renderGenderLevel(selectedGender);
  };

  const sectionLabel = selectedGroupId
    ? 'Chọn loại sản phẩm'
    : selectedGender
      ? `Danh mục ${genderLabels[selectedGender].toLowerCase()}`
      : 'Danh mục theo đối tượng';

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

            <Text style={styles.sectionLabel}>{sectionLabel}</Text>
            {renderSelectedLevel()}
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
    minHeight: 44,
    borderRadius: radii.xs,
    backgroundColor: colors.brand,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    marginBottom: spacing.lg,
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
    marginBottom: spacing.xs,
  },
  parentRow: {
    minHeight: 46,
    borderRadius: radii.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.sm,
  },
  parentRowActive: {
    backgroundColor: colors.brandSoft,
    borderBottomColor: colors.brandPale,
  },
  backLabel: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  parentText: {
    flex: 1,
    color: colors.text,
    fontSize: 15,
    lineHeight: 21,
    fontWeight: '800',
  },
  parentTextActive: {
    color: colors.brand,
  },
  children: {
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  childRow: {
    minHeight: 38,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: spacing.sm,
  },
  groupRow: {
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: spacing.sm,
    paddingRight: 2,
  },
  groupText: {
    flex: 1,
    color: colors.text,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '800',
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
