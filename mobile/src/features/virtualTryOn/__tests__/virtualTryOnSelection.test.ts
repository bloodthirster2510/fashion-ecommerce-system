import type { TryOnItemRole, TryOnSelectedItem } from '../virtualTryOn.types';
import {
  getOutfitSlots,
  getPrefillOutfitMode,
  getQueueSlotGroups,
  inferRole,
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

describe('virtualTryOnSelection', () => {
  it('keeps only one active item per slot and queues duplicate tops', () => {
    const topA = item('top-a', 'top');
    const topB = item('top-b', 'top');
    const bottom = item('bottom', 'bottom');

    const mode = getPrefillOutfitMode([topA, topB, bottom]);
    const normalized = normalizeSelectionForMode([topA, topB, bottom], mode);

    expect(mode).toBe('top_bottom');
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

  it('replaces the active item in the matching slot when selecting from queue', () => {
    const topA = item('top-a', 'top');
    const topB = item('top-b', 'top');
    const bottom = item('bottom', 'bottom');
    const topSlot = getOutfitSlots('top_bottom')[0];

    const selected = selectItemForSlot([topA, bottom], topB, topSlot, 'top_bottom');

    expect(selected.map((entry) => entry.productId)).toEqual(['bottom', 'top-b']);
  });

  it('groups queued items by try-on slot', () => {
    const groups = getQueueSlotGroups([
      item('top-a', 'top'),
      item('top-b', 'top'),
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
});
