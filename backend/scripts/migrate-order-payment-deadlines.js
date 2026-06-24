require('dotenv').config();
const mongoose = require('mongoose');

const APPLY = process.argv.includes('--apply');
const ONLINE_METHODS = ['VNPAY', 'MOMO', 'CARD', 'BANK'];

const run = async () => {
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is not defined');
  const days = Number(process.env.ORDER_PAYMENT_DEADLINE_DAYS || 3);
  const deadlineMs = (Number.isFinite(days) && days >= 0 ? days : 3) * 24 * 60 * 60 * 1000;
  await mongoose.connect(process.env.MONGODB_URI);
  const orders = mongoose.connection.collection('orders');
  const filter = {
    status: 'confirmed',
    paymentMethod: { $in: ONLINE_METHODS },
    paymentStatus: { $in: ['pending', 'failed'] },
    $or: [{ paymentDeadlineAt: null }, { paymentDeadlineAt: { $exists: false } }],
  };
  const candidates = await orders.find(filter, { projection: { _id: 1, createdAt: 1 } }).toArray();
  console.log(`[payment deadline migration] mode=${APPLY ? 'apply' : 'dry-run'} candidates=${candidates.length}`);

  if (APPLY && candidates.length) {
    const result = await orders.bulkWrite(candidates.map((order) => ({
      updateOne: {
        filter: { _id: order._id, ...filter },
        update: {
          $set: {
            paymentDeadlineAt: new Date(new Date(order.createdAt).getTime() + deadlineMs),
            paymentDeadlineWarningSentAt: null,
          },
        },
      },
    })));
    console.log(`[payment deadline migration] updated=${result.modifiedCount}`);
  }
};

run()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
