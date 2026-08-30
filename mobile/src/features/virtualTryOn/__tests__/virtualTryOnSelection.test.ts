import type { TryOnItemRole, TryOnSelectedItem } from '../virtualTryOn.types';
import {
  buildPrefillQueueItems,
  getOutfitSlots,
  getPrefillOutfitMode,
  getQueueSlotGroups,
  getTryOnCategoryGender,
  inferRole,
  inferRoleFromCategoryHierarchy,
  isFullOutfitProduct,
  normalizeSelectionForMode,
  selectItemForSlot,
} from '../virtualTryOnSelection';

const item = (id: string, role: TryOnItemRole): TryOnSelectedItem => ({
  queueKey: id,
  productId: id,
  variantId: `${id}-variant`,
  colorVariantId: `${id}-color`,
  size: 'M',
  role,
  nameSnapshot: id,
  colorSnapshot: 'Trắng',
  imageSnapshot: 'https://example.com/image.png',
  priceSnapshot: 100000,
  finalPriceSnapshot: 90000,
});

const fullOutfitItem = (id: string): TryOnSelectedItem => ({
  ...item(id, 'dress'),
  isFullOutfit: true,
  nameSnapshot: 'Set bộ linen',
});

describe('virtualTryOnSelection', () => {
  it('keeps only one active item per slot and queues duplicate tops', () => {
    const topA = item('top-a', 'top');
    const topB = item('top-b', 'top');
    const bottom = item('bottom', 'bottom');

    const mode = getPrefillOutfitMode([topA, topB, bottom]);
    const normalized = normalizeSelectionForMode([topA, topB, bottom], mode);

    expect(mode).toBe('full_set');
    expect(normalized.items.map((entry) => entry.productId)).toEqual(['top-a', 'bottom']);
    expect(normalized.skipped.map((entry) => entry.productId)).toEqual(['top-b']);
  });

  it('treats dress and bottom as the same outfit slot in full-set mode', () => {
    const dress = item('dress', 'dress');
    const bottom = item('bottom', 'bottom');
    const shoes = item('shoes', 'shoes');

    const normalized = normalizeSelectionForMode([dress, bottom, shoes], 'full_set');

    expect(normalized.items.map((entry) => entry.role)).toEqual(['dress', 'shoes']);
    expect(normalized.skipped.map((entry) => entry.role)).toEqual(['bottom']);
  });

  it('keeps full outfit products exclusive even in full-set mode', () => {
    const fullSet = fullOutfitItem('set-linen');
    const top = item('top', 'top');
    const shoes = item('shoes', 'shoes');

    const normalized = normalizeSelectionForMode([top, fullSet, shoes], 'full_set');

    expect(normalized.items.map((entry) => entry.productId)).toEqual(['set-linen']);
    expect(normalized.items[0].role).toBe('dress');
    expect(normalized.items[0].isFullOutfit).toBe(true);
    expect(normalized.skipped.map((entry) => entry.productId)).toEqual(['top', 'shoes']);
    expect(getPrefillOutfitMode([top, fullSet, shoes])).toBe('single');
  });

  it('keeps every cart item in the waiting queue when a full outfit is active', () => {
    const fullSet = fullOutfitItem('set-linen');
    const top = item('top', 'top');
    const shoes = item('shoes', 'shoes');
    const selected = normalizeSelectionForMode([top, fullSet, shoes], 'full_set').items;

    const queue = buildPrefillQueueItems(selected, [top, fullSet, shoes]);

    expect(selected.map((entry) => entry.productId)).toEqual(['set-linen']);
    expect(queue.map((entry) => entry.productId)).toEqual(['set-linen', 'top', 'shoes']);
  });

  it('replaces a selected full outfit when selecting a normal item', () => {
    const fullSet = fullOutfitItem('set-linen');
    const top = item('top', 'top');
    const topSlot = getOutfitSlots('full_set')[0];

    const selected = selectItemForSlot([fullSet], top, topSlot, 'full_set');

    expect(selected.map((entry) => entry.productId)).toEqual(['top']);
  });

  it('replaces the active item in the matching slot when selecting from queue', () => {
    const topA = item('top-a', 'top');
    const topB = item('top-b', 'top');
    const bottom = item('bottom', 'bottom');
    const topSlot = getOutfitSlots('full_set')[0];

    const selected = selectItemForSlot([topA, bottom], topB, topSlot, 'full_set');

    expect(selected.map((entry) => entry.productId)).toEqual(['bottom', 'top-b']);
  });

  it('treats outerwear as the same top slot for full-set selection', () => {
    const top = item('shirt', 'top');
    const outerwear = item('jacket', 'outerwear');
    const topSlot = getOutfitSlots('full_set')[0];

    expect(topSlot.roles).toContain('outerwear');

    const selected = selectItemForSlot([top], outerwear, topSlot, 'full_set');

    expect(selected.map((entry) => entry.productId)).toEqual(['jacket']);
  });

  it('groups queued items by try-on slot', () => {
    const groups = getQueueSlotGroups([
      item('top-a', 'top'),
      item('jacket', 'outerwear'),
      item('shoes', 'shoes'),
    ], 'full_set');

    expect(groups.map((group) => [group.slotKey, group.items.length])).toEqual([
      ['top', 2],
      ['shoes', 1],
    ]);
  });

  it('infers roles from Vietnamese text without accents', () => {
    expect(inferRole({ name: 'Ao khoac cardigan', category: { name: 'ao khoac' } })).toBe('outerwear');
    expect(inferRole({ name: 'Giay sneaker trang', category: { name: 'giay dep' } })).toBe('shoes');
    expect(inferRole({ name: 'Quan jean nam', category: { name: 'quan' } })).toBe('bottom');
    expect(inferRole({ name: 'Dam du tiec', category: { name: 'vay dam' } })).toBe('dress');
  });

  it.each([
    ['Áo giữ nhiệt', 'top'],
    ['Áo hai dây', 'top'],
    ['Áo len', 'top'],
    ['Áo polo', 'top'],
    ['Áo sơ mi', 'top'],
    ['Áo thun', 'top'],
    ['Hoodie / Áo nỉ', 'top'],
    ['Quần baggy', 'bottom'],
    ['Quần âu', 'bottom'],
    ['Quần jeans', 'bottom'],
    ['Quần kaki', 'bottom'],
    ['Quần thể thao', 'bottom'],
    ['Chân váy', 'bottom'],
    ['Đầm', 'dress'],
    ['Bộ thể thao', 'dress'],
    ['Đồ bộ', 'dress'],
    ['Giày cao gót', 'shoes'],
    ['Giày lười', 'shoes'],
    ['Giày thể thao', 'shoes'],
    ['Sandal', 'shoes'],
    ['Giày / Dép khác', 'shoes'],
  ] as const)('maps the current catalog category %s to %s', (categoryName, expectedRole) => {
    expect(inferRole({ name: 'Sản phẩm catalog', category: { name: categoryName } })).toBe(expectedRole);
  });

  it('infers footwear from the full category hierarchy when a leaf name is generic', () => {
    const categories = [
      { _id: 'female', name: 'Thời trang nữ', gender: 'female' as const },
      { _id: 'shoes', name: 'Giày / Dép', parent_id: 'female', gender: 'male' as const },
      { _id: 'other', name: 'Khác', parent_id: 'shoes', gender: 'male' as const },
    ];

    expect(inferRoleFromCategoryHierarchy({
      name: 'Mẫu da tối giản',
      category: categories[2],
    }, categories)).toBe('shoes');
  });

  it('uses the root category gender when stale descendants contain the wrong gender', () => {
    const categories = [
      { _id: 'female', name: 'Thời trang nữ', gender: 'female' as const },
      { _id: 'shoes', name: 'Giày / Dép', parent_id: 'female', gender: 'male' as const },
    ];

    expect(getTryOnCategoryGender(categories[1], categories)).toBe('female');
  });

  it('recognizes full outfit products from product or category text', () => {
    expect(isFullOutfitProduct({ name: 'Set bo ao quan linen', category: { name: 'Ao' } })).toBe(true);
    expect(isFullOutfitProduct({ name: 'Ao so mi trang', category: { name: 'Bo do' } })).toBe(true);
    expect(isFullOutfitProduct({ name: 'Ao bomber den', category: { name: 'Ao khoac' } })).toBe(false);
    expect(isFullOutfitProduct({ name: 'Dam bo sat body', category: { name: 'Dam' } })).toBe(false);
  });
});
