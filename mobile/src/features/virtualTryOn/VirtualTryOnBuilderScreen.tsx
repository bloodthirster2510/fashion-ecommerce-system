import React from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import type { RootStackParamList } from '../../navigation/AppNavigator';
import { RemoteImage } from '../../components/media/RemoteImage';
import { colors, radii, shadows, spacing } from '../../theme';
import {
  catalogApi,
  type CatalogProduct,
  type CatalogProductDetail,
  type ProductDetailColor,
  type ProductDetailVariant,
} from '../catalog/catalogApi';
import { useAuth } from '../auth/AuthContext';
import { VirtualTryOnApiError, virtualTryOnApi } from './virtualTryOnApi';
import type { TryOnContextPreset, TryOnItemRole, TryOnOutfitMode, TryOnSelectedItem } from './virtualTryOn.types';

type NavigationProp = StackNavigationProp<RootStackParamList, 'VirtualTryOnBuilder'>;
type RouteProps = RouteProp<RootStackParamList, 'VirtualTryOnBuilder'>;
type TryOnProductSort = 'recommended' | 'price_asc' | 'price_desc';
type TryOnGenderFilter = 'all' | 'male' | 'female' | 'unisex';

type TryOnProductFilters = {
  categoryIds: string[];
  brandIds: string[];
  gender: TryOnGenderFilter;
  isNew?: boolean;
  isSale?: boolean;
  sort: TryOnProductSort;
};

const defaultTryOnProductFilters: TryOnProductFilters = {
  categoryIds: [],
  brandIds: [],
  gender: 'all',
  sort: 'recommended',
};

const tryOnPalette = {
  ink: '#172231',
  inkSoft: '#26384B',
  champagne: '#F3C978',
  champagneSoft: '#FFF4D9',
  porcelain: '#FBF8F1',
  mist: '#E8EEF1',
  teal: '#2F6F73',
  rose: '#C96F5B',
  roseSoft: '#F8E6DF',
  plum: '#5C506B',
  line: '#D9DFE3',
} as const;

const formatPrice = (value: number) =>
  `${Math.round(value).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')}đ`;

const fallbackQuantityLimit = 99;

const outfitModes: Array<{
  key: TryOnOutfitMode;
  label: string;
  description: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
}> = [
  { key: 'single', label: 'Một món', description: 'Thử nhanh 1 sản phẩm', icon: 'tshirt-crew-outline' },
  { key: 'top_bottom', label: 'Áo + quần', description: 'Cần đủ áo và quần', icon: 'human' },
  { key: 'full_set', label: 'Full set', description: 'Ghép nhiều món thành outfit', icon: 'wardrobe-outline' },
];

const contextOptions: Array<{ key: TryOnContextPreset; label: string; icon: keyof typeof MaterialCommunityIcons.glyphMap }> = [
  { key: 'none', label: 'Không đổi nền', icon: 'image-outline' },
  { key: 'work', label: 'Đi làm', icon: 'briefcase-outline' },
  { key: 'casual', label: 'Đi chơi', icon: 'party-popper' },
  { key: 'party', label: 'Dự tiệc', icon: 'glass-cocktail' },
  { key: 'travel', label: 'Du lịch', icon: 'airplane' },
  { key: 'sport', label: 'Thể thao', icon: 'run' },
  { key: 'date', label: 'Hẹn hò', icon: 'heart-outline' },
  { key: 'custom', label: 'Tự mô tả', icon: 'pencil-outline' },
];

const tryOnSortOptions: Array<{ key: TryOnProductSort; label: string }> = [
  { key: 'recommended', label: 'Gợi ý' },
  { key: 'price_asc', label: 'Giá thấp' },
  { key: 'price_desc', label: 'Giá cao' },
];

const genderFilterOptions: Array<{ key: TryOnGenderFilter; label: string; icon: keyof typeof MaterialCommunityIcons.glyphMap }> = [
  { key: 'all', label: 'Tất cả', icon: 'apps' },
  { key: 'male', label: 'Nam', icon: 'gender-male' },
  { key: 'female', label: 'Nữ', icon: 'gender-female' },
  { key: 'unisex', label: 'Unisex', icon: 'gender-male-female' },
];

const roleLabel: Record<TryOnItemRole, string> = {
  top: 'Áo',
  bottom: 'Quần',
  dress: 'Váy/đầm',
  shoes: 'Giày',
  accessory: 'Phụ kiện',
  outerwear: 'Áo khoác',
};

const imageValidationAlerts: Record<string, { title: string; message: string }> = {
  NO_PERSON_DETECTED: {
    title: 'Ảnh chưa phù hợp',
    message: 'Bạn hãy chọn ảnh có một người rõ ràng để hệ thống thử đồ chính xác hơn.',
  },
  MULTIPLE_PEOPLE_DETECTED: {
    title: 'Ảnh có nhiều người',
    message: 'Bạn hãy dùng ảnh chỉ có một người chính trong khung hình.',
  },
  PERSON_TOO_SMALL: {
    title: 'Người trong ảnh quá nhỏ',
    message: 'Bạn hãy chọn ảnh chụp gần hơn, người chiếm phần lớn khung hình.',
  },
  BODY_NOT_VISIBLE: {
    title: 'Chưa thấy đủ cơ thể',
    message: 'Outfit này cần ảnh thấy rõ người hơn. Bạn hãy chọn ảnh nửa người hoặc toàn thân phù hợp.',
  },
  POSE_NOT_SUPPORTED: {
    title: 'Tư thế khó xử lý',
    message: 'Bạn hãy chọn ảnh đứng thẳng, mặt hướng camera và ít bị che khuất.',
  },
  IMAGE_TOO_BLURRY: {
    title: 'Ảnh bị mờ',
    message: 'Bạn hãy chọn hoặc chụp lại ảnh rõ nét hơn.',
  },
  IMAGE_TOO_DARK: {
    title: 'Ảnh quá tối',
    message: 'Bạn hãy chọn ảnh đủ sáng hơn để hệ thống nhận diện cơ thể tốt hơn.',
  },
  IMAGE_TOO_SMALL: {
    title: 'Ảnh quá nhỏ',
    message: 'Bạn hãy chọn ảnh có độ phân giải cao hơn.',
  },
  IMAGE_POLICY_BLOCKED: {
    title: 'Ảnh không phù hợp',
    message: 'Ảnh này không thể dùng để tạo phối đồ ảo. Bạn hãy chọn ảnh khác.',
  },
  VALIDATION_PROVIDER_FAILED: {
    title: 'Chưa kiểm tra được ảnh',
    message: 'Hệ thống đang chưa kiểm tra được ảnh này. Bạn hãy thử lại sau ít phút.',
  },
};

const getCreateJobErrorAlert = (error: unknown) => {
  if (error instanceof VirtualTryOnApiError && error.errorCode) {
    const validationAlert = imageValidationAlerts[error.errorCode];
    if (validationAlert) return validationAlert;
  }

  return {
    title: 'Phối đồ ảo',
    message: error instanceof Error ? error.message : 'Không thể tạo yêu cầu phối đồ.',
  };
};

type OutfitSlot = {
  key: string;
  label: string;
  helper: string;
  roles: TryOnItemRole[];
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  required?: boolean;
};

const allTryOnRoles: TryOnItemRole[] = ['top', 'bottom', 'dress', 'shoes', 'outerwear'];

const getOutfitSlots = (mode: TryOnOutfitMode): OutfitSlot[] => {
  if (mode === 'single') {
    return [
      {
        key: 'single',
        label: 'Sản phẩm',
        helper: 'Chọn 1 món bất kỳ',
        roles: allTryOnRoles,
        icon: 'hanger',
        required: true,
      },
    ];
  }

  if (mode === 'top_bottom') {
    return [
      { key: 'top', label: 'Áo', helper: 'Chọn áo', roles: ['top', 'outerwear'], icon: 'tshirt-crew-outline', required: true },
      { key: 'bottom', label: 'Quần', helper: 'Chọn quần', roles: ['bottom'], icon: 'human-male-height', required: true },
    ];
  }

  return [
    { key: 'top', label: 'Áo', helper: 'Áo, áo khoác', roles: ['top', 'outerwear'], icon: 'tshirt-crew-outline' },
    { key: 'outfit', label: 'Quần/Váy', helper: 'Quần, jean, váy, đầm', roles: ['bottom', 'dress'], icon: 'human-female' },
    { key: 'shoes', label: 'Giày', helper: 'Giày, dép, sandal', roles: ['shoes'], icon: 'shoe-sneaker' },
  ];
};

const inferRole = (product: CatalogProduct | CatalogProductDetail): TryOnItemRole => {
  const haystack = `${product.name} ${product.category?.name ?? ''}`.toLowerCase();
  if (haystack.includes('giày') || haystack.includes('dép') || haystack.includes('sandal')) return 'shoes';
  if (haystack.includes('quần') || haystack.includes('jean') || haystack.includes('short')) return 'bottom';
  if (haystack.includes('váy') || haystack.includes('đầm') || haystack.includes('dress')) return 'dress';
  if (haystack.includes('khoác') || haystack.includes('blazer') || haystack.includes('jacket')) return 'outerwear';
  if (haystack.includes('túi') || haystack.includes('mũ') || haystack.includes('nón') || haystack.includes('phụ kiện')) return 'accessory';
  return 'top';
};

const getInitialVariant = (detail: CatalogProductDetail) =>
  detail.variants.find((item) => item.isActive && item.colors.length && item.sizes.some((size) => size.isAvailable)) ??
  detail.variants.find((item) => item.isActive && item.colors.length) ??
  detail.variants[0];

const getInventoryForSelection = (
  variant?: ProductDetailVariant,
  colorVariantId?: string,
  size?: string,
) => {
  if (!variant || !colorVariantId || !size) return undefined;

  return variant.inventory?.find((item) =>
    item.colorVariantId === colorVariantId &&
    item.size.trim().toLowerCase() === size.trim().toLowerCase(),
  );
};

const getAvailableQuantityForSize = (
  variant: ProductDetailVariant | undefined,
  colorVariantId: string | undefined,
  sizeOption: ProductDetailVariant['sizes'][number],
) => {
  const inventory = getInventoryForSelection(variant, colorVariantId, sizeOption.size);

  if (variant && Array.isArray(variant.inventory) && colorVariantId) {
    return Math.max(0, inventory?.availableQuantity ?? 0);
  }

  return Math.max(0, sizeOption.availableQuantity ?? (sizeOption.isAvailable ? fallbackQuantityLimit : 0));
};

const isSizeAvailableForColor = (
  variant: ProductDetailVariant | undefined,
  colorVariantId: string | undefined,
  sizeOption: ProductDetailVariant['sizes'][number],
) => getAvailableQuantityForSize(variant, colorVariantId, sizeOption) > 0;

const getFirstAvailableSize = (variant?: ProductDetailVariant, colorVariantId?: string) =>
  variant?.sizes.find((item) => isSizeAvailableForColor(variant, colorVariantId, item))?.size ??
  variant?.sizes[0]?.size;

const createSelectedItem = (
  detail: CatalogProductDetail,
  variant: ProductDetailVariant,
  color: ProductDetailColor,
  size?: string,
): TryOnSelectedItem => ({
    productId: detail._id,
    variantId: variant._id,
    colorVariantId: color._id,
    size,
    role: inferRole(detail),
    nameSnapshot: detail.name,
    colorSnapshot: color.color,
    imageSnapshot: color.image || detail.productImage,
    priceSnapshot: variant.originalPrice,
    finalPriceSnapshot: variant.finalPrice,
});

const VirtualTryOnBuilderScreen = () => {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<RouteProps>();
  const { runWithAuth } = useAuth();
  const [products, setProducts] = React.useState<CatalogProduct[]>([]);
  const [selectedItems, setSelectedItems] = React.useState<TryOnSelectedItem[]>([]);
  const [outfitMode, setOutfitMode] = React.useState<TryOnOutfitMode>('full_set');
  const [contextPreset, setContextPreset] = React.useState<TryOnContextPreset>('none');
  const [contextPrompt, setContextPrompt] = React.useState('');
  const [includeVideo, setIncludeVideo] = React.useState(false);
  const [searchTerm, setSearchTerm] = React.useState('');
  const [productFilters, setProductFilters] = React.useState<TryOnProductFilters>(defaultTryOnProductFilters);
  const [isProductFilterVisible, setIsProductFilterVisible] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [selectingProductId, setSelectingProductId] = React.useState<string | null>(null);
  const [activeSlotKey, setActiveSlotKey] = React.useState('top');
  const [configuringProduct, setConfiguringProduct] = React.useState<CatalogProductDetail | null>(null);
  const [selectedVariantId, setSelectedVariantId] = React.useState<string>();
  const [selectedColorId, setSelectedColorId] = React.useState<string>();
  const [selectedSize, setSelectedSize] = React.useState<string>();

  const sourceAssetId = route.params?.assetId;
  const sourceImageUrl = route.params?.imageUrl;
  const outfitSlots = React.useMemo(() => getOutfitSlots(outfitMode), [outfitMode]);
  const activeSlot = outfitSlots.find((slot) => slot.key === activeSlotKey) ?? outfitSlots[0];
  const selectedVariant = configuringProduct?.variants.find((variant) => variant._id === selectedVariantId);
  const selectedColor = selectedVariant?.colors.find((color) => color._id === selectedColorId);
  const selectedSizeOption = selectedVariant?.sizes.find((item) => item.size === selectedSize);
  const canConfirmConfiguredProduct = Boolean(
    configuringProduct &&
    selectedVariant?.isActive &&
    selectedColor &&
    selectedSizeOption &&
    isSizeAvailableForColor(selectedVariant, selectedColorId, selectedSizeOption),
  );

  React.useEffect(() => {
    let isCurrent = true;
    setIsLoading(true);
    catalogApi
      .getProducts({ page: 1, limit: 60, sort: 'newest' })
      .then((response) => {
        if (isCurrent) setProducts(response.items);
      })
      .catch(() => {
        if (isCurrent) Alert.alert('Sản phẩm', 'Không tải được danh sách sản phẩm.');
      })
      .finally(() => {
        if (isCurrent) setIsLoading(false);
      });

    return () => { isCurrent = false; };
  }, []);

  React.useEffect(() => {
    if (!outfitSlots.some((slot) => slot.key === activeSlotKey)) {
      setActiveSlotKey(outfitSlots[0].key);
    }
  }, [activeSlotKey, outfitSlots]);

  React.useEffect(() => {
    setSelectedItems((current) => {
      if (outfitMode === 'single') return current.slice(0, 1);

      const allowedRoles = new Set(outfitSlots.flatMap((slot) => slot.roles));
      const nextItems = current.filter((item) => allowedRoles.has(item.role));

      if (outfitMode === 'top_bottom') {
        const nextByRole = new Map<TryOnItemRole, TryOnSelectedItem>();
        nextItems.forEach((item) => {
          if (item.role === 'top' || item.role === 'bottom') nextByRole.set(item.role, item);
        });
        return Array.from(nextByRole.values());
      }

      return nextItems.slice(0, 4);
    });
  }, [outfitMode, outfitSlots]);

  const slotProducts = React.useMemo(
    () => products.filter((product) => activeSlot.roles.includes(inferRole(product))),
    [activeSlot, products],
  );

  const genderSlotProducts = React.useMemo(
    () => slotProducts.filter((product) =>
      productFilters.gender === 'all' ||
      product.category?.gender === productFilters.gender,
    ),
    [productFilters.gender, slotProducts],
  );

  const categoryFilterOptions = React.useMemo(() => {
    const options = new Map<string, string>();

    genderSlotProducts.forEach((product) => {
      if (product.category?._id && product.category.name) {
        options.set(product.category._id, product.category.name);
      }
    });

    return Array.from(options.entries())
      .map(([id, label]) => ({ id, label }))
      .sort((a, b) => a.label.localeCompare(b.label, 'vi-VN'));
  }, [genderSlotProducts]);

  const brandFilterOptions = React.useMemo(() => {
    const options = new Map<string, string>();

    genderSlotProducts.forEach((product) => {
      if (product.brand?._id && product.brand.name) {
        options.set(product.brand._id, product.brand.name);
      }
    });

    return Array.from(options.entries())
      .map(([id, label]) => ({ id, label }))
      .sort((a, b) => a.label.localeCompare(b.label, 'vi-VN'));
  }, [genderSlotProducts]);

  React.useEffect(() => {
    const availableCategoryIds = new Set(categoryFilterOptions.map((option) => option.id));
    const availableBrandIds = new Set(brandFilterOptions.map((option) => option.id));

    setProductFilters((current) => {
      const nextCategoryIds = current.categoryIds.filter((id) => availableCategoryIds.has(id));
      const nextBrandIds = current.brandIds.filter((id) => availableBrandIds.has(id));

      if (
        nextCategoryIds.length === current.categoryIds.length &&
        nextBrandIds.length === current.brandIds.length
      ) {
        return current;
      }

      return {
        ...current,
        categoryIds: nextCategoryIds,
        brandIds: nextBrandIds,
      };
    });
  }, [brandFilterOptions, categoryFilterOptions]);

  const filteredProducts = React.useMemo(() => {
    const keyword = searchTerm.trim().toLowerCase();
    const nextProducts = genderSlotProducts.filter((product) => {
      const matchesKeyword = !keyword ||
        `${product.name} ${product.category?.name ?? ''} ${product.brand?.name ?? ''}`
          .toLowerCase()
          .includes(keyword);
      const matchesCategory =
        !productFilters.categoryIds.length ||
        (product.category?._id ? productFilters.categoryIds.includes(product.category._id) : false);
      const matchesBrand =
        !productFilters.brandIds.length ||
        (product.brand?._id ? productFilters.brandIds.includes(product.brand._id) : false);
      const matchesNew = !productFilters.isNew || product.isNew;
      const matchesSale = !productFilters.isSale || product.isSale;

      return matchesKeyword && matchesCategory && matchesBrand && matchesNew && matchesSale;
    });

    if (productFilters.sort === 'price_asc') {
      return [...nextProducts].sort((a, b) => a.finalPrice - b.finalPrice);
    }

    if (productFilters.sort === 'price_desc') {
      return [...nextProducts].sort((a, b) => b.finalPrice - a.finalPrice);
    }

    return nextProducts;
  }, [genderSlotProducts, productFilters, searchTerm]);

  const productFilterCount =
    productFilters.categoryIds.length +
    productFilters.brandIds.length +
    (productFilters.gender !== 'all' ? 1 : 0) +
    (productFilters.isNew ? 1 : 0) +
    (productFilters.isSale ? 1 : 0) +
    (productFilters.sort !== 'recommended' ? 1 : 0);

  const resetProductFilters = () => {
    setProductFilters(defaultTryOnProductFilters);
  };

  const toggleProductFilterValue = (key: 'categoryIds' | 'brandIds', value: string) => {
    setProductFilters((current) => {
      const values = current[key];
      const nextValues = values.includes(value)
        ? values.filter((item) => item !== value)
        : [...values, value];

      return {
        ...current,
        [key]: nextValues,
      };
    });
  };

  const addSelectedItem = (item: TryOnSelectedItem) => {
    const roleForSlot = activeSlot.roles.includes(item.role) ? item.role : activeSlot.roles[0];
    const normalizedItem = { ...item, role: roleForSlot };

    setSelectedItems((current) => {
      if (outfitMode === 'single') return [normalizedItem];

      const withoutSameProduct = current.filter((entry) => entry.productId !== normalizedItem.productId);
      const withoutSameSlot = withoutSameProduct.filter((entry) => !activeSlot.roles.includes(entry.role));
      return [...withoutSameSlot, normalizedItem].slice(0, 4);
    });
  };

  const selectProduct = async (product: CatalogProduct) => {
    setSelectingProductId(product._id);
    try {
      const detail = await catalogApi.getProductById(product._id);
      const variant = getInitialVariant(detail);
      const color = variant?.colors[0];

      if (!variant || !color) {
        Alert.alert('Sản phẩm', 'Sản phẩm này chưa có biến thể phù hợp để phối đồ.');
        return;
      }

      setConfiguringProduct(detail);
      setSelectedVariantId(variant._id);
      setSelectedColorId(color._id);
      setSelectedSize(getFirstAvailableSize(variant, color._id));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Không lấy được chi tiết sản phẩm.';
      Alert.alert('Sản phẩm', message);
    } finally {
      setSelectingProductId(null);
    }
  };

  const selectVariant = (variant: ProductDetailVariant) => {
    const color = variant.colors[0];
    setSelectedVariantId(variant._id);
    setSelectedColorId(color?._id);
    setSelectedSize(getFirstAvailableSize(variant, color?._id));
  };

  const selectColor = (color: ProductDetailColor) => {
    setSelectedColorId(color._id);
    setSelectedSize((currentSize) => {
      const currentSizeOption = selectedVariant?.sizes.find((item) => item.size === currentSize);
      if (currentSizeOption && isSizeAvailableForColor(selectedVariant, color._id, currentSizeOption)) {
        return currentSize;
      }

      return getFirstAvailableSize(selectedVariant, color._id);
    });
  };

  const closeVariantSelector = () => {
    setConfiguringProduct(null);
    setSelectedVariantId(undefined);
    setSelectedColorId(undefined);
    setSelectedSize(undefined);
  };

  const confirmConfiguredProduct = () => {
    if (!configuringProduct || !selectedVariant || !selectedColor || !selectedSizeOption) {
      return;
    }

    if (!isSizeAvailableForColor(selectedVariant, selectedColor._id, selectedSizeOption)) {
      Alert.alert('Biến thể', 'Màu và size này hiện chưa khả dụng.');
      return;
    }

    addSelectedItem(createSelectedItem(configuringProduct, selectedVariant, selectedColor, selectedSizeOption.size));
    closeVariantSelector();
  };

  const removeSelectedItem = (productId: string) => {
    setSelectedItems((current) => current.filter((item) => item.productId !== productId));
  };

  const getSelectedItemForSlot = (slot: OutfitSlot) =>
    selectedItems.find((item) => slot.roles.includes(item.role));

  const selectedSlotCount = outfitSlots.filter((slot) => getSelectedItemForSlot(slot)).length;

  const hasTopSlot = selectedItems.some((item) => item.role === 'top' || item.role === 'outerwear');
  const hasBottomSlot = selectedItems.some((item) => item.role === 'bottom');
  const hasRequiredTopBottom =
    outfitMode !== 'top_bottom' ||
    (hasTopSlot && hasBottomSlot);

  const canSubmit =
    selectedItems.length > 0 &&
    hasRequiredTopBottom &&
    (outfitMode !== 'full_set' || selectedItems.length >= 2);

  const footerLabel = (() => {
    if (outfitMode === 'top_bottom' && !hasRequiredTopBottom) {
      const missing = !hasTopSlot ? 'áo' : 'quần';
      return `Còn thiếu ${missing}`;
    }

    if (outfitMode === 'full_set' && selectedItems.length < 2) {
      return 'Chọn ít nhất 2 món';
    }

    return `${selectedSlotCount}/${outfitSlots.length} vị trí`;
  })();

  const createJob = async () => {
    if (!sourceAssetId) {
      Alert.alert('Ảnh của bạn', 'Bạn cần tải ảnh hoặc chụp ảnh trước.');
      navigation.navigate('VirtualTryOnHome');
      return;
    }

    if (!selectedItems.length) {
      Alert.alert('Chọn sản phẩm', 'Bạn hãy chọn ít nhất một sản phẩm để phối đồ.');
      return;
    }

    if (outfitMode === 'top_bottom' && !hasRequiredTopBottom) {
      Alert.alert('Chọn áo và quần', 'Bạn cần chọn đủ áo và quần để tạo phối đồ.');
      return;
    }

    if (outfitMode === 'full_set' && selectedItems.length < 2) {
      Alert.alert('Chọn full set', 'Bạn hãy chọn ít nhất 2 món để hệ thống dựng outfit rõ hơn.');
      return;
    }

    setIsSubmitting(true);
    try {
      const job = await runWithAuth((token) =>
        virtualTryOnApi.createJob(token, {
          sourceAssetId,
          outfitMode,
          selectedItems: selectedItems.map((item) => ({
            productId: item.productId,
            variantId: item.variantId,
            colorVariantId: item.colorVariantId,
            size: item.size,
            role: item.role,
          })),
          contextPreset,
          contextPrompt: contextPreset === 'custom' ? contextPrompt.trim() : undefined,
          outputMode: includeVideo ? 'image_and_video' : 'image',
        }, `try-on-${Date.now()}-${Math.random().toString(16).slice(2)}`),
      );
      navigation.replace('VirtualTryOnProcessing', { jobId: job._id });
    } catch (error) {
      const alert = getCreateJobErrorAlert(error);
      Alert.alert(alert.title, alert.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerButton} onPress={() => navigation.goBack()} activeOpacity={0.8}>
          <MaterialCommunityIcons name="arrow-left" size={25} color={colors.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Chọn outfit</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.sourceCard}>
          <View style={styles.sourceImageWrap}>
            {sourceImageUrl ? (
              <RemoteImage uri={sourceImageUrl} style={styles.sourceImage} recyclingKey={sourceAssetId} />
            ) : (
              <MaterialCommunityIcons name="image-outline" size={36} color={colors.brand} />
            )}
          </View>
          <View style={styles.sourceCopy}>
            <Text style={styles.sourceTitle}>Ảnh của bạn</Text>
            <Text style={styles.sourceText}>Ảnh sẽ được kiểm tra khi tạo kết quả. Hãy dùng ảnh một người, đủ sáng và rõ nét.</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Chế độ phối</Text>
        <View style={styles.modeRow}>
          {outfitModes.map((mode) => {
            const active = outfitMode === mode.key;
            return (
              <TouchableOpacity
                key={mode.key}
                style={[styles.modeButton, active && styles.modeButtonActive]}
                onPress={() => setOutfitMode(mode.key)}
                activeOpacity={0.82}
              >
                <MaterialCommunityIcons name={mode.icon} size={20} color={active ? colors.white : colors.brandDark} />
                <Text style={[styles.modeText, active && styles.modeTextActive]}>{mode.label}</Text>
                <Text style={[styles.modeDescription, active && styles.modeTextActive]} numberOfLines={2}>
                  {mode.description}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={styles.outfitHeaderRow}>
          <Text style={styles.sectionTitle}>Outfit của bạn</Text>
          <Text style={styles.outfitProgress}>{footerLabel}</Text>
        </View>
        <View style={styles.slotGrid}>
          {outfitSlots.map((slot) => {
            const active = activeSlot.key === slot.key;
            const selectedItem = getSelectedItemForSlot(slot);

            return (
              <TouchableOpacity
                key={slot.key}
                style={[
                  styles.slotCard,
                  outfitSlots.length === 1 && styles.slotCardSingle,
                  outfitSlots.length === 2 && styles.slotCardTwo,
                  outfitSlots.length === 3 && styles.slotCardThree,
                  active && styles.slotCardActive,
                  selectedItem && styles.slotCardFilled,
                ]}
                onPress={() => setActiveSlotKey(slot.key)}
                activeOpacity={0.84}
              >
                <View style={styles.slotIconWrap}>
                  {selectedItem ? (
                    <RemoteImage
                      uri={selectedItem.imageSnapshot}
                      style={styles.slotImage}
                      recyclingKey={`${slot.key}:${selectedItem.colorVariantId}`}
                    />
                  ) : (
                    <MaterialCommunityIcons name={slot.icon} size={24} color={active ? colors.white : colors.brand} />
                  )}
                </View>
                <View style={[styles.slotCopy, outfitSlots.length === 1 && styles.slotCardSingleCopy]}>
                  <Text style={[
                    styles.slotLabel,
                    outfitSlots.length === 1 && styles.slotSingleText,
                    active && !selectedItem && styles.slotTextActive,
                  ]}>
                    {slot.label}
                  </Text>
                  <Text
                    style={[
                      styles.slotHelper,
                      outfitSlots.length === 1 && styles.slotSingleText,
                      active && !selectedItem && styles.slotTextActive,
                    ]}
                    numberOfLines={selectedItem ? 2 : 1}
                  >
                    {selectedItem ? selectedItem.nameSnapshot : slot.helper}
                  </Text>
                  {selectedItem ? (
                    <Text style={[styles.slotMeta, outfitSlots.length === 1 && styles.slotSingleText]} numberOfLines={1}>
                      {[selectedItem.colorSnapshot, selectedItem.size].filter(Boolean).join(' / ') || roleLabel[selectedItem.role]}
                    </Text>
                  ) : null}
                </View>
                {selectedItem ? (
                  <TouchableOpacity
                    style={[styles.slotRemoveButton, outfitSlots.length === 1 && styles.slotRemoveButtonSingle]}
                    onPress={() => removeSelectedItem(selectedItem.productId)}
                    activeOpacity={0.75}
                  >
                    <MaterialCommunityIcons name="close" size={18} color={colors.textMuted} />
                  </TouchableOpacity>
                ) : null}
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={styles.searchRow}>
          <MaterialCommunityIcons name="magnify" size={22} color={colors.textMuted} />
          <TextInput
            style={styles.searchInput}
            value={searchTerm}
            onChangeText={setSearchTerm}
            placeholder="Tìm áo, quần, giày..."
            placeholderTextColor={colors.textMuted}
          />
          <TouchableOpacity
            style={[styles.searchFilterButton, productFilterCount > 0 && styles.searchFilterButtonActive]}
            onPress={() => setIsProductFilterVisible(true)}
            activeOpacity={0.82}
          >
            <MaterialCommunityIcons
              name="tune-variant"
              size={21}
              color={productFilterCount > 0 ? colors.white : colors.brand}
            />
            {productFilterCount > 0 ? (
              <View style={styles.searchFilterBadge}>
                <Text style={styles.searchFilterBadgeText}>{productFilterCount}</Text>
              </View>
            ) : null}
          </TouchableOpacity>
        </View>

        <View style={styles.genderSegment}>
          {genderFilterOptions.map((option) => {
            const active = productFilters.gender === option.key;

            return (
              <TouchableOpacity
                key={option.key}
                style={[styles.genderChip, active && styles.genderChipActive]}
                onPress={() => setProductFilters((current) => ({ ...current, gender: option.key }))}
                activeOpacity={0.84}
              >
                <MaterialCommunityIcons
                  name={option.icon}
                  size={16}
                  color={active ? tryOnPalette.ink : tryOnPalette.teal}
                />
                <Text style={[styles.genderChipText, active && styles.genderChipTextActive]} numberOfLines={1}>
                  {option.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={styles.productHeaderRow}>
          <Text style={styles.sectionTitle}>Chọn cho {activeSlot.label.toLowerCase()}</Text>
          <Text style={styles.productCount}>{filteredProducts.length} món</Text>
        </View>
        {isLoading ? (
          <ActivityIndicator color={colors.brand} style={styles.loading} />
        ) : filteredProducts.length ? (
          <View style={styles.productGrid}>
            {filteredProducts.map((product) => {
              const selected = selectedItems.some((item) => item.productId === product._id);
              const isSelecting = selectingProductId === product._id;
              const productRole = inferRole(product);

              return (
                <TouchableOpacity
                  key={product._id}
                  style={[styles.productCard, selected && styles.productCardSelected]}
                  onPress={() => selectProduct(product)}
                  activeOpacity={0.86}
                  disabled={isSelecting}
                >
                  <View style={styles.productImageWrap}>
                    <RemoteImage uri={product.image} style={styles.productImage} recyclingKey={product._id} />
                    <View style={styles.roleBadge}>
                      <Text style={styles.roleBadgeText}>{roleLabel[productRole]}</Text>
                    </View>
                    {selected ? (
                      <View style={styles.selectedMark}>
                        <MaterialCommunityIcons name="check" size={18} color={colors.white} />
                      </View>
                    ) : null}
                    {isSelecting ? <ActivityIndicator style={StyleSheet.absoluteFillObject} color={colors.brand} /> : null}
                  </View>
                  <Text style={styles.productName} numberOfLines={2}>{product.name}</Text>
                  <View style={styles.productFooter}>
                    <Text style={styles.productPrice}>{formatPrice(product.finalPrice)}</Text>
                    <MaterialCommunityIcons
                      name={selected ? 'check-circle' : 'plus-circle-outline'}
                      size={20}
                      color={selected ? colors.brand : colors.textMuted}
                    />
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        ) : (
          <View style={styles.emptySelection}>
            <Text style={styles.emptySelectionText}>Chưa có sản phẩm phù hợp với vị trí này.</Text>
          </View>
        )}

        <Text style={styles.sectionTitle}>Bối cảnh</Text>
        <View style={styles.contextGrid}>
          {contextOptions.map((option) => {
            const active = contextPreset === option.key;
            return (
              <TouchableOpacity
                key={option.key}
                style={[styles.contextChip, active && styles.contextChipActive]}
                onPress={() => setContextPreset(option.key)}
                activeOpacity={0.82}
              >
                <MaterialCommunityIcons name={option.icon} size={18} color={active ? colors.white : colors.brandDark} />
                <Text style={[styles.contextText, active && styles.contextTextActive]}>{option.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
        {contextPreset === 'custom' ? (
          <TextInput
            style={styles.promptInput}
            value={contextPrompt}
            onChangeText={setContextPrompt}
            placeholder="VD: đi phỏng vấn ở văn phòng hiện đại"
            placeholderTextColor={colors.textMuted}
            maxLength={200}
            multiline
          />
        ) : null}

        <Text style={styles.sectionTitle}>Tùy chọn kết quả</Text>
        <View style={styles.outputOptionCard}>
          <View style={styles.outputOptionIcon}>
            <MaterialCommunityIcons name="movie-open-play-outline" size={24} color={colors.brand} />
          </View>
          <View style={styles.outputOptionCopy}>
            <Text style={styles.outputOptionTitle}>Tạo thêm video</Text>
            <Text style={styles.outputOptionText}>
              Kết quả sẽ lâu hơn, dùng khi bạn muốn xem outfit chuyển động.
            </Text>
          </View>
          <Switch
            value={includeVideo}
            onValueChange={setIncludeVideo}
            trackColor={{ false: colors.border, true: colors.brandPale }}
            thumbColor={includeVideo ? colors.brand : colors.white}
          />
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <View>
          <Text style={styles.footerLabel}>{footerLabel}</Text>
          <Text style={styles.footerTotal}>
            {formatPrice(selectedItems.reduce((sum, item) => sum + item.finalPriceSnapshot, 0))}
          </Text>
        </View>
        <TouchableOpacity
          style={[styles.submitButton, (!canSubmit || isSubmitting) && styles.submitButtonDisabled]}
          onPress={createJob}
          disabled={!canSubmit || isSubmitting}
          activeOpacity={0.86}
        >
          {isSubmitting ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <>
              <MaterialCommunityIcons name="auto-fix" size={22} color={colors.white} />
              <Text style={styles.submitText}>Tạo kết quả</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      <Modal
        visible={Boolean(configuringProduct)}
        transparent
        animationType="slide"
        onRequestClose={closeVariantSelector}
      >
        <View style={styles.variantModalRoot}>
          <Pressable style={styles.variantBackdrop} onPress={closeVariantSelector} />
          <View style={styles.variantSheet}>
            <View style={styles.variantHeader}>
              <Text style={styles.variantTitle}>Chọn màu và size</Text>
              <TouchableOpacity style={styles.variantCloseButton} onPress={closeVariantSelector} activeOpacity={0.75}>
                <MaterialCommunityIcons name="close" size={21} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            {configuringProduct ? (
              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.variantContent}>
                <View style={styles.variantPreviewRow}>
                  <View style={styles.variantPreviewImageWrap}>
                    <RemoteImage
                      uri={selectedColor?.image || configuringProduct.productImage}
                      style={styles.variantPreviewImage}
                      recyclingKey={selectedColor?._id ?? configuringProduct._id}
                    />
                  </View>
                  <View style={styles.variantPreviewCopy}>
                    <Text style={styles.variantProductName} numberOfLines={2}>{configuringProduct.name}</Text>
                    <Text style={styles.variantProductPrice}>
                      {selectedVariant ? formatPrice(selectedVariant.finalPrice) : formatPrice(configuringProduct.finalPrice)}
                    </Text>
                    <Text style={styles.variantProductMeta} numberOfLines={2}>
                      {[selectedVariant?.fitType?.label, selectedColor?.color, selectedSize].filter(Boolean).join(' / ') || 'Chọn biến thể'}
                    </Text>
                  </View>
                </View>

                {configuringProduct.variants.length > 1 ? (
                  <View style={styles.variantSection}>
                    <Text style={styles.variantSectionTitle}>Form dáng</Text>
                    <View style={styles.variantChoiceWrap}>
                      {configuringProduct.variants.map((variant) => {
                        const active = variant._id === selectedVariantId;

                        return (
                          <TouchableOpacity
                            key={variant._id}
                            style={[styles.variantChoice, active && styles.variantChoiceActive]}
                            onPress={() => selectVariant(variant)}
                            activeOpacity={0.82}
                          >
                            <Text style={[styles.variantChoiceText, active && styles.variantChoiceTextActive]}>
                              {variant.fitType?.label ?? 'Mặc định'}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>
                ) : null}

                <View style={styles.variantSection}>
                  <Text style={styles.variantSectionTitle}>Màu sắc</Text>
                  <View style={styles.colorChoiceWrap}>
                    {selectedVariant?.colors.map((color) => {
                      const active = color._id === selectedColorId;

                      return (
                        <TouchableOpacity
                          key={color._id}
                          style={[styles.colorChoice, active && styles.colorChoiceActive]}
                          onPress={() => selectColor(color)}
                          activeOpacity={0.82}
                        >
                          <RemoteImage uri={color.image} style={styles.colorChoiceImage} recyclingKey={color._id} />
                          <Text style={[styles.colorChoiceText, active && styles.colorChoiceTextActive]} numberOfLines={1}>
                            {color.color}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>

                <View style={styles.variantSection}>
                  <Text style={styles.variantSectionTitle}>Size</Text>
                  <View style={styles.variantChoiceWrap}>
                    {selectedVariant?.sizes.map((sizeOption) => {
                      const active = sizeOption.size === selectedSize;
                      const available = isSizeAvailableForColor(selectedVariant, selectedColorId, sizeOption);

                      return (
                        <TouchableOpacity
                          key={sizeOption.size}
                          style={[
                            styles.sizeChoice,
                            active && styles.variantChoiceActive,
                            !available && styles.sizeChoiceDisabled,
                          ]}
                          onPress={() => setSelectedSize(sizeOption.size)}
                          disabled={!available}
                          activeOpacity={0.82}
                        >
                          <Text
                            style={[
                              styles.variantChoiceText,
                              active && styles.variantChoiceTextActive,
                              !available && styles.sizeChoiceTextDisabled,
                            ]}
                          >
                            {sizeOption.size}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              </ScrollView>
            ) : null}

            <TouchableOpacity
              style={[styles.variantConfirmButton, !canConfirmConfiguredProduct && styles.variantConfirmButtonDisabled]}
              onPress={confirmConfiguredProduct}
              disabled={!canConfirmConfiguredProduct}
              activeOpacity={0.86}
            >
              <MaterialCommunityIcons name="check" size={21} color={colors.white} />
              <Text style={styles.variantConfirmText}>Dùng biến thể này</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal
        visible={isProductFilterVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setIsProductFilterVisible(false)}
      >
        <View style={styles.filterModalRoot}>
          <Pressable style={styles.filterBackdrop} onPress={() => setIsProductFilterVisible(false)} />
          <View style={styles.filterSheet}>
            <View style={styles.filterSheetHeader}>
              <TouchableOpacity onPress={() => setIsProductFilterVisible(false)} activeOpacity={0.82}>
                <Text style={styles.filterSheetCancel}>Đóng</Text>
              </TouchableOpacity>
              <Text style={styles.filterSheetTitle}>Lọc sản phẩm</Text>
              <TouchableOpacity onPress={resetProductFilters} activeOpacity={0.82}>
                <Text style={styles.filterSheetReset}>Đặt lại</Text>
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.filterSheetContent}>
              <Text style={styles.filterGroupTitle}>Đối tượng</Text>
              <View style={styles.filterChoiceWrap}>
                {genderFilterOptions.map((option) => {
                  const active = productFilters.gender === option.key;

                  return (
                    <TouchableOpacity
                      key={option.key}
                      style={[styles.filterChoice, active && styles.filterChoiceActive]}
                      onPress={() => setProductFilters((current) => ({ ...current, gender: option.key }))}
                      activeOpacity={0.82}
                    >
                      <Text style={[styles.filterChoiceText, active && styles.filterChoiceTextActive]}>
                        {option.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {categoryFilterOptions.length ? (
                <>
                  <Text style={styles.filterGroupTitle}>Loại sản phẩm</Text>
                  <View style={styles.filterChoiceWrap}>
                    {categoryFilterOptions.map((option) => {
                      const active = productFilters.categoryIds.includes(option.id);

                      return (
                        <TouchableOpacity
                          key={option.id}
                          style={[styles.filterChoice, active && styles.filterChoiceActive]}
                          onPress={() => toggleProductFilterValue('categoryIds', option.id)}
                          activeOpacity={0.82}
                        >
                          <Text style={[styles.filterChoiceText, active && styles.filterChoiceTextActive]} numberOfLines={1}>
                            {option.label}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </>
              ) : null}

              {brandFilterOptions.length ? (
                <>
                  <Text style={styles.filterGroupTitle}>Thương hiệu</Text>
                  <View style={styles.filterChoiceWrap}>
                    {brandFilterOptions.map((option) => {
                      const active = productFilters.brandIds.includes(option.id);

                      return (
                        <TouchableOpacity
                          key={option.id}
                          style={[styles.filterChoice, active && styles.filterChoiceActive]}
                          onPress={() => toggleProductFilterValue('brandIds', option.id)}
                          activeOpacity={0.82}
                        >
                          <Text style={[styles.filterChoiceText, active && styles.filterChoiceTextActive]} numberOfLines={1}>
                            {option.label}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </>
              ) : null}

              <Text style={styles.filterGroupTitle}>Sắp xếp</Text>
              <View style={styles.filterChoiceWrap}>
                {tryOnSortOptions.map((option) => {
                  const active = productFilters.sort === option.key;

                  return (
                    <TouchableOpacity
                      key={option.key}
                      style={[styles.filterChoice, active && styles.filterChoiceActive]}
                      onPress={() => setProductFilters((current) => ({ ...current, sort: option.key }))}
                      activeOpacity={0.82}
                    >
                      <Text style={[styles.filterChoiceText, active && styles.filterChoiceTextActive]}>
                        {option.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={styles.filterGroupTitle}>Tình trạng</Text>
              <View style={styles.filterChoiceWrap}>
                <TouchableOpacity
                  style={[styles.filterChoice, productFilters.isNew && styles.filterChoiceActive]}
                  onPress={() => setProductFilters((current) => ({ ...current, isNew: current.isNew ? undefined : true }))}
                  activeOpacity={0.82}
                >
                  <Text style={[styles.filterChoiceText, productFilters.isNew && styles.filterChoiceTextActive]}>
                    Hàng mới
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.filterChoice, productFilters.isSale && styles.filterChoiceActive]}
                  onPress={() => setProductFilters((current) => ({ ...current, isSale: current.isSale ? undefined : true }))}
                  activeOpacity={0.82}
                >
                  <Text style={[styles.filterChoiceText, productFilters.isSale && styles.filterChoiceTextActive]}>
                    Đang sale
                  </Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: tryOnPalette.ink,
  },
  header: {
    minHeight: 78,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: tryOnPalette.ink,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(243,201,120,0.22)',
  },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(243,201,120,0.26)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    color: colors.white,
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '900',
    textAlign: 'center',
  },
  headerSpacer: {
    width: 40,
  },
  content: {
    flex: 1,
    backgroundColor: tryOnPalette.mist,
  },
  scrollContent: {
    padding: spacing.md,
    paddingBottom: 128,
    gap: spacing.md,
  },
  sourceCard: {
    borderRadius: radii.md,
    backgroundColor: tryOnPalette.inkSoft,
    borderWidth: 1,
    borderColor: 'rgba(243,201,120,0.26)',
    padding: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    ...shadows.card,
  },
  sourceImageWrap: {
    width: 74,
    height: 92,
    borderRadius: radii.sm,
    overflow: 'hidden',
    backgroundColor: 'rgba(243,201,120,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(243,201,120,0.38)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sourceImage: {
    width: '100%',
    height: '100%',
  },
  sourceCopy: {
    flex: 1,
  },
  sourceTitle: {
    color: colors.white,
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '900',
  },
  sourceText: {
    color: '#DDE7EC',
    fontSize: 12,
    lineHeight: 18,
    marginTop: 2,
  },
  sectionTitle: {
    color: tryOnPalette.ink,
    fontSize: 18,
    lineHeight: 23,
    fontWeight: '900',
    marginTop: spacing.sm,
  },
  modeRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  modeButton: {
    flex: 1,
    minHeight: 76,
    borderRadius: radii.sm,
    backgroundColor: tryOnPalette.porcelain,
    borderWidth: 1,
    borderColor: tryOnPalette.line,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    paddingHorizontal: spacing.xs,
    ...shadows.card,
  },
  modeButtonActive: {
    backgroundColor: tryOnPalette.ink,
    borderColor: tryOnPalette.champagne,
  },
  modeText: {
    color: colors.brandDark,
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '900',
  },
  modeTextActive: {
    color: colors.white,
  },
  modeDescription: {
    color: colors.textMuted,
    fontSize: 10,
    lineHeight: 13,
    fontWeight: '700',
    textAlign: 'center',
  },
  outfitHeaderRow: {
    marginTop: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  outfitProgress: {
    color: tryOnPalette.rose,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '900',
  },
  slotGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  slotCard: {
    minHeight: 128,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: tryOnPalette.line,
    backgroundColor: tryOnPalette.porcelain,
    padding: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    position: 'relative',
    ...shadows.card,
  },
  slotCardSingle: {
    width: '100%',
    minHeight: 96,
    flexDirection: 'row',
    justifyContent: 'flex-start',
    gap: spacing.sm,
  },
  slotCardTwo: {
    width: '48.5%',
  },
  slotCardThree: {
    width: '31.6%',
  },
  slotCardActive: {
    borderColor: tryOnPalette.champagne,
    backgroundColor: tryOnPalette.inkSoft,
  },
  slotCardFilled: {
    backgroundColor: '#FFFDF8',
    borderColor: tryOnPalette.rose,
  },
  slotIconWrap: {
    width: 58,
    height: 58,
    borderRadius: radii.sm,
    backgroundColor: tryOnPalette.champagneSoft,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  slotImage: {
    width: '100%',
    height: '100%',
  },
  slotCopy: {
    width: '100%',
    justifyContent: 'center',
  },
  slotCardSingleCopy: {
    flex: 1,
  },
  slotLabel: {
    color: colors.text,
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '900',
    textAlign: 'center',
  },
  slotHelper: {
    color: colors.textMuted,
    fontSize: 11,
    lineHeight: 15,
    marginTop: 2,
    textAlign: 'center',
  },
  slotMeta: {
    color: tryOnPalette.teal,
    fontSize: 10,
    lineHeight: 14,
    fontWeight: '800',
    marginTop: 2,
    textAlign: 'center',
  },
  slotTextActive: {
    color: colors.white,
  },
  slotRemoveButton: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  slotRemoveButtonSingle: {
    top: 'auto',
    right: spacing.sm,
  },
  slotSingleText: {
    textAlign: 'left',
  },
  searchRow: {
    minHeight: 44,
    borderRadius: radii.sm,
    backgroundColor: '#FFFDF8',
    borderWidth: 1,
    borderColor: tryOnPalette.line,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    ...shadows.card,
  },
  searchInput: {
    flex: 1,
    minHeight: 44,
    color: colors.text,
    fontSize: 14,
  },
  searchFilterButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: tryOnPalette.champagneSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchFilterButtonActive: {
    backgroundColor: tryOnPalette.teal,
  },
  searchFilterBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 17,
    height: 17,
    borderRadius: 9,
    backgroundColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  searchFilterBadgeText: {
    color: colors.white,
    fontSize: 10,
    lineHeight: 13,
    fontWeight: '900',
  },
  genderSegment: {
    minHeight: 48,
    borderRadius: radii.md,
    backgroundColor: '#FFFDF8',
    borderWidth: 1,
    borderColor: tryOnPalette.line,
    padding: 5,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    ...shadows.card,
  },
  genderChip: {
    flex: 1,
    minHeight: 36,
    borderRadius: radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 4,
    paddingHorizontal: 6,
  },
  genderChipActive: {
    backgroundColor: tryOnPalette.champagne,
  },
  genderChipText: {
    color: tryOnPalette.ink,
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '900',
  },
  genderChipTextActive: {
    color: tryOnPalette.ink,
  },
  loading: {
    paddingVertical: spacing.xl,
  },
  productHeaderRow: {
    marginTop: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  productCount: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '800',
  },
  productGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  productCard: {
    width: '47.8%',
    borderWidth: 1,
    borderColor: tryOnPalette.line,
    borderRadius: radii.md,
    backgroundColor: tryOnPalette.porcelain,
    overflow: 'hidden',
    ...shadows.card,
  },
  productCardSelected: {
    borderColor: tryOnPalette.rose,
    borderWidth: 2,
  },
  productImageWrap: {
    width: '100%',
    aspectRatio: 1,
    backgroundColor: '#DFE8EA',
  },
  productImage: {
    width: '100%',
    height: '100%',
  },
  roleBadge: {
    position: 'absolute',
    left: spacing.sm,
    top: spacing.sm,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(23,34,49,0.92)',
    borderWidth: 1,
    borderColor: 'rgba(243,201,120,0.42)',
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
  },
  roleBadgeText: {
    color: tryOnPalette.champagne,
    fontSize: 10,
    lineHeight: 13,
    fontWeight: '900',
  },
  selectedMark: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: tryOnPalette.teal,
    alignItems: 'center',
    justifyContent: 'center',
  },
  productName: {
    minHeight: 38,
    color: tryOnPalette.ink,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '800',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
  },
  productPrice: {
    color: tryOnPalette.rose,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '900',
  },
  productFooter: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
    paddingTop: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: 'rgba(217,223,227,0.72)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  selectedList: {
    gap: spacing.sm,
  },
  selectedItem: {
    borderRadius: radii.sm,
    backgroundColor: colors.surface,
    padding: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  selectedImage: {
    width: 58,
    height: 58,
    borderRadius: radii.xs,
  },
  selectedCopy: {
    flex: 1,
  },
  selectedRole: {
    color: colors.brand,
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '900',
  },
  selectedName: {
    color: colors.text,
    fontSize: 14,
    lineHeight: 19,
    fontWeight: '900',
  },
  selectedMeta: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 16,
  },
  removeButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptySelection: {
    borderRadius: radii.sm,
    backgroundColor: colors.surface,
    padding: spacing.lg,
  },
  emptySelectionText: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
  },
  contextGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  contextChip: {
    minHeight: 38,
    borderWidth: 1,
    borderColor: tryOnPalette.line,
    borderRadius: radii.pill,
    backgroundColor: tryOnPalette.porcelain,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  contextChipActive: {
    backgroundColor: tryOnPalette.plum,
    borderColor: tryOnPalette.plum,
  },
  contextText: {
    color: colors.brandDark,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '900',
  },
  contextTextActive: {
    color: colors.white,
  },
  promptInput: {
    minHeight: 86,
    borderWidth: 1,
    borderColor: tryOnPalette.line,
    borderRadius: radii.sm,
    backgroundColor: '#FFFDF8',
    padding: spacing.md,
    color: colors.text,
    fontSize: 14,
    lineHeight: 20,
    textAlignVertical: 'top',
  },
  outputOptionCard: {
    minHeight: 86,
    borderRadius: radii.md,
    backgroundColor: '#FFFDF8',
    borderWidth: 1,
    borderColor: tryOnPalette.line,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    ...shadows.card,
  },
  outputOptionIcon: {
    width: 44,
    height: 44,
    borderRadius: radii.sm,
    backgroundColor: tryOnPalette.champagneSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  outputOptionCopy: {
    flex: 1,
  },
  outputOptionTitle: {
    color: colors.text,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '900',
  },
  outputOptionText: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 2,
  },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopWidth: 1,
    borderTopColor: 'rgba(243,201,120,0.28)',
    backgroundColor: tryOnPalette.ink,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  footerLabel: {
    color: '#CAD6DC',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '800',
  },
  footerTotal: {
    color: colors.white,
    fontSize: 17,
    lineHeight: 23,
    fontWeight: '900',
  },
  submitButton: {
    minWidth: 170,
    minHeight: 50,
    borderRadius: radii.sm,
    backgroundColor: tryOnPalette.rose,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  submitButtonDisabled: {
    backgroundColor: colors.disabled,
  },
  submitText: {
    color: colors.white,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '900',
  },
  variantModalRoot: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'transparent',
  },
  variantBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.34)',
  },
  variantSheet: {
    maxHeight: '86%',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl,
  },
  variantHeader: {
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  variantTitle: {
    color: colors.text,
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '900',
  },
  variantCloseButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  variantContent: {
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
    gap: spacing.lg,
  },
  variantPreviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  variantPreviewImageWrap: {
    width: 92,
    height: 112,
    borderRadius: radii.sm,
    backgroundColor: colors.brandSoft,
    overflow: 'hidden',
  },
  variantPreviewImage: {
    width: '100%',
    height: '100%',
  },
  variantPreviewCopy: {
    flex: 1,
  },
  variantProductName: {
    color: colors.text,
    fontSize: 16,
    lineHeight: 21,
    fontWeight: '900',
  },
  variantProductPrice: {
    color: colors.brand,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '900',
    marginTop: 4,
  },
  variantProductMeta: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 4,
  },
  variantSection: {
    gap: spacing.sm,
  },
  variantSectionTitle: {
    color: colors.text,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '900',
  },
  variantChoiceWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  variantChoice: {
    minHeight: 40,
    borderRadius: radii.xs,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.field,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  variantChoiceActive: {
    borderColor: colors.brand,
    backgroundColor: colors.brand,
  },
  variantChoiceText: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '800',
  },
  variantChoiceTextActive: {
    color: colors.white,
  },
  colorChoiceWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  colorChoice: {
    width: 92,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.field,
    overflow: 'hidden',
  },
  colorChoiceActive: {
    borderColor: colors.brand,
    borderWidth: 2,
    backgroundColor: colors.surface,
  },
  colorChoiceImage: {
    width: '100%',
    height: 72,
  },
  colorChoiceText: {
    color: colors.text,
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '800',
    paddingHorizontal: spacing.xs,
    paddingVertical: 6,
    textAlign: 'center',
  },
  colorChoiceTextActive: {
    color: colors.brand,
  },
  sizeChoice: {
    minWidth: 48,
    minHeight: 40,
    borderRadius: radii.xs,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.field,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  sizeChoiceDisabled: {
    backgroundColor: colors.background,
    borderColor: colors.border,
    opacity: 0.5,
  },
  sizeChoiceTextDisabled: {
    color: colors.textSubtle,
  },
  variantConfirmButton: {
    minHeight: 50,
    borderRadius: radii.sm,
    backgroundColor: colors.brand,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  variantConfirmButtonDisabled: {
    backgroundColor: colors.disabled,
  },
  variantConfirmText: {
    color: colors.white,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '900',
  },
  filterModalRoot: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'transparent',
  },
  filterBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.34)',
  },
  filterSheet: {
    maxHeight: '78%',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    backgroundColor: tryOnPalette.porcelain,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl,
    gap: spacing.md,
  },
  filterSheetContent: {
    gap: spacing.md,
    paddingBottom: spacing.md,
  },
  filterSheetHeader: {
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  filterSheetCancel: {
    color: colors.textMuted,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '800',
  },
  filterSheetTitle: {
    color: colors.text,
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '900',
  },
  filterSheetReset: {
    color: colors.brand,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '900',
  },
  filterGroupTitle: {
    color: colors.text,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '900',
  },
  filterChoiceWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  filterChoice: {
    minHeight: 40,
    borderRadius: radii.xs,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.field,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterChoiceActive: {
    borderColor: colors.brand,
    backgroundColor: colors.brand,
  },
  filterChoiceText: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '800',
  },
  filterChoiceTextActive: {
    color: colors.white,
  },
});

export default VirtualTryOnBuilderScreen;
