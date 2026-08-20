require('dotenv').config();
const mongoose = require('mongoose');

const APPLY = process.argv.includes('--apply');

const run = async () => {
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is not defined');

  await mongoose.connect(process.env.MONGODB_URI);
  const categories = mongoose.connection.collection('categories');
  const rows = await categories
    .find({}, { projection: { _id: 1, name: 1, parent_id: 1, gender: 1 } })
    .toArray();
  const categoryById = new Map(rows.map((category) => [String(category._id), category]));
  const resolvedGenderById = new Map();
  const resolvingIds = new Set();

  const resolveGender = (category) => {
    const categoryId = String(category._id);
    if (resolvedGenderById.has(categoryId)) return resolvedGenderById.get(categoryId);

    const parent = category.parent_id ? categoryById.get(String(category.parent_id)) : null;
    if (!parent || resolvingIds.has(categoryId)) {
      resolvedGenderById.set(categoryId, category.gender);
      return category.gender;
    }

    resolvingIds.add(categoryId);
    const gender = resolveGender(parent);
    resolvingIds.delete(categoryId);
    resolvedGenderById.set(categoryId, gender);
    return gender;
  };

  const candidates = rows
    .map((category) => ({ category, gender: resolveGender(category) }))
    .filter(({ category, gender }) => category.gender !== gender);

  console.log(`[category gender migration] mode=${APPLY ? 'apply' : 'dry-run'} candidates=${candidates.length}`);
  candidates.forEach(({ category, gender }) => {
    console.log(`- ${category.name} (${category._id}): ${category.gender} -> ${gender}`);
  });

  if (APPLY && candidates.length) {
    const result = await categories.bulkWrite(candidates.map(({ category, gender }) => ({
      updateOne: {
        filter: { _id: category._id, gender: category.gender },
        update: { $set: { gender, updatedAt: new Date() } },
      },
    })));
    console.log(`[category gender migration] updated=${result.modifiedCount}`);
  }
};

run()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
