import dotenv from 'dotenv';
import mongoose, { Types } from 'mongoose';
import { Brand, Category, Product, User } from './models';

dotenv.config();

const imageUrl = 'https://example.com/images/seed-fashion.jpg';

const seed = async () => {
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    throw new Error('MONGODB_URI is not defined in environment variables');
  }

  await mongoose.connect(uri);

  const brandId = new Types.ObjectId('665000000000000000000001');
  const categoryId = new Types.ObjectId('665000000000000000000002');
  const productId = new Types.ObjectId('665000000000000000000003');
  const userId = new Types.ObjectId('665000000000000000000004');

  await Brand.updateOne(
    { _id: brandId },
    {
      $setOnInsert: {
        _id: brandId,
        name: 'Seed Brand',
        image: imageUrl,
        isActive: true,
      },
    },
    { upsert: true },
  );

  await Category.updateOne(
    { _id: categoryId },
    {
      $setOnInsert: {
        _id: categoryId,
        name: 'Seed Category',
        parent_id: null,
        level: 1,
        gender: 'male',
        image: imageUrl,
        bannerImage: imageUrl,
        description: 'Seed category used to initialize the collection.',
        isLeaf: true,
        isSizeTemplateSource: true,
        sizeTemplateSourceId: null,
        sizes: ['S', 'M', 'L', 'XL'],
        measurementFields: [
          { key: 'shoulder', label: 'Vai', unit: 'cm', required: true, sortOrder: 1 },
          { key: 'chest', label: 'Ng?c', unit: 'cm', required: true, sortOrder: 2 },
          { key: 'length', label: 'D?i ?o', unit: 'cm', required: true, sortOrder: 3 },
        ],
        fitTypes: [
          {
            _id: new Types.ObjectId('665000000000000000000010'),
            key: 'regular',
            label: 'Regular',
            sortOrder: 1,
            isActive: true,
          },
        ],
        isActive: true,
      },
    },
    { upsert: true },
  );

  await Product.updateOne(
    { _id: productId },
    {
      $setOnInsert: {
        _id: productId,
        category_id: categoryId,
        name: 'Seed Product',
        brand_id: brandId,
        variant: [
          {
            fitTypeId: new Types.ObjectId('665000000000000000000010'),
            price: 199000,
            discount: 0,
            sizeMeasurements: [
              {
                size: 'M',
                measurements: [
                  { key: 'shoulder', value: 42 },
                  { key: 'chest', value: 96 },
                  { key: 'length', value: 68 },
                ],
              },
            ],
            colors: [
              {
                color: 'Black',
                colorCode: '#000000',
                image: imageUrl,
              },
            ],
            isActive: true,
          },
        ],
        description: 'Seed product used to initialize the collection.',
        product_image: imageUrl,
        isActive: true,
        sold_quantity: 0,
        averageRating: 0,
        reviewCount: 0,
      },
    },
    { upsert: true },
  );

  await User.updateOne(
    { _id: userId },
    {
      $setOnInsert: {
        _id: userId,
        name: 'Seed User',
        email: 'seed.user@example.com',
        password: '$2a$10$seedpasswordhashplaceholder',
        role: 'user',
        phone: '0900000000',
        gender: 'male',
        dateOfBirth: new Date('2000-01-01'),
        address: [
          {
            customerName: 'Seed User',
            province: 'Ho Chi Minh',
            district: 'District 1',
            ward: 'Ben Nghe',
            streetName: '1 Seed Street',
            phoneNumber: '0900000000',
            isDefault: true,
          },
        ],
        membership: null,
        loyaltyPoint: 0,
        membershipUpdatedAt: null,
        refreshToken: null,
        authProviders: [],
        resetPasswordToken: null,
        resetPasswordExpires: null,
        avatarImage: imageUrl,
        isActive: true,
      },
    },
    { upsert: true },
  );

  console.log('Seed completed: brand, category, product, and user collections are initialized.');
};

seed()
  .catch((error) => {
    console.error('Seed failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
