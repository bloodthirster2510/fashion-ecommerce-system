import { Category } from '../../../../database/models/category.model';
import { CategoryServiceError, categoryService } from '../categories.service';

jest.mock('../../../../database/models/category.model', () => ({
  Category: {
    create: jest.fn(),
    findById: jest.fn(),
    findByIdAndUpdate: jest.fn(),
    findOne: jest.fn(),
    find: jest.fn(),
  },
}));

const mockedCategory = Category as jest.Mocked<typeof Category>;

describe('categoryService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
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
      image: ' https://example.com/category.png ',
      bannerImage: ' https://example.com/banner.png ',
      description: ' Men shirts category ',
    });

    expect(mockedCategory.findOne).toHaveBeenCalled();
    expect(mockedCategory.create).toHaveBeenCalledWith({
      name: 'Shirts',
      parent_id: null,
      level: 1,
      gender: 'male',
      image: 'https://example.com/category.png',
      bannerImage: 'https://example.com/banner.png',
      description: 'Men shirts category',
      isLeaf: false,
      isSizeTemplateSource: false,
      sizeTemplateSourceId: null,
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
      image: ' https://example.com/category.png ',
      bannerImage: ' https://example.com/banner.png ',
      description: ' Men shirts category ',
      isSizeTemplateSource: true,
      sizes: ['S', 'M', 'L'],
      measurementFields: [
        { key: 'shoulder', label: 'Vai', unit: 'cm', required: true, sortOrder: 1 },
        { key: 'chest', label: 'Ngực', unit: 'cm', required: true, sortOrder: 2 },
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
          { key: 'chest', label: 'Ngực', unit: 'cm', required: true, sortOrder: 2 },
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
        image: 'https://example.com/category.png',
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
        image: 'https://example.com/category.png',
        description: 'Men shirts category',
      }),
    ).rejects.toMatchObject({
      message: 'Parent category not found',
      statusCode: 404,
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
    mockedCategory.findByIdAndUpdate.mockResolvedValue(category as never);

    const result = await categoryService.deleteCategory('665000000000000000000001');

    expect(mockedCategory.findByIdAndUpdate).toHaveBeenCalledWith(
      '665000000000000000000001',
      { isActive: false },
      {
        new: true,
        runValidators: true,
      },
    );
    expect(result).toBe(category);
  });

  it('uses a typed service error for category failures', async () => {
    await expect(categoryService.getCategoryById('invalid-id')).rejects.toBeInstanceOf(
      CategoryServiceError,
    );
  });
});
