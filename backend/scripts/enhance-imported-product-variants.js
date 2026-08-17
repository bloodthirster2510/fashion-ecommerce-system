const path = require('path');
const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

const TARGET_COLOR_COUNT = Number(process.env.IMPORTED_VARIANT_COLOR_COUNT ?? 3);
const REQUEST_DELAY_MS = Number(process.env.IMPORTED_VARIANT_DELAY_MS ?? 120);
const SOURCE_PROVIDERS = String(process.env.IMPORTED_VARIANT_PROVIDERS ?? 'ivymoda,demo-shoes')
  .split(',')
  .map((provider) => provider.trim())
  .filter(Boolean);

const COLOR_PALETTE = [
  { color: 'Đen', colorCode: '#111111' },
  { color: 'Trắng', colorCode: '#f7f7f7' },
  { color: 'Kem', colorCode: '#efe4cf' },
  { color: 'Be', colorCode: '#d8bf94' },
  { color: 'Nâu', colorCode: '#7a5138' },
  { color: 'Ghi', colorCode: '#8f9397' },
  { color: 'Xanh navy', colorCode: '#112a46' },
  { color: 'Hồng phấn', colorCode: '#e7aebe' },
  { color: 'Đỏ rượu', colorCode: '#8f1f32' },
  { color: 'Tím lavender', colorCode: '#a78bc3' },
  { color: 'Bạc', colorCode: '#c8c8c8' },
];

const SHOE_COLOR_PALETTE = [
  { color: 'Đen', colorCode: '#111111' },
  { color: 'Nâu', colorCode: '#6f4e37' },
  { color: 'Be', colorCode: '#d8bf94' },
  { color: 'Kem', colorCode: '#eadfcf' },
  { color: 'Trắng', colorCode: '#f6f6f6' },
  { color: 'Ghi', colorCode: '#8b9098' },
  { color: 'Xanh navy', colorCode: '#16263f' },
  { color: 'Bạc', colorCode: '#c8c8c8' },
  { color: 'Hồng phấn', colorCode: '#e7aebe' },
];

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function stableHash(value) {
  return String(value)
    .split('')
    .reduce((hash, character) => (hash * 31 + character.charCodeAt(0)) >>> 0, 13);
}

function normalizeText(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase();
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function getImageKey(url) {
  const normalizedUrl = String(url ?? '').replace(/\/thumab\/1400\//, '/thumab/400/');
  return normalizedUrl.split('/').pop() ?? normalizedUrl;
}

function normalizeImageUrl(url) {
  return String(url ?? '').replace(/\/thumab\/1400\//, '/thumab/400/').trim();
}

function pick(values, seed, offset = 0) {
  if (!values.length) return undefined;
  return values[(stableHash(`${seed}-${offset}`) % values.length + values.length) % values.length];
}

function pickDistinctImage(images, seed, offset, usedImageKeys) {
  if (!images.length) return undefined;

  for (let index = 0; index < images.length; index += 1) {
    const candidate = pick(images, seed, offset + index);
    const candidateKey = getImageKey(candidate);

    if (candidate && !usedImageKeys.has(candidateKey)) {
      usedImageKeys.add(candidateKey);
      return candidate;
    }
  }

  const fallback = images[0];
  usedImageKeys.add(getImageKey(fallback));
  return fallback;
}

function buildSku(productId, variantId, colorVariantId, size) {
  const skuSize = String(size).trim().toUpperCase().replace(/[^A-Z0-9]+/g, '');
  return [
    'VAR',
    productId.toString().slice(-6),
    variantId.toString().slice(-6),
    colorVariantId.toString().slice(-6),
    skuSize || 'SIZE',
  ].join('-').toUpperCase();
}

async function fetchText(url) {
  const response = await fetch(url, {
    headers: {
      'user-agent': 'Mozilla/5.0 (compatible; FashionShopVariantEnhancer/1.0)',
      accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
  });

  if (!response.ok) {
    throw new Error(`Request failed ${response.status} for ${url}`);
  }

  return response.text();
}

function extractIvyGalleryImages(html) {
  const start = html.indexOf('product-detail__gallery');
  const end = start >= 0 ? html.indexOf('product-detail__information', start) : -1;
  const chunk = start >= 0 ? html.slice(start, end >= 0 ? end : start + 50000) : html;
  const imageMatches = [
    ...chunk.matchAll(/(?:data-image|src)=["'](https:\/\/pubcdn\.ivymoda\.com\/files\/product\/[^"']+?\.(?:webp|jpg|png))["']/gi),
  ];
  const images = imageMatches.map((match) => normalizeImageUrl(match[1]));
  const byKey = new Map();

  for (const image of images) {
    byKey.set(getImageKey(image), image);
  }

  return [...byKey.values()];
}

async function getIvyGalleryImages(product, cache) {
  const url = product.externalSource?.url;

  if (!url || !url.startsWith('https://ivymoda.com/')) {
    return [];
  }

  if (cache.has(url)) {
    return cache.get(url);
  }

  try {
    const html = await fetchText(url);
    const images = extractIvyGalleryImages(html);
    cache.set(url, images);
    await sleep(REQUEST_DELAY_MS);
    return images;
  } catch (error) {
    console.warn(`Could not fetch gallery for ${url}: ${error.message}`);
    cache.set(url, []);
    return [];
  }
}

function getGroupKey(product) {
  const provider = product.externalSource?.provider ?? '';
  const categoryName = normalizeText(product.category?.name ?? '');
  const name = normalizeText(product.name);

  if (provider === 'demo-shoes' || categoryName.includes('giay') || categoryName.includes('dep') || name.includes('giay') || name.includes('sandal')) {
    return `shoe:${product.category?.gender ?? 'unisex'}:${product.category?.name ?? ''}`;
  }

  return `apparel:${product.category?.gender ?? 'unisex'}:${product.category?.name ?? ''}`;
}

function getPaletteForProduct(product) {
  const groupKey = getGroupKey(product);
  return groupKey.startsWith('shoe:') ? SHOE_COLOR_PALETTE : COLOR_PALETTE;
}

function getColorChoices(product, count) {
  const existingColors = (product.variant ?? [])
    .flatMap((variant) => variant.colors ?? [])
    .map((color) => String(color.color ?? '').trim())
    .filter(Boolean);
  const existingSet = new Set(existingColors.map(normalizeText));
  const palette = getPaletteForProduct(product).filter((item) => !existingSet.has(normalizeText(item.color)));
  const choices = [];

  for (let index = 0; index < palette.length && choices.length < count; index += 1) {
    const choice = pick(palette, `${product._id}-${product.name}`, index);

    if (choice && !choices.some((item) => normalizeText(item.color) === normalizeText(choice.color))) {
      choices.push(choice);
    }
  }

  return choices;
}

function getQuantityForSize(productId, colorVariantId, size) {
  return 8 + (stableHash(`${productId}-${colorVariantId}-${size}`) % 18);
}

async function getImagePools(db, products) {
  const pools = new Map();

  for (const product of products) {
    const groupKey = getGroupKey(product);
    const images = [
      product.product_image,
      ...(product.variant ?? []).flatMap((variant) => (variant.colors ?? []).map((color) => color.image)),
    ].map(normalizeImageUrl);

    pools.set(groupKey, unique([...(pools.get(groupKey) ?? []), ...images]));
  }

  const allImages = await db.collection('products')
    .find(
      {
        product_image: { $type: 'string', $ne: '' },
        $or: [
          { 'externalSource.provider': { $in: SOURCE_PROVIDERS } },
          { name: { $regex: /giày|dép|sandal|cao gót|loafer|sneaker/i } },
        ],
      },
      { projection: { product_image: 1, name: 1 } },
    )
    .toArray();
  const globalShoeImages = allImages
    .filter((item) => /giày|dép|sandal|cao gót|loafer|sneaker/i.test(item.name ?? ''))
    .map((item) => normalizeImageUrl(item.product_image));
  const globalImages = allImages.map((item) => normalizeImageUrl(item.product_image));

  for (const [groupKey, images] of pools.entries()) {
    if (images.length >= TARGET_COLOR_COUNT) continue;

    const fallbackImages = groupKey.startsWith('shoe:') && globalShoeImages.length ? globalShoeImages : globalImages;
    pools.set(groupKey, unique([...images, ...fallbackImages]));
  }

  return pools;
}

function getImagesForProduct(product, productImages, imagePools) {
  const groupKey = getGroupKey(product);
  const poolImages = imagePools.get(groupKey) ?? [];
  return unique([
    product.product_image,
    ...(product.variant ?? []).flatMap((variant) => (variant.colors ?? []).map((color) => color.image)),
    ...productImages,
    ...poolImages,
  ].map(normalizeImageUrl));
}

async function ensureInventoryForColor(db, product, variant, color) {
  const inventories = db.collection('inventories');
  const now = new Date();

  for (const sizeMeasurement of variant.sizeMeasurements ?? []) {
    const size = String(sizeMeasurement.size ?? '').trim();
    if (!size) continue;

    const quantity = getQuantityForSize(product._id, color._id, size);
    await inventories.updateOne(
      {
        productId: product._id,
        variantId: variant._id,
        colorVariantId: color._id,
        size,
      },
      {
        $setOnInsert: {
          productId: product._id,
          variantId: variant._id,
          colorVariantId: color._id,
          size,
          sku: buildSku(product._id, variant._id, color._id, size),
          quantity,
          reservedQuantity: 0,
          availableQuantity: quantity,
          lowStockThreshold: 5,
          createdAt: now,
          updatedAt: now,
        },
      },
      { upsert: true },
    );
  }
}

async function enhanceProduct(db, product, productImages, imagePools) {
  const products = db.collection('products');
  const variants = product.variant ?? [];

  // Không thể suy ra biến thể màu từ ảnh của một sản phẩm khác. Với giày,
  // chỉ giữ các màu/ảnh đã được nhập thật thay vì tự bổ sung từ image pool.
  if (getGroupKey(product).startsWith('shoe:')) {
    return { changed: false, addedColors: 0 };
  }

  const images = getImagesForProduct(product, productImages, imagePools);
  let changed = false;
  let addedColors = 0;

  for (const variant of variants) {
    const colors = [...(variant.colors ?? [])];
    const missingColorCount = Math.max(0, TARGET_COLOR_COUNT - colors.length);
    const colorChoices = getColorChoices(product, missingColorCount);

    for (let index = 0; index < missingColorCount; index += 1) {
      const image = pick(images, `${product._id}-${variant._id}`, index + colors.length) ?? product.product_image;
      const choice = colorChoices[index] ?? pick(getPaletteForProduct(product), `${product._id}-fallback`, index);

      colors.push({
        _id: new mongoose.Types.ObjectId(),
        color: choice.color,
        colorCode: choice.colorCode,
        image,
        isActive: true,
      });
      addedColors += 1;
      changed = true;
    }

    variant.colors = colors;

    const usedImageKeys = new Set();
    colors.forEach((color, colorIndex) => {
      const imageKey = getImageKey(color.image);

      if (color.image && !usedImageKeys.has(imageKey)) {
        usedImageKeys.add(imageKey);
        return;
      }

      const replacementImage = pickDistinctImage(images, `${product._id}-${variant._id}`, colorIndex, usedImageKeys);

      if (replacementImage && replacementImage !== color.image) {
        color.image = replacementImage;
        changed = true;
      }
    });

    for (const color of colors) {
      await ensureInventoryForColor(db, product, variant, color);
    }
  }

  if (changed) {
    await products.updateOne(
      { _id: product._id },
      {
        $set: {
          variant: variants,
          updatedAt: new Date(),
        },
      },
    );
  }

  return { changed, addedColors };
}

async function run() {
  if (!process.env.MONGODB_URI) {
    throw new Error('Missing MONGODB_URI in backend/.env');
  }

  if (!Number.isInteger(TARGET_COLOR_COUNT) || TARGET_COLOR_COUNT < 2) {
    throw new Error('IMPORTED_VARIANT_COLOR_COUNT must be an integer >= 2');
  }

  await mongoose.connect(process.env.MONGODB_URI);
  const db = mongoose.connection.db;
  const products = await db.collection('products')
    .aggregate([
      { $match: { 'externalSource.provider': { $in: SOURCE_PROVIDERS } } },
      { $lookup: { from: 'categories', localField: 'category_id', foreignField: '_id', as: 'category' } },
      { $unwind: { path: '$category', preserveNullAndEmptyArrays: true } },
      { $sort: { createdAt: 1 } },
    ])
    .toArray();
  const imagePools = await getImagePools(db, products);
  const ivyGalleryCache = new Map();
  let updatedProducts = 0;
  let addedColors = 0;

  for (const product of products) {
    const productImages = product.externalSource?.provider === 'ivymoda'
      ? await getIvyGalleryImages(product, ivyGalleryCache)
      : [];
    const result = await enhanceProduct(db, product, productImages, imagePools);

    if (result.changed) {
      updatedProducts += 1;
      addedColors += result.addedColors;
      console.log(`Enhanced ${product.name}: +${result.addedColors} color/image option(s)`);
    }
  }

  console.log(
    JSON.stringify(
      {
        scannedProducts: products.length,
        updatedProducts,
        addedColors,
        targetColorCount: TARGET_COLOR_COUNT,
        providers: SOURCE_PROVIDERS,
      },
      null,
      2,
    ),
  );
}

run()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
