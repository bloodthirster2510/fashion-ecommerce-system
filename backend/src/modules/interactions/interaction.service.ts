import { Types } from 'mongoose';
import {
  INTERACTION_ACTION_TYPES,
  INTERACTION_SOURCES,
  Product,
  UserProductInteraction,
  type InteractionActionType,
  type InteractionSource,
} from '../../database/models';
import type {
  InteractionMetadata,
  RecordCartInteractionInput,
  RecordInteractionInput,
  RecordInteractionResult,
  RecordPurchaseInteractionItem,
} from './interaction.types';

export class InteractionServiceError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
    this.name = 'InteractionServiceError';
  }
}

export const INTERACTION_ACTION_WEIGHTS: Record<InteractionActionType, number> = {
  view: 1,
  click: 1,
  search: 2,
  favorite: 3,
  add_to_cart: 5,
  purchase: 10,
  search_result_click: 2,
  recommendation_click: 3,
  try_on: 4,
};

const VIEW_COOLDOWN_MS = 45 * 60 * 1000;
const MAX_METADATA_KEYS = 30;
const MAX_METADATA_STRING_LENGTH = 300;
const PRODUCT_OPTIONAL_ACTIONS = new Set<InteractionActionType>([
  'search',
  'search_result_click',
  'recommendation_click',
]);

export const isInteractionTrackingEnabled = () =>
  process.env.INTERACTION_TRACKING_ENABLED !== 'false';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isActionType = (value: string): value is InteractionActionType =>
  INTERACTION_ACTION_TYPES.includes(value as InteractionActionType);

const isSource = (value: string): value is InteractionSource =>
  INTERACTION_SOURCES.includes(value as InteractionSource);

const normalizeSessionId = (value?: string | null) => {
  const sessionId = value?.trim();

  if (sessionId && sessionId.length > 128) {
    throw new InteractionServiceError('Invalid sessionId', 400);
  }

  return sessionId || null;
};

const toObjectId = (value: string, fieldName: string) => {
  if (!Types.ObjectId.isValid(value)) {
    throw new InteractionServiceError(`Invalid ${fieldName}`, 400);
  }

  return new Types.ObjectId(value);
};

const toOptionalObjectId = (value: string | null | undefined, fieldName: string) =>
  value ? toObjectId(value, fieldName) : null;

const normalizeSize = (value?: string | null) => {
  const size = value?.trim();

  if (size && size.length > 20) {
    throw new InteractionServiceError('Invalid size', 400);
  }

  return size || null;
};

const sanitizeMetadataValue = (value: unknown): unknown => {
  if (typeof value === 'string') {
    return value.trim().slice(0, MAX_METADATA_STRING_LENGTH);
  }

  if (
    typeof value === 'number' ||
    typeof value === 'boolean' ||
    value === null
  ) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.slice(0, 20).map(sanitizeMetadataValue);
  }

  if (isRecord(value)) {
    return sanitizeMetadata(value);
  }

  return undefined;
};

const sanitizeMetadata = (metadata?: InteractionMetadata): InteractionMetadata => {
  if (!isRecord(metadata)) {
    return {};
  }

  return Object.entries(metadata)
    .slice(0, MAX_METADATA_KEYS)
    .reduce<InteractionMetadata>((result, [key, value]) => {
      const normalizedKey = key.trim().slice(0, 80);
      const sanitizedValue = sanitizeMetadataValue(value);

      if (normalizedKey && sanitizedValue !== undefined) {
        result[normalizedKey] = sanitizedValue;
      }

      return result;
    }, {});
};

const getRecentView = async ({
  userId,
  sessionId,
  productId,
}: {
  userId?: Types.ObjectId | null;
  sessionId?: string | null;
  productId: Types.ObjectId;
}) => {
  const cooldownCutoff = new Date(Date.now() - VIEW_COOLDOWN_MS);

  if (userId) {
    return UserProductInteraction.findOne({
      userId,
      productId,
      actionType: 'view',
      createdAt: { $gte: cooldownCutoff },
    }).select('_id').lean();
  }

  if (sessionId) {
    return UserProductInteraction.findOne({
      sessionId,
      productId,
      actionType: 'view',
      createdAt: { $gte: cooldownCutoff },
    }).select('_id').lean();
  }

  return null;
};

const assertProductSelectionExists = async ({
  productId,
  variantId,
  colorVariantId,
}: {
  productId: Types.ObjectId;
  variantId?: Types.ObjectId | null;
  colorVariantId?: Types.ObjectId | null;
}) => {
  const filter: Record<string, unknown> = { _id: productId, isActive: true };

  if (variantId && colorVariantId) {
    filter.variant = {
      $elemMatch: {
        _id: variantId,
        'colors._id': colorVariantId,
      },
    };
  } else if (variantId) {
    filter['variant._id'] = variantId;
  } else if (colorVariantId) {
    filter['variant.colors._id'] = colorVariantId;
  }

  const product = await Product.exists(filter);

  if (!product) {
    throw new InteractionServiceError('Product selection is not available', 404);
  }
};

const claimGuestSessionInteractions = async (
  userId: Types.ObjectId,
  sessionId: string,
) => {
  await UserProductInteraction.updateMany(
    {
      sessionId,
      $or: [
        { userId: null },
        { userId: { $exists: false } },
      ],
    },
    { $set: { userId } },
  );
};

const recordInteraction = async (
  input: RecordInteractionInput,
): Promise<RecordInteractionResult> => {
  if (!isInteractionTrackingEnabled()) {
    return {
      recorded: false,
      skippedReason: 'tracking_disabled',
    };
  }

  if (!isActionType(input.actionType)) {
    throw new InteractionServiceError('Invalid actionType', 400);
  }

  const source = input.source ?? 'backend';
  if (!isSource(source)) {
    throw new InteractionServiceError('Invalid source', 400);
  }

  const userId = input.userId ? toObjectId(input.userId, 'userId') : null;
  const sessionId = normalizeSessionId(input.sessionId);

  if (!userId && !sessionId) {
    throw new InteractionServiceError('userId or sessionId is required', 400);
  }

  if (userId && sessionId) {
    await claimGuestSessionInteractions(userId, sessionId);
  }

  const productId = input.productId
    ? toObjectId(input.productId, 'productId')
    : null;
  const variantId = toOptionalObjectId(input.variantId, 'variantId');
  const colorVariantId = toOptionalObjectId(input.colorVariantId, 'colorVariantId');
  const size = normalizeSize(input.size);

  if (!PRODUCT_OPTIONAL_ACTIONS.has(input.actionType) && !productId) {
    throw new InteractionServiceError('productId is required for this actionType', 400);
  }

  if (!productId && (variantId || colorVariantId || size)) {
    throw new InteractionServiceError('productId is required when product options are provided', 400);
  }

  if (productId) {
    await assertProductSelectionExists({ productId, variantId, colorVariantId });
  }

  if (input.actionType === 'view' && productId) {
    const recentView = await getRecentView({ userId, sessionId, productId });

    if (recentView?._id) {
      return {
        recorded: false,
        interactionId: recentView._id.toString(),
        skippedReason: 'recent_duplicate_view',
      };
    }
  }

  const interaction = await UserProductInteraction.create({
    userId,
    sessionId,
    productId,
    variantId,
    colorVariantId,
    size,
    actionType: input.actionType,
    weight: INTERACTION_ACTION_WEIGHTS[input.actionType],
    source,
    metadata: sanitizeMetadata(input.metadata),
  });

  return {
    recorded: true,
    interactionId: interaction._id.toString(),
  };
};

const recordInteractionBestEffort = async (
  input: RecordInteractionInput,
  context = 'Failed to record product interaction',
) => {
  try {
    return await recordInteraction(input);
  } catch (error) {
    console.warn(`${context}:`, error);
    return null;
  }
};

const recordFavoriteBestEffort = (userId: string, productId: string) =>
  recordInteractionBestEffort({
    userId,
    productId,
    actionType: 'favorite',
    source: 'backend',
  }, 'Failed to record favorite interaction');

const recordAddToCartBestEffort = (
  userId: string,
  item: RecordCartInteractionInput,
) =>
  recordInteractionBestEffort({
    userId,
    productId: item.productId,
    variantId: item.variantId,
    colorVariantId: item.colorVariantId,
    size: item.size,
    actionType: 'add_to_cart',
    source: 'backend',
    metadata: {
      variantId: item.variantId,
      colorVariantId: item.colorVariantId,
      size: item.size,
      quantity: item.quantity,
    },
  }, 'Failed to record add-to-cart interaction');

const recordPurchaseInteractions = async (
  userId: string,
  items: RecordPurchaseInteractionItem[],
  metadata: InteractionMetadata = {},
) => {
  if (!isInteractionTrackingEnabled()) {
    return [];
  }

  const userObjectId = toObjectId(userId, 'userId');

  await Promise.all(
    items.map(async (item) => {
      const recommendationRequestId = item.recommendationRequestId?.trim() || null;

      if (!item.sourceId) {
        return recordInteraction({
          userId,
          productId: item.productId,
          variantId: item.variantId,
          colorVariantId: item.colorVariantId,
          size: item.size,
          actionType: 'purchase',
          source: 'backend',
          metadata: {
            ...metadata,
            variantId: item.variantId,
            colorVariantId: item.colorVariantId,
            size: item.size,
            quantity: item.quantity,
            ...(recommendationRequestId ? { recommendationRequestId } : {}),
          },
        });
      }

      const productId = toObjectId(item.productId, 'productId');
      const variantId = toOptionalObjectId(item.variantId, 'variantId');
      const colorVariantId = toOptionalObjectId(item.colorVariantId, 'colorVariantId');
      const size = normalizeSize(item.size);
      await assertProductSelectionExists({ productId, variantId, colorVariantId });
      const interactionMetadata = sanitizeMetadata({
        ...metadata,
        sourceId: item.sourceId,
        variantId: item.variantId,
        colorVariantId: item.colorVariantId,
        size: item.size,
        quantity: item.quantity,
        ...(recommendationRequestId ? { recommendationRequestId } : {}),
      });

      const result = await UserProductInteraction.updateOne(
        {
          userId: userObjectId,
          actionType: 'purchase',
          'metadata.sourceId': item.sourceId,
        },
        {
          $setOnInsert: {
            userId: userObjectId,
            sessionId: null,
            productId,
            variantId,
            colorVariantId,
            size,
            actionType: 'purchase',
            weight: INTERACTION_ACTION_WEIGHTS.purchase,
            source: 'backend',
            metadata: interactionMetadata,
          },
        },
        { upsert: true },
      );

      if (!result.upsertedCount && recommendationRequestId) {
        await UserProductInteraction.updateOne(
          {
            userId: userObjectId,
            actionType: 'purchase',
            'metadata.sourceId': item.sourceId,
          },
          { $set: { 'metadata.recommendationRequestId': recommendationRequestId } },
        );
      }

      return {
        recorded: Boolean(result.upsertedCount),
        interactionId: result.upsertedId?.toString(),
      };
    }),
  );
};

export const interactionService = {
  recordInteraction,
  recordInteractionBestEffort,
  recordFavoriteBestEffort,
  recordAddToCartBestEffort,
  recordPurchaseInteractions,
};
