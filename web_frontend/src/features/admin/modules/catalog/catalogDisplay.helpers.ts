import type { CatalogGender, ManagedCategory } from './catalog.types'

export type CatalogStatusFilter = 'all' | 'active' | 'inactive'
export type CatalogDeleteMode = 'soft' | 'permanent'

export const genderLabels: Record<CatalogGender, string> = {
  male: 'Nam',
  female: 'Nữ',
  unisex: 'Unisex',
}

export const getSizeTemplateLabel = (category?: ManagedCategory | null) =>
  category?.sizeTemplateName?.trim() || category?.name || ''

export const getFitTypeTemplateLabel = (category?: ManagedCategory | null) =>
  category?.fitTypeTemplateName?.trim() || category?.name || ''
