require('dotenv').config();
const mongoose = require('mongoose');

const APPLY = process.argv.includes('--apply');
const LEGACY_UNIQUE_INDEX = 'user_id_1_product_id_1';
const ORDER_ITEM_UNIQUE_INDEX = 'order_id_1_order_item_id_1';

const findOrderItemId = (order, productId) => {
  const matchingItems = (order?.order_list ?? []).filter(
    (item) => String(item.productId) === String(productId),
  );
  return matchingItems.length === 1 ? matchingItems[0]._id : null;
};

const inferMimeType = (url) => {
  const normalized = String(url).toLowerCase().split('?')[0];
  if (normalized.endsWith('.png')) return 'image/png';
  if (normalized.endsWith('.webp')) return 'image/webp';
  return 'image/jpeg';
};

const run = async () => {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI is not defined in environment variables');

  await mongoose.connect(uri, { autoIndex: false });
  const reviews = mongoose.connection.collection('reviews');
  const orders = mongoose.connection.collection('orders');
  const users = mongoose.connection.collection('users');
  const helpfulVotes = mongoose.connection.collection('reviewhelpfulvotes');

  const missingOrderItems = await reviews
    .find({ $or: [{ order_item_id: { $exists: false } }, { order_item_id: null }] })
    .project({ _id: 1, order_id: 1, product_id: 1 })
    .toArray();

  const backfills = [];
  const unresolved = [];
  for (const review of missingOrderItems) {
    const order = await orders.findOne(
      { _id: review.order_id },
      { projection: { order_list: 1 } },
    );
    const orderItemId = findOrderItemId(order, review.product_id);
    if (orderItemId) backfills.push({ reviewId: review._id, orderItemId });
    else unresolved.push(review._id);
  }

  console.log(`[review migration] mode=${APPLY ? 'apply' : 'dry-run'}`);
  console.log(`[review migration] missing order_item_id=${missingOrderItems.length}`);
  console.log(`[review migration] resolvable=${backfills.length}, unresolved=${unresolved.length}`);
  if (unresolved.length) {
    console.log('[review migration] unresolved review ids:', unresolved.map(String));
    throw new Error('Resolve ambiguous/missing order items before applying the review migration');
  }

  if (APPLY && backfills.length) {
    await reviews.bulkWrite(backfills.map(({ reviewId, orderItemId }) => ({
      updateOne: {
        filter: { _id: reviewId },
        update: { $set: { order_item_id: orderItemId } },
      },
    })));
  }

  const legacyImageReviews = await reviews
    .find({ images: { $elemMatch: { $type: 'string' } } })
    .project({ _id: 1, images: 1 })
    .toArray();
  console.log(`[review migration] reviews with legacy image URLs=${legacyImageReviews.length}`);
  if (APPLY && legacyImageReviews.length) {
    await reviews.bulkWrite(legacyImageReviews.map((review) => ({
      updateOne: {
        filter: { _id: review._id },
        update: {
          $set: {
            images: review.images.map((image) => typeof image === 'string' ? {
              _id: new mongoose.Types.ObjectId(),
              url: image,
              thumbnailUrl: image,
              publicId: null,
              mimeType: inferMimeType(image),
              size: 0,
              width: null,
              height: null,
            } : image),
          },
        },
      },
    })));
  }

  const duplicates = await reviews.aggregate([
    { $match: { order_id: { $ne: null }, order_item_id: { $ne: null } } },
    {
      $group: {
        _id: { order_id: '$order_id', order_item_id: '$order_item_id' },
        reviewIds: { $push: '$_id' },
        count: { $sum: 1 },
      },
    },
    { $match: { count: { $gt: 1 } } },
  ]).toArray();

  console.log(`[review migration] duplicate order items=${duplicates.length}`);
  if (duplicates.length) {
    console.log('[review migration] duplicates:', duplicates.map((item) => ({
      orderId: String(item._id.order_id),
      orderItemId: String(item._id.order_item_id),
      reviewIds: item.reviewIds.map(String),
    })));
    throw new Error('Resolve duplicate order-item reviews before creating the unique index');
  }

  const staffNeedingRead = await users.countDocuments({
    role: 'staff',
    $and: [
      { permissions: { $in: ['reviews.moderate', 'reviews.reply'] } },
      { permissions: { $ne: 'reviews.read' } },
    ],
  });
  console.log(`[review migration] staff needing reviews.read=${staffNeedingRead}`);

  if (!APPLY) {
    console.log('[review migration] dry-run complete; rerun with --apply after reviewing this report');
    return;
  }

  const indexes = await reviews.indexes();
  if (!indexes.some((index) => index.name === ORDER_ITEM_UNIQUE_INDEX)) {
    await reviews.createIndex(
      { order_id: 1, order_item_id: 1 },
      { name: ORDER_ITEM_UNIQUE_INDEX, unique: true },
    );
    console.log(`[review migration] created ${ORDER_ITEM_UNIQUE_INDEX}`);
  }
  if (indexes.some((index) => index.name === LEGACY_UNIQUE_INDEX)) {
    await reviews.dropIndex(LEGACY_UNIQUE_INDEX);
    console.log(`[review migration] dropped ${LEGACY_UNIQUE_INDEX}`);
  }

  await reviews.createIndex(
    { product_id: 1, moderationStatus: 1, createdAt: -1 },
    { name: 'product_id_1_moderationStatus_1_createdAt_-1' },
  );
  await reviews.createIndex(
    { user_id: 1, createdAt: -1 },
    { name: 'user_id_1_createdAt_-1' },
  );
  await users.updateMany(
    {
      role: 'staff',
      permissions: { $in: ['reviews.moderate', 'reviews.reply'] },
    },
    { $addToSet: { permissions: 'reviews.read' } },
  );
  await helpfulVotes.createIndex(
    { review_id: 1, user_id: 1 },
    { name: 'review_id_1_user_id_1', unique: true },
  );
  await helpfulVotes.createIndex(
    { user_id: 1, createdAt: -1 },
    { name: 'user_id_1_createdAt_-1' },
  );
  console.log('[review migration] applied indexes and staff permission backfill');
};

run()
  .then(() => mongoose.disconnect())
  .catch(async (error) => {
    console.error(error);
    await mongoose.disconnect();
    process.exitCode = 1;
  });
