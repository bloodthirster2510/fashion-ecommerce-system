import type { Request, Response } from 'express';
import { BrandServiceError, brandService } from './brand.service';
import type { CreateBrandInput, UpdateBrandInput } from './brand.types';
import { created, error as errorResponse, ok } from '../../../utils/response';
import { handleMulterError, type MulterRequest } from '../../../middlewares/upload.middleware';
import { deleteCatalogImage, uploadCatalogImage } from '../catalog-image';

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
  let uploadedImageUrl: string | null = null;

  try {
    const uploadReq = req as MulterRequest;
    const multerErrorResponse = handleMulterError(uploadReq.fileValidationError, res);
    if (multerErrorResponse) return;

    const { name, image } = req.body as CreateBrandInput;
    const imageFile = req.file;

    if (!name || (!image && !imageFile)) {
      return errorResponse(res, 'Name and image are required', 400);
    }

    if (imageFile) {
      uploadedImageUrl = await uploadCatalogImage(imageFile, 'brands');
    } else {
      uploadedImageUrl = null;
    }
    const brand = await brandService.createBrand({
      name,
      image: uploadedImageUrl ?? image,
    });

    return created(res, brand);
  } catch (e: unknown) {
    await deleteCatalogImage(uploadedImageUrl);
    const { statusCode, message } = getErrorResponse(e);
    return errorResponse(res, message, statusCode);
  }
};

const updateBrand = async (req: Request, res: Response) => {
  let uploadedImageUrl: string | null = null;

  try {
    const uploadReq = req as MulterRequest;
    const multerErrorResponse = handleMulterError(uploadReq.fileValidationError, res);
    if (multerErrorResponse) return;

    const id = req.params.id as string;
    const { name, image, isActive } = req.body as UpdateBrandInput;
    const imageFile = req.file;
    const updateData: UpdateBrandInput = {};

    if (name !== undefined) updateData.name = name;
    if (image !== undefined) updateData.image = image;
    if (isActive !== undefined) updateData.isActive = String(isActive) === 'true';

    const currentBrand = imageFile ? await brandService.getBrandById(id) : null;

    if (imageFile) {
      uploadedImageUrl = await uploadCatalogImage(imageFile, 'brands');
      updateData.image = uploadedImageUrl;
    }

    if (Object.keys(updateData).length === 0) {
      return errorResponse(res, 'No data to update', 400);
    }

    const brand = await brandService.updateBrand(id, updateData);
    if (imageFile) {
      await deleteCatalogImage(currentBrand?.image);
    }

    return ok(res, brand);
  } catch (e: unknown) {
    await deleteCatalogImage(uploadedImageUrl);
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

const deleteBrandPermanently = async (req: Request, res: Response) => {
  try {
    const brandId = req.params.id as string;
    const brand = await brandService.deleteBrandPermanently(brandId);

    await deleteCatalogImage(brand.image);

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

const getBrandsForManagement = async (_req: Request, res: Response) => {
  try {
    const brands = await brandService.getBrandsForManagement();

    return ok(res, brands);
  } catch (e: unknown) {
    const { statusCode, message } = getErrorResponse(e);
    return errorResponse(res, message, statusCode);
  }
};

export {
  createBrand,
  updateBrand,
  deleteBrand,
  deleteBrandPermanently,
  getBrands,
  getBrandsForManagement,
};
