import React from 'react';
import { ActivityIndicator, Alert, Animated, Easing, LayoutAnimation, Modal, NativeScrollEvent, NativeSyntheticEvent, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, TouchableOpacity, UIManager, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import type { RootStackParamList } from '../../navigation/AppNavigator';
import { RemoteImage } from '../../components/media/RemoteImage';
import ColorSwatch from '../../components/ui/ColorSwatch';
import { colors, radii, shadows, spacing } from '../../theme';
import { hasNextPage, mergePageItems, type PageInfo } from '../../utils/pagination';
import {
  catalogApi,
  type CatalogCategory,
  type CatalogProduct,
  type CatalogProductDetail,
  type ProductDetailColor,
  type ProductListParams,
  type ProductDetailVariant,
  type ProductListResponse,
} from '../catalog/catalogApi';
import { useAuth } from '../auth/AuthContext';
import { VirtualTryOnApiError, virtualTryOnApi } from './virtualTryOnApi';
import {
  isImageValidationHardBlockReason,
  isImageValidationSoftGuidanceReason,
} from './imageValidationPolicy';
import {
  TRY_ON_ACTIVE_ITEM_LIMIT,
  TRY_ON_QUEUE_LIMIT,
  type TryOnContextPreset,
  type TryOnImageValidationCapability,
  type TryOnImageValidationCapabilityMode,
  type TryOnImageValidationResult,
  type TryOnItemRole,
  type TryOnOutfitMode,
  type TryOnSeedItem,
  type TryOnSelectedItem,
  type VirtualTryOnCapabilities,
} from './virtualTryOn.types';
import {
  allTryOnRoles,
  getOutfitSlots,
  getPrefillOutfitMode,
  getQueueSlotGroups,
  getSelectedItemKey,
  getSeedItemKey,
  inferRole,
  isFullOutfitProduct,
  isFullOutfitSelectedItem,
  isSameTryOnItem,
  normalizeItemsForMode,
  normalizeSelectionForMode,
  selectItemForSlot,
  selectedItemToSeed,
  tryOnRoleLabel as roleLabel,
  type FashionIconName,
  type OutfitSlot,
  type SlotAlternativeGroup,
  } from './virtualTryOnSelection';
import { contextPresets } from './contextPresets';

type NavigationProp = StackNavigationProp<RootStackParamList, 'VirtualTryOnBuilder'>;
type RouteProps = RouteProp<RootStackParamList, 'VirtualTryOnBuilder'>;
type MaterialIconName = keyof typeof MaterialCommunityIcons.glyphMap;
type CategoryRailVisual = { icon: MaterialIconName } | { custom: 'pants' };
type TryOnProductSort = 'recommended' | 'price_asc' | 'price_desc';
type TryOnGenderFilter = 'male' | 'female';
type ImageValidationStatus = 'idle' | 'checking' | 'valid' | 'invalid' | 'error';

type ImageValidationState = {
  status: ImageValidationStatus;
  key: string;
  result?: TryOnImageValidationResult;
  errorCode?: string | null;
  message?: string;
};

type BuilderPreviewImage = {
  uri: string;
  label: string;
  recyclingKey: string;
  resizeMode?: 'cover' | 'contain';
};

type TryOnProductFilters = {
  categoryIds: string[];
  brandIds: string[];
  gender: TryOnGenderFilter;
  minPrice?: number;
  maxPrice?: number;
  isNew?: boolean;
  isSale?: boolean;
  sort: TryOnProductSort;
};

type TryOnProductMultiFilterKey = 'categoryIds' | 'brandIds';

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

const defaultTryOnProductFilters: TryOnProductFilters = {
  categoryIds: [],
  brandIds: [],
  gender: 'male',
  sort: 'recommended',
};

const emptyTryOnAvailableFilters: ProductListResponse['filters'] = {
  brands: [],
  colors: [],
  fitTypes: [],
  sizes: [],
  categories: [],
};

const tryOnPalette = {
  ink: '#213448',
  primaryDark: '#213448',
  primary: '#547792',
  primaryLight: '#6B8CA8',
  primarySoft: '#EDF4F7',
  primaryPale: '#DDE7EC',
  header: '#547792',
  headerSoft: '#DDE7EC',
  surface: '#FFFFFF',
  canvas: '#F6FAFD',
  teal: '#198754',
  tealSoft: '#EAF7EF',
  line: '#DDE7EC',
  success: '#198754',
  successSoft: '#EAF7EF',
} as const;
const PRODUCT_PAGE_SIZE = 30;

const VIDEO_DURATION_MIN_SECONDS = 5;
const VIDEO_DURATION_MAX_SECONDS = 12;
const VIDEO_DURATION_DEFAULT_SECONDS = 5;
const VIDEO_DURATION_THUMB_SIZE = 22;

const clampVideoDuration = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, Math.round(value)));

const VideoDurationSlider = ({
  value,
  min,
  max,
  onChange,
}: {
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
}) => {
  const trackRef = React.useRef<View>(null);
  const trackLeftRef = React.useRef(0);
  const [trackWidth, setTrackWidth] = React.useState(0);
  const range = Math.max(1, max - min);
  const progress = (clampVideoDuration(value, min, max) - min) / range;
  const usableWidth = Math.max(0, trackWidth - VIDEO_DURATION_THUMB_SIZE);
  const thumbLeft = usableWidth * progress;

  const updateFromPageX = React.useCallback((pageX: number, left = trackLeftRef.current, width = trackWidth) => {
    const nextUsableWidth = Math.max(1, width - VIDEO_DURATION_THUMB_SIZE);
    const nextProgress = Math.min(
      1,
      Math.max(0, (pageX - left - VIDEO_DURATION_THUMB_SIZE / 2) / nextUsableWidth),
    );
    onChange(clampVideoDuration(min + nextProgress * range, min, max));
  }, [max, min, onChange, range, trackWidth]);

  const beginSliding = React.useCallback((pageX: number) => {
    trackRef.current?.measureInWindow((left, _top, width) => {
      trackLeftRef.current = left;
      setTrackWidth(width);
      updateFromPageX(pageX, left, width);
    });
  }, [updateFromPageX]);

  return (
    <View style={styles.videoDurationControl}>
      <View style={styles.videoDurationHeader}>
        <View style={styles.videoDurationTitleRow}>
          <MaterialCommunityIcons name="timer-outline" size={18} color={tryOnPalette.primary} />
          <Text style={styles.videoDurationLabel}>Thời lượng video</Text>
        </View>
        <View style={styles.videoDurationValueBadge}>
          <Text style={styles.videoDurationValue}>{value} giây</Text>
        </View>
      </View>
      <View
        ref={trackRef}
        style={styles.videoDurationTrackTouch}
        onLayout={(event) => setTrackWidth(event.nativeEvent.layout.width)}
        onStartShouldSetResponder={() => true}
        onMoveShouldSetResponder={() => true}
        onResponderGrant={(event) => beginSliding(event.nativeEvent.pageX)}
        onResponderMove={(event) => updateFromPageX(event.nativeEvent.pageX)}
        onResponderTerminationRequest={() => false}
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel="Thời lượng video"
        accessibilityHint="Vuốt hoặc chạm để chọn thời lượng từ 5 đến 12 giây"
        accessibilityValue={{ min, max, now: value, text: `${value} giây` }}
        accessibilityActions={[
          { name: 'decrement', label: 'Giảm một giây' },
          { name: 'increment', label: 'Tăng một giây' },
        ]}
        onAccessibilityAction={(event) => {
          if (event.nativeEvent.actionName === 'decrement') {
            onChange(clampVideoDuration(value - 1, min, max));
          } else if (event.nativeEvent.actionName === 'increment') {
            onChange(clampVideoDuration(value + 1, min, max));
          }
        }}
      >
        <View style={styles.videoDurationRail} />
        <View
          pointerEvents="none"
          style={[styles.videoDurationFill, { width: thumbLeft }]}
        />
        <View pointerEvents="none" style={[styles.videoDurationThumb, { left: thumbLeft }]} />
      </View>
      <View style={styles.videoDurationBounds}>
        <Text style={styles.videoDurationBoundText}>{min} giây</Text>
        <Text style={styles.videoDurationBoundText}>{max} giây</Text>
      </View>
    </View>
  );
};

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const formatPrice = (value: number) =>
  `${Math.round(value).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')}đ`;

const pricePresets = [
  { label: 'Tất cả', minPrice: undefined, maxPrice: undefined },
  { label: 'Dưới 200k', minPrice: undefined, maxPrice: 200000 },
  { label: '200k - 500k', minPrice: 200000, maxPrice: 500000 },
  { label: 'Trên 500k', minPrice: 500000, maxPrice: undefined },
];

const isPricePresetActive = (
  filters: TryOnProductFilters,
  preset: (typeof pricePresets)[number],
) => filters.minPrice === preset.minPrice && filters.maxPrice === preset.maxPrice;

const fallbackQuantityLimit = 99;

const outfitModes: Array<{
  key: TryOnOutfitMode;
  label: string;
  description: string;
  icon: FashionIconName;
}> = [
  { key: 'single', label: 'Một món', description: 'Thử nhanh 1 sản phẩm bất kỳ', icon: 'tshirt-crew' },
  { key: 'full_set', label: 'Nhiều món', description: 'Chọn 2-4 món bất kỳ trong áo, quần, giày/dép', icon: 'hanger' },
];

const contextOptions = contextPresets;

const tryOnSortOptions: Array<{
  key: TryOnProductSort;
  label: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
}> = [
  { key: 'recommended', label: 'Gợi ý', icon: 'star-outline' },
  { key: 'price_asc', label: 'Giá thấp', icon: 'sort-ascending' },
  { key: 'price_desc', label: 'Giá cao', icon: 'sort-descending' },
];

const genderFilterOptions: Array<{ key: TryOnGenderFilter; label: string; icon: keyof typeof MaterialCommunityIcons.glyphMap }> = [
  { key: 'male', label: 'Nam', icon: 'gender-male' },
  { key: 'female', label: 'Nữ', icon: 'gender-female' },
];

const uniqueStrings = (values: string[]) =>
  Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));

const normalizeCategoryLabel = (label: string) => label
  .trim()
  .toLocaleLowerCase('vi-VN')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/đ/g, 'd');

const isFootwearCategoryLabel = (label: string) =>
  /(^|[\s/.-])(giay|dep)([\s/.-]|$)/.test(normalizeCategoryLabel(label));

const sortCategoriesByLevelAndName = (a: CatalogCategory, b: CatalogCategory) => {
  const levelDelta = a.level - b.level;
  if (levelDelta !== 0) return levelDelta;

  const footwearDelta = Number(isFootwearCategoryLabel(a.name)) - Number(isFootwearCategoryLabel(b.name));
  if (footwearDelta !== 0) return footwearDelta;

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

const getCategoryRailVisual = (label: string): CategoryRailVisual => {
  const normalizedLabel = normalizeCategoryLabel(label);

  if (isFootwearCategoryLabel(label)) return { icon: 'shoe-sneaker' };
  if (normalizedLabel.includes('set') || normalizedLabel.includes('bo')) return { icon: 'layers-triple-outline' };
  if (normalizedLabel.includes('ao')) return { icon: 'tshirt-crew-outline' };
  if (normalizedLabel.includes('quan')) return { custom: 'pants' };
  if (normalizedLabel.includes('vay') || normalizedLabel.includes('dam')) return { icon: 'human-female-dance' };
  return { icon: 'wardrobe-outline' };
};

const isTryOnGenderMatch = (
  gender: CatalogCategory['gender'] | undefined,
  filter: TryOnGenderFilter,
) => gender === filter;

const isTryOnCategorySlotMatch = (category: CatalogCategory, slot: OutfitSlot) => {
  if (slot.roles.length === allTryOnRoles.length) return true;
  if (isFullOutfitProduct({ name: category.name, category: { name: category.name } })) return false;

  return slot.roles.includes(inferRole({ name: category.name, category: { name: category.name } }));
};

const getTryOnScopedCategories = (
  categories: CatalogCategory[],
  gender: TryOnGenderFilter,
  slot: OutfitSlot,
) => categories.filter((category) =>
  isTryOnGenderMatch(category.gender, gender) &&
  isTryOnCategorySlotMatch(category, slot),
);

const getTryOnProductApiSort = (sort: TryOnProductSort): ProductListParams['sort'] =>
  sort === 'recommended' ? 'newest' : sort;

const getTryOnCategoryQueryIds = (
  filters: TryOnProductFilters,
  scopedCategories: CatalogCategory[],
  slot: OutfitSlot,
) => {
  if (filters.categoryIds.length) return filters.categoryIds;
  if (slot.roles.length === allTryOnRoles.length) return [];
  return scopedCategories.map((category) => category._id);
};

const buildTryOnProductQueryParams = ({
  filters,
  scopedCategories,
  slot,
  searchTerm,
}: {
  filters: TryOnProductFilters;
  scopedCategories: CatalogCategory[];
  slot: OutfitSlot;
  searchTerm: string;
}): ProductListParams => {
  const categoryIds = getTryOnCategoryQueryIds(filters, scopedCategories, slot);
  const keyword = searchTerm.trim();

  return {
    gender: filters.gender,
    ...(keyword ? { keyword } : {}),
    ...(categoryIds.length ? { categoryId: categoryIds } : {}),
    ...(filters.brandIds.length ? { brandId: filters.brandIds } : {}),
    ...(filters.minPrice !== undefined ? { minPrice: filters.minPrice } : {}),
    ...(filters.maxPrice !== undefined ? { maxPrice: filters.maxPrice } : {}),
    ...(filters.isNew !== undefined ? { isNew: filters.isNew } : {}),
    ...(filters.isSale !== undefined ? { isSale: filters.isSale } : {}),
    sort: getTryOnProductApiSort(filters.sort),
    limit: PRODUCT_PAGE_SIZE,
  };
};

const getTryOnProductQueryKey = (query: ProductListParams) => JSON.stringify({
  ...query,
  categoryId: Array.isArray(query.categoryId) ? [...query.categoryId].sort() : query.categoryId,
  brandId: Array.isArray(query.brandId) ? [...query.brandId].sort() : query.brandId,
});

const mergeCatalogCategories = (
  current: CatalogCategory[],
  next: CatalogCategory[] = [],
) => {
  const categoryById = new Map(current.map((category) => [category._id, category]));
  next.forEach((category) => categoryById.set(category._id, category));
  return Array.from(categoryById.values());
};

const mergeAvailableProductFilters = (
  current: ProductListResponse['filters'],
  next?: ProductListResponse['filters'],
): ProductListResponse['filters'] => next
  ? {
    ...emptyTryOnAvailableFilters,
    ...next,
    sizes: next.sizes ?? [],
    categories: mergeCatalogCategories(current.categories, next.categories),
  }
  : current;

const PantsGlyph = ({ color, size = 22 }: { color: string; size?: number }) => {
  const stroke = Math.max(2, Math.round(size * 0.09));
  const waistHeight = Math.round(size * 0.22);
  const legTop = Math.round(size * 0.24);
  const sideInset = Math.round(size * 0.17);
  const legWidth = Math.round(size * 0.29);
  const legHeight = Math.round(size * 0.68);
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

const CategoryRailIcon = ({ visual, color }: { visual: CategoryRailVisual; color: string }) => {
  return 'icon' in visual
    ? <MaterialCommunityIcons name={visual.icon} size={23} color={color} />
    : <PantsGlyph color={color} />;
};

const getCategorySelectionGroups = (
  categoryIds: string[],
  categories: CatalogCategory[],
): CategorySelectionGroup[] => {
  const categoryById = new Map(categories.map((category) => [category._id, category]));
  const groups = new Map<string, CategorySelectionGroup>();

  categoryIds.forEach((categoryId) => {
    const category = categoryById.get(categoryId);
    const label = category?.name ?? 'Danh mục';
    const key = category ? `${category.level}:${normalizeCategoryKey(category.name)}` : categoryId;
    const group = groups.get(key) ?? { key, label, categoryIds: [] };

    if (!group.categoryIds.includes(categoryId)) {
      group.categoryIds.push(categoryId);
    }

    groups.set(key, group);
  });

  return Array.from(groups.values());
};

const getSelectionCapabilityModes = (
  _outfitMode: TryOnOutfitMode,
  selectedItems: Array<Pick<TryOnSelectedItem, 'role'>>,
): TryOnImageValidationCapabilityMode[] => {
  return Array.from(new Set(selectedItems.map((item) => item.role as TryOnImageValidationCapabilityMode)));
};

const getUnsupportedImageValidationCapability = (
  result: TryOnImageValidationResult,
  outfitMode: TryOnOutfitMode,
  selectedItems: Array<Pick<TryOnSelectedItem, 'role'>>,
): TryOnImageValidationCapability | null => {
  const capabilityByMode = new Map((result.capabilities ?? []).map((capability) => [capability.mode, capability]));
  const supportedModes = result.supportedModes ?? [];

  for (const mode of getSelectionCapabilityModes(outfitMode, selectedItems)) {
    const capability = capabilityByMode.get(mode);
    if (capability && !capability.allowed) return capability;

    if (!capability && supportedModes.length && !supportedModes.includes(mode)) {
      const blockedMode = result.blockedModes?.[mode];
      return {
        mode,
        allowed: false,
        reasonCode: blockedMode?.reasonCode ?? 'BODY_NOT_VISIBLE',
        message: blockedMode?.message ?? null,
        requiredRegions: [],
        missingRegions: blockedMode?.missingRegions ?? [],
      };
    }
  }

  return null;
};

const imageValidationAlerts: Record<string, { title: string; message: string }> = {
  NO_PERSON_DETECTED: {
    title: 'Cần ảnh người mặc',
    message: 'Hãy chọn ảnh có người hoặc một phần cơ thể rõ hơn.',
  },
  MULTIPLE_PEOPLE_DETECTED: {
    title: 'Ảnh có nhiều người',
    message: 'Nên dùng ảnh chỉ có một người.',
  },
  PERSON_TOO_SMALL: {
    title: 'Người quá nhỏ',
    message: 'Nên chọn ảnh chụp gần hơn.',
  },
  BODY_NOT_VISIBLE: {
    title: 'Chưa đủ vùng cho món này',
    message: 'Nên chọn ảnh thấy rõ vùng cần phối.',
  },
  POSE_NOT_SUPPORTED: {
    title: 'Tư thế khó xử lý',
    message: 'Chọn ảnh đứng thẳng, ít bị che.',
  },
  IMAGE_TOO_BLURRY: {
    title: 'Ảnh bị mờ',
    message: 'Chọn ảnh rõ nét hơn.',
  },
  IMAGE_TOO_DARK: {
    title: 'Ảnh quá tối',
    message: 'Chọn ảnh sáng hơn.',
  },
  IMAGE_TOO_SMALL: {
    title: 'Ảnh quá nhỏ',
    message: 'Chọn ảnh lớn hơn.',
  },
  IMAGE_POLICY_BLOCKED: {
    title: 'Ảnh cần lưu ý',
    message: 'Bạn vẫn có thể tiếp tục phối đồ.',
  },
  VALIDATION_PROVIDER_FAILED: {
    title: 'Chưa kiểm tra được ảnh',
    message: 'Hãy thử kiểm tra lại ảnh sau ít phút.',
  },
};

const promptValidationAlerts: Record<string, { title: string; message: string }> = {
  PROMPT_SEXUAL_CONTENT: {
    title: 'Mô tả chưa phù hợp',
    message: 'Bỏ nội dung nhạy cảm khỏi mô tả.',
  },
  PROMPT_VIOLENCE: {
    title: 'Mô tả chưa phù hợp',
    message: 'Bỏ nội dung bạo lực khỏi mô tả.',
  },
  PROMPT_PERSONAL_DATA: {
    title: 'Không dùng dữ liệu cá nhân',
    message: 'Bỏ số điện thoại, địa chỉ hoặc giấy tờ.',
  },
  PROMPT_PROFANITY: {
    title: 'Mô tả chưa phù hợp',
    message: 'Dùng mô tả lịch sự hơn.',
  },
  PROMPT_HATE_OR_HARASSMENT: {
    title: 'Mô tả chưa phù hợp',
    message: 'Bỏ nội dung xúc phạm hoặc kỳ thị.',
  },
  PROMPT_INJECTION: {
    title: 'Mô tả chưa hợp lệ',
    message: 'Chỉ mô tả bối cảnh, phong cách hoặc dịp mặc.',
  },
  PROMPT_TOO_LONG: {
    title: 'Mô tả quá dài',
    message: 'Rút gọn mô tả.',
  },
};

type PromptPolicyErrorData = {
  violationCount?: number;
  violationLimit?: number;
  remainingViolations?: number;
  blockedUntil?: string | null;
};

const getPromptPolicyErrorData = (value: unknown): PromptPolicyErrorData | null => {
  if (!value || typeof value !== 'object') return null;
  return value as PromptPolicyErrorData;
};

const formatPromptBlockedUntil = (value?: string | null) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const appendPromptPolicyHint = (message: string, data: PromptPolicyErrorData | null) => {
  if (!data || typeof data.remainingViolations !== 'number' || data.remainingViolations <= 0) {
    return message;
  }

  return `${message}\n\nCòn ${data.remainingViolations} lần vi phạm hôm nay trước khi tính năng phối đồ ảo bị tạm khóa.`;
};

const getCreateJobErrorAlert = (error: unknown) => {
  if (error instanceof VirtualTryOnApiError && error.errorCode) {
    const validationAlert = imageValidationAlerts[error.errorCode];
    if (validationAlert) return validationAlert;

    if (error.errorCode === 'VIRTUAL_TRY_ON_ACCOUNT_LOCKED') {
      return {
        title: 'Tài khoản bị khóa',
        message: error.message || 'Tính năng phối đồ đang bị khóa. Hãy liên hệ cửa hàng để được hỗ trợ.',
      };
    }

    const promptPolicyData = getPromptPolicyErrorData(error.data);
    if (
      error.errorCode === 'PROMPT_POLICY_DAILY_LIMIT_REACHED' ||
      error.errorCode === 'PROMPT_POLICY_TEMPORARY_BLOCKED'
    ) {
      const blockedUntil = formatPromptBlockedUntil(promptPolicyData?.blockedUntil);
      return {
        title: 'Tạm khóa phối đồ ảo',
        message: blockedUntil
          ? `Bạn đã nhập mô tả vi phạm quá nhiều lần hôm nay. Tính năng tạo ảnh sẽ mở lại sau ${blockedUntil}.`
          : (error.message || 'Tính năng tạo ảnh đang bị tạm khóa do nhập mô tả vi phạm nhiều lần.'),
      };
    }

    const promptAlert = promptValidationAlerts[error.errorCode];
    if (promptAlert) {
      return {
        ...promptAlert,
        message: appendPromptPolicyHint(promptAlert.message, promptPolicyData),
      };
    }
  }

  return {
    title: 'Phối đồ',
    message: error instanceof Error ? error.message : 'Không thể tạo yêu cầu phối đồ.',
  };
};

const getImageValidationMessage = (
  result?: TryOnImageValidationResult,
  fallback?: string,
  outfitMode?: TryOnOutfitMode,
  selectedItems: Array<Pick<TryOnSelectedItem, 'role'>> = [],
) => {
  const unsupportedCapability = result && outfitMode
    ? getUnsupportedImageValidationCapability(result, outfitMode, selectedItems)
    : null;
  const reasonCode = unsupportedCapability?.reasonCode ?? result?.reasonCode;
  const validationAlert = reasonCode ? imageValidationAlerts[reasonCode] : undefined;
  if (reasonCode === 'BODY_NOT_VISIBLE') {
    return validationAlert?.message || 'Ảnh chưa đủ vùng cơ thể.';
  }

  const baseMessage = validationAlert?.message ||
    unsupportedCapability?.message ||
    result?.message ||
    fallback ||
    'Ảnh đã sẵn sàng.';

  return baseMessage;
};

const getImageValidationReasonTitle = (reasonCode?: string | null) => {
  if (reasonCode === 'NO_PERSON_DETECTED') return 'Cần ảnh người mặc';
  if (reasonCode === 'MULTIPLE_PEOPLE_DETECTED') return 'Ảnh có nhiều người';
  if (reasonCode === 'BODY_NOT_VISIBLE') return 'Chưa đủ vùng cho món này';
  if (reasonCode === 'IMAGE_POLICY_BLOCKED') return 'Ảnh cần lưu ý';
  if (reasonCode === 'VALIDATION_PROVIDER_FAILED') return 'Chưa kiểm tra được ảnh';
  return reasonCode ? imageValidationAlerts[reasonCode]?.title ?? 'Ảnh cần kiểm tra' : 'Ảnh cần kiểm tra';
};

const getImageValidationReasonTone = (reasonCode?: string | null) => (
  isImageValidationSoftGuidanceReason(reasonCode) ? 'guidance' as const : 'warning' as const
);

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
): TryOnSelectedItem => {
  const isFullOutfit = isFullOutfitProduct(detail);

  return {
    queueKey: `${detail._id}:${variant._id}:${color._id}:${size ?? ''}`,
    productId: detail._id,
    variantId: variant._id,
    colorVariantId: color._id,
    size,
    role: isFullOutfit ? 'dress' : inferRole(detail),
    isFullOutfit,
    nameSnapshot: detail.name,
    colorSnapshot: color.color,
    imageSnapshot: color.image || detail.productImage,
    priceSnapshot: variant.originalPrice,
    finalPriceSnapshot: variant.finalPrice,
  };
};

const createSelectedItemFromSeed = (
  detail: CatalogProductDetail,
  seed: TryOnSeedItem,
): TryOnSelectedItem | null => {
  const variant = detail.variants.find((item) => item._id === seed.variantId && item.isActive);
  const color = variant?.colors.find((item) => item._id === seed.colorVariantId);
  if (!variant || !color) return null;

  const sizeOption = seed.size
    ? variant.sizes.find((item) => item.size.trim().toLowerCase() === seed.size?.trim().toLowerCase())
    : undefined;
  if (seed.size && (!sizeOption || !isSizeAvailableForColor(variant, color._id, sizeOption))) return null;

  const selected = createSelectedItem(
    detail,
    variant,
    color,
    sizeOption?.size ?? getFirstAvailableSize(variant, color._id),
  );

  return {
    ...selected,
    queueKey: getSeedItemKey(seed),
    cartItemId: seed.cartItemId,
    role: seed.role && allTryOnRoles.includes(seed.role) ? seed.role : selected.role,
    isFullOutfit: seed.isFullOutfit ?? selected.isFullOutfit,
    nameSnapshot: seed.nameSnapshot || selected.nameSnapshot,
    colorSnapshot: seed.colorSnapshot || selected.colorSnapshot,
    imageSnapshot: seed.imageSnapshot || selected.imageSnapshot,
  };
};

const VirtualTryOnBuilderScreen = () => {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<RouteProps>();
  const { runWithAuth } = useAuth();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const [products, setProducts] = React.useState<CatalogProduct[]>([]);
  const [selectedItems, setSelectedItems] = React.useState<TryOnSelectedItem[]>([]);
  const [outfitMode, setOutfitMode] = React.useState<TryOnOutfitMode>('single');
  const [contextPreset, setContextPreset] = React.useState<TryOnContextPreset>('custom');
  const [contextPrompt, setContextPrompt] = React.useState('');
  const [includeVideo, setIncludeVideo] = React.useState(false);
  const [videoDurationSeconds, setVideoDurationSeconds] = React.useState(VIDEO_DURATION_DEFAULT_SECONDS);
  const [capabilities, setCapabilities] = React.useState<VirtualTryOnCapabilities | null>(null);
  const [searchTerm, setSearchTerm] = React.useState('');
  const [productFilters, setProductFilters] = React.useState<TryOnProductFilters>(defaultTryOnProductFilters);
  const [draftProductFilters, setDraftProductFilters] = React.useState<TryOnProductFilters>(defaultTryOnProductFilters);
  const [availableFilters, setAvailableFilters] =
    React.useState<ProductListResponse['filters']>(emptyTryOnAvailableFilters);
  const [isProductListVisible, setIsProductListVisible] = React.useState(false);
  const [isProductFilterVisible, setIsProductFilterVisible] = React.useState(false);
  const [isCreateConfirmVisible, setIsCreateConfirmVisible] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(true);
  const [productPagination, setProductPagination] = React.useState<PageInfo | null>(null);
  const [isLoadingMoreProducts, setIsLoadingMoreProducts] = React.useState(false);
  const [isPrefilling, setIsPrefilling] = React.useState(false);
  const [prefillNotice, setPrefillNotice] = React.useState('');
  const [queueItems, setQueueItems] = React.useState<TryOnSelectedItem[]>([]);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [imageValidation, setImageValidation] = React.useState<ImageValidationState>({ status: 'idle', key: '' });
  const [imageValidationRetryNonce, setImageValidationRetryNonce] = React.useState(0);
  const [selectingProductId, setSelectingProductId] = React.useState<string | null>(null);
  const [activeSlotKey, setActiveSlotKey] = React.useState('single');
  const [configuringProduct, setConfiguringProduct] = React.useState<CatalogProductDetail | null>(null);
  const [selectedVariantId, setSelectedVariantId] = React.useState<string>();
  const [selectedColorId, setSelectedColorId] = React.useState<string>();
  const [selectedSize, setSelectedSize] = React.useState<string>();
  const [previewImage, setPreviewImage] = React.useState<BuilderPreviewImage | null>(null);
  const iconPulse = React.useRef(new Animated.Value(0)).current;
  const lastPrefillKeyRef = React.useRef('');
  const isLoadingMoreProductsRef = React.useRef(false);

  const sourceAssetId = route.params?.assetId;
  const sourceImageUrl = route.params?.imageUrl;
  const incomingSeedItems = React.useMemo(() => route.params?.seedItems ?? [], [route.params?.seedItems]);
  const incomingAlternativeSeedItems = React.useMemo(
    () => route.params?.alternativeSeedItems ?? [],
    [route.params?.alternativeSeedItems],
  );
  const incomingSeedKey = React.useMemo(
    () => incomingSeedItems
      .map((item) => `${item.cartItemId ?? ''}:${item.productId}:${item.variantId}:${item.colorVariantId}:${item.size ?? ''}:${item.role ?? ''}`)
      .join('|'),
    [incomingSeedItems],
  );
  const outfitSlots = React.useMemo(() => getOutfitSlots(outfitMode), [outfitMode]);
  const activeSlot = outfitSlots.find((slot) => slot.key === activeSlotKey) ?? outfitSlots[0];
  const hasSelectedFullOutfit = selectedItems.some(isFullOutfitSelectedItem);
  const visibleOutfitSlots = outfitSlots;
  const displayQueueItems = React.useMemo(
    () => queueItems.filter((item) => !selectedItems.some((selected) => isSameTryOnItem(selected, item))),
    [queueItems, selectedItems],
  );
  const queueGroups = React.useMemo(
    () => getQueueSlotGroups(displayQueueItems, outfitMode),
    [displayQueueItems, outfitMode],
  );
  const queueActiveCount = React.useMemo(
    () => queueItems.filter((item) => selectedItems.some((selected) => isSameTryOnItem(selected, item))).length,
    [queueItems, selectedItems],
  );
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
  const productScopedCategories = React.useMemo(
    () => getTryOnScopedCategories(availableFilters.categories, productFilters.gender, activeSlot),
    [activeSlot, availableFilters.categories, productFilters.gender],
  );
  const singleItemCategoryRailGroups = React.useMemo(
    () => outfitMode === 'single' ? buildCategoryFilterGroups(productScopedCategories) : [],
    [outfitMode, productScopedCategories],
  );
  const activeSingleItemCategoryRailGroupKey = React.useMemo(
    () => singleItemCategoryRailGroups.find((group) =>
      getCategoryGroupSelectionIds(group).some((categoryId) => productFilters.categoryIds.includes(categoryId)),
    )?.key,
    [productFilters.categoryIds, singleItemCategoryRailGroups],
  );
  const shouldBalanceSingleItemCategoryRail =
    singleItemCategoryRailGroups.length > 0 && singleItemCategoryRailGroups.length <= 4;
  const draftScopedCategories = React.useMemo(
    () => getTryOnScopedCategories(availableFilters.categories, draftProductFilters.gender, activeSlot),
    [activeSlot, availableFilters.categories, draftProductFilters.gender],
  );
  const productQueryParams = React.useMemo(
    () => buildTryOnProductQueryParams({
      filters: productFilters,
      scopedCategories: productScopedCategories,
      slot: activeSlot,
      searchTerm,
    }),
    [activeSlot, productFilters, productScopedCategories, searchTerm],
  );
  const productQueryKey = React.useMemo(
    () => getTryOnProductQueryKey(productQueryParams),
    [productQueryParams],
  );

  React.useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(iconPulse, {
          toValue: 1,
          duration: 1600,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(iconPulse, {
          toValue: 0,
          duration: 1600,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );

    animation.start();
    return () => animation.stop();
  }, [iconPulse]);

  const activeIconAnimatedStyle = {
    transform: [
      {
        scale: iconPulse.interpolate({
          inputRange: [0, 1],
          outputRange: [1, 1.045],
        }),
      },
    ],
  };

  const animateSelectionLayout = React.useCallback(() => {
    LayoutAnimation.configureNext({
      duration: 220,
      create: {
        type: LayoutAnimation.Types.easeInEaseOut,
        property: LayoutAnimation.Properties.opacity,
      },
      update: {
        type: LayoutAnimation.Types.spring,
        springDamping: 0.82,
      },
      delete: {
        type: LayoutAnimation.Types.easeInEaseOut,
        property: LayoutAnimation.Properties.opacity,
      },
    });
  }, []);

  React.useEffect(() => {
    let isCurrent = true;
    runWithAuth((token) => virtualTryOnApi.getCapabilities(token))
      .then((nextCapabilities) => {
        if (!isCurrent) return;
        setCapabilities(nextCapabilities);
        setVideoDurationSeconds(clampVideoDuration(
          nextCapabilities.videoGeneration.durationSeconds,
          nextCapabilities.videoGeneration.minDurationSeconds ?? VIDEO_DURATION_MIN_SECONDS,
          nextCapabilities.videoGeneration.maxDurationSeconds ?? VIDEO_DURATION_MAX_SECONDS,
        ));
        if (!nextCapabilities.videoGeneration.available) setIncludeVideo(false);
      })
      .catch(() => {
        if (!isCurrent) return;
        setCapabilities(null);
        setIncludeVideo(false);
      });
    return () => { isCurrent = false; };
  }, [runWithAuth]);

  React.useEffect(() => {
    let isCurrent = true;
    isLoadingMoreProductsRef.current = false;
    setIsLoading(true);
    setIsLoadingMoreProducts(false);
    catalogApi
      .getProducts({ ...productQueryParams, page: 1 })
      .then((response) => {
        if (!isCurrent) return;
        setProducts(response.items);
        setProductPagination(response.pagination);
        setAvailableFilters((current) => mergeAvailableProductFilters(current, response.filters));
      })
      .catch(() => {
        if (isCurrent) {
          setProducts([]);
          setProductPagination(null);
          Alert.alert('Sản phẩm', 'Không tải được danh sách.');
        }
      })
      .finally(() => {
        if (isCurrent) setIsLoading(false);
      });

    return () => { isCurrent = false; };
  }, [productQueryKey]);

  const loadMoreProducts = React.useCallback(async () => {
    if (isLoadingMoreProductsRef.current || isLoadingMoreProducts || !hasNextPage(productPagination)) return;
    isLoadingMoreProductsRef.current = true;
    setIsLoadingMoreProducts(true);
    try {
      const response = await catalogApi.getProducts({
        ...productQueryParams,
        page: (productPagination?.page ?? 0) + 1,
      });
      setProducts((current) => mergePageItems(current, response.items));
      setProductPagination(response.pagination);
      setAvailableFilters((current) => mergeAvailableProductFilters(current, response.filters));
    } catch (caught) {
      Alert.alert(
        'Không thể tải thêm sản phẩm',
        caught instanceof Error ? caught.message : 'Bạn thử lại sau nhé.',
      );
    } finally {
      isLoadingMoreProductsRef.current = false;
      setIsLoadingMoreProducts(false);
    }
  }, [isLoadingMoreProducts, productPagination, productQueryKey]);

  React.useEffect(() => {
    if (!incomingSeedKey || lastPrefillKeyRef.current === incomingSeedKey) return;

    lastPrefillKeyRef.current = incomingSeedKey;
    let isCurrent = true;
    setIsPrefilling(true);
    setPrefillNotice('Đang đưa đúng màu và size đã chọn vào phòng phối...');

    const limitedSeedItems = incomingSeedItems.slice(0, TRY_ON_QUEUE_LIMIT);
    const limitedAlternativeSeedItems = incomingAlternativeSeedItems.slice(0, TRY_ON_QUEUE_LIMIT);

    const resolveSeeds = async (seeds: TryOnSeedItem[]) => Promise.all(
      seeds.map(async (seed) => {
        try {
          const detail = await catalogApi.getProductById(seed.productId);
          return createSelectedItemFromSeed(detail, seed);
        } catch {
          return null;
        }
      }),
    ).then((items) => items.filter((item): item is TryOnSelectedItem => Boolean(item)));

    Promise.all([resolveSeeds(limitedSeedItems), resolveSeeds(limitedAlternativeSeedItems)])
      .then(([activeResolved, alternativeResolved]) => {
        if (!isCurrent) return;
        const mode = getPrefillOutfitMode(activeResolved);
        const normalized = normalizeSelectionForMode(activeResolved, mode);

        const seenKeys = new Set(normalized.items.map(getSelectedItemKey));
        const remainingActive = activeResolved.filter((item) => {
          const key = getSelectedItemKey(item);
          if (seenKeys.has(key)) return false;
          seenKeys.add(key);
          return true;
        });
	        const uniqueAlternatives = alternativeResolved.filter((item) => {
	          const key = getSelectedItemKey(item);
	          if (seenKeys.has(key)) return false;
	          seenKeys.add(key);
	          return true;
	        });
	        const normalizedHasFullOutfit = normalized.items.some(isFullOutfitSelectedItem);
	        const mergedQueue = normalizedHasFullOutfit
	          ? normalized.items
	          : [...normalized.items, ...remainingActive, ...uniqueAlternatives];

        setOutfitMode(mode);
        setSelectedItems(normalized.items);
        setQueueItems(mergedQueue);
        setActiveSlotKey(getOutfitSlots(mode)[0].key);

        const unavailableCount = limitedSeedItems.length - activeResolved.length;
        const truncatedCount = Math.max(0, incomingSeedItems.length - limitedSeedItems.length);
        const queuedButInactiveCount = remainingActive.length + uniqueAlternatives.length;
        setPrefillNotice(
          unavailableCount || queuedButInactiveCount || truncatedCount
            ? `Đã đưa ${normalized.items.length} món vào phối, ${queuedButInactiveCount} món chờ thử. ${queuedButInactiveCount ? `${queuedButInactiveCount} món sẽ thử lần lượt. ` : ''}${unavailableCount ? `${unavailableCount} món không còn đúng màu/size. ` : ''}${truncatedCount ? `${truncatedCount} món vượt giới hạn. ` : ''}`.trim()
            : `Đã điền sẵn ${normalized.items.length} món cùng màu và size đã chọn.`,
        );
      })
      .catch((error: unknown) => {
        if (!isCurrent) return;
        const message = error instanceof Error ? error.message : 'Không thể tải bộ đồ đã chọn.';
        setPrefillNotice(message);
      })
      .finally(() => {
        if (isCurrent) setIsPrefilling(false);
      });

    return () => { isCurrent = false; };
  }, [incomingAlternativeSeedItems, incomingSeedItems, incomingSeedKey]);

  React.useEffect(() => {
    if (!outfitSlots.some((slot) => slot.key === activeSlotKey)) {
      setActiveSlotKey(outfitSlots[0].key);
    }
  }, [activeSlotKey, outfitSlots]);

  React.useEffect(() => {
    setSelectedItems((current) => {
      return normalizeItemsForMode(current, outfitMode);
    });
  }, [outfitMode]);

  const slotProducts = React.useMemo(
    () => products.filter((product) => {
      const isFullOutfit = isFullOutfitProduct(product);
      if (outfitMode === 'full_set' && isFullOutfit) {
        return false;
      }

      return activeSlot.roles.includes(isFullOutfit ? 'dress' : inferRole(product));
    }),
    [activeSlot, outfitMode, products],
  );

  const genderSlotProducts = React.useMemo(
    () => slotProducts.filter((product) =>
      isTryOnGenderMatch(product.category?.gender, productFilters.gender),
    ),
    [productFilters.gender, slotProducts],
  );

  const draftCategoryFilterGroups = React.useMemo(
    () => buildCategoryFilterGroups(draftScopedCategories),
    [draftScopedCategories],
  );

  const productCategorySelectionGroups = React.useMemo(
    () => getCategorySelectionGroups(productFilters.categoryIds, availableFilters.categories),
    [availableFilters.categories, productFilters.categoryIds],
  );
  const productCategoryFilterCount = React.useMemo(() => {
    if (!productFilters.categoryIds.length) {
      return 0;
    }

    return productCategorySelectionGroups.length;
  }, [productCategorySelectionGroups.length, productFilters.categoryIds.length]);

  const brandFilterOptions = React.useMemo(
    () =>
      availableFilters.brands
        .map((brand) => ({ id: brand._id, label: brand.name }))
        .sort((a, b) => a.label.localeCompare(b.label, 'vi-VN')),
    [availableFilters.brands],
  );

  React.useEffect(() => {
    const availableCategoryIds = new Set(availableFilters.categories.map((category) => category._id));
    const availableBrandIds = new Set(brandFilterOptions.map((option) => option.id));
    const pruneFilters = (current: TryOnProductFilters): TryOnProductFilters => {
      const nextCategoryIds = current.categoryIds.filter((id) => availableCategoryIds.has(id));
      const nextBrandIds = current.brandIds.filter((id) => availableBrandIds.has(id));

      if (nextCategoryIds.length === current.categoryIds.length && nextBrandIds.length === current.brandIds.length) {
        return current;
      }

      return {
        ...current,
        categoryIds: nextCategoryIds,
        brandIds: nextBrandIds,
      };
    };

    setProductFilters(pruneFilters);
    setDraftProductFilters(pruneFilters);
  }, [availableFilters.categories, brandFilterOptions]);

  const getScopedCategoryIdsForFilter = React.useCallback((gender: TryOnGenderFilter) => {
    return new Set(
      getTryOnScopedCategories(availableFilters.categories, gender, activeSlot)
        .map((category) => category._id),
    );
  }, [activeSlot, availableFilters.categories]);

  React.useEffect(() => {
    const pruneScopedCategories = (current: TryOnProductFilters): TryOnProductFilters => {
      if (!current.categoryIds.length) return current;

      const scopedCategoryIds = getScopedCategoryIdsForFilter(current.gender);
      const nextCategoryIds = current.categoryIds.filter((categoryId) => scopedCategoryIds.has(categoryId));

      if (nextCategoryIds.length === current.categoryIds.length) return current;

      return {
        ...current,
        categoryIds: nextCategoryIds,
      };
    };

    setProductFilters(pruneScopedCategories);
    setDraftProductFilters(pruneScopedCategories);
  }, [getScopedCategoryIdsForFilter]);

  const getCategoryIdsForGender = React.useCallback((
    categoryIds: string[],
    gender: TryOnGenderFilter,
  ) => {
    const categoryById = new Map(availableFilters.categories.map((category) => [category._id, category]));
    return categoryIds.filter((categoryId) => isTryOnGenderMatch(categoryById.get(categoryId)?.gender, gender));
  }, [availableFilters.categories]);

  const filteredProducts = genderSlotProducts;
  const productTotalCount = productPagination?.totalItems ?? filteredProducts.length;

  React.useEffect(() => {
    if (
      !isProductListVisible ||
      isLoading ||
      isLoadingMoreProducts ||
      filteredProducts.length ||
      !hasNextPage(productPagination)
    ) {
      return;
    }

    void loadMoreProducts();
  }, [
    filteredProducts.length,
    isLoading,
    isLoadingMoreProducts,
    isProductListVisible,
    loadMoreProducts,
    productPagination,
  ]);

  const productFilterCount =
    productCategoryFilterCount +
    productFilters.brandIds.length +
    (productFilters.gender !== defaultTryOnProductFilters.gender ? 1 : 0) +
    (productFilters.minPrice !== undefined || productFilters.maxPrice !== undefined ? 1 : 0) +
    (productFilters.isNew ? 1 : 0) +
    (productFilters.isSale ? 1 : 0) +
    (productFilters.sort !== 'recommended' ? 1 : 0);

  const openProductFilterSheet = () => {
    setDraftProductFilters(productFilters);
    setIsProductFilterVisible(true);
  };

  const applyDraftProductFilters = () => {
    setProductFilters(draftProductFilters);
    setIsProductFilterVisible(false);
  };

  const resetDraftProductFilters = () => {
    setDraftProductFilters(defaultTryOnProductFilters);
  };

  const toggleFilterValues = (
    updateFilters: React.Dispatch<React.SetStateAction<TryOnProductFilters>>,
    key: TryOnProductMultiFilterKey,
    targetValues: string[],
  ) => {
    updateFilters((current) => {
      const selectedValues = current[key];
      const valueSet = new Set(targetValues);
      const shouldRemove = targetValues.every((value) => selectedValues.includes(value));
      const nextValues = shouldRemove
        ? selectedValues.filter((item) => !valueSet.has(item))
        : uniqueStrings([...selectedValues, ...targetValues]);

      return {
        ...current,
        [key]: nextValues,
      };
    });
  };

  const toggleDraftProductFilterValues = (key: TryOnProductMultiFilterKey, values: string[]) => {
    toggleFilterValues(setDraftProductFilters, key, values);
  };

  const upsertQueueItem = (item: TryOnSelectedItem) => {
    const itemKey = getSelectedItemKey(item);

    setQueueItems((current) => {
      if (current.some((entry) => getSelectedItemKey(entry) === itemKey)) {
        return current.map((entry) => (getSelectedItemKey(entry) === itemKey ? item : entry));
      }

      if (current.length >= TRY_ON_QUEUE_LIMIT) return current;

      return [...current, item];
    });
  };

  const addSelectedItem = (item: TryOnSelectedItem) => {
    if (isFullOutfitSelectedItem(item)) {
      const fullOutfitItem = { ...item, role: 'dress' as const, isFullOutfit: true };

      animateSelectionLayout();
      setOutfitMode('single');
      setActiveSlotKey('single');
      setQueueItems([fullOutfitItem]);
      setSelectedItems([fullOutfitItem]);

      if (selectedItems.length > 0 || queueItems.length > 0) {
        Alert.alert('Bộ đồ dùng riêng', 'Bộ/set đã thay các món đang chọn vì đây là một phối hoàn chỉnh.');
      }
      return;
    }

    const roleForSlot = activeSlot.roles.includes(item.role) ? item.role : activeSlot.roles[0];
    const normalizedItem = { ...item, role: roleForSlot };
    if (hasSelectedFullOutfit) {
      animateSelectionLayout();
      setQueueItems([normalizedItem]);
      setSelectedItems([normalizedItem]);
      return;
    }

    const replacedItem = outfitMode === 'single'
      ? selectedItems.find((entry) => entry.productId !== normalizedItem.productId)
      : selectedItems.find((entry) =>
          entry.productId !== normalizedItem.productId &&
          activeSlot.roles.includes(entry.role),
        );

    const itemAlreadyQueued = queueItems.some((entry) => isSameTryOnItem(entry, normalizedItem));
    if (!itemAlreadyQueued && queueItems.length >= TRY_ON_QUEUE_LIMIT) {
      Alert.alert('Danh sách chờ đã đầy', `Đang có tối đa ${TRY_ON_QUEUE_LIMIT} món. Bạn có thể tạo ảnh trước hoặc quay lại giỏ để đổi danh sách chờ.`);
      return;
    } else {
      upsertQueueItem(normalizedItem);
    }

    animateSelectionLayout();
    setSelectedItems((current) => {
      return selectItemForSlot(current, normalizedItem, activeSlot, outfitMode);
    });

    if (replacedItem) {
      Alert.alert(
        `Đã thay ${activeSlot.label.toLowerCase()}`,
        `Mỗi bản phối chỉ dùng 1 ${activeSlot.label.toLowerCase()} ở vị trí này. Muốn thử cả hai thì tạo lần lượt từng bản phối.`,
      );
    }
  };

  const selectProduct = async (product: CatalogProduct) => {
    setSelectingProductId(product._id);
    try {
      const detail = await catalogApi.getProductById(product._id);
      const variant = getInitialVariant(detail);
      const color = variant?.colors[0];

      if (!variant || !color) {
        Alert.alert('Sản phẩm', 'Chưa có màu hoặc size phù hợp.');
        return;
      }

      setConfiguringProduct(detail);
      setSelectedVariantId(variant._id);
      setSelectedColorId(color._id);
      setSelectedSize(getFirstAvailableSize(variant, color._id));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Không tải được chi tiết.';
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
      Alert.alert('Biến thể', 'Màu và size này chưa khả dụng.');
      return;
    }

    addSelectedItem(createSelectedItem(configuringProduct, selectedVariant, selectedColor, selectedSizeOption.size));
    closeVariantSelector();
    setIsProductListVisible(false);
  };

  const removeSelectedItem = (itemKey: string) => {
    animateSelectionLayout();
    setSelectedItems((current) => current.filter((item) => getSelectedItemKey(item) !== itemKey));
  };

  const removeQueueItem = (itemKey: string) => {
    animateSelectionLayout();
    setQueueItems((current) => current.filter((item) => getSelectedItemKey(item) !== itemKey));
    setSelectedItems((current) => current.filter((item) => getSelectedItemKey(item) !== itemKey));
  };

  const chooseQueueItem = (group: SlotAlternativeGroup, item: TryOnSelectedItem) => {
    const nextMode = outfitSlots.some((entry) => entry.roles.includes(item.role)) ? outfitMode : 'full_set';
    const nextSlots = getOutfitSlots(nextMode);
    const slot =
      nextSlots.find((entry) => entry.key === group.slotKey && entry.roles.includes(item.role)) ??
      nextSlots.find((entry) => entry.roles.includes(item.role)) ??
      nextSlots[0];
    if (!slot) return;

    animateSelectionLayout();
    setOutfitMode(nextMode);
    setSelectedItems((current) => {
      const normalizedCurrent = nextMode === outfitMode ? current : normalizeItemsForMode(current, nextMode);
      return selectItemForSlot(normalizedCurrent, item, slot, nextMode);
    });
    setActiveSlotKey(slot.key);
  };

  const getSelectedItemForSlot = (slot: OutfitSlot) =>
    selectedItems.find((item) => slot.roles.includes(item.role));

  const selectedSlotCount = visibleOutfitSlots.filter((slot) => getSelectedItemForSlot(slot)).length;

  const canSubmit =
    selectedItems.length > 0 &&
    (outfitMode !== 'full_set' || selectedItems.length >= 2);
  const imageValidationRoleKey = selectedItems.map((item) => item.role).join(',');
  const imageValidationScanKey = sourceAssetId && canSubmit
    ? `asset:${sourceAssetId}:mode:${outfitMode}:roles:${imageValidationRoleKey}`
    : '';
  const currentSelectionUnsupportedCapability =
    imageValidation.result && imageValidation.key === imageValidationScanKey
      ? getUnsupportedImageValidationCapability(imageValidation.result, outfitMode, selectedItems)
      : null;
  const hasCurrentImageValidationResult = Boolean(imageValidation.result && imageValidation.key === imageValidationScanKey);
  const imageGenerationUnavailable = capabilities?.imageGeneration.available === false;
  const imageValidationWarnsSubmit = Boolean(imageValidationScanKey) && canSubmit && (
    imageValidation.status === 'checking' ||
    (
      hasCurrentImageValidationResult &&
      (imageValidation.result?.allowed !== true || Boolean(currentSelectionUnsupportedCapability))
    ) ||
    (
      (imageValidation.status === 'invalid' || imageValidation.status === 'error') &&
      imageValidation.key === imageValidationScanKey
    )
  );
  const imageValidationIsCheckingSubmit = Boolean(imageValidationScanKey) && canSubmit &&
    imageValidation.status === 'checking' &&
    imageValidation.key === imageValidationScanKey;
  const imageValidationHardBlockReason = (() => {
    if (!imageValidationScanKey || !canSubmit) return null;
    const currentReasonCode =
      currentSelectionUnsupportedCapability?.reasonCode ??
      imageValidation.result?.reasonCode;
    if (
      hasCurrentImageValidationResult &&
      currentReasonCode &&
      isImageValidationHardBlockReason(currentReasonCode)
    ) {
      return currentReasonCode;
    }
    if (
      (imageValidation.status === 'invalid' || imageValidation.status === 'error') &&
      imageValidation.key === imageValidationScanKey
    ) {
      if (!imageValidation.errorCode || isImageValidationHardBlockReason(imageValidation.errorCode)) {
        return imageValidation.errorCode ?? 'VALIDATION_PROVIDER_FAILED';
      }
    }
    return null;
  })();
  const imageValidationBlocksSubmit = Boolean(imageValidationHardBlockReason) || imageGenerationUnavailable;
  const imageValidationSoftWarnsSubmit =
    imageValidationWarnsSubmit &&
    !imageValidationIsCheckingSubmit &&
    !imageValidationBlocksSubmit;
  const submitDisabled = !canSubmit || isPrefilling || isSubmitting || imageValidationBlocksSubmit || imageValidationIsCheckingSubmit;

  React.useEffect(() => {
    if (!imageValidationScanKey || !sourceAssetId) {
      setImageValidation((current) =>
        current.status === 'idle' && current.key === '' ? current : { status: 'idle', key: '' },
      );
      return undefined;
    }

    let isCurrent = true;
    const timer = setTimeout(() => {
      setImageValidation({ status: 'checking', key: imageValidationScanKey });
      runWithAuth((token) =>
        virtualTryOnApi.validateAsset(token, sourceAssetId, {
          outfitMode,
          selectedItems: selectedItems.map((item) => ({ role: item.role })),
        }),
      )
        .then((result) => {
          if (!isCurrent) return;
          setImageValidation({
            status: result.allowed ? 'valid' : 'invalid',
            key: imageValidationScanKey,
            result,
            errorCode: result.reasonCode,
            message: getImageValidationMessage(result, undefined, outfitMode, selectedItems),
          });
        })
        .catch((error) => {
          if (!isCurrent) return;
          const alert = getCreateJobErrorAlert(error);
          setImageValidation({
            status: 'error',
            key: imageValidationScanKey,
            errorCode: error instanceof VirtualTryOnApiError ? error.errorCode : null,
            message: alert.message,
          });
        });
    }, 450);

    return () => {
      isCurrent = false;
      clearTimeout(timer);
    };
  }, [imageValidationRetryNonce, imageValidationScanKey, outfitMode, runWithAuth, selectedItems, sourceAssetId]);

  const retryImageValidation = React.useCallback(() => {
    if (!imageValidationScanKey || imageValidation.status === 'checking') return;
    setImageValidationRetryNonce((value) => value + 1);
  }, [imageValidation.status, imageValidationScanKey]);

  const imageValidationDisplay = (() => {
    if (!sourceAssetId) {
      return {
        icon: 'image-outline' as FashionIconName,
        tone: 'idle' as const,
        title: 'Chưa có ảnh người mặc',
        message: 'Tải ảnh hoặc chụp ảnh trước.',
      };
    }

    if (!canSubmit) {
      return {
        icon: 'image-search-outline' as FashionIconName,
        tone: 'idle' as const,
        title: 'Chờ chọn đồ',
        message: 'Chọn sản phẩm để kiểm tra ảnh.',
      };
    }

    if (imageGenerationUnavailable) {
      const validationUnavailable =
        capabilities?.imageGeneration.reasonCode === 'IMAGE_VALIDATION_UNAVAILABLE';
      return {
        icon: 'alert-outline' as FashionIconName,
        tone: 'warning' as const,
        title: validationUnavailable ? 'Kiểm tra ảnh đang gián đoạn' : 'Tính năng đang tạm dừng',
        message: validationUnavailable
          ? 'Chưa kiểm tra được ảnh. Bạn thử lại sau nhé.'
          : 'Bạn thử lại sau nhé.',
      };
    }

    if (imageValidation.status === 'checking' && imageValidation.key === imageValidationScanKey) {
      return {
        icon: 'loading' as FashionIconName,
        tone: 'checking' as const,
        title: 'Đang kiểm tra ảnh',
        message: 'Đang kiểm tra người và vùng cơ thể.',
      };
    }

    if (hasCurrentImageValidationResult) {
      if (!imageValidation.result?.allowed) {
        const reasonCode = imageValidation.result?.reasonCode;
        return {
          icon: reasonCode === 'VALIDATION_PROVIDER_FAILED'
            ? 'alert-outline' as FashionIconName
            : 'alert-circle-outline' as FashionIconName,
          tone: getImageValidationReasonTone(reasonCode),
          title: getImageValidationReasonTitle(reasonCode),
          message: getImageValidationMessage(imageValidation.result, undefined, outfitMode, selectedItems),
        };
      }

      if (currentSelectionUnsupportedCapability) {
        const reasonCode = currentSelectionUnsupportedCapability.reasonCode;
        return {
          icon: 'alert-circle-outline' as FashionIconName,
          tone: getImageValidationReasonTone(reasonCode),
          title: getImageValidationReasonTitle(reasonCode),
          message: getImageValidationMessage(imageValidation.result, undefined, outfitMode, selectedItems),
        };
      }

      return {
        icon: 'check-circle-outline' as FashionIconName,
        tone: 'valid' as const,
        title: 'Ảnh phù hợp',
        message: 'Có thể tạo ảnh.',
      };
    }

    if (
      (imageValidation.status === 'invalid' || imageValidation.status === 'error') &&
      imageValidation.key === imageValidationScanKey
    ) {
      const reasonCode = imageValidation.errorCode;
      return {
        icon: reasonCode === 'VALIDATION_PROVIDER_FAILED'
          ? 'alert-outline' as FashionIconName
          : 'alert-circle-outline' as FashionIconName,
        tone: getImageValidationReasonTone(reasonCode),
        title: getImageValidationReasonTitle(reasonCode),
        message: imageValidation.message || 'Chọn ảnh rõ hơn.',
      };
    }

    return {
      icon: 'image-search-outline' as FashionIconName,
      tone: 'checking' as const,
      title: 'Chờ kiểm tra',
      message: 'Ảnh sẽ được kiểm tra trước khi tạo.',
    };
  })();

  const submitWarningActive = imageValidationSoftWarnsSubmit && (
    imageValidationDisplay.tone === 'warning' || imageValidationDisplay.tone === 'guidance'
  );
  const submitButtonLabel = sourceAssetId
    ? imageValidationBlocksSubmit
      ? 'Cần đổi ảnh'
      : includeVideo ? 'Tạo ảnh + video' : 'Tạo ảnh'
    : 'Chọn ảnh';
  const submitButtonIcon = sourceAssetId
    ? imageValidationBlocksSubmit
      ? 'alert-circle-outline'
      : 'auto-fix'
    : 'image-plus';
  const createConfirmTitle = submitWarningActive
    ? imageValidationDisplay.title
    : includeVideo ? 'Tạo ảnh và video phối đồ?' : 'Tạo ảnh phối đồ?';
  const createConfirmText = submitWarningActive
    ? imageValidationDisplay.message
    : includeVideo
      ? `Tạo 4 ảnh và video ${videoDurationSeconds} giây.`
      : 'Tạo 4 ảnh với bộ đồ đã chọn.';

  const footerLabel = (() => {
    if (imageValidationBlocksSubmit) {
      if (imageGenerationUnavailable) return 'Tạm gián đoạn';
      return imageValidationHardBlockReason === 'NO_PERSON_DETECTED'
        ? 'Cần ảnh người'
        : 'Cần đổi ảnh';
    }

    if (submitWarningActive) {
      return 'Có thể tạo ảnh';
    }

    if (outfitMode === 'full_set' && selectedItems.length < 2) {
      return 'Cần 2 món';
    }

    if (outfitMode === 'full_set') {
      return `${selectedItems.length}/${TRY_ON_ACTIVE_ITEM_LIMIT} món`;
    }

    return `${selectedSlotCount}/${outfitSlots.length} món`;
  })();

  const submitCreateJob = async (confirmedSourceAssetId: string) => {
    setIsCreateConfirmVisible(false);
    setIsSubmitting(true);
    const retainedSeedItems = (queueItems.length ? queueItems : selectedItems).map(selectedItemToSeed);
    try {
      const job = await runWithAuth((token) =>
        virtualTryOnApi.createJob(token, {
          sourceAssetId: confirmedSourceAssetId,
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
          videoDurationSeconds: includeVideo ? videoDurationSeconds : undefined,
        }, `try-on-${Date.now()}-${Math.random().toString(16).slice(2)}`),
      );
      navigation.replace('VirtualTryOnProcessing', {
        jobId: job._id,
        seedItems: retainedSeedItems.length ? retainedSeedItems : undefined,
      });
    } catch (error) {
      const alert = getCreateJobErrorAlert(error);
      Alert.alert(alert.title, alert.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const openPhotoStep = () => {
    const seedSourceItems = queueItems.length ? queueItems : selectedItems;

    navigation.navigate('VirtualTryOnHome', {
      entryPoint: 'builder',
      seedItems: seedSourceItems.map(selectedItemToSeed),
    });
  };

  const createJob = () => {
    if (!sourceAssetId) {
      Alert.alert('Ảnh của bạn', 'Tải ảnh hoặc chụp ảnh trước.');
      openPhotoStep();
      return;
    }

    if (!selectedItems.length) {
      Alert.alert('Chọn sản phẩm', 'Chọn ít nhất một sản phẩm.');
      return;
    }

    if (outfitMode === 'full_set' && selectedItems.length < 2) {
      Alert.alert('Chọn thêm sản phẩm', 'Cần ít nhất 2 món.');
      return;
    }

    if (imageValidationBlocksSubmit) {
      Alert.alert(imageValidationDisplay.title, imageValidationDisplay.message);
      return;
    }

    if (imageValidationIsCheckingSubmit) {
      Alert.alert('Đang kiểm tra ảnh', 'Đợi vài giây để hệ thống kiểm tra ảnh trước khi tạo.');
      return;
    }

    setIsCreateConfirmVisible(true);
  };

  const confirmCreateJob = () => {
    if (!sourceAssetId) {
      setIsCreateConfirmVisible(false);
      return;
    }

    void submitCreateJob(sourceAssetId);
  };

  const outfitTotal = selectedItems.reduce((sum, item) => sum + item.finalPriceSnapshot, 0);
  const openPreviewImage = (image: BuilderPreviewImage) => {
    if (!image.uri) return;
    setPreviewImage(image);
  };
  const handleProductListScroll = React.useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    const distanceFromBottom = contentSize.height - (contentOffset.y + layoutMeasurement.height);

    if (distanceFromBottom <= 220 && hasNextPage(productPagination)) {
      void loadMoreProducts();
    }
  }, [loadMoreProducts, productPagination]);

  const renderFilterChoice = (
    label: string,
    isActive: boolean,
    onPress: () => void,
    choiceKey = label,
  ) => (
    <TouchableOpacity
      key={choiceKey}
      style={[styles.filterChoice, isActive && styles.filterChoiceActive]}
      onPress={onPress}
      activeOpacity={0.82}
    >
      <Text style={[styles.filterChoiceText, isActive && styles.filterChoiceTextActive]} numberOfLines={1}>
        {label}
      </Text>
    </TouchableOpacity>
  );

  const renderFilterGroup = (title: string, children: React.ReactNode | null) => {
    if (!children) return null;

    return (
      <View style={styles.filterGroup}>
        <Text style={styles.filterGroupTitle}>{title}</Text>
        {children}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerButton} onPress={() => navigation.goBack()} activeOpacity={0.8}>
          <MaterialCommunityIcons name="arrow-left" size={25} color={colors.white} />
        </TouchableOpacity>
        <View style={styles.headerCopy}>
          <Text style={styles.headerTitle}>Tạo phối đồ</Text>
        </View>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.studioHero}>
          {sourceImageUrl ? (
            <TouchableOpacity
              style={styles.sourceImageWrap}
              onPress={() => openPreviewImage({
                uri: sourceImageUrl,
                label: 'Ảnh người mặc',
                recyclingKey: `source-preview-${sourceAssetId}`,
                resizeMode: 'contain',
              })}
              activeOpacity={0.9}
            >
              <RemoteImage uri={sourceImageUrl} style={styles.sourceImage} recyclingKey={sourceAssetId} />
              <View style={styles.imageExpandBadge}>
                <MaterialCommunityIcons name="fullscreen" size={15} color={colors.white} />
              </View>
            </TouchableOpacity>
          ) : (
            <View style={styles.sourceImageWrap}>
              <MaterialCommunityIcons name="image-outline" size={44} color={tryOnPalette.ink} />
            </View>
          )}
          <View style={styles.studioCopy}>
            <Text style={styles.studioTitle}>Ảnh của bạn</Text>
            <Pressable
              accessibilityRole="button"
              disabled={!imageValidationScanKey || imageValidationDisplay.tone === 'checking'}
              onPress={retryImageValidation}
              style={({ pressed }) => [
                styles.imageValidationPill,
                imageValidationDisplay.tone === 'valid' && styles.imageValidationPillValid,
                imageValidationDisplay.tone === 'guidance' && styles.imageValidationPillGuidance,
                imageValidationDisplay.tone === 'warning' && styles.imageValidationPillWarning,
                imageValidationDisplay.tone === 'checking' && styles.imageValidationPillChecking,
                pressed && styles.imageValidationPillPressed,
              ]}
            >
              {imageValidationDisplay.tone === 'checking' ? (
                <ActivityIndicator size="small" color={tryOnPalette.primary} />
              ) : (
                <MaterialCommunityIcons
                  name={imageValidationDisplay.icon}
                  size={19}
                  color={
                    imageValidationDisplay.tone === 'valid' || imageValidationDisplay.tone === 'guidance'
                      ? tryOnPalette.success
                      : imageValidationDisplay.tone === 'warning'
                        ? colors.goldDark
                        : tryOnPalette.primary
                  }
                />
              )}
              <View style={styles.imageValidationCopy}>
                <Text style={styles.imageValidationTitle}>{imageValidationDisplay.title}</Text>
                <Text style={styles.imageValidationText}>{imageValidationDisplay.message}</Text>
              </View>
            </Pressable>
            <TouchableOpacity style={styles.changePhotoButton} onPress={openPhotoStep} activeOpacity={0.82}>
              <MaterialCommunityIcons name="image-edit-outline" size={17} color={tryOnPalette.primary} />
              <Text style={styles.changePhotoText}>{sourceImageUrl ? 'Đổi ảnh, giữ nguyên bộ đồ' : 'Chọn ảnh người mặc'}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {prefillNotice ? (
          <View style={styles.prefillBanner}>
            {isPrefilling ? (
              <ActivityIndicator size="small" color={tryOnPalette.primary} />
            ) : (
              <MaterialCommunityIcons name="cart-check" size={20} color={tryOnPalette.success} />
            )}
            <Text style={styles.prefillBannerText}>{prefillNotice}</Text>
          </View>
        ) : null}

        <View style={styles.sectionHeaderBlock}>
          <Text style={styles.sectionTitle}>Chế độ phối</Text>
        </View>
        <View style={styles.modeSegment}>
          {outfitModes.map((mode) => {
            const active = outfitMode === mode.key;
            return (
              <TouchableOpacity
                key={mode.key}
                style={[styles.modeSegmentButton, active && styles.modeSegmentButtonActive]}
	                onPress={() => {
	                  if (mode.key === 'full_set' && hasSelectedFullOutfit) {
	                    Alert.alert('Bộ đồ dùng riêng', 'Bộ/set đã là một phối hoàn chỉnh nên không chọn thêm món khác trong cùng lượt.');
	                    return;
	                  }

	                  setOutfitMode(mode.key);
	                }}
                activeOpacity={0.84}
              >
                <MaterialCommunityIcons
                  name={mode.icon}
                  size={20}
                  color={active ? tryOnPalette.ink : tryOnPalette.primary}
                />
                <Text style={[styles.modeSegmentText, active && styles.modeSegmentTextActive]} numberOfLines={1}>
                  {mode.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={styles.outfitHeaderRow}>
          <View>
            <Text style={styles.sectionTitle}>Bộ đồ đang phối</Text>
          </View>
          <View style={styles.outfitProgressPill}>
            <Text style={styles.outfitProgress}>{footerLabel}</Text>
          </View>
        </View>
        <View style={styles.slotGrid}>
          {visibleOutfitSlots.map((slot) => {
            const active = activeSlot.key === slot.key;
            const selectedItem = getSelectedItemForSlot(slot);

            return (
              <TouchableOpacity
                key={slot.key}
                style={[
                  styles.slotCard,
                  active && styles.slotCardActive,
                  selectedItem && styles.slotCardFilled,
                ]}
                onPress={() => {
                  setActiveSlotKey(slot.key);
                  setIsProductListVisible(true);
                }}
                activeOpacity={0.86}
              >
                <Animated.View style={[
                  styles.slotIconWrap,
                  active && !selectedItem && styles.slotIconWrapActive,
                  active && !selectedItem && activeIconAnimatedStyle,
                ]}>
                  {selectedItem ? (
                    <RemoteImage
                      uri={selectedItem.imageSnapshot}
                      style={styles.slotImage}
                      recyclingKey={`${slot.key}:${selectedItem.colorVariantId}`}
                    />
                  ) : (
                    <MaterialCommunityIcons
                      name={slot.icon}
                      size={38}
                      color={tryOnPalette.primary}
                    />
                  )}
                </Animated.View>
                <View style={styles.slotCopy}>
                  <Text style={[styles.slotLabel, active && !selectedItem && styles.slotTextActive]}>
                    {slot.label}
                  </Text>
                  <Text
                    style={[styles.slotHelper, active && !selectedItem && styles.slotTextActive]}
                    numberOfLines={selectedItem ? 2 : 1}
                  >
                    {selectedItem ? selectedItem.nameSnapshot : slot.helper}
                  </Text>
                  <Text
                    style={[styles.slotMeta, selectedItem ? styles.slotMetaSelected : styles.slotMetaEmpty]}
                    numberOfLines={1}
                  >
                    {selectedItem
                      ? ([selectedItem.colorSnapshot, selectedItem.size].filter(Boolean).join(' / ') || roleLabel[selectedItem.role])
                      : `Chạm để chọn ${slot.label.toLowerCase()}`}
                  </Text>
                </View>
                {selectedItem ? (
                  <TouchableOpacity
                    style={styles.slotRemoveButton}
                    onPress={(event) => {
                      event.stopPropagation();
                      removeSelectedItem(getSelectedItemKey(selectedItem));
                    }}
                    activeOpacity={0.75}
                  >
                    <MaterialCommunityIcons name="close" size={18} color={colors.white} />
                  </TouchableOpacity>
                ) : (
                  <MaterialCommunityIcons name="chevron-right" size={28} color={colors.textMuted} />
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        {queueGroups.length ? (
          <View style={styles.alternativePanel}>
            <View style={styles.alternativeHeader}>
              <View style={styles.alternativeHeaderIcon}>
                <MaterialCommunityIcons name="playlist-check" size={20} color={tryOnPalette.primary} />
              </View>
              <View style={styles.alternativeHeaderCopy}>
                <Text style={styles.alternativeTitle}>Món chờ thử</Text>
              </View>
              <View style={styles.alternativeHeaderBadge}>
                <Text style={styles.alternativeHeaderBadgeText}>{queueActiveCount}/{queueItems.length} đang thử</Text>
              </View>
            </View>
            {queueGroups.map((group) => (
              <View key={group.slotKey} style={styles.alternativeGroup}>
                <Text style={styles.alternativeGroupTitle}>{group.slotLabel}</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.alternativeList}
                >
                  {group.items.map((item) => {
                    const active = selectedItems.some((selected) => isSameTryOnItem(selected, item));
                    const itemKey = getSelectedItemKey(item);

                    return (
                      <TouchableOpacity
                        key={`${group.slotKey}-${itemKey}`}
                        style={[styles.alternativeItem, active && styles.alternativeItemActive]}
                        onPress={() => chooseQueueItem(group, item)}
                        activeOpacity={0.86}
                      >
                        <RemoteImage
                          uri={item.imageSnapshot}
                          style={styles.alternativeImage}
                          recyclingKey={`alternative-${itemKey}`}
                        />
                        <View style={styles.alternativeItemCopy}>
                          <Text style={styles.alternativeItemName} numberOfLines={2}>{item.nameSnapshot}</Text>
                          <Text style={styles.alternativeItemMeta} numberOfLines={1}>
                            {[item.colorSnapshot, item.size].filter(Boolean).join(' / ') || roleLabel[item.role]}
                          </Text>
                          <View style={[styles.alternativeStatusPill, active ? styles.alternativeStatusPillActive : styles.alternativeStatusPillIdle]}>
                            <Text style={[styles.alternativeStatusText, active ? styles.alternativeStatusTextActive : styles.alternativeStatusTextIdle]}>
                              {active ? 'Đang thử' : 'Chờ thử'}
                            </Text>
                          </View>
                        </View>
                        {active ? (
                          <View style={styles.alternativeActiveMark}>
                            <MaterialCommunityIcons name="check" size={14} color={colors.white} />
                          </View>
                        ) : (
                          <TouchableOpacity
                            style={styles.alternativeRemoveMark}
                            onPress={(event) => {
                              event.stopPropagation();
                              removeQueueItem(itemKey);
                            }}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                            activeOpacity={0.82}
                            accessibilityRole="button"
                            accessibilityLabel="Bỏ món khỏi danh sách chờ"
                          >
                            <MaterialCommunityIcons name="close" size={14} color={colors.white} />
                          </TouchableOpacity>
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>
            ))}
          </View>
        ) : null}

        <TouchableOpacity
          style={styles.openProductListButton}
          onPress={() => setIsProductListVisible(true)}
          activeOpacity={0.86}
        >
          <View style={styles.openProductListIcon}>
            <MaterialCommunityIcons name="plus" size={30} color={tryOnPalette.primary} />
          </View>
          <View style={styles.openProductListCopy}>
            <Text style={styles.openProductListText}>Chọn {activeSlot.label.toLowerCase()}</Text>
            <Text style={styles.openProductListMeta}>{filteredProducts.length} sản phẩm phù hợp</Text>
          </View>
          <View style={styles.openProductListArrow}>
            <MaterialCommunityIcons name="arrow-right" size={20} color={colors.white} />
          </View>
        </TouchableOpacity>

        <View style={styles.sectionHeaderBlock}>
          <Text style={styles.sectionTitle}>Bối cảnh</Text>
        </View>
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
                <MaterialCommunityIcons name={option.icon} size={20} color={tryOnPalette.ink} />
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
            placeholder="Ví dụ: quán cà phê sáng, phong cách thanh lịch"
            placeholderTextColor={colors.textMuted}
            maxLength={200}
            multiline
          />
        ) : null}

        <View style={styles.outputOptionCard}>
          <View style={styles.outputOptionIcon}>
            <MaterialCommunityIcons name="view-grid-outline" size={26} color={tryOnPalette.primary} />
          </View>
          <View style={styles.outputOptionCopy}>
            <Text style={styles.outputOptionTitle}>Kết quả: 4 ảnh</Text>
          </View>
        </View>
        {capabilities?.videoGeneration.available ? (
          <View style={[styles.outputOptionCard, styles.videoOutputOptionCard]}>
            <View style={styles.videoOutputOptionHeader}>
              <View style={styles.outputOptionIcon}>
                <MaterialCommunityIcons name="movie-open-play-outline" size={26} color={tryOnPalette.primary} />
              </View>
              <View style={styles.outputOptionCopy}>
                <Text style={styles.outputOptionTitle}>Thêm video</Text>
              </View>
              <Switch
                value={includeVideo}
                onValueChange={setIncludeVideo}
                trackColor={{ false: tryOnPalette.line, true: tryOnPalette.primaryPale }}
                thumbColor={includeVideo ? tryOnPalette.primary : colors.textMuted}
                accessibilityLabel="Tạo thêm video phối đồ"
              />
            </View>
            {includeVideo ? (
              <VideoDurationSlider
                value={videoDurationSeconds}
                min={capabilities.videoGeneration.minDurationSeconds ?? VIDEO_DURATION_MIN_SECONDS}
                max={capabilities.videoGeneration.maxDurationSeconds ?? VIDEO_DURATION_MAX_SECONDS}
                onChange={setVideoDurationSeconds}
              />
            ) : null}
          </View>
        ) : null}
      </ScrollView>

      <View style={styles.footer}>
        <View style={styles.footerActions}>
          <View style={styles.footerSummary}>
            <Text style={styles.footerLabel}>{footerLabel}</Text>
            <Text style={styles.footerTotal}>
              {formatPrice(outfitTotal)}
            </Text>
          </View>
          <TouchableOpacity
            style={[
              styles.submitButton,
              submitDisabled && styles.submitButtonDisabled,
            ]}
            onPress={createJob}
            disabled={submitDisabled}
            activeOpacity={0.86}
          >
            {isSubmitting ? (
              <ActivityIndicator color={colors.textMuted} />
            ) : (
              <>
                <MaterialCommunityIcons
                  name={submitButtonIcon}
                  size={22}
                  color={submitDisabled ? colors.textMuted : colors.white}
                />
                <Text style={[styles.submitText, submitDisabled && styles.submitTextDisabled]}>
                  {submitButtonLabel}
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>

      <Modal
        visible={Boolean(previewImage)}
        transparent
        animationType="fade"
        onRequestClose={() => setPreviewImage(null)}
      >
        <SafeAreaView style={styles.previewModal} edges={['top', 'bottom']}>
          <View style={styles.previewHeader}>
            <View style={styles.previewCounter}>
              <Text style={styles.previewCounterLabel} numberOfLines={1}>
                {previewImage?.label ?? 'Ảnh'}
              </Text>
            </View>
            <TouchableOpacity
              style={styles.previewCloseButton}
              onPress={() => setPreviewImage(null)}
              activeOpacity={0.82}
            >
              <MaterialCommunityIcons name="close" size={24} color={colors.white} />
            </TouchableOpacity>
          </View>
          <View style={[styles.previewSlide, { width: windowWidth, height: windowHeight }]}>
            {previewImage ? (
              <RemoteImage
                uri={previewImage.uri}
                style={styles.previewImage}
                recyclingKey={previewImage.recyclingKey}
                resizeMode={previewImage.resizeMode ?? 'contain'}
              />
            ) : null}
          </View>
        </SafeAreaView>
      </Modal>

      <Modal
        visible={isCreateConfirmVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setIsCreateConfirmVisible(false)}
      >
        <View style={styles.confirmModalRoot}>
          <Pressable style={styles.confirmBackdrop} onPress={() => setIsCreateConfirmVisible(false)} />
          <View style={styles.confirmCard}>
            <View style={[styles.confirmIconWrap, submitWarningActive && styles.confirmIconWrapWarning]}>
              <MaterialCommunityIcons
                name={submitWarningActive ? 'alert-circle-outline' : 'auto-fix'}
                size={26}
                color={submitWarningActive ? colors.goldDark : tryOnPalette.ink}
              />
            </View>
            <Text style={styles.confirmTitle}>{createConfirmTitle}</Text>
            <Text style={styles.confirmText}>
              {createConfirmText}
            </Text>
            <View style={styles.confirmActions}>
              <TouchableOpacity
                style={styles.confirmCancelButton}
                onPress={() => setIsCreateConfirmVisible(false)}
                activeOpacity={0.82}
              >
                <Text style={styles.confirmCancelText}>Hủy</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.confirmPrimaryButton}
                onPress={confirmCreateJob}
                activeOpacity={0.86}
              >
                <Text style={styles.confirmPrimaryText}>
                  {includeVideo ? 'Tạo ảnh + video' : 'Tạo ảnh'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={isProductListVisible}
        animationType="slide"
        onRequestClose={() => setIsProductListVisible(false)}
      >
        <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
          <View style={styles.header}>
            <TouchableOpacity
              style={styles.headerButton}
              onPress={() => setIsProductListVisible(false)}
              activeOpacity={0.8}
            >
              <MaterialCommunityIcons name="arrow-left" size={25} color={colors.white} />
            </TouchableOpacity>
            <Text style={styles.productHeaderTitle}>Chọn {activeSlot.label.toLowerCase()}</Text>
            <TouchableOpacity
              style={styles.headerButton}
              onPress={() => setIsProductListVisible(false)}
              activeOpacity={0.8}
            >
              <MaterialCommunityIcons name="close" size={23} color={colors.white} />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.content}
            contentContainerStyle={styles.productListContent}
            showsVerticalScrollIndicator={false}
            onScroll={handleProductListScroll}
            scrollEventThrottle={16}
          >
            <View style={styles.searchRow}>
              <MaterialCommunityIcons name="magnify" size={22} color={colors.textMuted} />
              <TextInput
                style={styles.searchInput}
                value={searchTerm}
                onChangeText={setSearchTerm}
                placeholder="Tìm áo, quần, giày/dép..."
                placeholderTextColor={colors.textMuted}
              />
            </View>

            <View style={styles.genderSegment}>
              {genderFilterOptions.map((option) => {
                const active = productFilters.gender === option.key;

                return (
                  <TouchableOpacity
                    key={option.key}
                    style={[styles.genderChip, active && styles.genderChipActive]}
                    onPress={() => setProductFilters((current) => {
                      return {
                        ...current,
                        gender: option.key,
                        categoryIds: getCategoryIdsForGender(current.categoryIds, option.key),
                      };
                    })}
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

            {outfitMode === 'single' ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.productCategoryScroller}
                contentContainerStyle={[
                  styles.productCategoryRail,
                  shouldBalanceSingleItemCategoryRail && styles.productCategoryRailBalanced,
                ]}
              >
                {singleItemCategoryRailGroups.map((group) => {
                  const active = activeSingleItemCategoryRailGroupKey === group.key;
                  const categoryVisual = getCategoryRailVisual(group.label);
                  const categoryIds = getCategoryGroupSelectionIds(group);

                  return (
                    <TouchableOpacity
                      key={group.key}
                      style={[
                        styles.productCategoryTab,
                        shouldBalanceSingleItemCategoryRail && styles.productCategoryTabBalanced,
                      ]}
                      onPress={() => setProductFilters((current) => ({
                        ...current,
                        categoryIds: active ? [] : categoryIds,
                      }))}
                      activeOpacity={0.82}
                      accessibilityRole="tab"
                      accessibilityState={{ selected: active }}
                      accessibilityLabel={`Danh mục: ${group.label}`}
                    >
                      <View style={[
                        styles.productCategoryTabIcon,
                        active && styles.productCategoryTabIconActive,
                      ]}>
                        <CategoryRailIcon
                          visual={categoryVisual}
                          color={active ? colors.brandDark : colors.textMuted}
                        />
                      </View>
                      <Text
                        style={[
                          styles.productCategoryTabLabel,
                          active && styles.productCategoryTabLabelActive,
                        ]}
                        numberOfLines={2}
                      >
                        {group.label}
                      </Text>
                      {active ? <View style={styles.productCategoryTabIndicator} /> : null}
                    </TouchableOpacity>
                  );
                })}

                {isLoading && !singleItemCategoryRailGroups.length ? (
                  <View style={styles.productCategoryLoadingTab}>
                    <ActivityIndicator size="small" color={colors.brand} />
                    <Text style={styles.productCategoryTabLabel}>Đang tải</Text>
                  </View>
                ) : null}
              </ScrollView>
            ) : null}

            <View style={styles.productHeaderRow}>
              <View style={styles.productHeaderCopy}>
                <Text style={styles.sectionTitle}>Chọn {activeSlot.label.toLowerCase()}</Text>
                <Text style={styles.productCount}>{productTotalCount} món phù hợp</Text>
              </View>
              <TouchableOpacity
                style={styles.catalogFilterButton}
                onPress={openProductFilterSheet}
                activeOpacity={0.82}
                accessibilityRole="button"
                accessibilityLabel="Lọc sản phẩm"
              >
                <MaterialCommunityIcons name="tune-variant" size={18} color={colors.brandDark} />
                <Text style={styles.catalogFilterButtonText}>Lọc</Text>
                {productFilterCount ? (
                  <View style={styles.catalogFilterBadge}>
                    <Text style={styles.catalogFilterBadgeText}>{productFilterCount}</Text>
                  </View>
                ) : null}
              </TouchableOpacity>
            </View>

            {isLoading ? (
              <ActivityIndicator color={colors.brand} style={styles.loading} />
            ) : filteredProducts.length ? (
              <View style={styles.productGrid}>
	                {filteredProducts.map((product) => {
	                  const selected = selectedItems.some((item) => item.productId === product._id);
	                  const isSelecting = selectingProductId === product._id;
	                  const productIsFullOutfit = isFullOutfitProduct(product);
	                  const productRole = productIsFullOutfit ? 'dress' : inferRole(product);

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
	                          <Text style={styles.roleBadgeText}>{productIsFullOutfit ? 'Bộ đồ' : roleLabel[productRole]}</Text>
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
                <Text style={styles.emptySelectionText}>Chưa có sản phẩm phù hợp với phần này.</Text>
              </View>
            )}
            {!isLoading && (filteredProducts.length || isLoadingMoreProducts || hasNextPage(productPagination)) ? (
              <View style={styles.productLoadMoreArea}>
                {isLoadingMoreProducts ? (
                  <>
                    <ActivityIndicator color={colors.brand} />
                    <Text style={styles.productLoadMoreText}>Đang tải thêm sản phẩm...</Text>
                  </>
                ) : hasNextPage(productPagination) ? (
                  <Text style={styles.productLoadMoreText}>Kéo xuống để xem thêm</Text>
                ) : (
                  <Text style={styles.productEndOfListText}>Bạn đã xem hết sản phẩm phù hợp</Text>
                )}
              </View>
            ) : null}
          </ScrollView>
        </SafeAreaView>
      </Modal>

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
                      {[selectedVariant?.fitType?.label, selectedColor?.color, selectedSize].filter(Boolean).join(' / ') || 'Chọn màu và kích cỡ'}
                    </Text>
                  </View>
                </View>

                {configuringProduct.variants.length > 1 ? (
                  <View style={styles.variantSection}>
                    <Text style={styles.variantSectionTitle}>Dáng mặc</Text>
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
                          <ColorSwatch
                            label={color.color}
                            colorCode={color.colorCode}
                            imageUri={color.image}
                            selected={active}
                            selectedTint={tryOnPalette.success}
                            size="sm"
                          />
                          <Text style={[styles.colorChoiceText, active && styles.colorChoiceTextActive]} numberOfLines={1}>
                            {color.color}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>

                <View style={styles.variantSection}>
                  <Text style={styles.variantSectionTitle}>Kích cỡ</Text>
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
              <Text style={styles.variantConfirmText}>Dùng lựa chọn này</Text>
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
                <Text style={styles.filterSheetCancel}>Hủy</Text>
              </TouchableOpacity>
              <Text style={styles.filterSheetTitle}>Bộ lọc</Text>
              <TouchableOpacity onPress={applyDraftProductFilters} activeOpacity={0.82}>
                <Text style={styles.filterSheetApply}>Áp dụng</Text>
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.filterSheetContent}>
              {renderFilterGroup(
                'Sắp xếp',
                <View style={styles.filterChoiceWrap}>
                  {tryOnSortOptions.map((option) =>
                    renderFilterChoice(
                      option.label,
                      draftProductFilters.sort === option.key,
                      () => setDraftProductFilters((current) => ({ ...current, sort: option.key })),
                      option.key,
                    ),
                  )}
                </View>,
              )}

              {renderFilterGroup(
                'Đối tượng',
                <View style={styles.filterChoiceWrap}>
                  {genderFilterOptions.map((option) =>
                    renderFilterChoice(
                      option.label,
                      draftProductFilters.gender === option.key,
                      () => setDraftProductFilters((current) => {
                        return {
                          ...current,
                          gender: option.key,
                          categoryIds: getCategoryIdsForGender(current.categoryIds, option.key),
                        };
                      }),
                      option.key,
                    ),
                  )}
                </View>,
              )}

              {renderFilterGroup(
                'Tình trạng',
                <View style={styles.filterChoiceWrap}>
                  {renderFilterChoice('Hàng mới', Boolean(draftProductFilters.isNew), () =>
                    setDraftProductFilters((current) => ({ ...current, isNew: current.isNew ? undefined : true })),
                  )}
                  {renderFilterChoice('Đang sale', Boolean(draftProductFilters.isSale), () =>
                    setDraftProductFilters((current) => ({ ...current, isSale: current.isSale ? undefined : true })),
                  )}
                </View>,
              )}

              {renderFilterGroup(
                'Danh mục',
                draftCategoryFilterGroups.length ? (
                  <View style={styles.categoryGroups}>
                    {draftCategoryFilterGroups.map((group) => {
                      const groupSelectionIds = getCategoryGroupSelectionIds(group);
                      const categoryChoices = group.options.length
                        ? group.options
                        : [{
                          key: group.key,
                          label: group.label,
                          categoryIds: groupSelectionIds,
                        }];

                      return (
                        <View key={group.key} style={styles.categoryGroup}>
                          <Text style={styles.categoryGroupTitle}>{group.label}</Text>
                          <View style={styles.filterChoiceWrap}>
                            {categoryChoices.map((categoryOption) =>
                              renderFilterChoice(
                                categoryOption.label,
                                categoryOption.categoryIds.every((categoryId) =>
                                  draftProductFilters.categoryIds.includes(categoryId),
                                ),
                                () => toggleDraftProductFilterValues('categoryIds', categoryOption.categoryIds),
                                `option-${group.key}-${categoryOption.key}`,
                              ),
                            )}
                          </View>
                        </View>
                      );
                    })}
                  </View>
                ) : null,
              )}

              {renderFilterGroup(
                'Thương hiệu',
                brandFilterOptions.length > 1 ? (
                  <View style={styles.filterChoiceWrap}>
                    {brandFilterOptions.map((option) =>
                      renderFilterChoice(
                        option.label,
                        draftProductFilters.brandIds.includes(option.id),
                        () => toggleDraftProductFilterValues('brandIds', [option.id]),
                        option.id,
                      ),
                    )}
                  </View>
                ) : null,
              )}

              {renderFilterGroup(
                'Khoảng giá',
                <View style={styles.filterChoiceWrap}>
                  {pricePresets.map((preset) =>
                    renderFilterChoice(preset.label, isPricePresetActive(draftProductFilters, preset), () =>
                      setDraftProductFilters((current) => ({
                        ...current,
                        minPrice: preset.minPrice,
                        maxPrice: preset.maxPrice,
                      })),
                    ),
                  )}
                </View>,
              )}

              <TouchableOpacity style={styles.resetButton} onPress={resetDraftProductFilters} activeOpacity={0.82}>
                <MaterialCommunityIcons name="refresh" size={18} color={colors.brand} />
                <Text style={styles.resetText}>Đặt lại bộ lọc</Text>
              </TouchableOpacity>
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
    backgroundColor: tryOnPalette.header,
  },
  header: {
    minHeight: 60,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    backgroundColor: tryOnPalette.header,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.14)',
  },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCopy: {
    flex: 1,
    minWidth: 0,
    paddingHorizontal: spacing.sm,
  },
  headerTitle: {
    color: colors.white,
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '800',
    textAlign: 'center',
  },
  productHeaderTitle: {
    flex: 1,
    color: colors.white,
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '800',
    textAlign: 'center',
  },
  headerSpacer: {
    width: 40,
  },
  content: {
    flex: 1,
    backgroundColor: tryOnPalette.canvas,
  },
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: 132,
    gap: spacing.lg,
  },
  productListContent: {
    padding: spacing.md,
    paddingBottom: spacing.xl,
    gap: spacing.md,
  },
  sourceCard: {
    borderRadius: radii.md,
    backgroundColor: tryOnPalette.surface,
    borderWidth: 1,
    borderColor: 'rgba(84,119,146,0.22)',
    padding: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    ...shadows.card,
  },
  sourceImageWrap: {
    width: 112,
    height: 150,
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: tryOnPalette.primarySoft,
    borderWidth: 1,
    borderColor: 'rgba(84,119,146,0.28)',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
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
  studioHero: {
    borderRadius: radii.md,
    backgroundColor: tryOnPalette.surface,
    borderWidth: 1,
    borderColor: tryOnPalette.line,
    padding: spacing.md,
    flexDirection: 'row',
    gap: spacing.md,
    ...shadows.card,
  },
  studioCopy: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'center',
  },
  studioEyebrow: {
    color: tryOnPalette.primary,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  studioTitle: {
    color: tryOnPalette.ink,
    fontSize: 21,
    lineHeight: 27,
    fontWeight: '900',
  },
  studioText: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '700',
    marginTop: spacing.sm,
  },
  imageValidationPill: {
    minHeight: 62,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: tryOnPalette.line,
    backgroundColor: tryOnPalette.primarySoft,
    padding: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  imageValidationPillChecking: {
    backgroundColor: tryOnPalette.primarySoft,
    borderColor: tryOnPalette.primaryPale,
  },
  imageValidationPillValid: {
    backgroundColor: tryOnPalette.successSoft,
    borderColor: tryOnPalette.success,
  },
  imageValidationPillGuidance: {
    backgroundColor: '#D7FAE4',
    borderColor: 'rgba(25,135,84,0.14)',
  },
  imageValidationPillWarning: {
    backgroundColor: colors.goldSoft,
    borderColor: colors.goldDark,
  },
  imageValidationPillPressed: {
    opacity: 0.82,
  },
  imageValidationCopy: {
    flex: 1,
    minWidth: 0,
  },
  imageValidationTitle: {
    color: tryOnPalette.ink,
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '900',
  },
  imageValidationText: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '700',
    marginTop: 2,
  },
  changePhotoButton: {
    alignSelf: 'flex-start',
    minHeight: 32,
    borderRadius: radii.pill,
    backgroundColor: tryOnPalette.primarySoft,
    paddingHorizontal: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: spacing.sm,
  },
  changePhotoText: {
    flexShrink: 1,
    color: tryOnPalette.primary,
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '900',
  },
  prefillBanner: {
    minHeight: 48,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: tryOnPalette.line,
    backgroundColor: tryOnPalette.surface,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  prefillBannerText: {
    flex: 1,
    minWidth: 0,
    color: tryOnPalette.ink,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '800',
  },
  sectionHeaderBlock: {
    gap: 3,
  },
  sectionTitle: {
    color: tryOnPalette.ink,
    fontSize: 21,
    lineHeight: 27,
    fontWeight: '900',
  },
  sectionHint: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
  },
  modeSegment: {
    minHeight: 66,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: tryOnPalette.line,
    backgroundColor: colors.surface,
    padding: 5,
    flexDirection: 'row',
    gap: 5,
    ...shadows.card,
  },
  modeSegmentButton: {
    flex: 1,
    minWidth: 0,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingHorizontal: 4,
  },
  modeSegmentButtonActive: {
    backgroundColor: tryOnPalette.primarySoft,
    borderColor: tryOnPalette.primaryPale,
  },
  modeSegmentText: {
    color: colors.textMuted,
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '900',
  },
  modeSegmentTextActive: {
    color: tryOnPalette.ink,
  },
  modeSegmentHint: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '800',
    marginTop: -spacing.sm,
  },
  outfitHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  outfitProgressPill: {
    minHeight: 34,
    borderRadius: radii.pill,
    backgroundColor: tryOnPalette.primarySoft,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  outfitProgress: {
    color: tryOnPalette.primary,
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '900',
  },
  slotGrid: {
    gap: spacing.md,
  },
  slotCard: {
    minHeight: 104,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: tryOnPalette.line,
    backgroundColor: tryOnPalette.surface,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
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
    borderColor: tryOnPalette.primaryLight,
    backgroundColor: tryOnPalette.primarySoft,
  },
  slotCardFilled: {
    backgroundColor: colors.surface,
    borderColor: tryOnPalette.success,
  },
  slotIconWrap: {
    width: 72,
    height: 78,
    borderRadius: 20,
    backgroundColor: tryOnPalette.primarySoft,
    borderWidth: 1,
    borderColor: 'rgba(84,119,146,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  slotIconWrapActive: {
    backgroundColor: tryOnPalette.surface,
    borderColor: 'rgba(84,119,146,0.28)',
  },
  slotImage: {
    width: '100%',
    height: '100%',
  },
  slotCopy: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'center',
  },
  slotCardSingleCopy: {
    flex: 1,
  },
  slotLabel: {
    color: colors.text,
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '900',
  },
  slotHelper: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
    marginTop: 2,
  },
  slotMeta: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '900',
    marginTop: 5,
  },
  slotMetaSelected: {
    color: tryOnPalette.success,
  },
  slotMetaEmpty: {
    color: tryOnPalette.primary,
  },
  slotTextActive: {
    color: tryOnPalette.ink,
  },
  slotRemoveButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: tryOnPalette.success,
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
  optionalLayerButton: {
    minHeight: 58,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: tryOnPalette.line,
    borderStyle: 'dashed',
    backgroundColor: 'rgba(255,255,255,0.72)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  optionalLayerIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: tryOnPalette.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionalLayerCopy: {
    flex: 1,
    minWidth: 0,
  },
  optionalLayerText: {
    color: tryOnPalette.ink,
    fontSize: 14,
    lineHeight: 19,
    fontWeight: '900',
  },
  optionalLayerMeta: {
    color: colors.textMuted,
    fontSize: 11,
    lineHeight: 16,
    fontWeight: '700',
    marginTop: 1,
  },
  alternativePanel: {
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: tryOnPalette.line,
    backgroundColor: tryOnPalette.primarySoft,
    padding: spacing.md,
    gap: spacing.md,
  },
  alternativeHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  alternativeHeaderIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  alternativeHeaderCopy: {
    flex: 1,
    minWidth: 0,
  },
  alternativeHeaderBadge: {
    minHeight: 30,
    borderRadius: radii.pill,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  alternativeHeaderBadgeText: {
    color: tryOnPalette.primary,
    fontSize: 10,
    lineHeight: 14,
    fontWeight: '900',
  },
  alternativeTitle: {
    color: tryOnPalette.primaryDark,
    fontSize: 14,
    lineHeight: 19,
    fontWeight: '900',
  },
  alternativeText: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '700',
    marginTop: 2,
  },
  alternativeGroup: {
    gap: spacing.sm,
  },
  alternativeGroupTitle: {
    color: colors.text,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '900',
  },
  alternativeList: {
    gap: spacing.sm,
    paddingRight: spacing.sm,
  },
  alternativeItem: {
    width: 238,
    minHeight: 104,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: tryOnPalette.line,
    backgroundColor: colors.surface,
    padding: spacing.xs,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    position: 'relative',
  },
  alternativeItemActive: {
    borderColor: tryOnPalette.success,
    borderWidth: 2,
    backgroundColor: tryOnPalette.successSoft,
  },
  alternativeImage: {
    width: 64,
    height: 78,
    borderRadius: radii.xs,
    backgroundColor: tryOnPalette.primarySoft,
  },
  alternativeItemCopy: {
    flex: 1,
    minWidth: 0,
  },
  alternativeItemName: {
    color: colors.text,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '900',
  },
  alternativeItemMeta: {
    color: colors.textMuted,
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '700',
    marginTop: 4,
  },
  alternativeStatusPill: {
    alignSelf: 'flex-start',
    minHeight: 22,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.xs,
  },
  alternativeStatusPillActive: {
    backgroundColor: tryOnPalette.success,
  },
  alternativeStatusPillIdle: {
    backgroundColor: tryOnPalette.primaryPale,
  },
  alternativeStatusText: {
    fontSize: 10,
    lineHeight: 13,
    fontWeight: '900',
  },
  alternativeStatusTextActive: {
    color: colors.white,
  },
  alternativeStatusTextIdle: {
    color: tryOnPalette.primaryDark,
  },
  alternativeActiveMark: {
    position: 'absolute',
    right: spacing.xs,
    top: spacing.xs,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: tryOnPalette.success,
    alignItems: 'center',
    justifyContent: 'center',
  },
  alternativeRemoveMark: {
    position: 'absolute',
    right: spacing.xs,
    top: spacing.xs,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(33,52,72,0.72)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  openProductListButton: {
    minHeight: 78,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: tryOnPalette.line,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    ...shadows.card,
  },
  openProductListIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: tryOnPalette.primarySoft,
    borderWidth: 1,
    borderColor: 'rgba(84,119,146,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  openProductListCopy: {
    flex: 1,
    minWidth: 0,
  },
  openProductListText: {
    color: tryOnPalette.ink,
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '900',
  },
  openProductListMeta: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
    marginTop: 2,
  },
  openProductListArrow: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: tryOnPalette.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mixPreviewCard: {
    borderRadius: radii.md,
    backgroundColor: '#172431',
    padding: spacing.md,
    gap: spacing.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    ...shadows.card,
  },
  mixPreviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  mixPreviewHeaderCopy: {
    flex: 1,
    minWidth: 0,
  },
  mixPreviewEyebrow: {
    color: '#BFD8E6',
    fontSize: 10,
    lineHeight: 14,
    fontWeight: '900',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  mixPreviewTitle: {
    color: colors.white,
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '900',
    marginTop: 3,
  },
  mixPreviewCount: {
    minHeight: 30,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(255,255,255,0.12)',
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mixPreviewCountText: {
    color: colors.white,
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '900',
  },
  mixBeforeAfterRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  mixPortraitStage: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
    gap: spacing.xs,
  },
  mixStageVisual: {
    width: '100%',
    aspectRatio: 0.82,
    maxHeight: 124,
    borderRadius: radii.sm,
    backgroundColor: '#F3F8FB',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  mixSourceImage: {
    width: '100%',
    height: '100%',
  },
  mixResultVisual: {
    backgroundColor: tryOnPalette.primary,
    position: 'relative',
    gap: spacing.xs,
  },
  mixResultGlow: {
    position: 'absolute',
    left: -24,
    right: -24,
    top: 18,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(215,244,255,0.2)',
    transform: [{ rotate: '-12deg' }],
  },
  mixAiPreviewFrame: {
    width: 48,
    height: 42,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(215,244,255,0.42)',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    marginTop: 2,
  },
  mixAiPersonMark: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(33,52,72,0.26)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mixAiSparkleOne: {
    position: 'absolute',
    top: 7,
    right: 8,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#D7F4FF',
  },
  mixAiSparkleTwo: {
    position: 'absolute',
    left: 8,
    bottom: 8,
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(215,244,255,0.72)',
  },
  mixResultHint: {
    color: '#D7F4FF',
    fontSize: 9,
    lineHeight: 12,
    fontWeight: '900',
  },
  mixSparkleDot: {
    position: 'absolute',
    top: 16,
    right: 15,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#D7F4FF',
  },
  mixStageLabel: {
    color: '#DCEAF1',
    fontSize: 10,
    lineHeight: 14,
    fontWeight: '900',
    textAlign: 'center',
  },
  mixProcessStep: {
    width: 48,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingTop: spacing.xl,
  },
  mixProcessIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: tryOnPalette.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mixProcessText: {
    color: '#DCEAF1',
    fontSize: 9,
    lineHeight: 12,
    fontWeight: '900',
    textAlign: 'center',
  },
  mixItemsHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  mixItemsTitle: {
    color: colors.white,
    flex: 1,
    minWidth: 0,
    fontSize: 14,
    lineHeight: 19,
    fontWeight: '900',
  },
  mixItemsMeta: {
    color: '#BFD8E6',
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '800',
    textAlign: 'right',
    maxWidth: '44%',
  },
  mixItemList: {
    gap: spacing.sm,
    paddingRight: spacing.sm,
  },
  mixItemCard: {
    width: 218,
    borderRadius: radii.sm,
    backgroundColor: 'rgba(255,255,255,0.96)',
    padding: spacing.xs,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    overflow: 'hidden',
  },
  mixItemImageWrap: {
    width: 70,
    height: 88,
    borderRadius: radii.xs,
    overflow: 'hidden',
    backgroundColor: tryOnPalette.primarySoft,
  },
  mixItemImage: {
    width: '100%',
    height: '100%',
  },
  mixItemCopy: {
    flex: 1,
    minWidth: 0,
    paddingRight: spacing.xs,
  },
  mixItemRole: {
    color: tryOnPalette.primary,
    fontSize: 10,
    lineHeight: 14,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  mixItemName: {
    color: tryOnPalette.ink,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '900',
    marginTop: 2,
  },
  mixItemVariant: {
    color: colors.textMuted,
    fontSize: 10,
    lineHeight: 14,
    fontWeight: '700',
    marginTop: 4,
  },
  imageExpandBadge: {
    position: 'absolute',
    right: spacing.xs,
    top: spacing.xs,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(23,36,49,0.78)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageExpandBadgeSmall: {
    position: 'absolute',
    right: 5,
    top: 5,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(23,36,49,0.76)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mixItemsEmpty: {
    minHeight: 58,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
    borderStyle: 'dashed',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  mixItemsEmptyText: {
    flex: 1,
    minWidth: 0,
    color: '#DCEAF1',
    fontSize: 11,
    lineHeight: 16,
    fontWeight: '700',
  },
  mixPreviewFooter: {
    minHeight: 44,
    borderRadius: radii.sm,
    backgroundColor: 'rgba(255,255,255,0.1)',
    padding: spacing.sm,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  mixPreviewText: {
    flex: 1,
    minWidth: 0,
    color: '#DCEAF1',
    fontSize: 11,
    lineHeight: 16,
    fontWeight: '700',
  },
  searchRow: {
    minHeight: 54,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
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
    minHeight: 52,
    color: colors.text,
    fontSize: 16,
  },
  genderSegment: {
    minHeight: 54,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
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
    minHeight: 42,
    borderRadius: radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 4,
    paddingHorizontal: 6,
  },
  genderChipActive: {
    backgroundColor: tryOnPalette.primaryPale,
  },
  genderChipText: {
    color: tryOnPalette.ink,
    fontSize: 12,
    lineHeight: 16,
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
  productHeaderCopy: {
    flex: 1,
    minWidth: 0,
  },
  productCount: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '800',
    marginTop: 1,
  },
  catalogFilterButton: {
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
  catalogFilterButtonText: {
    color: colors.brandDark,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '800',
  },
  catalogFilterBadge: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
  },
  catalogFilterBadgeText: {
    color: colors.white,
    fontSize: 10,
    lineHeight: 13,
    fontWeight: '800',
  },
  productCategoryScroller: {
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
  productCategoryRail: {
    minHeight: 88,
    paddingHorizontal: spacing.sm,
    alignItems: 'stretch',
  },
  productCategoryRailBalanced: {
    flexGrow: 1,
    paddingHorizontal: spacing.md,
    justifyContent: 'space-between',
  },
  productCategoryTab: {
    position: 'relative',
    width: 82,
    height: 88,
    paddingHorizontal: 4,
    paddingTop: 8,
    paddingBottom: 7,
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  productCategoryTabBalanced: {
    flexShrink: 0,
  },
  productCategoryTabIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  productCategoryTabIconActive: {
    backgroundColor: colors.brandMist,
  },
  productCategoryTabLabel: {
    marginTop: 4,
    color: colors.textMuted,
    fontSize: 10,
    lineHeight: 12,
    fontWeight: '700',
    textAlign: 'center',
  },
  productCategoryTabLabelActive: {
    color: colors.brandDark,
    fontWeight: '900',
  },
  productCategoryTabIndicator: {
    position: 'absolute',
    left: 11,
    right: 11,
    bottom: 0,
    height: 3,
    borderTopLeftRadius: 3,
    borderTopRightRadius: 3,
    backgroundColor: colors.brandDark,
  },
  productCategoryLoadingTab: {
    width: 82,
    height: 88,
    paddingTop: 14,
    alignItems: 'center',
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
    backgroundColor: tryOnPalette.surface,
    overflow: 'hidden',
    ...shadows.card,
  },
  productCardSelected: {
    borderColor: tryOnPalette.success,
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
    borderColor: 'rgba(221,231,236,0.42)',
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
  },
  roleBadgeText: {
    color: tryOnPalette.primaryPale,
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '900',
  },
  selectedMark: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: tryOnPalette.success,
    alignItems: 'center',
    justifyContent: 'center',
  },
  productName: {
    minHeight: 44,
    color: tryOnPalette.ink,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '900',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
  },
  productPrice: {
    color: tryOnPalette.primary,
    fontSize: 14,
    lineHeight: 19,
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
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    padding: spacing.xl,
  },
  emptySelectionText: {
    color: colors.textMuted,
    fontSize: 15,
    lineHeight: 21,
    textAlign: 'center',
    fontWeight: '800',
  },
  contextGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  contextChip: {
    minHeight: 46,
    borderWidth: 1,
    borderColor: tryOnPalette.line,
    borderRadius: radii.pill,
    backgroundColor: tryOnPalette.surface,
    paddingHorizontal: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  contextChipActive: {
    backgroundColor: tryOnPalette.primaryPale,
    borderColor: tryOnPalette.primaryPale,
  },
  contextText: {
    color: colors.brandDark,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '900',
  },
  contextTextActive: {
    color: tryOnPalette.ink,
  },
  promptInput: {
    minHeight: 104,
    borderWidth: 1,
    borderColor: tryOnPalette.line,
    borderRadius: radii.sm,
    backgroundColor: colors.surface,
    padding: spacing.md,
    color: colors.text,
    fontSize: 15,
    lineHeight: 22,
    textAlignVertical: 'top',
  },
  contextPreviewCard: {
    marginTop: spacing.sm,
    borderRadius: radii.sm,
    backgroundColor: tryOnPalette.primarySoft,
    borderWidth: 1,
    borderColor: tryOnPalette.primaryPale,
    padding: spacing.md,
    gap: spacing.sm,
  },
  contextPreviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  contextPreviewLabel: {
    flex: 1,
    minWidth: 0,
    color: tryOnPalette.primary,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '800',
  },
  contextPreviewLangToggle: {
    flexDirection: 'row',
    borderRadius: radii.pill,
    backgroundColor: tryOnPalette.surface,
    borderWidth: 1,
    borderColor: tryOnPalette.primaryPale,
    overflow: 'hidden',
  },
  contextPreviewLangBtn: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  contextPreviewLangBtnActive: {
    backgroundColor: tryOnPalette.primary,
  },
  contextPreviewLangText: {
    color: tryOnPalette.primary,
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '900',
  },
  contextPreviewLangTextActive: {
    color: tryOnPalette.surface,
  },
  contextPreviewText: {
    color: tryOnPalette.ink,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '600',
  },
  outputOptionCard: {
    minHeight: 72,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: tryOnPalette.line,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    ...shadows.card,
  },
  outputOptionIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: tryOnPalette.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  outputOptionCopy: {
    flex: 1,
  },
  outputOptionTitle: {
    color: colors.text,
    fontSize: 16,
    lineHeight: 21,
    fontWeight: '900',
  },
  outputOptionText: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '700',
    marginTop: 2,
  },
  videoOutputOptionCard: {
    minHeight: 0,
    flexDirection: 'column',
    alignItems: 'stretch',
  },
  videoOutputOptionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  videoDurationControl: {
    borderTopWidth: 1,
    borderTopColor: tryOnPalette.line,
    paddingTop: spacing.md,
  },
  videoDurationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  videoDurationTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  videoDurationLabel: {
    color: tryOnPalette.ink,
    fontSize: 14,
    lineHeight: 19,
    fontWeight: '800',
  },
  productLoadMoreArea: {
    minHeight: 58,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingTop: spacing.md,
    paddingBottom: spacing.xs,
  },
  productLoadMoreText: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
    textAlign: 'center',
  },
  productEndOfListText: {
    color: colors.textSubtle,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
    textAlign: 'center',
  },
  videoDurationValueBadge: {
    minWidth: 62,
    borderRadius: 999,
    backgroundColor: tryOnPalette.primarySoft,
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
    alignItems: 'center',
  },
  videoDurationValue: {
    color: tryOnPalette.primaryDark,
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '900',
  },
  videoDurationTrackTouch: {
    height: 38,
    justifyContent: 'center',
    marginTop: spacing.xs,
  },
  videoDurationRail: {
    position: 'absolute',
    left: VIDEO_DURATION_THUMB_SIZE / 2,
    right: VIDEO_DURATION_THUMB_SIZE / 2,
    top: 16.5,
    height: 5,
    borderRadius: 999,
    backgroundColor: tryOnPalette.primaryPale,
  },
  videoDurationFill: {
    position: 'absolute',
    left: VIDEO_DURATION_THUMB_SIZE / 2,
    top: 16.5,
    height: 5,
    borderRadius: 999,
    backgroundColor: tryOnPalette.primary,
  },
  videoDurationThumb: {
    position: 'absolute',
    top: 8,
    width: VIDEO_DURATION_THUMB_SIZE,
    height: VIDEO_DURATION_THUMB_SIZE,
    borderRadius: VIDEO_DURATION_THUMB_SIZE / 2,
    backgroundColor: tryOnPalette.surface,
    borderWidth: 6,
    borderColor: tryOnPalette.primary,
    ...shadows.card,
  },
  videoDurationBounds: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  videoDurationBoundText: {
    color: colors.textMuted,
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '700',
  },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopWidth: 1,
    borderTopColor: tryOnPalette.line,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
    gap: spacing.md,
  },
  footerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  footerSummary: {
    flex: 1,
    minWidth: 0,
  },
  footerLabel: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '800',
  },
  footerTotal: {
    color: tryOnPalette.ink,
    fontSize: 20,
    lineHeight: 26,
    fontWeight: '900',
  },
  submitButton: {
    minWidth: 178,
    minHeight: 56,
    borderRadius: radii.md,
    backgroundColor: tryOnPalette.primary,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  submitButtonDisabled: {
    backgroundColor: colors.border,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  submitText: {
    color: colors.white,
    fontSize: 16,
    lineHeight: 21,
    fontWeight: '900',
  },
  submitTextDisabled: {
    color: colors.textMuted,
  },
  previewModal: {
    flex: 1,
    backgroundColor: '#05070A',
  },
  previewHeader: {
    position: 'absolute',
    top: spacing.md,
    left: spacing.lg,
    right: spacing.lg,
    zIndex: 2,
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  previewCounter: {
    minHeight: 34,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(255,255,255,0.16)',
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    maxWidth: '72%',
  },
  previewCounterLabel: {
    color: colors.white,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '900',
  },
  previewCloseButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewSlide: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  confirmModalRoot: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    backgroundColor: 'transparent',
  },
  confirmBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(17,24,39,0.44)',
  },
  confirmCard: {
    width: '100%',
    maxWidth: 360,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    padding: spacing.lg,
    alignItems: 'center',
    ...shadows.card,
  },
  confirmIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: tryOnPalette.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  confirmIconWrapWarning: {
    backgroundColor: colors.goldSoft,
  },
  confirmTitle: {
    color: colors.text,
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '900',
    textAlign: 'center',
  },
  confirmText: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  confirmActions: {
    width: '100%',
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  confirmCancelButton: {
    flex: 1,
    minHeight: 46,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmPrimaryButton: {
    flex: 1,
    minHeight: 46,
    borderRadius: radii.sm,
    backgroundColor: tryOnPalette.primaryPale,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmCancelText: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 19,
    fontWeight: '900',
  },
  confirmPrimaryText: {
    color: tryOnPalette.ink,
    fontSize: 14,
    lineHeight: 19,
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
    borderColor: tryOnPalette.success,
    backgroundColor: tryOnPalette.success,
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
    width: 86,
    minHeight: 72,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.field,
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },
  colorChoiceActive: {
    borderColor: tryOnPalette.success,
    backgroundColor: tryOnPalette.successSoft,
  },
  colorChoiceText: {
    color: colors.text,
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '800',
    textAlign: 'center',
    maxWidth: '100%',
  },
  colorChoiceTextActive: {
    color: tryOnPalette.success,
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
    backgroundColor: tryOnPalette.success,
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
    zIndex: 2,
    elevation: 12,
    width: '100%',
    maxHeight: '82%',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    backgroundColor: tryOnPalette.surface,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl,
  },
  filterSheetContent: {
    paddingTop: spacing.lg,
    paddingBottom: spacing.lg,
  },
  filterSheetHeader: {
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  filterSheetTitle: {
    color: colors.text,
    fontSize: 20,
    lineHeight: 27,
    fontWeight: '800',
  },
  filterSheetCancel: {
    color: colors.text,
    fontSize: 17,
    lineHeight: 23,
    fontWeight: '500',
  },
  filterSheetApply: {
    color: colors.danger,
    fontSize: 17,
    lineHeight: 23,
    fontWeight: '800',
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
  filterChoiceWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  filterChoice: {
    minHeight: 42,
    maxWidth: '100%',
    borderRadius: radii.xs,
    borderWidth: 1,
    borderColor: colors.field,
    backgroundColor: colors.field,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  filterChoiceActive: {
    borderColor: colors.black,
    backgroundColor: colors.surface,
  },
  filterChoiceText: {
    flexShrink: 1,
    color: colors.textMuted,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '700',
  },
  filterChoiceTextActive: {
    fontWeight: '800',
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

export default VirtualTryOnBuilderScreen;
