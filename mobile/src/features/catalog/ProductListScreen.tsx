import React from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  FlatList,
  Image,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import type { LayoutChangeEvent, NativeScrollEvent, NativeSyntheticEvent } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { RouteProp, useIsFocused, useNavigation, useRoute } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import { brandedHeaderStyles, colors, radii, shadows, spacing } from '../../theme';
import type { RootStackParamList } from '../../navigation/AppNavigator';
import { resolveFocusRefreshMode, useStaleFocusEffect } from '../../hooks/useStaleFocusEffect';
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
import StorefrontBottomNav from '../../components/navigation/StorefrontBottomNav';
import {
  interactionApi,
  type InteractionPayload,
} from '../recommendation/interactionApi';
import { useCustomerNotifications } from '../notifications/CustomerNotificationProvider';
import { readScreenData, writeScreenData } from '../../config/screenDataCache';

type ProductListRouteProp = RouteProp<RootStackParamList, 'ProductList'>;
type ProductListNavigationProp = StackNavigationProp<RootStackParamList, 'ProductList'>;
type MaterialIconName = keyof typeof MaterialCommunityIcons.glyphMap;

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

const PRODUCT_PAGE_LIMIT = 30;
const SCROLL_TOP_VISIBILITY_OFFSET = 360;
const STOREFRONT_BOTTOM_NAV_HEIGHT = 70;
const discoveryImages = {
  male: require('../../../assets/discovery-male-model-v2.png'),
  female: require('../../../assets/discovery-female-model-v2.png'),
} as const;

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

const getCategoryGroupSelectionIds = (group: CategoryFilterGroup) => uniqueStrings([
  ...group.categoryIds,
  ...group.options.flatMap((option) => option.categoryIds),
]);

const normalizeCategoryLabel = (label: string) => label
  .trim()
  .toLocaleLowerCase('vi-VN')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/đ/g, 'd');

const getCategoryRailIcon = (label: string): MaterialIconName => {
  const normalizedLabel = normalizeCategoryLabel(label);

  if (normalizedLabel.includes('giay') || normalizedLabel.includes('dep')) return 'shoe-sneaker';
  if (normalizedLabel.includes('set') || normalizedLabel.includes('bo')) return 'layers-triple-outline';
  if (normalizedLabel.includes('ao')) return 'tshirt-crew-outline';
  if (normalizedLabel.includes('quan')) return 'hanger';
  return 'wardrobe-outline';
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

const discoveryGenderOptions = [
  { label: 'Tất cả', value: undefined, icon: 'account-group-outline' },
  { label: 'Nam', value: 'male', icon: 'gender-male' },
  { label: 'Nữ', value: 'female', icon: 'gender-female' },
] as const;

const getProductQueryKey = (
  filters: ProductListFilters,
  params: ProductListRouteProp['params'],
  accountScope: string,
) => JSON.stringify({
  accountScope,
  appliedFilters: filters,
  keyword: params?.keyword,
});

const getProductListCacheKey = (queryKey: string) => `catalog:list:${queryKey}`;

const ProductListScreen = () => {
  const navigation = useNavigation<ProductListNavigationProp>();
  const route = useRoute<ProductListRouteProp>();
  const isFocused = useIsFocused();
  const { isAuthenticated, runWithAuth, session } = useAuth();
  const { summary: notificationSummary } = useCustomerNotifications();
  const params = route.params;
  const hasScopedCatalogRequest = Boolean(
    params?.keyword
      || params?.gender
      || params?.categoryId
      || params?.brandId
      || params?.minPrice !== undefined
      || params?.maxPrice !== undefined
      || params?.isSale
      || params?.isNew
      || params?.sort,
  );
  const opensAtDiscoveryProducts = params?.discoveryEntry === 'products';
  const showDiscoveryExperience = opensAtDiscoveryProducts || !hasScopedCatalogRequest;
  const accountScope = session?.user?._id ?? 'guest';
  const initialFiltersRef = React.useRef(createFiltersFromParams(params));
  const initialProductQueryKeyRef = React.useRef(
    getProductQueryKey(initialFiltersRef.current, params, accountScope),
  );
  const initialProductListRef = React.useRef(
    readScreenData<ProductListResponse>(getProductListCacheKey(initialProductQueryKeyRef.current)),
  );
  const insets = useSafeAreaInsets();
  const productListRef = React.useRef<FlatList<CatalogProduct>>(null);
  const catalogHeadingOffsetRef = React.useRef<number | null>(null);
  const shouldScrollToCatalogRef = React.useRef(opensAtDiscoveryProducts);
  const requestIdRef = React.useRef(0);
  const isRequestInFlightRef = React.useRef(false);
  const loadedProductQueryKeyRef = React.useRef<string | null>(
    initialProductListRef.current ? initialProductQueryKeyRef.current : null,
  );
  const [products, setProducts] = React.useState<CatalogProduct[]>(initialProductListRef.current?.items ?? []);
  const [appliedFilters, setAppliedFilters] = React.useState<ProductListFilters>(() =>
    initialFiltersRef.current,
  );
  const [draftFilters, setDraftFilters] = React.useState<ProductListFilters>(appliedFilters);
  const [availableFilters, setAvailableFilters] =
    React.useState<ProductListResponse['filters']>(
      initialProductListRef.current?.filters ?? emptyAvailableFilters,
    );
  const [isFilterSheetVisible, setIsFilterSheetVisible] = React.useState(false);
  const [page, setPage] = React.useState(initialProductListRef.current?.pagination.page ?? 1);
  const [totalPages, setTotalPages] = React.useState(initialProductListRef.current?.pagination.totalPages ?? 0);
  const [totalItems, setTotalItems] = React.useState(initialProductListRef.current?.pagination.totalItems ?? 0);
  const [isLoading, setIsLoading] = React.useState(!initialProductListRef.current);
  const [isRefreshing, setIsRefreshing] = React.useState(false);
  const [isLoadingMore, setIsLoadingMore] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [loadMoreError, setLoadMoreError] = React.useState<string | null>(null);
  const [showScrollTop, setShowScrollTop] = React.useState(false);
  const heroReveal = React.useRef(new Animated.Value(0)).current;
  const garmentFloat = React.useRef(new Animated.Value(0)).current;

  const routeFilterKey = React.useMemo(
    () =>
      JSON.stringify({
        brandId: params?.brandId,
        categoryId: params?.categoryId,
        gender: params?.gender,
        isNew: params?.isNew,
        isSale: params?.isSale,
        keyword: params?.keyword,
        searchEventId: params?.searchEventId,
        searchSource: params?.searchSource,
        maxPrice: params?.maxPrice,
        minPrice: params?.minPrice,
        sort: params?.sort,
        discoveryEntry: params?.discoveryEntry,
      }),
    [params],
  );

  const scrollToTop = React.useCallback((animated = true) => {
    productListRef.current?.scrollToOffset({ offset: 0, animated });
  }, []);

  const scrollToCatalogHeading = React.useCallback((catalogHeadingOffset: number) => {
    requestAnimationFrame(() => {
      productListRef.current?.scrollToOffset({
        offset: Math.max(catalogHeadingOffset - spacing.md, 0),
        animated: false,
      });
    });
  }, []);

  React.useEffect(() => {
    const nextFilters = createFiltersFromParams(params);

    setPage(1);
    setLoadMoreError(null);
    setAppliedFilters(nextFilters);
    setDraftFilters(nextFilters);
    scrollToTop(false);
    shouldScrollToCatalogRef.current = opensAtDiscoveryProducts;
  }, [opensAtDiscoveryProducts, params, routeFilterKey, scrollToTop]);

  const handleCatalogHeadingLayout = React.useCallback((event: LayoutChangeEvent) => {
    const catalogHeadingOffset = event.nativeEvent.layout.y;

    catalogHeadingOffsetRef.current = catalogHeadingOffset;
    if (!shouldScrollToCatalogRef.current || isLoading) return;

    shouldScrollToCatalogRef.current = false;
    scrollToCatalogHeading(catalogHeadingOffset);
  }, [isLoading, scrollToCatalogHeading]);

  React.useEffect(() => {
    if (isLoading || !shouldScrollToCatalogRef.current || catalogHeadingOffsetRef.current === null) {
      return;
    }

    shouldScrollToCatalogRef.current = false;
    scrollToCatalogHeading(catalogHeadingOffsetRef.current);
  }, [isLoading, scrollToCatalogHeading]);

  React.useEffect(() => {
    if (!isFocused) {
      return;
    }

    const revealAnimation = Animated.timing(heroReveal, {
      toValue: 1,
      duration: 460,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    const floatAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(garmentFloat, {
          toValue: 1,
          duration: 1500,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(garmentFloat, {
          toValue: 0,
          duration: 1500,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );

    revealAnimation.start();
    floatAnimation.start();

    return () => {
      revealAnimation.stop();
      floatAnimation.stop();
    };
  }, [garmentFloat, heroReveal, isFocused]);

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
      (appliedFilters.isNew ? 1 : 0)
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

  const categoryRailGroups = React.useMemo(
    () =>
      buildCategoryFilterGroups(
        appliedFilters.gender
          ? availableFilters.categories.filter((category) => category.gender === appliedFilters.gender)
          : availableFilters.categories,
      ),
    [appliedFilters.gender, availableFilters.categories],
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
    setLoadMoreError(null);
    setAppliedFilters((current) => normalizeFilters(updater(current)));
    setPage(1);
    scrollToTop();
  }, [scrollToTop]);

  const clearAppliedFilters = React.useCallback(() => {
    const nextFilters = createFiltersFromParams({ keyword: params?.keyword, title: params?.title });

    setLoadMoreError(null);
    setAppliedFilters(nextFilters);
    setDraftFilters(nextFilters);
    setPage(1);
    scrollToTop();
  }, [params?.keyword, params?.title, scrollToTop]);

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

    return chips;
  }, [appliedFilters, categorySelectionGroups, getBrandLabel, updateAppliedFilters]);

  const loadProducts = React.useCallback((
    targetPage = 1,
    backgroundMode: 'refresh' | 'silent' = 'refresh',
  ) => {
    const controller = new AbortController();
    const isFirstPage = targetPage === 1;
    const requestId = requestIdRef.current + 1;
    const productQueryKey = getProductQueryKey(appliedFilters, params, accountScope);
    const firstPageMode = resolveFocusRefreshMode(
      loadedProductQueryKeyRef.current,
      productQueryKey,
      backgroundMode,
    );

    requestIdRef.current = requestId;
    isRequestInFlightRef.current = true;

    if (isFirstPage) {
      setIsLoading(firstPageMode === 'loading');
      setIsRefreshing(firstPageMode === 'refresh');
      setIsLoadingMore(false);
      setError(null);
    } else {
      setIsLoadingMore(true);
    }

    setLoadMoreError(null);

    const productListParams = {
      keyword: params?.keyword,
      searchEventId: params?.searchEventId,
      searchSource: params?.searchSource,
      gender: appliedFilters.gender,
      categoryId: toQueryArray(appliedFilters.categoryId),
      brandId: toQueryArray(appliedFilters.brandId),
      minPrice: appliedFilters.minPrice,
      maxPrice: appliedFilters.maxPrice,
      isNew: appliedFilters.isNew,
      isSale: appliedFilters.isSale,
      sort: appliedFilters.sort,
      page: targetPage,
      limit: PRODUCT_PAGE_LIMIT,
    };
    const request = isAuthenticated
      ? runWithAuth((accessToken) =>
          catalogApi.getProducts(productListParams, controller.signal, accessToken))
      : catalogApi.getProducts(productListParams, controller.signal);

    request
      .then((response) => {
        if (controller.signal.aborted || requestIdRef.current !== requestId) return;

        setProducts((currentProducts) => {
          if (isFirstPage) {
            return response.items;
          }

          const existingProductIds = new Set(currentProducts.map((product) => product._id));
          const nextProducts = response.items.filter((product) => !existingProductIds.has(product._id));

          return [...currentProducts, ...nextProducts];
        });
        setAvailableFilters(
          response.filters
            ? { ...emptyAvailableFilters, ...response.filters, sizes: response.filters.sizes ?? [] }
            : emptyAvailableFilters,
        );
        setTotalPages(response.pagination.totalPages);
        setTotalItems(response.pagination.totalItems);
        setPage(response.pagination.page);
        if (isFirstPage) {
          loadedProductQueryKeyRef.current = productQueryKey;
          writeScreenData(getProductListCacheKey(productQueryKey), response);
        }
      })
      .catch((requestError: unknown) => {
        if (controller.signal.aborted || requestIdRef.current !== requestId) return;

        const message = requestError instanceof Error ? requestError.message : 'Không thể tải sản phẩm';

        if (isFirstPage) {
          if (firstPageMode === 'loading') {
            setProducts([]);
            setAvailableFilters(emptyAvailableFilters);
            setTotalPages(0);
            setTotalItems(0);
            setError(message);
          } else if (firstPageMode === 'refresh') {
            Alert.alert('Chưa cập nhật được sản phẩm', message);
          }
        } else {
          setLoadMoreError(message);
        }
      })
      .finally(() => {
        if (controller.signal.aborted || requestIdRef.current !== requestId) {
          return;
        }

        if (isFirstPage) {
          setIsLoading(false);
          setIsRefreshing(false);
        } else {
          setIsLoadingMore(false);
        }

        isRequestInFlightRef.current = false;
      });

    return () => {
      controller.abort();
    };
  }, [
    appliedFilters,
    accountScope,
    isAuthenticated,
    params?.keyword,
    params?.searchEventId,
    params?.searchSource,
    runWithAuth,
  ]);

  useStaleFocusEffect(
    () => loadProducts(1, 'silent'),
    [loadProducts],
    { cacheScope: 'catalog:list:', runOnDepsChange: true, staleMs: 60 * 1000 },
  );

  const openFilterSheet = () => {
    setDraftFilters(appliedFilters);
    setIsFilterSheetVisible(true);
  };

  const applyDraftFilters = () => {
    setLoadMoreError(null);
    setAppliedFilters(normalizeFilters(draftFilters));
    setPage(1);
    setIsFilterSheetVisible(false);
    scrollToTop();
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

  const selectDiscoveryGender = React.useCallback((gender?: CatalogGender) => {
    updateAppliedFilters((current) => ({
      ...current,
      gender: current.gender === gender ? undefined : gender,
      categoryId: [],
    }));
  }, [updateAppliedFilters]);

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

  const recordInteraction = React.useCallback((payload: InteractionPayload) => {
    if (isAuthenticated) {
      void runWithAuth((accessToken) =>
        interactionApi.recordInteraction(payload, accessToken)).catch(() => undefined);
      return;
    }

    void interactionApi.recordInteraction(payload).catch(() => undefined);
  }, [isAuthenticated, runWithAuth]);

  const recordSearchResultClick = (product: CatalogProduct) => {
    const keyword = params?.keyword?.trim();
    if (!keyword) return;

    const rank = products.findIndex((item) => item._id === product._id) + 1;
    recordInteraction({
      productId: product._id,
      actionType: 'search_result_click',
      source: 'search',
      metadata: {
        keyword,
        ...(rank > 0 ? { rank } : {}),
      },
    });
  };

  const handleProductPress = (product: CatalogProduct) => {
    if (product._id) {
      recordSearchResultClick(product);
      navigation.navigate('ProductDetail', { productId: product._id });
    } else {
    Alert.alert('Chi tiết sản phẩm', `${product.name} sẽ được bổ sung ở màn chi tiết sản phẩm.`);
    }
  };

  const handleCartPress = (product: CatalogProduct) => {
    if (product._id) {
      recordSearchResultClick(product);
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

  const hasMoreProducts = page < totalPages;
  const loadMoreProducts = React.useCallback(() => {
    if (isRequestInFlightRef.current || isLoading || isRefreshing || isLoadingMore || !hasMoreProducts) {
      return;
    }

    setLoadMoreError(null);
    loadProducts(page + 1);
  }, [hasMoreProducts, isLoading, isLoadingMore, isRefreshing, loadProducts, page]);

  const handleCatalogScroll = React.useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const { contentOffset } = event.nativeEvent;
      const shouldShowScrollTop = contentOffset.y > SCROLL_TOP_VISIBILITY_OFFSET;

      setShowScrollTop((current) => (current === shouldShowScrollTop ? current : shouldShowScrollTop));
    },
    [],
  );

  const screenTitle = getTitle(params);
  const headerTitle = params?.keyword ? 'Tìm kiếm' : 'Sản phẩm';
  const selectedGenderLabel = appliedFilters.gender
    ? genderLabels[appliedFilters.gender].toLocaleUpperCase('vi-VN')
    : 'MỌI PHONG CÁCH';
  const activeCategoryRailGroupKey = categoryRailGroups.find((group) =>
    getCategoryGroupSelectionIds(group).some((categoryId) => appliedFilters.categoryId.includes(categoryId)),
  )?.key;
  const isAllCategoryRailActive = !activeCategoryRailGroupKey;

  const renderGenderSpotlight = (gender: 'male' | 'female') => {
    const isMale = gender === 'male';
    const active = appliedFilters.gender === gender;
    const muted = Boolean(appliedFilters.gender && !active);
    const label = isMale ? 'NAM' : 'NỮ';

    return (
      <TouchableOpacity
        key={gender}
        style={[
          styles.genderCard,
          isMale ? styles.genderCardMale : styles.genderCardFemale,
          muted && styles.genderCardMuted,
          active && styles.genderCardActive,
        ]}
        onPress={() => selectDiscoveryGender(gender)}
        accessibilityRole="button"
        accessibilityState={{ selected: active }}
        accessibilityLabel={`Xem thời trang ${label.toLocaleLowerCase('vi-VN')}`}
        activeOpacity={0.88}
      >
        {active ? (
          <View style={styles.genderSelectedBadge}>
            <MaterialCommunityIcons name="check" size={11} color={colors.white} />
            <Text style={styles.genderSelectedBadgeText}>Đang chọn</Text>
          </View>
        ) : null}
        <View style={styles.genderCardCopy}>
          <View style={[styles.genderIcon, !isMale && styles.genderIconFemale]}>
            <MaterialCommunityIcons
              name={isMale ? 'gender-male' : 'gender-female'}
              size={15}
              color={isMale ? colors.brandDark : '#9B4C55'}
            />
          </View>
          <Text style={[styles.genderLabel, !isMale && styles.genderLabelFemale]}>{label}</Text>
          <Text style={[styles.genderCaption, !isMale && styles.genderCaptionFemale]}>
            {isMale ? 'Gọn · chất · hiện đại' : 'Mềm · nổi bật · tự tin'}
          </Text>
          <View style={[styles.genderArrow, !isMale && styles.genderArrowFemale]}>
            <MaterialCommunityIcons
              name={active ? 'check' : 'arrow-top-right'}
              size={14}
              color={isMale ? colors.brandDark : '#9B4C55'}
            />
          </View>
        </View>

        <View style={styles.genderImageFrame}>
          <Image source={discoveryImages[gender]} style={styles.genderImage} resizeMode="cover" />
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <View style={styles.headerEdge}>
          <TouchableOpacity
            style={styles.headerAction}
            onPress={() => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Home'))}
            accessibilityLabel="Trở về"
            activeOpacity={0.8}
          >
            <MaterialCommunityIcons name="arrow-left" size={23} color={colors.white} />
          </TouchableOpacity>
        </View>

        <View style={styles.titleBlock}>
          <Text style={styles.title} numberOfLines={1}>
            {headerTitle}
          </Text>
        </View>

        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.headerAction}
            onPress={() => navigation.navigate('Search')}
            accessibilityLabel="Tìm kiếm sản phẩm"
            activeOpacity={0.8}
          >
            <MaterialCommunityIcons name="magnify" size={23} color={colors.white} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.headerAction}
            onPress={() => navigation.navigate(isAuthenticated ? 'Favorites' : 'Login')}
            accessibilityLabel="Sản phẩm yêu thích"
            activeOpacity={0.8}
          >
            <MaterialCommunityIcons name="heart-outline" size={23} color={colors.white} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.headerAction}
            onPress={() => navigation.navigate(isAuthenticated ? 'Cart' : 'Login')}
            accessibilityLabel={notificationSummary?.cartItems
              ? `Giỏ hàng, ${notificationSummary.cartItems} sản phẩm`
              : 'Giỏ hàng'}
            activeOpacity={0.8}
          >
            <MaterialCommunityIcons name="cart-outline" size={23} color={colors.white} />
            {notificationSummary?.cartItems ? (
              <View style={styles.cartBadge}>
                <Text style={styles.cartBadgeText}>
                  {notificationSummary.cartItems > 99 ? '99+' : notificationSummary.cartItems}
                </Text>
              </View>
            ) : null}
          </TouchableOpacity>
        </View>
      </View>

      <FlatList
        ref={productListRef}
        data={!isLoading && !error ? products : []}
        keyExtractor={(product) => product._id}
        renderItem={({ item, index }) => (
          <View style={styles.gridItem}>
            <ProductCard
              product={item}
              animationIndex={index}
              onPress={handleProductPress}
              onCartPress={handleCartPress}
            />
          </View>
        )}
        numColumns={2}
        columnWrapperStyle={styles.grid}
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={(
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={() => { void loadProducts(1); }}
            colors={[colors.brand]}
            tintColor={colors.brand}
          />
        )}
        onScroll={handleCatalogScroll}
        onEndReached={loadMoreProducts}
        onEndReachedThreshold={0.35}
        scrollEventThrottle={16}
        initialNumToRender={8}
        maxToRenderPerBatch={8}
        windowSize={5}
        ListHeaderComponent={(
          <>
        {showDiscoveryExperience ? (
          <>
            <Animated.View
              style={[
                styles.discoveryHero,
                {
                  opacity: heroReveal,
                  transform: [{
                    translateY: heroReveal.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }),
                  }],
                },
              ]}
            >
              <View style={styles.heroGlow} />
              <View style={styles.heroDot} />
              <View style={styles.heroCopy}>
                <View style={styles.heroEyebrow}>
                  <MaterialCommunityIcons name="star-four-points" size={11} color={colors.gold} />
                  <Text style={styles.heroEyebrowText}>LOOKBOOK 2026</Text>
                </View>
                <Text style={styles.heroTitle}>Gu riêng.{"\n"}Chất riêng.</Text>
                <Text style={styles.heroSubtitle}>Chọn đúng vibe, tìm đúng món dành cho bạn.</Text>
              </View>

              <View style={styles.garmentStage} pointerEvents="none">
                <View style={styles.garmentBackCard}>
                  <MaterialCommunityIcons name="hanger" size={45} color="rgba(255,255,255,0.5)" />
                </View>
                <Animated.View
                  style={[
                    styles.garmentFrontCard,
                    {
                      transform: [{
                        translateY: garmentFloat.interpolate({ inputRange: [0, 1], outputRange: [3, -5] }),
                      }, { rotate: '7deg' }],
                    },
                  ]}
                >
                  <MaterialCommunityIcons name="tshirt-crew" size={55} color={colors.brandDark} />
                  <View style={styles.garmentTag}>
                    <Text style={styles.garmentTagText}>NEW</Text>
                  </View>
                </Animated.View>
                <MaterialCommunityIcons
                  name="star-four-points-outline"
                  size={18}
                  color={colors.gold}
                  style={styles.garmentSparkle}
                />
              </View>
            </Animated.View>

            <View style={styles.audienceSection}>
              <View style={styles.audienceHeading}>
                <View>
                  <Text style={styles.sectionEyebrow}>CHỌN TỦ ĐỒ</Text>
                  <Text style={styles.audienceTitle}>Bạn đang tìm đồ cho ai?</Text>
                </View>
              </View>
              <View style={styles.audienceSelector} accessibilityRole="tablist">
                {discoveryGenderOptions.map((option) => {
                  const active = appliedFilters.gender === option.value;

                  return (
                    <TouchableOpacity
                      key={option.label}
                      style={[styles.audienceOption, active && styles.audienceOptionActive]}
                      onPress={() => selectDiscoveryGender(option.value)}
                      activeOpacity={0.82}
                      accessibilityRole="tab"
                      accessibilityState={{ selected: active }}
                      accessibilityLabel={`Đối tượng: ${option.label}`}
                    >
                      <MaterialCommunityIcons
                        name={option.icon}
                        size={17}
                        color={active ? colors.white : colors.textMuted}
                      />
                      <Text style={[styles.audienceOptionText, active && styles.audienceOptionTextActive]}>
                        {option.label}
                      </Text>
                      {active ? <MaterialCommunityIcons name="check-circle" size={15} color={colors.white} /> : null}
                    </TouchableOpacity>
                  );
                })}
              </View>
              <View style={styles.genderGrid}>
                {renderGenderSpotlight('male')}
                {renderGenderSpotlight('female')}
              </View>
            </View>
          </>
        ) : null}

        <View style={styles.catalogHeading} onLayout={handleCatalogHeadingLayout}>
          <View style={styles.catalogHeadingCopy}>
            <Text style={styles.sectionEyebrow}>{selectedGenderLabel}</Text>
            <Text style={styles.catalogTitle}>
              {hasScopedCatalogRequest ? screenTitle : 'Những món đáng thử'}
            </Text>
            <Text style={styles.summaryText}>
              {isLoading ? 'Đang chọn sản phẩm...' : `${totalItems} lựa chọn`}
            </Text>
          </View>

          <TouchableOpacity style={styles.filterButton} onPress={openFilterSheet} activeOpacity={0.82}>
            <MaterialCommunityIcons name="tune-variant" size={18} color={colors.brandDark} />
            <Text style={styles.filterButtonText}>Lọc</Text>
            {activeFilterCount ? (
              <View style={styles.filterBadge}>
                <Text style={styles.filterBadgeText}>{activeFilterCount}</Text>
              </View>
            ) : null}
          </TouchableOpacity>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.categoryScroller}
          contentContainerStyle={styles.categoryRail}
        >
          <TouchableOpacity
            style={styles.categoryTab}
            onPress={() => updateAppliedFilters((current) => ({ ...current, categoryId: [] }))}
            activeOpacity={0.82}
            accessibilityRole="tab"
            accessibilityState={{ selected: isAllCategoryRailActive }}
            accessibilityLabel="Danh mục: Tất cả"
          >
            <View style={[
              styles.categoryTabIcon,
              isAllCategoryRailActive && styles.categoryTabIconActive,
            ]}>
              <MaterialCommunityIcons
                name="view-grid-outline"
                size={23}
                color={isAllCategoryRailActive ? colors.brandDark : colors.textMuted}
              />
            </View>
            <Text style={[
              styles.categoryTabLabel,
              isAllCategoryRailActive && styles.categoryTabLabelActive,
            ]}>
              Tất cả
            </Text>
            {isAllCategoryRailActive ? <View style={styles.categoryTabIndicator} /> : null}
          </TouchableOpacity>

          {categoryRailGroups.map((group) => {
            const active = activeCategoryRailGroupKey === group.key;
            const categoryIcon = getCategoryRailIcon(group.label);

            return (
              <TouchableOpacity
                key={group.key}
                style={styles.categoryTab}
                onPress={() => updateAppliedFilters((current) => ({
                  ...current,
                  categoryId: active ? [] : group.categoryIds,
                }))}
                activeOpacity={0.82}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
                accessibilityLabel={`Danh mục: ${group.label}`}
              >
                <View style={[styles.categoryTabIcon, active && styles.categoryTabIconActive]}>
                  <MaterialCommunityIcons
                    name={categoryIcon}
                    size={23}
                    color={active ? colors.brandDark : colors.textMuted}
                  />
                </View>
                <Text
                  style={[styles.categoryTabLabel, active && styles.categoryTabLabelActive]}
                  numberOfLines={2}
                >
                  {group.label}
                </Text>
                {active ? <View style={styles.categoryTabIndicator} /> : null}
              </TouchableOpacity>
            );
          })}

          {isLoading && !categoryRailGroups.length ? (
            <View style={styles.categoryLoadingTab}>
              <ActivityIndicator size="small" color={colors.brand} />
              <Text style={styles.categoryTabLabel}>Đang tải</Text>
            </View>
          ) : null}
        </ScrollView>

        {activeChips.length ? (
          <View style={styles.activeFiltersPanel}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.activeChipRow}
          >
            {activeChips.map((chip) => (
              <TouchableOpacity
                key={chip.id}
                style={styles.activeChip}
                onPress={chip.onRemove}
                activeOpacity={0.82}
              >
                <Text style={styles.activeChipText} numberOfLines={1}>
                  {chip.label}
                </Text>
                <MaterialCommunityIcons name="close" size={15} color={colors.brandDark} />
              </TouchableOpacity>
            ))}
          </ScrollView>
            <TouchableOpacity style={styles.clearFilterButton} onPress={clearAppliedFilters} activeOpacity={0.82}>
              <Text style={styles.clearFilterText}>Xóa</Text>
            </TouchableOpacity>
          </View>
        ) : null}

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
            <TouchableOpacity style={styles.retryButton} onPress={() => loadProducts(1)} activeOpacity={0.82}>
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
        ) : null}
          </>
        )}
        ListFooterComponent={!isLoading && !error && products.length ? (
          <View style={styles.loadMoreArea}>
            {isLoadingMore ? (
              <>
                <ActivityIndicator color={colors.brand} />
                <Text style={styles.loadMoreText}>Đang tải thêm sản phẩm...</Text>
              </>
            ) : loadMoreError ? (
              <>
                <Text style={styles.loadMoreErrorText}>{loadMoreError}</Text>
                <TouchableOpacity style={styles.loadMoreRetryButton} onPress={loadMoreProducts} activeOpacity={0.82}>
                  <Text style={styles.loadMoreRetryText}>Thử lại</Text>
                </TouchableOpacity>
              </>
            ) : hasMoreProducts ? (
              <Text style={styles.loadMoreText}>Kéo xuống để xem thêm</Text>
            ) : (
              <Text style={styles.endOfListText}>Bạn đã xem hết {totalItems} sản phẩm</Text>
            )}
          </View>
        ) : null}
      />

      {showScrollTop ? (
        <TouchableOpacity
          style={[
            styles.scrollTopButton,
            { bottom: STOREFRONT_BOTTOM_NAV_HEIGHT + Math.max(insets.bottom, spacing.sm) + spacing.md },
          ]}
          onPress={() => scrollToTop()}
          accessibilityLabel="Quay lại đầu danh sách"
          activeOpacity={0.86}
        >
          <MaterialCommunityIcons name="arrow-up" size={24} color={colors.white} />
        </TouchableOpacity>
      ) : null}

      <Modal
        visible={isFilterSheetVisible}
        transparent
        animationType="slide"
        hardwareAccelerated
        statusBarTranslucent
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
                'Sắp xếp',
                <View style={styles.choiceWrap}>
                  {sortOptions.map((option) =>
                    renderChoice(
                      option.label,
                      draftFilters.sort === option.value,
                      () => setDraftFilters((current) => ({ ...current, sort: option.value })),
                      undefined,
                      option.value,
                    ),
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
    minHeight: 64,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  headerAction: {
    ...brandedHeaderStyles.action,
    width: 36,
    height: 36,
    borderRadius: 18,
    position: 'relative',
  },
  headerEdge: {
    width: 116,
    alignItems: 'flex-start',
  },
  headerActions: {
    width: 116,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: spacing.xs,
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
  titleBlock: {
    ...brandedHeaderStyles.titleGroup,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    ...brandedHeaderStyles.title,
    fontSize: 18,
    lineHeight: 24,
    marginTop: 0,
    textAlign: 'center',
  },
  content: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    padding: spacing.md,
    paddingBottom: spacing.xxl,
  },
  discoveryHero: {
    position: 'relative',
    minHeight: 152,
    borderRadius: 22,
    backgroundColor: colors.brandDark,
    overflow: 'hidden',
    padding: spacing.lg,
    marginBottom: spacing.xl,
    ...shadows.card,
  },
  heroGlow: {
    position: 'absolute',
    width: 170,
    height: 170,
    borderRadius: 85,
    right: -58,
    top: -68,
    backgroundColor: 'rgba(246,199,107,0.14)',
  },
  heroDot: {
    position: 'absolute',
    width: 8,
    height: 8,
    borderRadius: 4,
    right: 142,
    bottom: 22,
    backgroundColor: colors.coral,
  },
  heroCopy: {
    width: '60%',
    zIndex: 2,
  },
  heroEyebrow: {
    alignSelf: 'flex-start',
    minHeight: 22,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  heroEyebrowText: {
    color: colors.gold,
    fontSize: 9,
    lineHeight: 12,
    fontWeight: '900',
    letterSpacing: 1.1,
  },
  heroTitle: {
    color: colors.white,
    fontSize: 28,
    lineHeight: 30,
    fontWeight: '900',
    letterSpacing: -0.8,
    marginTop: spacing.sm,
  },
  heroSubtitle: {
    maxWidth: 185,
    color: colors.brandPale,
    fontSize: 11,
    lineHeight: 16,
    fontWeight: '600',
    marginTop: spacing.xs,
  },
  garmentStage: {
    position: 'absolute',
    width: 126,
    height: 132,
    right: 8,
    bottom: 8,
  },
  garmentBackCard: {
    position: 'absolute',
    width: 80,
    height: 104,
    right: 31,
    top: 10,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    backgroundColor: 'rgba(84,119,146,0.58)',
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ rotate: '-10deg' }],
  },
  garmentFrontCard: {
    position: 'absolute',
    width: 84,
    height: 108,
    right: 4,
    top: 15,
    borderRadius: 18,
    backgroundColor: colors.goldSoft,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.card,
  },
  garmentTag: {
    position: 'absolute',
    right: -4,
    top: 10,
    minWidth: 34,
    height: 18,
    borderRadius: radii.pill,
    backgroundColor: colors.coral,
    alignItems: 'center',
    justifyContent: 'center',
  },
  garmentTagText: {
    color: colors.white,
    fontSize: 8,
    lineHeight: 10,
    fontWeight: '900',
    letterSpacing: 0.6,
  },
  garmentSparkle: {
    position: 'absolute',
    right: 4,
    top: 0,
  },
  audienceSection: {
    marginBottom: spacing.xxl,
  },
  audienceHeading: {
    minHeight: 42,
    marginBottom: spacing.md,
  },
  sectionEyebrow: {
    color: colors.coral,
    fontSize: 9,
    lineHeight: 12,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
  audienceTitle: {
    color: colors.brandDark,
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '900',
    letterSpacing: -0.3,
    marginTop: 2,
  },
  audienceSelector: {
    minHeight: 42,
    flexDirection: 'row',
    gap: 4,
    padding: 4,
    borderRadius: radii.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.md,
  },
  audienceOption: {
    flex: 1,
    minWidth: 0,
    minHeight: 34,
    borderRadius: radii.pill,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingHorizontal: spacing.xs,
  },
  audienceOptionActive: {
    backgroundColor: colors.brandDark,
  },
  audienceOptionText: {
    color: colors.textMuted,
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '800',
  },
  audienceOptionTextActive: {
    color: colors.white,
    fontWeight: '900',
  },
  genderGrid: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  genderCard: {
    position: 'relative',
    flex: 1,
    minWidth: 0,
    height: 108,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  genderCardMale: {
    backgroundColor: '#E6EEF2',
  },
  genderCardFemale: {
    backgroundColor: '#F5E8E6',
  },
  genderCardActive: {
    borderWidth: 2,
    borderColor: colors.brandDark,
    ...shadows.card,
  },
  genderCardMuted: {
    opacity: 0.7,
  },
  genderSelectedBadge: {
    position: 'absolute',
    zIndex: 4,
    top: spacing.sm,
    right: spacing.sm,
    minHeight: 20,
    borderRadius: radii.pill,
    paddingHorizontal: 7,
    backgroundColor: colors.brandDark,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  genderSelectedBadgeText: {
    color: colors.white,
    fontSize: 8,
    lineHeight: 10,
    fontWeight: '900',
  },
  genderCardCopy: {
    width: '60%',
    height: '100%',
    zIndex: 2,
    padding: spacing.md,
    justifyContent: 'center',
  },
  genderIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(35,61,80,0.09)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 3,
  },
  genderIconFemale: {
    backgroundColor: 'rgba(155,76,85,0.1)',
  },
  genderLabel: {
    color: colors.brandDark,
    fontSize: 17,
    lineHeight: 20,
    fontWeight: '900',
    letterSpacing: 1.3,
  },
  genderLabelFemale: {
    color: '#763D46',
  },
  genderCaption: {
    color: colors.textMuted,
    fontSize: 8,
    lineHeight: 11,
    fontWeight: '700',
    marginTop: 2,
  },
  genderCaptionFemale: {
    color: '#9B5F67',
  },
  genderArrow: {
    position: 'absolute',
    right: spacing.sm,
    bottom: spacing.sm,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  genderArrowFemale: {
    backgroundColor: 'rgba(255,255,255,0.76)',
  },
  genderImageFrame: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: '48%',
    alignItems: 'center',
    justifyContent: 'center',
    opacity: 0.96,
  },
  genderImage: {
    width: '100%',
    height: '100%',
  },
  catalogHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    marginBottom: spacing.sm,
  },
  catalogHeadingCopy: {
    flex: 1,
    minWidth: 0,
  },
  catalogTitle: {
    color: colors.brandDark,
    fontSize: 21,
    lineHeight: 27,
    fontWeight: '900',
    letterSpacing: -0.45,
    marginTop: 1,
  },
  summaryText: {
    color: colors.textMuted,
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '700',
    marginTop: 2,
  },
  categoryScroller: {
    flexGrow: 0,
    height: 88,
    maxHeight: 88,
    marginHorizontal: -spacing.md,
    marginBottom: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  categoryRail: {
    minHeight: 88,
    paddingHorizontal: spacing.sm,
    alignItems: 'stretch',
  },
  categoryTab: {
    position: 'relative',
    width: 82,
    height: 88,
    paddingHorizontal: 4,
    paddingTop: 8,
    paddingBottom: 7,
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  categoryTabIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryTabIconActive: {
    backgroundColor: colors.brandMist,
  },
  categoryTabLabel: {
    marginTop: 4,
    color: colors.textMuted,
    fontSize: 10,
    lineHeight: 12,
    fontWeight: '700',
    textAlign: 'center',
  },
  categoryTabLabelActive: {
    color: colors.brandDark,
    fontWeight: '900',
  },
  categoryTabIndicator: {
    position: 'absolute',
    left: 11,
    right: 11,
    bottom: 0,
    height: 3,
    borderTopLeftRadius: 3,
    borderTopRightRadius: 3,
    backgroundColor: colors.brandDark,
  },
  categoryLoadingTab: {
    width: 82,
    height: 88,
    paddingTop: 14,
    alignItems: 'center',
  },
  activeFiltersPanel: {
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  filterButton: {
    minHeight: 40,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.brandPale,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },
  filterButtonText: {
    color: colors.brandDark,
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
  clearFilterButton: {
    height: 34,
    borderRadius: radii.pill,
    backgroundColor: colors.dangerSoft,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clearFilterText: {
    color: colors.danger,
    fontSize: 12,
    lineHeight: 16,
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
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  activeChipText: {
    flexShrink: 1,
    color: colors.brandDark,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '800',
  },
  grid: {
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  gridItem: {
    width: '48.6%',
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
  loadMoreArea: {
    minHeight: 58,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
  },
  loadMoreText: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
    textAlign: 'center',
  },
  loadMoreErrorText: {
    color: colors.danger,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '700',
    textAlign: 'center',
  },
  loadMoreRetryButton: {
    minHeight: 34,
    borderRadius: radii.xs,
    backgroundColor: colors.brand,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadMoreRetryText: {
    color: colors.white,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '800',
  },
  endOfListText: {
    color: colors.textSubtle,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
    textAlign: 'center',
  },
  scrollTopButton: {
    position: 'absolute',
    right: spacing.lg,
    zIndex: 25,
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: colors.brand,
    borderWidth: 1,
    borderColor: colors.brandLight,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.card,
  },
  modalRoot: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'transparent',
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.34)',
    zIndex: 1,
  },
  filterSheet: {
    zIndex: 2,
    elevation: 12,
    width: '100%',
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
