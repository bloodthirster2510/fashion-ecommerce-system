import { Category } from '../../../../database/models/category.model';
import { Coupon } from '../../../../database/models/coupon.model';
import { Product } from '../../../../database/models/product.model';
import { CategoryServiceError, categoryService } from '../categories.service';

jest.mock('../../../../database/models/category.model', () => ({
  Category: {
    create: jest.fn(),
    deleteMany: jest.fn(),
    countDocuments: jest.fn(),
    findById: jest.fn(),
    findByIdAndUpdate: jest.fn(),
    findOne: jest.fn(),
    find: jest.fn(),
    updateMany: jest.fn(),
  },
}));

jest.mock('../../../../database/models/product.model', () => ({
  Product: {
    aggregate: jest.fn(),
    countDocuments: jest.fn(),
    updateMany: jest.fn(),
  },
}));

jest.mock('../../../../database/models/coupon.model', () => ({
  Coupon: {
    countDocuments: jest.fn(),
  },
}));

const mockedCategory = Category as jest.Mocked<typeof Category>;
const mockedCoupon = Coupon as jest.Mocked<typeof Coupon>;
const mockedProduct = Product as jest.Mocked<typeof Product>;
const categoryImageUrl = 'https://res.cloudinary.com/demo/image/upload/v1/categories/shirts.png';

describe('categoryService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedCategory.countDocuments.mockResolvedValue(0);
    mockedCoupon.countDocuments.mockResolvedValue(0);
  });

  it('creates a root category with normalized values', async () => {
    const category = { _id: 'category-id', name: 'Shirts' };
    mockedCategory.findOne.mockResolvedValue(null);
    mockedCategory.create.mockResolvedValue(category as never);

    const result = await categoryService.createCategory({
      name: ' Shirts ',
      parent_id: null,
      level: 1,
      gender: 'male',
      image: ` ${categoryImageUrl} `,
      description: ' Men shirts category ',
    });

    expect(mockedCategory.findOne).toHaveBeenCalled();
    expect(mockedCategory.create).toHaveBeenCalledWith({
      name: 'Shirts',
      parent_id: null,
      level: 1,
      gender: 'male',
      image: categoryImageUrl,
      description: 'Men shirts category',
      isLeaf: false,
      isSizeTemplateSource: false,
      sizeTemplateSourceId: null,
      isFitTypeTemplateSource: false,
      fitTypeTemplateSourceId: null,
      fitTypeTemplateName: '',
      sizes: [],
      measurementFields: [],
      fitTypes: [],
      isActive: true,
    });
    expect(result).toBe(category);
  });

  it('creates a size template category with sizes and fit types', async () => {
    const category = { _id: 'category-id', name: 'Shirts' };
    mockedCategory.findOne.mockResolvedValue(null);
    mockedCategory.create.mockResolvedValue(category as never);

    const result = await categoryService.createCategory({
      name: ' Shirts ',
      parent_id: null,
      level: 1,
      gender: 'male',
      image: ` ${categoryImageUrl} `,
      description: ' Men shirts category ',
      isSizeTemplateSource: true,
      sizes: ['S', 'M', 'L'],
      measurementFields: [
        { key: 'shoulder', label: 'Vai', unit: 'cm', required: true, sortOrder: 1 },
        { key: 'chest', label: 'Ng?c', unit: 'cm', required: true, sortOrder: 2 },
      ],
      fitTypes: [
        { key: 'regular', label: 'Regular', sortOrder: 1, isActive: true },
        { key: 'oversize', label: 'Oversize', sortOrder: 2, isActive: true },
      ],
    });

    expect(mockedCategory.findOne).toHaveBeenCalled();
    expect(mockedCategory.create).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Shirts',
        isSizeTemplateSource: true,
        sizes: ['S', 'M', 'L'],
        measurementFields: [
          { key: 'shoulder', label: 'Vai', unit: 'cm', required: true, sortOrder: 1 },
          { key: 'chest', label: 'Ng?c', unit: 'cm', required: true, sortOrder: 2 },
        ],
        fitTypes: expect.arrayContaining([
          expect.objectContaining({
            key: 'regular',
            label: 'Regular',
            sortOrder: 1,
            isActive: true,
          }),
          expect.objectContaining({
            key: 'oversize',
            label: 'Oversize',
            sortOrder: 2,
            isActive: true,
          }),
        ]),
      }),
    );
    expect(result).toBe(category);
  });

  it('throws 400 when parent_id is invalid', async () => {
    await expect(
      categoryService.createCategory({
        name: 'Shirts',
      parent_id: 'invalid-id',
      level: 2,
      gender: 'male',
      image: categoryImageUrl,
      description: 'Men shirts category',
      }),
    ).rejects.toMatchObject({
      message: 'Invalid category id',
      statusCode: 400,
    });
  });

  it('throws 404 when parent category does not exist', async () => {
    mockedCategory.findById.mockResolvedValue(null);

    await expect(
      categoryService.createCategory({
        name: 'Shirts',
      parent_id: '665000000000000000000001',
      level: 2,
      gender: 'male',
      image: categoryImageUrl,
      description: 'Men shirts category',
    }),
    ).rejects.toMatchObject({
      message: 'Parent category not found',
      statusCode: 404,
    });
  });

  it('throws 400 when category image URL is not a whitelisted Cloudinary host', async () => {
    mockedCategory.findOne.mockResolvedValue(null);

    await expect(
      categoryService.createCategory({
        name: 'Shirts',
        parent_id: null,
        level: 1,
        gender: 'male',
        image: 'https://example.com/category.png',
        description: 'Men shirts category',
      }),
    ).rejects.toMatchObject({
      message: 'Image URL host is not allowed',
      statusCode: 400,
    });
  });

  it('throws 400 when category is its own parent', async () => {
    await expect(
      categoryService.updateCategory('665000000000000000000001', {
        parent_id: '665000000000000000000001',
      }),
    ).rejects.toMatchObject({
      message: 'Category cannot be its own parent',
      statusCode: 400,
    });
  });

  it('throws 400 when assigning a descendant as the parent', async () => {
    mockedCategory.findById.mockResolvedValueOnce({
      parent_id: { toString: () => '665000000000000000000001' },
      level: 2,
      gender: 'female',
    } as never);

    await expect(
      categoryService.updateCategory('665000000000000000000001', {
        parent_id: '665000000000000000000002',
      }),
    ).rejects.toMatchObject({
      message: 'Category hierarchy cannot contain a cycle',
      statusCode: 400,
    });
  });

  it('derives category level from its parent', async () => {
    const category = { _id: '665000000000000000000002', level: 4 };
    mockedCategory.findById.mockResolvedValue({
      parent_id: null,
      level: 3,
      gender: 'male',
    } as never);
    mockedCategory.findOne.mockResolvedValue(null);
    mockedCategory.create.mockResolvedValue(category as never);

    await categoryService.createCategory({
      name: 'T-shirts',
      parent_id: '665000000000000000000001',
      level: 9,
      gender: 'male',
      image: categoryImageUrl,
      description: 'Men t-shirts category',
    });

    expect(mockedCategory.create).toHaveBeenCalledWith(
      expect.objectContaining({
        parent_id: expect.any(Object),
        level: 4,
      }),
    );
  });

  it('uses the parent gender when creating a child category', async () => {
    const category = { _id: '665000000000000000000002', gender: 'female' };
    mockedCategory.findById.mockResolvedValue({
      parent_id: null,
      level: 1,
      gender: 'female',
    } as never);
    mockedCategory.findOne.mockResolvedValue(null);
    mockedCategory.create.mockResolvedValue(category as never);

    await categoryService.createCategory({
      name: 'Sneakers',
      parent_id: '665000000000000000000001',
      level: 2,
      gender: 'male',
      image: categoryImageUrl,
      description: 'Women sneakers category',
    });

    expect(mockedCategory.findOne).toHaveBeenCalledWith(
      expect.objectContaining({
        gender: 'female',
      }),
    );
    expect(mockedCategory.create).toHaveBeenCalledWith(
      expect.objectContaining({
        gender: 'female',
        level: 2,
      }),
    );
  });

  it('uses the new parent gender when updating a category parent', async () => {
    const categoryId = '665000000000000000000003';
    const parentId = '665000000000000000000001';
    mockedCategory.findById
      .mockResolvedValueOnce({
        parent_id: null,
        level: 1,
        gender: 'female',
      } as never)
      .mockResolvedValueOnce({
        _id: { toString: () => categoryId },
        name: 'Sneakers',
        parent_id: null,
        gender: 'male',
      } as never);
    mockedCategory.findOne.mockResolvedValue(null);
    mockedCategory.findByIdAndUpdate.mockResolvedValue({
      _id: categoryId,
      gender: 'female',
    } as never);
    mockedCategory.find.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue([
        { _id: { toString: () => parentId }, parent_id: null },
        { _id: { toString: () => categoryId }, parent_id: parentId },
        { _id: { toString: () => '665000000000000000000004' }, parent_id: categoryId },
      ]),
    } as never);

    await categoryService.updateCategory(categoryId, {
      parent_id: parentId,
      gender: 'male',
    });

    expect(mockedCategory.findByIdAndUpdate).toHaveBeenCalledWith(
      categoryId,
      expect.objectContaining({
        parent_id: expect.any(Object),
        level: 2,
        gender: 'female',
      }),
      {
        returnDocument: 'after',
        runValidators: true,
      },
    );
    expect(mockedCategory.updateMany).toHaveBeenCalledWith(
      { _id: { $in: [expect.any(Object)] } },
      { $set: { gender: 'female' } },
    );
  });

  it('throws 409 when updating to an existing unique category combination', async () => {
    mockedCategory.findById.mockResolvedValue({
      _id: { toString: () => '665000000000000000000001' },
      name: 'Shirts',
      parent_id: null,
      gender: 'male',
    } as never);
    mockedCategory.findOne.mockResolvedValue({
      _id: { toString: () => '665000000000000000000002' },
    } as never);

    await expect(
      categoryService.updateCategory('665000000000000000000001', { name: 'Tops' }),
    ).rejects.toMatchObject({
      message: 'Category already exists',
      statusCode: 409,
    });
  });

  it('soft deletes a category by setting isActive to false', async () => {
    const category = { _id: '665000000000000000000001', isActive: false };
    mockedCategory.find.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue([
        {
          _id: { toString: () => '665000000000000000000001' },
          parent_id: null,
        },
      ]),
    } as never);
    mockedProduct.countDocuments.mockResolvedValue(0);
    mockedCategory.findByIdAndUpdate.mockResolvedValue(category as never);

    const result = await categoryService.deleteCategory('665000000000000000000001');

    expect(mockedCategory.findByIdAndUpdate).toHaveBeenCalledWith(
      '665000000000000000000001',
      { isActive: false },
      {
        returnDocument: 'after',
        runValidators: true,
      },
    );
    expect(mockedProduct.updateMany).not.toHaveBeenCalled();
    expect(result).toBe(category);
  });

  it('prevents soft deletion when a category still has active products without confirmation', async () => {
    mockedCategory.find.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue([
        {
          _id: { toString: () => '665000000000000000000001' },
          parent_id: null,
        },
      ]),
    } as never);
    mockedProduct.countDocuments.mockResolvedValue(2);

    await expect(
      categoryService.deleteCategory('665000000000000000000001'),
    ).rejects.toMatchObject({
      message:
        'Danh mục này vẫn còn sản phẩm đang bán. Vui lòng xác nhận ngừng bán các sản phẩm liên quan trước khi tạm ngừng danh mục.',
      statusCode: 409,
    });
    expect(mockedCategory.findByIdAndUpdate).not.toHaveBeenCalled();
  });

  it('soft deletes a category and deactivates related active products when confirmed', async () => {
    const category = { _id: '665000000000000000000001', isActive: false };
    mockedCategory.find.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue([
        {
          _id: { toString: () => '665000000000000000000001' },
          parent_id: null,
        },
        {
          _id: { toString: () => '665000000000000000000002' },
          parent_id: { toString: () => '665000000000000000000001' },
        },
      ]),
    } as never);
    mockedProduct.countDocuments.mockResolvedValue(2);
    mockedProduct.updateMany.mockResolvedValue({ modifiedCount: 2 } as never);
    mockedCategory.findByIdAndUpdate.mockResolvedValue(category as never);

    const result = await categoryService.deleteCategory('665000000000000000000001', {
      cascadeProducts: true,
    });

    expect(mockedProduct.updateMany).toHaveBeenCalledWith(
      {
        category_id: {
          $in: [
            expect.objectContaining({ _bsontype: 'ObjectId' }),
            expect.objectContaining({ _bsontype: 'ObjectId' }),
          ],
        },
        isActive: true,
      },
      { isActive: false },
    );
    expect(result).toBe(category);
  });

  it('aggregates product counts from descendant categories for management', async () => {
    mockedCategory.find.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      sort: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue([
        {
          _id: { toString: () => '665000000000000000000001' },
          name: 'Giày dép',
          parent_id: null,
        },
        {
          _id: { toString: () => '665000000000000000000002' },
          name: 'Sneakers',
          parent_id: { toString: () => '665000000000000000000001' },
        },
      ]),
    } as never);
    mockedProduct.aggregate.mockResolvedValue([
      { _id: { toString: () => '665000000000000000000001' }, count: 2, activeCount: 1 },
      { _id: { toString: () => '665000000000000000000002' }, count: 3, activeCount: 2 },
    ] as never);

    const result = await categoryService.getCategoriesForManagement();

    expect(result).toEqual([
      expect.objectContaining({ name: 'Giày dép', productCount: 5, activeProductCount: 3 }),
      expect.objectContaining({ name: 'Sneakers', productCount: 3, activeProductCount: 2 }),
    ]);
  });

  it('prevents permanent deletion when a category has child categories', async () => {
    mockedCategory.find.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue([
        {
          _id: { toString: () => '665000000000000000000001' },
          parent_id: null,
        },
      ]),
    } as never);
    mockedCategory.countDocuments.mockResolvedValueOnce(1);

    await expect(
      categoryService.deleteCategoryPermanently('665000000000000000000001'),
    ).rejects.toMatchObject({
      message: 'Chưa thể xóa vĩnh viễn danh mục này vì vẫn còn danh mục con.',
      statusCode: 409,
    });

    expect(mockedCategory.deleteMany).not.toHaveBeenCalled();
  });

  it('prevents permanent deletion when a category has products', async () => {
    mockedCategory.find.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue([
        {
          _id: { toString: () => '665000000000000000000001' },
          parent_id: null,
        },
      ]),
    } as never);
    mockedProduct.countDocuments.mockResolvedValue(1);

    await expect(
      categoryService.deleteCategoryPermanently('665000000000000000000001'),
    ).rejects.toMatchObject({
      message: 'Chưa thể xóa vĩnh viễn danh mục này vì vẫn còn sản phẩm đang tham chiếu.',
      statusCode: 409,
    });

    expect(mockedCategory.deleteMany).not.toHaveBeenCalled();
  });

  it('prevents permanent deletion when a category is used as a size template', async () => {
    mockedCategory.find.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue([
        {
          _id: { toString: () => '665000000000000000000001' },
          parent_id: null,
        },
      ]),
    } as never);
    mockedProduct.countDocuments.mockResolvedValue(0);
    mockedCategory.countDocuments
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(1);

    await expect(
      categoryService.deleteCategoryPermanently('665000000000000000000001'),
    ).rejects.toMatchObject({
      message: 'Chưa thể xóa vĩnh viễn danh mục này vì đang được dùng làm mẫu size/form cho danh mục khác.',
      statusCode: 409,
    });

    expect(mockedCategory.deleteMany).not.toHaveBeenCalled();
  });

  it('prevents permanent deletion when a category is used by an active promotion', async () => {
    mockedCategory.find.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue([
        {
          _id: { toString: () => '665000000000000000000001' },
          parent_id: null,
        },
      ]),
    } as never);
    mockedProduct.countDocuments.mockResolvedValue(0);
    mockedCoupon.countDocuments.mockResolvedValue(1);

    await expect(
      categoryService.deleteCategoryPermanently('665000000000000000000001'),
    ).rejects.toMatchObject({
      message: 'Chưa thể xóa vĩnh viễn danh mục này vì đang được dùng trong khuyến mãi còn hiệu lực.',
      statusCode: 409,
    });

    expect(mockedCategory.deleteMany).not.toHaveBeenCalled();
  });

  it('permanently deletes a category when it has no dependencies', async () => {
    mockedCategory.find.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue([
        {
          _id: { toString: () => '665000000000000000000001' },
          parent_id: null,
        },
      ]),
    } as never);
    mockedProduct.countDocuments.mockResolvedValue(0);
    mockedCategory.deleteMany.mockResolvedValue({ deletedCount: 1 } as never);

    const result = await categoryService.deleteCategoryPermanently(
      '665000000000000000000001',
    );

    expect(mockedCategory.deleteMany).toHaveBeenCalledWith({
      _id: expect.any(Object),
    });
    expect(result).toHaveLength(1);
  });

  it('uses a typed service error for category failures', async () => {
    await expect(categoryService.getCategoryById('invalid-id')).rejects.toBeInstanceOf(
      CategoryServiceError,
    );
  });
});
