import { Types } from 'mongoose';
import { Category } from '../../../database/models/category.model';
import type {
  CategoryListQueryInput,
  CategoryFitTypeInput,
  CreateCategoryInput,
  MeasurementFieldInput,
  UpdateCategoryInput,
} from './categories.type';

export class CategoryServiceError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
    this.name = 'CategoryServiceError';
  }
}

const assertValidCategoryId = (id: string) => {
  if (!Types.ObjectId.isValid(id)) {
    throw new CategoryServiceError('Invalid category id', 400);
  }
};

const escapeRegex = (value: string) => {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

const normalizeParentId = (parentId?: string | null) => {
  return parentId ? new Types.ObjectId(parentId) : null;
};

const assertValidParentId = async (parentId?: string | null, currentCategoryId?: string) => {
  if (!parentId) {
    return;
  }

  assertValidCategoryId(parentId);

  if (currentCategoryId && parentId === currentCategoryId) {
    throw new CategoryServiceError('Category cannot be its own parent', 400);
  }

  const parentCategory = await Category.findById(parentId);

  if (!parentCategory) {
    throw new CategoryServiceError('Parent category not found', 404);
  }
};

const findCategoryByUniqueFields = (
  name: string,
  parentId: string | null | undefined,
  gender: string,
) => {
  return Category.findOne({
    name: new RegExp(`^${escapeRegex(name.trim())}$`, 'i'),
    parent_id: normalizeParentId(parentId),
    gender,
  });
};

const normalizeMeasurementFields = (items?: MeasurementFieldInput[]) => {
  if (!items) {
    return [];
  }

  if (!Array.isArray(items) || items.length === 0) {
    throw new CategoryServiceError('measurementFields must be a non-empty array', 400);
  }

  const normalized = items.map((item) => {
    if (!item || typeof item !== 'object') {
      throw new CategoryServiceError('Invalid measurement field', 400);
    }

    const key = String(item.key ?? '').trim();
    const label = String(item.label ?? '').trim();
    const unit = String(item.unit ?? '').trim();
    const required = Boolean(item.required);
    const sortOrder = Number(item.sortOrder);

    if (!key || !label || !unit || !Number.isInteger(sortOrder) || sortOrder < 0) {
      throw new CategoryServiceError('Invalid measurement field values', 400);
    }

    return {
      key,
      label,
      unit,
      required,
      sortOrder,
    };
  });

  const keys = normalized.map((item) => item.key.toLowerCase());
  if (new Set(keys).size !== keys.length) {
    throw new CategoryServiceError('Duplicate measurement field key', 400);
  }

  return normalized;
};

const normalizeSizes = (sizes?: string[]) => {
  if (!sizes) {
    return [];
  }

  if (!Array.isArray(sizes) || sizes.length === 0) {
    throw new CategoryServiceError('sizes must be a non-empty array', 400);
  }

  const normalized = sizes.map((size) => {
    const value = String(size ?? '').trim();

    if (!value) {
      throw new CategoryServiceError('Invalid size value', 400);
    }

    return value;
  });

  const lowercased = normalized.map((size) => size.toLowerCase());
  if (new Set(lowercased).size !== lowercased.length) {
    throw new CategoryServiceError('Duplicate size value', 400);
  }

  return normalized;
};

const normalizeFitTypes = (items?: CategoryFitTypeInput[]) => {
  if (!items) {
    return [];
  }

  if (!Array.isArray(items) || items.length === 0) {
    throw new CategoryServiceError('fitTypes must be a non-empty array', 400);
  }

  const normalized = items.map((item) => {
    if (!item || typeof item !== 'object') {
      throw new CategoryServiceError('Invalid fit type', 400);
    }

    const key = String(item.key ?? '').trim();
    const label = String(item.label ?? '').trim();
    const sortOrder = Number(item.sortOrder);
    const isActive = item.isActive !== undefined ? Boolean(item.isActive) : true;

    if (!key || !label || !Number.isInteger(sortOrder) || sortOrder < 0) {
      throw new CategoryServiceError('Invalid fit type values', 400);
    }

    return {
      _id: new Types.ObjectId(),
      key,
      label,
      sortOrder,
      isActive,
    };
  });

  const keys = normalized.map((item) => item.key.toLowerCase());
  if (new Set(keys).size !== keys.length) {
    throw new CategoryServiceError('Duplicate fit type key', 400);
  }

  return normalized;
};

const assertValidSizeTemplateSourceId = async (sizeTemplateSourceId?: string | null) => {
  if (sizeTemplateSourceId === undefined || sizeTemplateSourceId === null) {
    return null;
  }

  assertValidCategoryId(sizeTemplateSourceId);

  const sourceCategory = await Category.findById(sizeTemplateSourceId);

  if (!sourceCategory) {
    throw new CategoryServiceError('Size template source category not found', 404);
  }

  if (!sourceCategory.isSizeTemplateSource) {
    throw new CategoryServiceError('Referenced category is not a size template source', 400);
  }

  return new Types.ObjectId(sizeTemplateSourceId);
};

const createCategory = async (input: CreateCategoryInput) => {
  await assertValidParentId(input.parent_id);
  const sizeTemplateSourceId = await assertValidSizeTemplateSourceId(input.sizeTemplateSourceId);

  const existingCategory = await findCategoryByUniqueFields(
    input.name,
    input.parent_id,
    input.gender,
  );

  if (existingCategory) {
    throw new CategoryServiceError('Category already exists', 409);
  }

  return Category.create({
    name: input.name.trim(),
    parent_id: normalizeParentId(input.parent_id),
    level: input.level,
    gender: input.gender,
    image: input.image.trim(),
    bannerImage: input.bannerImage?.trim() || null,
    description: input.description.trim(),
    isLeaf: input.isLeaf ?? false,
    isSizeTemplateSource: input.isSizeTemplateSource ?? false,
    sizeTemplateSourceId: sizeTemplateSourceId,
    sizes: normalizeSizes(input.sizes),
    measurementFields: normalizeMeasurementFields(input.measurementFields),
    fitTypes: normalizeFitTypes(input.fitTypes),
    isActive: input.isActive ?? true,
  });
};

const updateCategory = async (id: string, input: UpdateCategoryInput) => {
  assertValidCategoryId(id);
  await assertValidParentId(input.parent_id, id);
  const sizeTemplateSourceId = await assertValidSizeTemplateSourceId(input.sizeTemplateSourceId);

  const category = await Category.findById(id);

  if (!category) {
    throw new CategoryServiceError('Category not found', 404);
  }

  const nextName = input.name ?? category.name;
  const nextParentId = input.parent_id !== undefined ? input.parent_id : category.parent_id?.toString() ?? null;
  const nextGender = input.gender ?? category.gender;

  if (input.name !== undefined || input.parent_id !== undefined || input.gender !== undefined) {
    const existingCategory = await findCategoryByUniqueFields(nextName, nextParentId, nextGender);

    if (existingCategory && existingCategory._id.toString() !== id) {
      throw new CategoryServiceError('Category already exists', 409);
    }
  }

  const updateData: Record<string, unknown> = {};

  if (input.name !== undefined) updateData.name = input.name.trim();
  if (input.parent_id !== undefined) updateData.parent_id = normalizeParentId(input.parent_id);
  if (input.level !== undefined) updateData.level = input.level;
  if (input.gender !== undefined) updateData.gender = input.gender;
  if (input.image !== undefined) updateData.image = input.image.trim();
  if (input.bannerImage !== undefined) updateData.bannerImage = input.bannerImage?.trim() || null;
  if (input.description !== undefined) updateData.description = input.description.trim();
  if (input.isLeaf !== undefined) updateData.isLeaf = input.isLeaf;
  if (input.isSizeTemplateSource !== undefined) updateData.isSizeTemplateSource = input.isSizeTemplateSource;
  if (input.sizeTemplateSourceId !== undefined) updateData.sizeTemplateSourceId = sizeTemplateSourceId;
  if (input.sizes !== undefined) {
    updateData.sizes = normalizeSizes(input.sizes);
  }
  if (input.measurementFields !== undefined) {
    updateData.measurementFields = normalizeMeasurementFields(input.measurementFields);
  }
  if (input.fitTypes !== undefined) {
    updateData.fitTypes = normalizeFitTypes(input.fitTypes);
  }
  if (input.isActive !== undefined) updateData.isActive = input.isActive;

  return Category.findByIdAndUpdate(id, updateData, {
    new: true,
    runValidators: true,
  });
};

const deleteCategory = async (id: string) => {
  assertValidCategoryId(id);

  const category = await Category.findByIdAndUpdate(
    id,
    { isActive: false },
    {
      new: true,
      runValidators: true,
    },
  );

  if (!category) {
    throw new CategoryServiceError('Category not found', 404);
  }

  return category;
};

const getCategories = () => {
  return Category.find().sort({ createdAt: -1 });
};

const getActiveCategories = () => {
  return Category.find({ isActive: true }).sort({ createdAt: -1 });
};

const listCategories = (query: CategoryListQueryInput = {}) => {
  const filter: Record<string, unknown> = {};

  if (query.activeOnly ?? true) {
    filter.isActive = true;
  }

  if (query.gender) {
    filter.gender = query.gender;
  }

  if (query.parentId !== undefined) {
    if (query.parentId) {
      assertValidCategoryId(query.parentId);
      filter.parent_id = new Types.ObjectId(query.parentId);
    } else {
      filter.parent_id = null;
    }
  }

  return Category.find(filter).sort({ gender: 1, level: 1, name: 1 });
};

const resolveCategorySizeTemplateSource = async (category: Partial<{ isSizeTemplateSource: boolean; sizeTemplateSourceId?: Types.ObjectId | null; parent_id?: Types.ObjectId | null }>) => {
  if (category.isSizeTemplateSource) {
    return category;
  }

  if (category.sizeTemplateSourceId) {
    const sourceCategory = await Category.findById(category.sizeTemplateSourceId);
    if (sourceCategory) {
      return sourceCategory;
    }
  }

  if (category.parent_id) {
    const parentCategory = await Category.findById(category.parent_id);
    if (parentCategory) {
      return parentCategory;
    }
  }

  throw new CategoryServiceError('Size template source category not found', 404);
};

const getCategoryTemplateById = async (id: string) => {
  assertValidCategoryId(id);

  const category = await Category.findById(id);

  if (!category) {
    throw new CategoryServiceError('Category not found', 404);
  }

  const sourceCategory = await resolveCategorySizeTemplateSource(category);

  return {
    category,
    templateSource: sourceCategory,
  };
};

const getCategoryById = async (id: string) => {
  assertValidCategoryId(id);

  const category = await Category.findById(id);

  if (!category) {
    throw new CategoryServiceError('Category not found', 404);
  }

  return category;
};

export const categoryService = {
  createCategory,
  updateCategory,
  deleteCategory,
  getCategories,
  getActiveCategories,
  listCategories,
  getCategoryById,
  getCategoryTemplateById,
};
