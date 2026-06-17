import { requestAdmin } from '../../../services/adminHttp'
import type {
  CreateProductInput,
  ManagedProduct,
  ProductDetailResponse,
  ProductImageFileInput,
  ProductBrandOption,
  ProductCategoryOption,
  ProductCategoryTemplate,
} from './product.types'

export const listManagedProducts = async () => {
  const controller = new AbortController()
  const timeoutId = window.setTimeout(() => controller.abort(), 30000)

  try {
    return await requestAdmin<ManagedProduct[]>('/admin/products', {
      signal: controller.signal,
    })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error('Tải sản phẩm quá lâu. Vui lòng thử lại.', { cause: error })
    }
    throw error
  } finally {
    window.clearTimeout(timeoutId)
  }
}

const toProductFormData = (
  input: CreateProductInput,
  productImageFile?: File | null,
  colorImageFiles: ProductImageFileInput[] = [],
) => {
  const formData = new FormData()
  formData.set('category_id', input.category_id)
  formData.set('name', input.name)
  formData.set('brand_id', input.brand_id)
  formData.set('description', input.description)
  formData.set('product_image', input.product_image)
  if (input.isActive !== undefined) {
    formData.set('isActive', String(input.isActive))
  }
  if (input.variant !== undefined) {
    formData.set('variant', JSON.stringify(input.variant))
  }
  if (productImageFile) formData.set('product_image', productImageFile)
  colorImageFiles.forEach(({ file, index }) => {
    formData.append('version_images', file)
    formData.append('version_image_indexes', String(index))
  })
  return formData
}

export const deleteManagedProduct = (productId: string) =>
  requestAdmin<unknown>(`/admin/products/${productId}`, {
    method: 'DELETE',
  })

export const permanentlyDeleteManagedProduct = (productId: string) =>
  requestAdmin<unknown>(`/admin/products/${productId}/permanent`, {
    method: 'DELETE',
  })

export const listProductCategories = () =>
  requestAdmin<ProductCategoryOption[]>('/categories?activeOnly=true')

export const listProductBrands = () =>
  requestAdmin<ProductBrandOption[]>('/brands')

export const getProductCategoryTemplate = (categoryId: string) =>
  requestAdmin<ProductCategoryTemplate>(`/categories/${categoryId}/product-template`)

export const getManagedProductDetail = (productId: string) =>
  requestAdmin<ProductDetailResponse>(`/admin/products/${productId}`)

export const createManagedProduct = (
  input: CreateProductInput,
  productImageFile?: File | null,
  colorImageFiles: ProductImageFileInput[] = [],
) =>
  requestAdmin<unknown>('/admin/products', {
    method: 'POST',
    body: toProductFormData(input, productImageFile, colorImageFiles),
  })

export const updateManagedProduct = (
  productId: string,
  input: CreateProductInput,
  productImageFile?: File | null,
  colorImageFiles: ProductImageFileInput[] = [],
) =>
  requestAdmin<unknown>(`/admin/products/${productId}`, {
    method: 'PUT',
    body: toProductFormData(input, productImageFile, colorImageFiles),
  })
