import dotenv from 'dotenv';
import mongoose from 'mongoose';
import {
  seedAdmin,
  seedInventoryForExistingProducts,
  seedMembershipRankings,
} from './seeders';

dotenv.config();

const seed = async () => {
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    throw new Error('MONGODB_URI is not defined in environment variables');
  }

  await mongoose.connect(uri);

  await seedMembershipRankings();
  await seedAdmin();
  await seedInventoryForExistingProducts();

  console.log('Seed completed: membership rankings, admin user, and inventory are initialized.');
};

seed()
  .catch((error) => {
    console.error('Seed failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
