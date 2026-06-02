import type { Request, Response } from 'express';
import { error as errorResponse, ok } from '../../utils/response';
import { FavoriteServiceError, favoriteService } from './favorite.service';
import type { AddFavoriteInput, FavoriteListQueryInput, FavoriteSortOption } from './favorite.types';

const hasStatusCode = (value: unknown): value is { statusCode: number } => {
  return (
    typeof value === 'object' &&
    value !== null &&
    'statusCode' in value &&
    typeof value.statusCode === 'number'
  );
};

const getErrorResponse = (e: unknown) => {
  if (e instanceof FavoriteServiceError || hasStatusCode(e)) {
    return {
      statusCode: e.statusCode,
      message: e instanceof Error ? e.message : 'An error occurred',
    };
  }

  return {
    statusCode: 500,
    message: e instanceof Error ? e.message : 'An error occurred',
  };
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

const parsePositiveNumber = (value: unknown, fieldName: string) => {
  const stringValue = parseString(value);

  if (!stringValue) {
    return undefined;
  }

  const numericValue = Number(stringValue);

  if (!Number.isFinite(numericValue) || numericValue < 0) {
    throw new FavoriteServiceError(`Invalid ${fieldName}`, 400);
  }

  return numericValue;
};

const parsePositiveInteger = (value: unknown, fieldName: string) => {
  const numericValue = parsePositiveNumber(value, fieldName);

  if (numericValue === undefined) {
    return undefined;
  }

  if (!Number.isInteger(numericValue)) {
    throw new FavoriteServiceError(`Invalid ${fieldName}`, 400);
  }

  return numericValue;
};

const parseBoolean = (value: unknown, fieldName: string) => {
  const stringValue = parseString(value);

  if (!stringValue) {
    return undefined;
  }

  if (stringValue === 'true') {
    return true;
  }

  if (stringValue === 'false') {
    return false;
  }

  throw new FavoriteServiceError(`Invalid ${fieldName}`, 400);
};

const parseSort = (value: unknown): FavoriteSortOption | undefined => {
  const sort = parseString(value);

  if (!sort) {
    return undefined;
  }

  const allowedSorts: FavoriteSortOption[] = [
    'name_asc',
    'name_desc',
    'price_asc',
    'price_desc',
    'newest',
    'best_seller',
    'rating_desc',
    'favorited_desc',
    'favorited_asc',
  ];

  if (!allowedSorts.includes(sort as FavoriteSortOption)) {
    throw new FavoriteServiceError('Invalid sort', 400);
  }

  return sort as FavoriteSortOption;
};

const parseFavoriteListQuery = (req: Request): FavoriteListQueryInput => {
  const categoryId = parseStringList(req.query.categoryId);
  const brandId = parseStringList(req.query.brandId);
  const minPrice = parsePositiveNumber(req.query.minPrice, 'minPrice');
  const maxPrice = parsePositiveNumber(req.query.maxPrice, 'maxPrice');

  if (minPrice !== undefined && maxPrice !== undefined && minPrice > maxPrice) {
    throw new FavoriteServiceError('minPrice cannot be greater than maxPrice', 400);
  }

  return {
    keyword: parseString(req.query.keyword),
    ...(categoryId.length ? { categoryId } : {}),
    ...(brandId.length ? { brandId } : {}),
    minPrice,
    maxPrice,
    inStock: parseBoolean(req.query.inStock, 'inStock'),
    sort: parseSort(req.query.sort),
    page: parsePositiveInteger(req.query.page, 'page'),
    limit: parsePositiveInteger(req.query.limit, 'limit'),
  };
};

const getUserId = (req: Request) => req.user!.userId;

const listFavorites = async (req: Request, res: Response) => {
  try {
    const result = await favoriteService.listFavorites(getUserId(req), parseFavoriteListQuery(req));
    return ok(res, result);
  } catch (e: unknown) {
    const { statusCode, message } = getErrorResponse(e);
    return errorResponse(res, message, statusCode);
  }
};

const getFavoriteStatus = async (req: Request, res: Response) => {
  try {
    const productId = parseString(req.query.productId);

    if (!productId) {
      return errorResponse(res, 'productId is required', 400);
    }

    const result = await favoriteService.getFavoriteStatus(getUserId(req), productId);
    return ok(res, result);
  } catch (e: unknown) {
    const { statusCode, message } = getErrorResponse(e);
    return errorResponse(res, message, statusCode);
  }
};

const addFavorite = async (req: Request, res: Response) => {
  try {
    const input = req.body as AddFavoriteInput;

    if (!input.productId) {
      return errorResponse(res, 'productId is required', 400);
    }

    const result = await favoriteService.addFavorite(getUserId(req), input.productId);
    return ok(res, result);
  } catch (e: unknown) {
    const { statusCode, message } = getErrorResponse(e);
    return errorResponse(res, message, statusCode);
  }
};

const removeFavorite = async (req: Request, res: Response) => {
  try {
    const result = await favoriteService.removeFavorite(getUserId(req), req.params.productId as string);
    return ok(res, result);
  } catch (e: unknown) {
    const { statusCode, message } = getErrorResponse(e);
    return errorResponse(res, message, statusCode);
  }
};

export {
  addFavorite,
  getFavoriteStatus,
  listFavorites,
  removeFavorite,
};
