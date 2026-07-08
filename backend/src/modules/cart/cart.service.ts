import { Types } from 'mongoose';
import {
  Cart,
  Inventory,
  Product,
  type ICart,
  type ICartItem,
  type IColorVariant,
  type IInventory,
  type IProduct,
  type IProductVariant,
} from '../../database/models';
import {
  SalesServiceError,
  assertPositiveQuantity,
  resolveSaleItem,
  toIdString,
  toObjectId,
} from '../sales/sales.helpers';
import { interactionService } from '../interactions/interaction.service';
import { recommendationService } from '../recommendations/recommendation.service';
import type {
  AddCartItemInput,
  SelectAllCartItemsInput,
  SelectCartItemInput,
  UpdateCartItemInput,
} from './cart.types';

const getOrCreateCart = async (userId: string) => {
  const userObjectId = toObjectId(userId, 'userId');
  const existingCart = await Cart.findOne({ user_id: userObjectId });

  if (existingCart) {
    return existingCart;
  }

  return Cart.create({
    user_id: userObjectId,
    product_list: [],
  });
};

const getCartByUserId = async (userId: string) => {
  const userObjectId = toObjectId(userId, 'userId');
  return Cart.findOne({ user_id: userObjectId });
};

const isSameSelection = (
  item: ICartItem,
  productId: Types.ObjectId,
  variantId: Types.ObjectId,
  colorVariantId: Types.ObjectId,
  size: string,
) => {
  return (
    toIdString(item.productId) === toIdString(productId) &&
    toIdString(item.variantId) === toIdString(variantId) &&
    toIdString(item.colorVariantId) === toIdString(colorVariantId) &&
    item.size.trim().toLowerCase() === size.trim().toLowerCase()
  );
};

const findCartItem = (cart: ICart, itemId: string) => {
  const item = cart.product_list.find((entry) => toIdString(entry._id) === itemId);

  if (!item) {
    throw new SalesServiceError('Cart item not found', 404);
  }

  return item;
};

const getInventoryKey = (
  productId: Types.ObjectId | string | { toString(): string },
  variantId: Types.ObjectId | string | { toString(): string },
  colorVariantId: Types.ObjectId | string | { toString(): string },
  size: string,
) => [
  toIdString(productId),
  toIdString(variantId),
  toIdString(colorVariantId),
  size.trim().toLowerCase(),
].join(':');

const getBrandSnapshot = (brand: unknown) => {
  if (!brand || typeof brand !== 'object') {
    return undefined;
  }

  const relation = brand as {
    _id?: Types.ObjectId | string | { toString(): string };
    name?: string;
    image?: string;
  };

  if (!relation.name) {
    return undefined;
  }

  return {
    _id: toIdString(relation._id),
    name: relation.name,
    image: relation.image,
  };
};

type CartProductDocument = IProduct & { brand_id: unknown };

const buildCartItemLookups = async (items: ICartItem[]) => {
  if (!items.length) {
    return {
      productById: new Map<string, CartProductDocument>(),
      inventoryByKey: new Map<string, IInventory>(),
    };
  }

  const productIds = Array.from(new Set(items.map((item) => toIdString(item.productId))))
    .filter((id) => Types.ObjectId.isValid(id))
    .map((id) => new Types.ObjectId(id));

  const inventoryFilters = items.map((item) => ({
    productId: item.productId,
    variantId: item.variantId,
    colorVariantId: item.colorVariantId,
    size: item.size,
  }));

  const [products, inventories] = await Promise.all([
    Product.find({ _id: { $in: productIds } }).populate('brand_id', '_id name image'),
    Inventory.find({ $or: inventoryFilters }),
  ]) as [CartProductDocument[], IInventory[]];

  return {
    productById: new Map(products.map((product) => [toIdString(product._id), product])),
    inventoryByKey: new Map(
      inventories.map((inventory) => [
        getInventoryKey(inventory.productId, inventory.variantId, inventory.colorVariantId, inventory.size),
        inventory,
      ]),
    ),
  };
};

const summarizeCart = async (cart: ICart | null) => {
  const items = cart?.product_list ?? [];
  const selectedItems = items.filter((item) => item.isSelected);
  const { productById, inventoryByKey } = await buildCartItemLookups(items);

  return {
    _id: cart?._id?.toString(),
    user_id: cart?.user_id?.toString(),
    product_list: items.map((item) => {
      const product = productById.get(toIdString(item.productId));
      const variant = product?.variant.find(
        (entry: IProductVariant) => toIdString(entry._id) === toIdString(item.variantId),
      );
      const color = variant?.colors.find(
        (entry: IColorVariant) => toIdString(entry._id) === toIdString(item.colorVariantId),
      );
      const inventory = inventoryByKey.get(
        getInventoryKey(item.productId, item.variantId, item.colorVariantId, item.size),
      );
      const availableQuantity = inventory?.availableQuantity ?? 0;

      return {
        _id: toIdString(item._id),
        productId: toIdString(item.productId),
        variantId: toIdString(item.variantId),
        colorVariantId: toIdString(item.colorVariantId),
        size: item.size,
        sku: item.sku,
        quantity: item.quantity,
        priceAtAddedTime: item.priceAtAddedTime,
        isSelected: item.isSelected,
        recommendationRequestId: item.recommendationRequestId ?? undefined,
        lineTotal: item.quantity * item.priceAtAddedTime,
        name: product?.name,
        brand: getBrandSnapshot(product?.brand_id),
        color: color?.color,
        colorCode: color?.colorCode,
        image: color?.image || product?.product_image,
        originalPrice: variant?.price ?? item.priceAtAddedTime,
        discount: variant?.discount ?? 0,
        availableQuantity,
        isAvailable: Boolean(product?.isActive && variant?.isActive && availableQuantity >= item.quantity),
      };
    }),
    summary: {
      itemCount: items.reduce((sum, item) => sum + item.quantity, 0),
      selectedItemCount: selectedItems.reduce((sum, item) => sum + item.quantity, 0),
      subTotal: selectedItems.reduce((sum, item) => sum + item.quantity * item.priceAtAddedTime, 0),
    },
  };
};

const getCart = async (userId: string) => {
  const cart = await getCartByUserId(userId);
  return summarizeCart(cart);
};

const addCartItem = async (userId: string, input: AddCartItemInput) => {
  const quantity = Number(input.quantity);
  assertPositiveQuantity(quantity);
  const recommendationRequestId = input.recommendationRequestId?.trim() || null;

  if (recommendationRequestId && recommendationRequestId.length > 120) {
    throw new SalesServiceError('Invalid recommendationRequestId', 400);
  }

  const resolved = await resolveSaleItem(
    input.productId,
    input.variantId,
    input.colorVariantId,
    input.size,
    quantity,
  );
  const cart = await getOrCreateCart(userId);
  const existingItem = cart.product_list.find((item: ICartItem) =>
    isSameSelection(item, resolved.productId, resolved.variantId, resolved.colorVariantId, resolved.size),
  );

  if (existingItem) {
    const nextQuantity = existingItem.quantity + quantity;
    assertPositiveQuantity(nextQuantity);

    if (resolved.inventory.availableQuantity < nextQuantity) {
      throw new SalesServiceError('Insufficient available inventory', 409);
    }

    existingItem.quantity = nextQuantity;
    existingItem.priceAtAddedTime = resolved.finalPrice;
    existingItem.sku = resolved.sku;
    existingItem.isSelected = true;
    if (recommendationRequestId) {
      existingItem.recommendationRequestId = recommendationRequestId;
    }
  } else {
    cart.product_list.push({
      _id: new Types.ObjectId(),
      productId: resolved.productId,
      variantId: resolved.variantId,
      colorVariantId: resolved.colorVariantId,
      size: resolved.size,
      sku: resolved.sku,
      quantity,
      priceAtAddedTime: resolved.finalPrice,
      isSelected: true,
      recommendationRequestId,
    });
  }

  await cart.save();
  void interactionService.recordAddToCartBestEffort(userId, {
    productId: toIdString(resolved.productId),
    variantId: toIdString(resolved.variantId),
    colorVariantId: toIdString(resolved.colorVariantId),
    size: resolved.size,
    quantity,
  });
  if (recommendationRequestId) {
    void recommendationService.recordRecommendationConversionEventBestEffort({
      userId,
      sessionId: input.recommendationSessionId,
      requestId: recommendationRequestId,
      recommendedProductId: toIdString(resolved.productId),
      eventType: 'add_to_cart',
    });
  }

  return summarizeCart(cart);
};

const updateCartItem = async (userId: string, itemId: string, input: UpdateCartItemInput) => {
  const cart = await getOrCreateCart(userId);
  const item = findCartItem(cart, itemId);
  const nextQuantity = input.quantity !== undefined ? Number(input.quantity) : item.quantity;
  const nextSize = input.size?.trim() || item.size;

  assertPositiveQuantity(nextQuantity);

  const resolved = await resolveSaleItem(
    toIdString(item.productId),
    toIdString(item.variantId),
    toIdString(item.colorVariantId),
    nextSize,
    nextQuantity,
  );
  const duplicateItem = cart.product_list.find((entry: ICartItem) => {
    return (
      toIdString(entry._id) !== itemId &&
      isSameSelection(entry, resolved.productId, resolved.variantId, resolved.colorVariantId, resolved.size)
    );
  });

  if (duplicateItem) {
    const mergedQuantity = duplicateItem.quantity + nextQuantity;
    assertPositiveQuantity(mergedQuantity);

    if (resolved.inventory.availableQuantity < mergedQuantity) {
      throw new SalesServiceError('Insufficient available inventory', 409);
    }

    duplicateItem.quantity = mergedQuantity;
    duplicateItem.priceAtAddedTime = resolved.finalPrice;
    duplicateItem.sku = resolved.sku;
    duplicateItem.isSelected = duplicateItem.isSelected || item.isSelected;
    cart.product_list = cart.product_list.filter((entry: ICartItem) => toIdString(entry._id) !== itemId);
  } else {
    item.size = resolved.size;
    item.sku = resolved.sku;
    item.quantity = nextQuantity;
    item.priceAtAddedTime = resolved.finalPrice;
  }

  await cart.save();
  return summarizeCart(cart);
};

const selectCartItem = async (userId: string, itemId: string, input: SelectCartItemInput) => {
  const cart = await getOrCreateCart(userId);
  const item = findCartItem(cart, itemId);

  item.isSelected = Boolean(input.isSelected);

  await cart.save();
  return summarizeCart(cart);
};

const selectAllCartItems = async (userId: string, input: SelectAllCartItemsInput) => {
  const cart = await getOrCreateCart(userId);
  cart.product_list.forEach((item: ICartItem) => {
    item.isSelected = Boolean(input.isSelected);
  });

  await cart.save();
  return summarizeCart(cart);
};

const deleteCartItem = async (userId: string, itemId: string) => {
  const cart = await getOrCreateCart(userId);
  findCartItem(cart, itemId);

  cart.product_list = cart.product_list.filter((item: ICartItem) => toIdString(item._id) !== itemId);

  await cart.save();
  return summarizeCart(cart);
};

const deleteCartItems = async (userId: string, itemIds: string[]) => {
  const cart = await getOrCreateCart(userId);
  const itemIdSet = new Set(itemIds);

  cart.product_list = cart.product_list.filter((item: ICartItem) => !itemIdSet.has(toIdString(item._id)));

  await cart.save();
  return summarizeCart(cart);
};

export const cartService = {
  getCart,
  addCartItem,
  updateCartItem,
  selectCartItem,
  selectAllCartItems,
  deleteCartItem,
  deleteCartItems,
  summarizeCart,
};
