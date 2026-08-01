import {
  CatalogApiError,
  type CatalogProductDetail,
  type ProductDetailColor,
  type ProductDetailSize,
  type ProductDetailVariant,
} from './catalogApi';

const fallbackQuantityLimit = 99;

export const getSelectableVariants = (product: CatalogProductDetail) =>
  product.variants.filter((variant) => variant.isActive);

export const getInventoryForSelection = (
  variant?: ProductDetailVariant,
  colorVariantId?: string,
  size?: string,
) => {
  if (!variant || !colorVariantId || !size?.trim()) {
    return undefined;
  }

  const normalizedSize = size.trim().toLowerCase();
  return variant.inventory?.find((item) =>
    item.colorVariantId === colorVariantId &&
    item.size.trim().toLowerCase() === normalizedSize,
  );
};

export const getAvailableQuantityForSize = (
  variant: ProductDetailVariant | undefined,
  colorVariantId: string | undefined,
  sizeOption: ProductDetailSize,
) => {
  const inventory = getInventoryForSelection(variant, colorVariantId, sizeOption.size);

  if (variant && Array.isArray(variant.inventory) && colorVariantId) {
    return Math.max(0, inventory?.availableQuantity ?? 0);
  }

  return Math.max(
    0,
    sizeOption.availableQuantity ?? (sizeOption.isAvailable ? fallbackQuantityLimit : 0),
  );
};

export const isSizeAvailableForColor = (
  variant: ProductDetailVariant | undefined,
  colorVariantId: string | undefined,
  sizeOption: ProductDetailSize,
) => Boolean(
  variant?.isActive &&
  getAvailableQuantityForSize(variant, colorVariantId, sizeOption) > 0,
);

export const isColorAvailable = (
  variant: ProductDetailVariant | undefined,
  colorVariantId: string,
) => Boolean(
  variant?.isActive &&
  variant.sizes.some((size) => isSizeAvailableForColor(variant, colorVariantId, size)),
);

export const isVariantAvailable = (variant: ProductDetailVariant | undefined) => Boolean(
  variant?.isActive && variant.colors.some((color) => isColorAvailable(variant, color._id)),
);

export const getFirstAvailableSize = (
  variant?: ProductDetailVariant,
  colorVariantId?: string,
) => variant?.sizes.find((size) =>
  isSizeAvailableForColor(variant, colorVariantId, size),
)?.size;

const getFirstAvailableColor = (variant?: ProductDetailVariant) =>
  variant?.colors.find((color) => isColorAvailable(variant, color._id));

export const getInitialProductSelection = (product: CatalogProductDetail): {
  variant?: ProductDetailVariant;
  color?: ProductDetailColor;
  size?: string;
} => {
  const variants = getSelectableVariants(product);
  const preferredVariant = variants.find((variant) => variant._id === product.selectedVariantId);
  const variant =
    (isVariantAvailable(preferredVariant) ? preferredVariant : undefined) ??
    variants.find(isVariantAvailable) ??
    preferredVariant ??
    variants[0];
  const color = getFirstAvailableColor(variant) ?? variant?.colors[0];

  return {
    variant,
    color,
    size: color ? getFirstAvailableSize(variant, color._id) : undefined,
  };
};

export const getProductDetailErrorMessage = (error: unknown) => {
  if (error instanceof CatalogApiError) {
    if (error.status === 400) return 'Đường dẫn sản phẩm không hợp lệ.';
    if (error.status === 404) return 'Sản phẩm không tồn tại hoặc đã ngừng bán.';
  }

  return 'Không tải được chi tiết sản phẩm. Bạn thử lại sau nha.';
};
