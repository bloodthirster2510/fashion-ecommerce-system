import { mergeTryOnQueueItems } from '../TryOnQueueProvider';
import { TRY_ON_QUEUE_LIMIT, type TryOnSeedItem } from '../virtualTryOn.types';

const seed = (index: number): TryOnSeedItem => ({
  productId: `product-${index}`,
  variantId: `variant-${index}`,
  colorVariantId: `color-${index}`,
  size: 'M',
});

describe('mergeTryOnQueueItems', () => {
  it('deduplicates the same product selection', () => {
    expect(mergeTryOnQueueItems([seed(1)], [seed(1), seed(2)])).toEqual([seed(1), seed(2)]);
  });

  it('does not duplicate a selection when it comes from both product detail and cart', () => {
    expect(mergeTryOnQueueItems([seed(1)], [{ ...seed(1), cartItemId: 'cart-item-1' }])).toEqual([seed(1)]);
  });

  it('keeps the queue within its configured limit', () => {
    const incoming = Array.from({ length: TRY_ON_QUEUE_LIMIT + 2 }, (_, index) => seed(index));
    expect(mergeTryOnQueueItems([], incoming)).toHaveLength(TRY_ON_QUEUE_LIMIT);
  });
});
