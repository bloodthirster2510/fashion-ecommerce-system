require('dotenv').config();
const mongoose = require('mongoose');

const INDEX_NAME = 'phone_1';
const INDEX_KEY = { phone: 1 };
const INDEX_OPTIONS = {
  name: INDEX_NAME,
  unique: true,
  partialFilterExpression: { phone: { $type: 'string' } },
};

const isPhoneIndex = (index) => (
  index.key
  && Object.keys(index.key).length === 1
  && index.key.phone === 1
);

const run = async () => {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('MONGODB_URI is not defined in environment variables');
  }

  await mongoose.connect(uri, { autoIndex: false });
  const users = mongoose.connection.collection('users');
  const duplicatePhones = await users.aggregate([
    { $match: { phone: { $type: 'string' } } },
    { $group: { _id: '$phone', count: { $sum: 1 } } },
    { $match: { count: { $gt: 1 } } },
    { $sort: { count: -1, _id: 1 } },
  ]).toArray();

  if (duplicatePhones.length > 0) {
    throw new Error(
      `Cannot create the unique phone index: found ${duplicatePhones.length} duplicated phone value(s)`,
    );
  }

  const indexes = await users.indexes();
  const existingPhoneIndex = indexes.find(isPhoneIndex);
  const alreadyUnique = existingPhoneIndex?.unique === true
    && existingPhoneIndex.partialFilterExpression?.phone?.$type === 'string';

  if (alreadyUnique) {
    console.log(`Unique phone index ${existingPhoneIndex.name} is already active`);
    return;
  }

  if (existingPhoneIndex) {
    await users.dropIndex(existingPhoneIndex.name);
    console.log(`Dropped non-unique phone index ${existingPhoneIndex.name}`);
  }

  await users.createIndex(INDEX_KEY, INDEX_OPTIONS);
  console.log(`Created partial unique phone index ${INDEX_NAME}`);
};

run()
  .then(() => mongoose.disconnect())
  .catch(async (error) => {
    console.error(error);
    await mongoose.disconnect();
    process.exitCode = 1;
  });
