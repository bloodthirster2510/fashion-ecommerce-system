export type CatalogGender = 'male' | 'female' | 'unisex'

export type ManagedCategory = {
  _id: string
  name: string
  parent_id?: string | null
  level: number
  gender: CatalogGender
  image: string
  description: string
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

export type BrandInput = {
  name: string
  image: string
  isActive: boolean
}
