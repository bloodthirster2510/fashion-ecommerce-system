import { Types } from 'mongoose';
import {
  Cart,
  Favorite,
  Order,
  UserProductInteraction,
  type InteractionActionType,
  type InteractionSource,
} from '../../database/models';
import { INTERACTION_ACTION_WEIGHTS } from '../interactions/interaction.service';
import { toIdString } from '../sales/sales.helpers';

type BackfillSource = 'favorite' | 'cart' | 'order';

type BackfillOptions = {
  dryRun?: boolean;
  limit?: number;
};

type BackfillResult = {
  source: BackfillSource;
  scanned: number;
  attempted: number;
  inserted: number;
  matched: number;
};

type BackfillBulkOperation = {
  updateOne: {
    filter: Record<string, unknown>;
    update: Record<string, unknown>;
    upsert: boolean;
  };
};

const DEFAULT_LIMIT = 0;
const BULK_CHUNK_SIZE = 500;

const getLimit = (limit?: number) => (
  Number.isInteger(limit) && limit && limit > 0 ? limit : DEFAULT_LIMIT
);

const chunk = <T>(items: T[], size: number) => {
  const chunks: T[][] = [];

  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }

  return chunks;
};

const createInteractionUpsert = ({
  userId,
  productId,
  actionType,
  sourceId,
  backfillSource,
  source,
  createdAt,
  metadata = {},
}: {
  userId: Types.ObjectId;
  productId: Types.ObjectId;
  actionType: InteractionActionType;
  sourceId: string;
  backfillSource: BackfillSource;
  source: InteractionSource;
  createdAt: Date;
  metadata?: Record<string, unknown>;
}): BackfillBulkOperation => ({
  updateOne: {
    filter: {
      userId,
      productId,
      actionType,
      'metadata.backfillSource': backfillSource,
      'metadata.sourceId': sourceId,
    },
    update: {
      $setOnInsert: {
        userId,
        sessionId: null,
        productId,
        actionType,
        weight: INTERACTION_ACTION_WEIGHTS[actionType],
        source,
        metadata: {
          ...metadata,
          backfill: true,
          backfillSource,
          sourceId,
        },
        createdAt,
        updatedAt: createdAt,
      },
    },
    upsert: true,
  },
});

const runBulk = async (
  source: BackfillSource,
  operations: BackfillBulkOperation[],
  dryRun?: boolean,
): Promise<BackfillResult> => {
  if (dryRun || !operations.length) {
    return {
      source,
      scanned: operations.length,
      attempted: operations.length,
      inserted: 0,
      matched: 0,
    };
  }

  let inserted = 0;
  let matched = 0;

  for (const operationChunk of chunk(operations, BULK_CHUNK_SIZE)) {
    const result = await UserProductInteraction.bulkWrite(operationChunk, { ordered: false });
    inserted += result.upsertedCount ?? 0;
    matched += result.matchedCount ?? 0;
  }

  return {
    source,
    scanned: operations.length,
    attempted: operations.length,
    inserted,
    matched,
  };
};

const backfillFavorites = async (options: BackfillOptions): Promise<BackfillResult> => {
  const query = Favorite.find({})
    .select('_id user_id product_id createdAt')
    .sort({ createdAt: 1 })
    .lean<Array<{
      _id: Types.ObjectId;
      user_id: Types.ObjectId;
      product_id: Types.ObjectId;
      createdAt: Date;
    }>>();
  const limit = getLimit(options.limit);
  const favorites = await (limit ? query.limit(limit) : query);
  const operations = favorites.map((favorite) =>
    createInteractionUpsert({
      userId: favorite.user_id,
      productId: favorite.product_id,
      actionType: 'favorite',
      source: 'backend',
      sourceId: toIdString(favorite._id),
      backfillSource: 'favorite',
      createdAt: favorite.createdAt,
    }),
  );

  return runBulk('favorite', operations, options.dryRun);
};

const backfillCarts = async (options: BackfillOptions): Promise<BackfillResult> => {
  const query = Cart.find({ 'product_list.0': { $exists: true } })
    .select('_id user_id product_list.productId product_list.variantId product_list.colorVariantId product_list.size product_list.quantity updatedAt')
    .sort({ updatedAt: 1 })
    .lean<Array<{
      _id: Types.ObjectId;
      user_id: Types.ObjectId;
      product_list: Array<{
        _id: Types.ObjectId;
        productId: Types.ObjectId;
        variantId: Types.ObjectId;
        colorVariantId: Types.ObjectId;
        size: string;
        quantity: number;
      }>;
      updatedAt: Date;
    }>>();
  const limit = getLimit(options.limit);
  const carts = await (limit ? query.limit(limit) : query);
  const operations = carts.flatMap((cart) =>
    cart.product_list.map((item) =>
      createInteractionUpsert({
        userId: cart.user_id,
        productId: item.productId,
        actionType: 'add_to_cart',
        source: 'backend',
        sourceId: `${toIdString(cart._id)}:${toIdString(item._id)}`,
        backfillSource: 'cart',
        createdAt: cart.updatedAt,
        metadata: {
          cartId: toIdString(cart._id),
          variantId: toIdString(item.variantId),
          colorVariantId: toIdString(item.colorVariantId),
          size: item.size,
          quantity: item.quantity,
        },
      }),
    ),
  );

  return runBulk('cart', operations, options.dryRun);
};

const backfillOrders = async (options: BackfillOptions): Promise<BackfillResult> => {
  const query = Order.find({
    status: { $nin: ['cancelled', 'returned'] },
    paymentStatus: 'paid',
    'order_list.0': { $exists: true },
  })
    .select('_id user_id orderCode order_list.productId order_list.variantId order_list.colorVariantId order_list.size order_list.quantity createdAt')
    .sort({ createdAt: 1 })
    .lean<Array<{
      _id: Types.ObjectId;
      user_id: Types.ObjectId;
      orderCode: string;
      order_list: Array<{
        _id: Types.ObjectId;
        productId: Types.ObjectId;
        variantId: Types.ObjectId;
        colorVariantId: Types.ObjectId;
        size: string;
        quantity: number;
      }>;
      createdAt: Date;
    }>>();
  const limit = getLimit(options.limit);
  const orders = await (limit ? query.limit(limit) : query);
  const operations = orders.flatMap((order) =>
    order.order_list.map((item) =>
      createInteractionUpsert({
        userId: order.user_id,
        productId: item.productId,
        actionType: 'purchase',
        source: 'backend',
        sourceId: `${toIdString(order._id)}:${toIdString(item._id)}`,
        backfillSource: 'order',
        createdAt: order.createdAt,
        metadata: {
          orderId: toIdString(order._id),
          orderCode: order.orderCode,
          variantId: toIdString(item.variantId),
          colorVariantId: toIdString(item.colorVariantId),
          size: item.size,
          quantity: item.quantity,
        },
      }),
    ),
  );

  return runBulk('order', operations, options.dryRun);
};

const backfillRecommendationInteractions = async (options: BackfillOptions = {}) => {
  const results = [
    await backfillFavorites(options),
    await backfillCarts(options),
    await backfillOrders(options),
  ];

  return {
    dryRun: Boolean(options.dryRun),
    results,
    totals: results.reduce(
      (totals, result) => ({
        scanned: totals.scanned + result.scanned,
        attempted: totals.attempted + result.attempted,
        inserted: totals.inserted + result.inserted,
        matched: totals.matched + result.matched,
      }),
      { scanned: 0, attempted: 0, inserted: 0, matched: 0 },
    ),
  };
};

export const recommendationBackfillService = {
  backfillRecommendationInteractions,
};
