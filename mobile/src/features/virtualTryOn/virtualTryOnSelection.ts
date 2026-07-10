import { MaterialCommunityIcons } from '@expo/vector-icons';
import {
  TRY_ON_ACTIVE_ITEM_LIMIT,
  type TryOnItemRole,
  type TryOnOutfitMode,
  type TryOnSeedItem,
  type TryOnSelectedItem,
} from './virtualTryOn.types';

export type FashionIconName = keyof typeof MaterialCommunityIcons.glyphMap;

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

export const allTryOnRoles: TryOnItemRole[] = ['top', 'bottom', 'dress', 'shoes', 'outerwear'];

export const normalizeRoleText = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'd')
    .toLowerCase();

const hasAnyKeyword = (value: string, keywords: string[]) =>
  keywords.some((keyword) => value.includes(keyword));

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
    { key: 'top', label: 'Áo', helper: 'Áo thun, sơ mi', roles: ['top'], icon: 'tshirt-v' },
    { key: 'outfit', label: 'Quần/Váy', helper: 'Quần, jean, váy, đầm', roles: ['bottom', 'dress'], icon: 'hanger' },
    { key: 'layer', label: 'Áo khoác', helper: 'Tùy chọn: khoác ngoài', roles: ['outerwear'], icon: 'wardrobe-outline', optional: true },
    { key: 'shoes', label: 'Giày/dép', helper: 'Giày, dép, sandal', roles: ['shoes'], icon: 'shoe-formal' },
  ];
};

export const inferRole = (product: { name: string; category?: { name?: string } | null }): TryOnItemRole => {
  const haystack = normalizeRoleText(`${product.name} ${product.category?.name ?? ''}`);
  if (hasAnyKeyword(haystack, ['giay', 'dep', 'sandal', 'sneaker', 'boot', 'loafer'])) return 'shoes';
  if (hasAnyKeyword(haystack, ['chan vay', 'quan', 'jean', 'short', 'pants', 'trouser'])) return 'bottom';
  if (hasAnyKeyword(haystack, ['vay', 'dam', 'dress'])) return 'dress';
  if (hasAnyKeyword(haystack, ['khoac', 'blazer', 'jacket', 'cardigan', 'hoodie', 'coat', 'outerwear'])) return 'outerwear';
  return 'top';
};

export const normalizeSelectionForMode = (items: TryOnSelectedItem[], mode: TryOnOutfitMode): NormalizedSelection => {
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
  const normalizedItem = slot.roles.includes(item.role) ? item : { ...item, role: slot.roles[0] };

  if (mode === 'single') return [normalizedItem];

  const withoutSameItem = currentItems.filter((entry) => !isSameTryOnItem(entry, normalizedItem));
  const withoutSameSlot = withoutSameItem.filter((entry) => !slot.roles.includes(entry.role));
  return normalizeItemsForMode([...withoutSameSlot, normalizedItem], mode);
};

export const getSuggestedOutfitMode = (items: TryOnSelectedItem[]): TryOnOutfitMode => {
  if (items.length <= 1) return 'single';

  const hasTop = items.some((item) => item.role === 'top' || item.role === 'outerwear');
  const hasBottom = items.some((item) => item.role === 'bottom');
  if (items.length === 2 && hasTop && hasBottom) return 'top_bottom';

  return 'full_set';
};

export const getPrefillOutfitMode = (items: TryOnSelectedItem[]) => {
  const initialMode = getSuggestedOutfitMode(items);
  const normalized = normalizeSelectionForMode(items, initialMode);
  return getSuggestedOutfitMode(normalized.items);
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
