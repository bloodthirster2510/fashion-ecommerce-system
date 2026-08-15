import { Types } from 'mongoose';
import {
  Product,
  RecommendationMerchandisingRule,
  RECOMMENDATION_CONTEXTS,
  type RecommendationContext,
} from '../../database/models';
import { RecommendationServiceError } from './recommendation.service';

const MAX_PINNED_PRODUCTS = 8;

export type RecommendationMerchandisingInput = {
  pinnedProductIds?: unknown;
  enabled?: unknown;
  startsAt?: unknown;
  endsAt?: unknown;
};

const isContext = (value: string): value is RecommendationContext =>
  RECOMMENDATION_CONTEXTS.includes(value as RecommendationContext);

const parseDate = (value: unknown, field: string) => {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string') throw new RecommendationServiceError(`Invalid ${field}`, 400);
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) throw new RecommendationServiceError(`Invalid ${field}`, 400);
  return parsed;
};

const parseProductIds = (value: unknown) => {
  if (!Array.isArray(value)) throw new RecommendationServiceError('pinnedProductIds must be an array', 400);
  const ids = Array.from(new Set(value.map((item) => String(item).trim()).filter(Boolean)));
  if (ids.length > MAX_PINNED_PRODUCTS) {
    throw new RecommendationServiceError(`A maximum of ${MAX_PINNED_PRODUCTS} products can be pinned`, 400);
  }
  if (ids.some((id) => !Types.ObjectId.isValid(id))) {
    throw new RecommendationServiceError('Invalid pinned product id', 400);
  }
  return ids;
};

const listRules = async () => {
  const storedRules = await RecommendationMerchandisingRule.find({}).lean<Array<{
    context: RecommendationContext;
    pinnedProductIds: Types.ObjectId[];
    enabled: boolean;
    startsAt?: Date | null;
    endsAt?: Date | null;
    updatedBy?: Types.ObjectId | null;
    updatedAt?: Date;
  }>>();
  const ruleByContext = new Map(storedRules.map((rule) => [rule.context, rule]));
  const productIds = Array.from(new Set(storedRules.flatMap((rule) => rule.pinnedProductIds.map(String))));
  const products = await Product.find({
    _id: { $in: productIds.filter((id) => Types.ObjectId.isValid(id)).map((id) => new Types.ObjectId(id)) },
  }).select('_id name product_image isActive').lean<Array<{
    _id: Types.ObjectId;
    name: string;
    product_image: string;
    isActive: boolean;
  }>>();
  const productById = new Map(products.map((product) => [String(product._id), product]));

  return RECOMMENDATION_CONTEXTS.map((context) => {
    const rule = ruleByContext.get(context);
    return {
      context,
      enabled: rule?.enabled ?? false,
      startsAt: rule?.startsAt ?? null,
      endsAt: rule?.endsAt ?? null,
      updatedAt: rule?.updatedAt ?? null,
      updatedBy: rule?.updatedBy ? String(rule.updatedBy) : null,
      pinnedProducts: (rule?.pinnedProductIds ?? []).map((productId, index) => {
        const product = productById.get(String(productId));
        return {
          productId: String(productId),
          position: index + 1,
          name: product?.name ?? 'Sản phẩm không còn tồn tại',
          image: product?.product_image ?? '',
          isActive: product?.isActive ?? false,
        };
      }),
    };
  });
};

const updateRule = async (
  contextValue: string,
  input: RecommendationMerchandisingInput,
  actorId?: string,
) => {
  if (!isContext(contextValue)) throw new RecommendationServiceError('Invalid recommendation context', 400);
  const productIds = parseProductIds(input.pinnedProductIds ?? []);
  const startsAt = parseDate(input.startsAt, 'startsAt');
  const endsAt = parseDate(input.endsAt, 'endsAt');
  if (startsAt && endsAt && endsAt <= startsAt) {
    throw new RecommendationServiceError('endsAt must be after startsAt', 400);
  }

  const products = await Product.find({
    _id: { $in: productIds.map((id) => new Types.ObjectId(id)) },
    isActive: true,
  }).select('_id').lean<Array<{ _id: Types.ObjectId }>>();
  if (products.length !== productIds.length) {
    throw new RecommendationServiceError('Pinned products must exist and be active', 400);
  }

  await RecommendationMerchandisingRule.findOneAndUpdate(
    { context: contextValue },
    {
      $set: {
        pinnedProductIds: productIds.map((id) => new Types.ObjectId(id)),
        enabled: typeof input.enabled === 'boolean' ? input.enabled : true,
        startsAt,
        endsAt,
        updatedBy: actorId && Types.ObjectId.isValid(actorId) ? new Types.ObjectId(actorId) : null,
      },
    },
    { upsert: true, returnDocument: 'after', runValidators: true, setDefaultsOnInsert: true },
  );

  return (await listRules()).find((rule) => rule.context === contextValue);
};

export const recommendationMerchandisingService = { listRules, updateRule };
