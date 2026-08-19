import type { Request, Response } from 'express';
import { handleMulterError, type MulterRequest } from '../../middlewares/upload.middleware';
import { error as errorResponse, ok } from '../../utils/response';
import {
  VisualSearchServiceError,
  visualSearchService,
} from './visual-search.service';
import type { VisualSearchQueryOptions } from './visual-search.types';

// Lấy một giá trị text từ query/body và bỏ khoảng trắng thừa.
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

// Đọc các field có thể truyền một giá trị hoặc nhiều giá trị, ví dụ color/categoryId.
const parseStringList = (value: unknown) => {
  const values = Array.isArray(value) ? value : typeof value === 'string' ? value.split(',') : [];

  return values
    .flatMap((item) => String(item).split(','))
    .map((item) => item.trim())
    .filter(Boolean);
};

// Chuyển dữ liệu text thành số và báo lỗi nếu người dùng nhập sai.
const parseNumber = (value: unknown, fieldName: string) => {
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new VisualSearchServiceError(`Invalid ${fieldName}`, 400, 'VISUAL_SEARCH_INVALID_INPUT');
    }

    return value;
  }

  const stringValue = parseString(value);

  if (!stringValue) {
    return undefined;
  }

  const numericValue = Number(stringValue);

  if (!Number.isFinite(numericValue)) {
    throw new VisualSearchServiceError(`Invalid ${fieldName}`, 400, 'VISUAL_SEARCH_INVALID_INPUT');
  }

  return numericValue;
};

// Dùng cho các filter giá, không chấp nhận số âm.
const parsePositiveNumber = (value: unknown, fieldName: string) => {
  const numericValue = parseNumber(value, fieldName);

  if (numericValue !== undefined && numericValue < 0) {
    throw new VisualSearchServiceError(`Invalid ${fieldName}`, 400, 'VISUAL_SEARCH_INVALID_INPUT');
  }

  return numericValue;
};

// Dùng cho limit vì số lượng kết quả phải là số nguyên.
const parsePositiveInteger = (value: unknown, fieldName: string) => {
  const numericValue = parsePositiveNumber(value, fieldName);

  if (numericValue !== undefined && !Number.isInteger(numericValue)) {
    throw new VisualSearchServiceError(`Invalid ${fieldName}`, 400, 'VISUAL_SEARCH_INVALID_INPUT');
  }

  return numericValue;
};

// Kiểm tra filter giới tính chỉ nhận các giá trị hệ thống đang hỗ trợ.
const parseGender = (value: unknown) => {
  const gender = parseString(value);

  if (!gender) {
    return undefined;
  }

  if (gender !== 'male' && gender !== 'female' && gender !== 'unisex') {
    throw new VisualSearchServiceError('Invalid gender', 400, 'VISUAL_SEARCH_INVALID_INPUT');
  }

  return gender;
};

// Gom toàn bộ filter từ form upload ảnh thành input cho visual search service.
const parseVisualSearchQuery = (req: Request): VisualSearchQueryOptions => {
  const categoryId = parseStringList(req.body.categoryId);
  const brandId = parseStringList(req.body.brandId);
  const color = parseStringList(req.body.color);
  const size = parseStringList(req.body.size);
  const minPrice = parsePositiveNumber(req.body.minPrice, 'minPrice');
  const maxPrice = parsePositiveNumber(req.body.maxPrice, 'maxPrice');

  if (minPrice !== undefined && maxPrice !== undefined && minPrice > maxPrice) {
    throw new VisualSearchServiceError(
      'minPrice cannot be greater than maxPrice',
      400,
      'VISUAL_SEARCH_INVALID_INPUT',
    );
  }

  return {
    limit: parsePositiveInteger(req.body.limit, 'limit'),
    gender: parseGender(req.body.gender),
    ...(categoryId.length ? { categoryId } : {}),
    ...(brandId.length ? { brandId } : {}),
    ...(color.length ? { color } : {}),
    ...(size.length ? { size } : {}),
    minPrice,
    maxPrice,
    scoreThreshold: parseNumber(req.body.scoreThreshold, 'scoreThreshold'),
  };
};

const parseTextSearchInput = (req: Request) => {
  const text = parseString(req.body.text) || parseString(req.body.q) || parseString(req.body.query);

  if (!text || text.length < 2) {
    throw new VisualSearchServiceError(
      'Text query must contain at least 2 characters',
      400,
      'VISUAL_TEXT_REQUIRED',
    );
  }

  if (text.length > 240) {
    throw new VisualSearchServiceError(
      'Text query must not exceed 240 characters',
      400,
      'VISUAL_TEXT_TOO_LONG',
    );
  }

  return { text };
};

// Trả lỗi visual search theo dạng dễ hiểu cho frontend.
const handleVisualSearchError = (res: Response, error: unknown) => {
  if (error instanceof VisualSearchServiceError) {
    if (error.statusCode >= 500) {
      console.error('Visual search controller error:', error);
    }

    return errorResponse(res, error.message, error.statusCode, {
      ...(error.errorCode ? { errorCode: error.errorCode } : {}),
    });
  }

  console.error('Visual search controller error:', error);
  return errorResponse(res, 'Internal Server Error', 500);
};

// API chính: nhận ảnh upload và trả về danh sách sản phẩm tương tự.
export const searchProductsByImage = async (req: Request, res: Response) => {
  try {
    const uploadReq = req as MulterRequest;
    const multerErrorResponse = handleMulterError(uploadReq.fileValidationError, res);
    if (multerErrorResponse) return;

    const image = req.file;
    if (!image) {
      return errorResponse(res, 'Image file is required', 400, {
        errorCode: 'VISUAL_IMAGE_REQUIRED',
      });
    }

    const result = await visualSearchService.searchByImage(
      {
        buffer: image.buffer,
        originalName: image.originalname,
        mimeType: image.mimetype,
      },
      parseVisualSearchQuery(req),
    );

    return ok(res, result);
  } catch (error) {
    return handleVisualSearchError(res, error);
  }
};

// API text-to-image: nhận mô tả sản phẩm và tìm trong visual index bằng FashionCLIP.
export const searchProductsByText = async (req: Request, res: Response) => {
  try {
    const result = await visualSearchService.searchByText(
      parseTextSearchInput(req),
      parseVisualSearchQuery(req),
    );

    return ok(res, result);
  } catch (error) {
    return handleVisualSearchError(res, error);
  }
};
