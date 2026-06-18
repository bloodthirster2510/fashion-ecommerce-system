import { Types } from 'mongoose';
import { Category, type CategoryGender } from '../../../database/models/category.model';
import { Coupon } from '../../../database/models/coupon.model';
import { Product } from '../../../database/models/product.model';
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

type CategoryHierarchyNode = {
  parent_id?: Types.ObjectId | null;
  level: number;
  gender: CategoryGender;
};

type CategoryManagementDocument = {
  _id: Types.ObjectId;
  parent_id?: Types.ObjectId | null;
  image?: string | null;
};

const assertValidParentId = async (parentId?: string | null, currentCategoryId?: string) => {
  if (!parentId) {
    return null;
  }

  assertValidCategoryId(parentId);

  if (currentCategoryId && parentId === currentCategoryId) {
    throw new CategoryServiceError('Category cannot be its own parent', 400);
  }

  const visitedIds = new Set<string>();
  let ancestorId: string | null = parentId;
  let parentCategory: CategoryHierarchyNode | null = null;

  while (ancestorId) {
    if (visitedIds.has(ancestorId) || (currentCategoryId && ancestorId === currentCategoryId)) {
      throw new CategoryServiceError('Category hierarchy cannot contain a cycle', 400);
    }

    visitedIds.add(ancestorId);
    const ancestor = (await Category.findById(ancestorId)) as CategoryHierarchyNode | null;

    if (!ancestor) {
      throw new CategoryServiceError('Parent category not found', 404);
    }

    if (!parentCategory) {
      parentCategory = ancestor;
    }

    ancestorId = ancestor.parent_id?.toString() ?? null;
  }

  return parentCategory;
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
  const parentCategory = await assertValidParentId(input.parent_id);
  const sizeTemplateSourceId = await assertValidSizeTemplateSourceId(input.sizeTemplateSourceId);
  const level = parentCategory ? parentCategory.level + 1 : 1;
  const gender = parentCategory ? parentCategory.gender : input.gender;

  if (level > 10) {
    throw new CategoryServiceError('Category hierarchy exceeds the maximum level', 400);
  }

  const existingCategory = await findCategoryByUniqueFields(
    input.name,
    input.parent_id,
    gender,
  );

  if (existingCategory) {
    throw new CategoryServiceError('Category already exists', 409);
  }

  return Category.create({
    name: input.name.trim(),
    parent_id: normalizeParentId(input.parent_id),
    level,
    gender,
    image: input.image.trim(),
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
  const parentCategory =
    input.parent_id !== undefined
      ? await assertValidParentId(input.parent_id, id)
      : undefined;
  const sizeTemplateSourceId = await assertValidSizeTemplateSourceId(input.sizeTemplateSourceId);

  const category = await Category.findById(id);

  if (!category) {
    throw new CategoryServiceError('Category not found', 404);
  }

  if (input.isActive === false && category.isActive) {
    const activeProductCount = await countActiveProductsInCategoryTree(id);
    if (activeProductCount > 0) {
      throw new CategoryServiceError(
        'Danh mục này vẫn còn sản phẩm đang bán. Vui lòng dùng nút xóa của quản lý danh mục để xác nhận ngừng bán các sản phẩm liên quan.',
        409,
      );
    }
  }

  const nextName = input.name ?? category.name;
  const nextParentId = input.parent_id !== undefined ? input.parent_id : category.parent_id?.toString() ?? null;
  const nextGender =
    parentCategory ? parentCategory.gender : input.gender ?? category.gender;

  if (input.name !== undefined || input.parent_id !== undefined || input.gender !== undefined) {
    const existingCategory = await findCategoryByUniqueFields(nextName, nextParentId, nextGender);

    if (existingCategory && existingCategory._id.toString() !== id) {
      throw new CategoryServiceError('Category already exists', 409);
    }
  }

  const updateData: Record<string, unknown> = {};

  if (input.name !== undefined) updateData.name = input.name.trim();
  if (input.parent_id !== undefined) updateData.parent_id = normalizeParentId(input.parent_id);
  if (input.parent_id !== undefined) {
    const level = parentCategory ? parentCategory.level + 1 : 1;

    if (level > 10) {
      throw new CategoryServiceError('Category hierarchy exceeds the maximum level', 400);
    }

    updateData.level = level;
  }
  if (input.parent_id !== undefined || input.gender !== undefined) {
    updateData.gender = nextGender;
  }
  if (input.image !== undefined) updateData.image = input.image.trim();
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
    returnDocument: 'after',
    runValidators: true,
  });
};

type DeleteCategoryOptions = {
  cascadeProducts?: boolean;
};

const deleteCategory = async (id: string, options: DeleteCategoryOptions = {}) => {
  assertValidCategoryId(id);

  const categories = await Category.find()
    .select('_id parent_id')
    .lean<CategoryManagementDocument[]>();
  const category = categories.find((item) => item._id.toString() === id);

  if (!category) {
    throw new CategoryServiceError('Category not found', 404);
  }

  const categoryIds = getDescendantIdsFromCategories(categories, id).map((categoryId) => new Types.ObjectId(categoryId));
  const activeProductFilter = {
    category_id: { $in: categoryIds },
    isActive: true,
  };
  const activeProductCount = await Product.countDocuments(activeProductFilter);

  if (activeProductCount > 0 && !options.cascadeProducts) {
    throw new CategoryServiceError(
      'Danh mục này vẫn còn sản phẩm đang bán. Vui lòng xác nhận ngừng bán các sản phẩm liên quan trước khi tạm ngừng danh mục.',
      409,
    );
  }

  if (activeProductCount > 0) {
    await Product.updateMany(activeProductFilter, { isActive: false });
  }

  const updatedCategory = await Category.findByIdAndUpdate(
    id,
    { isActive: false },
    {
      returnDocument: 'after',
      runValidators: true,
    },
  );

  if (!updatedCategory) {
    throw new CategoryServiceError('Category not found', 404);
  }

  return updatedCategory;
};

const getDescendantIdsFromCategories = (
  categories: CategoryManagementDocument[],
  rootId: string,
) => {
  const childrenByParentId = new Map<string, CategoryManagementDocument[]>();

  categories.forEach((category) => {
    const parentId = category.parent_id?.toString();
    if (!parentId) return;
    const children = childrenByParentId.get(parentId) ?? [];
    children.push(category);
    childrenByParentId.set(parentId, children);
  });

  const ids: string[] = [];
  const visited = new Set<string>();
  const visit = (categoryId: string) => {
    if (visited.has(categoryId)) return;
    visited.add(categoryId);
    ids.push(categoryId);
    (childrenByParentId.get(categoryId) ?? []).forEach((child) => visit(child._id.toString()));
  };

  visit(rootId);
  return ids;
};

const countActiveProductsInCategoryTree = async (id: string) => {
  const categories = await Category.find()
    .select('_id parent_id')
    .lean<CategoryManagementDocument[]>();

  const categoryIds = getDescendantIdsFromCategories(categories, id).map(
    (categoryId) => new Types.ObjectId(categoryId),
  );

  return Product.countDocuments({
    category_id: { $in: categoryIds },
    isActive: true,
  });
};

const deleteCategoryPermanently = async (id: string) => {
  assertValidCategoryId(id);
  const categoryObjectId = new Types.ObjectId(id);

  const categories = await Category.find()
    .select('_id parent_id image')
    .lean<CategoryManagementDocument[]>();
  const category = categories.find((item) => item._id.toString() === id);

  if (!category) {
    throw new CategoryServiceError('Category not found', 404);
  }

  const now = new Date();
  const [childCategoryCount, productCount, templateDependencyCount, activePromotionCount] = await Promise.all([
    Category.countDocuments({ parent_id: categoryObjectId }),
    Product.countDocuments({ category_id: categoryObjectId }),
    Category.countDocuments({
      _id: { $ne: categoryObjectId },
      sizeTemplateSourceId: categoryObjectId,
    }),
    Coupon.countDocuments({
      deletedAt: null,
      isActive: true,
      startAt: { $lte: now },
      endAt: { $gte: now },
      applicableCategories: categoryObjectId,
    }),
  ]);

  if (childCategoryCount > 0) {
    throw new CategoryServiceError('Chưa thể xóa vĩnh viễn danh mục này vì vẫn còn danh mục con.', 409);
  }

  if (productCount > 0) {
    throw new CategoryServiceError('Chưa thể xóa vĩnh viễn danh mục này vì vẫn còn sản phẩm đang tham chiếu.', 409);
  }

  if (templateDependencyCount > 0) {
    throw new CategoryServiceError('Chưa thể xóa vĩnh viễn danh mục này vì đang được dùng làm mẫu size/form cho danh mục khác.', 409);
  }

  if (activePromotionCount > 0) {
    throw new CategoryServiceError('Chưa thể xóa vĩnh viễn danh mục này vì đang được dùng trong khuyến mãi còn hiệu lực.', 409);
  }

  await Category.deleteMany({ _id: categoryObjectId });

  return [category];
};

const getCategories = () => {
  return Category.find().sort({ createdAt: -1 });
};

const getCategoriesForManagement = async () => {
  const [categories, productCounts] = await Promise.all([
    Category.find()
      .select('_id name parent_id level gender image description isActive createdAt updatedAt')
      .sort({ gender: 1, level: 1, name: 1 })
      .lean(),
    Product.aggregate<{ _id: Types.ObjectId; count: number; activeCount: number }>([
      {
        $group: {
          _id: '$category_id',
          count: { $sum: 1 },
          activeCount: { $sum: { $cond: ['$isActive', 1, 0] } },
        },
      },
    ]),
  ]);
  const countByCategoryId = new Map(
    productCounts.map((item) => [item._id.toString(), item.count]),
  );
  const activeCountByCategoryId = new Map(
    productCounts.map((item) => [item._id.toString(), item.activeCount]),
  );
  const directCountByCategoryId = new Map(countByCategoryId);
  const directActiveCountByCategoryId = new Map(activeCountByCategoryId);
  const managementCategories = categories as CategoryManagementDocument[];

  categories.forEach((category) => {
    const categoryId = category._id.toString();
    const descendantIds = getDescendantIdsFromCategories(managementCategories, categoryId);
    const aggregateCount = descendantIds.reduce(
      (total, descendantId) => total + (directCountByCategoryId.get(descendantId) ?? 0),
      0,
    );
    const aggregateActiveCount = descendantIds.reduce(
      (total, descendantId) => total + (directActiveCountByCategoryId.get(descendantId) ?? 0),
      0,
    );
    countByCategoryId.set(categoryId, aggregateCount);
    activeCountByCategoryId.set(categoryId, aggregateActiveCount);
  });

  return categories.map((category) => ({
    ...category,
    productCount: countByCategoryId.get(category._id.toString()) ?? 0,
    activeProductCount: activeCountByCategoryId.get(category._id.toString()) ?? 0,
  }));
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
  deleteCategoryPermanently,
  getCategories,
  getCategoriesForManagement,
  getActiveCategories,
  listCategories,
  getCategoryById,
  getCategoryTemplateById,
};
