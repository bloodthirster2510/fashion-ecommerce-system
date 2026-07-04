export type CatalogGender = 'male' | 'female' | 'unisex'

export type ManagedCategory = {
  _id: string
  name: string
  parent_id?: string | null
  level: number
  gender: CatalogGender
  image: string
  description: string
  isSizeTemplateSource?: boolean
  sizeTemplateName?: string
  sizeTemplateSourceId?: string | null
  sizes?: string[]
  measurementFields?: MeasurementFieldInput[]
  isActive: boolean
  productCount: number
  activeProductCount: number
}

export type ManagedBrand = {
  _id: string
  name: string
  image: string
  isActive: boolean
  productCount: number
}

export type CategoryInput = {
  name: string
  parent_id: string | null
  level: number
  gender: CatalogGender
  image: string
  description: string
  isActive: boolean
}

export type SizeTemplateInput = {
  name: string
  sizes: string[]
  measurementFields: MeasurementFieldInput[]
  categoryIds: string[]
  excludedCategoryIds?: string[]
}

export type MeasurementFieldInput = {
  key: string
  label: string
  unit: string
  required: boolean
  sortOrder: number
}

export type BrandInput = {
  name: string
  image: string
  isActive: boolean
}
