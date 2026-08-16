import { expect, test } from '@playwright/test'
import type { ManagedProduct } from '../catalog/products/product.types'
import { getRecommendationProductCandidates } from './recommendationMerchandisingSearch'

const product = (
  id: string,
  name: string,
  brandName: string,
  categoryName: string,
  sku = `${id}-M`,
): ManagedProduct => ({
  _id: id,
  name,
  productImage: '',
  isActive: true,
  soldQuantity: 0,
  brandName,
  categoryName,
  canDeletePermanently: true,
  variants: [{
    _id: `${id}-variant`,
    fitTypeId: 'regular',
    fitTypeLabel: 'Regular',
    price: 100_000,
    discount: 0,
    isActive: true,
    colors: [{
      _id: `${id}-color`,
      color: 'Đen',
      image: '',
      isActive: true,
      inventory: [{ size: 'M', sku, availableQuantity: 5 }],
    }],
  }],
})

const products = [
  product('heels', 'Giày cao gót nữ', 'IVY moda', 'Giày / Dép', 'IVY-HEEL-39'),
  product('shirt', 'Áo sơ mi nam', 'YODY', 'Áo sơ mi', 'YODY-SHIRT-M'),
  product('sneaker', 'Sneaker năng động', 'Coolmate', 'Giày thể thao', 'COOL-SNK-42'),
]

test.describe('recommendation merchandising product search', () => {
  test('matches Vietnamese text when the admin types without accents', () => {
    const result = getRecommendationProductCandidates(products, new Set(), 'giay cao got')

    expect(result.map(({ product: item }) => item._id)).toEqual(['heels'])
  })

  test('matches words across product, brand and category fields', () => {
    const result = getRecommendationProductCandidates(products, new Set(), 'ivy giay')

    expect(result.map(({ product: item }) => item._id)).toEqual(['heels'])
  })

  test('supports an exact SKU and ranks an exact product name first', () => {
    expect(getRecommendationProductCandidates(products, new Set(), 'ivy-heel-39')[0].product._id).toBe('heels')

    const ranked = getRecommendationProductCandidates([
      product('exact', 'Áo sơ mi', 'Brand A', 'Áo'),
      product('longer', 'Áo sơ mi tay dài', 'Brand B', 'Áo'),
    ], new Set(), 'ao so mi')

    expect(ranked.map(({ product: item }) => item._id)).toEqual(['exact', 'longer'])
  })

  test('shows matching pinned products as already pinned but omits them from the default list', () => {
    const pinnedIds = new Set(['heels'])

    expect(getRecommendationProductCandidates(products, pinnedIds, '')
      .some(({ product: item }) => item._id === 'heels')).toBe(false)
    expect(getRecommendationProductCandidates(products, pinnedIds, 'giay')[0]).toMatchObject({
      product: { _id: 'heels' },
      isPinned: true,
    })
  })
})
