import dotenv from 'dotenv';
import mongoose from 'mongoose';
import {
  seedAdmin,
  seedInventoryForExistingProducts,
  seedMembershipRankings,
  seedReviewsForExistingOrders,
  seedSupportFaqs,
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
  await seedReviewsForExistingOrders();
  await seedSupportFaqs();

  console.log('Seed completed: membership rankings, admin user, inventory, sample reviews, FAQs, and support response templates are initialized.');
};

seed()
  .catch((error) => {
    console.error('Seed failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
