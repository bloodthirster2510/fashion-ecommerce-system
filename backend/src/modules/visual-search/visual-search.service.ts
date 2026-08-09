import axios from 'axios';
import crypto from 'crypto';
import { Types } from 'mongoose';
import {
  Inventory,
  Product,
  ProductVisualIndex,
  type ProductVisualGender,
  type ProductVisualImageSource,
} from '../../database/models';
import type { IProductVariant } from '../../database/models/product.model';
import type { ProductListItem } from '../catalog/products/product.types';
import type {
  VisualEmbeddingInput,
  VisualEmbeddingProvider,
  VisualEmbeddingResult,
  VisualGalleryItem,
  VisualIndexBackfillOptions,
  VisualSearchImageInput,
  VisualSearchQueryOptions,
  VisualSearchResponse,
  VisualSearchResultItem,
  VisualSearchTextInput,
} from './visual-search.types';

type PopulatedRelation = {
  _id: Types.ObjectId;
  name?: string;
  gender?: string;
  image?: string;
};

type ProductForVisualSearch = {
  _id: Types.ObjectId;
  name: string;
  product_image: string;
  category_id: Types.ObjectId | PopulatedRelation | null;
  brand_id: Types.ObjectId | PopulatedRelation | null;
  variant: IProductVariant[];
  isActive: boolean;
};

type InventoryForVisualSearch = {
  productId: Types.ObjectId;
  variantId: Types.ObjectId;
  colorVariantId: Types.ObjectId;
  availableQuantity: number;
};

type InventoryForVisualResult = InventoryForVisualSearch & {
  size: string;
};

type ProductForVisualResult = ProductForVisualSearch & {
  sold_quantity: number;
  averageRating: number;
  reviewCount: number;
  createdAt: Date;
  updatedAt: Date;
};

type VisualIndexDocument = {
  galleryImageId: string;
  productId: Types.ObjectId;
  variantId?: Types.ObjectId | null;
  colorVariantId?: Types.ObjectId | null;
  imageUrl: string;
  embedding: number[];
  embeddingDimension: number;
  embeddingModel: string;
  embeddingVersion: string;
  categoryId?: Types.ObjectId | null;
  brandId?: Types.ObjectId | null;
  gender?: ProductVisualGender | null;
  color?: string | null;
  finalPrice?: number | null;
  availableQuantity: number;
  source: ProductVisualImageSource;
};

type ScoredVisualIndexItem = {
  item: VisualIndexDocument;
  visualScore: number;
  finalVisualScore: number;
};

const DEFAULT_MOCK_DIMENSION = 64;
const DEFAULT_MODEL = 'mock-fashionclip';
const DEFAULT_MODEL_VERSION = 'v2';
const DEFAULT_HTTP_TIMEOUT_MS = 30_000;
const DEFAULT_SEARCH_LIMIT = 20;
const MAX_SEARCH_LIMIT = 50;
const DEFAULT_SCORE_THRESHOLD = 0;
const MAX_SEARCH_CANDIDATES = 5_000;

export class VisualSearchServiceError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly errorCode?: string,
  ) {
    super(message);
    this.name = 'VisualSearchServiceError';
  }
}

const getProvider = (): VisualEmbeddingProvider => {
  const provider = process.env.VISUAL_EMBEDDING_PROVIDER?.trim().toLowerCase();
  return provider === 'http' ? 'http' : 'mock';
};

const getModel = () => process.env.VISUAL_EMBEDDING_MODEL?.trim() || DEFAULT_MODEL;
const getModelVersion = () => process.env.VISUAL_EMBEDDING_VERSION?.trim() || DEFAULT_MODEL_VERSION;
const getHttpTimeoutMs = () => Number(process.env.VISUAL_EMBEDDING_TIMEOUT_MS) || DEFAULT_HTTP_TIMEOUT_MS;
// Lấy ngưỡng điểm tối thiểu để loại bỏ các kết quả quá kém tương đồng.
const getScoreThreshold = (value?: number) => {
  if (value !== undefined) {
    return value;
  }

  const envValue = Number(process.env.VISUAL_SEARCH_SCORE_THRESHOLD);
  return Number.isFinite(envValue) ? envValue : DEFAULT_SCORE_THRESHOLD;
};

// Chuẩn hóa vector để việc so sánh ảnh ổn định hơn.
const normalizeVector = (vector: number[]) => {
  const norm = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));
  if (!norm) return vector;
  return vector.map((value) => Number((value / norm).toFixed(8)));
};

// Tạo hash ổn định cho ảnh. Ở giai đoạn này dùng URL để nhận diện ảnh.
const createImageHash = (imageUrl: string) =>
  crypto.createHash('sha256').update(imageUrl.trim()).digest('hex');

// Tạo mã nhận diện cho ảnh người dùng upload dựa trên nội dung file.
const createBufferHash = (buffer: Buffer) =>
  crypto.createHash('sha256').update(buffer).digest('hex');

// Tạo embedding giả lập để kiểm chứng pipeline khi chưa bật FashionCLIP thật.
const createMockEmbedding = (input: VisualEmbeddingInput): VisualEmbeddingResult => {
  const seedHash = crypto.createHash('sha512');

  if (input.text) {
    seedHash.update(input.text.trim().toLowerCase());
  }

  if (input.imageBuffer) {
    seedHash.update(input.imageBuffer);
  }

  seedHash.update(`${input.imageHash ?? ''}|${input.imageUrl ?? ''}|${input.fileName ?? ''}`);
  const seed = seedHash.digest();
  const embedding = Array.from({ length: DEFAULT_MOCK_DIMENSION }, (_, index) => {
    const byte = seed[index % seed.length];
    return byte / 127.5 - 1;
  });

  return {
    embedding: normalizeVector(embedding),
    embeddingDimension: DEFAULT_MOCK_DIMENSION,
    embeddingModel: getModel(),
    embeddingVersion: getModelVersion(),
    provider: 'mock',
  };
};

// Chuẩn hóa dữ liệu trả về từ service Python về đúng dạng backend cần dùng.
const normalizeHttpEmbeddingResponse = (data: {
  embedding: number[];
  embeddingDimension?: number;
  embeddingModel?: string;
  embeddingVersion?: string;
}): VisualEmbeddingResult => {
  const embedding = normalizeVector(data.embedding ?? []);

  if (!embedding.length) {
    throw new VisualSearchServiceError(
      'Embedding service returned an empty embedding',
      502,
      'VISUAL_EMBEDDING_EMPTY',
    );
  }

  return {
    embedding,
    embeddingDimension: data.embeddingDimension ?? embedding.length,
    embeddingModel: data.embeddingModel ?? getModel(),
    embeddingVersion: data.embeddingVersion ?? getModelVersion(),
    provider: 'http',
  };
};

// Đổi lỗi từ service Python thành lỗi dễ hiểu hơn cho API visual search.
const handleHttpEmbeddingError = (error: unknown): never => {
  if (axios.isAxiosError(error)) {
    if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
      throw new VisualSearchServiceError(
        'Embedding service timeout',
        504,
        'VISUAL_EMBEDDING_TIMEOUT',
      );
    }

    const status = error.response?.status;
    const detail = error.response?.data && typeof error.response.data === 'object'
      ? (error.response.data as { detail?: string }).detail
      : undefined;

    throw new VisualSearchServiceError(
      detail || 'Không thể tạo embedding cho truy vấn tìm kiếm.',
      status && status >= 400 && status < 500 ? 400 : 502,
      'VISUAL_EMBEDDING_FAILED',
    );
  }

  throw error;
};

// Gọi embedding service Python/FastAPI khi cần dùng FashionCLIP/OpenFashionCLIP.
const callHttpEmbeddingService = async (input: VisualEmbeddingInput): Promise<VisualEmbeddingResult> => {
  const serviceUrl = process.env.VISUAL_EMBEDDING_SERVICE_URL?.trim();
  if (!serviceUrl) {
    throw new VisualSearchServiceError(
      'VISUAL_EMBEDDING_SERVICE_URL is required when VISUAL_EMBEDDING_PROVIDER=http',
      500,
      'VISUAL_EMBEDDING_CONFIG_MISSING',
    );
  }

  try {
    if (input.text) {
      const response = await axios.post<{
        embedding: number[];
        embeddingDimension?: number;
        embeddingModel?: string;
        embeddingVersion?: string;
      }>(
        `${serviceUrl.replace(/\/$/, '')}/embed/text`,
        {
          text: input.text,
          model: getModel(),
          modelVersion: getModelVersion(),
        },
        { timeout: getHttpTimeoutMs() },
      );

      return normalizeHttpEmbeddingResponse(response.data);
    }

    if (input.imageBuffer) {
      const formData = new FormData();
      formData.append(
        'file',
        new Blob([input.imageBuffer], { type: input.mimeType ?? 'application/octet-stream' }),
        input.fileName ?? 'query-image',
      );

      const response = await axios.post<{
        embedding: number[];
        embeddingDimension?: number;
        embeddingModel?: string;
        embeddingVersion?: string;
      }>(
        `${serviceUrl.replace(/\/$/, '')}/embed/image`,
        formData,
        { timeout: getHttpTimeoutMs() },
      );

      return normalizeHttpEmbeddingResponse(response.data);
    }

    if (!input.imageUrl) {
      throw new VisualSearchServiceError('Image URL, image file, or text is required', 400, 'VISUAL_QUERY_MISSING');
    }

    const response = await axios.post<{
      embedding: number[];
      embeddingDimension?: number;
      embeddingModel?: string;
      embeddingVersion?: string;
    }>(
      `${serviceUrl.replace(/\/$/, '')}/embed/image-url`,
      {
        imageUrl: input.imageUrl,
        imageHash: input.imageHash,
        model: getModel(),
        modelVersion: getModelVersion(),
      },
      { timeout: getHttpTimeoutMs() },
    );

    return normalizeHttpEmbeddingResponse(response.data);
  } catch (error) {
    return handleHttpEmbeddingError(error);
  }
};

// Chọn cách tạo embedding: mock để kiểm thử pipeline hoặc HTTP để dùng model thật.
const createEmbedding = async (input: VisualEmbeddingInput) => {
  const provider = getProvider();

  if (provider === 'http') {
    return callHttpEmbeddingService(input);
  }

  return createMockEmbedding(input);
};

// Tính giá sau giảm để kết quả visual search hiển thị giống catalog.
const getFinalPrice = (price: number, discount: number) => {
  if (discount <= 0) return price;
  return Math.round(price * (1 - discount / 100));
};

// Đánh dấu sản phẩm mới theo cùng cách hiển thị ở catalog.
const isNewProduct = (createdAt: Date) => {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 30);
  return createdAt >= cutoff;
};

// Giới hạn số kết quả trả về để API không bị gọi quá nặng.
const clampSearchLimit = (limit?: number) => {
  if (!limit) {
    return DEFAULT_SEARCH_LIMIT;
  }

  return Math.min(Math.max(Math.floor(limit), 1), MAX_SEARCH_LIMIT);
};

const roundScore = (value: number) => Number(value.toFixed(6));

// Tính mức độ giống nhau giữa ảnh truy vấn và ảnh sản phẩm.
const cosineSimilarity = (first: number[], second: number[]) => {
  const dimension = Math.min(first.length, second.length);
  if (!dimension) {
    return 0;
  }

  let dot = 0;
  let firstNorm = 0;
  let secondNorm = 0;

  for (let index = 0; index < dimension; index += 1) {
    const firstValue = first[index] ?? 0;
    const secondValue = second[index] ?? 0;
    dot += firstValue * secondValue;
    firstNorm += firstValue * firstValue;
    secondNorm += secondValue * secondValue;
  }

  if (!firstNorm || !secondNorm) {
    return 0;
  }

  return dot / (Math.sqrt(firstNorm) * Math.sqrt(secondNorm));
};

// Kiểm tra và chuyển danh sách id filter sang ObjectId của MongoDB.
const toObjectIdList = (values: string[] | undefined, fieldName: string) => {
  if (!values?.length) {
    return undefined;
  }

  return values.map((value) => {
    const trimmedValue = value.trim();
    if (!Types.ObjectId.isValid(trimmedValue)) {
      throw new VisualSearchServiceError(`Invalid ${fieldName}`, 400, 'VISUAL_SEARCH_INVALID_FILTER');
    }

    return new Types.ObjectId(trimmedValue);
  });
};

// Tạo danh sách điều kiện so khớp chữ, ví dụ màu sắc.
const toRegexList = (values?: string[]) => {
  if (!values?.length) {
    return undefined;
  }

  return values
    .map((value) => value.trim())
    .filter(Boolean)
    .map((value) => new RegExp(`^${value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'));
};

// Tạo bộ lọc visual index từ model hiện tại và các filter người dùng chọn.
const buildVisualIndexFilter = (
  embeddingResult: VisualEmbeddingResult,
  options: VisualSearchQueryOptions,
) => {
  const categoryIds = toObjectIdList(options.categoryId, 'categoryId');
  const brandIds = toObjectIdList(options.brandId, 'brandId');
  const colors = toRegexList(options.color);
  const finalPriceFilter: Record<string, number> = {};
  const filter: Record<string, unknown> = {
    isActive: true,
    embeddingDimension: embeddingResult.embeddingDimension,
    embeddingModel: embeddingResult.embeddingModel,
    embeddingVersion: embeddingResult.embeddingVersion,
  };

  if (categoryIds?.length) {
    filter.categoryId = { $in: categoryIds };
  }

  if (brandIds?.length) {
    filter.brandId = { $in: brandIds };
  }

  if (options.gender) {
    filter.gender = options.gender;
  }

  if (colors?.length) {
    filter.color = { $in: colors };
  }

  if (options.minPrice !== undefined) {
    finalPriceFilter.$gte = options.minPrice;
  }

  if (options.maxPrice !== undefined) {
    finalPriceFilter.$lte = options.maxPrice;
  }

  if (Object.keys(finalPriceFilter).length) {
    filter.finalPrice = finalPriceFilter;
  }

  return filter;
};

// Cộng điểm nhẹ cho sản phẩm còn hàng hoặc khớp màu đang lọc.
const getCandidateBoost = (item: VisualIndexDocument, options: VisualSearchQueryOptions) => {
  let boost = item.availableQuantity > 0 ? 0.03 : 0;
  const selectedColors = options.color?.map((color) => color.trim().toLowerCase()).filter(Boolean) ?? [];

  if (
    selectedColors.length &&
    item.color &&
    selectedColors.includes(item.color.trim().toLowerCase())
  ) {
    boost += 0.02;
  }

  return boost;
};

// Mỗi sản phẩm có thể có nhiều ảnh, hàm này chỉ giữ ảnh khớp nhất cho mỗi sản phẩm.
const groupCandidatesByProduct = (candidates: ScoredVisualIndexItem[]) => {
  const bestByProductId = new Map<string, ScoredVisualIndexItem>();

  candidates.forEach((candidate) => {
    const productId = candidate.item.productId.toString();
    const existingCandidate = bestByProductId.get(productId);

    if (!existingCandidate || candidate.finalVisualScore > existingCandidate.finalVisualScore) {
      bestByProductId.set(productId, candidate);
    }
  });

  return Array.from(bestByProductId.values()).sort(
    (first, second) => second.finalVisualScore - first.finalVisualScore,
  );
};

// Tìm các ảnh sản phẩm gần giống ảnh truy vấn trong ProductVisualIndex.
const searchSimilarIndexItems = async (
  embeddingResult: VisualEmbeddingResult,
  options: VisualSearchQueryOptions,
) => {
  const scoreThreshold = getScoreThreshold(options.scoreThreshold);
  const filter = buildVisualIndexFilter(embeddingResult, options);
  const rawCandidates = await ProductVisualIndex.find(filter)
    .select(
      'galleryImageId productId variantId colorVariantId imageUrl embedding embeddingDimension embeddingModel embeddingVersion categoryId brandId gender color finalPrice availableQuantity source',
    )
    .limit(MAX_SEARCH_CANDIDATES)
    .lean<VisualIndexDocument[]>();

  const scoredCandidates = rawCandidates
    .map((item) => {
      const visualScore = cosineSimilarity(embeddingResult.embedding, item.embedding);
      return {
        item,
        visualScore,
        finalVisualScore: visualScore + getCandidateBoost(item, options),
      };
    })
    .filter((candidate) => candidate.visualScore >= scoreThreshold);

  return {
    candidateCount: rawCandidates.length,
    scoreThreshold,
    candidates: groupCandidatesByProduct(scoredCandidates),
  };
};

// Lấy ObjectId từ dữ liệu có thể là ObjectId thuần hoặc object đã populate.
const toObjectIdOrNull = (value: unknown) => {
  if (!value) return null;
  if (value instanceof Types.ObjectId) return value;
  if (typeof value === 'object' && '_id' in value && value._id instanceof Types.ObjectId) {
    return value._id;
  }
  return null;
};

// Lấy giới tính từ category đã populate để lưu vào visual index.
const getGender = (value: unknown): ProductVisualGender | null => {
  if (!value || typeof value !== 'object' || !('gender' in value)) return null;
  const gender = value.gender;
  return gender === 'male' || gender === 'female' || gender === 'unisex' ? gender : null;
};

const getInventoryKey = (productId: string, variantId = '', colorVariantId = '') =>
  [productId, variantId, colorVariantId].join('|');

// Gom tồn kho theo sản phẩm và theo biến thể màu để phục vụ backfill.
const buildInventoryMaps = (items: InventoryForVisualSearch[]) => {
  const productTotals = new Map<string, number>();
  const colorTotals = new Map<string, number>();

  items.forEach((item) => {
    const productId = item.productId.toString();
    const variantId = item.variantId.toString();
    const colorVariantId = item.colorVariantId.toString();
    const availableQuantity = Math.max(0, item.availableQuantity);

    productTotals.set(
      getInventoryKey(productId),
      (productTotals.get(getInventoryKey(productId)) ?? 0) + availableQuantity,
    );
    colorTotals.set(
      getInventoryKey(productId, variantId, colorVariantId),
      (colorTotals.get(getInventoryKey(productId, variantId, colorVariantId)) ?? 0) + availableQuantity,
    );
  });

  return { productTotals, colorTotals };
};

// Chọn một biến thể đại diện khi cần lấy giá hiển thị cho ảnh chính.
const getDisplayVariant = (variants: IProductVariant[]) =>
  variants.find((variant) => variant.isActive) ?? variants[0];

// Tạo danh sách ảnh cần index từ ảnh chính và ảnh theo màu của sản phẩm.
const buildGalleryItems = (
  products: ProductForVisualSearch[],
  inventoryItems: InventoryForVisualSearch[],
): VisualGalleryItem[] => {
  const { productTotals, colorTotals } = buildInventoryMaps(inventoryItems);
  const items: VisualGalleryItem[] = [];

  products.forEach((product) => {
    const productId = product._id.toString();
    const categoryId = toObjectIdOrNull(product.category_id);
    const brandId = toObjectIdOrNull(product.brand_id);
    const gender = getGender(product.category_id);
    const displayVariant = getDisplayVariant(product.variant ?? []);

    if (product.product_image?.trim()) {
      items.push({
        galleryImageId: `${productId}:product_image`,
        productId: product._id,
        imageUrl: product.product_image.trim(),
        imageHash: createImageHash(product.product_image),
        categoryId,
        brandId,
        gender,
        color: null,
        price: displayVariant?.price ?? null,
        discount: displayVariant?.discount ?? null,
        finalPrice: displayVariant ? getFinalPrice(displayVariant.price, displayVariant.discount) : null,
        isActive: product.isActive,
        availableQuantity: productTotals.get(getInventoryKey(productId)) ?? 0,
        source: 'product_image',
      });
    }

    (product.variant ?? []).forEach((variant) => {
      const variantId = variant._id;
      const variantIdString = variantId.toString();

      variant.colors.forEach((color) => {
        if (!color.image?.trim()) {
          return;
        }

        const colorVariantId = color._id;
        const colorVariantIdString = colorVariantId.toString();

        items.push({
          galleryImageId: `${productId}:${variantIdString}:${colorVariantIdString}`,
          productId: product._id,
          variantId,
          colorVariantId,
          imageUrl: color.image.trim(),
          imageHash: createImageHash(color.image),
          categoryId,
          brandId,
          gender,
          color: color.color,
          price: variant.price,
          discount: variant.discount,
          finalPrice: getFinalPrice(variant.price, variant.discount),
          isActive: product.isActive && variant.isActive,
          availableQuantity: colorTotals.get(getInventoryKey(productId, variantIdString, colorVariantIdString)) ?? 0,
          source: 'color_variant_image',
        });
      });
    });
  });

  return items;
};

// Kiểm tra dữ liệu brand/category đã được populate hay chưa.
const isPopulatedRelation = (
  relation: Types.ObjectId | PopulatedRelation | null,
): relation is PopulatedRelation => {
  return Boolean(relation && !(relation instanceof Types.ObjectId) && '_id' in relation);
};

// Chuyển brand từ dữ liệu database sang dạng frontend catalog đang dùng.
const mapVisualBrand = (relation: ProductForVisualResult['brand_id']): ProductListItem['brand'] => {
  if (!isPopulatedRelation(relation) || !relation.name) {
    return null;
  }

  return {
    _id: relation._id.toString(),
    name: relation.name,
    image: relation.image,
  };
};

// Chuyển category từ dữ liệu database sang dạng frontend catalog đang dùng.
const mapVisualCategory = (relation: ProductForVisualResult['category_id']): ProductListItem['category'] => {
  if (!isPopulatedRelation(relation) || !relation.name) {
    return null;
  }

  const gender = relation.gender === 'male' || relation.gender === 'female' || relation.gender === 'unisex'
    ? relation.gender
    : undefined;

  return {
    _id: relation._id.toString(),
    name: relation.name,
    gender,
    image: relation.image,
  };
};

// Gom tồn kho theo productId để biết sản phẩm còn hàng hay không.
const groupInventoryForResults = (items: InventoryForVisualResult[]) => {
  const inventoryByProductId = new Map<string, InventoryForVisualResult[]>();

  items.forEach((item) => {
    const productId = item.productId.toString();
    const existingItems = inventoryByProductId.get(productId) ?? [];
    existingItems.push(item);
    inventoryByProductId.set(productId, existingItems);
  });

  return inventoryByProductId;
};

// Tính tổng tồn kho của một biến thể sản phẩm.
const getVariantAvailableQuantity = (
  variant: IProductVariant,
  inventoryItems: InventoryForVisualResult[],
) => {
  const variantId = variant._id.toString();

  return inventoryItems
    .filter((inventory) => inventory.variantId.toString() === variantId)
    .reduce((sum, inventory) => sum + Math.max(0, inventory.availableQuantity), 0);
};

// Ưu tiên biến thể đã match ảnh; nếu không có thì chọn biến thể còn hàng.
const selectVisualDisplayVariant = (
  product: ProductForVisualResult,
  candidate: ScoredVisualIndexItem,
  inventoryItems: InventoryForVisualResult[],
) => {
  const matchedVariantId = candidate.item.variantId?.toString();
  const matchedVariant = matchedVariantId
    ? product.variant.find((variant) => variant._id.toString() === matchedVariantId)
    : undefined;

  return (
    (matchedVariant?.isActive ? matchedVariant : undefined) ??
    product.variant.find((variant) => variant.isActive && getVariantAvailableQuantity(variant, inventoryItems) > 0) ??
    product.variant.find((variant) => variant.isActive) ??
    product.variant[0]
  );
};

// Tính tổng tồn kho của cả sản phẩm để hiển thị trạng thái còn hàng.
const getProductAvailableQuantity = (inventoryItems: InventoryForVisualResult[]) => {
  return inventoryItems.reduce((sum, inventory) => sum + Math.max(0, inventory.availableQuantity), 0);
};

// Tạo một item kết quả visual search theo đúng cấu trúc product card.
const mapVisualSearchProductItem = (
  product: ProductForVisualResult,
  candidate: ScoredVisualIndexItem,
  inventoryItems: InventoryForVisualResult[],
): VisualSearchResultItem => {
  const displayVariant = selectVisualDisplayVariant(product, candidate, inventoryItems);
  const originalPrice = displayVariant?.price ?? candidate.item.finalPrice ?? 0;
  const discount = displayVariant?.discount ?? 0;
  const ratingBoost = Math.max(0, Math.min(product.averageRating ?? 0, 5)) / 5 * 0.02;
  const finalVisualScore = candidate.finalVisualScore + ratingBoost;

  return {
    _id: product._id.toString(),
    name: product.name,
    image: candidate.item.imageUrl || displayVariant?.colors?.[0]?.image || product.product_image,
    price: originalPrice,
    originalPrice,
    discount,
    finalPrice: getFinalPrice(originalPrice, discount),
    isSale: discount > 0,
    isNew: isNewProduct(product.createdAt),
    isAvailable: getProductAvailableQuantity(inventoryItems) > 0,
    soldQuantity: product.sold_quantity,
    averageRating: product.averageRating,
    reviewCount: product.reviewCount,
    brand: mapVisualBrand(product.brand_id),
    category: mapVisualCategory(product.category_id),
    visualScore: roundScore(candidate.visualScore),
    finalVisualScore: roundScore(finalVisualScore),
    matchedImage: candidate.item.imageUrl,
    matchedGalleryImageId: candidate.item.galleryImageId,
    matchedVariantId: candidate.item.variantId?.toString(),
    matchedColorVariantId: candidate.item.colorVariantId?.toString(),
    matchedColor: candidate.item.color ?? null,
    matchedSource: candidate.item.source,
  };
};

// Lấy đầy đủ thông tin sản phẩm, brand, category và tồn kho cho các kết quả đã match.
const hydrateVisualSearchResults = async (
  candidates: ScoredVisualIndexItem[],
  limit: number,
) => {
  const candidatePool = candidates.slice(0, limit * 3);
  const productIds = candidatePool.map((candidate) => candidate.item.productId);

  if (!productIds.length) {
    return [];
  }

  const [products, inventoryItems] = await Promise.all([
    Product.find({ _id: { $in: productIds }, isActive: true })
      .populate('brand_id', '_id name image')
      .populate('category_id', '_id name gender image')
      .lean<ProductForVisualResult[]>(),
    Inventory.find({ productId: { $in: productIds } })
      .select('productId variantId colorVariantId size availableQuantity')
      .lean<InventoryForVisualResult[]>(),
  ]);
  const productById = new Map(products.map((product) => [product._id.toString(), product]));
  const inventoryByProductId = groupInventoryForResults(inventoryItems);

  return candidatePool
    .flatMap((candidate) => {
      const product = productById.get(candidate.item.productId.toString());

      if (!product) {
        return [];
      }

      const productInventory = inventoryByProductId.get(product._id.toString()) ?? [];
      return [mapVisualSearchProductItem(product, candidate, productInventory)];
    })
    .sort((first, second) => second.finalVisualScore - first.finalVisualScore)
    .slice(0, limit);
};

// Lấy toàn bộ sản phẩm cần index và chuyển thành danh sách ảnh gallery.
const getGalleryItems = async (options: VisualIndexBackfillOptions = {}) => {
  const query = Product.find(options.activeOnly ? { isActive: true } : {})
    .populate('category_id', '_id gender')
    .populate('brand_id', '_id')
    .sort({ createdAt: -1 });

  if (options.limit) {
    query.limit(options.limit);
  }

  const products = await query.lean<ProductForVisualSearch[]>();
  const productIds = products.map((product) => product._id);
  const inventoryItems = productIds.length
    ? await Inventory.find({ productId: { $in: productIds } })
        .select('productId variantId colorVariantId availableQuantity')
        .lean<InventoryForVisualSearch[]>()
    : [];

  return {
    products,
    galleryItems: buildGalleryItems(products, inventoryItems),
  };
};

// Lưu hoặc cập nhật một ảnh trong visual index, tránh tạo trùng khi chạy lại.
const upsertVisualIndexItem = async (
  item: VisualGalleryItem,
  embeddingResult: VisualEmbeddingResult,
  dryRun?: boolean,
) => {
  if (dryRun) {
    return;
  }

  const now = new Date();

  await ProductVisualIndex.updateOne(
    {
      galleryImageId: item.galleryImageId,
      embeddingModel: embeddingResult.embeddingModel,
      embeddingVersion: embeddingResult.embeddingVersion,
    },
    {
      $set: {
        ...item,
        variantId: item.variantId ?? null,
        colorVariantId: item.colorVariantId ?? null,
        categoryId: item.categoryId ?? null,
        brandId: item.brandId ?? null,
        gender: item.gender ?? null,
        color: item.color ?? null,
        price: item.price ?? null,
        discount: item.discount ?? null,
        finalPrice: item.finalPrice ?? null,
        embedding: embeddingResult.embedding,
        embeddingDimension: embeddingResult.embeddingDimension,
        embeddingModel: embeddingResult.embeddingModel,
        embeddingVersion: embeddingResult.embeddingVersion,
        indexedAt: now,
        lastSyncedAt: now,
      },
    },
    { upsert: true },
  );
};

// Ẩn các bản ghi index không còn tương ứng với ảnh sản phẩm hiện tại.
const deactivateStaleVisualIndexItems = async (
  galleryItems: VisualGalleryItem[],
  model: string,
  modelVersion: string,
  dryRun?: boolean,
) => {
  if (dryRun) {
    return 0;
  }

  const activeGalleryImageIds = galleryItems
    .filter((item) => item.isActive)
    .map((item) => item.galleryImageId);

  const result = await ProductVisualIndex.updateMany(
    {
      embeddingModel: model,
      embeddingVersion: modelVersion,
      isActive: true,
      ...(activeGalleryImageIds.length ? { galleryImageId: { $nin: activeGalleryImageIds } } : {}),
    },
    {
      $set: {
        isActive: false,
        lastSyncedAt: new Date(),
      },
    },
  );

  return result.modifiedCount;
};

const searchByEmbedding = async (
  searchType: 'image' | 'text',
  embeddingResult: VisualEmbeddingResult,
  embeddingTimeMs: number,
  startedAt: number,
  options: VisualSearchQueryOptions = {},
): Promise<VisualSearchResponse> => {
  const limit = clampSearchLimit(options.limit);

  const searchStartedAt = Date.now();
  const { candidates, candidateCount, scoreThreshold } = await searchSimilarIndexItems(
    embeddingResult,
    options,
  );
  const searchTimeMs = Date.now() - searchStartedAt;

  const hydrateStartedAt = Date.now();
  const items = await hydrateVisualSearchResults(candidates, limit);
  const hydrateTimeMs = Date.now() - hydrateStartedAt;

  return {
    items,
    pagination: {
      page: 1,
      limit,
      totalItems: items.length,
      totalPages: 1,
    },
    query: {
      searchType,
      model: embeddingResult.embeddingModel,
      modelVersion: embeddingResult.embeddingVersion,
      provider: embeddingResult.provider,
      processingTimeMs: Date.now() - startedAt,
      embeddingTimeMs,
      searchTimeMs,
      hydrateTimeMs,
      scoreThreshold,
      candidateCount,
    },
  };
};

// Luồng chính khi người dùng upload ảnh để tìm sản phẩm tương tự.
const searchByImage = async (
  image: VisualSearchImageInput,
  options: VisualSearchQueryOptions = {},
): Promise<VisualSearchResponse> => {
  if (!image.buffer?.length) {
    throw new VisualSearchServiceError('Image file is required', 400, 'VISUAL_IMAGE_REQUIRED');
  }

  const startedAt = Date.now();
  const embeddingStartedAt = Date.now();
  const embeddingResult = await createEmbedding({
    imageBuffer: image.buffer,
    fileName: image.originalName,
    mimeType: image.mimeType,
    imageHash: createBufferHash(image.buffer),
  });
  const embeddingTimeMs = Date.now() - embeddingStartedAt;

  return searchByEmbedding('image', embeddingResult, embeddingTimeMs, startedAt, options);
};

// Luồng text-to-image: mã hóa mô tả bằng FashionCLIP rồi so với index ảnh sản phẩm.
const searchByText = async (
  input: VisualSearchTextInput,
  options: VisualSearchQueryOptions = {},
): Promise<VisualSearchResponse> => {
  const text = input.text.trim();
  if (text.length < 2) {
    throw new VisualSearchServiceError('Text query must contain at least 2 characters', 400, 'VISUAL_TEXT_REQUIRED');
  }

  const startedAt = Date.now();
  const embeddingStartedAt = Date.now();
  const embeddingResult = await createEmbedding({ text });
  const embeddingTimeMs = Date.now() - embeddingStartedAt;

  return searchByEmbedding('text', embeddingResult, embeddingTimeMs, startedAt, options);
};

// Tạo lại visual index từ ảnh sản phẩm hiện có trong catalog.
const backfillVisualIndex = async (options: VisualIndexBackfillOptions = {}) => {
  const provider = getProvider();
  const { products, galleryItems } = await getGalleryItems(options);
  let indexed = 0;
  let failed = 0;
  const failures: Array<{ galleryImageId: string; imageUrl: string; message: string }> = [];

  for (const item of galleryItems) {
    try {
      const embeddingResult = await createEmbedding({
        imageUrl: item.imageUrl,
        imageHash: item.imageHash,
      });
      await upsertVisualIndexItem(item, embeddingResult, options.dryRun);
      indexed += 1;
    } catch (error) {
      failed += 1;
      failures.push({
        galleryImageId: item.galleryImageId,
        imageUrl: item.imageUrl,
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
  const staleDeactivated = options.limit
    ? 0
    : await deactivateStaleVisualIndexItems(
        galleryItems,
        getModel(),
        getModelVersion(),
        options.dryRun,
      );

  return {
    dryRun: Boolean(options.dryRun),
    activeOnly: Boolean(options.activeOnly),
    productCount: products.length,
    imageCount: galleryItems.length,
    indexed,
    staleDeactivated,
    failed,
    model: getModel(),
    modelVersion: getModelVersion(),
    provider,
    failures,
  };
};

export const visualSearchService = {
  backfillVisualIndex,
  createEmbedding,
  createImageHash,
  searchByImage,
  searchByText,
  normalizeVector,
};
