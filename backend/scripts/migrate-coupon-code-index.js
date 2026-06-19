require('dotenv').config();
const mongoose = require('mongoose');

const LEGACY_INDEX_NAME = 'code_1';
const ACTIVE_INDEX_NAME = 'coupon_active_code_unique';

const run = async () => {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('MONGODB_URI is not defined in environment variables');
  }

  await mongoose.connect(uri, { autoIndex: false });
  const coupons = mongoose.connection.collection('coupons');
  const indexes = await coupons.indexes();

  if (!indexes.some((index) => index.name === ACTIVE_INDEX_NAME)) {
    await coupons.createIndex(
      { code: 1 },
      {
        name: ACTIVE_INDEX_NAME,
        unique: true,
        partialFilterExpression: { deletedAt: null },
      },
    );
    console.log(`Created partial unique index ${ACTIVE_INDEX_NAME}`);
  }

  if (indexes.some((index) => index.name === LEGACY_INDEX_NAME)) {
    await coupons.dropIndex(LEGACY_INDEX_NAME);
    console.log(`Dropped legacy index ${LEGACY_INDEX_NAME}`);
  }
};

run()
  .then(() => mongoose.disconnect())
  .catch(async (error) => {
    console.error(error);
    await mongoose.disconnect();
    process.exitCode = 1;
  });
