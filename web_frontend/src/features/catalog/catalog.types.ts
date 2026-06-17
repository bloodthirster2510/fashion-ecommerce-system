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
  | 'name_asc'
  | 'name_desc'
  | 'price_asc'
  | 'price_desc'
  | 'newest'
  | 'best_seller'
  | 'rating_desc'

export type ProductListQuery = {
  keyword?: string
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

export type ProductListResponse = {
  items: ProductListItem[]
  pagination: {
    page: number
    limit: number
    totalItems: number
    totalPages: number
  }
  filters: {
    brands: Array<{ _id: string; name: string; image?: string }>
    colors: string[]
    fitTypes: string[]
    categories: Array<{
      _id: string
      name: string
      gender?: CategoryGender
      parent_id?: string | null
      level?: number
      image?: string
    }>
  }
}

export type ProductMeasurementValue = {
  key: string
  value: number
}

export type ProductSizeMeasurement = {
  size: string
  measurements: ProductMeasurementValue[]
}

export type ProductColorVariant = {
  _id: string
  color: string
  colorCode?: string
  image: string
}

export type ProductVariant = {
  _id: string
  fitTypeId: string
  price: number
  discount: number
  sizeMeasurements: ProductSizeMeasurement[]
  colors: ProductColorVariant[]
  isActive: boolean
}

export type ProductSourceInventory = {
  sku: string
  color: string
  size: string
  quantity: number
}

export type ProductDetail = {
  _id: string
  category_id: CatalogCategory
  name: string
  brand_id: {
    _id: string
    name: string
    image?: string
    isActive?: boolean
  }
  variant: ProductVariant[]
  description: string
  product_image: string
  isActive: boolean
  sold_quantity: number
  averageRating: number
  reviewCount: number
  createdAt: string
  updatedAt: string
  source?: {
    sourceInventory?: ProductSourceInventory[]
    sourceProductId?: number
    sourceUrl?: string
    taxonomy?: {
      root?: { _id: string; name: string }
      group?: { _id: string; name: string }
      leaf?: { _id: string; name: string }
    }
  }
}
