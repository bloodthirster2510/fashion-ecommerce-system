import type {
  CatalogProductDetail,
  ProductDetailVariant,
} from '../catalogApi';
import { CatalogApiError } from '../catalogApi';
import {
  getAvailableQuantityForSize,
  getInitialProductSelection,
  getProductDetailErrorMessage,
  getSelectableVariants,
  isColorAvailable,
  isSizeAvailableForColor,
  isVariantAvailable,
} from '../productDetailSelection';

const makeVariant = (overrides: Partial<ProductDetailVariant> = {}): ProductDetailVariant => ({
  _id: 'variant-active',
  fitTypeId: 'regular',
  fitType: null,
  price: 49_000,
  originalPrice: 49_000,
  discount: 10,
  finalPrice: 44_100,
  isSale: true,
  isActive: true,
  colors: [
    { _id: 'black', color: 'Đen', image: 'https://example.test/black.png' },
    { _id: 'beige', color: 'Be', image: 'https://example.test/beige.png' },
  ],
  sizes: [
    { size: 'S', isAvailable: true, availableQuantity: 10, measurements: [] },
    { size: 'M', isAvailable: true, availableQuantity: 8, measurements: [] },
  ],
  inventory: [
    { colorVariantId: 'black', size: 'S', sku: 'BL-S', availableQuantity: 0, isAvailable: false },
    { colorVariantId: 'black', size: 'M', sku: 'BL-M', availableQuantity: 0, isAvailable: false },
    { colorVariantId: 'beige', size: 'S', sku: 'BE-S', availableQuantity: 10, isAvailable: true },
    { colorVariantId: 'beige', size: 'M', sku: 'BE-M', availableQuantity: 0, isAvailable: false },
  ],
  ...overrides,
});

const makeProduct = (variants: ProductDetailVariant[]): CatalogProductDetail => ({
  _id: 'product-1',
  name: 'Quần âu',
  description: 'Mô tả sản phẩm',
  productImage: 'https://example.test/product.png',
  gallery: [],
  price: 49_000,
  originalPrice: 49_000,
  discount: 10,
  finalPrice: 44_100,
  isSale: true,
  isNew: false,
  isAvailable: true,
  soldQuantity: 0,
  averageRating: 0,
  reviewCount: 0,
  brand: null,
  category: null,
  categoryBreadcrumb: [],
  variants,
  selectedVariantId: variants[0]?._id,
  colors: variants.flatMap((variant) => variant.colors),
  sizes: variants.flatMap((variant) => variant.sizes.map((size) => size.size)),
  ratingSummary: { averageRating: 0, reviewCount: 0, distribution: [] },
  policies: [],
});

describe('mobile product detail selection', () => {
  it('starts from a color and size that are actually in stock', () => {
    const selection = getInitialProductSelection(makeProduct([makeVariant()]));

    expect(selection.variant?._id).toBe('variant-active');
    expect(selection.color?._id).toBe('beige');
    expect(selection.size).toBe('S');
  });

  it('uses stock for the selected color instead of the aggregate size stock', () => {
    const variant = makeVariant();
    const medium = variant.sizes.find((size) => size.size === 'M')!;

    expect(medium.isAvailable).toBe(true);
    expect(getAvailableQuantityForSize(variant, 'beige', medium)).toBe(0);
    expect(isSizeAvailableForColor(variant, 'beige', medium)).toBe(false);
  });

  it('marks a color unavailable when all of its sizes are sold out', () => {
    const variant = makeVariant();

    expect(isColorAvailable(variant, 'black')).toBe(false);
    expect(isColorAvailable(variant, 'beige')).toBe(true);
  });

  it('marks active variants unavailable when every color is sold out', () => {
    const soldOut = makeVariant({
      inventory: makeVariant().inventory.map((item) => ({
        ...item,
        availableQuantity: 0,
        isAvailable: false,
      })),
    });

    expect(isVariantAvailable(soldOut)).toBe(false);
    expect(isVariantAvailable(makeVariant())).toBe(true);
  });

  it('matches inventory sizes without casing or whitespace errors', () => {
    const variant = makeVariant({
      inventory: [
        { colorVariantId: 'beige', size: ' m ', sku: 'BE-M', availableQuantity: 3, isAvailable: true },
      ],
    });
    const medium = variant.sizes.find((size) => size.size === 'M')!;

    expect(getAvailableQuantityForSize(variant, 'beige', medium)).toBe(3);
  });

  it('does not select inactive variants', () => {
    const inactive = makeVariant({ _id: 'inactive', isActive: false });
    const active = makeVariant({ _id: 'active' });
    const product = makeProduct([inactive, active]);
    product.selectedVariantId = inactive._id;

    expect(getSelectableVariants(product).map((variant) => variant._id)).toEqual(['active']);
    expect(getInitialProductSelection(product).variant?._id).toBe('active');
    expect(getInitialProductSelection(makeProduct([inactive])).variant).toBeUndefined();
  });

  it('maps API failures to safe mobile messages', () => {
    expect(getProductDetailErrorMessage(new CatalogApiError('Invalid product id', undefined, 400))).toBe(
      'Đường dẫn sản phẩm không hợp lệ.',
    );
    expect(getProductDetailErrorMessage(new CatalogApiError('Product not found', undefined, 404))).toBe(
      'Sản phẩm không tồn tại hoặc đã ngừng bán.',
    );
    expect(getProductDetailErrorMessage(new Error('socket hang up'))).toBe(
      'Không tải được chi tiết sản phẩm. Bạn thử lại sau nha.',
    );
  });
});
