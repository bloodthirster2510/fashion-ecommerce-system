import { Types } from 'mongoose';
import { Order, Product } from '../../database/models';
import {
  buildCategoryAssociationModel,
  type CategoryAssociationModel,
} from './recommendation-association';

type OrderBasketDocument = {
  order_list?: Array<{ productId: Types.ObjectId }>;
};

type ProductCategoryDocument = {
  _id: Types.ObjectId;
  category_id: Types.ObjectId;
};

const ASSOCIATION_CACHE_TTL_MS = 15 * 60 * 1000;
const ASSOCIATION_ORDER_LIMIT = 5000;
const MINIMUM_PAIR_ORDERS = 2;

let cachedModel: { expiresAt: number; value: CategoryAssociationModel } | null = null;

const emptyModel = () => buildCategoryAssociationModel([]);

const loadCategoryAssociationModel = async () => {
  const orders = await Order.find({
    status: { $in: ['confirmed', 'packed', 'shipping', 'delivered', 'completed'] },
    'order_list.1': { $exists: true },
  })
    .select('order_list.productId')
    .sort({ createdAt: -1 })
    .limit(ASSOCIATION_ORDER_LIMIT)
    .lean<OrderBasketDocument[]>();

  const productIds = [...new Set(orders.flatMap((order) => (
    order.order_list ?? []
  ).map((item) => String(item.productId))))]
    .filter((productId) => Types.ObjectId.isValid(productId))
    .map((productId) => new Types.ObjectId(productId));
  if (!productIds.length) return emptyModel();

  const products = await Product.find({ _id: { $in: productIds } })
    .select('_id category_id')
    .lean<ProductCategoryDocument[]>();
  const categoryByProductId = new Map(products.map((product) => [
    String(product._id),
    String(product.category_id),
  ]));
  const baskets = orders.map((order) => (order.order_list ?? [])
    .map((item) => categoryByProductId.get(String(item.productId)) ?? '')
    .filter(Boolean));

  return buildCategoryAssociationModel(baskets, MINIMUM_PAIR_ORDERS);
};

export const getCategoryAssociationModel = async () => {
  if (cachedModel && cachedModel.expiresAt > Date.now()) return cachedModel.value;
  try {
    const value = await loadCategoryAssociationModel();
    cachedModel = { value, expiresAt: Date.now() + ASSOCIATION_CACHE_TTL_MS };
    return value;
  } catch {
    return cachedModel?.value ?? emptyModel();
  }
};

export const clearCategoryAssociationCache = () => {
  cachedModel = null;
};
