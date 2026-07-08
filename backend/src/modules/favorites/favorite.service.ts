import { Types } from 'mongoose';
import {
  Favorite,
  Inventory,
  Product,
  type IInventory,
  type IProductVariant,
} from '../../database/models';
import { getFinalPrice, toIdString } from '../sales/sales.helpers';
import { interactionService } from '../interactions/interaction.service';
import type {
  FavoriteListQueryInput,
  FavoriteListResponse,
  FavoriteProductItem,
  FavoriteSortOption,
} from './favorite.types';

export class FavoriteServiceError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
    this.name = 'FavoriteServiceError';
  }
}

type PopulatedBrand = {
  _id: Types.ObjectId;
  name: string;
  image?: string;
};

type PopulatedCategory = {
  _id: Types.ObjectId;
  name: string;
  gender?: 'male' | 'female' | 'unisex';
  image?: string;
};

type FavoriteProductDocument = {
  _id: Types.ObjectId;
  category_id: Types.ObjectId | PopulatedCategory | null;
  name: string;
  brand_id: Types.ObjectId | PopulatedBrand | null;
  variant: IProductVariant[];
  description: string;
  product_image: string;
  isActive: boolean;
  sold_quantity: number;
  averageRating: number;
  reviewCount: number;
  createdAt: Date;
  updatedAt: Date;
};

type FavoriteDocument = {
  product_id: Types.ObjectId;
  createdAt: Date;
};

type InventoryStockDocument = Pick<
  IInventory,
  'productId' | 'variantId' | 'colorVariantId' | 'size' | 'sku' | 'availableQuantity'
>;

type FavoriteProductEntry = {
  product: FavoriteProductDocument;
  favoritedAt: Date;
};

const NEW_PRODUCT_DAYS = 30;
const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 50;

const assertValidObjectId = (id: string, fieldName: string) => {
  if (!Types.ObjectId.isValid(id)) {
    throw new FavoriteServiceError(`Invalid ${fieldName}`, 400);
  }
};

const toObjectId = (id: string, fieldName: string) => {
  assertValidObjectId(id, fieldName);
  return new Types.ObjectId(id);
};

const clampPagination = (query: FavoriteListQueryInput) => {
  const page = Math.max(query.page ?? DEFAULT_PAGE, DEFAULT_PAGE);
  const limit = Math.min(Math.max(query.limit ?? DEFAULT_LIMIT, 1), MAX_LIMIT);

  return { page, limit };
};

const getNewProductCutoff = () => {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - NEW_PRODUCT_DAYS);
  return cutoff;
};

const isNewProduct = (createdAt: Date) => createdAt >= getNewProductCutoff();

const normalizeSearch = (value?: string) => value?.trim().toLowerCase();

const getRelationId = (relation: Types.ObjectId | { _id: Types.ObjectId } | null | undefined) => {
  if (!relation) {
    return '';
  }

  if (relation instanceof Types.ObjectId) {
    return toIdString(relation);
  }

  return toIdString(relation._id);
};

const isPopulatedBrand = (relation: FavoriteProductDocument['brand_id']): relation is PopulatedBrand => {
  return Boolean(relation && !(relation instanceof Types.ObjectId) && 'name' in relation);
};

const isPopulatedCategory = (
  relation: FavoriteProductDocument['category_id'],
): relation is PopulatedCategory => {
  return Boolean(relation && !(relation instanceof Types.ObjectId) && 'name' in relation);
};

const groupInventoryByProductId = (inventoryItems: InventoryStockDocument[]) => {
  const inventoryByProductId = new Map<string, InventoryStockDocument[]>();

  inventoryItems.forEach((inventory) => {
    const productId = toIdString(inventory.productId);
    const existingItems = inventoryByProductId.get(productId) ?? [];
    existingItems.push(inventory);
    inventoryByProductId.set(productId, existingItems);
  });

  return inventoryByProductId;
};

const getAvailableQuantityForVariant = (
  variant: IProductVariant,
  inventoryItems: InventoryStockDocument[],
) => {
  const variantId = toIdString(variant._id);

  return inventoryItems
    .filter((inventory) => toIdString(inventory.variantId) === variantId && inventory.availableQuantity > 0)
    .reduce((sum, inventory) => sum + inventory.availableQuantity, 0);
};

const hasAvailableInventoryForVariant = (
  variant: IProductVariant,
  inventoryItems: InventoryStockDocument[],
) => getAvailableQuantityForVariant(variant, inventoryItems) > 0;

const matchesVariantQuery = (
  variant: IProductVariant,
  query: FavoriteListQueryInput,
  inventoryItems: InventoryStockDocument[],
) => {
  if (!variant.isActive) {
    return false;
  }

  const finalPrice = getFinalPrice(variant.price, variant.discount);

  if (query.minPrice !== undefined && finalPrice < query.minPrice) {
    return false;
  }

  if (query.maxPrice !== undefined && finalPrice > query.maxPrice) {
    return false;
  }

  if (query.inStock === true && !hasAvailableInventoryForVariant(variant, inventoryItems)) {
    return false;
  }

  return true;
};

const selectDisplayVariant = (
  variants: IProductVariant[],
  query: FavoriteListQueryInput,
  inventoryItems: InventoryStockDocument[],
) => {
  return (
    variants.find((variant) => matchesVariantQuery(variant, query, inventoryItems)) ??
    variants.find((variant) => variant.isActive && hasAvailableInventoryForVariant(variant, inventoryItems)) ??
    variants.find((variant) => variant.isActive) ??
    variants[0]
  );
};

const matchesText = (value: string | undefined, keyword: string) => {
  return Boolean(value?.toLowerCase().includes(keyword));
};

const productMatchesKeyword = (product: FavoriteProductDocument, keyword?: string) => {
  const normalizedKeyword = normalizeSearch(keyword);

  if (!normalizedKeyword) {
    return true;
  }

  return (
    matchesText(product.name, normalizedKeyword) ||
    matchesText(product.description, normalizedKeyword) ||
    (isPopulatedBrand(product.brand_id) && matchesText(product.brand_id.name, normalizedKeyword)) ||
    (isPopulatedCategory(product.category_id) && matchesText(product.category_id.name, normalizedKeyword))
  );
};

const matchesObjectIdList = (
  value: Types.ObjectId | { _id: Types.ObjectId } | null | undefined,
  selectedValues?: string[],
) => {
  if (!selectedValues?.length) {
    return true;
  }

  const id = getRelationId(value);
  return selectedValues.some((selectedValue) => selectedValue.trim() === id);
};

const productMatchesQuery = (
  product: FavoriteProductDocument,
  query: FavoriteListQueryInput,
  inventoryItems: InventoryStockDocument[],
) => {
  return (
    productMatchesKeyword(product, query.keyword) &&
    matchesObjectIdList(product.category_id, query.categoryId) &&
    matchesObjectIdList(product.brand_id, query.brandId) &&
    product.variant.some((variant) => matchesVariantQuery(variant, query, inventoryItems))
  );
};

const compareString = (left: string, right: string) =>
  left.localeCompare(right, 'vi', { sensitivity: 'base' });

const sortFavoriteEntries = (
  entries: FavoriteProductEntry[],
  query: FavoriteListQueryInput,
  inventoryByProductId: Map<string, InventoryStockDocument[]>,
) => {
  const getDisplayPrice = (entry: FavoriteProductEntry) => {
    const inventoryItems = inventoryByProductId.get(toIdString(entry.product._id)) ?? [];
    const variant = selectDisplayVariant(entry.product.variant, query, inventoryItems);
    return getFinalPrice(variant?.price ?? 0, variant?.discount ?? 0);
  };

  const sort = query.sort ?? 'favorited_desc';

  return [...entries].sort((left, right) => {
    switch (sort as FavoriteSortOption) {
      case 'name_asc':
        return compareString(left.product.name, right.product.name);
      case 'name_desc':
        return compareString(right.product.name, left.product.name);
      case 'price_asc':
        return getDisplayPrice(left) - getDisplayPrice(right);
      case 'price_desc':
        return getDisplayPrice(right) - getDisplayPrice(left);
      case 'best_seller':
        return right.product.sold_quantity - left.product.sold_quantity;
      case 'rating_desc':
        return (
          right.product.averageRating - left.product.averageRating ||
          right.product.reviewCount - left.product.reviewCount
        );
      case 'newest':
        return right.product.createdAt.getTime() - left.product.createdAt.getTime();
      case 'favorited_asc':
        return left.favoritedAt.getTime() - right.favoritedAt.getTime();
      case 'favorited_desc':
      default:
        return right.favoritedAt.getTime() - left.favoritedAt.getTime();
    }
  });
};

const mapFavoriteProductItem = (
  entry: FavoriteProductEntry,
  query: FavoriteListQueryInput,
  inventoryByProductId: Map<string, InventoryStockDocument[]>,
): FavoriteProductItem => {
  const product = entry.product;
  const productInventory = inventoryByProductId.get(toIdString(product._id)) ?? [];
  const displayVariant = selectDisplayVariant(product.variant, query, productInventory);
  const originalPrice = displayVariant?.price ?? 0;
  const discount = displayVariant?.discount ?? 0;
  const brand = isPopulatedBrand(product.brand_id)
    ? {
        _id: getRelationId(product.brand_id),
        name: product.brand_id.name,
        image: product.brand_id.image,
      }
    : null;
  const category = isPopulatedCategory(product.category_id)
    ? {
        _id: getRelationId(product.category_id),
        name: product.category_id.name,
        gender: product.category_id.gender,
        image: product.category_id.image,
      }
    : null;

  return {
    _id: toIdString(product._id),
    name: product.name,
    image: displayVariant?.colors?.[0]?.image || product.product_image,
    price: originalPrice,
    originalPrice,
    discount,
    finalPrice: getFinalPrice(originalPrice, discount),
    isSale: discount > 0,
    isNew: isNewProduct(product.createdAt),
    isAvailable: Boolean(
      displayVariant?.isActive && hasAvailableInventoryForVariant(displayVariant, productInventory),
    ),
    soldQuantity: product.sold_quantity,
    averageRating: product.averageRating,
    reviewCount: product.reviewCount,
    brand,
    category,
    favoritedAt: entry.favoritedAt.toISOString(),
    isFavorited: true,
  };
};

const getFavoriteStatus = async (userId: string, productIdValue: string) => {
  const userObjectId = toObjectId(userId, 'userId');
  const productObjectId = toObjectId(productIdValue, 'productId');
  const count = await Favorite.countDocuments({
    user_id: userObjectId,
    product_id: productObjectId,
  });

  return {
    productId: productObjectId.toString(),
    isFavorited: count > 0,
  };
};

const listFavorites = async (
  userId: string,
  query: FavoriteListQueryInput = {},
): Promise<FavoriteListResponse> => {
  const userObjectId = toObjectId(userId, 'userId');
  const { page, limit } = clampPagination(query);
  const favorites = await Favorite.find({ user_id: userObjectId })
    .sort({ createdAt: -1 })
    .lean<FavoriteDocument[]>();

  if (!favorites.length) {
    return {
      items: [],
      pagination: {
        page,
        limit,
        totalItems: 0,
        totalPages: 0,
      },
    };
  }

  const productIds = favorites.map((favorite) => favorite.product_id);
  const favoriteByProductId = new Map(
    favorites.map((favorite) => [toIdString(favorite.product_id), favorite.createdAt]),
  );
  const [products, inventoryItems] = await Promise.all([
    Product.find({ _id: { $in: productIds }, isActive: true })
      .populate('brand_id', '_id name image')
      .populate('category_id', '_id name gender image')
      .lean<FavoriteProductDocument[]>(),
    Inventory.find({
      productId: { $in: productIds },
      availableQuantity: { $gt: 0 },
    }).lean<InventoryStockDocument[]>(),
  ]);
  const inventoryByProductId = groupInventoryByProductId(inventoryItems);
  const entries = products
    .map((product) => ({
      product,
      favoritedAt: favoriteByProductId.get(toIdString(product._id)) ?? new Date(0),
    }))
    .filter((entry) => {
      const productInventory = inventoryByProductId.get(toIdString(entry.product._id)) ?? [];
      return productMatchesQuery(entry.product, query, productInventory);
    });
  const sortedEntries = sortFavoriteEntries(entries, query, inventoryByProductId);
  const totalItems = sortedEntries.length;
  const paginatedEntries = sortedEntries.slice((page - 1) * limit, page * limit);

  return {
    items: paginatedEntries.map((entry) => mapFavoriteProductItem(entry, query, inventoryByProductId)),
    pagination: {
      page,
      limit,
      totalItems,
      totalPages: Math.ceil(totalItems / limit),
    },
  };
};

const addFavorite = async (userId: string, productIdValue: string) => {
  const userObjectId = toObjectId(userId, 'userId');
  const productObjectId = toObjectId(productIdValue, 'productId');
  const product = await Product.findOne({ _id: productObjectId, isActive: true }).select('_id').lean();

  if (!product) {
    throw new FavoriteServiceError('Product is not available', 404);
  }

  const result = await Favorite.updateOne(
    { user_id: userObjectId, product_id: productObjectId },
    { $setOnInsert: { user_id: userObjectId, product_id: productObjectId } },
    { upsert: true },
  );
  if (result.upsertedCount) {
    void interactionService.recordFavoriteBestEffort(userId, productObjectId.toString());
  }

  return {
    productId: productObjectId.toString(),
    isFavorited: true,
  };
};

const removeFavorite = async (userId: string, productIdValue: string) => {
  const userObjectId = toObjectId(userId, 'userId');
  const productObjectId = toObjectId(productIdValue, 'productId');

  await Favorite.deleteOne({
    user_id: userObjectId,
    product_id: productObjectId,
  });

  return {
    productId: productObjectId.toString(),
    isFavorited: false,
  };
};

export const favoriteService = {
  getFavoriteStatus,
  listFavorites,
  addFavorite,
  removeFavorite,
};
