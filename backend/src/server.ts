import dotenv from 'dotenv';
import app from './app';
import { connectDB } from './config/database';
import { seedMembershipRankings, seedAdmin, seedInventoryForExistingProducts } from './database/seeders';
import { paymentExpiryScheduler } from './modules/payments/payment-expiry.scheduler';

dotenv.config();

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  await connectDB();

  if (process.env.SEED_DB === 'true') {
    await seedMembershipRankings();
    await seedAdmin();
    await seedInventoryForExistingProducts();
  }

  paymentExpiryScheduler.startPaymentExpiryScheduler();

  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
};

startServer().catch((err) => {
  console.error('Server failed to start:', err);
  process.exit(1);
});
