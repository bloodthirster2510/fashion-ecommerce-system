import { MaterialCommunityIcons } from '@expo/vector-icons';
import {
  TRY_ON_ACTIVE_ITEM_LIMIT,
  TRY_ON_QUEUE_LIMIT,
  type TryOnItemRole,
  type TryOnOutfitMode,
  type TryOnSeedItem,
  type TryOnSelectedItem,
} from './virtualTryOn.types';

export type FashionIconName = keyof typeof MaterialCommunityIcons.glyphMap;

export type TryOnCategoryNode = {
  _id: string;
  name: string;
  parent_id?: string | null;
  gender?: 'male' | 'female' | 'unisex';
};

export const tryOnRoleLabel: Record<TryOnItemRole, string> = {
  top: 'Áo',
  bottom: 'Quần',
  dress: 'Váy/đầm',
  shoes: 'Giày/dép',
  accessory: 'Món khác',
  outerwear: 'Áo',
};

export type OutfitSlot = {
  key: string;
  label: string;
  helper: string;
  roles: TryOnItemRole[];
  icon: FashionIconName;
  required?: boolean;
  optional?: boolean;
};

export type NormalizedSelection = {
  items: TryOnSelectedItem[];
  skipped: TryOnSelectedItem[];
};

export type SlotAlternativeGroup = {
  slotKey: string;
  slotLabel: string;
  items: TryOnSelectedItem[];
};

export const allTryOnRoles: TryOnItemRole[] = ['top', 'bottom', 'dress', 'shoes', 'outerwear', 'accessory'];

export const normalizeRoleText = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'd')
    .toLowerCase();

const hasAnyKeyword = (value: string, keywords: string[]) =>
  keywords.some((keyword) => value.includes(keyword));

const fullOutfitPattern =
  /(^|[\s/.-])(full set|bo do|bo mac|bo ao|bo quan|bo ao quan|bo vest|bo suit|set|combo|outfit|suit|tracksuit|jumpsuit|romper|playsuit|two piece|2 piece)([\s/.-]|$)/;
const exactFullOutfitCategoryPattern = /^(bo|set|combo|outfit|full set)$/;

export const isFullOutfitText = (value: string) => fullOutfitPattern.test(normalizeRoleText(value));

const isFullOutfitCategoryText = (value?: string) => {
  if (!value) return false;
  const normalizedValue = normalizeRoleText(value).trim();
  return fullOutfitPattern.test(normalizedValue) || exactFullOutfitCategoryPattern.test(normalizedValue);
};

export const isFullOutfitProduct = (product: {
  name: string;
  category?: { name?: string } | null;
  categoryBreadcrumb?: Array<{ name?: string }>;
}) => {
  if (isFullOutfitText(product.name)) return true;

  const categoryNames = [
    product.category?.name,
    ...(product.categoryBreadcrumb ?? []).map((category) => category.name),
  ].filter(Boolean);

  return categoryNames.some((categoryName) => isFullOutfitCategoryText(categoryName));
};

export const isFullOutfitSelectedItem = (item: Pick<TryOnSelectedItem, 'isFullOutfit' | 'nameSnapshot'>) =>
  Boolean(item.isFullOutfit) || isFullOutfitText(item.nameSnapshot);

export const getTryOnCategoryHierarchy = (
  category: TryOnCategoryNode | null | undefined,
  categories: TryOnCategoryNode[],
) => {
  if (!category) return [];

  const categoryById = new Map(categories.map((item) => [item._id, item]));
  const hierarchy: TryOnCategoryNode[] = [];
  const visitedIds = new Set<string>();
  let current: TryOnCategoryNode | undefined = categoryById.get(category._id) ?? category;

  while (current && !visitedIds.has(current._id)) {
    hierarchy.unshift(current);
    visitedIds.add(current._id);
    current = current.parent_id ? categoryById.get(current.parent_id) : undefined;
  }

  return hierarchy;
};

export const getTryOnCategoryGender = (
  category: TryOnCategoryNode | null | undefined,
  categories: TryOnCategoryNode[],
) => getTryOnCategoryHierarchy(category, categories)[0]?.gender ?? category?.gender;

export const getSeedItemKey = (item: TryOnSeedItem) =>
  item.cartItemId ?? `${item.productId}:${item.variantId}:${item.colorVariantId}:${item.size ?? ''}`;

export const getSelectedItemKey = (item: TryOnSelectedItem) =>
  item.queueKey ?? item.cartItemId ?? `${item.productId}:${item.variantId}:${item.colorVariantId}:${item.size ?? ''}`;

export const isSameTryOnItem = (left: TryOnSelectedItem, right: TryOnSelectedItem) =>
  getSelectedItemKey(left) === getSelectedItemKey(right);

export const selectedItemToSeed = (item: TryOnSelectedItem): TryOnSeedItem => ({
  cartItemId: item.cartItemId,
  productId: item.productId,
  variantId: item.variantId,
  colorVariantId: item.colorVariantId,
  size: item.size,
  role: item.role,
  isFullOutfit: item.isFullOutfit,
  nameSnapshot: item.nameSnapshot,
  colorSnapshot: item.colorSnapshot,
  imageSnapshot: item.imageSnapshot,
});

export const getOutfitSlots = (mode: TryOnOutfitMode): OutfitSlot[] => {
  if (mode === 'single') {
    return [
      {
        key: 'single',
        label: 'Sản phẩm',
        helper: 'Chọn 1 món bất kỳ',
        roles: allTryOnRoles,
        icon: 'plus-circle-outline',
        required: true,
      },
    ];
  }

  if (mode === 'top_bottom') {
    return [
      { key: 'top', label: 'Áo', helper: 'Chọn áo', roles: ['top', 'outerwear'], icon: 'tshirt-v', required: true },
      { key: 'bottom', label: 'Quần', helper: 'Chọn quần', roles: ['bottom'], icon: 'hanger', required: true },
    ];
  }

  return [
    { key: 'top', label: 'Áo', helper: 'Áo thun, sơ mi, áo khoác', roles: ['top', 'outerwear'], icon: 'tshirt-v' },
    { key: 'outfit', label: 'Quần/Váy', helper: 'Quần, jean, váy, đầm', roles: ['bottom', 'dress'], icon: 'hanger' },
    { key: 'shoes', label: 'Giày/dép', helper: 'Giày, dép, sandal', roles: ['shoes'], icon: 'shoe-formal' },
  ];
};

export const inferRole = (product: {
  name: string;
  category?: { name?: string } | null;
  categoryBreadcrumb?: Array<{ name?: string }>;
}): TryOnItemRole => {
  const categoryNames = [
    product.category?.name,
    ...(product.categoryBreadcrumb ?? []).map((category) => category.name),
  ].filter(Boolean).join(' ');
  const haystack = normalizeRoleText(`${product.name} ${categoryNames}`);
  if (isFullOutfitProduct(product)) return 'dress';
  if (hasAnyKeyword(haystack, ['giay', 'dep', 'sandal', 'sneaker', 'boot', 'loafer'])) return 'shoes';
  if (hasAnyKeyword(haystack, ['chan vay', 'quan', 'jean', 'short', 'pants', 'trouser'])) return 'bottom';
  if (hasAnyKeyword(haystack, ['vay', 'dam', 'dress'])) return 'dress';
  if (hasAnyKeyword(haystack, ['khoac', 'blazer', 'jacket', 'cardigan', 'hoodie', 'coat', 'outerwear'])) return 'outerwear';
  return 'top';
};

export const inferRoleFromCategoryHierarchy = (
  product: { name: string; category?: TryOnCategoryNode | null },
  categories: TryOnCategoryNode[],
) => inferRole({
  ...product,
  categoryBreadcrumb: getTryOnCategoryHierarchy(product.category, categories),
});

export const normalizeSelectionForMode = (items: TryOnSelectedItem[], mode: TryOnOutfitMode): NormalizedSelection => {
  const fullOutfitItem = items.find(isFullOutfitSelectedItem);
  if (fullOutfitItem) {
    return {
      items: [{ ...fullOutfitItem, role: 'dress', isFullOutfit: true }],
      skipped: items.filter((item) => !isSameTryOnItem(item, fullOutfitItem)),
    };
  }

  const slots = getOutfitSlots(mode);
  const usedProductIds = new Set<string>();
  const usedSlotKeys = new Set<string>();
  const nextItems: TryOnSelectedItem[] = [];
  const skipped: TryOnSelectedItem[] = [];

  for (const item of items) {
    const slot = slots.find((entry) => entry.roles.includes(item.role));
    if (!slot || usedProductIds.has(item.productId) || usedSlotKeys.has(slot.key) || nextItems.length >= TRY_ON_ACTIVE_ITEM_LIMIT) {
      skipped.push(item);
      continue;
    }

    usedProductIds.add(item.productId);
    usedSlotKeys.add(slot.key);
    nextItems.push(item);
  }

  return { items: nextItems, skipped };
};

export const normalizeItemsForMode = (items: TryOnSelectedItem[], mode: TryOnOutfitMode) =>
  normalizeSelectionForMode(items, mode).items;

export const selectItemForSlot = (
  currentItems: TryOnSelectedItem[],
  item: TryOnSelectedItem,
  slot: OutfitSlot,
  mode: TryOnOutfitMode,
) => {
  const normalizedItem = isFullOutfitSelectedItem(item)
    ? { ...item, role: 'dress' as const, isFullOutfit: true }
    : slot.roles.includes(item.role) ? item : { ...item, role: slot.roles[0] };

  if (mode === 'single') return [normalizedItem];
  if (normalizedItem.isFullOutfit) return [normalizedItem];

  const withoutFullOutfit = currentItems.filter((entry) => !isFullOutfitSelectedItem(entry));
  const withoutSameItem = withoutFullOutfit.filter((entry) => !isSameTryOnItem(entry, normalizedItem));
  const withoutSameSlot = withoutSameItem.filter((entry) => !slot.roles.includes(entry.role));
  return normalizeItemsForMode([...withoutSameSlot, normalizedItem], mode);
};

export const getSuggestedOutfitMode = (items: TryOnSelectedItem[]): TryOnOutfitMode => {
  if (items.some(isFullOutfitSelectedItem)) return 'single';
  if (items.length <= 1) return 'single';
  return 'full_set';
};

export const getPrefillOutfitMode = (items: TryOnSelectedItem[]) => {
  const initialMode = getSuggestedOutfitMode(items);
  const normalized = normalizeSelectionForMode(items, initialMode);
  return getSuggestedOutfitMode(normalized.items);
};

export const buildPrefillQueueItems = (
  selectedItems: TryOnSelectedItem[],
  resolvedItems: TryOnSelectedItem[],
  alternativeItems: TryOnSelectedItem[] = [],
) => {
  const seenKeys = new Set<string>();

  return [...selectedItems, ...resolvedItems, ...alternativeItems]
    .filter((item) => {
      const key = getSelectedItemKey(item);
      if (seenKeys.has(key)) return false;
      seenKeys.add(key);
      return true;
    })
    .slice(0, TRY_ON_QUEUE_LIMIT);
};

export const getQueueSlotForRole = (role: TryOnItemRole, mode: TryOnOutfitMode) =>
  getOutfitSlots(mode).find((entry) => entry.roles.includes(role)) ??
  getOutfitSlots('full_set').find((entry) => entry.roles.includes(role)) ??
  getOutfitSlots('single')[0];

export const getQueueSlotGroups = (items: TryOnSelectedItem[], mode: TryOnOutfitMode): SlotAlternativeGroup[] => {
  const groups = new Map<string, SlotAlternativeGroup>();

  for (const item of items) {
    const slot = getQueueSlotForRole(item.role, mode);
    if (!slot) continue;

    const group = groups.get(slot.key) ?? {
      slotKey: slot.key,
      slotLabel: slot.label,
      items: [],
    };
    group.items.push(item);
    groups.set(slot.key, group);
  }

  return Array.from(groups.values()).filter((group) => group.items.length > 0);
};
