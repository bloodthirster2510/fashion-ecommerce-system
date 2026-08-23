import type { ManagedProduct } from '../catalog/products/product.types'

export type RecommendationProductCandidate = {
  product: ManagedProduct
  isPinned: boolean
}

const normalizeSearchText = (value: string) => value
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/đ/g, 'd')
  .replace(/Đ/g, 'd')
  .toLocaleLowerCase('vi-VN')
  .replace(/[^a-z0-9]+/g, ' ')
  .trim()

const getSearchFields = (product: ManagedProduct) => ({
  name: normalizeSearchText(product.name),
  brand: normalizeSearchText(product.brandName),
  category: normalizeSearchText(product.categoryName),
  skus: product.variants.flatMap((variant) =>
    variant.colors.flatMap((color) => color.inventory.map((item) => normalizeSearchText(item.sku))),
  ),
})

const getMatchScore = (product: ManagedProduct, keyword: string) => {
  const fields = getSearchFields(product)
  const searchableText = [fields.name, fields.brand, fields.category, ...fields.skus].join(' ')
  const tokens = keyword.split(' ').filter(Boolean)

  if (!tokens.every((token) => searchableText.includes(token))) return -1

  let score = tokens.length
  if (fields.skus.some((sku) => sku === keyword)) score += 120
  if (fields.name === keyword) score += 110
  else if (fields.name.startsWith(keyword)) score += 90
  else if (fields.name.includes(keyword)) score += 70

  if (fields.brand === keyword) score += 60
  else if (fields.brand.includes(keyword)) score += 40
  if (fields.category === keyword) score += 50
  else if (fields.category.includes(keyword)) score += 30

  return score
}

export const getRecommendationProductCandidates = (
  products: ManagedProduct[],
  pinnedIds: ReadonlySet<string>,
  search: string,
  limit = 10,
): RecommendationProductCandidate[] => {
  const keyword = normalizeSearchText(search)

  if (!keyword) {
    return products
      .filter((product) => !pinnedIds.has(product._id))
      .slice(0, limit)
      .map((product) => ({ product, isPinned: false }))
  }

  return products
    .map((product) => ({
      product,
      isPinned: pinnedIds.has(product._id),
      score: getMatchScore(product, keyword),
    }))
    .filter((candidate) => candidate.score >= 0)
    .sort((left, right) => (
      right.score - left.score
      || left.product.name.localeCompare(right.product.name, 'vi-VN')
    ))
    .slice(0, limit)
    .map(({ product, isPinned }) => ({ product, isPinned }))
}
