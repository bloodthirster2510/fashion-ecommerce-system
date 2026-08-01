import { expect, test } from '@playwright/test'
import type { ProductDetail, ProductVariant } from './catalog.types'
import {
  findInventoryForSelection,
  getInitialProductSelection,
  getProductDetailErrorMessage,
  getSelectableProductVariants,
  isColorAvailable,
  isSizeAvailableForColor,
} from './productDetailSelection'

const makeVariant = (overrides: Partial<ProductVariant> = {}): ProductVariant => ({
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
    { _id: 'beige', color: 'Be', image: 'https://example.test/beige.png' },
    { _id: 'black', color: 'Đen', image: 'https://example.test/black.png' },
  ],
  sizes: [
    { size: 'S', isAvailable: true, availableQuantity: 10, measurements: [] },
    { size: 'M', isAvailable: true, availableQuantity: 8, measurements: [] },
  ],
  inventory: [
    { colorVariantId: 'beige', size: 'S', sku: 'BE-S', availableQuantity: 10, isAvailable: true },
    { colorVariantId: 'beige', size: 'M', sku: 'BE-M', availableQuantity: 0, isAvailable: false },
    { colorVariantId: 'black', size: 'S', sku: 'BL-S', availableQuantity: 0, isAvailable: false },
    { colorVariantId: 'black', size: 'M', sku: 'BL-M', availableQuantity: 0, isAvailable: false },
  ],
  ...overrides,
})

const makeProduct = (variants: ProductVariant[]): ProductDetail => ({
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
})

test.describe('product detail inventory selection', () => {
  test('selects an actually stocked color and size on initial load', () => {
    const variant = makeVariant({
      colors: [
        { _id: 'black', color: 'Đen', image: 'https://example.test/black.png' },
        { _id: 'beige', color: 'Be', image: 'https://example.test/beige.png' },
      ],
    })

    const selection = getInitialProductSelection(makeProduct([variant]))

    expect(selection.variant?._id).toBe('variant-active')
    expect(selection.color?._id).toBe('beige')
    expect(selection.size).toBe('S')
  })

  test('checks size availability for the selected color instead of aggregate variant stock', () => {
    const variant = makeVariant()

    expect(variant.sizes.find((size) => size.size === 'M')?.isAvailable).toBe(true)
    expect(isSizeAvailableForColor(variant, 'beige', 'M')).toBe(false)
    expect(isSizeAvailableForColor(variant, 'beige', 'S')).toBe(true)
  })

  test('disables a color when every size for that color is sold out', () => {
    const variant = makeVariant()

    expect(isColorAvailable(variant, 'black')).toBe(false)
    expect(isColorAvailable(variant, 'beige')).toBe(true)
  })

  test('matches legacy inventory size casing safely', () => {
    const variant = makeVariant({
      inventory: [
        { colorVariantId: 'beige', size: 'm', sku: 'BE-M', availableQuantity: 3, isAvailable: true },
      ],
    })

    expect(findInventoryForSelection(variant, 'beige', ' M ')?.sku).toBe('BE-M')
    expect(isSizeAvailableForColor(variant, 'beige', 'M')).toBe(true)
  })

  test('never exposes inactive variants as selectable customer options', () => {
    const inactive = makeVariant({ _id: 'variant-inactive', isActive: false })
    const active = makeVariant({ _id: 'variant-active' })
    const product = makeProduct([inactive, active])
    product.selectedVariantId = inactive._id

    expect(getSelectableProductVariants(product.variants).map((variant) => variant._id)).toEqual(['variant-active'])
    expect(getInitialProductSelection(product).variant?._id).toBe('variant-active')
  })

  test('keeps selection empty when every variant is inactive', () => {
    const inactive = makeVariant({ isActive: false })
    const selection = getInitialProductSelection(makeProduct([inactive]))

    expect(selection).toEqual({ variant: undefined, color: undefined, size: '' })
  })

  test('does not expose backend errors directly on invalid or missing product URLs', () => {
    expect(getProductDetailErrorMessage(new Error('Invalid product id'))).toBe('Đường dẫn sản phẩm không hợp lệ.')
    expect(getProductDetailErrorMessage(new Error('Product not found'))).toBe(
      'Không tìm thấy sản phẩm hoặc sản phẩm đã ngừng bán.',
    )
    expect(getProductDetailErrorMessage(new Error('socket hang up'))).toBe(
      'Không thể tải chi tiết sản phẩm. Vui lòng thử lại sau.',
    )
  })
})
