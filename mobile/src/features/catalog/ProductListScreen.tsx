import React from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import { brandedHeaderStyles, colors, radii, spacing } from '../../theme';
import type { RootStackParamList } from '../../navigation/AppNavigator';
import { useAuth } from '../auth/AuthContext';
import {
  catalogApi,
  CatalogCategory,
  CatalogGender,
  CatalogProduct,
  ProductListResponse,
  ProductSortOption,
} from './catalogApi';
import ProductCard from './ProductCard';
import ShopNameLogo from '../../components/branding/ShopNameLogo';
import StorefrontBottomNav from '../../components/navigation/StorefrontBottomNav';

type ProductListRouteProp = RouteProp<RootStackParamList, 'ProductList'>;
type ProductListNavigationProp = StackNavigationProp<RootStackParamList, 'ProductList'>;

type MultiFilterKey = 'categoryId' | 'brandId';

type ProductListFilters = {
  gender?: CatalogGender;
  categoryId: string[];
  brandId: string[];
  minPrice?: number;
  maxPrice?: number;
  isSale?: boolean;
  isNew?: boolean;
  sort: ProductSortOption;
};

type ActiveChip = {
  id: string;
  label: string;
  onRemove: () => void;
};

type CategoryFilterOption = {
  key: string;
  label: string;
  categoryIds: string[];
  representative: CatalogCategory;
};

type CategoryFilterGroup = {
  key: string;
  label: string;
  categoryIds: string[];
  representative: CatalogCategory;
  options: CategoryFilterOption[];
};

type CategorySelectionGroup = {
  key: string;
  label: string;
  categoryIds: string[];
};

const PRODUCT_PAGE_LIMIT = 10;

const emptyAvailableFilters: ProductListResponse['filters'] = {
  brands: [],
  colors: [],
  fitTypes: [],
  sizes: [],
  categories: [],
};

const sortOptions: Array<{ label: string; value: ProductSortOption }> = [
  { label: 'Mới nhất', value: 'newest' },
  { label: 'Bán chạy', value: 'best_seller' },
  { label: 'Giá thấp', value: 'price_asc' },
  { label: 'Giá cao', value: 'price_desc' },
];

const genderOptions: Array<{ label: string; value: CatalogGender }> = [
  { label: 'Nam', value: 'male' },
  { label: 'Nữ', value: 'female' },
  { label: 'Unisex', value: 'unisex' },
];

const genderLabels: Record<CatalogGender, string> = {
  male: 'Nam',
  female: 'Nữ',
  unisex: 'Unisex',
};

const pricePresets = [
  { label: 'Tất cả', minPrice: undefined, maxPrice: undefined },
  { label: 'Dưới 200k', minPrice: undefined, maxPrice: 200000 },
  { label: '200k - 500k', minPrice: 200000, maxPrice: 500000 },
  { label: 'Trên 500k', minPrice: 500000, maxPrice: undefined },
];

const uniqueStrings = (values: string[]) =>
  Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));

const toArray = (value?: string | string[]) => {
  if (Array.isArray(value)) {
    return uniqueStrings(value);
  }

  return value ? [value] : [];
};

const toQueryArray = (value: string[]) => (value.length ? value : undefined);

const normalizeFilters = (filters: ProductListFilters): ProductListFilters => ({
  ...filters,
  categoryId: uniqueStrings(filters.categoryId),
  brandId: uniqueStrings(filters.brandId),
});

const createFiltersFromParams = (params?: RootStackParamList['ProductList']): ProductListFilters =>
  normalizeFilters({
    gender: params?.gender,
    categoryId: toArray(params?.categoryId),
    brandId: toArray(params?.brandId),
    minPrice: params?.minPrice,
    maxPrice: params?.maxPrice,
    isSale: params?.isSale,
    isNew: params?.isNew,
    sort: params?.sort ?? 'newest',
  });

const getTitle = (params?: RootStackParamList['ProductList']) => {
  if (params?.title) return params.title;
  if (params?.keyword) return `Tìm kiếm: ${params.keyword}`;
  if (params?.gender === 'male') return 'Thời trang nam';
  if (params?.gender === 'female') return 'Thời trang nữ';
  if (params?.gender === 'unisex') return 'Thời trang unisex';
  return 'Tất cả sản phẩm';
};

const getVisiblePages = (currentPage: number, totalPages: number) => {
  if (totalPages <= 5) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  const pages = [1, currentPage - 1, currentPage, currentPage + 1, totalPages]
    .filter((page) => page >= 1 && page <= totalPages);

  return Array.from(new Set(pages)).sort((a, b) => a - b);
};

const getPriceLabel = (minPrice?: number, maxPrice?: number) => {
  const preset = pricePresets.find((item) => item.minPrice === minPrice && item.maxPrice === maxPrice);

  if (preset) {
    return preset.label;
  }

  if (minPrice !== undefined && maxPrice !== undefined) {
    return `${Math.round(minPrice / 1000)}k - ${Math.round(maxPrice / 1000)}k`;
  }

  if (minPrice !== undefined) {
    return `Trên ${Math.round(minPrice / 1000)}k`;
  }

  if (maxPrice !== undefined) {
    return `Dưới ${Math.round(maxPrice / 1000)}k`;
  }

  return '';
};

const isPricePresetActive = (
  filters: ProductListFilters,
  preset: (typeof pricePresets)[number],
) => filters.minPrice === preset.minPrice && filters.maxPrice === preset.maxPrice;

const sortCategoriesByLevelAndName = (a: CatalogCategory, b: CatalogCategory) => {
  const levelDelta = a.level - b.level;
  if (levelDelta !== 0) return levelDelta;
  return a.name.localeCompare(b.name);
};

const normalizeCategoryKey = (name: string) => name.trim().toLocaleLowerCase('vi-VN');

const getTopFilterCategory = (
  category: CatalogCategory,
  categoryById: Map<string, CatalogCategory>,
) => {
  let currentCategory = category;
  let parentCategory = currentCategory.parent_id ? categoryById.get(currentCategory.parent_id) : undefined;

  while (parentCategory && parentCategory.level > 1) {
    currentCategory = parentCategory;
    parentCategory = currentCategory.parent_id ? categoryById.get(currentCategory.parent_id) : undefined;
  }

  return currentCategory;
};

const buildCategoryFilterGroups = (categories: CatalogCategory[]): CategoryFilterGroup[] => {
  const displayCategories = categories.filter((category) => category.level > 1);
  const categoryById = new Map(categories.map((category) => [category._id, category]));
  const groups = new Map<string, CategoryFilterGroup>();

  displayCategories.forEach((category) => {
    const parent = getTopFilterCategory(category, categoryById);
    const groupKey = normalizeCategoryKey(parent.name);
    const group = groups.get(groupKey) ?? {
      key: groupKey,
      label: parent.name,
      categoryIds: [],
      representative: parent,
      options: [],
    };

    if (!group.categoryIds.includes(parent._id)) {
      group.categoryIds.push(parent._id);
    }

    if (sortCategoriesByLevelAndName(parent, group.representative) < 0) {
      group.representative = parent;
      group.label = parent.name;
    }

    if (category._id !== parent._id) {
      const optionKey = normalizeCategoryKey(category.name);
      let option = group.options.find((item) => item.key === optionKey);

      if (!option) {
        option = {
          key: optionKey,
          label: category.name,
          categoryIds: [],
          representative: category,
        };
        group.options.push(option);
      }

      if (!option.categoryIds.includes(category._id)) {
        option.categoryIds.push(category._id);
      }

      if (sortCategoriesByLevelAndName(category, option.representative) < 0) {
        option.representative = category;
        option.label = category.name;
      }
    }

    groups.set(groupKey, group);
  });

  return Array.from(groups.values())
    .map((group) => ({
      ...group,
      options: group.options.sort((a, b) => sortCategoriesByLevelAndName(a.representative, b.representative)),
    }))
    .sort((a, b) => sortCategoriesByLevelAndName(a.representative, b.representative));
};

const getCategorySelectionGroups = (
  categoryIds: string[],
  categories: CatalogCategory[],
  fallbackTitle?: string,
): CategorySelectionGroup[] => {
  const categoryById = new Map(categories.map((category) => [category._id, category]));
  const groups = new Map<string, CategorySelectionGroup>();

  categoryIds.forEach((categoryId) => {
    const category = categoryById.get(categoryId);
    const label =
      category?.name ?? (categoryIds.length === 1 ? fallbackTitle : undefined) ?? 'Danh mục';
    const key = category ? `${category.level}:${normalizeCategoryKey(category.name)}` : categoryId;
    const group = groups.get(key) ?? { key, label, categoryIds: [] };

    if (!group.categoryIds.includes(categoryId)) {
      group.categoryIds.push(categoryId);
    }

    groups.set(key, group);
  });

  return Array.from(groups.values());
};

const ProductListScreen = () => {
  const navigation = useNavigation<ProductListNavigationProp>();
  const route = useRoute<ProductListRouteProp>();
  const { isAuthenticated } = useAuth();
  const params = route.params;
  const insets = useSafeAreaInsets();
  const [products, setProducts] = React.useState<CatalogProduct[]>([]);
  const [appliedFilters, setAppliedFilters] = React.useState<ProductListFilters>(() =>
    createFiltersFromParams(params),
  );
  const [draftFilters, setDraftFilters] = React.useState<ProductListFilters>(appliedFilters);
  const [availableFilters, setAvailableFilters] =
    React.useState<ProductListResponse['filters']>(emptyAvailableFilters);
  const [isFilterSheetVisible, setIsFilterSheetVisible] = React.useState(false);
  const [page, setPage] = React.useState(1);
  const [totalPages, setTotalPages] = React.useState(0);
  const [totalItems, setTotalItems] = React.useState(0);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const routeFilterKey = React.useMemo(
    () =>
      JSON.stringify({
        brandId: params?.brandId,
        categoryId: params?.categoryId,
        gender: params?.gender,
        isNew: params?.isNew,
        isSale: params?.isSale,
        keyword: params?.keyword,
        maxPrice: params?.maxPrice,
        minPrice: params?.minPrice,
        sort: params?.sort,
      }),
    [params],
  );

  React.useEffect(() => {
    const nextFilters = createFiltersFromParams(params);

    setPage(1);
    setAppliedFilters(nextFilters);
    setDraftFilters(nextFilters);
  }, [params, routeFilterKey]);

  const categorySelectionGroups = React.useMemo(
    () => getCategorySelectionGroups(appliedFilters.categoryId, availableFilters.categories, params?.title),
    [appliedFilters.categoryId, availableFilters.categories, params?.title],
  );

  const activeFilterCount = React.useMemo(() => {
    return (
      (appliedFilters.gender ? 1 : 0) +
      categorySelectionGroups.length +
      appliedFilters.brandId.length +
      (appliedFilters.minPrice !== undefined || appliedFilters.maxPrice !== undefined ? 1 : 0) +
      (appliedFilters.isSale ? 1 : 0) +
      (appliedFilters.isNew ? 1 : 0) +
      (appliedFilters.sort !== 'newest' ? 1 : 0)
    );
  }, [appliedFilters, categorySelectionGroups.length]);

  const categoryFilterGroups = React.useMemo(
    () =>
      buildCategoryFilterGroups(
        draftFilters.gender
          ? availableFilters.categories.filter((category) => category.gender === draftFilters.gender)
          : availableFilters.categories,
      ),
    [availableFilters.categories, draftFilters.gender],
  );

  const visibleGenderOptions = React.useMemo(() => {
    const availableGenders = new Set(availableFilters.categories.map((category) => category.gender));
    const selectedGenders = new Set<CatalogGender>();

    if (appliedFilters.gender) selectedGenders.add(appliedFilters.gender);
    if (draftFilters.gender) selectedGenders.add(draftFilters.gender);

    return genderOptions.filter((option) => {
      if (selectedGenders.has(option.value)) {
        return true;
      }

      if (!availableFilters.categories.length) {
        return option.value !== 'unisex';
      }

      return availableGenders.has(option.value);
    });
  }, [appliedFilters.gender, availableFilters.categories, draftFilters.gender]);

  const updateAppliedFilters = React.useCallback((updater: (current: ProductListFilters) => ProductListFilters) => {
    setAppliedFilters((current) => normalizeFilters(updater(current)));
    setPage(1);
  }, []);

  const getBrandLabel = React.useCallback(
    (brandId: string) =>
      availableFilters.brands.find((brand) => brand._id === brandId)?.name ?? 'Thương hiệu',
    [availableFilters.brands],
  );

  const activeChips = React.useMemo<ActiveChip[]>(() => {
    const chips: ActiveChip[] = [];
    const removeMultiValue = (key: MultiFilterKey, value: string) => {
      updateAppliedFilters((current) => ({
        ...current,
        [key]: current[key].filter((item) => item !== value),
      }));
    };

    if (appliedFilters.gender) {
      chips.push({
        id: `gender-${appliedFilters.gender}`,
        label: genderLabels[appliedFilters.gender],
        onRemove: () => updateAppliedFilters((current) => ({ ...current, gender: undefined })),
      });
    }

    categorySelectionGroups.forEach((categoryGroup) => {
      const categoryIdSet = new Set(categoryGroup.categoryIds);

      chips.push({
        id: `category-${categoryGroup.key}`,
        label: categoryGroup.label,
        onRemove: () =>
          updateAppliedFilters((current) => ({
            ...current,
            categoryId: current.categoryId.filter((item) => !categoryIdSet.has(item)),
          })),
      });
    });

    appliedFilters.brandId.forEach((brandId) => {
      chips.push({
        id: `brand-${brandId}`,
        label: getBrandLabel(brandId),
        onRemove: () => removeMultiValue('brandId', brandId),
      });
    });

    if (appliedFilters.minPrice !== undefined || appliedFilters.maxPrice !== undefined) {
      chips.push({
        id: 'price',
        label: getPriceLabel(appliedFilters.minPrice, appliedFilters.maxPrice),
        onRemove: () =>
          updateAppliedFilters((current) => ({
            ...current,
            minPrice: undefined,
            maxPrice: undefined,
          })),
      });
    }

    if (appliedFilters.isSale) {
      chips.push({
        id: 'sale',
        label: 'Đang sale',
        onRemove: () => updateAppliedFilters((current) => ({ ...current, isSale: undefined })),
      });
    }

    if (appliedFilters.isNew) {
      chips.push({
        id: 'new',
        label: 'Hàng mới',
        onRemove: () => updateAppliedFilters((current) => ({ ...current, isNew: undefined })),
      });
    }

    if (appliedFilters.sort !== 'newest') {
      chips.push({
        id: 'sort',
        label: sortOptions.find((option) => option.value === appliedFilters.sort)?.label ?? 'Sắp xếp',
        onRemove: () => updateAppliedFilters((current) => ({ ...current, sort: 'newest' })),
      });
    }

    return chips;
  }, [appliedFilters, categorySelectionGroups, getBrandLabel, updateAppliedFilters]);

  const loadProducts = React.useCallback(() => {
    let isCurrentRequest = true;

    setIsLoading(true);
    setError(null);

    catalogApi
      .getProducts({
        keyword: params?.keyword,
        gender: appliedFilters.gender,
        categoryId: toQueryArray(appliedFilters.categoryId),
        brandId: toQueryArray(appliedFilters.brandId),
        minPrice: appliedFilters.minPrice,
        maxPrice: appliedFilters.maxPrice,
        isNew: appliedFilters.isNew,
        isSale: appliedFilters.isSale,
        sort: appliedFilters.sort,
        page,
        limit: PRODUCT_PAGE_LIMIT,
      })
      .then((response) => {
        if (!isCurrentRequest) return;

        setProducts(response.items);
        setAvailableFilters(
          response.filters
            ? { ...emptyAvailableFilters, ...response.filters, sizes: response.filters.sizes ?? [] }
            : emptyAvailableFilters,
        );
        setTotalPages(response.pagination.totalPages);
        setTotalItems(response.pagination.totalItems);
      })
      .catch((requestError: unknown) => {
        if (!isCurrentRequest) return;

        setProducts([]);
        setAvailableFilters(emptyAvailableFilters);
        setTotalPages(0);
        setTotalItems(0);
        setError(requestError instanceof Error ? requestError.message : 'Không thể tải sản phẩm');
      })
      .finally(() => {
        if (isCurrentRequest) {
          setIsLoading(false);
        }
      });

    return () => {
      isCurrentRequest = false;
    };
  }, [appliedFilters, page, params?.keyword]);

  React.useEffect(() => loadProducts(), [loadProducts]);

  const openFilterSheet = () => {
    setDraftFilters(appliedFilters);
    setIsFilterSheetVisible(true);
  };

  const applyDraftFilters = () => {
    setAppliedFilters(normalizeFilters(draftFilters));
    setPage(1);
    setIsFilterSheetVisible(false);
  };

  const resetDraftFilters = () => {
    setDraftFilters(createFiltersFromParams({ keyword: params?.keyword, title: params?.title }));
  };

  const getCategoryIdsForGender = React.useCallback(
    (categoryIds: string[], gender?: CatalogGender) => {
      if (!gender) {
        return categoryIds;
      }

      const categoryById = new Map(availableFilters.categories.map((category) => [category._id, category]));

      return categoryIds.filter((categoryId) => categoryById.get(categoryId)?.gender === gender);
    },
    [availableFilters.categories],
  );

  const toggleDraftValues = (key: MultiFilterKey, values: string[]) => {
    setDraftFilters((current) => {
      const currentValues = current[key];
      const valueSet = new Set(values);
      const shouldRemove = values.every((value) => currentValues.includes(value));
      const nextValues = shouldRemove
        ? currentValues.filter((item) => !valueSet.has(item))
        : uniqueStrings([...currentValues, ...values]);

      return {
        ...current,
        [key]: nextValues,
      };
    });
  };

  const toggleDraftValue = (key: MultiFilterKey, value: string) => {
    toggleDraftValues(key, [value]);
  };

  const handleProductPress = (product: CatalogProduct) => {
    if (product._id) {
      navigation.navigate('ProductDetail', { productId: product._id });
    } else {
    Alert.alert('Chi tiết sản phẩm', `${product.name} sẽ được bổ sung ở màn chi tiết sản phẩm.`);
    }
  };

  const handleCartPress = (product: CatalogProduct) => {
    if (product._id) {
      navigation.navigate('ProductDetail', { productId: product._id });
      return;
    }

    Alert.alert('Giỏ hàng', 'Bạn mở chi tiết sản phẩm để chọn màu, size và số lượng trước nha.');
  };

  const renderChoice = (
    label: string,
    isActive: boolean,
    onPress: () => void,
    beforeLabel?: React.ReactNode,
    choiceKey = label,
  ) => (
    <TouchableOpacity
      key={choiceKey}
      style={[styles.choiceChip, isActive && styles.choiceChipActive]}
      onPress={onPress}
      activeOpacity={0.82}
    >
      {beforeLabel}
      <Text style={[styles.choiceText, isActive && styles.choiceTextActive]} numberOfLines={1}>
        {label}
      </Text>
    </TouchableOpacity>
  );

  const renderGroup = (title: string, children: React.ReactNode | null) => {
    if (!children) {
      return null;
    }

    return (
      <View style={styles.filterGroup}>
        <Text style={styles.filterGroupTitle}>{title}</Text>
        {children}
      </View>
    );
  };

  const visiblePages = getVisiblePages(page, totalPages);
  const screenTitle = getTitle(params);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.headerAction}
          onPress={() => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Home'))}
          accessibilityLabel="Trở về"
          activeOpacity={0.8}
        >
          <MaterialCommunityIcons name="arrow-left" size={23} color={colors.white} />
        </TouchableOpacity>

        <View style={styles.titleBlock}>
          <ShopNameLogo compact />
          <Text style={styles.title} numberOfLines={1}>
            {screenTitle}
          </Text>
        </View>

        <TouchableOpacity
          style={styles.headerAction}
          onPress={() => navigation.navigate(isAuthenticated ? 'Profile' : 'Login')}
          accessibilityLabel="Tài khoản"
          activeOpacity={0.8}
        >
          <MaterialCommunityIcons name="account-outline" size={23} color={colors.white} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.summaryRow}>
          <Text style={styles.summaryText}>
            {isLoading ? 'Đang tải sản phẩm...' : `${totalItems} sản phẩm phù hợp`}
          </Text>
        </View>

        <View style={styles.filterToolbar}>
          <TouchableOpacity style={styles.filterButton} onPress={openFilterSheet} activeOpacity={0.82}>
            <MaterialCommunityIcons name="tune-variant" size={18} color={colors.brand} />
            <Text style={styles.filterButtonText}>Bộ lọc</Text>
            {activeFilterCount ? (
              <View style={styles.filterBadge}>
                <Text style={styles.filterBadgeText}>{activeFilterCount}</Text>
              </View>
            ) : null}
          </TouchableOpacity>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.activeChipRow}
          >
            {activeChips.length ? (
              activeChips.map((chip) => (
                <TouchableOpacity
                  key={chip.id}
                  style={styles.activeChip}
                  onPress={chip.onRemove}
                  activeOpacity={0.82}
                >
                  <Text style={styles.activeChipText} numberOfLines={1}>
                    {chip.label}
                  </Text>
                  <MaterialCommunityIcons name="close" size={15} color={colors.brand} />
                </TouchableOpacity>
              ))
            ) : (
              <Text style={styles.filterHint}>Chọn nhiều bộ lọc để tìm đúng món hơn</Text>
            )}
          </ScrollView>
        </View>

        {isLoading ? (
          <View style={styles.statePanel}>
            <ActivityIndicator color={colors.brand} />
            <Text style={styles.stateText}>Đang chuẩn bị danh sách sản phẩm</Text>
          </View>
        ) : error ? (
          <View style={styles.statePanel}>
            <MaterialCommunityIcons name="alert-circle-outline" size={30} color={colors.danger} />
            <Text style={styles.stateTitle}>Không tải được sản phẩm</Text>
            <Text style={styles.stateText}>{error}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={loadProducts} activeOpacity={0.82}>
              <Text style={styles.retryText}>Thử lại</Text>
            </TouchableOpacity>
          </View>
        ) : products.length === 0 ? (
          <View style={styles.statePanel}>
            <MaterialCommunityIcons name="magnify-close" size={32} color={colors.brand} />
            <Text style={styles.stateTitle}>Chưa có sản phẩm phù hợp</Text>
            <Text style={styles.stateText}>Bạn có thể đổi từ khóa hoặc nới bớt bộ lọc đang chọn.</Text>
            <TouchableOpacity
              style={styles.retryButton}
              onPress={() => navigation.navigate('ProductList', { title: 'Tất cả sản phẩm' })}
              activeOpacity={0.82}
            >
              <Text style={styles.retryText}>Xem tất cả</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <View style={styles.grid}>
              {products.map((product) => (
                <View key={product._id} style={styles.gridItem}>
                  <ProductCard
                    product={product}
                    onPress={handleProductPress}
                    onCartPress={handleCartPress}
                  />
                </View>
              ))}
            </View>

            {totalPages > 1 ? (
              <View style={styles.pagination}>
                <TouchableOpacity
                  style={[styles.pageNav, page === 1 && styles.pageDisabled]}
                  onPress={() => setPage((currentPage) => Math.max(currentPage - 1, 1))}
                  disabled={page === 1}
                  activeOpacity={0.82}
                >
                  <MaterialCommunityIcons name="chevron-left" size={19} color={page === 1 ? colors.textSubtle : colors.brand} />
                  <Text style={[styles.pageNavText, page === 1 && styles.pageDisabledText]}>Trước</Text>
                </TouchableOpacity>

                <View style={styles.pageNumbers}>
                  {visiblePages.map((pageNumber, index) => {
                    const previousPage = visiblePages[index - 1];
                    const shouldShowEllipsis = previousPage !== undefined && pageNumber - previousPage > 1;

                    return (
                      <React.Fragment key={pageNumber}>
                        {shouldShowEllipsis ? <Text style={styles.ellipsis}>...</Text> : null}
                        <TouchableOpacity
                          style={[styles.pageButton, page === pageNumber && styles.pageButtonActive]}
                          onPress={() => setPage(pageNumber)}
                          activeOpacity={0.82}
                        >
                          <Text style={[styles.pageText, page === pageNumber && styles.pageTextActive]}>
                            {pageNumber}
                          </Text>
                        </TouchableOpacity>
                      </React.Fragment>
                    );
                  })}
                </View>

                <TouchableOpacity
                  style={[styles.pageNav, page === totalPages && styles.pageDisabled]}
                  onPress={() => setPage((currentPage) => Math.min(currentPage + 1, totalPages))}
                  disabled={page === totalPages}
                  activeOpacity={0.82}
                >
                  <Text style={[styles.pageNavText, page === totalPages && styles.pageDisabledText]}>Sau</Text>
                  <MaterialCommunityIcons name="chevron-right" size={19} color={page === totalPages ? colors.textSubtle : colors.brand} />
                </TouchableOpacity>
              </View>
            ) : null}
          </>
        )}
      </ScrollView>

      <Modal
        visible={isFilterSheetVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setIsFilterSheetVisible(false)}
      >
        <View style={styles.modalRoot}>
          <Pressable style={styles.modalBackdrop} onPress={() => setIsFilterSheetVisible(false)} />
          <View style={[styles.filterSheet, { paddingBottom: Math.max(insets.bottom, spacing.lg) }]}>
            <View style={styles.sheetHeader}>
              <TouchableOpacity onPress={() => setIsFilterSheetVisible(false)} activeOpacity={0.82}>
                <Text style={styles.sheetCancel}>Hủy</Text>
              </TouchableOpacity>
              <Text style={styles.sheetTitle}>Bộ lọc</Text>
              <TouchableOpacity onPress={applyDraftFilters} activeOpacity={0.82}>
                <Text style={styles.sheetApply}>Áp dụng</Text>
              </TouchableOpacity>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.sheetContent}
            >
              {renderGroup(
                'Sắp xếp theo',
                <View style={styles.choiceWrap}>
                  {sortOptions.map((option) =>
                    renderChoice(option.label, draftFilters.sort === option.value, () =>
                      setDraftFilters((current) => ({ ...current, sort: option.value })),
                      undefined,
                      option.value,
                    ),
                  )}
                </View>,
              )}

              {renderGroup(
                'Tình trạng',
                <View style={styles.choiceWrap}>
                  {renderChoice('Hàng mới', Boolean(draftFilters.isNew), () =>
                    setDraftFilters((current) => ({ ...current, isNew: current.isNew ? undefined : true })),
                  )}
                  {renderChoice('Đang sale', Boolean(draftFilters.isSale), () =>
                    setDraftFilters((current) => ({ ...current, isSale: current.isSale ? undefined : true })),
                  )}
                </View>,
              )}

              {renderGroup(
                'Đối tượng',
                <View style={styles.choiceWrap}>
                  {visibleGenderOptions.map((option) =>
                    renderChoice(option.label, draftFilters.gender === option.value, () =>
                      setDraftFilters((current) => {
                        const nextGender = current.gender === option.value ? undefined : option.value;

                        return {
                          ...current,
                          gender: nextGender,
                          categoryId: getCategoryIdsForGender(current.categoryId, nextGender),
                        };
                      }),
                      undefined,
                      option.value,
                    ),
                  )}
                </View>,
              )}

              {renderGroup(
                'Danh mục',
                categoryFilterGroups.length ? (
                  <View style={styles.categoryGroups}>
                    {categoryFilterGroups.map((group) => (
                      <View key={group.key} style={styles.categoryGroup}>
                        <Text style={styles.categoryGroupTitle}>{group.label}</Text>
                        <View style={styles.choiceWrap}>
                          {renderChoice(
                            group.options.length ? `Tất cả ${group.label}` : group.label,
                            group.categoryIds.every((categoryId) => draftFilters.categoryId.includes(categoryId)),
                            () => toggleDraftValues('categoryId', group.categoryIds),
                            undefined,
                            `group-${group.key}`,
                          )}
                          {group.options.map((categoryOption) =>
                            renderChoice(categoryOption.label, categoryOption.categoryIds.every((categoryId) =>
                              draftFilters.categoryId.includes(categoryId),
                            ), () =>
                              toggleDraftValues('categoryId', categoryOption.categoryIds),
                              undefined,
                              `option-${group.key}-${categoryOption.key}`,
                            ),
                          )}
                        </View>
                      </View>
                    ))}
                  </View>
                ) : null,
              )}

              {renderGroup(
                'Thương hiệu',
                availableFilters.brands.length > 1 ? (
                  <View style={styles.choiceWrap}>
                    {availableFilters.brands.map((brand) =>
                      renderChoice(brand.name, draftFilters.brandId.includes(brand._id), () =>
                        toggleDraftValue('brandId', brand._id),
                        undefined,
                        brand._id,
                      ),
                    )}
                  </View>
                ) : null,
              )}

              {renderGroup(
                'Khoảng giá',
                <View style={styles.choiceWrap}>
                  {pricePresets.map((preset) =>
                    renderChoice(preset.label, isPricePresetActive(draftFilters, preset), () =>
                      setDraftFilters((current) => ({
                        ...current,
                        minPrice: preset.minPrice,
                        maxPrice: preset.maxPrice,
                      })),
                    ),
                  )}
                </View>,
              )}

              <TouchableOpacity style={styles.resetButton} onPress={resetDraftFilters} activeOpacity={0.82}>
                <MaterialCommunityIcons name="refresh" size={18} color={colors.brand} />
                <Text style={styles.resetText}>Đặt lại bộ lọc</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
      <StorefrontBottomNav activeTab="catalog" />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.brand,
  },
  header: {
    ...brandedHeaderStyles.container,
  },
  headerAction: {
    ...brandedHeaderStyles.action,
  },
  titleBlock: {
    ...brandedHeaderStyles.titleGroup,
    alignItems: 'center',
  },
  brand: {
    color: colors.brandMist,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
  },
  title: {
    ...brandedHeaderStyles.title,
  },
  content: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    padding: spacing.md,
    paddingBottom: spacing.xxl,
  },
  summaryRow: {
    minHeight: 28,
    justifyContent: 'center',
  },
  summaryText: {
    color: colors.text,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
  },
  filterToolbar: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  filterButton: {
    height: 38,
    borderRadius: radii.xs,
    borderWidth: 1,
    borderColor: colors.brand,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },
  filterButtonText: {
    color: colors.brand,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '800',
  },
  filterBadge: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
  },
  filterBadgeText: {
    color: colors.white,
    fontSize: 10,
    lineHeight: 13,
    fontWeight: '800',
  },
  activeChipRow: {
    minHeight: 38,
    alignItems: 'center',
    gap: spacing.sm,
    paddingRight: spacing.sm,
  },
  activeChip: {
    maxWidth: 150,
    height: 34,
    borderRadius: radii.pill,
    backgroundColor: colors.brandSoft,
    borderWidth: 1,
    borderColor: colors.brandPale,
    paddingHorizontal: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  activeChipText: {
    flexShrink: 1,
    color: colors.brand,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '800',
  },
  filterHint: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '600',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  gridItem: {
    width: '47.5%',
  },
  statePanel: {
    minHeight: 230,
    borderRadius: radii.sm,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    marginTop: spacing.sm,
  },
  stateTitle: {
    color: colors.text,
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '800',
    marginTop: spacing.md,
    textAlign: 'center',
  },
  stateText: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  retryButton: {
    minHeight: 38,
    borderRadius: radii.xs,
    backgroundColor: colors.brand,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.lg,
  },
  retryText: {
    color: colors.white,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '800',
  },
  pagination: {
    marginTop: spacing.xl,
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  pageNav: {
    minWidth: 76,
    height: 38,
    borderRadius: radii.xs,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
  },
  pageDisabled: {
    backgroundColor: colors.field,
  },
  pageNavText: {
    color: colors.brand,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '800',
  },
  pageDisabledText: {
    color: colors.textSubtle,
  },
  pageNumbers: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },
  pageButton: {
    width: 34,
    height: 34,
    borderRadius: radii.xs,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pageButtonActive: {
    backgroundColor: colors.brand,
    borderColor: colors.brand,
  },
  pageText: {
    color: colors.text,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '800',
  },
  pageTextActive: {
    color: colors.white,
  },
  ellipsis: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
  },
  modalRoot: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.34)',
  },
  filterSheet: {
    maxHeight: '82%',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
  },
  sheetHeader: {
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sheetCancel: {
    color: colors.text,
    fontSize: 17,
    lineHeight: 23,
    fontWeight: '500',
  },
  sheetTitle: {
    color: colors.text,
    fontSize: 20,
    lineHeight: 27,
    fontWeight: '800',
  },
  sheetApply: {
    color: colors.danger,
    fontSize: 17,
    lineHeight: 23,
    fontWeight: '800',
  },
  sheetContent: {
    paddingTop: spacing.lg,
    paddingBottom: spacing.lg,
  },
  filterGroup: {
    marginBottom: spacing.xl,
  },
  filterGroupTitle: {
    color: colors.text,
    fontSize: 17,
    lineHeight: 23,
    fontWeight: '800',
    marginBottom: spacing.md,
  },
  choiceWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  categoryGroups: {
    gap: spacing.lg,
  },
  categoryGroup: {
    gap: spacing.sm,
  },
  categoryGroupTitle: {
    color: colors.text,
    fontSize: 14,
    lineHeight: 19,
    fontWeight: '800',
  },
  choiceChip: {
    minHeight: 42,
    maxWidth: '100%',
    borderRadius: radii.xs,
    backgroundColor: colors.field,
    borderWidth: 1,
    borderColor: colors.field,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  choiceChipActive: {
    borderColor: colors.black,
    backgroundColor: colors.surface,
  },
  choiceText: {
    flexShrink: 1,
    color: colors.textMuted,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '700',
  },
  choiceTextActive: {
    color: colors.black,
    fontWeight: '800',
  },
  resetButton: {
    minHeight: 42,
    borderRadius: radii.xs,
    borderWidth: 1,
    borderColor: colors.brandPale,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  resetText: {
    color: colors.brand,
    fontSize: 14,
    lineHeight: 19,
    fontWeight: '800',
  },
});

export default ProductListScreen;
