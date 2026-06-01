import { Types } from 'mongoose';
import {
  Category,
  Inventory,
  Product,
  type IColorVariant,
  type ICategoryFitType,
  type IInventory,
  type IProduct,
  type IProductSizeMeasurement,
  type IProductVariant,
} from '../../database/models';

export class SalesServiceError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
    this.name = 'SalesServiceError';
  }
}

export type ResolvedSaleItem = {
  product: IProduct;
  variant: IProductVariant;
  color: IColorVariant;
  inventory: IInventory;
  productId: Types.ObjectId;
  variantId: Types.ObjectId;
  colorVariantId: Types.ObjectId;
  size: string;
  sku: string;
  finalPrice: number;
  fitType: string;
  image: string;
};

export const MAX_SALE_ITEM_QUANTITY = 99;

export const assertValidObjectId = (id: string, fieldName: string) => {
  if (!Types.ObjectId.isValid(id)) {
    throw new SalesServiceError(`Invalid ${fieldName}`, 400);
  }
};

export const toObjectId = (id: string, fieldName: string) => {
  assertValidObjectId(id, fieldName);
  return new Types.ObjectId(id);
};

export const toIdString = (value: Types.ObjectId | string | { toString(): string } | null | undefined) => {
  return value?.toString() ?? '';
};

export const assertPositiveQuantity = (quantity: number) => {
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > MAX_SALE_ITEM_QUANTITY) {
    throw new SalesServiceError(`quantity must be an integer between 1 and ${MAX_SALE_ITEM_QUANTITY}`, 400);
  }
};

export const getFinalPrice = (price: number, discount: number) => {
  if (discount <= 0) {
    return price;
  }

  return Math.round(price * (1 - discount / 100));
};

const getFitTypeLabel = async (product: IProduct, variant: IProductVariant) => {
  const category = await Category.findById(product.category_id).lean();
  const fitType = category?.fitTypes?.find((item: ICategoryFitType) => toIdString(item._id) === toIdString(variant.fitTypeId));

  return fitType?.label ?? toIdString(variant.fitTypeId);
};

export const resolveSaleItem = async (
  productIdValue: string,
  variantIdValue: string,
  colorVariantIdValue: string,
  sizeValue: string,
  quantity: number,
): Promise<ResolvedSaleItem> => {
  assertPositiveQuantity(quantity);

  const productId = toObjectId(productIdValue, 'productId');
  const variantId = toObjectId(variantIdValue, 'variantId');
  const colorVariantId = toObjectId(colorVariantIdValue, 'colorVariantId');
  const size = sizeValue.trim();

  if (!size) {
    throw new SalesServiceError('size is required', 400);
  }

  const product = await Product.findById(productId);
  if (!product || !product.isActive) {
    throw new SalesServiceError('Product is not available', 404);
  }

  const variant = product.variant.find((item: IProductVariant) => toIdString(item._id) === variantIdValue);
  if (!variant || !variant.isActive) {
    throw new SalesServiceError('Variant is not available', 404);
  }

  const color = variant.colors.find((item: IColorVariant) => toIdString(item._id) === colorVariantIdValue);
  if (!color) {
    throw new SalesServiceError('Color variant not found', 404);
  }

  const hasSize = variant.sizeMeasurements.some(
    (item: IProductSizeMeasurement) => item.size.trim().toLowerCase() === size.toLowerCase(),
  );
  if (!hasSize) {
    throw new SalesServiceError('Size not found in product variant', 404);
  }

  const inventory = await Inventory.findOne({
    productId,
    variantId,
    colorVariantId,
    size,
  });

  if (!inventory || inventory.availableQuantity < quantity) {
    throw new SalesServiceError('Insufficient available inventory', 409);
  }

  return {
    product,
    variant,
    color,
    inventory,
    productId,
    variantId,
    colorVariantId,
    size: inventory.size,
    sku: inventory.sku,
    finalPrice: getFinalPrice(variant.price, variant.discount),
    fitType: await getFitTypeLabel(product, variant),
    image: color.image || product.product_image,
  };
};
