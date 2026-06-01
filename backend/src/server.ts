import dotenv from 'dotenv';
import app from './app';
import { connectDB } from './config/database';
import { seedMembershipRankings, seedAdmin, seedInventoryForExistingProducts } from './database/seeders';

dotenv.config();

const PORT = process.env.PORT || 3000;

const startServer = async () => {
  await connectDB();

  if (process.env.SEED_DB === 'true') {
    await seedMembershipRankings();
    await seedAdmin();
    await seedInventoryForExistingProducts();
  }

  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
};

startServer().catch((err) => {
  console.error('Server failed to start:', err);
  process.exit(1);
});
