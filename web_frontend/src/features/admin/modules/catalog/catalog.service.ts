import { requestAdmin } from '../../services/adminHttp'
import type {
  BrandInput,
  CategoryInput,
  ManagedBrand,
  ManagedCategory,
  SizeTemplateInput,
} from './catalog.types'

const toCategoryFormData = (
  input: CategoryInput,
  imageFile?: File | null,
  options: { includeImage?: boolean } = {},
) => {
  const { includeImage = true } = options
  const formData = new FormData()
  formData.set('name', input.name)
  formData.set('parent_id', input.parent_id ?? '')
  formData.set('level', String(input.level))
  formData.set('gender', input.gender)
  if (includeImage) formData.set('image', input.image)
  formData.set('description', input.description)
  formData.set('isActive', String(input.isActive))
  if (imageFile) formData.set('image', imageFile)
  return formData
}

const toBrandFormData = (
  input: BrandInput,
  imageFile?: File | null,
  options: { includeImage?: boolean } = {},
) => {
  const { includeImage = true } = options
  const formData = new FormData()
  formData.set('name', input.name)
  if (includeImage) formData.set('image', input.image)
  formData.set('isActive', String(input.isActive))
  if (imageFile) formData.set('image', imageFile)
  return formData
}

export const listManagedCategories = () =>
  requestAdmin<ManagedCategory[]>('/admin/categories/management')

export const createManagedCategory = (
  input: CategoryInput,
  imageFile?: File | null,
) =>
  requestAdmin<ManagedCategory>('/admin/categories', {
    method: 'POST',
    body: toCategoryFormData(input, imageFile),
  })

export const updateManagedCategory = (
  categoryId: string,
  input: CategoryInput,
  imageFile?: File | null,
) =>
  requestAdmin<ManagedCategory>(`/admin/categories/${categoryId}`, {
    method: 'PUT',
    body: toCategoryFormData(input, imageFile, {
      includeImage: Boolean(imageFile) || Boolean(input.image.trim()),
    }),
  })

export const upsertManagedCategorySizeTemplate = (
  categoryId: string,
  input: SizeTemplateInput,
) =>
  requestAdmin<ManagedCategory>(`/admin/categories/${categoryId}/size-template`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  })

export const deleteManagedCategory = (
  categoryId: string,
  options: { cascadeProducts?: boolean } = {},
) =>
  requestAdmin<ManagedCategory>(`/admin/categories/${categoryId}${options.cascadeProducts ? '?cascadeProducts=true' : ''}`, {
    method: 'DELETE',
  })

export const deleteManagedCategoryPermanently = (categoryId: string) =>
  requestAdmin<ManagedCategory[]>(`/admin/categories/${categoryId}/permanent`, {
    method: 'DELETE',
  })

export const listManagedBrands = () =>
  requestAdmin<ManagedBrand[]>('/admin/brands/management')

export const createManagedBrand = (input: BrandInput, imageFile?: File | null) =>
  requestAdmin<ManagedBrand>('/admin/brands', {
    method: 'POST',
    body: toBrandFormData(input, imageFile),
  })

export const updateManagedBrand = (brandId: string, input: BrandInput, imageFile?: File | null) =>
  requestAdmin<ManagedBrand>(`/admin/brands/${brandId}`, {
    method: 'PUT',
    body: toBrandFormData(input, imageFile, {
      includeImage: Boolean(imageFile) || Boolean(input.image.trim()),
    }),
  })

export const deleteManagedBrand = (brandId: string) =>
  requestAdmin<ManagedBrand>(`/admin/brands/${brandId}`, {
    method: 'DELETE',
  })

export const deleteManagedBrandPermanently = (brandId: string) =>
  requestAdmin<ManagedBrand>(`/admin/brands/${brandId}/permanent`, {
    method: 'DELETE',
  })
