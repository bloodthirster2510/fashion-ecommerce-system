import type { Request, Response } from 'express';
import { ProductServiceError, productService } from './product.service';
import { suggest as suggestProducts } from './product.suggest.service';
import type {
  CreateProductInput,
  ProductGenderFilter,
  ProductListQueryInput,
  ProductSortOption,
  ProductVariantInput,
  UpdateProductInput,
} from './product.types';
import { uploadToCloudinary, deleteFromCloudinary, extractPublicIdFromUrl } from '../../../utils/cloudinary.util';
import { handleMulterError, type MulterRequest } from '../../../middlewares/upload.middleware';
import type { IProductVariant } from '../../../database/models/product.model';
import { created, error as errorResponse, ok } from '../../../utils/response';
import { searchHistoryService } from '../../search-history/search-history.service';

const hasStatusCode = (value: unknown): value is { statusCode: number } => {
  return (
    typeof value === 'object' &&
    value !== null &&
    'statusCode' in value &&
    typeof value.statusCode === 'number'
  );
};

const getErrorResponse = (e: unknown) => {
  if (e instanceof ProductServiceError || hasStatusCode(e)) {
    if (e.statusCode >= 500) {
      console.error('Product controller error:', e);
      return {
        statusCode: e.statusCode,
        message: 'Internal Server Error',
      };
    }

    return {
      statusCode: e.statusCode,
      message: e instanceof Error ? e.message : 'An error occurred',
    };
  }

  console.error('Product controller error:', e);
  return {
    statusCode: 500,
    message: 'Internal Server Error',
  };
};

const getUploadedFiles = (req: Request, fieldName: string) => {
  if (!req.files || Array.isArray(req.files)) {
    return [];
  }

  return req.files[fieldName] ?? [];
};

const parseVariants = (value: unknown): ProductVariantInput[] | undefined => {
  if (value === undefined) {
    return undefined;
  }

  if (Array.isArray(value)) {
    return value as ProductVariantInput[];
  }

  if (typeof value === 'string') {
    const parsed = JSON.parse(value) as unknown;

    if (!Array.isArray(parsed)) {
      throw new ProductServiceError('Variant must be an array', 400);
    }

    return parsed as ProductVariantInput[];
  }

  throw new ProductServiceError('Variant must be an array or JSON string', 400);
};

const parseString = (value: unknown) => {
  if (Array.isArray(value)) {
    return parseString(value[0]);
  }

  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmedValue = value.trim();
  return trimmedValue || undefined;
};

const parseStringList = (value: unknown) => {
  const values = Array.isArray(value) ? value : typeof value === 'string' ? value.split(',') : [];

  return values
    .flatMap((item) => String(item).split(','))
    .map((item) => item.trim())
    .filter(Boolean);
};

const parseIntegerList = (value: unknown, fieldName: string) => {
  return parseStringList(value).map((item) => {
    const numericValue = Number(item);

    if (!Number.isInteger(numericValue) || numericValue < 0) {
      throw new ProductServiceError(`Invalid ${fieldName}`, 400);
    }

    return numericValue;
  });
};

const parsePositiveNumber = (value: unknown, fieldName: string) => {
  const stringValue = parseString(value);

  if (!stringValue) {
    return undefined;
  }

  const numericValue = Number(stringValue);

  if (!Number.isFinite(numericValue) || numericValue < 0) {
    throw new ProductServiceError(`Invalid ${fieldName}`, 400);
  }

  return numericValue;
};

const parsePositiveInteger = (value: unknown, fieldName: string) => {
  const numericValue = parsePositiveNumber(value, fieldName);

  if (numericValue === undefined) {
    return undefined;
  }

  if (!Number.isInteger(numericValue)) {
    throw new ProductServiceError(`Invalid ${fieldName}`, 400);
  }

  return numericValue;
};

const parseBoolean = (value: unknown, fieldName: string) => {
  if (typeof value === 'boolean') {
    return value;
  }

  const stringValue = parseString(value);

  if (stringValue === undefined) {
    return undefined;
  }

  if (stringValue === 'true') {
    return true;
  }

  if (stringValue === 'false') {
    return false;
  }

  throw new ProductServiceError(`Invalid ${fieldName}`, 400);
};

const parseGender = (value: unknown) => {
  const gender = parseString(value);

  if (!gender) {
    return undefined;
  }

  if (gender !== 'male' && gender !== 'female' && gender !== 'unisex') {
    throw new ProductServiceError('Invalid gender', 400);
  }

  return gender as ProductGenderFilter;
};

const parseSort = (value: unknown) => {
  const sort = parseString(value);

  if (!sort) {
    return undefined;
  }

  const allowedSorts: ProductSortOption[] = [
    'name_asc',
    'name_desc',
    'price_asc',
    'price_desc',
    'newest',
    'best_seller',
    'rating_desc',
  ];

  if (!allowedSorts.includes(sort as ProductSortOption)) {
    throw new ProductServiceError('Invalid sort', 400);
  }

  return sort as ProductSortOption;
};

const parseProductListQuery = (req: Request): ProductListQueryInput => {
  const categoryId = parseStringList(req.query.categoryId);
  const brandId = parseStringList(req.query.brandId);
  const color = parseStringList(req.query.color);
  const fitType = Array.from(new Set([
    ...parseStringList(req.query.fitTypeId),
    ...parseStringList(req.query.fitType),
  ]));
  const size = parseStringList(req.query.size);
  const minPrice = parsePositiveNumber(req.query.minPrice, 'minPrice');
  const maxPrice = parsePositiveNumber(req.query.maxPrice, 'maxPrice');
  const includeFilters = parseBoolean(req.query.includeFilters, 'includeFilters');

  if (minPrice !== undefined && maxPrice !== undefined && minPrice > maxPrice) {
    throw new ProductServiceError('Giá thấp nhất không được cao hơn giá cao nhất.', 400);
  }

  return {
    keyword: parseString(req.query.keyword),
    gender: parseGender(req.query.gender),
    ...(categoryId.length ? { categoryId } : {}),
    ...(brandId.length ? { brandId } : {}),
    ...(color.length ? { color } : {}),
    ...(fitType.length ? { fitType } : {}),
    ...(size.length ? { size } : {}),
    minPrice,
    maxPrice,
    isSale: parseBoolean(req.query.isSale, 'isSale'),
    isNew: parseBoolean(req.query.isNew, 'isNew'),
    sort: parseSort(req.query.sort),
    page: parsePositiveInteger(req.query.page, 'page'),
    limit: parsePositiveInteger(req.query.limit, 'limit'),
    ...(includeFilters !== undefined ? { includeFilters } : {}),
  };
};

const getSessionId = (req: Request) => parseString(req.headers['x-session-id']);

const trackKeywordSearch = (
  req: Request,
  query: ProductListQueryInput,
  products: Awaited<ReturnType<typeof productService.getProductList>>,
) => {
  if (!query.keyword || (query.page ?? 1) !== 1) return;

  const sessionId = getSessionId(req);
  if (!req.user?.userId && !sessionId) return;

  const resultLength = products.items.length;
  void searchHistoryService.recordSearchBestEffort({
    userId: req.user?.userId,
    sessionId,
    eventId: parseString(req.query.searchEventId),
    source: parseString(req.query.searchSource) as
      | 'catalog'
      | 'mobile_manual'
      | 'mobile_history'
      | 'mobile_suggestion'
      | 'api'
      | undefined,
    searchType: 'keyword',
    keyword: query.keyword,
    resultProducts: products.items.map((product, index) => ({
      productId: product._id,
      score: resultLength ? 1 - index / resultLength : 0,
    })),
    resultCount: products.pagination.totalItems,
  });
};

const uploadProductImage = async (file: Express.Multer.File) => {
  const uploadResult = await uploadToCloudinary(
    file.buffer,
    file.originalname,
    'fashion-ecommerce/products',
  );

  return uploadResult.secure_url;
};

const uploadVariantImages = async (
  variants: ProductVariantInput[] | undefined,
  variantImageFiles: Express.Multer.File[],
  variantImageIndexes: number[] = [],
) => {
  if (!variantImageFiles.length) {
    return {
      variants,
      uploadedImageUrls: [] as string[],
    };
  }

  if (!variants?.length) {
    throw new ProductServiceError('Variant data is required when uploading variant images', 400);
  }

  const colorCount = variants.reduce((total, variant) => total + variant.colors.length, 0);

  if (variantImageIndexes.length && variantImageIndexes.length !== variantImageFiles.length) {
    throw new ProductServiceError('Each uploaded variant image must include a matching index', 400);
  }

  if (!variantImageIndexes.length && variantImageFiles.length !== colorCount) {
    throw new ProductServiceError('Each product color must have exactly one uploaded image', 400);
  }

  if (variantImageIndexes.some((index) => index >= colorCount)) {
    throw new ProductServiceError('Variant image index is out of range', 400);
  }

  const uploadedImageUrls = await Promise.all(
    variantImageFiles.map((file) => uploadProductImage(file)),
  );

  let imageIndex = 0;
  const uploadedImagesByIndex = new Map<number, string>();

  if (variantImageIndexes.length) {
    variantImageIndexes.forEach((index, currentIndex) => {
      uploadedImagesByIndex.set(index, uploadedImageUrls[currentIndex]);
    });
  }

  return {
    variants: variants.map((variant) => ({
      ...variant,
      colors: variant.colors.map((color) => {
        const currentImageIndex = imageIndex++;
        return {
          ...color,
          image:
            uploadedImagesByIndex.get(currentImageIndex) ??
            (variantImageIndexes.length ? color.image : uploadedImageUrls[currentImageIndex]),
        };
      }),
    })),
    uploadedImageUrls,
  };
};

const deleteCloudinaryImage = async (imageUrl?: string | null) => {
  if (!imageUrl) {
    return;
  }

  try {
    const publicId = extractPublicIdFromUrl(imageUrl);
    await deleteFromCloudinary(publicId);
  } catch (error) {
    console.warn('Failed to delete image from Cloudinary:', error);
  }
};

const deleteProductImages = async (product: Awaited<ReturnType<typeof productService.getProductById>>) => {
  await deleteCloudinaryImage(product.product_image);

  await Promise.all(
    product.variant.flatMap((variant: IProductVariant) =>
      variant.colors.map((color) => deleteCloudinaryImage(color.image)),
    ),
  );
};

const createProduct = async (req: Request, res: Response) => {
  const uploadedImageUrls: string[] = [];

  try {
    const uploadReq = req as MulterRequest;
    const multerErrorResponse = handleMulterError(uploadReq.fileValidationError, res);
    if (multerErrorResponse) return;

    const input = {
      ...(req.body as CreateProductInput),
      variant: parseVariants(req.body.variant ?? req.body.version),
      isActive: parseBoolean(req.body.isActive, 'isActive'),
    };
    const productImageFile = getUploadedFiles(req, 'product_image')[0];
    const variantImageFiles = getUploadedFiles(req, 'version_images');
    const variantImageIndexes = parseIntegerList(req.body.version_image_indexes, 'version_image_indexes');

    if (!input.category_id || !input.name || !input.brand_id || !input.description) {
      return errorResponse(res, 'Category, name, brand, and description are required', 400);
    }

    let productImageUrl: string;
    if (productImageFile) {
      productImageUrl = await uploadProductImage(productImageFile);
      uploadedImageUrls.push(productImageUrl);
    } else if (input.product_image) {
      productImageUrl = input.product_image;
    } else {
      return errorResponse(res, 'Product image is required (upload file or provide image URL)', 400);
    }

    const { variants: variant, uploadedImageUrls: uploadedVariantImageUrls } =
      await uploadVariantImages(input.variant, variantImageFiles, variantImageIndexes);
    uploadedImageUrls.push(...uploadedVariantImageUrls);

    const productInput: CreateProductInput = {
      ...input,
      product_image: productImageUrl,
      variant,
    };

    const product = await productService.createProduct(productInput);

    return created(res, product);
  } catch (e: unknown) {
    await Promise.all(uploadedImageUrls.map((url) => deleteCloudinaryImage(url)));
    const { statusCode, message } = getErrorResponse(e);
    return errorResponse(res, message, statusCode);
  }
};

const updateProduct = async (req: Request, res: Response) => {
  const uploadedImageUrls: string[] = [];
  let replacedProductImageUrl: string | undefined;

  try {
    const uploadReq = req as MulterRequest;
    const multerErrorResponse = handleMulterError(uploadReq.fileValidationError, res);
    if (multerErrorResponse) return;

    const productId = req.params.id as string;
    const input = {
      ...(req.body as UpdateProductInput),
      variant: parseVariants(req.body.variant ?? req.body.version),
      isActive: parseBoolean(req.body.isActive, 'isActive'),
    };
    const productImageFile = getUploadedFiles(req, 'product_image')[0];
    const variantImageFiles = getUploadedFiles(req, 'version_images');
    const variantImageIndexes = parseIntegerList(req.body.version_image_indexes, 'version_image_indexes');
    const updateData: UpdateProductInput = {};

    if (input.category_id !== undefined) updateData.category_id = input.category_id;
    if (input.name !== undefined) updateData.name = input.name;
    if (input.brand_id !== undefined) updateData.brand_id = input.brand_id;
    if (input.description !== undefined) updateData.description = input.description;
    if (input.isActive !== undefined) updateData.isActive = input.isActive;

    const shouldReplaceProductImage = Boolean(productImageFile);
    const shouldReplaceVariants = input.variant !== undefined || variantImageFiles.length > 0;
    const currentProduct =
      shouldReplaceProductImage || shouldReplaceVariants
        ? await productService.getProductById(productId)
        : null;

    if (productImageFile) {
      updateData.product_image = await uploadProductImage(productImageFile);
      uploadedImageUrls.push(updateData.product_image);
      replacedProductImageUrl = currentProduct?.product_image;
    } else if (input.product_image !== undefined) {
      updateData.product_image = input.product_image;
    }

    const { variants: variant, uploadedImageUrls: uploadedVariantImageUrls } =
      await uploadVariantImages(input.variant, variantImageFiles, variantImageIndexes);
    uploadedImageUrls.push(...uploadedVariantImageUrls);

    if (input.variant !== undefined) {
      updateData.variant = variant;
    }

    if (Object.keys(updateData).length === 0) {
      return errorResponse(res, 'No data to update', 400);
    }

    const product = await productService.updateProduct(productId, updateData);
    if (replacedProductImageUrl && replacedProductImageUrl !== updateData.product_image) {
      await deleteCloudinaryImage(replacedProductImageUrl);
    }

    return ok(res, product);
  } catch (e: unknown) {
    await Promise.all(uploadedImageUrls.map((url) => deleteCloudinaryImage(url)));
    const { statusCode, message } = getErrorResponse(e);
    return errorResponse(res, message, statusCode);
  }
};

const deleteProduct = async (req: Request, res: Response) => {
  try {
    const productId = req.params.id as string;

    const updatedProduct = await productService.deleteProduct(productId);

    return ok(res, updatedProduct);
  } catch (e: unknown) {
    const { statusCode, message } = getErrorResponse(e);
    return errorResponse(res, message, statusCode);
  }
};

const getProducts = async (_req: Request, res: Response) => {
  try {
    const products = await productService.getManagementProducts();

    return ok(res, products);
  } catch (e: unknown) {
    const { statusCode, message } = getErrorResponse(e);
    return errorResponse(res, message, statusCode);
  }
};

const getProductList = async (req: Request, res: Response) => {
  try {
    const query = parseProductListQuery(req);
    const products = await productService.getProductList(query);
    trackKeywordSearch(req, query, products);

    return ok(res, products);
  } catch (e: unknown) {
    const { statusCode, message } = getErrorResponse(e);
    return errorResponse(res, message, statusCode);
  }
};

const permanentlyDeleteProduct = async (req: Request, res: Response) => {
  try {
    const productId = req.params.id as string;

    const product = await productService.getProductById(productId);
    const deletedProduct = await productService.permanentlyDeleteProduct(productId);
    await deleteProductImages(product);

    return ok(res, deletedProduct);
  } catch (e: unknown) {
    const { statusCode, message } = getErrorResponse(e);
    return errorResponse(res, message, statusCode);
  }
};

const getProductFilters = async (req: Request, res: Response) => {
  try {
    const filters = await productService.getProductFilters(parseProductListQuery(req));
    return ok(res, filters);
  } catch (e: unknown) {
    const { statusCode, message } = getErrorResponse(e);
    return errorResponse(res, message, statusCode);
  }
};

const getProductById = async (req: Request, res: Response) => {
  try {
    const productId = req.params.id as string;
    const isAdminRequest = req.originalUrl.includes('/admin/products');
    const product = await productService.getProductDetailById(productId, {
      activeOnly: !isAdminRequest,
    });

    return ok(res, product);
  } catch (e: unknown) {
    const { statusCode, message } = getErrorResponse(e);
    return errorResponse(res, message, statusCode);
  }
};

const suggestSearch = async (req: Request, res: Response) => {
  try {
    const keyword = parseString(req.query.q) || parseString(req.query.keyword);
    let limit = 5;
    const parsedLimit = req.query.limit !== undefined ? parsePositiveInteger(req.query.limit, 'limit') : undefined;
    if (parsedLimit) limit = Math.min(Math.max(parsedLimit, 1), 10);

    if (!keyword || keyword.trim().length < 2) {
      return ok(res, { products: [], categories: [], keywords: [] });
    }

    const result = await suggestProducts(keyword.trim(), limit);
    return ok(res, result);
  } catch (e: unknown) {
    const { statusCode, message } = getErrorResponse(e);
    return errorResponse(res, message, statusCode);
  }
};

export { createProduct, updateProduct, deleteProduct, permanentlyDeleteProduct, getProducts, getProductList, getProductFilters, getProductById, suggestSearch };
