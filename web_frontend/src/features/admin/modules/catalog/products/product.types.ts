export type ProductInventoryItem = {
  size: string
  sku: string
  availableQuantity: number
}

export type ProductColor = {
  _id: string
  color: string
  colorCode?: string
  image: string
  inventory: ProductInventoryItem[]
}

export type ProductVariant = {
  _id: string
  fitTypeId: string
  fitTypeLabel: string
  price: number
  discount: number
  isActive: boolean
  colors: ProductColor[]
}

export type ManagedProduct = {
  _id: string
  name: string
  productImage: string
  isActive: boolean
  soldQuantity: number
  brandName: string
  categoryName: string
  canDeletePermanently: boolean
  permanentDeleteBlockReason?: string
  variants: ProductVariant[]
}

export type ProductCategoryOption = {
  _id: string
  name: string
  level: number
  gender: 'male' | 'female' | 'unisex'
  isActive: boolean
}

export type ProductBrandOption = {
  _id: string
  name: string
  isActive: boolean
}

export type ProductMeasurementField = {
  key: string
  label: string
  unit: string
  required: boolean
  sortOrder: number
}

export type ProductFitTypeOption = {
  _id: string
  key: string
  label: string
  sortOrder: number
  isActive: boolean
}

export type ProductCategoryTemplate = {
  category: ProductCategoryOption
  templateSource: ProductCategoryOption & {
    sizes: string[]
    measurementFields: ProductMeasurementField[]
    fitTypes: ProductFitTypeOption[]
  }
}

export type ProductVariantInput = {
  _id?: string
  fitTypeId: string
  price: number
  discount: number
  sizeMeasurements: Array<{
    size: string
    measurements: Array<{ key: string; value: number }>
  }>
  colors: Array<{
    _id?: string
    color: string
    colorCode?: string
    image: string
  }>
  isActive: boolean
}

export type CreateProductInput = {
  category_id: string
  name: string
  brand_id: string
  description: string
  product_image: string
  isActive: boolean
  variant: ProductVariantInput[]
}

export type ProductDetailResponse = {
  _id: string
  name: string
  description: string
  productImage: string
  isActive: boolean
  brand: {
    _id: string
    name: string
    image?: string
  } | null
  category: {
    _id: string
    name: string
    gender?: ProductCategoryOption['gender']
    image?: string
  } | null
  variants: Array<{
    _id: string
    fitTypeId: string
    price: number
    discount: number
    isActive: boolean
    colors: Array<{
      _id: string
      color: string
      colorCode?: string
      image: string
    }>
    sizes: Array<{
      size: string
      measurements: Array<{
        key: string
        value: number
      }>
    }>
  }>
}

export type ProductImageFileInput = {
  index: number
  file: File
}
