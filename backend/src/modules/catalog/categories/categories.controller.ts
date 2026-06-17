import type { Request, Response } from 'express';
import { CategoryServiceError, categoryService } from './categories.service';
import type { CategoryListQueryInput, CreateCategoryInput, UpdateCategoryInput } from './categories.type';
import { created, error as errorResponse, ok } from '../../../utils/response';
import { handleMulterError, type MulterRequest } from '../../../middlewares/upload.middleware';
import { deleteCatalogImage, uploadCatalogImage } from '../catalog-image';

const getErrorResponse = (e: unknown) => {
  if (e instanceof CategoryServiceError) {
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

  throw new CategoryServiceError(`Invalid ${fieldName}`, 400);
};

const parseCategoryListQuery = (req: Request): CategoryListQueryInput => {
  const gender = parseString(req.query.gender);

  if (gender && gender !== 'male' && gender !== 'female' && gender !== 'unisex') {
    throw new CategoryServiceError('Invalid gender', 400);
  }

  return {
    gender: gender as CategoryListQueryInput['gender'],
    parentId: parseString(req.query.parentId),
    activeOnly: parseBoolean(req.query.activeOnly, 'activeOnly'),
  };
};

const createCategory = async (req: Request, res: Response) => {
  const uploadedUrls: string[] = [];

  try {
    const uploadReq = req as MulterRequest;
    const multerErrorResponse = handleMulterError(uploadReq.fileValidationError, res);
    if (multerErrorResponse) return;

    const files = !req.files || Array.isArray(req.files) ? {} : req.files;
    const imageFile = files.image?.[0];
    const input = req.body as CreateCategoryInput;

    if (!input.name || !input.gender || (!input.image && !imageFile) || !input.description) {
      return errorResponse(res, 'Name, gender, image, and description are required', 400);
    }

    const image = imageFile ? await uploadCatalogImage(imageFile, 'categories') : input.image;
    if (imageFile) uploadedUrls.push(image);

    const category = await categoryService.createCategory({
      ...input,
      level: Number(input.level) || 1,
      parent_id: input.parent_id || null,
      image,
      isActive:
        input.isActive === undefined ? true : String(input.isActive) === 'true',
    });

    return created(res, category);
  } catch (e: unknown) {
    await Promise.all(uploadedUrls.map((url) => deleteCatalogImage(url)));
    const { statusCode, message } = getErrorResponse(e);
    return errorResponse(res, message, statusCode);
  }
};

const updateCategory = async (req: Request, res: Response) => {
  const uploadedUrls: string[] = [];

  try {
    const uploadReq = req as MulterRequest;
    const multerErrorResponse = handleMulterError(uploadReq.fileValidationError, res);
    if (multerErrorResponse) return;

    const id = req.params.id as string;
    const input = req.body as UpdateCategoryInput;
    const files = !req.files || Array.isArray(req.files) ? {} : req.files;
    const imageFile = files.image?.[0];
    const updateData: UpdateCategoryInput = {};

    if (input.name !== undefined) updateData.name = input.name;
    if (input.parent_id !== undefined) updateData.parent_id = input.parent_id;
    if (input.level !== undefined) updateData.level = Number(input.level);
    if (input.gender !== undefined) updateData.gender = input.gender;
    if (input.image !== undefined) updateData.image = input.image;
    if (input.description !== undefined) updateData.description = input.description;
    if (input.isLeaf !== undefined) updateData.isLeaf = input.isLeaf;
    if (input.isSizeTemplateSource !== undefined) updateData.isSizeTemplateSource = input.isSizeTemplateSource;
    if (input.sizeTemplateSourceId !== undefined) updateData.sizeTemplateSourceId = input.sizeTemplateSourceId;
    if (input.sizes !== undefined) updateData.sizes = input.sizes;
    if (input.measurementFields !== undefined) updateData.measurementFields = input.measurementFields;
    if (input.fitTypes !== undefined) updateData.fitTypes = input.fitTypes;
    if (input.isActive !== undefined) updateData.isActive = String(input.isActive) === 'true';

    const currentCategory =
      imageFile ? await categoryService.getCategoryById(id) : null;

    if (imageFile) {
      const image = await uploadCatalogImage(imageFile, 'categories');
      uploadedUrls.push(image);
      updateData.image = image;
    }

    if (Object.keys(updateData).length === 0) {
      return errorResponse(res, 'No data to update', 400);
    }

    const category = await categoryService.updateCategory(id, updateData);
    if (imageFile) {
      await deleteCatalogImage(currentCategory?.image);
    }

    return ok(res, category);
  } catch (e: unknown) {
    await Promise.all(uploadedUrls.map((url) => deleteCatalogImage(url)));
    const { statusCode, message } = getErrorResponse(e);
    return errorResponse(res, message, statusCode);
  }
};

const getCategoryTemplate = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const template = await categoryService.getCategoryTemplateById(id);
    return ok(res, template);
  } catch (e: unknown) {
    const { statusCode, message } = getErrorResponse(e);
    return errorResponse(res, message, statusCode);
  }
};

const deleteCategory = async (req: Request, res: Response) => {
  try {
    const categoryId = req.params.id as string;
    const cascadeProducts = req.query.cascadeProducts === 'true' || req.body?.cascadeProducts === true;
    const category = await categoryService.deleteCategory(categoryId, { cascadeProducts });

    return ok(res, category);
  } catch (e: unknown) {
    const { statusCode, message } = getErrorResponse(e);
    return errorResponse(res, message, statusCode);
  }
};

const deleteCategoryPermanently = async (req: Request, res: Response) => {
  try {
    const categoryId = req.params.id as string;
    const categories = await categoryService.deleteCategoryPermanently(categoryId);

    await Promise.all(categories.map((category) => deleteCatalogImage(category.image)));

    return ok(res, categories);
  } catch (e: unknown) {
    const { statusCode, message } = getErrorResponse(e);
    return errorResponse(res, message, statusCode);
  }
};

const getCategories = async (_req: Request, res: Response) => {
  try {
    const categories = await categoryService.getCategories();

    return ok(res, categories);
  } catch (e: unknown) {
    const { statusCode, message } = getErrorResponse(e);
    return errorResponse(res, message, statusCode);
  }
};

const getCategoriesForManagement = async (_req: Request, res: Response) => {
  try {
    const categories = await categoryService.getCategoriesForManagement();

    return ok(res, categories);
  } catch (e: unknown) {
    const { statusCode, message } = getErrorResponse(e);
    return errorResponse(res, message, statusCode);
  }
};

const listCategories = async (req: Request, res: Response) => {
  try {
    const categories = await categoryService.listCategories(parseCategoryListQuery(req));

    return ok(res, categories);
  } catch (e: unknown) {
    const { statusCode, message } = getErrorResponse(e);
    return errorResponse(res, message, statusCode);
  }
};

const getCategoryById = async (req: Request, res: Response) => {
  try {
    const categoryId = req.params.id as string;
    const category = await categoryService.getCategoryById(categoryId);

    return ok(res, category);
  } catch (e: unknown) {
    const { statusCode, message } = getErrorResponse(e);
    return errorResponse(res, message, statusCode);
  }
};

export {
  createCategory,
  updateCategory,
  deleteCategory,
  deleteCategoryPermanently,
  getCategories,
  getCategoriesForManagement,
  listCategories,
  getCategoryById,
  getCategoryTemplate,
};
