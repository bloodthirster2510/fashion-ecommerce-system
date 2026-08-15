export type CategoryGender = 'male' | 'female' | 'unisex'

export type CatalogCategory = {
  _id: string
  name: string
  parent_id?: string | { _id: string } | null
  level: number
  gender: CategoryGender
  image: string
  description: string
  isLeaf: boolean
  isActive: boolean
  fitTypes?: CatalogFitType[]
}

export type CatalogFitType = {
  _id: string
  key: string
  label: string
  sortOrder: number
  isActive: boolean
}

export type ProductSortOption =
  | 'relevance'
  | 'name_asc'
  | 'name_desc'
  | 'price_asc'
  | 'price_desc'
  | 'newest'
  | 'best_seller'
  | 'rating_desc'

export type ProductListQuery = {
  keyword?: string
  visualText?: string
  gender?: Exclude<CategoryGender, 'unisex'>
  categoryId?: string
  brandId?: string
  color?: string[]
  fitType?: string[]
  size?: string[]
  minPrice?: number
  maxPrice?: number
  isSale?: boolean
  isNew?: boolean
  sort?: ProductSortOption
  page?: number
  limit?: number
}

export type ProductListItem = {
  _id: string
  name: string
  image: string
  price: number
  originalPrice: number
  discount: number
  finalPrice: number
  isSale: boolean
  isNew: boolean
  isAvailable: boolean
  soldQuantity: number
  averageRating: number
  reviewCount: number
  isFavorited?: boolean
  brand: {
    _id: string
    name: string
    image?: string
  } | null
  category: {
    _id: string
    name: string
    gender?: CategoryGender
    image?: string
  } | null
}

export type SearchSuggestProduct = {
  _id: string
  name: string
  image: string
  price: number
  discount: number
  finalPrice: number
  brandName?: string
}

export type SearchSuggestCategory = {
  _id: string
  name: string
  gender: CategoryGender
}

export type SearchSuggestResponse = {
  products: SearchSuggestProduct[]
  categories: SearchSuggestCategory[]
  keywords: string[]
}

export type VisualSearchProductItem = ProductListItem & {
  visualScore: number
  finalVisualScore: number
  matchedImage: string
  matchedGalleryImageId: string
  matchedVariantId?: string
  matchedColorVariantId?: string
  matchedColor?: string | null
  matchedSource: 'product_image' | 'color_variant_image'
}

export type ProductListResponse = {
  items: ProductListItem[]
  pagination: {
    page: number
    limit: number
    totalItems: number
    totalPages: number
  }
  filters?: ProductListFilters
}

export type VisualSearchResponse = {
  items: VisualSearchProductItem[]
  pagination: {
    page: 1
    limit: number
    totalItems: number
    totalPages: 1
  }
  query: {
    searchType: 'image' | 'text'
    model: string
    modelVersion: string
    provider: 'mock' | 'http'
    processingTimeMs: number
    embeddingTimeMs: number
    searchTimeMs: number
    hydrateTimeMs: number
    scoreThreshold: number
    candidateCount: number
  }
}

export type ProductListFilters = {
  brands: Array<{ _id: string; name: string; image?: string }>
  colors: string[]
  fitTypes: string[]
  sizes: string[]
  categories: Array<{
    _id: string
    name: string
    gender?: CategoryGender
    parent_id?: string | null
    level?: number
    image?: string
  }>
}

export type ProductMeasurementValue = {
  key: string
  value: number
}

export type ProductSizeMeasurement = {
  size: string
  measurements: ProductMeasurementValue[]
  isAvailable: boolean
  availableQuantity?: number
}

export type ProductColorVariant = {
  _id: string
  color: string
  colorCode?: string
  image: string
  isActive: boolean
}

export type ProductVariant = {
  _id: string
  fitTypeId: string
  fitType: {
    _id: string
    key: string
    label: string
  } | null
  price: number
  originalPrice: number
  discount: number
  finalPrice: number
  isSale: boolean
  sizes: ProductSizeMeasurement[]
  colors: ProductColorVariant[]
  isActive: boolean
  inventory: ProductSourceInventory[]
}

export type ProductSourceInventory = {
  colorVariantId: string
  sku: string
  size: string
  availableQuantity: number
  isAvailable: boolean
}

export type ProductDetail = {
  _id: string
  name: string
  description: string
  productImage: string
  gallery: string[]
  price: number
  originalPrice: number
  discount: number
  finalPrice: number
  isSale: boolean
  isNew: boolean
  isAvailable: boolean
  soldQuantity: number
  averageRating: number
  reviewCount: number
  brand: {
    _id: string
    name: string
    image?: string
  } | null
  category: {
    _id: string
    name: string
    gender?: CategoryGender
    image?: string
  } | null
  categoryBreadcrumb: Array<{
    _id: string
    name: string
    gender?: CategoryGender
    parent_id?: string | null
    level?: number
  }>
  sizeGuideImage?: string
  variants: ProductVariant[]
  selectedVariantId?: string
  colors: ProductColorVariant[]
  sizes: string[]
  ratingSummary: {
    averageRating: number
    reviewCount: number
    distribution: Array<{ rating: 1 | 2 | 3 | 4 | 5; count: number; percent: number }>
  }
  policies: Array<{ icon: string; title: string; description: string }>
}
