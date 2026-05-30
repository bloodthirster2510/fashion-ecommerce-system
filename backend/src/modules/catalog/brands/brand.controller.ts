import type { Request, Response } from 'express';
import { BrandServiceError, brandService } from './brand.service';
import type { CreateBrandInput, UpdateBrandInput } from './brand.types';
import { created, error as errorResponse, ok } from '../../../utils/response';

const getErrorResponse = (e: unknown) => {
  if (e instanceof BrandServiceError) {
    return {
      statusCode: e.statusCode,
      message: e.message,
    };
  }

  return {
    statusCode: 500,
    message: e instanceof Error ? e.message : 'An error occurred',
  };
};

const createBrand = async (req: Request, res: Response) => {
  try {
    const { name, image } = req.body as CreateBrandInput;

    if (!name || !image) {
      return errorResponse(res, 'Name and image are required', 400);
    }

    const brand = await brandService.createBrand({ name, image });

    return created(res, brand);
  } catch (e: unknown) {
    const { statusCode, message } = getErrorResponse(e);
    return errorResponse(res, message, statusCode);
  }
};

const updateBrand = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;

    const { name, image, isActive } = req.body as UpdateBrandInput;
    const updateData: UpdateBrandInput = {};

    if (name !== undefined) updateData.name = name;
    if (image !== undefined) updateData.image = image;
    if (isActive !== undefined) updateData.isActive = isActive;

    if (Object.keys(updateData).length === 0) {
      return errorResponse(res, 'No data to update', 400);
    }

    const brand = await brandService.updateBrand(id, updateData);

    return ok(res, brand);
  } catch (e: unknown) {
    const { statusCode, message } = getErrorResponse(e);
    return errorResponse(res, message, statusCode);
  }
};

const deleteBrand = async (req: Request, res: Response) => {
  try {
    const brandId = req.params.id as string;

    const brand = await brandService.deleteBrand(brandId);

    return ok(res, brand);
  } catch (e: unknown) {
    const { statusCode, message } = getErrorResponse(e);
    return errorResponse(res, message, statusCode);
  }
};

const getBrands = async (_req: Request, res: Response) => {
  try {
    const brands = await brandService.getBrands();

    return ok(res, brands);
  } catch (e: unknown) {
    const { statusCode, message } = getErrorResponse(e);
    return errorResponse(res, message, statusCode);
  }
};

export { createBrand, updateBrand, deleteBrand, getBrands };
