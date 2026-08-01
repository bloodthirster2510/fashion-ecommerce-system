import type {
  ProductColorVariant,
  ProductDetail,
  ProductSourceInventory,
  ProductVariant,
} from './catalog.types'

const normalizeSize = (size: string) => size.trim().toLowerCase()

export const getProductDetailErrorMessage = (error: unknown) => {
  const message = error instanceof Error ? error.message.trim().toLowerCase() : ''

  if (message === 'invalid product id') {
    return 'Đường dẫn sản phẩm không hợp lệ.'
  }

  if (message === 'product not found') {
    return 'Không tìm thấy sản phẩm hoặc sản phẩm đã ngừng bán.'
  }

  return 'Không thể tải chi tiết sản phẩm. Vui lòng thử lại sau.'
}

export const getSelectableProductVariants = (variants: ProductVariant[]) => {
  return variants.filter((variant) => variant.isActive)
}

export const findInventoryForSelection = (
  variant: ProductVariant | undefined,
  colorVariantId: string | undefined,
  size: string,
): ProductSourceInventory | undefined => {
  if (!variant || !colorVariantId || !size.trim()) return undefined

  const normalizedSize = normalizeSize(size)
  return variant.inventory.find(
    (item) =>
      item.colorVariantId === colorVariantId &&
      normalizeSize(item.size) === normalizedSize,
  )
}

export const isSizeAvailableForColor = (
  variant: ProductVariant,
  colorVariantId: string,
  size: string,
) => {
  const inventory = findInventoryForSelection(variant, colorVariantId, size)
  return Boolean(
    variant.isActive &&
    inventory?.isAvailable &&
    inventory.availableQuantity > 0,
  )
}

export const isColorAvailable = (variant: ProductVariant, colorVariantId: string) => {
  return variant.sizes.some((size) =>
    isSizeAvailableForColor(variant, colorVariantId, size.size),
  )
}

export const getFirstAvailableSizeForColor = (
  variant: ProductVariant,
  colorVariantId: string,
) => {
  return variant.sizes.find((size) =>
    isSizeAvailableForColor(variant, colorVariantId, size.size),
  )?.size ?? ''
}

const getFirstAvailableColor = (variant: ProductVariant) => {
  return variant.colors.find((color) => isColorAvailable(variant, color._id))
}

export const getInitialProductSelection = (product: ProductDetail): {
  variant?: ProductVariant
  color?: ProductColorVariant
  size: string
} => {
  const variants = getSelectableProductVariants(product.variants)
  const variantFromApi = variants.find((variant) => variant._id === product.selectedVariantId)
  const variant =
    (variantFromApi && getFirstAvailableColor(variantFromApi) ? variantFromApi : undefined) ??
    variants.find((item) => Boolean(getFirstAvailableColor(item))) ??
    variantFromApi ??
    variants[0]
  const color = variant
    ? getFirstAvailableColor(variant) ?? variant.colors[0]
    : undefined

  return {
    variant,
    color,
    size: variant && color ? getFirstAvailableSizeForColor(variant, color._id) : '',
  }
}
